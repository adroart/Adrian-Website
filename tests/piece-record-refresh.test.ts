// Tests for the shared refresh helper alone (functions/api/_lib/pieceRecordRefresh.js),
// isolated from any of the four trigger call sites. tests/piece-record-triggers.test.ts
// covers the wiring; this file covers the helper's own contract: it never throws,
// its idempotency comparison ignores generatedAt/trigger, and it resolves a
// publicCode from a keeperPieceId when one is not given directly.
//
// Run note: `node --import tsx --test tests/piece-record-refresh.test.ts`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { refreshPieceRecord } from '../functions/api/_lib/pieceRecordRefresh.js';
import { publishPieceRecord } from '../functions/api/_lib/pieceRecord.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

// Same set as tests/record-archive.test.ts: everything the generator and the
// refresh helper's compare/publish path touch.
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

/** Write-once fake R2 matching the slice of the API the record code uses. */
function fakeBucket() {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    failPut: false,
    async get(key: string) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return {
        arrayBuffer: async () => bytes.slice().buffer,
        text: async () => new TextDecoder().decode(bytes),
      };
    },
    async put(key: string, value: Uint8Array | string, options?: {
      onlyIf?: { etagDoesNotMatch?: string };
    }) {
      if (this.failPut) throw new Error('R2 down');
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      objects.set(
        key,
        value instanceof Uint8Array ? value.slice() : new TextEncoder().encode(String(value)),
      );
      return {};
    },
  };
}

const PUBLIC_CODE = 'AR-ABCDEFGH';
const KEEPER_PIECE_ID = 'kp-refresh-one';

async function fixtureEnv() {
  const database = new DatabaseSync(':memory:');
  database.exec(migrationsThroughPieceRecords);
  database.exec(`
    PRAGMA foreign_keys = ON;
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, registered_at,
       public_code, plate_status)
    VALUES
      ('${KEEPER_PIECE_ID}', 'UL-901', 0, '${'a'.repeat(64)}',
       '2026-08-01T00:00:00.000Z', '${PUBLIC_CODE}', 'active');
  `);
  const env = {
    DB: d1(database),
    ARTWORK_REGISTRY_BACKUP: fakeBucket(),
  };
  await ensureCatalogSnapshot(env, {
    id: 'UL-901', title: 'Earth Refresh', series: 'Universal Language',
    category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
    description: 'The refresh helper fixture piece.',
  }, { source: 'mockData', createdAt: '2026-08-10T00:00:00.000Z' });
  return { database, env };
}

describe('refreshPieceRecord (shared build/compare/publish helper)', () => {
  it('reports unchanged when only generatedAt differs across two calls (the shine-removals bug)', async () => {
    const { env } = await fixtureEnv();
    const first = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'registration', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(first.status, 'generated');
    assert.match(first.recordHash!, /^[0-9a-f]{64}$/);

    // A second call at a LATER timestamp, with nothing about the piece's
    // content having changed. Naive comparison (previous.record_hash ===
    // built.recordHash) would almost never match here, because generatedAt
    // sits inside the hashed record -- that was the shine-removals bug this
    // helper fixes by falling back to a substantive comparison that holds
    // generatedAt and trigger constant.
    const second = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'on_demand', generatedAt: '2026-08-16T00:00:00.000Z',
    });
    assert.equal(second.status, 'unchanged');
    assert.equal(second.recordHash, first.recordHash);
  });

  it('reports generated when the underlying content actually changes', async () => {
    const { env } = await fixtureEnv();
    const first = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'registration', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(first.status, 'generated');

    await ensureCatalogSnapshot(env, {
      id: 'UL-901', title: 'Earth Refresh, renamed', series: 'Universal Language',
      category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
      description: 'The refresh helper fixture piece.',
    }, { source: 'admin', createdAt: '2026-08-17T00:00:00.000Z' });

    const second = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'on_demand', generatedAt: '2026-08-18T00:00:00.000Z',
    });
    assert.equal(second.status, 'generated');
    assert.notEqual(second.recordHash, first.recordHash);
  });

  it('never throws: a storage failure becomes a failed outcome', async () => {
    const { env } = await fixtureEnv();
    (env.ARTWORK_REGISTRY_BACKUP as ReturnType<typeof fakeBucket>).failPut = true;
    const outcome = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'registration', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.error, 'record_storage_failed');
    assert.equal(outcome.publicCode, PUBLIC_CODE);

    // Also never throws on a piece that plainly does not exist.
    const missing = await refreshPieceRecord(env, {
      publicCode: 'AR-99999999', trigger: 'on_demand', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(missing.status, 'failed');
    assert.equal(missing.error, 'piece_not_found');

    // And never throws when there is nothing to resolve at all.
    const nothing = await refreshPieceRecord(env, {
      trigger: 'on_demand', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(nothing.status, 'skipped');
  });

  it('resolves publicCode from keeperPieceId when publicCode is not given', async () => {
    const { env } = await fixtureEnv();
    const outcome = await refreshPieceRecord(env, {
      keeperPieceId: KEEPER_PIECE_ID, trigger: 'registration', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(outcome.status, 'generated');
    assert.equal(outcome.publicCode, PUBLIC_CODE);

    // A keeperPieceId that resolves to no public_code at all is 'skipped',
    // never a thrown error (a piece not yet registered has nothing to build).
    const { database } = await fixtureEnv();
    database.exec(`
      INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash, registered_at)
      VALUES ('kp-unregistered', 'UL-902', 0, '${'b'.repeat(64)}', '2026-08-01T00:00:00.000Z');
    `);
    const unregisteredEnv = { DB: d1(database), ARTWORK_REGISTRY_BACKUP: fakeBucket() };
    const unregistered = await refreshPieceRecord(unregisteredEnv, {
      keeperPieceId: 'kp-unregistered', trigger: 'on_demand', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(unregistered.status, 'skipped');
    assert.equal(unregistered.publicCode, null);
  });

  it('never throws when the underlying table is missing (a migration not yet applied)', async () => {
    const { database, env } = await fixtureEnv();
    database.exec('DROP TABLE piece_records;');
    const outcome = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'on_demand', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.error, 'migration_not_applied');
  });

  it('idempotency matches admin/records/rebuild.js exactly: publishPieceRecord and refreshPieceRecord agree', async () => {
    const { env } = await fixtureEnv();
    const direct = await publishPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'registration', generatedAt: '2026-08-15T00:00:00.000Z',
    });
    assert.equal(direct.status, 'verified');

    const viaHelper = await refreshPieceRecord(env, {
      publicCode: PUBLIC_CODE, trigger: 'on_demand', generatedAt: '2026-08-20T00:00:00.000Z',
    });
    assert.equal(viaHelper.status, 'unchanged');
    assert.equal(viaHelper.recordHash, direct.recordHash);
  });
});
