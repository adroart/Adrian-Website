import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  appendArtworkLedgerEntry,
  appendReconnectionEvent,
  appendSharedSaleMessage,
  correctVerifiedSale,
  createReconnectionCase,
  createVerifiedSale,
  getArtistSaleDetail,
  identifyArtworkRecord,
  linkArtworkIdentity,
  listArtistSaleWorkspace,
} from '../functions/api/_lib/artistSales.js';
import {
  storeArtworkLedgerMedia as storeArtworkLedgerMediaRaw,
} from '../functions/api/_lib/artworkLedgerMedia.js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

const migrationsThroughArtistSales = [
  '001_init.sql', '002_invoices.sql',
  '003_atlas_legacy.sql', '003_viewings.sql',
  '004_invoice_payment_choice.sql', '004_piece_content.sql',
  '005_atlas_legacy.sql', '005_invoice_amount_paid.sql',
  '006_better_auth.sql', '007_pricing.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql',
  '030_collector_field.sql', '031_collector_letters.sql',
  '032_artist_verified_sales.sql',
].map(readMigration).join('\n');

const now = '2026-08-10T12:00:00.000Z';
const digest = (character: string) => character.repeat(64);
const uniqueEdition = '{"kind":"unique","number":null,"size":null}';
const numberedEdition = (number: number, size: number | null) =>
  JSON.stringify({ kind: 'numbered', number, size });

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    ${migrationsThroughArtistSales}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('artist-admin', 'Artist Administrator', 'artist@example.com', 1, 1, 1),
      ('artist-second', 'Second Administrator', 'second@example.com', 1, 1, 1);
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, registered_at)
    VALUES
      ('kp-sale-one', 'UL-100', 1, '${digest('a')}', '${now}'),
      ('kp-sale-two', 'UL-101', 2, '${digest('b')}', '${now}'),
      ('kp-sale-unique', 'SIG-200', 0, '${digest('c')}', '${now}');
  `);
  return db;
}

function columns(db: DatabaseSync, table: string) {
  return db.prepare(`SELECT name FROM pragma_table_info(?) ORDER BY cid`).all(table)
    .map((row) => row.name);
}

function foreignKeys(db: DatabaseSync, table: string) {
  return db.prepare(`
    SELECT "from" AS source, "table" AS target, "to" AS destination,
           on_delete AS onDelete
      FROM pragma_foreign_key_list(?)
     ORDER BY "from", "table"
  `).all(table).map((row) => ({ ...row }));
}

function recordSnapshot(input: {
  artworkId: string | null;
  editionJson: string | null;
  keeperPieceId: string | null;
  identificationStatus: 'unresolved' | 'identified' | 'identity_linked';
  recordVersion: number;
}) {
  return JSON.stringify({
    artworkId: input.artworkId,
    editionJson: input.editionJson === null ? null : JSON.parse(input.editionJson),
    keeperPieceId: input.keeperPieceId,
    identificationStatus: input.identificationStatus,
    recordVersion: input.recordVersion,
  });
}

function saleSnapshot(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reconnectionCaseId: 'case-one',
    occurrencePrecision: 'exact',
    occurredOn: '2026-08-01',
    buyerEmail: 'collector@example.com',
    currency: 'USD',
    totalMinor: 300000,
    privateReference: 'Studio ledger page 18',
    privateNotes: 'Introduced by a mutual friend.',
    verifiedByUserId: 'artist-admin',
    recordedAt: now,
    ...overrides,
  });
}

function seedCaseAndRecords(db: DatabaseSync) {
  db.exec(`
    INSERT INTO artist_reconnection_cases
      (id, recipient_email, recipient_name, private_context, status,
       created_by_user_id, idempotency_key, request_digest, created_at, updated_at)
    VALUES
      ('case-one', 'collector@example.com', 'A Collector', 'Met in Ubud.', 'open',
       'artist-admin', 'case-one-key', '${digest('1')}', '${now}', '${now}');

    INSERT INTO artist_artwork_records
      (id, artwork_id, edition_json, keeper_piece_id, identification_status,
       created_by_user_id, created_at, updated_at)
    VALUES
      ('record-unresolved', NULL, NULL, NULL, 'unresolved',
       'artist-admin', '${now}', '${now}'),
      ('record-identified', 'UL-102', '${uniqueEdition}', NULL, 'identified',
       'artist-admin', '${now}', '${now}'),
      ('record-linked', 'UL-100', '${numberedEdition(1, 64)}', 'kp-sale-one', 'identity_linked',
       'artist-admin', '${now}', '${now}');
  `);
}

function insertPrimarySale(db: DatabaseSync) {
  db.exec(`
    INSERT INTO artist_verified_sales
      (id, reconnection_case_id, occurrence_precision, occurred_on, buyer_email,
       currency, total_minor, private_reference, private_notes,
       verified_by_user_id, idempotency_key, request_digest, recorded_at)
    VALUES
      ('sale-one', 'case-one', 'exact', '2026-08-01', 'collector@example.com',
       'USD', 300000, 'Studio ledger page 18', 'Introduced by a mutual friend.',
       'artist-admin', 'sale-one-key', '${digest('2')}', '${now}');
    INSERT INTO artist_verified_sale_items
      (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
    VALUES
      ('item-one', 'sale-one', 'record-unresolved', 100000, 'USD', '${now}'),
      ('item-two', 'sale-one', 'record-identified', NULL, NULL, '${now}'),
      ('item-three', 'sale-one', 'record-linked', 200000, 'USD', '${now}');
  `);
}

function count(db: DatabaseSync, table: string) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count);
}

function serviceEnvironment(options: {
  failBatchAt?: number;
  loseFirstResponse?: boolean;
  loseResponseAtBatch?: number;
  beforeBatch?: () => Promise<void>;
  skipBatchExecution?: boolean;
  overrideBatchResults?: (results: any[], batchNumber: number) => any;
  overrideAllResults?: (sql: string, results: any[]) => any[];
  onQuery?: (sql: string) => void;
} = {}) {
  const db = database();
  let batches = 0;
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { options.onQuery?.(sql); return db.prepare(sql).get(...values) ?? null; },
        all() {
          options.onQuery?.(sql);
          const results = db.prepare(sql).all(...values);
          return { results: options.overrideAllResults?.(sql, results) ?? results };
        },
        run() {
          options.onQuery?.(sql);
          const result = db.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      await options.beforeBatch?.();
      batches += 1;
      if (options.skipBatchExecution) {
        return options.overrideBatchResults?.([], batches) ?? [];
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement, index) => {
          if (options.failBatchAt === index) throw new Error('simulated batch failure');
          options.onQuery?.(statement.sql);
          const result = db.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        db.exec('COMMIT');
        if ((options.loseFirstResponse && batches === 1)
          || options.loseResponseAtBatch === batches) throw new Error('simulated lost response');
        return options.overrideBatchResults?.(results, batches) ?? results;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, env: { DB }, get batches() { return batches; } };
}

const administrator = { userId: 'artist-admin', email: 'artist@example.com' };

function storeArtworkLedgerMedia(bucket: any, input: Record<string, unknown>) {
  const { bytes, source, contentLength, ...rest } = input;
  let length = contentLength;
  if (length === undefined && bytes != null) {
    if (bytes instanceof ArrayBuffer) length = bytes.byteLength;
    else if (ArrayBuffer.isView(bytes)) length = bytes.byteLength;
  }
  return storeArtworkLedgerMediaRaw(bucket, {
    ...rest,
    source: source ?? new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    contentLength: length,
    signal: new AbortController().signal,
  } as any);
}

function mediaStream(chunks: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function readMediaStream(source: ReadableStream<Uint8Array>, onChunk?: (chunk: Uint8Array) => void) {
  const reader = source.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const read = await reader.read();
    if (read.done) break;
    const chunk = new Uint8Array(read.value.buffer, read.value.byteOffset, read.value.byteLength);
    onChunk?.(chunk);
    chunks.push(chunk);
    length += chunk.byteLength;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

type FakeMediaObject = {
  bytes: Uint8Array;
  contentType?: string;
  arrayBufferFailure?: Error;
  cancelFailure?: Error;
  releaseLockFailure?: Error;
  reportedKey?: string;
  reportedSize?: number;
  streamBytes?: Uint8Array;
  streamChunkValue?: unknown;
  streamFailure?: Error;
  streamFailureAtRead?: number;
};

function mediaBucket(options: {
  putFailure?: Error;
  getFailure?: Error;
  missingReadBack?: boolean;
  mutateStored?: (stored: FakeMediaObject, key: string, putNumber: number) => void;
  omitBody?: boolean;
  beforePut?: (putNumber: number) => Promise<void>;
  beforeGet?: (getNumber: number) => Promise<void>;
  beforeReadBackRead?: (readNumber: number) => Promise<void>;
  failPutAt?: number;
  recordPutBytes?: boolean;
  streamChunkSize?: number;
  trackLifecycles?: boolean;
  admissionHeadFailure?: Error;
  admissionPutFailureAt?: number;
  beforeAdmissionHead?: (headNumber: number) => Promise<void>;
} = {}) {
  const admissionKey = 'artwork-ledger/_private/upload-admission';
  let admission: {
    key: string; etag: string; customMetadata: Record<string, string>; body: Uint8Array;
  } | null = null;
  let admissionPutNumber = 0;
  let admissionHeadNumber = 0;
  const objects = new Map<string, FakeMediaObject>();
  const puts: Array<{ key: string; bytes: Uint8Array; options: any }> = [];
  const streamMetrics = {
    activeChunkBytes: 0,
    arrayBufferCalls: 0,
    cancelCalls: 0,
    cancelRequests: 0,
    activeLifecycles: 0,
    maxActiveLifecycles: 0,
    maxActiveChunkBytes: 0,
    maxChunkBytes: 0,
    putChunkCount: 0,
    maxPutChunkBytes: 0,
  };
  let putNumber = 0;
  let gets = 0;
  const streamBody = (stored: FakeMediaObject) => {
    const bytes = stored.streamBytes ?? stored.bytes;
    const chunkSize = options.streamChunkSize ?? (64 * 1024);
    let offset = 0;
    let readNumber = 0;
    let outstanding = 0;
    let lifecycleFinished = false;
    const finishLifecycle = () => {
      if (!options.trackLifecycles || lifecycleFinished) return;
      lifecycleFinished = true;
      streamMetrics.activeLifecycles -= 1;
    };
    const releaseOutstanding = () => {
      streamMetrics.activeChunkBytes -= outstanding;
      outstanding = 0;
    };
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        releaseOutstanding();
        readNumber += 1;
        await options.beforeReadBackRead?.(readNumber);
        if (stored.streamFailureAtRead === readNumber) {
          finishLifecycle();
          controller.error(stored.streamFailure ?? new Error('simulated stream failure'));
          return;
        }
        if (offset >= bytes.byteLength) {
          finishLifecycle();
          controller.close();
          return;
        }
        const end = Math.min(offset + chunkSize, bytes.byteLength);
        const chunk = stored.streamChunkValue === undefined
          ? new Uint8Array(bytes.subarray(offset, end))
          : stored.streamChunkValue;
        offset = end;
        outstanding = chunk instanceof Uint8Array ? chunk.byteLength : 0;
        streamMetrics.activeChunkBytes += outstanding;
        streamMetrics.maxActiveChunkBytes = Math.max(
          streamMetrics.maxActiveChunkBytes, streamMetrics.activeChunkBytes,
        );
        streamMetrics.maxChunkBytes = Math.max(streamMetrics.maxChunkBytes, outstanding);
        controller.enqueue(chunk as Uint8Array);
      },
      cancel() {
        releaseOutstanding();
        finishLifecycle();
        streamMetrics.cancelCalls += 1;
      },
    }, { highWaterMark: 0 });
    const getReader = stream.getReader.bind(stream);
    Object.defineProperty(stream, 'getReader', {
      value() {
        const reader = getReader();
        return {
          read: () => reader.read(),
          cancel: (reason?: unknown) => {
            streamMetrics.cancelRequests += 1;
            return reader.cancel(reason).then(() => {
              if (stored.cancelFailure) throw stored.cancelFailure;
            });
          },
          releaseLock: () => {
            reader.releaseLock();
            if (stored.releaseLockFailure) throw stored.releaseLockFailure;
          },
        };
      },
    });
    return stream;
  };
  return {
    objects,
    puts,
    streamMetrics,
    get gets() { return gets; },
    get admission() { return admission; },
    setAdmission(value: typeof admission) { admission = value; },
    bucket: {
      async put(key: string, value: ReadableStream<Uint8Array> | Uint8Array, putOptions: any) {
        if (key === admissionKey) {
          admissionPutNumber += 1;
          if (options.admissionPutFailureAt === admissionPutNumber) {
            throw new Error('private admission put failure');
          }
          const onlyIf = putOptions?.onlyIf;
          if (onlyIf?.etagDoesNotMatch === '*' && admission) return null;
          if (onlyIf?.etagMatches !== undefined
            && (!admission || admission.etag !== onlyIf.etagMatches)) return null;
          const body = value instanceof Uint8Array
            ? value.slice() : await readMediaStream(value as ReadableStream<Uint8Array>);
          admission = {
            key,
            etag: createHash('md5').update(body).digest('hex'),
            customMetadata: structuredClone(putOptions?.customMetadata ?? {}),
            body,
          };
          return structuredClone(admission);
        }
        putNumber += 1;
        const currentPut = putNumber;
        if (options.trackLifecycles) {
          streamMetrics.activeLifecycles += 1;
          streamMetrics.maxActiveLifecycles = Math.max(
            streamMetrics.maxActiveLifecycles, streamMetrics.activeLifecycles,
          );
        }
        const putRecord = {
          key,
          bytes: new Uint8Array(),
          options: structuredClone(putOptions),
        };
        puts.push(putRecord);
        try {
          await options.beforePut?.(currentPut);
          const valueBytes = await readMediaStream(value as ReadableStream<Uint8Array>, (chunk) => {
            streamMetrics.putChunkCount += 1;
            streamMetrics.maxPutChunkBytes = Math.max(streamMetrics.maxPutChunkBytes, chunk.byteLength);
          });
          if (options.recordPutBytes !== false) putRecord.bytes = valueBytes.slice();
          if (options.putFailure || options.failPutAt === currentPut) {
            throw options.putFailure ?? new Error('simulated put failure');
          }
          if (objects.has(key)) return null;
          const stored = {
            bytes: valueBytes,
            contentType: putOptions?.httpMetadata?.contentType,
          };
          objects.set(key, stored);
          options.mutateStored?.(stored, key, putNumber);
          return { key, httpMetadata: { contentType: stored.contentType } };
        } catch (error) {
          if (options.trackLifecycles) streamMetrics.activeLifecycles -= 1;
          throw error;
        }
      },
      async head(key: string) {
        if (options.admissionHeadFailure) throw options.admissionHeadFailure;
        if (key === admissionKey) {
          admissionHeadNumber += 1;
          const snapshot = admission && structuredClone(admission);
          await options.beforeAdmissionHead?.(admissionHeadNumber);
          return snapshot;
        }
        return null;
      },
      async get(key: string) {
        gets += 1;
        await options.beforeGet?.(gets);
        if (options.getFailure) throw options.getFailure;
        if (options.missingReadBack) return null;
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          key: stored.reportedKey ?? key,
          size: stored.reportedSize ?? stored.bytes.byteLength,
          httpMetadata: stored.contentType === undefined
            ? undefined : { contentType: stored.contentType },
          ...(!options.omitBody ? { body: streamBody(stored) } : {}),
          async arrayBuffer() {
            streamMetrics.arrayBufferCalls += 1;
            if (stored.arrayBufferFailure) throw stored.arrayBufferFailure;
            return stored.bytes.slice().buffer;
          },
        };
      },
    },
  };
}

function mediaErrorCode(code: string) {
  return (error: Error & { code?: string }) => error.code === code && error.message === code;
}

function assertSanitizedMediaError(
  error: Error & { code?: string; cause?: unknown; reference?: unknown; bytes?: unknown },
  code: string,
  privateValues: string[],
) {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.cause, undefined);
  assert.equal(error.reference, undefined);
  assert.equal(error.bytes, undefined);
  assert.deepEqual(Object.keys(error), ['code']);
  assert.equal(JSON.stringify(error), JSON.stringify({ code }));
  const exposed = `${error.message}\n${error.stack}\n${JSON.stringify(error)}`;
  for (const privateValue of privateValues) assert.doesNotMatch(exposed, new RegExp(privateValue));
}

describe('authenticity media immutable R2 storage', () => {
  it('uses request-local source streams with no module-global admission or cleanup state', async () => {
    const source = readFileSync(
      new URL('../functions/api/_lib/artworkLedgerMedia.js', import.meta.url), 'utf8',
    );
    const moduleState = source.slice(0, source.indexOf('function codedError'));
    assert.match(moduleState, /const LOCAL_CODED_ERRORS = new WeakSet\(\);/);
    assert.doesNotMatch(source,
      /activeMediaUpload|nextMediaUploadGeneration|mediaAdmissionQueue|waitUntil/);
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await storeArtworkLedgerMediaRaw(mediaBucket().bucket, {
      artworkRecordId: 'record-stream-contract',
      source: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      contentLength: bytes.byteLength,
      contentType: 'image/png',
      signal: new AbortController().signal,
    });
    assert.equal(result.byteLength, bytes.byteLength);
    await assert.rejects(storeArtworkLedgerMediaRaw(mediaBucket().bucket, {
      artworkRecordId: 'record-no-byte-input',
      bytes,
      contentLength: bytes.byteLength,
      contentType: 'image/png',
      signal: new AbortController().signal,
    } as any), mediaErrorCode('invalid_media_source'));
  });

  it('pins only the compatibility flags needed by request streaming and incremental hashing', () => {
    const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    assert.match(wrangler, /compatibility_date = "2024-09-23"/);
    assert.match(wrangler,
      /compatibility_flags = \["nodejs_compat", "enable_request_signal"\]/);
    assert.doesNotMatch(wrangler, /handle_cross_request_promise_resolution/);
  });

  it('uses an active durable R2 lease to reject busy uploads before reading their source', async () => {
    let sourceReads = 0;
    let headCalls = 0;
    const bucket = {
      async put(key: string) {
        assert.equal(key, 'artwork-ledger/_private/upload-admission');
        return null;
      },
      async head(key: string) {
        headCalls += 1;
        return {
          key,
          etag: 'lease-etag-active',
          customMetadata: {
            state: 'active',
            ownerToken: '123e4567-e89b-42d3-a456-426614174000',
            expiresAt: String(Date.now() + 60_000),
            versionNonce: '223e4567-e89b-42d3-a456-426614174000',
          },
        };
      },
    };
    const source = new ReadableStream({
      pull(controller) {
        sourceReads += 1;
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    }, { highWaterMark: 0 });
    await assert.rejects(storeArtworkLedgerMediaRaw(bucket, {
      artworkRecordId: 'record-durable-busy',
      source,
      contentLength: 1,
      contentType: 'image/png',
      signal: new AbortController().signal,
    }), mediaErrorCode('media_upload_busy'));
    assert.equal(headCalls, 1);
    assert.equal(sourceReads, 0);
  });

  it('collapses 200,000 one-byte source chunks into one aggregate and fixed upload views', async () => {
    const contentLength = 200_000;
    let emitted = 0;
    const source = new ReadableStream({
      pull(controller) {
        if (emitted === contentLength) { controller.close(); return; }
        controller.enqueue(new Uint8Array([emitted % 251]));
        emitted += 1;
      },
    }, { highWaterMark: 0 });
    const fake = mediaBucket({ recordPutBytes: false });
    const result = await storeArtworkLedgerMediaRaw(fake.bucket, {
      artworkRecordId: 'record-one-byte-fragments', source, contentLength,
      contentType: 'image/png', signal: new AbortController().signal,
    });
    assert.equal(result.byteLength, contentLength);
    assert.equal(emitted, contentLength);
    assert.equal(fake.streamMetrics.putChunkCount, Math.ceil(contentLength / (64 * 1024)));
    assert.ok(fake.streamMetrics.maxPutChunkBytes <= 64 * 1024);
  });

  it('uses unique canonical lease bodies so two same-etag takeover racers admit one source', async () => {
    let waitingHeads = 0;
    let releaseHeads: (() => void) | undefined;
    const headGate = new Promise<void>((resolve) => { releaseHeads = resolve; });
    const options: Parameters<typeof mediaBucket>[0] = {};
    const fake = mediaBucket(options);
    await storeArtworkLedgerMedia(fake.bucket, {
      artworkRecordId: 'record-prime-released-lease',
      bytes: new Uint8Array([1]), contentType: 'image/png',
    });
    const releasedEtag = fake.admission!.etag;
    options.beforeAdmissionHead = async (headNumber) => {
      if (headNumber < 2 || headNumber > 3) return;
      waitingHeads += 1;
      if (waitingHeads === 2) releaseHeads?.();
      await headGate;
    };
    const reads = [0, 0];
    const contender = (index: number) => storeArtworkLedgerMediaRaw(fake.bucket, {
      artworkRecordId: `record-takeover-racer-${index}`,
      source: new ReadableStream({
        pull(controller) {
          reads[index] += 1;
          controller.enqueue(new Uint8Array([index + 2]));
          controller.close();
        },
      }, { highWaterMark: 0 }),
      contentLength: 1, contentType: 'image/png', signal: new AbortController().signal,
    });
    const raced = await Promise.allSettled([contender(0), contender(1)]);
    assert.equal(raced.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(raced.filter((entry) => entry.status === 'rejected'
      && entry.reason.code === 'media_upload_busy').length, 1);
    assert.equal(reads.filter((count) => count > 0).length, 1);
    assert.notEqual(fake.admission!.etag, releasedEtag);
    const bodyText = new TextDecoder().decode(fake.admission!.body);
    assert.equal(fake.admission!.etag,
      createHash('md5').update(fake.admission!.body).digest('hex'));
    assert.equal(bodyText, JSON.stringify({
      ownerToken: fake.admission!.customMetadata.ownerToken,
      state: fake.admission!.customMetadata.state,
      expiresAt: fake.admission!.customMetadata.expiresAt,
      versionNonce: fake.admission!.customMetadata.versionNonce,
    }));
    assert.doesNotMatch(bodyText, /record-|artwork|png|private/i);
  });

  it('drops the aggregate after the final fixed upload chunk while R2 put remains pending', async () => {
    const lease = mediaBucket();
    const consumedChunkBuffers: ArrayBuffer[] = [];
    let notifyConsumed: (() => void) | undefined;
    const fullyConsumed = new Promise<void>((resolve) => { notifyConsumed = resolve; });
    const bucket = {
      async put(key: string, value: any, options: any) {
        if (key === 'artwork-ledger/_private/upload-admission') {
          return lease.bucket.put(key, value, options);
        }
        const reader = value.getReader();
        while (true) {
          const read = await reader.read();
          if (read.done) break;
          consumedChunkBuffers.push(read.value.buffer);
        }
        notifyConsumed?.();
        return new Promise(() => {});
      },
      head: lease.bucket.head,
    };
    const contentLength = 15 * 1024 * 1024;
    const controller = new AbortController();
    const pending = storeArtworkLedgerMediaRaw(bucket, {
      artworkRecordId: 'record-fully-consumed-pending-put',
      source: new ReadableStream({
        start(streamController) {
          streamController.enqueue(new Uint8Array(contentLength));
          streamController.close();
        },
      }),
      contentLength, contentType: 'image/png', signal: controller.signal,
    });
    await fullyConsumed;
    assert.equal(consumedChunkBuffers.length, contentLength / (64 * 1024));
    assert.ok(consumedChunkBuffers.every((buffer) => buffer.byteLength === 64 * 1024));
    assert.equal(new Set(consumedChunkBuffers).size, consumedChunkBuffers.length);
    controller.abort();
    await assert.rejects(pending, mediaErrorCode('media_upload_cancelled'));
    assert.equal(lease.admission!.customMetadata.state, 'released');
  });

  it('drops each maximum aggregate when six never-settling media puts are cancelled', async () => {
    const lease = mediaBucket();
    const retainedChunkBuffers: number[] = [];
    let notifyChunk: (() => void) | undefined;
    let chunkArrived = new Promise<void>((resolve) => { notifyChunk = resolve; });
    const bucket = {
      async put(key: string, value: any, options: any) {
        if (key === 'artwork-ledger/_private/upload-admission') {
          return lease.bucket.put(key, value, options);
        }
        const reader = value.getReader();
        const first = await reader.read();
        retainedChunkBuffers.push(first.value.buffer.byteLength);
        notifyChunk?.();
        return new Promise(() => {});
      },
      head: lease.bucket.head,
    };
    const contentLength = 15 * 1024 * 1024;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      let remaining = contentLength;
      const controller = new AbortController();
      const pending = storeArtworkLedgerMediaRaw(bucket, {
        artworkRecordId: `record-pending-put-${attempt}`,
        source: new ReadableStream({
          pull(streamController) {
            if (remaining === 0) { streamController.close(); return; }
            const length = Math.min(64 * 1024, remaining);
            remaining -= length;
            streamController.enqueue(new Uint8Array(length));
          },
        }, { highWaterMark: 0 }),
        contentLength, contentType: 'image/png', signal: controller.signal,
      });
      await chunkArrived;
      controller.abort('private cancelled pending put');
      await assert.rejects(pending, mediaErrorCode('media_upload_cancelled'));
      chunkArrived = new Promise<void>((resolve) => { notifyChunk = resolve; });
    }
    assert.equal(retainedChunkBuffers.length, 6);
    assert.ok(retainedChunkBuffers.every((bytes) => bytes <= 64 * 1024));
    assert.ok(retainedChunkBuffers.reduce((sum, bytes) => sum + bytes, 0) <= 6 * 64 * 1024);
    assert.equal(lease.admission!.customMetadata.state, 'released');
  });

  it('requires a genuine live AbortSignal and request body stream before any R2 work', async () => {
    const source = readFileSync(
      new URL('../functions/api/_lib/artworkLedgerMedia.js', import.meta.url), 'utf8',
    );
    const storeSource = source.slice(source.indexOf('export async function storeArtworkLedgerMedia'));
    const fake = mediaBucket();
    const base = {
      artworkRecordId: 'record-signal-validation',
      source: mediaStream([new Uint8Array([1, 2, 3])]),
      contentLength: 3,
      contentType: 'image/png',
    };
    for (const signal of [
      undefined,
      null,
      {},
      { aborted: false, addEventListener() {}, removeEventListener() {} },
      { aborted: 'false', addEventListener() {}, removeEventListener() {} },
    ]) {
      await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
        ...base, signal,
      } as any), mediaErrorCode('invalid_abort_signal'));
    }

    for (const invalidSource of [undefined, null, {}, new Uint8Array([1]), new ArrayBuffer(1)]) {
      await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
        ...base,
        source: invalidSource,
        signal: new AbortController().signal,
      } as any), mediaErrorCode('invalid_media_source'));
    }

    const controller = new AbortController();
    controller.abort('private cancellation reason');
    await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
      ...base, signal: controller.signal,
    }), (error: Error & { code?: string }) => {
      assertSanitizedMediaError(error, 'media_upload_cancelled', [
        'private cancellation reason', base.artworkRecordId,
      ]);
      return true;
    });
    assert.equal(fake.puts.length, 0);
    assert.equal(fake.gets, 0);
    assert.ok(storeSource.indexOf('validateAbortSignal') < storeSource.indexOf('consumeSource'));
    assert.doesNotMatch(storeSource, /waitUntil|bytes: rawBytes|binaryByteLength/);
  });

  it('removes its abort listener after owner success and failure', async () => {
    for (const [fake, failureCode] of [
      [mediaBucket(), null],
      [mediaBucket({ putFailure: new Error('private put') }), 'media_backup_failed'],
    ] as const) {
      const controller = new AbortController();
      const operation = storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: 'record-listener-cleanup',
        source: mediaStream([new Uint8Array([1])]),
        contentLength: 1,
        contentType: 'image/jpeg',
        signal: controller.signal,
      });
      if (failureCode) await assert.rejects(operation, mediaErrorCode(failureCode));
      else await operation;
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    }
  });

  it('stores JPEG, PNG, and WebP bytes exactly with content-addressed keys and immutable options', async () => {
    for (const [contentType, extension, input] of [
      ['image/jpeg', 'jpg', new Uint8Array([0xff, 0xd8, 0xff, 0x01])],
      ['image/png', 'png', new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
      ['image/webp', 'webp', new Uint8Array([0x52, 0x49, 0x46, 0x46])],
    ] as const) {
      const fake = mediaBucket();
      const offsetBacking = new Uint8Array([99, ...input, 88]);
      const offsetView = new DataView(offsetBacking.buffer, 1, input.byteLength);
      const sha256 = createHash('sha256').update(input).digest('hex');
      const result = await storeArtworkLedgerMedia(fake.bucket, {
        artworkRecordId: 'record_private-01', bytes: offsetView, contentType,
      });

      assert.deepEqual(result, {
        reference: `artwork-ledger/record_private-01/${sha256}.${extension}`,
        sha256, contentType, byteLength: input.byteLength,
      });
      assert.equal(fake.puts.length, 1);
      assert.equal(fake.puts[0].key, result.reference);
      assert.deepEqual(fake.puts[0].bytes, input);
      assert.deepEqual(fake.puts[0].options, {
        onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType },
      });
    }
  });

  it('validates exact media type, canonical declared length, chunks, and private record id', async () => {
    const fake = mediaBucket();
    const valid = { artworkRecordId: 'record-1', bytes: new Uint8Array([1]), contentType: 'image/jpeg' };
    for (const contentType of ['image/gif', 'Image/JPEG', 'image/jpeg ', '', null]) {
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, { ...valid, contentType } as any),
        mediaErrorCode('unsupported_media_type'));
    }
    await assert.rejects(storeArtworkLedgerMedia(fake.bucket, { ...valid, bytes: new Uint8Array() }),
      mediaErrorCode('invalid_media_size'));
    await assert.rejects(storeArtworkLedgerMedia(fake.bucket, {
      ...valid, bytes: new Uint8Array((15 * 1024 * 1024) + 1),
    }), mediaErrorCode('invalid_media_size'));
    for (const contentLength of [undefined, null, NaN, 1.5, -1, 0, (15 * 1024 * 1024) + 1]) {
      await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: valid.artworkRecordId,
        source: mediaStream([valid.bytes]),
        contentLength,
        contentType: valid.contentType,
        signal: new AbortController().signal,
      } as any), mediaErrorCode('invalid_media_size'));
    }
    await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
      artworkRecordId: valid.artworkRecordId,
      source: mediaStream(['private nonbinary chunk']),
      contentLength: 1,
      contentType: valid.contentType,
      signal: new AbortController().signal,
    }), mediaErrorCode('invalid_media_bytes'));
    for (const artworkRecordId of [
      '', ' record-1', 'record 1', 'record/1', '.', '..', 'record..1',
      'record?one', 'record#one', 'record%2Fone', 'record@example', 'x'.repeat(129), null,
    ]) {
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, { ...valid, artworkRecordId } as any),
        mediaErrorCode('invalid_artwork_record_id'));
    }
    assert.equal(fake.puts.length, 0);
  });

  it('accepts an exactly 15 MiB source without changing its bytes', async () => {
    const bytes = new Uint8Array(15 * 1024 * 1024);
    bytes[0] = 17;
    bytes[bytes.length - 1] = 29;
    const fake = mediaBucket({ streamChunkSize: 64 * 1024 });
    const result = await storeArtworkLedgerMedia(fake.bucket, {
      artworkRecordId: 'record-max', bytes: bytes.buffer, contentType: 'image/png',
    });
    assert.equal(result.byteLength, 15 * 1024 * 1024);
    assert.deepEqual(fake.puts[0].bytes, bytes);
    assert.equal(fake.streamMetrics.arrayBufferCalls, 0);
    assert.ok(fake.streamMetrics.maxChunkBytes <= 64 * 1024);
    assert.ok(fake.streamMetrics.maxActiveChunkBytes <= 64 * 1024);
    assert.equal(fake.streamMetrics.activeChunkBytes, 0);
  });

  it('rejects a body-null object without invoking its hostile arrayBuffer method', async () => {
    const input = {
      artworkRecordId: 'record-compatibility',
      bytes: new Uint8Array([7, 8, 9]),
      contentType: 'image/jpeg',
    };
    let hostileArrayBufferCalls = 0;
    const bodyNullBucket = {
      async put(key: string) { return { key }; },
      async get(key: string) {
        return {
          key,
          size: input.bytes.byteLength,
          httpMetadata: { contentType: input.contentType },
          body: null,
          async arrayBuffer() {
            hostileArrayBufferCalls += 1;
            return input.bytes.slice().buffer;
          },
        };
      },
    };
    await assert.rejects(storeArtworkLedgerMedia(bodyNullBucket, input),
      mediaErrorCode('media_backup_failed'));
    assert.equal(hostileArrayBufferCalls, 0);
  });

  it('owns weird offset and subclass chunks before R2 work without polymorphic sharing', async () => {
    class SharingBytes extends Uint8Array {
      slice() { return this; }
    }
    for (const input of [
      Buffer.from([91, 10, 20, 30, 92]).subarray(1, 4),
      new SharingBytes([10, 20, 30]),
      new DataView(new Uint8Array([91, 10, 20, 30, 92]).buffer, 1, 3),
    ]) {
      const expected = new Uint8Array([10, 20, 30]);
      const expectedSha256 = createHash('sha256').update(expected).digest('hex');
      const fake = mediaBucket({
        async beforePut() {
          if (ArrayBuffer.isView(input)) {
            const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
            view.fill(255);
          }
        },
      });
      const result = await storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: 'record-snapshot',
        source: mediaStream([input]),
        contentLength: 3,
        contentType: 'image/png',
        signal: new AbortController().signal,
      });
      assert.equal(result.sha256, expectedSha256);
      assert.deepEqual(fake.puts[0].bytes, expected);
      assert.deepEqual(fake.objects.get(result.reference)?.bytes, expected);
    }
  });

  it('replays an exact content-addressed object without overwriting or multiplying objects', async () => {
    const fake = mediaBucket();
    const input = { artworkRecordId: 'record-replay', bytes: new Uint8Array([3, 1, 4]), contentType: 'image/webp' };
    const first = await storeArtworkLedgerMedia(fake.bucket, input);
    const second = await storeArtworkLedgerMedia(fake.bucket, input);
    assert.deepEqual(second, first);
    assert.equal(fake.objects.size, 1);
    assert.equal(fake.puts.length, 2);
    assert.deepEqual(fake.objects.get(first.reference)?.bytes, input.bytes);
  });

  it('rejects positively observed replay key, size, metadata, byte, and EOF conflicts', async () => {
    for (const conflict of ['bytes', 'content-type', 'key', 'size', 'eof'] as const) {
      const fake = mediaBucket();
      const input = { artworkRecordId: `record-${conflict}`, bytes: new Uint8Array([8, 6, 7]), contentType: 'image/png' };
      const first = await storeArtworkLedgerMedia(fake.bucket, input);
      const stored = fake.objects.get(first.reference)!;
      if (conflict === 'bytes') stored.bytes = new Uint8Array([5, 3, 0]);
      else if (conflict === 'content-type') stored.contentType = 'image/jpeg';
      else if (conflict === 'key') stored.reportedKey = `${first.reference}-wrong`;
      else if (conflict === 'size') stored.reportedSize = input.bytes.byteLength + 1;
      else {
        stored.reportedSize = input.bytes.byteLength;
        stored.streamBytes = new Uint8Array([8, 6]);
      }
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, input),
        mediaErrorCode('media_backup_conflict'));
      assert.equal(fake.objects.size, 1);
      assert.deepEqual(fake.objects.get(first.reference), stored);
    }
  });

  it('requires exact content metadata on new writes and existing-object replays', async () => {
    for (const storedContentType of [undefined, 'image/jpeg']) {
      const newWrite = mediaBucket({
        mutateStored(stored) { stored.contentType = storedContentType; },
      });
      await assert.rejects(storeArtworkLedgerMedia(newWrite.bucket, {
        artworkRecordId: 'record-new-metadata',
        bytes: new Uint8Array([4, 2]),
        contentType: 'image/png',
      }), mediaErrorCode('media_backup_failed'));

      const replay = mediaBucket();
      const input = {
        artworkRecordId: 'record-replay-metadata',
        bytes: new Uint8Array([4, 2]),
        contentType: 'image/png',
      };
      const first = await storeArtworkLedgerMedia(replay.bucket, input);
      replay.objects.get(first.reference)!.contentType = storedContentType;
      await assert.rejects(storeArtworkLedgerMedia(replay.bucket, input),
        mediaErrorCode('media_backup_conflict'));
    }
  });

  it('converges with independent R2 writers after conditional null or precondition errors', async () => {
    const bytes = new Uint8Array([2, 7, 1, 8]);
    const input = { artworkRecordId: 'record-conditional', bytes, contentType: 'image/jpeg' };
    const nullFake = mediaBucket();
    const first = await storeArtworkLedgerMedia(nullFake.bucket, input);
    assert.deepEqual(await storeArtworkLedgerMedia(nullFake.bucket, input), first);

    for (const conditionError of [
      Object.assign(new Error('condition rejected'), { status: 412 }),
      Object.assign(new Error('condition rejected'), { code: 'PreconditionFailed' }),
    ]) {
      const objects = new Map(nullFake.objects);
      const leaseFake = mediaBucket();
      let gets = 0;
      const bucket = {
        async put(key: string, value: any, options: any) {
          if (key === 'artwork-ledger/_private/upload-admission') {
            return leaseFake.bucket.put(key, value, options);
          }
          throw conditionError;
        },
        head: leaseFake.bucket.head,
        async get(key: string) {
          gets += 1;
          const stored = objects.get(key);
          return stored && {
            key,
            size: stored.bytes.byteLength,
            httpMetadata: { contentType: stored.contentType },
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(stored.bytes.slice());
                controller.close();
              },
            }),
          };
        },
      };
      assert.deepEqual(await storeArtworkLedgerMedia(bucket, input), first);
      assert.equal(gets, 1);
    }
  });

  it('keeps replay retrieval, readability, and cleanup faults retryable as backup failures', async () => {
    const privateText = 'private-replay-read-failure';
    const scenarios: Array<[
      string,
      (options: any, stored: FakeMediaObject) => void,
    ]> = [
      ['get', (options) => { options.getFailure = new Error(privateText); }],
      ['missing', (options) => { options.missingReadBack = true; }],
      ['body', (options) => { options.omitBody = true; }],
      ['unreadable', (_options, stored) => { stored.streamChunkValue = privateText; }],
      ['cancel', (_options, stored) => {
        stored.streamFailureAtRead = 1;
        stored.streamFailure = new Error(privateText);
        stored.cancelFailure = new Error(privateText);
      }],
      ['release', (_options, stored) => { stored.releaseLockFailure = new Error(privateText); }],
    ];

    for (const [name, configure] of scenarios) {
      const options: any = { streamChunkSize: 2 };
      const fake = mediaBucket(options);
      const input = {
        artworkRecordId: `record-replay-retryable-${name}`,
        bytes: new Uint8Array([1, 2, 3, 4]),
        contentType: 'image/png',
      };
      const first = await storeArtworkLedgerMedia(fake.bucket, input);
      configure(options, fake.objects.get(first.reference)!);
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, input), (error: Error & {
        code?: string;
      }) => {
        assertSanitizedMediaError(error, 'media_backup_failed', [privateText]);
        return true;
      });
    }

    const afterFailure = await storeArtworkLedgerMedia(mediaBucket().bucket, {
      artworkRecordId: 'record-after-replay-failure',
      bytes: new Uint8Array([5]),
      contentType: 'image/png',
    });
    assert.match(afterFailure.reference, /^artwork-ledger\/record-after-replay-failure\//);
  });

  it('does not mask arbitrary R2 put outages as replays', async () => {
    const fake = mediaBucket({ putFailure: new Error('private upstream outage') });
    await assert.rejects(storeArtworkLedgerMedia(fake.bucket, {
      artworkRecordId: 'record-outage', bytes: new Uint8Array([1]), contentType: 'image/jpeg',
    }), mediaErrorCode('media_backup_failed'));
    assert.equal(fake.gets, 0);
  });

  it('fails safely on get, missing read-back, unreadable bodies, and changed read-back bytes', async () => {
    const scenarios = [
      mediaBucket({ getFailure: new Error('private get outage') }),
      mediaBucket({ missingReadBack: true }),
      mediaBucket({
        omitBody: true,
        mutateStored(stored) { stored.arrayBufferFailure = new Error('private read failure'); },
      }),
      mediaBucket({ mutateStored(stored) { stored.bytes = new Uint8Array(); } }),
      mediaBucket({ mutateStored(stored) { stored.bytes = new Uint8Array([9, 9, 9]); } }),
      mediaBucket({ mutateStored(stored) { stored.contentType = 'image/webp'; } }),
    ];
    for (const fake of scenarios) {
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, {
        artworkRecordId: 'record-readback', bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png',
      }), mediaErrorCode('media_backup_failed'));
    }
  });

  it('leaves one safe immutable orphan when later D1 work fails and reuses it on retry', async () => {
    const fake = mediaBucket();
    const input = { artworkRecordId: 'record-orphan', bytes: new Uint8Array([6, 2, 6]), contentType: 'image/jpeg' };
    const stored = await storeArtworkLedgerMedia(fake.bucket, input);
    await assert.rejects(async () => {
      await Promise.resolve(stored);
      throw new Error('simulated D1 insert failure');
    }, /simulated D1 insert failure/);
    assert.equal(fake.objects.size, 1);
    assert.deepEqual(await storeArtworkLedgerMedia(fake.bucket, input), stored);
    assert.equal(fake.objects.size, 1);
  });

  it('returns distributed busy to overlap, then exact retry converges and releases immediately', async () => {
    let releaseFirstPut: (() => void) | undefined;
    let firstPutEnteredResolve: (() => void) | undefined;
    const firstPutEntered = new Promise<void>((resolve) => { firstPutEnteredResolve = resolve; });
    const firstPutGate = new Promise<void>((resolve) => { releaseFirstPut = resolve; });
    const fake = mediaBucket({
      async beforePut(putNumber) {
        if (putNumber === 1) { firstPutEnteredResolve?.(); await firstPutGate; }
      },
    });
    const input = {
      artworkRecordId: 'record-race',
      bytes: new Uint8Array([1, 1, 2, 3]),
      contentType: 'image/webp',
    };
    const firstPending = storeArtworkLedgerMedia(fake.bucket, input);
    await firstPutEntered;
    let busyReads = 0;
    const busySource = new ReadableStream({
      pull(controller) {
        busyReads += 1;
        controller.enqueue(input.bytes);
        controller.close();
      },
    }, { highWaterMark: 0 });
    await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
      artworkRecordId: input.artworkRecordId,
      source: busySource,
      contentLength: input.bytes.byteLength,
      contentType: input.contentType,
      signal: new AbortController().signal,
    }), mediaErrorCode('media_upload_busy'));
    assert.equal(busyReads, 0);
    releaseFirstPut?.();
    const first = await firstPending;
    assert.equal(fake.admission?.customMetadata.state, 'released');
    const retry = await storeArtworkLedgerMedia(fake.bucket, input);
    assert.deepEqual(retry, first);
    const different = await storeArtworkLedgerMedia(fake.bucket, {
      ...input, bytes: new Uint8Array([9, 9]),
    });
    assert.notEqual(different.reference, first.reference);
    assert.equal(fake.objects.size, 2);
  });

  it('cancels source, put, get, and read-back waits without blocking independent requests', async () => {
    for (const boundary of ['source', 'put', 'get', 'readback'] as const) {
      let releaseBoundary: (() => void) | undefined;
      let boundaryEnteredResolve: (() => void) | undefined;
      const boundaryEntered = new Promise<void>((resolve) => { boundaryEnteredResolve = resolve; });
      const boundaryGate = new Promise<void>((resolve) => { releaseBoundary = resolve; });
      const options: Parameters<typeof mediaBucket>[0] = {};
      if (boundary === 'put') {
        options.beforePut = async () => { boundaryEnteredResolve?.(); await boundaryGate; };
      } else if (boundary === 'get') {
        options.beforeGet = async () => { boundaryEnteredResolve?.(); await boundaryGate; };
      } else if (boundary === 'readback') {
        options.beforeReadBackRead = async () => {
          boundaryEnteredResolve?.();
          await boundaryGate;
        };
      }
      const fake = mediaBucket(options);
      let sourceCancelCalls = 0;
      const source = boundary === 'source'
        ? new ReadableStream({
          async pull() { boundaryEnteredResolve?.(); await boundaryGate; },
          cancel() { sourceCancelCalls += 1; },
        })
        : mediaStream([new Uint8Array([4, 5, 6])]);
      const controller = new AbortController();
      const pending = storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: `record-cancel-${boundary}`,
        source,
        contentLength: 3,
        contentType: 'image/png',
        signal: controller.signal,
      });
      await boundaryEntered;
      controller.abort(`private ${boundary} cancellation`);
      await assert.rejects(pending, (error: Error & { code?: string }) => {
        assertSanitizedMediaError(error, 'media_upload_cancelled', [
          `private ${boundary} cancellation`, `record-cancel-${boundary}`,
        ]);
        return true;
      });
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
      const independent = await storeArtworkLedgerMedia(mediaBucket().bucket, {
        artworkRecordId: `record-independent-${boundary}`,
        bytes: new Uint8Array([7]),
        contentType: 'image/png',
      });
      assert.match(independent.reference,
        new RegExp(`^artwork-ledger/record-independent-${boundary}/`));
      releaseBoundary?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (boundary === 'source') {
        assert.equal(sourceCancelCalls, 1);
        assert.equal(fake.puts.length, 0);
      }
    }
  });

  it('bounds retention and rejects declared underrun, overrun, excess, and source faults', async () => {
    const cases = [
      ['underrun', mediaStream([new Uint8Array([1, 2, 3])]), 4, 'invalid_media_size'],
      ['invalid-chunk', mediaStream(['private invalid chunk']), 1, 'invalid_media_bytes'],
      ['stream-throw', new ReadableStream({
        start(controller) { controller.error(new Error('private source stream failure')); },
      }), 1, 'invalid_media_bytes'],
    ] as const;
    for (const [name, source, contentLength, code] of cases) {
      const fake = mediaBucket();
      await assert.rejects(storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: `record-source-${name}`,
        source,
        contentLength,
        contentType: 'image/png',
        signal: new AbortController().signal,
      }), (error: Error & { code?: string }) => {
        assertSanitizedMediaError(error, code, [
          'private invalid chunk', 'private source stream failure',
        ]);
        return true;
      });
      assert.equal(fake.puts.length, 0);
    }

    let overrunCancelCalls = 0;
    let pull = 0;
    const overrunSource = new ReadableStream({
      pull(controller) {
        pull += 1;
        controller.enqueue(new Uint8Array(pull === 1 ? [1, 2] : [3, 4]));
      },
      cancel() { overrunCancelCalls += 1; },
    });
    await assert.rejects(storeArtworkLedgerMediaRaw(mediaBucket().bucket, {
      artworkRecordId: 'record-source-overrun',
      source: overrunSource,
      contentLength: 3,
      contentType: 'image/png',
      signal: new AbortController().signal,
    }), mediaErrorCode('invalid_media_size'));
    assert.equal(overrunCancelCalls, 1);

    const maximum = 15 * 1024 * 1024;
    let remaining = maximum + 1;
    let maximumChunk = 0;
    const tooLargeSource = new ReadableStream({
      pull(controller) {
        const length = Math.min(64 * 1024, remaining);
        remaining -= length;
        maximumChunk = Math.max(maximumChunk, length);
        controller.enqueue(new Uint8Array(length));
        if (remaining === 0) controller.close();
      },
    });
    const tooLargeBucket = mediaBucket({ recordPutBytes: false });
    await assert.rejects(storeArtworkLedgerMediaRaw(tooLargeBucket.bucket, {
      artworkRecordId: 'record-source-too-large',
      source: tooLargeSource,
      contentLength: maximum,
      contentType: 'image/png',
      signal: new AbortController().signal,
    }), mediaErrorCode('invalid_media_size'));
    assert.equal(tooLargeBucket.puts.length, 0);
    assert.ok(maximumChunk <= 64 * 1024);

    const privateCleanup = 'private source cancel cleanup';
    let cleanupPull = 0;
    const cleanupFailure = new ReadableStream({
      pull(controller) {
        cleanupPull += 1;
        controller.enqueue(new Uint8Array(cleanupPull === 1 ? [1, 2] : [3, 4]));
      },
      cancel() { throw new Error(privateCleanup); },
    });
    await assert.rejects(storeArtworkLedgerMediaRaw(mediaBucket().bucket, {
      artworkRecordId: 'record-source-cleanup-failure',
      source: cleanupFailure,
      contentLength: 3,
      contentType: 'image/png',
      signal: new AbortController().signal,
    }), (error: Error & { code?: string }) => {
      assertSanitizedMediaError(error, 'invalid_media_bytes', [privateCleanup]);
      return true;
    });
  });

  it('admits one of twelve concurrent maximum streams and leaves busy sources unread', async () => {
    const contentLength = 15 * 1024 * 1024;
    const chunkSize = 64 * 1024;
    let releasePut: (() => void) | undefined;
    let putEnteredResolve: (() => void) | undefined;
    const putEntered = new Promise<void>((resolve) => { putEnteredResolve = resolve; });
    const putGate = new Promise<void>((resolve) => { releasePut = resolve; });
    const fake = mediaBucket({
      recordPutBytes: false,
      async beforePut() { putEnteredResolve?.(); await putGate; },
    });
    const reads = Array.from({ length: 12 }, () => 0);
    const sourceFor = (index: number) => {
      let remaining = contentLength;
      return new ReadableStream({
        pull(controller) {
          reads[index] += 1;
          if (remaining === 0) { controller.close(); return; }
          const length = Math.min(chunkSize, remaining);
          remaining -= length;
          const chunk = new Uint8Array(length);
          chunk.fill(index + 1);
          controller.enqueue(chunk);
        },
      }, { highWaterMark: 0 });
    };
    const first = storeArtworkLedgerMediaRaw(fake.bucket, {
      artworkRecordId: 'record-max-owner',
      source: sourceFor(0),
      contentLength,
      contentType: 'image/png',
      signal: new AbortController().signal,
    });
    await putEntered;
    const contenders = await Promise.allSettled(Array.from({ length: 11 }, (_, offset) => {
      const index = offset + 1;
      return storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: `record-max-busy-${index}`,
        source: sourceFor(index),
        contentLength,
        contentType: 'image/png',
        signal: new AbortController().signal,
      });
    }));
    assert.ok(contenders.every((entry) => entry.status === 'rejected'
      && (entry.reason as { code?: string }).code === 'media_upload_busy'));
    assert.ok(reads[0] > 0);
    assert.ok(reads.slice(1).every((count) => count === 0));
    assert.equal(fake.puts.length, 1);
    releasePut?.();
    await first;
  });

  it('takes over an expired crash lease once and prevents a stale owner release', async () => {
    let releaseOld: (() => void) | undefined;
    let oldEnteredResolve: (() => void) | undefined;
    const oldEntered = new Promise<void>((resolve) => { oldEnteredResolve = resolve; });
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    const fake = mediaBucket({
      async beforePut(putNumber) {
        if (putNumber === 1) { oldEnteredResolve?.(); await oldGate; }
      },
    });
    const old = storeArtworkLedgerMedia(fake.bucket, {
      artworkRecordId: 'record-crashed-owner', bytes: new Uint8Array([1]), contentType: 'image/png',
    });
    const oldOutcome = old.then(() => null, (error) => error);
    await oldEntered;
    const crashedLease = fake.admission!;
    crashedLease.customMetadata.expiresAt = String(Date.now() - 1);

    const successor = await storeArtworkLedgerMedia(fake.bucket, {
      artworkRecordId: 'record-expired-successor', bytes: new Uint8Array([2]), contentType: 'image/png',
    });
    assert.match(successor.reference, /^artwork-ledger\/record-expired-successor\//);
    const successorToken = fake.admission!.customMetadata.ownerToken;
    assert.equal(fake.admission!.customMetadata.state, 'released');
    releaseOld?.();
    const staleFailure = await oldOutcome;
    assert.equal(staleFailure?.code, 'media_backup_failed');
    assert.equal(fake.admission!.customMetadata.ownerToken, successorToken);
  });

  it('fails closed on malformed/head/release lease faults without leaking private facts', async () => {
    const privateId = 'record-private-lock-fact';
    const malformed = mediaBucket();
    malformed.setAdmission({
      key: 'artwork-ledger/_private/upload-admission', etag: 'bad-etag',
      customMetadata: {
        state: 'active', ownerToken: privateId, expiresAt: 'not-a-time',
        versionNonce: '323e4567-e89b-42d3-a456-426614174000',
      },
      body: new Uint8Array(),
    });
    let malformedReads = 0;
    await assert.rejects(storeArtworkLedgerMediaRaw(malformed.bucket, {
      artworkRecordId: privateId,
      source: new ReadableStream({ pull() { malformedReads += 1; } }, { highWaterMark: 0 }),
      contentLength: 1, contentType: 'image/png', signal: new AbortController().signal,
    }), (error: Error & { code?: string }) => {
      assertSanitizedMediaError(error, 'media_backup_failed', [privateId]);
      return true;
    });
    assert.equal(malformedReads, 0);

    const headOptions: any = {};
    const headFailure = mediaBucket(headOptions);
    await storeArtworkLedgerMedia(headFailure.bucket, {
      artworkRecordId: 'record-prime-lock', bytes: new Uint8Array([1]), contentType: 'image/png',
    });
    headOptions.admissionHeadFailure = new Error(`private head ${privateId}`);
    await assert.rejects(storeArtworkLedgerMedia(headFailure.bucket, {
      artworkRecordId: privateId, bytes: new Uint8Array([2]), contentType: 'image/png',
    }), mediaErrorCode('media_backup_failed'));

    const releaseFailure = mediaBucket({ admissionPutFailureAt: 2 });
    await assert.rejects(storeArtworkLedgerMedia(releaseFailure.bucket, {
      artworkRecordId: privateId, bytes: new Uint8Array([3]), contentType: 'image/png',
    }), mediaErrorCode('media_backup_failed'));
    assert.equal(releaseFailure.objects.size, 1);
    assert.doesNotMatch(JSON.stringify(releaseFailure.admission), new RegExp(privateId));
  });

  it('times out before lease expiry, releases safely, and permits immediate takeover', async () => {
    const originalNow = Date.now;
    let now = 1_800_000_000_000;
    Date.now = () => now;
    let releaseRead: (() => void) | undefined;
    let readEnteredResolve: (() => void) | undefined;
    const readEntered = new Promise<void>((resolve) => { readEnteredResolve = resolve; });
    const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    const fake = mediaBucket();
    try {
      const pending = storeArtworkLedgerMediaRaw(fake.bucket, {
        artworkRecordId: 'record-timeout',
        source: new ReadableStream({
          async pull(controller) {
            readEnteredResolve?.();
            await readGate;
            controller.enqueue(new Uint8Array([1]));
            controller.close();
          },
        }),
        contentLength: 1, contentType: 'image/png', signal: new AbortController().signal,
      });
      await readEntered;
      const leaseExpiry = Number(fake.admission!.customMetadata.expiresAt);
      now += 30_001;
      assert.ok(now < leaseExpiry);
      releaseRead?.();
      await assert.rejects(pending, mediaErrorCode('media_upload_timeout'));
      assert.equal(fake.admission!.customMetadata.state, 'released');
      await storeArtworkLedgerMedia(fake.bucket, {
        artworkRecordId: 'record-after-timeout', bytes: new Uint8Array([2]), contentType: 'image/png',
      });
    } finally {
      releaseRead?.();
      Date.now = originalNow;
    }
  });

  it('allows a second request to finish while another R2 put remains pending', async () => {
    let releasePut: (() => void) | undefined;
    let putEnteredResolve: (() => void) | undefined;
    const putEntered = new Promise<void>((resolve) => { putEnteredResolve = resolve; });
    const putGate = new Promise<void>((resolve) => { releasePut = resolve; });
    const slow = mediaBucket({
      async beforePut() { putEnteredResolve?.(); await putGate; },
    });
    const pending = storeArtworkLedgerMedia(slow.bucket, {
      artworkRecordId: 'record-long-pending',
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
    });
    await putEntered;
    const independent = await storeArtworkLedgerMedia(mediaBucket().bucket, {
      artworkRecordId: 'record-not-busy',
      bytes: new Uint8Array([2]),
      contentType: 'image/png',
    });
    assert.match(independent.reference, /^artwork-ledger\/record-not-busy\//);
    releasePut?.();
    await pending;
  });

  it('rejects truncated, extra, wrong, and throwing streams and cancels unfinished readers', async () => {
    const expected = new Uint8Array([1, 2, 3, 4]);
    for (const [name, streamBytes, shouldCancel] of [
      ['truncated', new Uint8Array([1, 2, 3]), false],
      ['extra', new Uint8Array([1, 2, 3, 4, 5]), true],
      ['wrong', new Uint8Array([1, 9, 3, 4]), false],
    ] as const) {
      const fake = mediaBucket({
        streamChunkSize: 2,
        mutateStored(stored) {
          stored.reportedSize = expected.byteLength;
          stored.streamBytes = streamBytes;
        },
      });
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, {
        artworkRecordId: `record-stream-${name}`,
        bytes: expected,
        contentType: 'image/png',
      }), mediaErrorCode('media_backup_failed'));
      assert.equal(fake.streamMetrics.arrayBufferCalls, 0);
      assert.equal(fake.streamMetrics.cancelCalls, shouldCancel ? 1 : 0);
      assert.equal(fake.streamMetrics.cancelRequests, shouldCancel ? 1 : 0);
      assert.equal(fake.streamMetrics.activeChunkBytes, 0);
    }

    const streamFailure = mediaBucket({
      streamChunkSize: 2,
      mutateStored(stored) {
        stored.streamFailureAtRead = 2;
        stored.streamFailure = Object.assign(new Error('private stream bytes'), {
          code: 'media_backup_conflict', bytes: 'private stream bytes',
        });
      },
    });
    await assert.rejects(storeArtworkLedgerMedia(streamFailure.bucket, {
      artworkRecordId: 'record-stream-throw', bytes: expected, contentType: 'image/png',
    }), (error: Error & { code?: string; bytes?: unknown }) => {
      assertSanitizedMediaError(error, 'media_backup_failed', ['private stream bytes']);
      return true;
    });
    assert.equal(streamFailure.streamMetrics.arrayBufferCalls, 0);
    assert.equal(streamFailure.streamMetrics.cancelRequests, 1);
    assert.equal(streamFailure.streamMetrics.activeChunkBytes, 0);

    const replayFailure = mediaBucket({ streamChunkSize: 2 });
    const replayInput = {
      artworkRecordId: 'record-stream-replay', bytes: expected, contentType: 'image/png',
    };
    const first = await storeArtworkLedgerMedia(replayFailure.bucket, replayInput);
    const replayObject = replayFailure.objects.get(first.reference)!;
    replayObject.streamFailureAtRead = 1;
    replayObject.streamFailure = Object.assign(new Error('private replay stream'), {
      code: 'media_backup_failed', reference: first.reference,
    });
    await assert.rejects(storeArtworkLedgerMedia(replayFailure.bucket, replayInput),
      (error: Error & { code?: string; reference?: unknown }) => {
        assertSanitizedMediaError(error, 'media_backup_failed', [
          'private replay stream', first.reference,
        ]);
        return true;
      });
    assert.equal(replayFailure.streamMetrics.arrayBufferCalls, 0);
    assert.equal(replayFailure.streamMetrics.cancelRequests, 1);
  });

  it('never exposes private ids, bytes, or R2 details in thrown errors', async () => {
    const privateId = 'record-private-secret';
    const privateText = 'collector-private-image';
    const bytes = new TextEncoder().encode(privateText);
    const fake = mediaBucket({ putFailure: new Error(`R2 failed for ${privateId}: ${privateText}`) });
    await assert.rejects(storeArtworkLedgerMedia(fake.bucket, {
      artworkRecordId: privateId, bytes, contentType: 'image/jpeg',
    }), (error: Error & { code?: string }) => {
      assert.equal(error.code, 'media_backup_failed');
      assert.equal(error.message, 'media_backup_failed');
      assert.doesNotMatch(String(error.stack), new RegExp(`${privateId}|${privateText}`));
      return true;
    });
  });

  it('replaces spoofed external R2 errors with fresh constant coded errors', async () => {
    const privateId = 'record-spoof-private';
    const privateText = 'private-byte-payload-8675309';
    const privateReference = `artwork-ledger/${privateId}/private-reference`;
    const spoofed = (code: string) => Object.assign(
      new Error(`${privateText} at ${privateReference}`),
      { code, cause: privateText, reference: privateReference, bytes: privateText },
    );
    const input = {
      artworkRecordId: privateId,
      bytes: new TextEncoder().encode(privateText),
      contentType: 'image/jpeg',
    };
    const scenarios = [
      mediaBucket({ putFailure: spoofed('media_backup_failed') }),
      mediaBucket({
        putFailure: new Proxy(spoofed('media_backup_failed'), {
          get(target, property, receiver) {
            if (typeof property === 'symbol') return true;
            if (property === 'code') return 'media_backup_failed';
            return Reflect.get(target, property, receiver);
          },
          getPrototypeOf() { return Error.prototype; },
        }),
      }),
      mediaBucket({ getFailure: spoofed('media_backup_conflict') }),
      mediaBucket({
        omitBody: true,
        mutateStored(stored) {
          stored.arrayBufferFailure = spoofed('media_backup_conflict');
        },
      }),
    ];
    for (const fake of scenarios) {
      await assert.rejects(storeArtworkLedgerMedia(fake.bucket, input), (error: Error & {
        code?: string; cause?: unknown; reference?: unknown; bytes?: unknown;
      }) => {
        assertSanitizedMediaError(error, 'media_backup_failed', [
          privateId, privateText, privateReference,
        ]);
        return true;
      });
    }
  });
});

function saleInput(overrides: Record<string, unknown> = {}) {
  return {
    occurrence: { precision: 'year', value: '2018' },
    buyerEmail: ' Collector@Example.com ',
    total: { amountMinor: 900000, currency: 'usd' },
    privateReference: ' studio-ledger-2018-4 ',
    privateNotes: null,
    reconnectionCaseId: null,
    artworks: [
      { artworkRecordId: null, artworkId: 'UL-100', edition: { kind: 'numbered', number: 1, size: 64 }, price: { amountMinor: 300000, currency: 'usd' } },
      { artworkRecordId: null, artworkId: 'UL-101', edition: { kind: 'numbered', number: 2, size: 64 }, price: { amountMinor: 250000, currency: 'USD' } },
      { artworkRecordId: null, artworkId: null, edition: null, price: null },
    ],
    idempotencyKey: 'sale-create-2018-4',
    administrator,
    recordedAt: '2026-08-10T01:00:00.000Z',
    ...overrides,
  };
}

describe('artist verified sale records', () => {
  it('applies the full migration chain through 032 with the exact private schema and clean foreign keys', () => {
    const db = database();
    try {
      for (const productionTable of [
        'invoices', 'viewings', 'atlas_piece_content', 'pricing_config',
      ]) {
        assert.ok(db.prepare(`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1
        `).get(productionTable), productionTable);
      }
      const expectedColumns: Record<string, string[]> = {
        artist_reconnection_cases: [
          'id', 'recipient_email', 'recipient_name', 'private_context', 'status',
          'created_by_user_id', 'idempotency_key', 'request_digest', 'created_at', 'updated_at',
        ],
        artist_reconnection_events: [
          'id', 'reconnection_case_id', 'event_type', 'private_note',
          'artwork_record_id', 'actor_user_id', 'idempotency_key',
          'request_digest', 'created_at',
        ],
        artist_artwork_records: [
          'id', 'artwork_id', 'edition_json', 'keeper_piece_id',
          'identification_status', 'record_version', 'last_event_id',
          'created_by_user_id', 'created_at', 'updated_at',
        ],
        artist_artwork_record_events: [
          'id', 'artwork_record_id', 'action', 'before_json', 'after_json',
          'resulting_version', 'actor_user_id', 'idempotency_key',
          'request_digest', 'created_at',
        ],
        artist_verified_sales: [
          'id', 'reconnection_case_id', 'occurrence_precision', 'occurred_on',
          'buyer_email', 'currency', 'total_minor', 'private_reference',
          'private_notes', 'verified_by_user_id', 'idempotency_key',
          'request_digest', 'recorded_at',
        ],
        artist_verified_sale_events: [
          'id', 'sale_id', 'sequence', 'event_type', 'before_json', 'after_json',
          'reason', 'actor_user_id', 'idempotency_key', 'request_digest', 'created_at',
        ],
        artist_verified_sale_items: [
          'id', 'sale_id', 'artwork_record_id', 'amount_minor', 'currency', 'created_at',
        ],
        artist_artwork_media: [
          'id', 'artwork_record_id', 'media_role', 'storage_reference', 'sha256',
          'content_type', 'byte_length', 'uploaded_by_user_id', 'created_at',
        ],
        artist_artwork_ledger_entries: [
          'id', 'artwork_record_id', 'sale_id', 'message', 'media_id',
          'created_by_user_id', 'idempotency_key', 'request_digest', 'created_at',
        ],
        artist_artwork_price_entries: [
          'id', 'artwork_record_id', 'sale_item_id', 'amount_minor', 'currency',
          'occurred_on', 'occurrence_precision', 'recorded_at',
        ],
      };
      for (const [table, expected] of Object.entries(expectedColumns)) {
        assert.deepEqual(columns(db, table), expected, table);
      }

      const expectedForeignKeys: Record<string, Array<Record<string, string>>> = {
        artist_reconnection_cases: [
          { source: 'created_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_reconnection_events: [
          { source: 'actor_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'reconnection_case_id', target: 'artist_reconnection_cases', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_records: [
          { source: 'created_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'keeper_piece_id', target: 'keeper_pieces', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'last_event_id', target: 'artist_artwork_record_events', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_record_events: [
          { source: 'actor_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_verified_sales: [
          { source: 'reconnection_case_id', target: 'artist_reconnection_cases', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'verified_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_verified_sale_events: [
          { source: 'actor_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_id', target: 'artist_verified_sales', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_verified_sale_items: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_id', target: 'artist_verified_sales', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_media: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'uploaded_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_ledger_entries: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'created_by_user_id', target: 'user', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'media_id', target: 'artist_artwork_media', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_id', target: 'artist_verified_sales', destination: 'id', onDelete: 'RESTRICT' },
        ],
        artist_artwork_price_entries: [
          { source: 'artwork_record_id', target: 'artist_artwork_records', destination: 'id', onDelete: 'RESTRICT' },
          { source: 'sale_item_id', target: 'artist_verified_sale_items', destination: 'id', onDelete: 'RESTRICT' },
        ],
      };
      for (const [table, expected] of Object.entries(expectedForeignKeys)) {
        assert.deepEqual(foreignKeys(db, table), expected, table);
      }
      assert.equal(db.prepare(`
        SELECT "notnull" AS required
          FROM pragma_table_info('artist_artwork_price_entries')
         WHERE name = 'sale_item_id'
      `).get()?.required, 1);
      const uniqueArtworkRecordIndexes = db.prepare(`
        SELECT name FROM pragma_index_list('artist_artwork_records')
         WHERE "unique" = 1
      `).all().map((row) => String(row.name));
      assert.equal(uniqueArtworkRecordIndexes.some((indexName) =>
        db.prepare('SELECT name FROM pragma_index_info(?)').all(indexName)
          .some((column) => column.name === 'last_event_id')
      ), false);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('requires a canonical private reason only for corrected sale events', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      const before = saleSnapshot();
      const after = saleSnapshot({ buyerEmail: 'corrected@example.com' });
      for (const reason of [null, '', '   ', ' padded ', 'x'.repeat(1001)]) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_verified_sale_events
            (id, sale_id, sequence, event_type, before_json, after_json, reason,
             actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, 'sale-one', 1, 'corrected', ?2, ?3, ?4,
            'artist-admin', ?5, ?6, ?7)
        `).run(`invalid-reason-${String(reason).length}`, before, after, reason,
          `invalid-reason-key-${String(reason).length}`, digest('e'), now));
      }
      assert.throws(() => db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('shared-with-reason', 'sale-one', 1, 'shared_message_appended',
          ?1, ?2, 'private reason', 'artist-admin', 'shared-with-reason-key', ?3, ?4)
      `).run(before, saleSnapshot({ privateNotes: 'Shared creator note.' }), digest('f'), now));
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('valid-reason', 'sale-one', 1, 'corrected', ?1, ?2,
          'Transcription correction.', 'artist-admin', 'valid-reason-key', ?3, ?4)
      `).run(before, after, digest('a'), now);
      assert.equal(db.prepare(`
        SELECT reason FROM artist_verified_sale_events WHERE id = 'valid-reason'
      `).get()?.reason, 'Transcription correction.');
    } finally {
      db.close();
    }
  });

  it('records a private three-artwork sale, including an unresolved work and optional prices', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
        VALUES
          ('sale-month', 'month', '2026-07', 'artist-admin',
           'sale-month-key', '${digest('9')}', '${now}'),
          ('sale-year', 'year', '2025', 'artist-admin',
           'sale-year-key', '${digest('a')}', '${now}'),
          ('sale-unknown', 'unknown', NULL, 'artist-admin',
           'sale-unknown-key', '${digest('b')}', '${now}');
        INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
        VALUES
          ('item-month', 'sale-month', 'record-identified', 125000, 'USD', '${now}'),
          ('item-year', 'sale-year', 'record-identified', 130000, 'USD', '${now}'),
          ('item-unknown', 'sale-unknown', 'record-linked', 200000, 'USD', '${now}');
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, artwork_record_id,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES
          ('reconnect-note', 'case-one', 'note_added', 'Try the old studio address.', NULL,
           'artist-admin', 'reconnect-note-key', '${digest('3')}', '${now}'),
          ('reconnect-artwork', 'case-one', 'artwork_added', NULL, 'record-unresolved',
           'artist-admin', 'reconnect-artwork-key', '${digest('4')}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES
          ('media-one', 'record-unresolved', 'identification_evidence',
           'artist-sales/record-unresolved/front.webp', '${digest('5')}',
           'image/webp', 2048, 'artist-admin', '${now}');
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, media_id, created_by_user_id,
           idempotency_key, request_digest, created_at)
        VALUES
          ('ledger-message', 'record-unresolved', 'sale-one',
           'Collector remembered a circular walnut frame.', NULL, 'artist-admin',
           'ledger-message-key', '${digest('6')}', '${now}'),
          ('ledger-media', 'record-unresolved', NULL, NULL, 'media-one', 'artist-admin',
           'ledger-media-key', '${digest('7')}', '${now}');
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES
          ('price-exact', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${now}'),
          ('price-month', 'record-identified', 'item-month', 125000, 'USD',
           '2026-07', 'month', '${now}'),
          ('price-year', 'record-identified', 'item-year', 130000, 'USD',
           '2025', 'year', '${now}'),
          ('price-unknown', 'record-linked', 'item-unknown', 200000, 'USD',
           NULL, 'unknown', '${now}');
      `);

      const beforeSale = saleSnapshot();
      const afterSale = saleSnapshot({ privateNotes: 'Introduced by a mutual friend. Follow up in September.' });
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES
          ('sale-event-one', 'sale-one', 1, 'shared_message_appended', ?1, ?2,
           'artist-admin', 'sale-event-one-key', ?3, ?4)
      `).run(beforeSale, afterSale, digest('8'), now);

      assert.deepEqual({ ...db.prepare(`
        SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status
          FROM artist_artwork_records WHERE id = 'record-unresolved'
      `).get() }, {
        id: 'record-unresolved', artwork_id: null, edition_json: null,
        keeper_piece_id: null, identification_status: 'unresolved',
      });
      assert.equal(db.prepare(`
        SELECT COUNT(*) AS count FROM artist_verified_sale_items WHERE sale_id = 'sale-one'
      `).get()?.count, 3);
      assert.equal(count(db, 'artist_artwork_price_entries'), 4);
      assert.equal(count(db, 'artist_artwork_ledger_entries'), 2);
      assert.equal(count(db, 'artist_artwork_media'), 1);
      assert.equal(count(db, 'artist_verified_sale_events'), 1);
      assert.equal(db.prepare(`
        SELECT private_notes FROM artist_verified_sales WHERE id = 'sale-one'
      `).get()?.private_notes, 'Introduced by a mutual friend.');
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('rejects ledger and price references whose redundant facts belong to another artwork', () => {
    const db = database();
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-outside-sale', NULL, NULL, 'unresolved',
          'artist-admin', '${now}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-cross-check', 'record-unresolved', 'identification_evidence',
          'artist-sales/cross-check.webp', '${digest('d')}', 'image/webp', 100,
          'artist-admin', '${now}')
      `);
      const before = {
        ledger: count(db, 'artist_artwork_ledger_entries'),
        price: count(db, 'artist_artwork_price_entries'),
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-cross-check'`).get() },
        item: { ...db.prepare(`SELECT * FROM artist_verified_sale_items WHERE id = 'item-one'`).get() },
      };

      const invalidLedgerSql = [
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, media_id, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('ledger-wrong-media', 'record-identified', 'media-cross-check',
           'artist-admin', 'ledger-wrong-media-key', '${digest('e')}', '${now}')`,
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('ledger-wrong-sale', 'record-outside-sale', 'sale-one', 'Wrong sale.',
           'artist-admin', 'ledger-wrong-sale-key', '${digest('f')}', '${now}')`,
      ];
      for (const sql of invalidLedgerSql) {
        assert.throws(() => db.exec(sql), /artwork|media|sale/i);
      }

      const invalidPriceValues = [
        ['price-wrong-artwork', 'record-identified', 100000, 'USD', '2026-08-01', 'exact'],
        ['price-wrong-amount', 'record-unresolved', 99999, 'USD', '2026-08-01', 'exact'],
        ['price-wrong-currency', 'record-unresolved', 100000, 'EUR', '2026-08-01', 'exact'],
        ['price-wrong-occurrence', 'record-unresolved', 100000, 'USD', '2026-08-02', 'exact'],
      ] as const;
      for (const values of invalidPriceValues) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_price_entries
            (id, artwork_record_id, sale_item_id, amount_minor, currency,
             occurred_on, occurrence_precision, recorded_at)
          VALUES (?1, ?2, 'item-one', ?3, ?4, ?5, ?6, ?7)
        `).run(...values, now), /artwork|price|sale|fact/i, values[0]);
      }
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES ('price-item-without-price', 'record-identified', 'item-two', 1, 'USD',
          '2026-08-01', 'exact', '${now}')
      `), /price|sale|fact/i);

      assert.deepEqual({
        ledger: count(db, 'artist_artwork_ledger_entries'),
        price: count(db, 'artist_artwork_price_entries'),
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-cross-check'`).get() },
        item: { ...db.prepare(`SELECT * FROM artist_verified_sale_items WHERE id = 'item-one'`).get() },
      }, before);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('normalizes private contact facts and rejects malformed states, JSON, digests, and money pairs', () => {
    const db = database();
    try {
      assert.throws(() => db.exec(`
        INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
        VALUES ('bad-email', ' Collector@Example.com ', 'open', 'artist-admin',
          'bad-email-key', '${digest('1')}', '${now}', '${now}')
      `), /constraint/i);
      assert.throws(() => db.exec(`
        INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
        VALUES ('bad-digest', 'collector@example.com', 'open', 'artist-admin',
          'bad-digest-key', '${'G'.repeat(64)}', '${now}', '${now}')
      `), /constraint/i);

      for (const values of [
        `'bad-unresolved', 'UL-100', NULL, NULL, 'unresolved'`,
        `'bad-identified', 'UL-100', NULL, NULL, 'identified'`,
        `'bad-linked', 'UL-100', '${numberedEdition(1, 64)}', NULL, 'identity_linked'`,
        `'bad-json', 'UL-100', '{not-json}', NULL, 'identified'`,
        `'bad-json-null', 'UL-100', 'null', NULL, 'identified'`,
      ]) {
        assert.throws(() => db.exec(`
          INSERT INTO artist_artwork_records
            (id, artwork_id, edition_json, keeper_piece_id, identification_status,
             created_by_user_id, created_at, updated_at)
          VALUES (${values}, 'artist-admin', '${now}', '${now}')
        `), /constraint|identity/i);
      }

      assert.throws(() => db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, total_minor,
           verified_by_user_id, idempotency_key, request_digest, recorded_at)
        VALUES ('bad-total', 'unknown', NULL, 100, 'artist-admin',
          'bad-total-key', '${digest('2')}', '${now}')
      `), /constraint/i);

      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
        VALUES ('sale-for-item', 'unknown', NULL, 'artist-admin',
          'sale-for-item-key', '${digest('3')}', '${now}')
      `);
      assert.throws(() => db.exec(`
        INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, amount_minor, created_at)
        VALUES ('bad-item-money', 'sale-for-item', 'record-unresolved', 100, '${now}')
      `), /constraint/i);
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, created_by_user_id, idempotency_key,
           request_digest, created_at)
        VALUES ('empty-ledger', 'record-unresolved', 'artist-admin',
          'empty-ledger-key', '${digest('4')}', '${now}')
      `), /constraint/i);
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('bad-media', 'record-unresolved', 'certificate_image', 'media/ref',
          '${'F'.repeat(64)}', 'image/gif', 0, 'artist-admin', '${now}')
      `), /constraint/i);
    } finally {
      db.close();
    }
  });

  it('binds canonical unique and numbered edition identities to the exact keeper piece', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-linked-unique', 'SIG-200', '${uniqueEdition}', 'kp-sale-unique',
          'identity_linked', 'artist-admin', '${now}', '${now}')
      `);
      assert.equal(count(db, 'artist_artwork_records'), 4);

      for (const [id, artworkId, editionJson, keeperPieceId] of [
        ['noncanonical-edition', 'SIG-201', '{"editionNumber":0}', null],
        ['mismatched-artwork', 'UL-999', numberedEdition(2, 64), 'kp-sale-two'],
        ['mismatched-numbered-edition', 'UL-101', numberedEdition(1, 64), 'kp-sale-two'],
        ['mismatched-unique-edition', 'SIG-200', numberedEdition(1, 1), 'kp-sale-unique'],
      ] as const) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_records
            (id, artwork_id, edition_json, keeper_piece_id, identification_status,
             created_by_user_id, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, 'artist-admin', ?6, ?6)
        `).run(
          id, artworkId, editionJson, keeperPieceId,
          keeperPieceId === null ? 'identified' : 'identity_linked', now,
        ), /constraint|identity|edition|keeper/i, id);
      }
      assert.equal(count(db, 'artist_artwork_records'), 4);

      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES
          ('record-link-wrong-artwork', 'UL-999', '${numberedEdition(2, 64)}', 'identified',
           'artist-admin', '${now}', '${now}'),
          ('record-link-wrong-edition', 'UL-101', '${numberedEdition(1, 64)}', 'identified',
           'artist-admin', '${now}', '${now}')
      `);
      for (const [id, artworkRecordId, artworkId, editionJson] of [
        ['event-link-wrong-artwork', 'record-link-wrong-artwork', 'UL-999', numberedEdition(2, 64)],
        ['event-link-wrong-edition', 'record-link-wrong-edition', 'UL-101', numberedEdition(1, 64)],
      ] as const) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_record_events
            (id, artwork_record_id, action, before_json, after_json,
             resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, ?2, 'identity_linked', ?3, ?4, 2,
            'artist-admin', ?5, ?6, ?7)
        `).run(
          id,
          artworkRecordId,
          recordSnapshot({
            artworkId, editionJson, keeperPieceId: null,
            identificationStatus: 'identified', recordVersion: 1,
          }),
          recordSnapshot({
            artworkId, editionJson, keeperPieceId: 'kp-sale-two',
            identificationStatus: 'identity_linked', recordVersion: 2,
          }),
          `${id}-key`, digest('0'), now,
        ), /snapshot|identity|edition|keeper/i, id);
      }
      assert.equal(count(db, 'artist_artwork_record_events'), 0);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('rejects noncanonical exact, month, year, and unknown occurrence dates', () => {
    const db = database();
    try {
      const invalid = [
        ['exact', '2026-02-30'], ['exact', '2026-8-01'],
        ['exact', '2026-08-32'],
        ['month', '2026-13'], ['month', '2026-8'],
        ['year', '26'], ['year', '2026-01'],
        ['unknown', '2026-08-01'],
      ];
      for (const [index, [precision, occurredOn]] of invalid.entries()) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_verified_sales
            (id, occurrence_precision, occurred_on, verified_by_user_id,
             idempotency_key, request_digest, recorded_at)
          VALUES (?1, ?2, ?3, 'artist-admin', ?4, ?5, ?6)
        `).run(
          `invalid-date-${index}`, precision, occurredOn,
          `invalid-date-key-${index}`, digest('5'), now,
        ), /constraint/i, `${precision}:${occurredOn}`);
      }
      assert.equal(count(db, 'artist_verified_sales'), 0);
      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
        VALUES ('sale-invalid-price', 'unknown', NULL, 'artist-admin',
          'sale-invalid-price-key', '${digest('6')}', '${now}');
        INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
        VALUES ('item-invalid-price', 'sale-invalid-price', 'record-unresolved',
          100, 'USD', '${now}');
      `);
      for (const [index, [precision, occurredOn]] of invalid.entries()) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_artwork_price_entries
            (id, artwork_record_id, sale_item_id, amount_minor, currency, occurred_on,
             occurrence_precision, recorded_at)
          VALUES (?1, 'record-unresolved', 'item-invalid-price', 100, 'USD', ?2, ?3, ?4)
        `).run(`invalid-price-date-${index}`, occurredOn, precision, now), /constraint|sale facts/i);
      }
      assert.equal(count(db, 'artist_artwork_price_entries'), 0);
    } finally {
      db.close();
    }
  });

  it('requires canonical UTC millisecond timestamps on every permanent private record', () => {
    const db = database();
    try {
      const invalidTimestamps = [
        '2026-02-30T12:00:00.000Z',
        '2026-08-32T12:00:00.000Z',
        '2026-13-10T12:00:00.000Z',
        '2026-08-10T24:00:00.000Z',
        ' 2026-08-10T12:00:00.000Z',
        '2026-08-10T12:00:00.000Z ',
        '2026-08-10T12:00:00Z',
        '2026-08-10T12:00:00.000+00:00',
        '2025-02-29T12:00:00.000Z',
      ];
      for (const [index, timestamp] of invalidTimestamps.entries()) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_reconnection_cases
            (id, recipient_email, status, created_by_user_id, idempotency_key,
             request_digest, created_at, updated_at)
          VALUES (?1, 'timestamp@example.com', 'open', 'artist-admin', ?2, ?3, ?4, ?5)
        `).run(`bad-timestamp-${index}`, `bad-timestamp-key-${index}`,
          digest('1'), timestamp, now), /constraint/i, timestamp);
      }
      assert.equal(count(db, 'artist_reconnection_cases'), 0);

      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
        VALUES ('record-timestamp', 'unresolved', 'artist-admin', '${now}', '${now}')
      `);
      const outOfRangeTimestamp = '2026-13-10T12:00:00.000Z';
      const invalidSql = [
        `INSERT INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
         VALUES ('bad-updated-at', 'updated@example.com', 'open', 'artist-admin',
           'bad-updated-at-key', '${digest('2')}', '${now}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
         VALUES ('bad-record-created-at', 'unresolved', 'artist-admin',
           '${outOfRangeTimestamp}', '${now}')`,
        `INSERT INTO artist_artwork_records
          (id, identification_status, created_by_user_id, created_at, updated_at)
         VALUES ('bad-record-updated-at', 'unresolved', 'artist-admin',
           '${now}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_verified_sales
          (id, occurrence_precision, verified_by_user_id, idempotency_key,
           request_digest, recorded_at)
         VALUES ('bad-sale-recorded-at', 'unknown', 'artist-admin',
           'bad-sale-recorded-at-key', '${digest('3')}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_verified_sale_items
          (id, sale_id, artwork_record_id, created_at)
         VALUES ('bad-item-created-at', 'sale-one', 'record-timestamp', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
         VALUES ('bad-media-created-at', 'record-unresolved', 'certificate_image',
           'artist-sales/bad-timestamp.jpg', '${digest('4')}', 'image/jpeg', 10,
           'artist-admin', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('bad-ledger-created-at', 'record-unresolved', 'Timestamp check.',
           'artist-admin', 'bad-ledger-created-at-key', '${digest('5')}', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
         VALUES ('bad-price-recorded-at', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${outOfRangeTimestamp}')`,
        `INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('bad-reconnect-created-at', 'case-one', 'note_added', 'Timestamp check.',
           'artist-admin', 'bad-reconnect-created-at-key', '${digest('6')}', '${outOfRangeTimestamp}')`,
      ];
      for (const sql of invalidSql) {
        assert.throws(() => db.exec(sql), /constraint/i);
      }

      const beforeRecord = recordSnapshot({
        artworkId: null, editionJson: null, keeperPieceId: null,
        identificationStatus: 'unresolved', recordVersion: 1,
      });
      const afterRecord = recordSnapshot({
        artworkId: 'SIG-201', editionJson: uniqueEdition, keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      assert.throws(() => db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json, resulting_version,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-record-event-created-at', 'record-unresolved', 'identified', ?1, ?2, 2,
          'artist-admin', 'bad-record-event-created-at-key', ?3, ?4)
      `).run(beforeRecord, afterRecord, digest('7'), outOfRangeTimestamp), /constraint/i);
      assert.throws(() => db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-sale-event-created-at', 'sale-one', 1, 'corrected', ?1, ?2, 'Timestamp correction.',
          'artist-admin', 'bad-sale-event-created-at-key', ?3, ?4)
      `).run(
        saleSnapshot(), saleSnapshot({ totalMinor: 300001 }), digest('8'), outOfRangeTimestamp,
      ), /constraint/i);

      for (const id of [
        'bad-updated-at', 'bad-record-created-at', 'bad-record-updated-at',
        'bad-sale-recorded-at', 'bad-item-created-at', 'bad-media-created-at',
        'bad-ledger-created-at', 'bad-price-recorded-at', 'bad-reconnect-created-at',
        'bad-record-event-created-at', 'bad-sale-event-created-at',
      ]) {
        assert.equal(db.prepare(`
          SELECT id FROM (
            SELECT id FROM artist_reconnection_cases
            UNION ALL SELECT id FROM artist_artwork_records
            UNION ALL SELECT id FROM artist_artwork_record_events
            UNION ALL SELECT id FROM artist_verified_sales
            UNION ALL SELECT id FROM artist_verified_sale_events
            UNION ALL SELECT id FROM artist_verified_sale_items
            UNION ALL SELECT id FROM artist_artwork_media
            UNION ALL SELECT id FROM artist_artwork_ledger_entries
            UNION ALL SELECT id FROM artist_artwork_price_entries
            UNION ALL SELECT id FROM artist_reconnection_events
          ) WHERE id = ?1
        `).get(id), undefined, id);
      }

      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('rejects corrected sale snapshots whose date functions normalize to NULL', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      for (const [id, overrides] of [
        ['bad-correction-date', { occurredOn: '2026-08-32', totalMinor: 300001 }],
        ['bad-correction-month', {
          occurrencePrecision: 'month', occurredOn: '2026-13', totalMinor: 300001,
        }],
        ['bad-correction-timestamp', {
          recordedAt: '2026-13-10T12:00:00.000Z', totalMinor: 300001,
        }],
      ] as const) {
        assert.throws(() => db.prepare(`
          INSERT INTO artist_verified_sale_events
            (id, sale_id, sequence, event_type, before_json, after_json, reason,
             actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, 'sale-one', 1, 'corrected', ?2, ?3, 'Date correction.',
            'artist-admin', ?4, ?5, ?6)
        `).run(
          id, saleSnapshot(), saleSnapshot(overrides), `${id}-key`, digest('9'), now,
        ), /snapshot|date|invalid/i, id);
      }
      assert.equal(count(db, 'artist_verified_sale_events'), 0);

      const monthSnapshot = saleSnapshot({
        occurrencePrecision: 'month', occurredOn: '2026-08', totalMinor: 300001,
      });
      const yearSnapshot = saleSnapshot({
        occurrencePrecision: 'year', occurredOn: '2026', totalMinor: 300002,
      });
      const unknownSnapshot = saleSnapshot({
        occurrencePrecision: 'unknown', occurredOn: null, totalMinor: 300003,
      });
      for (const [id, sequence, before, after] of [
        ['valid-correction-month', 1, saleSnapshot(), monthSnapshot],
        ['valid-correction-year', 2, monthSnapshot, yearSnapshot],
        ['valid-correction-unknown', 3, yearSnapshot, unknownSnapshot],
      ] as const) {
        db.prepare(`
          INSERT INTO artist_verified_sale_events
            (id, sale_id, sequence, event_type, before_json, after_json, reason,
             actor_user_id, idempotency_key, request_digest, created_at)
          VALUES (?1, 'sale-one', ?2, 'corrected', ?3, ?4, 'Date correction.',
            'artist-admin', ?5, ?6, ?7)
        `).run(id, sequence, before, after, `${id}-key`, digest('a'), now);
      }
      assert.equal(count(db, 'artist_verified_sale_events'), 3);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('permits artwork identification changes only through an exact preinserted event', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      assert.throws(() => db.exec(`
        UPDATE artist_artwork_records
           SET artwork_id = 'UL-103', edition_json = '${uniqueEdition}',
               identification_status = 'identified', record_version = 2,
               updated_at = '${now}'
         WHERE id = 'record-unresolved'
      `), /authorized|event/i);

      const before = recordSnapshot({
        artworkId: null, editionJson: null, keeperPieceId: null,
        identificationStatus: 'unresolved', recordVersion: 1,
      });
      const after = recordSnapshot({
        artworkId: 'UL-103', editionJson: uniqueEdition, keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES
          ('record-event-one', 'record-unresolved', 'identified', ?1, ?2,
           2, 'artist-admin', 'record-event-one-key', ?3, ?4)
      `).run(before, after, digest('6'), now);
      db.exec(`
        UPDATE artist_artwork_records
           SET artwork_id = 'UL-103', edition_json = '${uniqueEdition}',
               keeper_piece_id = NULL, identification_status = 'identified',
               record_version = 2, last_event_id = 'record-event-one',
               updated_at = '${now}'
         WHERE id = 'record-unresolved'
      `);
      assert.deepEqual({ ...db.prepare(`
        SELECT artwork_id, keeper_piece_id, identification_status,
               record_version, last_event_id
          FROM artist_artwork_records WHERE id = 'record-unresolved'
      `).get() }, {
        artwork_id: 'UL-103', keeper_piece_id: null,
        identification_status: 'identified', record_version: 2,
        last_event_id: 'record-event-one',
      });

      assert.throws(() => db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-version-event', 'record-identified', 'identification_corrected',
          ?1, ?2, 7, 'artist-admin', 'bad-version-event-key', ?3, ?4)
      `).run(
        recordSnapshot({
          artworkId: 'UL-102', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 1,
        }),
        recordSnapshot({
          artworkId: 'UL-104', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 7,
        }), digest('7'), now,
      ), /snapshot|version|event/i);

      assert.throws(() => db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('bad-action-event', 'record-identified', 'identity_linked',
          ?1, ?2, 2, 'artist-admin', 'bad-action-event-key', ?3, ?4)
      `).run(
        recordSnapshot({
          artworkId: 'UL-102', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 1,
        }),
        recordSnapshot({
          artworkId: 'UL-104', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 2,
        }), digest('8'), now,
      ), /snapshot|action|event/i);

      const pendingAfter = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('pending-record-event', 'record-identified', 'identification_corrected',
          ?1, ?2, 2, 'artist-admin', 'pending-record-event-key', ?3, ?4)
      `).run(
        recordSnapshot({
          artworkId: 'UL-102', editionJson: uniqueEdition, keeperPieceId: null,
          identificationStatus: 'identified', recordVersion: 1,
        }), pendingAfter, digest('9'), now,
      );
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           record_version, last_event_id, created_by_user_id, created_at, updated_at)
        VALUES ('forged-version', 'UL-101', '${numberedEdition(2, 64)}', NULL, 'identified',
          2, 'pending-record-event', 'artist-admin', '${now}', '${now}')
      `), /initial|version|event/i);

      db.exec(`
        UPDATE artist_artwork_records
           SET artwork_id = 'UL-101', edition_json = '${numberedEdition(2, 64)}',
               keeper_piece_id = NULL, identification_status = 'identified',
               record_version = 2, last_event_id = 'pending-record-event',
               updated_at = '${now}'
         WHERE id = 'record-identified'
      `);
      const linkBefore = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 2,
      });
      const linkAfter = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: 'kp-sale-two',
        identificationStatus: 'identity_linked', recordVersion: 3,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('link-record-event', 'record-identified', 'identity_linked',
          ?1, ?2, 3, 'artist-admin', 'link-record-event-key', ?3, ?4)
      `).run(linkBefore, linkAfter, digest('a'), now);
      db.exec(`
        UPDATE artist_artwork_records
           SET keeper_piece_id = 'kp-sale-two', identification_status = 'identity_linked',
               record_version = 3, last_event_id = 'link-record-event',
               updated_at = '${now}'
         WHERE id = 'record-identified'
      `);
      assert.equal(db.prepare(`
        SELECT identification_status FROM artist_artwork_records
         WHERE id = 'record-identified'
      `).get()?.identification_status, 'identity_linked');

      assert.throws(
        () => db.exec(`UPDATE artist_artwork_record_events SET id = id WHERE id = 'record-event-one'`),
        /append-only/i,
      );
      assert.throws(
        () => db.exec(`DELETE FROM artist_artwork_record_events WHERE id = 'record-event-one'`),
        /append-only/i,
      );
    } finally {
      db.close();
    }
  });

  it('rejects UPDATE OR REPLACE when a pending identity event targets another artwork record keeper', () => {
    const db = database();
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      seedCaseAndRecords(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-link-target', 'UL-101', '${numberedEdition(2, 64)}', 'identified',
          'artist-admin', '${now}', '${now}')
      `);
      const before = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: null,
        identificationStatus: 'identified', recordVersion: 1,
      });
      const after = recordSnapshot({
        artworkId: 'UL-101', editionJson: numberedEdition(2, 64), keeperPieceId: 'kp-sale-two',
        identificationStatus: 'identity_linked', recordVersion: 2,
      });
      db.prepare(`
        INSERT INTO artist_artwork_record_events
          (id, artwork_record_id, action, before_json, after_json,
           resulting_version, actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('pending-link-event', 'record-link-target', 'identity_linked',
          ?1, ?2, 2, 'artist-admin', 'pending-link-event-key', ?3, ?4)
      `).run(before, after, digest('b'), now);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-later-owner', 'UL-101', '${numberedEdition(2, 64)}', 'kp-sale-two',
          'identity_linked', 'artist-admin', '${now}', '${now}')
      `);

      const stateBefore = {
        records: db.prepare(`
          SELECT id, artwork_id, edition_json, keeper_piece_id,
                 identification_status, record_version, last_event_id,
                 created_by_user_id, created_at, updated_at
            FROM artist_artwork_records
           WHERE id IN ('record-link-target', 'record-later-owner') ORDER BY id
        `).all().map((row) => ({ ...row })),
        events: db.prepare(`
          SELECT * FROM artist_artwork_record_events
           WHERE id = 'pending-link-event'
        `).all().map((row) => ({ ...row })),
      };

      assert.throws(() => db.exec(`
        UPDATE OR REPLACE artist_artwork_records
           SET keeper_piece_id = 'kp-sale-two',
               identification_status = 'identity_linked',
               record_version = 2,
               last_event_id = 'pending-link-event',
               updated_at = '${now}'
         WHERE id = 'record-link-target'
      `), /collision|keeper|identity/i);

      assert.deepEqual({
        records: db.prepare(`
          SELECT id, artwork_id, edition_json, keeper_piece_id,
                 identification_status, record_version, last_event_id,
                 created_by_user_id, created_at, updated_at
            FROM artist_artwork_records
           WHERE id IN ('record-link-target', 'record-later-owner') ORDER BY id
        `).all().map((row) => ({ ...row })),
        events: db.prepare(`
          SELECT * FROM artist_artwork_record_events
           WHERE id = 'pending-link-event'
        `).all().map((row) => ({ ...row })),
      }, stateBefore);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('prevents one keeper identity from linking to two private artwork records', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      assert.throws(() => db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('duplicate-link', 'UL-100', '${numberedEdition(1, 64)}', 'kp-sale-one',
          'identity_linked', 'artist-admin', '${now}', '${now}')
      `), /unique|constraint|collision/i);
      assert.equal(count(db, 'artist_artwork_records'), 3);
    } finally {
      db.close();
    }
  });

  it('keeps every permanent private record append-only and leaves base sales unchanged by corrections', () => {
    const db = database();
    try {
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      const beforeSale = saleSnapshot();
      const afterSale = saleSnapshot({ totalMinor: 310000 });
      assert.throws(() => db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('invalid-sale-event', 'sale-one', 1, 'corrected', ?1, ?2, 'Invalid correction.',
          'artist-admin', 'invalid-sale-event-key', ?3, ?4)
      `).run(
        beforeSale,
        saleSnapshot({ reconnectionCaseId: 'missing-case', verifiedByUserId: 'missing-user' }),
        digest('2'), now,
      ), /snapshot|foreign|reference/i);
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('sale-event-one', 'sale-one', 1, 'corrected', ?1, ?2, 'Total correction.',
          'artist-admin', 'sale-event-one-key', ?3, ?4)
      `).run(beforeSale, afterSale, digest('3'), now);
      db.exec(`
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('reconnect-event-one', 'case-one', 'note_added', 'Call next week.',
          'artist-admin', 'reconnect-event-one-key', '${digest('4')}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-one', 'record-unresolved', 'certificate_image',
          'artist-sales/certificate-one.jpg', '${digest('5')}', 'image/jpeg', 100,
          'artist-admin', '${now}');
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('ledger-one', 'record-unresolved', 'sale-one', 'Archived receipt found.',
          'artist-admin', 'ledger-one-key', '${digest('6')}', '${now}');
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES ('price-one', 'record-unresolved', 'item-one', 100000, 'USD',
          '2026-08-01', 'exact', '${now}');
      `);

      const immutableRows = [
        ['artist_reconnection_cases', 'case-one'],
        ['artist_reconnection_events', 'reconnect-event-one'],
        ['artist_verified_sales', 'sale-one'],
        ['artist_verified_sale_events', 'sale-event-one'],
        ['artist_verified_sale_items', 'item-one'],
        ['artist_artwork_media', 'media-one'],
        ['artist_artwork_ledger_entries', 'ledger-one'],
        ['artist_artwork_price_entries', 'price-one'],
      ];
      for (const [table, id] of immutableRows) {
        assert.throws(
          () => db.exec(`UPDATE ${table} SET id = id || '-changed' WHERE id = '${id}'`),
          /append-only|permanent|immutable/i, `${table} update`,
        );
        assert.throws(
          () => db.exec(`DELETE FROM ${table} WHERE id = '${id}'`),
          /append-only|permanent|immutable/i, `${table} delete`,
        );
      }
      assert.throws(
        () => db.exec(`DELETE FROM artist_artwork_records WHERE id = 'record-unresolved'`),
        /permanent|delete/i,
      );
      assert.equal(db.prepare(`
        SELECT total_minor FROM artist_verified_sales WHERE id = 'sale-one'
      `).get()?.total_minor, 300000);
      assert.equal(count(db, 'artist_verified_sale_events'), 1);
    } finally {
      db.close();
    }
  });

  it('rejects INSERT OR REPLACE collisions without changing permanent rows or dependents', () => {
    const db = database();
    try {
      db.exec('PRAGMA recursive_triggers = OFF');
      seedCaseAndRecords(db);
      insertPrimarySale(db);
      db.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-standalone', NULL, NULL, 'unresolved',
          'artist-admin', '${now}', '${now}');
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, actor_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('reconnect-event-one', 'case-one', 'note_added', 'Original note.',
          'artist-admin', 'reconnect-event-one-key', '${digest('3')}', '${now}');
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-one', 'record-unresolved', 'identification_evidence',
          'artist-sales/original.webp', '${digest('4')}', 'image/webp', 100,
          'artist-admin', '${now}');
        INSERT INTO artist_artwork_ledger_entries
          (id, artwork_record_id, sale_id, message, media_id, created_by_user_id,
           idempotency_key, request_digest, created_at)
        VALUES ('ledger-one', 'record-unresolved', 'sale-one', 'Original ledger note.',
          'media-one', 'artist-admin', 'ledger-one-key', '${digest('5')}', '${now}');
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES ('price-one', 'record-unresolved', 'item-one', 100000, 'USD',
          '2026-08-01', 'exact', '${now}');
      `);
      db.prepare(`
        INSERT INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('sale-event-one', 'sale-one', 1, 'corrected', ?1, ?2, 'Total correction.',
          'artist-admin', 'sale-event-one-key', ?3, ?4)
      `).run(saleSnapshot(), saleSnapshot({ totalMinor: 310000 }), digest('6'), now);

      const permanentTables = [
        'artist_reconnection_cases', 'artist_reconnection_events',
        'artist_artwork_records', 'artist_artwork_record_events',
        'artist_verified_sales', 'artist_verified_sale_events',
        'artist_verified_sale_items', 'artist_artwork_media',
        'artist_artwork_ledger_entries', 'artist_artwork_price_entries',
      ];
      const countsBefore = Object.fromEntries(
        permanentTables.map((table) => [table, count(db, table)]),
      );
      const originals = {
        case: { ...db.prepare(`SELECT * FROM artist_reconnection_cases WHERE id = 'case-one'`).get() },
        record: { ...db.prepare(`SELECT * FROM artist_artwork_records WHERE id = 'record-standalone'`).get() },
        sale: { ...db.prepare(`SELECT * FROM artist_verified_sales WHERE id = 'sale-one'`).get() },
        event: { ...db.prepare(`SELECT * FROM artist_verified_sale_events WHERE id = 'sale-event-one'`).get() },
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-one'`).get() },
        ledger: { ...db.prepare(`SELECT * FROM artist_artwork_ledger_entries WHERE id = 'ledger-one'`).get() },
        price: { ...db.prepare(`SELECT * FROM artist_artwork_price_entries WHERE id = 'price-one'`).get() },
      };

      const replacementSql = [
        `INSERT OR REPLACE INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
         VALUES ('case-one', 'attacker@example.com', 'closed', 'artist-second',
           'attacker-case-key', '${digest('7')}', '${now}', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
         VALUES ('record-standalone', 'UL-101', '${numberedEdition(2, 64)}', 'kp-sale-two',
           'identity_linked', 'artist-second', '${now}', '${now}')`,
        `INSERT OR REPLACE INTO artist_verified_sales
          (id, occurrence_precision, occurred_on, buyer_email, verified_by_user_id,
           idempotency_key, request_digest, recorded_at)
         VALUES ('sale-one', 'unknown', NULL, 'attacker@example.com', 'artist-second',
           'attacker-sale-key', '${digest('8')}', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
         VALUES ('media-one', 'record-unresolved', 'certificate_image',
           'artist-sales/replaced.png', '${digest('9')}', 'image/png', 200,
           'artist-second', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_ledger_entries
          (id, artwork_record_id, message, created_by_user_id,
           idempotency_key, request_digest, created_at)
         VALUES ('ledger-one', 'record-unresolved', 'Replacement ledger note.',
           'artist-second', 'attacker-ledger-key', '${digest('a')}', '${now}')`,
        `INSERT OR REPLACE INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
         VALUES ('price-one', 'record-unresolved', 'item-one', 100000, 'USD',
           '2026-08-01', 'exact', '${now}')`,
      ];
      for (const sql of replacementSql) {
        assert.throws(() => db.exec(sql), /collision/i);
      }
      assert.throws(() => db.prepare(`
        INSERT OR REPLACE INTO artist_verified_sale_events
          (id, sale_id, sequence, event_type, before_json, after_json, reason,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES ('sale-event-one', 'sale-one', 1, 'corrected', ?1, ?2, 'Replacement correction.',
          'artist-second', 'replacement-event-key', ?3, ?4)
      `).run(
        saleSnapshot(), saleSnapshot({ totalMinor: 320000 }), digest('b'), now,
      ), /collision/i);

      assert.throws(() => db.exec(`
        INSERT OR REPLACE INTO artist_reconnection_cases
          (id, recipient_email, status, created_by_user_id, idempotency_key,
           request_digest, created_at, updated_at)
        VALUES ('case-reused-key', 'other@example.com', 'open', 'artist-admin',
          'case-one-key', '${digest('c')}', '${now}', '${now}')
      `), /collision/i);
      assert.throws(() => db.exec(`
        INSERT OR REPLACE INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES ('media-reused-reference', 'record-unresolved', 'certificate_image',
          'artist-sales/original.webp', '${digest('d')}', 'image/webp', 100,
          'artist-admin', '${now}')
      `), /collision/i);

      assert.deepEqual(Object.fromEntries(
        permanentTables.map((table) => [table, count(db, table)]),
      ), countsBefore);
      assert.deepEqual({
        case: { ...db.prepare(`SELECT * FROM artist_reconnection_cases WHERE id = 'case-one'`).get() },
        record: { ...db.prepare(`SELECT * FROM artist_artwork_records WHERE id = 'record-standalone'`).get() },
        sale: { ...db.prepare(`SELECT * FROM artist_verified_sales WHERE id = 'sale-one'`).get() },
        event: { ...db.prepare(`SELECT * FROM artist_verified_sale_events WHERE id = 'sale-event-one'`).get() },
        media: { ...db.prepare(`SELECT * FROM artist_artwork_media WHERE id = 'media-one'`).get() },
        ledger: { ...db.prepare(`SELECT * FROM artist_artwork_ledger_entries WHERE id = 'ledger-one'`).get() },
        price: { ...db.prepare(`SELECT * FROM artist_artwork_price_entries WHERE id = 'price-one'`).get() },
      }, originals);
    } finally {
      db.close();
    }
  });

  it('preserves every legitimate lineage payload shape while rejecting private payload keys and values', () => {
    const db = database();
    try {
      const legitimatePayloads: Array<[string, Record<string, unknown>]> = [
        ['issued', {}],
        ['issued', { publicCode: 'AR-ABCDEFGH' }],
        ['issued', { pieceId: 'UL-100', editionNumber: 1, publicCode: 'AR-ABCDEFGH' }],
        ['activated', {}],
        ['activated', { plateStatus: 'active' }],
        ['fulfillment_assign', {}],
        ['fulfillment_correct', {}],
        ['fulfillment_correction_out', {}],
        ['fulfillment_correction_in', {}],
        ['fulfillment_ship', {}],
        ['first_bound', {}],
        ['first_bound', { pieceId: 'UL-100', editionNumber: 1 }],
        ['migration_baseline', {}],
        ['link_corrected', { pieceId: 'UL-100', editionNumber: 1 }],
        ['voided', { plateStatus: 'void' }],
        ['superseded', { plateStatus: 'superseded' }],
        ['transferred', {
          fromRef: 'tp-00000000-0000-4000-8000-000000000001',
          toRef: 'tp-00000000-0000-4000-8000-000000000002',
          transferKind: 'gift',
        }],
      ];
      for (const [index, [eventType, payload]] of legitimatePayloads.entries()) {
        db.prepare(`
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, registered_at)
          VALUES (?1, ?2, 0, ?3, ?4)
        `).run(
          `kp-lineage-positive-${index}`, `UL-${String(200 + index).padStart(3, '0')}`,
          index.toString(16).padStart(64, '0'), now,
        );
        db.prepare(`
          INSERT INTO artwork_lineage_events
            (id, keeper_piece_id, sequence, event_type, event_at,
             previous_hash, event_hash, public_payload_json)
          VALUES (?1, ?2, 1, ?3, ?4, NULL, ?5, ?6)
        `).run(
          `lineage-positive-${index}`, `kp-lineage-positive-${index}`,
          eventType, now, `lineage-positive-hash-${index}`, JSON.stringify(payload),
        );
      }
      const before = count(db, 'artwork_lineage_events');
      db.exec('PRAGMA recursive_triggers = OFF');
      assert.throws(() => db.exec(`
        INSERT OR REPLACE INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at,
           previous_hash, event_hash, public_payload_json)
        VALUES ('lineage-positive-0', 'kp-lineage-positive-0', 1, 'issued',
          '${now}', NULL, 'replacement-public-hash', '{}')
      `), /collision/i);
      assert.equal(count(db, 'artwork_lineage_events'), before);

      const privatePayloads = [
        { buyerEmail: 'collector@example.com' },
        { amount_minor: 100000, currency: 'USD' },
        { details: { privateNotes: 'Do not publish this.' } },
        { reason: 'Private transcription correction.' },
        { storage_reference: 'artist-sales/private/front.webp' },
        { artistArtworkRecordId: 'record-unresolved' },
        { creatorMessage: 'The collector asked for discretion.' },
        { pieceId: 'collector@example.com' },
        { publicCode: 'artist-sales/private/front.webp' },
      ];
      for (const [index, payload] of privatePayloads.entries()) {
        db.prepare(`
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, registered_at)
          VALUES (?1, ?2, 0, ?3, ?4)
        `).run(
          `kp-lineage-private-${index}`, `UL-${String(300 + index).padStart(3, '0')}`,
          (100 + index).toString(16).padStart(64, '0'), now,
        );
        assert.throws(() => db.prepare(`
          INSERT INTO artwork_lineage_events
            (id, keeper_piece_id, sequence, event_type, event_at,
             previous_hash, event_hash, public_payload_json)
          VALUES (?1, ?2, 1, 'first_bound', ?3, NULL, ?4, ?5)
        `).run(
          `lineage-private-${index}`, `kp-lineage-private-${index}`, now,
          `lineage-private-hash-${index}`, JSON.stringify(payload),
        ), /private|payload|lineage/i, JSON.stringify(payload));
      }
      assert.equal(count(db, 'artwork_lineage_events'), before);

      assert.throws(() => db.exec(`
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at,
           previous_hash, event_hash, public_payload_json, buyer_email,
           price_minor, private_record_id, private_note, storage_reference)
        VALUES ('public-private', 'kp-sale-one', 2, 'issued', '${now}',
          '${digest('c')}', '${digest('d')}', '{}', 'collector@example.com',
          10000, 'record-unresolved', 'Private note', 'private/image.webp')
      `), /no column|has no column/i);
      assert.equal(count(db, 'artwork_lineage_events'), before);
      assert.deepEqual(columns(db, 'artwork_lineage_events'), [
        'id', 'keeper_piece_id', 'sequence', 'event_type', 'event_at',
        'previous_hash', 'event_hash', 'public_payload_json',
      ]);
    } finally {
      db.close();
    }
  });

  it('rolls back a partially invalid three-artwork sale transaction without residue', () => {
    const db = database();
    const privateTables = [
      'artist_reconnection_cases', 'artist_reconnection_events',
      'artist_artwork_records', 'artist_artwork_record_events',
      'artist_verified_sales', 'artist_verified_sale_events',
      'artist_verified_sale_items', 'artist_artwork_media',
      'artist_artwork_ledger_entries', 'artist_artwork_price_entries',
    ];
    try {
      const beforeCounts = Object.fromEntries(
        privateTables.map((table) => [table, count(db, table)]),
      );
      assert.equal(Object.keys(beforeCounts).length, 10);
      db.exec('BEGIN IMMEDIATE');
      try {
        seedCaseAndRecords(db);
        db.exec(`
          INSERT INTO artist_verified_sales
            (id, reconnection_case_id, occurrence_precision, occurred_on,
             buyer_email, verified_by_user_id, idempotency_key,
             request_digest, recorded_at)
          VALUES ('sale-rollback', 'case-one', 'year', '2024',
            'collector@example.com', 'artist-admin', 'sale-rollback-key',
            '${digest('e')}', '${now}');
          INSERT INTO artist_verified_sale_items
            (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
          VALUES
            ('rollback-item-one', 'sale-rollback', 'record-unresolved', 100, 'USD', '${now}'),
            ('rollback-item-two', 'sale-rollback', 'record-identified', 200, 'USD', '${now}');
          INSERT INTO artist_verified_sale_items
            (id, sale_id, artwork_record_id, amount_minor, created_at)
          VALUES
            ('rollback-item-three', 'sale-rollback', 'record-linked', 300, '${now}');
        `);
        assert.fail('invalid third sale item unexpectedly committed');
      } catch (error) {
        db.exec('ROLLBACK');
        assert.match(String(error), /constraint/i);
      }
      assert.deepEqual(Object.fromEntries(
        privateTables.map((table) => [table, count(db, table)]),
      ), beforeCounts);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      db.close();
    }
  });

  it('creates a canonical multi-artwork sale atomically and exactly replays it', async () => {
    const fixture = serviceEnvironment();
    try {
      const created = await createVerifiedSale(fixture.env, saleInput());
      assert.equal(created.replayed, false);
      assert.equal(created.artworkRecordIds.length, 3);
      assert.equal(new Set(created.artworkRecordIds).size, 3);
      assert.equal(count(fixture.db, 'artist_verified_sales'), 1);
      assert.equal(count(fixture.db, 'artist_verified_sale_items'), 3);
      assert.equal(count(fixture.db, 'artist_artwork_records'), 3);
      assert.equal(count(fixture.db, 'artist_artwork_price_entries'), 2);
      assert.deepEqual({ ...fixture.db.prepare(`
        SELECT buyer_email, currency, total_minor, private_reference
          FROM artist_verified_sales WHERE id = ?1
      `).get(created.saleId) }, {
        buyer_email: 'collector@example.com', currency: 'USD', total_minor: 900000,
        private_reference: 'studio-ledger-2018-4',
      });
      assert.equal(fixture.db.prepare(`
        SELECT identification_status FROM artist_artwork_records WHERE id = ?1
      `).get(created.artworkRecordIds[2])?.identification_status, 'unresolved');

      const replay = await createVerifiedSale(fixture.env, saleInput({
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        recordedAt: '2026-08-10T01:00:01.000Z',
      }));
      assert.deepEqual(replay, { ...created, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT recorded_at FROM artist_verified_sales WHERE id = ?1
      `).get(created.saleId)?.recorded_at, '2026-08-10T01:00:00.000Z');
      await assert.rejects(
        createVerifiedSale(fixture.env, saleInput({ buyerEmail: 'changed@example.com' })),
        (error: Error & { code?: string }) => error.code === 'idempotency_conflict',
      );
      assert.equal(count(fixture.db, 'artist_verified_sales'), 1);
    } finally {
      fixture.db.close();
    }
  });

  it('recovers an exact sale replay after a committed response is lost and rolls back every forced failure', async () => {
    const lost = serviceEnvironment({ loseFirstResponse: true });
    try {
      const recovered = await createVerifiedSale(lost.env, saleInput());
      assert.equal(recovered.replayed, true);
      const replay = await createVerifiedSale(lost.env, saleInput());
      assert.deepEqual(replay, recovered);
      assert.equal(count(lost.db, 'artist_verified_sales'), 1);
    } finally {
      lost.db.close();
    }

    for (const failBatchAt of [1, 4, 8]) {
      const failed = serviceEnvironment({ failBatchAt });
      try {
        await assert.rejects(createVerifiedSale(failed.env, saleInput()), /batch failure/);
        for (const table of [
          'artist_verified_sales', 'artist_verified_sale_items',
          'artist_artwork_records', 'artist_artwork_price_entries',
        ]) assert.equal(count(failed.db, table), 0, `${table} at ${failBatchAt}`);
      } finally {
        failed.db.close();
      }
    }
  });

  it('rejects unknown authority and resolves racing sale creates without partial rows', async () => {
    const fixture = serviceEnvironment();
    try {
      await assert.rejects(createVerifiedSale(fixture.env, {
        ...saleInput(), elevatedRole: 'owner',
      }), (error: Error & { code?: string }) => error.code === 'invalid_request');
      await assert.rejects(createVerifiedSale(fixture.env, saleInput({
        artworks: [{
          artworkRecordId: null, artworkId: null, edition: null, price: null,
          fabricatedKeeperPieceId: 'kp-sale-one',
        }],
      })), (error: Error & { code?: string }) => error.code === 'invalid_request');

      const outcomes = await Promise.allSettled([
        createVerifiedSale(fixture.env, saleInput()),
        createVerifiedSale(fixture.env, saleInput({
          administrator: { userId: 'artist-second', email: 'second@example.com' },
        })),
      ]);
      assert.deepEqual(outcomes.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
      const rejected = outcomes.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      assert.equal(rejected.reason.code, 'idempotency_conflict');
      assert.equal(count(fixture.db, 'artist_verified_sales'), 1);
      assert.equal(count(fixture.db, 'artist_verified_sale_items'), 3);
      assert.equal(count(fixture.db, 'artist_artwork_records'), 3);
    } finally {
      fixture.db.close();
    }
  });

  it('keeps email-only reconnection cases open and records manual progress exactly', async () => {
    const fixture = serviceEnvironment();
    try {
      const created = await createReconnectionCase(fixture.env, {
        recipientEmail: ' Collector@Example.com ', recipientName: null,
        privateContext: ' Old address book. ', idempotencyKey: 'reconnect-email-only',
        administrator, createdAt: now,
      });
      assert.equal(created.status, 'open');
      assert.equal(created.replayed, false);
      assert.equal(count(fixture.db, 'artist_artwork_records'), 0);
      assert.deepEqual(await createReconnectionCase(fixture.env, {
        recipientEmail: 'collector@example.com', recipientName: null,
        privateContext: 'Old address book.', idempotencyKey: 'reconnect-email-only',
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        createdAt: '2026-08-10T12:00:01.000Z',
      }), { ...created, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_reconnection_cases WHERE id = ?1
      `).get(created.reconnectionCaseId)?.created_at, now);

      const email = await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'email_sent',
        privateNote: null, artworkRecordId: null, newStatus: null,
        idempotencyKey: 'reconnect-email-null', administrator, createdAt: now,
      });
      assert.equal(email.eventType, 'email_sent');
      assert.equal(fixture.db.prepare(`
        SELECT private_note FROM artist_reconnection_events WHERE id = ?1
      `).get(email.reconnectionEventId)?.private_note, null);
      assert.deepEqual(await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'email_sent',
        privateNote: null, artworkRecordId: null, newStatus: null,
        idempotencyKey: 'reconnect-email-null', administrator,
        createdAt: '2026-08-10T12:00:02.000Z',
      }), { ...email, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_reconnection_events WHERE id = ?1
      `).get(email.reconnectionEventId)?.created_at, now);
      await assert.rejects(appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'email_sent',
        privateNote: 'Manual follow-up.', artworkRecordId: null, newStatus: null,
        idempotencyKey: 'reconnect-email-null', administrator,
        createdAt: '2026-08-10T12:00:03.000Z',
      }), (error: Error & { code?: string }) => error.code === 'idempotency_conflict');

      const note = await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'note_added',
        privateNote: ' Try the gallery. ', artworkRecordId: null, newStatus: null,
        idempotencyKey: 'reconnect-note', administrator, createdAt: now,
      });
      assert.deepEqual(await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'note_added',
        privateNote: 'Try the gallery.', artworkRecordId: null, newStatus: null,
        idempotencyKey: 'reconnect-note',
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        createdAt: '2026-08-10T12:00:03.000Z',
      }), { ...note, replayed: true });
      const progressed = await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'partially_resolved',
        idempotencyKey: 'reconnect-progress', administrator, createdAt: now,
      });
      assert.equal(note.eventType, 'note_added');
      assert.equal(progressed.status, 'partially_resolved');
      assert.equal((await listArtistSaleWorkspace(fixture.env, {})).reconnectionCases[0].status,
        'partially_resolved');
      await assert.rejects(appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'open',
        idempotencyKey: 'reconnect-backwards', administrator, createdAt: now,
      }), (error: Error & { code?: string }) => error.code === 'invalid_request');

      const attachedSale = await createVerifiedSale(fixture.env, saleInput({
        idempotencyKey: 'sale-attached-case', reconnectionCaseId: created.reconnectionCaseId,
      }));
      assert.equal(attachedSale.artworkRecordIds.length, 3);
      assert.equal(fixture.db.prepare(`
        SELECT COUNT(*) AS count FROM artist_reconnection_events
         WHERE reconnection_case_id = ?1 AND event_type = 'artwork_added'
      `).get(created.reconnectionCaseId)?.count, 3);
    } finally {
      fixture.db.close();
    }
  });

  it('requires complete successful reconnection-event batch results and recovers exact lost responses', async () => {
    for (const malformed of [
      [],
      [{ success: false, meta: { changes: 1 } }],
      [{ success: true, meta: { changes: 0 } }],
      undefined,
    ]) {
      const options: {
        skipBatchExecution?: boolean;
        overrideBatchResults?: (results: any[], batchNumber: number) => any;
      } = {};
      const fixture = serviceEnvironment(options);
      try {
        const created = await createReconnectionCase(fixture.env, {
          recipientEmail: 'collector@example.com', recipientName: null, privateContext: null,
          idempotencyKey: `malformed-case-${String(malformed)}`, administrator, createdAt: now,
        });
        options.skipBatchExecution = true;
        options.overrideBatchResults = () => malformed;
        await assert.rejects(appendReconnectionEvent(fixture.env, {
          reconnectionCaseId: created.reconnectionCaseId, eventType: 'note_added',
          privateNote: 'Must not claim success.', artworkRecordId: null, newStatus: null,
          idempotencyKey: `malformed-event-${String(malformed)}`, administrator, createdAt: now,
        }), (error: Error & { code?: string }) => error.code === 'atomic_write_failed');
        assert.equal(count(fixture.db, 'artist_reconnection_events'), 0);
      } finally {
        fixture.db.close();
      }
    }

    const guardedOptions: {
      skipBatchExecution?: boolean;
      overrideBatchResults?: (results: any[], batchNumber: number) => any;
    } = {};
    const guarded = serviceEnvironment(guardedOptions);
    try {
      const created = await createReconnectionCase(guarded.env, {
        recipientEmail: 'guarded@example.com', recipientName: null, privateContext: null,
        idempotencyKey: 'guarded-case', administrator, createdAt: now,
      });
      guardedOptions.skipBatchExecution = true;
      guardedOptions.overrideBatchResults = () => [{ success: true, meta: { changes: 0 } }];
      await assert.rejects(appendReconnectionEvent(guarded.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'partially_resolved',
        idempotencyKey: 'guarded-status', administrator, createdAt: now,
      }), (error: Error & { code?: string }) => error.code === 'version_conflict');
    } finally {
      guarded.db.close();
    }

    const lostOptions: { loseResponseAtBatch?: number } = {};
    const lost = serviceEnvironment(lostOptions);
    try {
      const created = await createReconnectionCase(lost.env, {
        recipientEmail: 'lost@example.com', recipientName: null, privateContext: null,
        idempotencyKey: 'lost-event-case', administrator, createdAt: now,
      });
      lostOptions.loseResponseAtBatch = 2;
      const recovered = await appendReconnectionEvent(lost.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'note_added',
        privateNote: 'Committed before response loss.', artworkRecordId: null, newStatus: null,
        idempotencyKey: 'lost-note-event', administrator, createdAt: now,
      });
      assert.equal(recovered.replayed, true);
      assert.equal(count(lost.db, 'artist_reconnection_events'), 1);
    } finally {
      lost.db.close();
    }
  });

  it('replays immutable reconnection-event data after later case progress', async () => {
    const fixture = serviceEnvironment();
    try {
      const created = await createReconnectionCase(fixture.env, {
        recipientEmail: 'immutable@example.com', recipientName: null, privateContext: null,
        idempotencyKey: 'immutable-case', administrator, createdAt: now,
      });
      const noteInput = {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'note_added',
        privateNote: 'Original immutable note.', artworkRecordId: null, newStatus: null,
        idempotencyKey: 'immutable-note', administrator, createdAt: now,
      };
      const note = await appendReconnectionEvent(fixture.env, noteInput);
      assert.equal('status' in note, false);
      await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'partially_resolved',
        idempotencyKey: 'immutable-partial', administrator, createdAt: now,
      });
      await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'resolved',
        idempotencyKey: 'immutable-resolved', administrator,
        createdAt: '2026-08-10T12:00:01.000Z',
      });
      assert.deepEqual(await appendReconnectionEvent(fixture.env, {
        ...noteInput,
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
      }), { ...note, replayed: true });
      const resolvedReplay = await appendReconnectionEvent(fixture.env, {
        reconnectionCaseId: created.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: 'resolved',
        idempotencyKey: 'immutable-resolved', administrator,
        createdAt: '2026-08-10T12:00:01.000Z',
      });
      assert.equal(resolvedReplay.status, 'resolved');
    } finally {
      fixture.db.close();
    }
  });

  it('identifies records with event-gated optimistic versions and links only exact keeper identities', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const unresolvedId = sale.artworkRecordIds[2];
      await assert.rejects(identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'ZZ-999', edition: { kind: 'unique' },
        expectedVersion: 1, idempotencyKey: 'identify-unknown', administrator, identifiedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_not_found');

      const identified = await identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 1, size: 64 }, expectedVersion: 1,
        idempotencyKey: 'identify-record', administrator, identifiedAt: now,
      });
      assert.deepEqual(identified, {
        artworkRecordId: unresolvedId, identificationStatus: 'identified', artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 1, size: 64 }, keeperPieceId: null,
        recordVersion: 2, replayed: false,
      });
      assert.deepEqual(await identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 1, size: 64 }, expectedVersion: 1,
        idempotencyKey: 'identify-record',
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        identifiedAt: '2026-08-10T12:00:01.000Z',
      }), { ...identified, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_artwork_record_events WHERE idempotency_key = 'identify-record'
      `).get()?.created_at, now);
      await assert.rejects(identifyArtworkRecord(fixture.env, {
        artworkRecordId: unresolvedId, artworkId: 'UL-101',
        edition: { kind: 'numbered', number: 2, size: 64 }, expectedVersion: 1,
        idempotencyKey: 'identify-stale', administrator, identifiedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'version_conflict');

      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'missing', expectedVersion: 2,
        idempotencyKey: 'link-missing', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'keeper_identity_not_found');
      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-two', expectedVersion: 2,
        idempotencyKey: 'link-mismatch', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_identity_mismatch');
      fixture.db.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, registered_at)
        VALUES ('kp-sale-wrong-edition', 'UL-100', 2, '${digest('f')}', '${now}')
      `);
      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-wrong-edition', expectedVersion: 2,
        idempotencyKey: 'link-number-mismatch', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_identity_mismatch');
      const linked = await linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-one', expectedVersion: 2,
        idempotencyKey: 'link-match', administrator, linkedAt: now,
      });
      assert.equal(linked.identificationStatus, 'identity_linked');
      assert.equal(linked.recordVersion, 3);
      assert.equal(linked.keeperPieceId, 'kp-sale-one');
      assert.deepEqual(await linkArtworkIdentity(fixture.env, {
        artworkRecordId: unresolvedId, keeperPieceId: 'kp-sale-one', expectedVersion: 2,
        idempotencyKey: 'link-match',
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        linkedAt: '2026-08-10T12:00:02.000Z',
      }), { ...linked, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_artwork_record_events WHERE idempotency_key = 'link-match'
      `).get()?.created_at, now);
      await assert.rejects(linkArtworkIdentity(fixture.env, {
        artworkRecordId: sale.artworkRecordIds[0], keeperPieceId: 'kp-sale-one', expectedVersion: 1,
        idempotencyKey: 'link-duplicate-keeper', administrator, linkedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'artwork_identity_mismatch');
      assert.equal(count(fixture.db, 'artwork_lineage_events'), 0);
    } finally {
      fixture.db.close();
    }
  });

  it('appends exact ledger and shared sale messages only to sale artworks', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const one = await appendArtworkLedgerEntry(fixture.env, {
        artworkRecordId: sale.artworkRecordIds[0], saleId: sale.saleId,
        message: ' Creator note. ', mediaId: null, idempotencyKey: 'ledger-one',
        administrator, createdAt: now,
      });
      assert.equal(one.replayed, false);
      assert.deepEqual(await appendArtworkLedgerEntry(fixture.env, {
        artworkRecordId: sale.artworkRecordIds[0], saleId: sale.saleId,
        message: 'Creator note.', mediaId: null, idempotencyKey: 'ledger-one',
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        createdAt: '2026-08-10T12:00:01.000Z',
      }), { ...one, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_artwork_ledger_entries WHERE id = ?1
      `).get(one.ledgerEntryId)?.created_at, now);
      const maximumParentKey = 'k'.repeat(256);
      const shared = await appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds.slice(0, 2),
        message: ' Thank you for keeping this work. ', expectedSequence: 0,
        idempotencyKey: maximumParentKey, administrator, createdAt: now,
      });
      assert.equal(shared.entries.length, 2);
      assert.equal(new Set(shared.entries.map((entry: any) => entry.ledgerEntryId)).size, 2);
      const storedChildKeys = fixture.db.prepare(`
        SELECT idempotency_key FROM artist_artwork_ledger_entries
         WHERE id IN (?1, ?2) ORDER BY id
      `).all(...shared.entries.map((entry: any) => entry.ledgerEntryId));
      assert.equal(storedChildKeys.length, 2);
      assert.ok(storedChildKeys.every((row) =>
        String(row.idempotency_key).startsWith('artist-shared-ledger-')
        && String(row.idempotency_key).length <= 256
      ));
      assert.deepEqual(await appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds.slice(0, 2),
        message: 'Thank you for keeping this work.', expectedSequence: 1,
        idempotencyKey: maximumParentKey,
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        createdAt: '2026-08-10T12:00:02.000Z',
      }), { ...shared, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_verified_sale_events WHERE id = ?1
      `).get(shared.saleEventId)?.created_at, now);
      await assert.rejects(appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds.slice(1),
        message: 'Thank you for keeping this work.', expectedSequence: 0,
        idempotencyKey: maximumParentKey, administrator, createdAt: now,
      }), (error: Error & { code?: string }) => error.code === 'idempotency_conflict');
      assert.equal(count(fixture.db, 'artist_verified_sale_events'), 1);
      assert.equal(count(fixture.db, 'artwork_lineage_events'), 0);
    } finally {
      fixture.db.close();
    }
  });

  it('rolls back every shared-message child and its event on a final batch failure', async () => {
    const options: { failBatchAt?: number } = {};
    const fixture = serviceEnvironment(options);
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      options.failBatchAt = 2;
      await assert.rejects(appendSharedSaleMessage(fixture.env, {
        saleId: sale.saleId, artworkRecordIds: sale.artworkRecordIds,
        message: 'This response must roll back.', expectedSequence: 0,
        idempotencyKey: 'shared-rollback', administrator, createdAt: now,
      }));
      assert.equal(count(fixture.db, 'artist_artwork_ledger_entries'), 0);
      assert.equal(count(fixture.db, 'artist_verified_sale_events'), 0);
    } finally {
      fixture.db.close();
    }
  });

  it('overlays complete sale corrections without changing base sales or price history', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const base = { ...fixture.db.prepare(`SELECT * FROM artist_verified_sales WHERE id = ?1`).get(sale.saleId) };
      const prices = fixture.db.prepare(`SELECT * FROM artist_artwork_price_entries ORDER BY id`).all();
      const corrected = await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0,
        replacement: {
          reconnectionCaseId: null, occurrence: { precision: 'year', value: '2019' },
          buyerEmail: 'new@example.com', total: { amountMinor: 910000, currency: 'USD' },
          privateReference: 'Corrected ledger reference', privateNotes: 'Corrected note.',
        },
        reason: 'Transcription correction.', idempotencyKey: 'correct-sale',
        administrator, correctedAt: now,
      });
      assert.equal(corrected.sequence, 1);
      assert.equal(fixture.db.prepare(`
        SELECT reason FROM artist_verified_sale_events WHERE id = ?1
      `).get(corrected.saleEventId)?.reason, 'Transcription correction.');
      assert.deepEqual(await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0,
        replacement: {
          reconnectionCaseId: null, occurrence: { precision: 'year', value: '2019' },
          buyerEmail: 'new@example.com', total: { amountMinor: 910000, currency: 'USD' },
          privateReference: 'Corrected ledger reference', privateNotes: 'Corrected note.',
        },
        reason: 'Transcription correction.', idempotencyKey: 'correct-sale',
        administrator: { ...administrator, email: 'renamed-artist@example.com' },
        correctedAt: '2026-08-10T12:00:01.000Z',
      }), { ...corrected, replayed: true });
      assert.equal(fixture.db.prepare(`
        SELECT created_at FROM artist_verified_sale_events WHERE id = ?1
      `).get(corrected.saleEventId)?.created_at, now);
      await assert.rejects(correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 1,
        replacement: {
          reconnectionCaseId: null, occurrence: { precision: 'year', value: '2019' },
          buyerEmail: 'new@example.com', total: { amountMinor: 910000, currency: 'USD' },
          privateReference: 'Corrected ledger reference', privateNotes: 'Corrected note.',
        },
        reason: 'Transcription correction.', idempotencyKey: 'correct-sale',
        administrator, correctedAt: '2026-08-10T12:00:02.000Z',
      }), (error: Error & { code?: string }) => error.code === 'idempotency_conflict');
      const detail = await getArtistSaleDetail(fixture.env, sale.saleId);
      assert.equal(detail.sale.occurrence.value, '2019');
      assert.equal(detail.sale.buyerEmail, 'new@example.com');
      assert.equal(detail.sale.privateNotes, 'Corrected note.');
      assert.deepEqual(detail.events, [{
        saleEventId: corrected.saleEventId, sequence: 1, eventType: 'corrected',
        reason: 'Transcription correction.', createdAt: now,
      }]);
      assert.deepEqual({ ...fixture.db.prepare(`SELECT * FROM artist_verified_sales WHERE id = ?1`).get(sale.saleId) }, base);
      assert.deepEqual(fixture.db.prepare(`SELECT * FROM artist_artwork_price_entries ORDER BY id`).all(), prices);
      await assert.rejects(correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0,
        replacement: {
          reconnectionCaseId: null, occurrence: { precision: 'year', value: '2020' },
          buyerEmail: null, total: null, privateReference: null, privateNotes: null,
        },
        reason: 'Stale.', idempotencyKey: 'correct-stale', administrator, correctedAt: now,
      }), (error: Error & { code?: string }) => error.code === 'version_conflict');
    } finally {
      fixture.db.close();
    }
  });

  it('returns immutable original facts, latest effective facts, and complete correction history', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const firstAt = '2026-08-10T12:10:00.000Z';
      const secondAt = '2026-08-10T12:20:00.000Z';
      const firstReplacement = {
        reconnectionCaseId: null, occurrence: { precision: 'exact', value: '2019-04-03' },
        buyerEmail: 'first@example.com', total: { amountMinor: 910000, currency: 'USD' },
        privateReference: 'First corrected reference', privateNotes: 'First corrected note.',
      };
      const secondReplacement = {
        reconnectionCaseId: null, occurrence: { precision: 'month', value: '2020-06' },
        buyerEmail: null, total: null,
        privateReference: 'Second corrected reference', privateNotes: 'Second corrected note.',
      };
      const first = await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0, replacement: firstReplacement,
        reason: 'Corrected the studio ledger transcription.', idempotencyKey: 'correction-one',
        administrator, correctedAt: firstAt,
      });
      const second = await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 1, replacement: secondReplacement,
        reason: 'Corrected the later collector confirmation.', idempotencyKey: 'correction-two',
        administrator, correctedAt: secondAt,
      });

      const originalSale = {
        saleId: sale.saleId, reconnectionCaseId: null,
        occurrence: { precision: 'year', value: '2018' },
        buyerEmail: 'collector@example.com', total: { amountMinor: 900000, currency: 'USD' },
        privateReference: 'studio-ledger-2018-4', privateNotes: null,
        recordedAt: '2026-08-10T01:00:00.000Z', sequence: 0,
      };
      const firstFacts = {
        reconnectionCaseId: null, occurrence: firstReplacement.occurrence,
        buyerEmail: firstReplacement.buyerEmail, total: firstReplacement.total,
        privateReference: firstReplacement.privateReference,
        privateNotes: firstReplacement.privateNotes,
        recordedAt: originalSale.recordedAt,
      };
      const secondFacts = {
        reconnectionCaseId: null, occurrence: secondReplacement.occurrence,
        buyerEmail: secondReplacement.buyerEmail, total: secondReplacement.total,
        privateReference: secondReplacement.privateReference,
        privateNotes: secondReplacement.privateNotes,
        recordedAt: originalSale.recordedAt,
      };
      const originalFacts = {
        reconnectionCaseId: originalSale.reconnectionCaseId,
        occurrence: originalSale.occurrence, buyerEmail: originalSale.buyerEmail,
        total: originalSale.total, privateReference: originalSale.privateReference,
        privateNotes: originalSale.privateNotes, recordedAt: originalSale.recordedAt,
      };
      const expectedCorrections = [
        {
          saleEventId: first.saleEventId, sequence: 1,
          reason: 'Corrected the studio ledger transcription.', createdAt: firstAt,
          before: originalFacts, after: firstFacts,
        },
        {
          saleEventId: second.saleEventId, sequence: 2,
          reason: 'Corrected the later collector confirmation.', createdAt: secondAt,
          before: firstFacts, after: secondFacts,
        },
      ];

      const detail = await getArtistSaleDetail(fixture.env, sale.saleId);
      assert.deepEqual(detail.originalSale, originalSale);
      assert.deepEqual(detail.effectiveSale, {
        saleId: sale.saleId, ...secondFacts, sequence: 2,
      });
      assert.deepEqual(detail.sale, detail.effectiveSale);
      assert.deepEqual(detail.corrections, expectedCorrections);
      assert.deepEqual((await getArtistSaleDetail(fixture.env, sale.saleId)).corrections,
        expectedCorrections);
      assert.deepEqual({ ...fixture.db.prepare(`
        SELECT occurrence_precision, occurred_on, buyer_email, currency, total_minor,
               private_reference, private_notes, recorded_at
          FROM artist_verified_sales WHERE id = ?1
      `).get(sale.saleId) }, {
        occurrence_precision: 'year', occurred_on: '2018',
        buyer_email: 'collector@example.com', currency: 'USD', total_minor: 900000,
        private_reference: 'studio-ledger-2018-4', private_notes: null,
        recorded_at: '2026-08-10T01:00:00.000Z',
      });
      assert.doesNotMatch(JSON.stringify(detail),
        /actorUserId|verifiedByUserId|requestDigest|storageReference|sha256/);
    } finally {
      fixture.db.close();
    }
  });

  it('fails closed when correction sequence or before-snapshot continuity is corrupt', async () => {
    let corruption: 'sequence' | 'before' | null = null;
    const fixture = serviceEnvironment({
      overrideAllResults(sql, results) {
        if (!corruption || !sql.includes('FROM artist_verified_sale_events')
          || !sql.includes('before_json')) return results;
        return results.map((row: any, index: number) => index !== 1 ? row : {
          ...row,
          ...(corruption === 'sequence' ? { sequence: 4 } : {
            before_json: JSON.stringify({
              ...JSON.parse(row.before_json), buyerEmail: 'corrupt@example.com',
            }),
          }),
        });
      },
    });
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const firstReplacement = {
        reconnectionCaseId: null, occurrence: { precision: 'year', value: '2019' },
        buyerEmail: 'first@example.com', total: { amountMinor: 910000, currency: 'USD' },
        privateReference: null, privateNotes: null,
      };
      await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 0, replacement: firstReplacement,
        reason: 'First correction.', idempotencyKey: 'integrity-first',
        administrator, correctedAt: '2026-08-10T12:10:00.000Z',
      });
      await correctVerifiedSale(fixture.env, {
        saleId: sale.saleId, expectedSequence: 1,
        replacement: { ...firstReplacement, privateNotes: 'Second correction.' },
        reason: 'Second correction.', idempotencyKey: 'integrity-second',
        administrator, correctedAt: '2026-08-10T12:20:00.000Z',
      });
      for (corruption of ['sequence', 'before'] as const) {
        await assert.rejects(getArtistSaleDetail(fixture.env, sale.saleId),
          (error: Error & { code?: string }) => error.code === 'integrity_error');
      }
    } finally {
      fixture.db.close();
    }
  });

  it('returns deterministic side-effect-free private projections and safe missing failures', async () => {
    const fixture = serviceEnvironment();
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const before = Object.fromEntries([
        'artist_verified_sales', 'artist_verified_sale_events', 'artist_artwork_ledger_entries',
      ].map((table) => [table, count(fixture.db, table)]));
      const first = await listArtistSaleWorkspace(fixture.env, { search: 'collector' });
      const second = await listArtistSaleWorkspace(fixture.env, { search: 'collector' });
      assert.deepEqual(second, first);
      assert.equal(first.sales[0].saleId, sale.saleId);
      assert.deepEqual(Object.fromEntries(Object.keys(before).map((table) => [table, count(fixture.db, table)])), before);
      await assert.rejects(getArtistSaleDetail(fixture.env, 'missing-sale'),
        (error: Error & { code?: string }) => error.code === 'sale_not_found');
    } finally {
      fixture.db.close();
    }
  });

  it('keeps large sale detail and paginated workspace reads within constant query budgets', async () => {
    let queryCount = 0;
    const options = { onQuery: (_sql: string) => { queryCount += 1; } };
    const fixture = serviceEnvironment(options);
    try {
      const maximumArtworks = Array.from({ length: 100 }, () => ({
        artworkRecordId: null, artworkId: null, edition: null, price: null,
      }));
      const largeSale = await createVerifiedSale(fixture.env, saleInput({
        artworks: maximumArtworks, idempotencyKey: 'maximum-size-sale',
      }));
      queryCount = 0;
      const detail = await getArtistSaleDetail(fixture.env, largeSale.saleId);
      assert.equal(detail.items.length, 100);
      assert.ok(queryCount <= 6, `sale detail used ${queryCount} queries`);

      for (let index = 1; index < 55; index += 1) {
        await createVerifiedSale(fixture.env, saleInput({
          artworks: [{ artworkRecordId: null, artworkId: null, edition: null, price: null }],
          idempotencyKey: `workspace-sale-${index}`,
        }));
      }
      for (let index = 0; index < 55; index += 1) {
        await createReconnectionCase(fixture.env, {
          recipientEmail: `collector-${index}@example.com`, recipientName: null,
          privateContext: null, idempotencyKey: `workspace-case-${index}`,
          administrator, createdAt: now,
        });
      }

      queryCount = 0;
      const firstPage = await listArtistSaleWorkspace(fixture.env, { limit: 25, offset: 0 });
      assert.equal(firstPage.sales.length, 25);
      assert.equal(firstPage.reconnectionCases.length, 25);
      assert.deepEqual(firstPage.pagination, {
        limit: 25,
        offset: 0,
        sales: { hasMore: true, nextOffset: 25 },
        reconnectionCases: { hasMore: true, nextOffset: 25 },
      });
      assert.ok(queryCount <= 3, `workspace page used ${queryCount} queries`);

      queryCount = 0;
      const secondPage = await listArtistSaleWorkspace(fixture.env, { limit: 25, offset: 25 });
      assert.equal(new Set([
        ...firstPage.sales.map((sale: any) => sale.saleId),
        ...secondPage.sales.map((sale: any) => sale.saleId),
      ]).size, firstPage.sales.length + secondPage.sales.length);
      assert.ok(queryCount <= 3, `second workspace page used ${queryCount} queries`);
      await assert.rejects(listArtistSaleWorkspace(fixture.env, { limit: 51, offset: 0 }),
        (error: Error & { code?: string }) => error.code === 'invalid_request');
    } finally {
      fixture.db.close();
    }
  });

  it('serializes a real two-administrator identification race without losing its audit', async () => {
    const options: { beforeBatch?: () => Promise<void> } = {};
    const fixture = serviceEnvironment(options);
    try {
      const sale = await createVerifiedSale(fixture.env, saleInput());
      const target = sale.artworkRecordIds[2];
      let arrived = 0;
      let release: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      options.beforeBatch = async () => {
        arrived += 1;
        if (arrived === 2) release?.();
        await gate;
      };
      const outcomes = await Promise.allSettled([
        identifyArtworkRecord(fixture.env, {
          artworkRecordId: target, artworkId: 'UL-100',
          edition: { kind: 'numbered', number: 1, size: 64 }, expectedVersion: 1,
          idempotencyKey: 'identify-race-one', administrator, identifiedAt: now,
        }),
        identifyArtworkRecord(fixture.env, {
          artworkRecordId: target, artworkId: 'UL-101',
          edition: { kind: 'numbered', number: 2, size: 64 }, expectedVersion: 1,
          idempotencyKey: 'identify-race-two',
          administrator: { userId: 'artist-second', email: 'second@example.com' }, identifiedAt: now,
        }),
      ]);
      assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), ['fulfilled', 'rejected']);
      const loser = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;
      assert.equal(loser.reason.code, 'version_conflict');
      assert.equal(fixture.db.prepare(`
        SELECT record_version FROM artist_artwork_records WHERE id = ?1
      `).get(target)?.record_version, 2);
      assert.equal(fixture.db.prepare(`
        SELECT COUNT(*) AS count FROM artist_artwork_record_events WHERE artwork_record_id = ?1
      `).get(target)?.count, 1);
      const audit = fixture.db.prepare(`
        SELECT resulting_version, actor_user_id FROM artist_artwork_record_events
         WHERE artwork_record_id = ?1
      `).get(target);
      assert.equal(audit?.resulting_version, 2);
      assert.ok(['artist-admin', 'artist-second'].includes(String(audit?.actor_user_id)));
    } finally {
      fixture.db.close();
    }
  });
});
