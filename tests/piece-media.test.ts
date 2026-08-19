import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  admitPieceMedia,
  listPieceMedia,
  mediaRelativePath,
  removePieceMedia,
} from '../functions/api/_lib/pieceMedia.js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

// Real migrations 001 through 038 (037 is reserved by a different, unrelated
// feature and does not exist yet; it is skipped here on purpose).
const migrationsThroughPieceMedia = [
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
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
  '035_artwork_catalog_snapshots.sql', '036_piece_records.sql',
  '038_piece_media.sql',
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

const KEEPER_PIECE_ID = 'kp-media-one';
const ARTWORK_ID = 'UL-901';
const now = '2026-08-19T00:00:00.000Z';

function seedDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(migrationsThroughPieceMedia);
  database.exec(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, registered_at)
    VALUES
      ('${KEEPER_PIECE_ID}', '${ARTWORK_ID}', 1, '${'a'.repeat(64)}', '${now}');
  `);
  return database;
}

/** Minimal in-memory R2 mock: etag-CAS put/get/head, in the spirit of the
 * house fake bucket in tests/artist-sales.test.ts, trimmed to what
 * pieceMedia.js actually exercises (no streaming request bodies). */
function memoryBucket() {
  const store = new Map<string, {
    bytes: Uint8Array;
    etag: string;
    httpMetadata?: Record<string, string>;
    customMetadata?: Record<string, string>;
  }>();
  let counter = 0;

  function descriptor(key: string, entry: typeof store extends Map<string, infer V> ? V : never, withBody: boolean) {
    const result: Record<string, unknown> = {
      key,
      etag: entry.etag,
      size: entry.bytes.byteLength,
      httpMetadata: entry.httpMetadata,
      customMetadata: entry.customMetadata,
    };
    if (withBody) {
      const bytes = entry.bytes;
      result.body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice());
          controller.close();
        },
      });
    }
    return result;
  }

  return {
    store,
    async put(key: string, value: Uint8Array, options: {
      onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string };
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    } = {}) {
      const existing = store.get(key);
      const onlyIf = options.onlyIf;
      if (onlyIf?.etagDoesNotMatch === '*' && existing) return null;
      if (onlyIf?.etagMatches !== undefined
        && (!existing || existing.etag !== onlyIf.etagMatches)) return null;
      counter += 1;
      const bytes = value instanceof Uint8Array ? value.slice() : new Uint8Array(value as ArrayBuffer);
      const entry = {
        bytes,
        etag: `etag-${counter}`,
        httpMetadata: options.httpMetadata,
        customMetadata: options.customMetadata,
      };
      store.set(key, entry);
      return descriptor(key, entry, false);
    },
    async get(key: string) {
      const entry = store.get(key);
      return entry ? descriptor(key, entry, true) : null;
    },
    async head(key: string) {
      const entry = store.get(key);
      return entry ? descriptor(key, entry, false) : null;
    },
  };
}

function textBytes(text: string) {
  return new TextEncoder().encode(text);
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fixtureEnv() {
  const database = seedDatabase();
  const bucket = memoryBucket();
  const db = d1(database);
  const env = { ARTWORK_REGISTRY_BACKUP: bucket };
  return { database, bucket, db, env };
}

describe('piece media admission (migration 038)', () => {
  it('admits a photo: writes the R2 object, byte-verifies it, and inserts the row', async () => {
    const { database, bucket, db, env } = fixtureEnv();
    const bytes = textBytes('a small jpeg-shaped payload');
    const expectedSha = await sha256Hex(bytes);

    const row = await admitPieceMedia(env, db, {
      artworkId: ARTWORK_ID, kind: 'photo', contentType: 'image/jpeg', bytes,
    });

    assert.equal(row.artworkId, ARTWORK_ID);
    assert.equal(row.keeperPieceId, null);
    assert.equal(row.kind, 'photo');
    assert.equal(row.contentType, 'image/jpeg');
    assert.equal(row.sha256, expectedSha);
    assert.equal(row.byteLength, bytes.byteLength);
    assert.equal(row.storageReference, `media/${expectedSha}.jpg`);
    assert.equal(row.removedAt, null);
    assert.equal(mediaRelativePath(row), `../media/${expectedSha}.jpg`);

    const stored = bucket.store.get(`media/${expectedSha}.jpg`);
    assert.ok(stored, 'R2 object written');
    assert.deepEqual([...stored!.bytes], [...bytes]);
    assert.equal(stored!.httpMetadata?.contentType, 'image/jpeg');

    const dbRow = database.prepare('SELECT * FROM piece_media WHERE id = ?').get(row.id);
    assert.ok(dbRow, 'D1 row inserted');
    assert.equal((dbRow as any).sha256, expectedSha);

    // The admission lease is released, not left dangling.
    const lease = await bucket.head('media/_private/upload-admission');
    assert.equal((lease as any)?.customMetadata?.state, 'released');
  });

  it('admits a keeper-piece-scoped video', async () => {
    const { db, env } = fixtureEnv();
    const bytes = textBytes('a short forever-video payload');
    const row = await admitPieceMedia(env, db, {
      keeperPieceId: KEEPER_PIECE_ID, kind: 'video', contentType: 'video/mp4', bytes,
    });
    assert.equal(row.keeperPieceId, KEEPER_PIECE_ID);
    assert.equal(row.artworkId, null);
    assert.equal(row.kind, 'video');
    assert.ok(row.storageReference.endsWith('.mp4'));
  });

  it('duplicate admit of identical bytes is idempotent: one row, one R2 object', async () => {
    const { database, bucket, db, env } = fixtureEnv();
    const bytes = textBytes('identical content, admitted twice');
    const input = { artworkId: ARTWORK_ID, kind: 'photo' as const, contentType: 'image/jpeg' as const, bytes };

    const first = await admitPieceMedia(env, db, input);
    const second = await admitPieceMedia(env, db, input);

    assert.equal(first.id, second.id);
    assert.equal(first.sha256, second.sha256);
    const mediaKeys = [...bucket.store.keys()].filter((key) => key.startsWith('media/') && key !== 'media/_private/upload-admission');
    assert.deepEqual(mediaKeys, [`media/${first.sha256}.jpg`], 'no duplicate object written');

    const count = database.prepare('SELECT COUNT(*) AS n FROM piece_media WHERE sha256 = ?')
      .get(first.sha256) as { n: number };
    assert.equal(count.n, 1);
  });

  it('rejects an oversize video before ever touching R2', async () => {
    const { bucket, db, env } = fixtureEnv();
    const oversize = new Uint8Array(200 * 1024 * 1024 + 1);
    await assert.rejects(
      admitPieceMedia(env, db, {
        artworkId: ARTWORK_ID, kind: 'video', contentType: 'video/mp4', bytes: oversize,
      }),
      /invalid_piece_media_size/,
    );
    assert.equal(bucket.store.size, 0, 'rejected before any R2 write');
  });

  it('rejects a content type that does not belong to the declared kind', async () => {
    const { db, env } = fixtureEnv();
    await assert.rejects(
      admitPieceMedia(env, db, {
        artworkId: ARTWORK_ID, kind: 'photo', contentType: 'video/mp4', bytes: textBytes('x'),
      }),
      /invalid_piece_media_content_type/,
    );
  });

  it('exactly-one-parent CHECK is enforced by the schema itself', () => {
    const database = seedDatabase();
    const insert = database.prepare(`
      INSERT INTO piece_media
        (id, keeper_piece_id, artwork_id, kind, storage_reference, sha256,
         byte_length, content_type, created_at)
      VALUES (?, ?, ?, 'photo', ?, ?, 10, 'image/jpeg', ?)
    `);
    const sha = 'b'.repeat(64);

    // Neither parent set.
    assert.throws(() => insert.run(
      'pm-neither', null, null, `media/${sha}.jpg`, sha, now,
    ), /CHECK constraint failed/);

    // Both parents set.
    assert.throws(() => insert.run(
      'pm-both', KEEPER_PIECE_ID, ARTWORK_ID, `media/${sha}.jpg`, sha, now,
    ), /CHECK constraint failed/);
  });

  it('the storage_reference address-pin trigger fires on a hand-crafted bad insert', () => {
    const database = seedDatabase();
    const sha = 'c'.repeat(64);
    assert.throws(() => database.prepare(`
      INSERT INTO piece_media
        (id, keeper_piece_id, artwork_id, kind, storage_reference, sha256,
         byte_length, content_type, created_at)
      VALUES (?, NULL, ?, 'photo', 'media/wrong-address.jpg', ?, 10, 'image/jpeg', ?)
    `).run('pm-badref', ARTWORK_ID, sha, now), /piece_media_storage_reference_address_mismatch/);
  });

  it('DELETE is forbidden, permanently', async () => {
    const { database, db, env } = fixtureEnv();
    const row = await admitPieceMedia(env, db, {
      artworkId: ARTWORK_ID, kind: 'photo', contentType: 'image/png', bytes: textBytes('delete me not'),
    });
    assert.throws(
      () => database.prepare('DELETE FROM piece_media WHERE id = ?').run(row.id),
      /piece media is permanent/,
    );
  });

  it('UPDATE of sha256 (or any identity column) is forbidden', async () => {
    const { database, db, env } = fixtureEnv();
    const row = await admitPieceMedia(env, db, {
      artworkId: ARTWORK_ID, kind: 'photo', contentType: 'image/webp', bytes: textBytes('immutable content hash'),
    });
    assert.throws(
      () => database.prepare('UPDATE piece_media SET sha256 = ? WHERE id = ?')
        .run('d'.repeat(64), row.id),
      /piece_media_update_must_be_a_first_soft_removal/,
    );
  });

  it('soft removal works exactly once and can never be cleared', async () => {
    const { database, db, env } = fixtureEnv();
    const row = await admitPieceMedia(env, db, {
      artworkId: ARTWORK_ID, kind: 'artist_message_audio', contentType: 'audio/mpeg',
      bytes: textBytes('a short spoken message'),
    });

    const removed = await removePieceMedia(db, {
      id: row.id, reason: 'reported as someone else’s likeness', removedAt: now,
    });
    assert.equal(removed.removedAt, now);
    assert.equal(removed.removedReason, 'reported as someone else’s likeness');

    // A second soft-removal call finds nothing left to change.
    await assert.rejects(
      removePieceMedia(db, { id: row.id, reason: 'again', removedAt: now }),
      /piece_media_removal_failed/,
    );

    // Direct attempts to clear the removal are rejected by the trigger too.
    assert.throws(
      () => database.prepare('UPDATE piece_media SET removed_at = NULL, removed_reason = NULL WHERE id = ?')
        .run(row.id),
      /piece_media_update_must_be_a_first_soft_removal/,
    );
  });

  it('listPieceMedia returns only active rows, excluding removed ones', async () => {
    const { db, env } = fixtureEnv();
    const kept = await admitPieceMedia(env, db, {
      artworkId: ARTWORK_ID, kind: 'photo', contentType: 'image/jpeg', bytes: textBytes('kept photo'),
    });
    const removed = await admitPieceMedia(env, db, {
      artworkId: ARTWORK_ID, kind: 'photo', contentType: 'image/jpeg', bytes: textBytes('removed photo'),
    });
    await removePieceMedia(db, { id: removed.id, reason: 'abuse', removedAt: now });

    const active = await listPieceMedia(db, { artworkId: ARTWORK_ID });
    assert.deepEqual(active.map((item) => item.id), [kept.id]);
  });
});
