import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import { findResetDamagedArtwork } from '../scripts/preflight-ownership-foundation.ts';

const readMigration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const migrationsBeforeOwnershipFoundation = [
  '001_init.sql',
  '003_atlas_legacy.sql',
  '006_better_auth.sql',
  '008_living_legacy.sql',
  '009_keeper_register.sql',
  '010_artwork_plate_identity.sql',
  '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql',
  '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql',
  '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql',
  '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql',
  '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql',
  '023_collector_registry_merge.sql',
].map(readMigration).join('\n');

describe('ownership foundation preflight', () => {
  it('finds only unclaimed artwork with prior keeper or first-bind evidence', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec(`
        CREATE TABLE keeper_pieces (
          id TEXT PRIMARY KEY, public_code TEXT, keeper_user_id TEXT, claimed_at TEXT
        );
        CREATE TABLE artwork_lineage_events (
          id TEXT PRIMARY KEY, keeper_piece_id TEXT, event_type TEXT
        );
        CREATE TABLE registry_maintenance_events (
          id TEXT PRIMARY KEY, keeper_piece_id TEXT, before_json TEXT, after_json TEXT
        );
        INSERT INTO keeper_pieces VALUES
          ('clean-new', 'AR-ABCDEFGH', NULL, NULL),
          ('clean-held', 'AR-BCDEFGHJ', 'keeper-current', '2026-08-01T00:00:00.000Z'),
          ('damaged-lineage', 'AR-CDEFGHJK', NULL, NULL),
          ('damaged-history', 'AR-DEFGHJKM', NULL, NULL),
          ('damaged-claimed-only', 'AR-EFGHJKMN', NULL, '2026-08-01T00:00:00.000Z'),
          ('damaged-keeper-only', 'AR-FGHJKMNP', 'keeper-stranded', NULL);
        INSERT INTO artwork_lineage_events VALUES
          ('lineage-first', 'damaged-lineage', 'first_bound');
        INSERT INTO registry_maintenance_events VALUES
          ('maintenance-prior', 'damaged-history',
           '{"keeperUserId":"keeper-prior"}', '{"keeperUserId":null}');
      `);

      assert.deepEqual(findResetDamagedArtwork(database), [
        { keeperPieceId: 'damaged-claimed-only', publicCode: 'AR-EFGHJKMN' },
        { keeperPieceId: 'damaged-history', publicCode: 'AR-DEFGHJKM' },
        { keeperPieceId: 'damaged-keeper-only', publicCode: 'AR-FGHJKMNP' },
        { keeperPieceId: 'damaged-lineage', publicCode: 'AR-CDEFGHJK' },
      ]);
    } finally {
      database.close();
    }
  });

  it('makes migration 024 abort before schema changes when reset damage exists', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec(`PRAGMA foreign_keys = ON;\n${migrationsBeforeOwnershipFoundation}`);
      database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code,
           plate_status, registered_at)
        VALUES
          ('damaged-reset', 'UL-100', 0, '${'a'.repeat(64)}', 'AR-ABCDEFGH',
           'active', '2026-08-01T00:00:00.000Z');
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES
          ('lineage-first-bound', 'damaged-reset', 1, 'first_bound',
           '2026-08-01T00:00:00.000Z', NULL, '${'b'.repeat(64)}', '{}');
      `);

      assert.throws(
        () => database.exec(readMigration('024_ownership_foundation.sql')),
        /ownership_foundation_preflight_failed/i,
      );
      assert.equal(database.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'artwork_claim_requests'",
      ).get()?.count, 0);
    } finally {
      database.close();
    }
  });

  it('requires a lowercase SHA-256 target-email commitment on every transfer intent', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec(`PRAGMA foreign_keys = ON;\n${migrationsBeforeOwnershipFoundation}\n${
        readMigration('024_ownership_foundation.sql')
      }`);
      const column = database.prepare(
        "SELECT name, type, \"notnull\" AS required FROM pragma_table_info('artwork_transfer_intents') WHERE name = 'target_email_commitment'",
      ).get();
      assert.deepEqual({ ...column }, {
        name: 'target_email_commitment',
        type: 'TEXT',
        required: 1,
      });
    } finally {
      database.close();
    }
  });
});
