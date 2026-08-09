import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { FULL_ARCHIVE } from '../data/mockData.ts';
import {
  applyCatalogMembership,
  planCatalogMembership,
} from '../functions/api/_lib/registryMembership.js';

const migrationNames = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql', '022_registry_fulfillment_detachment.sql',
  '023_collector_registry_merge.sql', '024_ownership_foundation.sql',
  '025_artwork_registration.sql',
];

function membershipEnvironment() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of migrationNames) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  const writes: string[] = [];
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          writes.push(sql);
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      database.exec('BEGIN IMMEDIATE;');
      try {
        const results = statements.map((statement) => {
          writes.push(statement.sql);
          const result = database.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        database.exec('COMMIT;');
        return results;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
  return { database, env: { DB }, writes };
}

describe('catalog registry membership seed', () => {
  it('plans all 173 artworks deterministically without minting or writing', async () => {
    const { database, env, writes } = membershipEnvironment();
    try {
      const first = await planCatalogMembership(env, FULL_ARCHIVE);
      const second = await planCatalogMembership(env, [...FULL_ARCHIVE].reverse());

      assert.equal(first.catalogCount, 173);
      assert.equal(first.inserts.length, 173);
      assert.deepEqual(first, second);
      assert.deepEqual(first.inserts.map((row) => row.artworkId),
        [...first.inserts.map((row) => row.artworkId)].sort());
      assert.deepEqual(first.unchanged, []);
      assert.deepEqual(first.conflicts, []);
      assert.equal(writes.length, 0);
      assert.equal(database.prepare('SELECT count(*) AS count FROM registry_catalog_membership').get()?.count, 0);
      assert.equal(database.prepare('SELECT count(*) AS count FROM keeper_pieces').get()?.count, 0);
      assert.equal(database.prepare('SELECT count(*) AS count FROM artwork_lineage_events').get()?.count, 0);
    } finally {
      database.close();
    }
  });

  it('applies idempotently while preserving the existing keeper identity and lineage', async () => {
    const { database, env } = membershipEnvironment();
    try {
      database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code,
           plate_status, registered_at)
        VALUES
          ('kp-live', 'UL-100', 0, 'live-code-hash', 'AR-7KQ9M2WX',
           'active', '2026-08-09T00:00:00.000Z');
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES
          ('lineage-live', 'kp-live', 1, 'issued', '2026-08-09T00:00:00.000Z',
           NULL, '${'a'.repeat(64)}', '{}');
        UPDATE keeper_pieces SET lineage_event_count = 1,
          lineage_head_hash = '${'a'.repeat(64)}' WHERE id = 'kp-live';
      `);
      const keeperBefore = database.prepare(
        "SELECT * FROM keeper_pieces WHERE id = 'kp-live'",
      ).get();
      const lineageBefore = database.prepare(
        "SELECT * FROM artwork_lineage_events WHERE id = 'lineage-live'",
      ).get();

      const plan = await planCatalogMembership(env, FULL_ARCHIVE);
      assert.deepEqual(await applyCatalogMembership(env, plan), {
        inserted: 173, unchanged: 0, conflicts: 0,
      });
      const replayPlan = await planCatalogMembership(env, FULL_ARCHIVE);
      assert.equal(replayPlan.inserts.length, 0);
      assert.equal(replayPlan.unchanged.length, 173);
      assert.deepEqual(await applyCatalogMembership(env, replayPlan), {
        inserted: 0, unchanged: 173, conflicts: 0,
      });

      assert.deepEqual(database.prepare(
        "SELECT * FROM keeper_pieces WHERE id = 'kp-live'",
      ).get(), keeperBefore);
      assert.deepEqual(database.prepare(
        "SELECT * FROM artwork_lineage_events WHERE id = 'lineage-live'",
      ).get(), lineageBefore);
      assert.equal(database.prepare(
        'SELECT count(*) AS count FROM registry_catalog_membership',
      ).get()?.count, 173);
    } finally {
      database.close();
    }
  });

  it('reports divergent membership and refuses every write', async () => {
    const { database, env, writes } = membershipEnvironment();
    try {
      database.prepare(`
        INSERT INTO registry_catalog_membership
          (artwork_id, series, category, catalog_digest, first_seeded_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `).run(
        'UL-100', 'Wrong Series', 'Multidimensional Art', 'b'.repeat(64),
        '2026-08-09T00:00:00.000Z',
      );
      writes.length = 0;
      const plan = await planCatalogMembership(env, FULL_ARCHIVE);
      assert.equal(plan.conflicts.length, 1);
      assert.deepEqual(plan.conflicts[0], {
        artworkId: 'UL-100', reason: 'catalog_digest_mismatch',
      });
      await assert.rejects(
        applyCatalogMembership(env, plan),
        (error: Error & { code?: string }) => error.code === 'catalog_membership_conflict',
      );
      assert.equal(writes.length, 0);
      assert.equal(database.prepare(
        'SELECT count(*) AS count FROM registry_catalog_membership',
      ).get()?.count, 1);
    } finally {
      database.close();
    }
  });

  it('does not report success when a membership insert is unconfirmed', async () => {
    const prepared = {
      bind() { return prepared; },
    };
    const env = {
      DB: {
        prepare() { return prepared; },
        async batch() { return [{ success: false, meta: { changes: 0 } }]; },
      },
    };

    await assert.rejects(
      applyCatalogMembership(env, {
        inserts: [{
          artworkId: 'UL-100',
          series: 'Universal Language',
          category: 'Multidimensional Art',
        }],
        unchanged: [],
        conflicts: [],
      }),
      (error: Error & { code?: string }) => error.code === 'catalog_membership_write_failed',
    );
  });

  it('keeps the command dry-run by default and requires --write to apply', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'registry-membership-'));
    const databasePath = path.join(directory, 'registry.sqlite');
    try {
      const database = new DatabaseSync(databasePath);
      database.exec('PRAGMA foreign_keys = ON;');
      for (const name of migrationNames) {
        database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
      }
      database.close();

      const script = path.resolve('scripts/seed-registry-membership.ts');
      const dryRun = spawnSync(
        process.execPath,
        ['--import', 'tsx', script, databasePath],
        { encoding: 'utf8' },
      );
      assert.equal(dryRun.status, 0, dryRun.stderr);
      assert.deepEqual(JSON.parse(dryRun.stdout), {
        ok: true, mode: 'dry-run', catalogCount: 173,
        inserts: 173, unchanged: 0, conflicts: 0,
      });
      const afterDryRun = new DatabaseSync(databasePath, { readOnly: true });
      assert.equal(afterDryRun.prepare(
        'SELECT count(*) AS count FROM registry_catalog_membership',
      ).get()?.count, 0);
      afterDryRun.close();

      const write = spawnSync(
        process.execPath,
        ['--import', 'tsx', script, databasePath, '--write'],
        { encoding: 'utf8' },
      );
      assert.equal(write.status, 0, write.stderr);
      assert.deepEqual(JSON.parse(write.stdout), {
        ok: true, mode: 'write', inserted: 173, unchanged: 0, conflicts: 0,
      });
      const afterWrite = new DatabaseSync(databasePath, { readOnly: true });
      assert.equal(afterWrite.prepare(
        'SELECT count(*) AS count FROM registry_catalog_membership',
      ).get()?.count, 173);
      assert.equal(afterWrite.prepare('SELECT count(*) AS count FROM keeper_pieces').get()?.count, 0);
      afterWrite.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
