import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { buildLineageEvent } from '../functions/api/_lib/lineage.js';
import {
  buildPieceRecord,
  canonicalRecordJson,
  pieceRecordR2Key,
  publishPieceRecord,
  stableRecordShape,
} from '../functions/api/_lib/pieceRecord.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';
import { onRequest as recordsRequest } from '../functions/api/records/[publicCode].js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

const migrationsThroughPieceRecords = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
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
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
  '036_artwork_catalog_snapshots.sql', '037_piece_records.sql',
].map(readMigration).join('\n');

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return { prepare };
}

function r2() {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    async put(key: string, value: string | Uint8Array, options?: {
      onlyIf?: { etagDoesNotMatch?: string };
    }) {
      if (options?.onlyIf?.etagDoesNotMatch === '*' && store.has(key)) return null;
      store.set(
        key,
        typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value),
      );
      return {};
    },
    async get(key: string) {
      const bytes = store.get(key);
      if (!bytes) return null;
      return {
        arrayBuffer: async () => bytes.buffer.slice(
          bytes.byteOffset, bytes.byteOffset + bytes.byteLength,
        ),
        text: async () => new TextDecoder().decode(bytes),
        body: new TextDecoder().decode(bytes),
      };
    },
  };
}

const PUBLIC_CODE = 'AR-ABCDEFGH';
const PLAIN_CODE = 'AR-KLMNPQRS';
const KEEPER_PIECE_ID = 'kp-record';

async function seedRegistry(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES ('auth-keeper', 'Quiet Keeper', 'keeper@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES ('auth-keeper', 'auth-keeper', 'keeper@example.com');
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    SELECT id, '1980-01-15', '12:00', 'Private birthplace', 0, 0, 'UTC', '{}'
      FROM users;
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at, public_code, plate_status)
    VALUES
      ('${KEEPER_PIECE_ID}', 'UL-901', 1, 'auth-keeper', '${'a'.repeat(64)}',
       '2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
       '${PUBLIC_CODE}', 'active'),
      ('kp-plain', 'UL-902', 0, NULL, '${'b'.repeat(64)}',
       NULL, '2026-08-01T00:00:00.000Z', '${PLAIN_CODE}', 'legacy');
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES ('UL-901', 'Earth Record', 'Universal Language', 12, '2026-08-01T00:00:00.000Z');
    INSERT INTO certificate_templates
      (id, name, content_json, version, created_by_user_id, created_by_email,
       created_at, updated_at)
    VALUES ('ct-record', 'Record certificate',
      '{"materials":["Teak"],"origin":"Bali","certificateWording":"Certified by the studio."}',
      1, 'auth-admin', 'admin@example.com',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
    INSERT INTO certificate_assignment_operations
      (idempotency_key, request_digest, template_id, artwork_ids_json,
       assigned_by_user_id, assigned_by_email, assigned_at)
    VALUES ('op-record', '${'c'.repeat(64)}', 'ct-record', '["UL-901"]',
      'auth-admin', 'admin@example.com', '2026-08-01T00:00:00.000Z');
    INSERT INTO certificate_artwork_assignments
      (artwork_id, template_id, assignment_operation_key, version, assigned_at)
    VALUES ('UL-901', 'ct-record', 'op-record', 1, '2026-08-01T00:00:00.000Z');
  `);

  const eventDefinitions = [
    {
      eventType: 'issued',
      eventAt: '2026-08-01T00:00:00.000Z',
      publicPayload: { pieceId: 'UL-901', editionNumber: 1, publicCode: PUBLIC_CODE },
    },
    {
      eventType: 'activated',
      eventAt: '2026-08-02T00:00:00.000Z',
      publicPayload: { plateStatus: 'active' },
    },
    {
      eventType: 'first_bound',
      eventAt: '2026-08-03T00:00:00.000Z',
      publicPayload: {},
    },
  ];
  let previousHash: string | null = null;
  for (let index = 0; index < eventDefinitions.length; index += 1) {
    const event = await buildLineageEvent({
      keeperPieceId: KEEPER_PIECE_ID,
      sequence: index + 1,
      previousHash,
      ...eventDefinitions[index],
    });
    db.prepare(`
      INSERT INTO artwork_lineage_events
        (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
         event_hash, public_payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.keeperPieceId, event.sequence, event.eventType,
      event.eventAt, event.previousHash, event.eventHash, event.publicPayloadJson,
    );
    previousHash = event.eventHash;
  }
  db.prepare(`
    UPDATE keeper_pieces SET lineage_head_hash = ?, lineage_event_count = ?
     WHERE id = ?
  `).run(previousHash, eventDefinitions.length, KEEPER_PIECE_ID);

  db.exec(`
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at, public_shared_at)
    VALUES
      ('dream-record-1', '${KEEPER_PIECE_ID}', 'auth-keeper',
       'May this wood remember our gratitude.', 'family', 'anonymous',
       'dream-seed-0001', 1,
       '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z',
       '2026-08-05T00:00:00.000Z');
  `);
}

async function fixtureEnv() {
  const db = new DatabaseSync(':memory:');
  db.exec(migrationsThroughPieceRecords);
  await seedRegistry(db);
  const env = { DB: d1(db), ARTWORK_REGISTRY_BACKUP: r2() };
  await ensureCatalogSnapshot(env, {
    id: 'UL-901',
    title: 'Earth Record',
    series: 'Universal Language',
    category: 'Multidimensional Art',
    year: '2024',
    dimensions: '24 in diameter',
    material: 'Carved teak',
    description: 'A breathing mandala carved from a single round of teak.',
    editionSize: 12,
  }, { source: 'mockData', createdAt: '2026-08-10T00:00:00.000Z' });
  return { db, env };
}

const BUILD_OPTIONS = {
  publicCode: PUBLIC_CODE,
  trigger: 'on_demand',
  generatedAt: '2026-08-19T00:00:00.000Z',
  includeLegacySections: true,
} as const;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function extractCanonicalBlock(html: string) {
  const match = html.match(
    /<script type="application\/json" id="piece-record-canonical">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, 'record HTML embeds the canonical JSON block');
  return match![1];
}

function extractPrintedHash(html: string) {
  const match = html.match(/data-record-hash="([0-9a-f]{64})"/);
  assert.ok(match, 'record HTML prints the record hash');
  return match![1];
}

describe('piece record format', () => {
  it('round-trips: the embedded JSON re-canonicalizes to the printed hash', async () => {
    const { env } = await fixtureEnv();
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });

    const embedded = extractCanonicalBlock(built.html);
    const parsed = JSON.parse(embedded);
    const recanonicalized = JSON.stringify(stableRecordShape(parsed));
    assert.equal(recanonicalized, built.canonicalJson);
    assert.equal(canonicalRecordJson(parsed), built.canonicalJson);

    const recomputedHash = await sha256Hex(recanonicalized);
    assert.equal(recomputedHash, built.recordHash);
    assert.equal(extractPrintedHash(built.html), built.recordHash);
    assert.ok(built.html.includes(`Record hash ${built.recordHash}`));
    assert.equal(parsed.schema, 'adrian-piece-record');
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.trigger, 'on_demand');
  });

  it('prints the record content: piece, certificate, light, lineage, shines', async () => {
    const { env } = await fixtureEnv();
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });

    assert.equal(built.record.piece.title, 'Earth Record');
    assert.equal(built.record.piece.artist, 'Adrian Rasmussen');
    assert.equal(built.record.piece.editionLabel, 'Edition 1 of 12');
    assert.equal(built.record.piece.year, '2024');
    assert.deepEqual(built.record.piece.materials, ['Carved teak']);
    assert.equal(built.record.certificate?.origin, 'Bali');
    assert.deepEqual(built.record.light, { claimCount: 1, claimOrdinal: 1 });
    assert.equal(built.record.lineage.included, true);
    assert.equal(built.record.lineage.events.length, 3);
    assert.equal(built.record.shines.included, true);
    assert.equal(built.record.shines.entries.length, 1);
    assert.equal(
      built.record.shines.entries[0].words,
      'May this wood remember our gratitude.',
    );

    assert.ok(built.html.includes('Earth Record'));
    assert.ok(built.html.includes('The certificate'));
    assert.ok(built.html.includes('The lineage'));
    assert.ok(built.html.includes('What shines'));
    assert.ok(built.html.includes('How to verify'));
    assert.ok(built.html.includes('Unique work') === false);
  });

  it('lineage links recompute: chain continuity and every event hash', async () => {
    const { env } = await fixtureEnv();
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });

    let previousHash: string | null = null;
    for (let index = 0; index < built.record.lineage.events.length; index += 1) {
      const event = built.record.lineage.events[index];
      assert.equal(event.sequence, index + 1);
      assert.equal(event.previousHash, previousHash);
      assert.match(event.eventHash, /^[0-9a-f]{64}$/);
      // The commitment includes the internal keeper piece id, which the
      // record deliberately does not carry; the test knows it and recomputes.
      const recomputed = await buildLineageEvent({
        keeperPieceId: KEEPER_PIECE_ID,
        sequence: event.sequence,
        eventType: event.eventType,
        eventAt: event.eventAt,
        previousHash: event.previousHash,
        publicPayload: event.publicPayload,
      });
      assert.equal(recomputed.eventHash, event.eventHash);
      previousHash = event.eventHash;
    }
  });

  it('is deterministic: identical input produces byte-identical output', async () => {
    const { env } = await fixtureEnv();
    const first = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    const second = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    assert.equal(first.recordHash, second.recordHash);
    assert.equal(first.canonicalJson, second.canonicalJson);
    assert.equal(first.html, second.html);
  });

  it('reads without JavaScript: sections exist as plain HTML, script is optional', async () => {
    const { env } = await fixtureEnv();
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    const withoutScripts = built.html.replace(/<script[\s\S]*?<\/script>/g, '');
    for (const heading of [
      'The piece', 'The certificate', 'The light', 'The lineage',
      'What shines', 'How to verify',
    ]) {
      assert.ok(withoutScripts.includes(heading), `${heading} survives script removal`);
    }
    assert.ok(withoutScripts.includes(built.recordHash));
    assert.ok(!/https?:\/\//.test(built.html.replace(/mandalacodes/g, '')), 'no external requests');
    assert.ok(!built.html.includes('@import'));
  });

  it('gates lineage and shines on includeLegacySections and plate status', async () => {
    const { env } = await fixtureEnv();
    const gatedOff = await buildPieceRecord(env, {
      ...BUILD_OPTIONS, includeLegacySections: false,
    });
    assert.deepEqual(gatedOff.record.lineage, { included: false });
    assert.deepEqual(gatedOff.record.shines, { included: false });
    assert.ok(gatedOff.html.includes('not yet published'));

    const plain = await buildPieceRecord(env, {
      ...BUILD_OPTIONS, publicCode: PLAIN_CODE,
    });
    // legacy plate status: the lineage endpoint would not serve it, so the
    // record omits the lineage even with the sections switched on.
    assert.deepEqual(plain.record.lineage, { included: false });
    assert.equal(plain.record.shines.included, true);
    assert.deepEqual(plain.record.shines.entries, []);
    assert.equal(plain.record.piece.title, 'UL-902');
    assert.equal(plain.record.piece.editionLabel, 'Unique work');
    assert.equal(plain.record.catalog, null);
    assert.equal(plain.record.certificate, null);
  });

  it('publishes write-once to R2, byte-verifies, and records the row idempotently', async () => {
    const { db, env } = await fixtureEnv();
    const published = await publishPieceRecord(env, { ...BUILD_OPTIONS });
    assert.equal(published.status, 'verified');
    assert.equal(published.r2Key, pieceRecordR2Key(PUBLIC_CODE, published.recordHash));
    assert.equal(
      published.r2Key,
      `records/${PUBLIC_CODE}/${published.recordHash}.html`,
    );

    const storedHtml = new TextDecoder().decode(
      env.ARTWORK_REGISTRY_BACKUP.store.get(published.r2Key)!,
    );
    assert.equal(storedHtml, published.html);
    const storedJson = new TextDecoder().decode(
      env.ARTWORK_REGISTRY_BACKUP.store.get(
        `records/${PUBLIC_CODE}/${published.recordHash}.json`,
      )!,
    );
    assert.equal(await sha256Hex(storedJson), published.recordHash);

    const row = db.prepare(
      'SELECT id, public_code, record_hash, r2_key, trigger_event FROM piece_records',
    ).get() as Record<string, unknown>;
    assert.equal(row.public_code, PUBLIC_CODE);
    assert.equal(row.record_hash, published.recordHash);
    assert.equal(row.r2_key, published.r2Key);
    assert.equal(row.trigger_event, 'on_demand');

    const again = await publishPieceRecord(env, { ...BUILD_OPTIONS });
    assert.equal(again.status, 'verified');
    assert.equal(again.recordHash, published.recordHash);
    const count = db.prepare('SELECT COUNT(*) AS n FROM piece_records').get() as { n: number };
    assert.equal(Number(count.n), 1);
  });

  it('reports failed, and writes no row, when stored bytes cannot be verified', async () => {
    const { db, env } = await fixtureEnv();
    const brokenBucket = {
      async put() { return {}; },
      async get() { return { text: async () => 'tampered', arrayBuffer: async () => new TextEncoder().encode('tampered').buffer } as unknown; },
    };
    const result = await publishPieceRecord(
      { ...env, ARTWORK_REGISTRY_BACKUP: brokenBucket },
      { ...BUILD_OPTIONS },
    );
    assert.equal(result.status, 'failed');
    const count = db.prepare('SELECT COUNT(*) AS n FROM piece_records').get() as { n: number };
    assert.equal(Number(count.n), 0);
  });

  it('migration 037 pins the r2 key and forbids update and delete', async () => {
    const { db, env } = await fixtureEnv();
    assert.throws(() => db.prepare(`
      INSERT INTO piece_records
        (id, public_code, record_hash, r2_key, trigger_event, created_at)
      VALUES ('pr-test', '${PUBLIC_CODE}', '${'d'.repeat(64)}', 'records/elsewhere.html',
        'on_demand', '2026-08-19T00:00:00.000Z')
    `).run(), /piece_record_r2_key_address_mismatch/);

    await publishPieceRecord(env, { ...BUILD_OPTIONS });
    assert.throws(
      () => db.prepare("UPDATE piece_records SET trigger_event = 'yearly'").run(),
      /append-only/,
    );
    assert.throws(
      () => db.prepare('DELETE FROM piece_records').run(),
      /append-only/,
    );
  });

  it('migration 035 snapshots are idempotent and append-only', async () => {
    const { db, env } = await fixtureEnv();
    const artwork = {
      id: 'UL-903', title: 'Second Record', category: 'Multidimensional Art',
      year: '2025', material: 'Teak', description: 'A quiet second piece.',
    };
    const first = await ensureCatalogSnapshot(env, artwork, {
      source: 'admin', createdAt: '2026-08-11T00:00:00.000Z',
    });
    assert.equal(first.inserted, true);
    const replay = await ensureCatalogSnapshot(env, artwork, {
      source: 'admin', createdAt: '2026-08-12T00:00:00.000Z',
    });
    assert.equal(replay.inserted, false);
    assert.equal(replay.snapshotHash, first.snapshotHash);
    const count = db.prepare(
      "SELECT COUNT(*) AS n FROM artwork_catalog_snapshots WHERE artwork_id = 'UL-903'",
    ).get() as { n: number };
    assert.equal(Number(count.n), 1);
    assert.throws(
      () => db.prepare("UPDATE artwork_catalog_snapshots SET source = 'admin'").run(),
      /append-only/,
    );
    assert.throws(
      () => db.prepare('DELETE FROM artwork_catalog_snapshots').run(),
      /append-only/,
    );
  });

  it('GET /api/records/:publicCode serves the newest record immutably', async () => {
    const { env } = await fixtureEnv();
    const published = await publishPieceRecord(env, { ...BUILD_OPTIONS });

    const response = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`),
      env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.equal(
      response.headers.get('Cache-Control'),
      'public, max-age=31536000, immutable',
    );
    assert.equal(response.headers.get('ETag'), `"${published.recordHash}"`);
    assert.equal(await response.text(), published.html);

    const missing = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PLAIN_CODE}`),
      env,
      params: { publicCode: PLAIN_CODE },
    });
    assert.equal(missing.status, 404);

    const invalid = await recordsRequest({
      request: new Request('https://example.com/api/records/AR-lowercase'),
      env,
      params: { publicCode: 'AR-lowercase' },
    });
    assert.equal(invalid.status, 404);

    const wrongMethod = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`, { method: 'POST' }),
      env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(wrongMethod.status, 405);
  });
});
