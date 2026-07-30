import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

const migrationNames = [
  '001_init.sql',
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
];
const migrationPath = new URL('../migrations/018_registry_plate_lifecycle.sql', import.meta.url);
const baseMigrations = migrationNames
  .map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
  .join('\n');

function openDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  return database;
}

function seedDependentRegistry(database: DatabaseSync) {
  database.exec(`${baseMigrations}
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
       plate_status, plate_generated_at, plate_activated_at, registered_at,
       lineage_head_hash, lineage_event_count)
    VALUES
      ('kp-old', 'UL-100', 2, 'hash-old', 'AR-7KQ9M2WX', 'issue-old',
       'active', '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z',
       '2026-07-01T00:00:00.000Z', 'lineage-hash', 1);
    INSERT INTO orders
      (id, stripe_session_id, email, status, amount_total, currency)
    VALUES (1, 'session-lifecycle', 'private@example.com', 'paid', 100, 'usd');
    INSERT INTO order_items
      (id, order_id, product_id, quantity, amount_subtotal)
    VALUES (1, 1, 'artwork', 1, 100);
    INSERT INTO ownership_code_audit
      (id, keeper_piece_id, action, request_id, outcome, created_at)
    VALUES ('audit-1', 'kp-old', 'reveal', 'request-1', 'succeeded', '2026-07-03');
    INSERT INTO piece_fulfillments
      (id, keeper_piece_id, order_item_id, assignment_type,
       intended_recipient_reference, assigned_at)
    VALUES ('fulfillment-1', 'kp-old', 1, 'stripe_order', 'order-1', '2026-07-03');
    INSERT INTO artwork_claim_evidence
      (id, keeper_piece_id, actor_user_id, verified_email, outcome, created_at)
    VALUES ('claim-1', 'kp-old', 'user-1', 'private@example.com', 'accepted', '2026-07-03');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES ('lineage-1', 'kp-old', 1, 'issued', '2026-07-01', NULL,
            'lineage-hash', '{"pieceId":"UL-100","editionNumber":2,"publicCode":"AR-7KQ9M2WX"}');
    INSERT INTO artwork_acquisitions
      (id, keeper_piece_id, acquisition_type, created_at, updated_at)
    VALUES ('acq-1', 'kp-old', 'retained', '2026-07-03', '2026-07-03');
    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json, after_json,
       outcome, mutation_fingerprint, created_at)
    VALUES ('event-1', 'event-1', 'link_corrected', 'kp-old', 'UL-100',
            'admin-1', 'admin@example.com', 'Existing event.', '{}', '{}',
            'succeeded', '${'a'.repeat(64)}', '2026-07-03');
  `);
}

describe('registry plate lifecycle migration', () => {
  it('rebuilds the keeper table and every foreign-key dependent table without losing guards', () => {
    assert.equal(existsSync(migrationPath), true, 'migration 018 must exist');
    const database = openDatabase();
    try {
      seedDependentRegistry(database);
      database.exec(readFileSync(migrationPath, 'utf8'));

      assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
      const row = database.prepare(
        `SELECT id, plate_status, supersedes_keeper_piece_id,
                superseded_by_keeper_piece_id, physical_disposition, replaced_at
           FROM keeper_pieces WHERE id = 'kp-old'`,
      ).get();
      assert.deepEqual({ ...row }, {
        id: 'kp-old',
        plate_status: 'active',
        supersedes_keeper_piece_id: null,
        superseded_by_keeper_piece_id: null,
        physical_disposition: null,
        replaced_at: null,
      });
      for (const table of [
        'ownership_code_audit', 'piece_fulfillments', 'artwork_claim_evidence',
        'artwork_lineage_events', 'artwork_acquisitions', 'registry_maintenance_events',
      ]) {
        assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count, 1, table);
      }
      const triggers = database.prepare(
        `SELECT name FROM sqlite_master
          WHERE type = 'trigger' AND name IN (
            'artwork_lineage_no_update', 'artwork_lineage_no_delete',
            'registry_maintenance_events_no_update', 'registry_maintenance_events_no_delete',
            'keeper_pieces_record_version_auto_increment',
            'keeper_pieces_steward_version_auto_increment'
          ) ORDER BY name`,
      ).all().map((entry) => entry.name);
      assert.deepEqual(triggers, [
        'artwork_lineage_no_delete', 'artwork_lineage_no_update',
        'keeper_pieces_record_version_auto_increment',
        'keeper_pieces_steward_version_auto_increment',
        'registry_maintenance_events_no_delete', 'registry_maintenance_events_no_update',
      ]);
    } finally {
      database.close();
    }
  });

  it('allows retired history but refuses current identity and permanent-code collisions', () => {
    assert.equal(existsSync(migrationPath), true, 'migration 018 must exist');
    const database = openDatabase();
    try {
      database.exec(`${baseMigrations}\n${readFileSync(migrationPath, 'utf8')}`);
      database.exec(`BEGIN IMMEDIATE;
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
           plate_status, superseded_by_keeper_piece_id, physical_disposition, replaced_at)
        VALUES ('retired', 'UL-100', 2, 'hash-retired', 'AR-7KQ9M2WX', 'issue-retired',
                'superseded', 'successor', 'destroyed', '2026-07-30');
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
           plate_status, supersedes_keeper_piece_id)
        VALUES ('successor', 'UL-100', 2, 'hash-current', 'AR-ABCDEFGH', 'issue-current',
                'generated', 'retired');
        COMMIT;
      `);
      assert.throws(() => database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key, plate_status)
        VALUES ('duplicate-current', 'UL-100', 2, 'hash-other', 'AR-BCDEFGH',
                'issue-other', 'generated');
      `), /unique/i);
      for (const [id, recoveryHash, publicCode, issuanceKey] of [
        ['reuse-code', 'hash-code', 'AR-7KQ9M2WX', 'issue-code'],
        ['reuse-key', 'hash-key', 'AR-CDEFGHJK', 'issue-retired'],
      ]) {
        assert.throws(() => database.exec(`
          INSERT INTO keeper_pieces
            (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
             plate_status, physical_disposition)
          VALUES ('${id}', 'UL-101', 1, '${recoveryHash}', '${publicCode}', '${issuanceKey}',
                  'void', 'destroyed');
        `), /unique/i);
      }
    } finally {
      database.close();
    }
  });
});

describe('reusable registry plate issuance', () => {
  it('keeps the admin endpoint on the shared issuance boundary used by replacement', async () => {
    const source = readFileSync(
      new URL('../functions/api/admin/pieces.js', import.meta.url),
      'utf8',
    );
    assert.match(source, /issueRegistryPlate/);
    assert.match(source, /_lib\/registryPlateIssuance\.js/);
    assert.doesNotMatch(
      source,
      /generatePublicPlateCode|generateRecoveryCode|encryptOwnershipCode|buildArtworkPlatePackage/,
    );

    const issuance = await import('../functions/api/_lib/registryPlateIssuance.js');
    assert.equal(typeof issuance.issueRegistryPlate, 'function');
    assert.equal(typeof issuance.createRegistryPlateCandidate, 'function');
    assert.equal(typeof issuance.registryPlateInsertStatement, 'function');
    assert.equal(typeof issuance.packageFromStoredRegistryPlate, 'function');
  });
});
