import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { buildLineageEvent } from '../functions/api/_lib/lineage.js';
import {
  assertRecordPublic,
  buildPieceRecord,
  canonicalRecordJson,
  recordEventPayload,
} from '../functions/api/_lib/pieceRecord.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';

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
  '035_artwork_catalog_snapshots.sql', '036_piece_records.sql',
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

const PUBLIC_CODE = 'AR-ABCDEFGH';
const POISON_CODE = 'AR-KLMNPQRS';
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
      ('kp-poison', 'UL-902', 0, 'auth-keeper', '${'b'.repeat(64)}',
       '2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
       '${POISON_CODE}', 'legacy');
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
  const env = { DB: d1(db) };
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

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe('piece record privacy (the strip-pass)', () => {
  it('throws on planted private keys at any depth', () => {
    const plants: Array<Record<string, unknown>> = [
      { email: 'x' },
      { piece: { ownershipCodeVerifier: 'y'.repeat(64) } },
      { deep: { deeper: { birthDate: '1980-01-15' } } },
      { priceUsd: 1200 },
      { amountMinor: 120000 },
      { certificate: { entries: [{ currency: 'USD' }] } },
      { recoveryCode: 'abc' },
      { ownership_code_ciphertext: 'zzz' },
      { nonce: 'n' },
      { keyVersion: 1 },
      { token: 't' },
      { ipAddress: '10.0.0.1' },
      { userAgent: 'Mozilla' },
      { user_agent: 'Mozilla' },
    ];
    for (const plant of plants) {
      assert.throws(
        () => assertRecordPublic(plant),
        /private_piece_record_key/,
        `planted key rejected: ${JSON.stringify(plant)}`,
      );
    }
  });

  it('throws on planted private string values at any depth', () => {
    const plants: Array<Record<string, unknown>> = [
      { note: 'reach me at someone@example.com' },
      { lineage: { events: [{ detail: 'bound by kp-1234' }] } },
      { words: 'see tp-0a1b2c3d-0000-4000-8000-000000000000' },
      { entries: [{ words: 'dream-abc123 was here' }] },
      { entries: [{ words: 'consent-abc123' }] },
      { entries: [{ words: 'auth-user-7 signed in' }] },
      { trail: 'from 192.168.1.10 last night' },
    ];
    for (const plant of plants) {
      assert.throws(
        () => assertRecordPublic(plant),
        /private_piece_record_value/,
        `planted value rejected: ${JSON.stringify(plant)}`,
      );
    }
  });

  it('never allows identity and city to be co-present: city never enters at all', () => {
    assert.throws(() => assertRecordPublic({ city: 'Denpasar' }), /private_piece_record_key/);
    assert.throws(() => assertRecordPublic({ cityId: 'denpasar-id' }), /private_piece_record_key/);
    assert.throws(() => assertRecordPublic({ shareCity: true }), /private_piece_record_key/);
    assert.throws(
      () => assertRecordPublic({ nested: { displayLocation: 'Bali' } }),
      /private_piece_record_key/,
    );
  });

  it('passes the real record shape, including description despite its letters', () => {
    assertRecordPublic({
      schema: 'adrian-piece-record',
      piece: { description: 'A quiet carved piece.', publicCode: PUBLIC_CODE },
      certificate: { makers: [{ name: 'Adrian Rasmussen', role: 'Artist' }] },
      light: { claimCount: 1, claimOrdinal: 47 },
      lineage: { included: true, events: [{ previousHash: null, eventHash: 'a'.repeat(64) }] },
    });
  });

  it('produces a clean record: no forbidden keys, ids, emails, prices, or names', async () => {
    const { env } = await fixtureEnv();
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });

    for (const key of collectKeys(built.record)) {
      assert.doesNotMatch(key, /city|location|birth|price|amount|currency/i);
      assert.doesNotMatch(key, /ownership|recovery|verifier|cipher|nonce|secret|password/i);
    }
    assert.doesNotMatch(built.canonicalJson, /\b(?:kp|tp|dream|consent|auth)-/);
    assert.doesNotMatch(built.canonicalJson, /@/);
    assert.ok(!built.canonicalJson.includes('keeper@example.com'));
    assert.ok(!built.canonicalJson.includes('Quiet Keeper'));
    assert.ok(!built.html.includes('keeper@example.com'));
    assert.ok(!built.html.includes('Quiet Keeper'));
    assert.ok(!built.canonicalJson.includes('a'.repeat(64)), 'no recovery code hash');
  });

  it('hashes deterministically and independently of assembly key order', async () => {
    const { env } = await fixtureEnv();
    const first = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    const second = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    assert.equal(first.recordHash, second.recordHash);
    assert.equal(
      canonicalRecordJson({ b: 1, a: { d: 2, c: 3 } }),
      canonicalRecordJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it('once shone stays shone: a consent flip does not remove shining words', async () => {
    const { db, env } = await fixtureEnv();
    const before = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    assert.equal(before.record.shines.entries.length, 1);

    // The keeper withdraws the share on the live site (fail-safe closure
    // shape permitted by the collector_dreams runtime update guard).
    db.prepare(`
      UPDATE collector_dreams
         SET visibility = 'private',
             public_revoked_at = '2026-08-15T00:00:00.000Z',
             updated_at = '2026-08-15T00:00:00.000Z',
             record_version = record_version + 1
       WHERE id = 'dream-record-1'
    `).run();

    const after = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    assert.equal(after.record.shines.entries.length, 1);
    assert.equal(
      after.record.shines.entries[0].words,
      'May this wood remember our gratitude.',
    );
  });

  it('excludes abuse-managed removals going forward', async () => {
    const { db, env } = await fixtureEnv();
    db.exec(`
      CREATE TABLE collector_shine_removals (
        content_id TEXT PRIMARY KEY,
        keeper_piece_id TEXT NOT NULL,
        removed_at TEXT NOT NULL
      );
      INSERT INTO collector_shine_removals (content_id, keeper_piece_id, removed_at)
      VALUES ('dream-record-1', '${KEEPER_PIECE_ID}', '2026-08-16T00:00:00.000Z');
    `);
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    assert.deepEqual(built.record.shines.entries, []);
  });

  it('never shines anything that has not shone', async () => {
    const { db, env } = await fixtureEnv();
    // A strictly private dream on the second piece: no public_shared_at ever.
    db.exec(`
      INSERT INTO collector_dreams
        (id, keeper_piece_id, author_user_id, body, scope, visibility,
         idempotency_key, record_version, created_at, updated_at)
      VALUES
        ('dream-private-1', 'kp-poison', 'auth-keeper',
         'A private hope, never shared.', 'self', 'private',
         'dream-seed-0002', 1,
         '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z');
    `);
    const built = await buildPieceRecord(env, {
      ...BUILD_OPTIONS, publicCode: POISON_CODE,
    });
    assert.equal(built.record.shines.included, true);
    assert.deepEqual(built.record.shines.entries, []);
    assert.ok(!built.canonicalJson.includes('A private hope'));
  });

  it('fails closed: a poisoned shining body aborts generation entirely', async () => {
    const { db, env } = await fixtureEnv();
    db.exec(`
      INSERT INTO collector_dreams
        (id, keeper_piece_id, author_user_id, body, scope, visibility,
         idempotency_key, record_version, created_at, updated_at, public_shared_at)
      VALUES
        ('dream-poison-1', 'kp-poison', 'auth-keeper',
         'Write to me at leak@example.com about this piece.', 'self', 'anonymous',
         'dream-seed-0003', 1,
         '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z',
         '2026-08-06T00:00:00.000Z');
    `);
    await assert.rejects(
      buildPieceRecord(env, { ...BUILD_OPTIONS, publicCode: POISON_CODE }),
      /private_piece_record_value/,
    );
  });

  it('withholds transfer party pseudonyms from the permanent record', () => {
    assert.deepEqual(
      recordEventPayload({
        fromRef: 'tp-0a1b2c3d-0000-4000-8000-000000000000',
        toRef: 'tp-1a1b2c3d-0000-4000-8000-000000000001',
        transferKind: 'gift',
      }),
      { transferKind: 'gift' },
    );
    assert.deepEqual(
      recordEventPayload({ pieceId: 'UL-901', editionNumber: 1 }),
      { pieceId: 'UL-901', editionNumber: 1 },
    );
  });

  it('embeds the canonical JSON block and a printed hash that match', async () => {
    const { env } = await fixtureEnv();
    const built = await buildPieceRecord(env, { ...BUILD_OPTIONS });
    const match = built.html.match(
      /<script type="application\/json" id="piece-record-canonical">([\s\S]*?)<\/script>/,
    );
    assert.ok(match, 'canonical JSON block present');
    const parsed = JSON.parse(match![1]);
    assert.equal(canonicalRecordJson(parsed), built.canonicalJson);
    const digest = await crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(canonicalRecordJson(parsed)),
    );
    const recomputed = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    assert.equal(recomputed, built.recordHash);
    assert.ok(built.html.includes(`data-record-hash="${built.recordHash}"`));
    assert.ok(built.html.includes(`Record hash ${built.recordHash}`));
  });
});
