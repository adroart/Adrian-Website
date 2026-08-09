import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { buildLedgerFile } from '../functions/api/_lib/registryLedgerExport.js';
import {
  buildPrivateRecoveryExport,
  REGISTRY_RECOVERY_TABLES,
} from '../functions/api/_lib/registryRecoveryExport.js';
import {
  buildRegistryRestoreSql,
  canonicalRecoveryJson,
  decryptPrivateRecoveryExport,
  PRIVATE_RECOVERY_ALGORITHM,
  PRIVATE_RECOVERY_ARCHIVE_VERSION,
  PRIVATE_RECOVERY_KIND,
  PRIVATE_RECOVERY_PAYLOAD_KIND,
  PRIVATE_RECOVERY_SCHEMA_VERSION,
  REGISTRY_RECOVERY_V1_TABLES,
  REGISTRY_RECOVERY_V2_TABLES,
} from '../utils/registryRecoveryArchive';

const readMigration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const registryMigrationsBeforeFulfillmentDetachment = [
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
].map(readMigration).join('\n');
const registryMigrations = `${registryMigrationsBeforeFulfillmentDetachment}\n${
  readMigration('022_registry_fulfillment_detachment.sql')
}\n${readMigration('023_collector_registry_merge.sql')}\n${readMigration('024_ownership_foundation.sql')}`;

const exportKey = Buffer.alloc(32, 91).toString('base64');
const exportKeyId = 'registry-recovery-key-v1';
const exportedAt = '2026-07-31T03:04:05.000Z';

const legacyRecoveryTables = REGISTRY_RECOVERY_V1_TABLES;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest).toString('hex');
}

async function encryptLegacyPayload(payload: any) {
  const plaintext = new TextEncoder().encode(canonicalRecoveryJson(payload));
  const nonce = Buffer.alloc(12, 7);
  const tableNames = payload.schemaVersion === 1
    ? REGISTRY_RECOVERY_V1_TABLES : REGISTRY_RECOVERY_V2_TABLES;
  const manifestTables = await Promise.all(tableNames.map(async (name) => ({
    name,
    count: payload.tables[name].length,
    sha256: await sha256Hex(canonicalRecoveryJson(payload.tables[name])),
  })));
  const archiveWithoutCiphertext = {
    kind: PRIVATE_RECOVERY_KIND,
    version: PRIVATE_RECOVERY_ARCHIVE_VERSION,
    algorithm: PRIVATE_RECOVERY_ALGORITHM,
    keyId: exportKeyId,
    nonce: nonce.toString('base64'),
    manifest: {
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt,
      payloadSha256: await sha256Hex(new TextDecoder().decode(plaintext)),
      tables: manifestTables,
    },
  };
  const key = await crypto.subtle.importKey(
    'raw', Buffer.from(exportKey, 'base64'), { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: nonce,
    additionalData: new TextEncoder().encode(canonicalRecoveryJson(archiveWithoutCiphertext)),
    tagLength: 128,
  }, key, plaintext);
  return { ...archiveWithoutCiphertext, ciphertext: Buffer.from(ciphertext).toString('base64') };
}

function createSqliteD1(database = new DatabaseSync(':memory:')) {
  database.exec('PRAGMA foreign_keys = ON;');
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      database.exec('BEGIN;');
      try {
        const results = statements.map((statement) => ({
          results: database.prepare(statement.sql).all(...statement.values),
        }));
        database.exec('COMMIT;');
        return results;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
  return { database, env: { DB } };
}

function seedCompleteRegistry(database: DatabaseSync) {
  database.exec(`
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES
      ('steward-current', 'Current Steward', 'current@example.com', 1, 1, 1),
      ('steward-prior', 'Prior Steward', 'prior@example.com', 1, 1, 1),
      ('steward-event-only', 'Event Steward', 'event@example.com', 1, 1, 1),
      ('admin-user', 'Registry Administrator', 'admin@example.com', 1, 1, 1),
      ('unrelated-user', 'Unrelated', 'unrelated@example.com', 1, 1, 1);
    INSERT INTO account
      (id, userId, accountId, providerId, password, createdAt, updatedAt) VALUES
      ('acct-current', 'steward-current', 'steward-current', 'credential',
       'current-password-hash', 1, 1),
      ('acct-prior', 'steward-prior', 'steward-prior', 'credential',
       'prior-password-hash', 1, 1),
      ('acct-event', 'steward-event-only', 'steward-event-only', 'credential',
       'event-password-hash', 1, 1),
      ('acct-admin', 'admin-user', 'admin-user', 'credential',
       'admin-password-hash', 1, 1),
      ('acct-unrelated', 'unrelated-user', 'unrelated-user', 'credential',
       'unrelated-password-hash', 1, 1);

    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES ('UL-100', 'Art of Living', 'Universal Language', NULL, '${exportedAt}');

    INSERT INTO atlas_source_cities (id, city, region, country, country_code, lat, lng)
    VALUES ('city-ubud', 'Ubud', 'Bali', 'Indonesia', 'ID', -8.5069, 115.2625);

    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       current_display_location, registered_at, claimed_at, public_code,
       issuance_key, plate_status, plate_generated_at, plate_activated_at,
       front_svg_sha256, back_svg_sha256, ownership_code_ciphertext,
       ownership_code_nonce, ownership_code_key_version, backup_status,
       backup_reference, backup_sha256, backup_at, lineage_head_hash, lineage_event_count)
    VALUES
      ('kp-recovery', 'UL-100', 0, 'steward-prior', '${'a'.repeat(64)}',
       'Ubud, Bali', '${exportedAt}', '${exportedAt}', 'AR-7KQ9M2WX',
       'issuance-recovery', 'active', '${exportedAt}', '${exportedAt}',
       '${'b'.repeat(64)}', '${'c'.repeat(64)}', 'ENCRYPTED-OWNERSHIP-ENVELOPE',
       'ENCRYPTED-NONCE', 7, 'verified',
       'plates/AR-7KQ9M2WX/${'d'.repeat(64)}.json', '${'d'.repeat(64)}', '${exportedAt}',
       '${'e'.repeat(64)}', 1);

    INSERT INTO keeper_intentions
      (id, piece_id, edition_number, author_user_id, kind, body, body_hash,
       content_salt, confirmed_at, sets_for_year, birthday_window, created_at)
    VALUES
      ('int-recovery', 'UL-100', 0, 'steward-prior', 'journal',
       'A private intention', '${'f'.repeat(64)}', 'private-salt',
       '${exportedAt}', NULL, 0, '${exportedAt}');

    INSERT INTO piece_fulfillments
      (id, keeper_piece_id, legacy_source_reference, assignment_type,
       intended_recipient_reference, assigned_at, shipped_at, claimed_at)
    VALUES
      ('fulfillment-recovery', 'kp-recovery', 'legacy:73', 'legacy',
       'private-recipient-reference', '${exportedAt}', '${exportedAt}', '${exportedAt}');

    INSERT INTO artwork_acquisitions
      (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
       currency, acquirer_reference, private_notes, document_reference,
       public_provenance, created_at, updated_at)
    VALUES
      ('acq-recovery', 'kp-recovery', 'sale', '${exportedAt}', 987654321,
       'IDR', 'private-acquirer', 'private acquisition note',
       'private-evidence.pdf', 'Acquired from the artist', '${exportedAt}', '${exportedAt}');

    INSERT INTO artwork_provenance_entries
      (id, keeper_piece_id, entry_type, title, detail, role, occurred_at,
       visibility, created_at, updated_at)
    VALUES
      ('prov-recovery', 'kp-recovery', 'contributor', 'Studio Collaborator',
       'Private working detail', 'Woodworker', '2026-01-01', 'private',
       '${exportedAt}', '${exportedAt}');

    INSERT INTO artwork_claim_evidence
      (id, keeper_piece_id, actor_user_id, verified_email, ip_address,
       user_agent, outcome, created_at)
    VALUES
      ('claim-recovery', 'kp-recovery', 'steward-prior', 'prior@example.com',
       '192.0.2.1', 'Private Agent', 'verified', '${exportedAt}');

    INSERT INTO artwork_claim_requests
      (id, keeper_piece_id, requester_user_id, requester_email, note,
       routed_to_user_id, status, created_at)
    VALUES
      ('claim-request-recovery', 'kp-recovery', 'steward-prior', 'prior@example.com',
       'Pending human review', 'steward-current', 'pending', '${exportedAt}');

    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-recovery', 'kp-recovery', 1, 'issued', '${exportedAt}', NULL,
       '${'e'.repeat(64)}', '{"publicCode":"AR-7KQ9M2WX"}');

    INSERT INTO ownership_code_audit
      (id, keeper_piece_id, action, request_id, outcome, created_at)
    VALUES
      ('audit-recovery', 'kp-recovery', 'generate', 'request-recovery',
       'succeeded', '${exportedAt}');

    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES
      ('maintenance-recovery', 'maintenance-recovery', 'steward_transferred',
       'kp-recovery', 'UL-100', 'admin-user', 'admin@example.com',
       'Correct historical stewardship.',
       '{"keeperUserId":"steward-prior","claimedAt":"${exportedAt}","releasedAt":null,"currentDisplayLocation":"Ubud, Bali","stewardVersion":0}',
       '{"keeperUserId":"steward-current","claimedAt":"${exportedAt}","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":1}',
       'succeeded', 'kp-recovery',
       '${'1'.repeat(64)}', '${exportedAt}');

    INSERT INTO registry_recovery_qualifications
      (id, keeper_piece_id, scope, result, copied_artifacts, schema_version,
       build_version, key_version, generator_version, verifier_version,
       backup_reference, backup_sha256, administrator_user_id,
       administrator_email, safe_failure_code, qualified_at)
    VALUES
      ('qualification-recovery', 'kp-recovery', 'piece', 'passed', 1, '020',
       'build-recovery', 7, 'generator-v1', 'verifier-v1',
       'plates/AR-7KQ9M2WX/${'d'.repeat(64)}.json', '${'d'.repeat(64)}',
       'admin-user', 'admin@example.com', NULL, '${exportedAt}');
  `);
  database.exec(`
    BEGIN IMMEDIATE;
    INSERT INTO artwork_transfer_intents
      (id, keeper_piece_id, expected_from_user_id, target_user_id,
       target_email_commitment,
       expected_steward_version, expected_lineage_count, expected_lineage_hash,
       transfer_kind, maintenance_event_id, lineage_event_id, created_at)
    VALUES
      ('transfer-recovery', 'kp-recovery', 'steward-prior', 'steward-current',
       '${'3'.repeat(64)}',
       0, 1, '${'e'.repeat(64)}', 'gift', 'maintenance-recovery',
       'lineage-transfer-recovery', '${exportedAt}');
    INSERT INTO artwork_transfer_parties
      (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
    VALUES
      ('party-recovery-from', 'transfer-recovery', 'from', 'steward-prior',
       'tp-00000000-0000-4000-8000-000000000001', '${exportedAt}'),
      ('party-recovery-to', 'transfer-recovery', 'to', 'steward-current',
       'tp-00000000-0000-4000-8000-000000000002', '${exportedAt}');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-transfer-recovery', 'kp-recovery', 2, 'transferred', '${exportedAt}',
       '${'e'.repeat(64)}', '${'2'.repeat(64)}',
       '{"fromRef":"tp-00000000-0000-4000-8000-000000000001","toRef":"tp-00000000-0000-4000-8000-000000000002","transferKind":"gift"}');
    INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
    VALUES ('receipt-recovery', 'transfer-recovery', '${exportedAt}');
    COMMIT;
  `);
}

function appendSecondTransfer(database: DatabaseSync) {
  const secondTransferAt = '2026-08-01T03:04:05.000Z';
  database.exec(`
    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES
      ('maintenance-second-transfer', 'maintenance-second-transfer', 'steward_transferred',
       'kp-recovery', 'UL-100', 'admin-user', 'admin@example.com',
       'Record the second stewardship transfer.',
       '{"keeperUserId":"steward-current","claimedAt":"${exportedAt}","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":1}',
       '{"keeperUserId":"steward-event-only","claimedAt":"${secondTransferAt}","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":2}',
       'succeeded', 'kp-recovery', '${'5'.repeat(64)}', '${secondTransferAt}');
    BEGIN IMMEDIATE;
    INSERT INTO artwork_transfer_intents
      (id, keeper_piece_id, expected_from_user_id, target_user_id,
       target_email_commitment,
       expected_steward_version, expected_lineage_count, expected_lineage_hash,
       transfer_kind, maintenance_event_id, lineage_event_id, created_at)
    VALUES
      ('transfer-second-recovery', 'kp-recovery', 'steward-current', 'steward-event-only',
       '${'4'.repeat(64)}',
       1, 2, '${'2'.repeat(64)}', 'sale', 'maintenance-second-transfer',
       'lineage-second-transfer-recovery', '${secondTransferAt}');
    INSERT INTO artwork_transfer_parties
      (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
    VALUES
      ('party-second-recovery-from', 'transfer-second-recovery', 'from', 'steward-current',
       'tp-00000000-0000-4000-8000-000000000003', '${secondTransferAt}'),
      ('party-second-recovery-to', 'transfer-second-recovery', 'to', 'steward-event-only',
       'tp-00000000-0000-4000-8000-000000000004', '${secondTransferAt}');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-second-transfer-recovery', 'kp-recovery', 3, 'transferred',
       '${secondTransferAt}', '${'2'.repeat(64)}', '${'6'.repeat(64)}',
       '{"fromRef":"tp-00000000-0000-4000-8000-000000000003","toRef":"tp-00000000-0000-4000-8000-000000000004","transferKind":"sale"}');
    INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
    VALUES ('receipt-second-recovery', 'transfer-second-recovery', '${secondTransferAt}');
    COMMIT;
  `);
}

function tableCount(database: DatabaseSync, table: string) {
  return Number((database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as any).count);
}

describe('registry-only legacy fulfillment migration', () => {
  it('preserves dormant fulfillment data while removing the order-table dependency', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec('PRAGMA foreign_keys = ON;');
      database.exec(registryMigrationsBeforeFulfillmentDetachment);
      database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, plate_status)
        VALUES ('kp-legacy-fulfillment', 'UL-100', 0, '${'9'.repeat(64)}', 'legacy');
        INSERT INTO orders
          (id, stripe_session_id, email, status, amount_total, currency)
        VALUES (41, 'retired-session', 'historical@example.com', 'paid', 500, 'USD');
        INSERT INTO order_items
          (id, order_id, product_id, quantity, amount_subtotal)
        VALUES (73, 41, 'UL-100', 1, 500);
        INSERT INTO piece_fulfillments
          (id, keeper_piece_id, order_item_id, assignment_type,
           intended_recipient_reference, assigned_at, shipped_at)
        VALUES ('fulfillment-legacy', 'kp-legacy-fulfillment', 73, 'stripe_order',
          'historical-opaque-reference', '${exportedAt}', '${exportedAt}');
      `);

      database.exec(readMigration('022_registry_fulfillment_detachment.sql'));
      const columns = database.prepare(
        "SELECT name FROM pragma_table_info('piece_fulfillments') ORDER BY cid",
      ).all().map((row: any) => row.name);
      assert.equal(columns.includes('order_item_id'), false);
      assert.equal(columns.includes('legacy_source_reference'), true);
      const foreignTables = database.prepare(
        "SELECT DISTINCT \"table\" AS name FROM pragma_foreign_key_list('piece_fulfillments') ORDER BY name",
      ).all().map((row: any) => row.name);
      assert.deepEqual(foreignTables, ['keeper_pieces']);
      assert.deepEqual({ ...database.prepare(
        `SELECT assignment_type, legacy_source_reference, intended_recipient_reference,
                assigned_at, shipped_at
           FROM piece_fulfillments WHERE id = 'fulfillment-legacy'`,
      ).get() }, {
        assignment_type: 'legacy',
        legacy_source_reference: 'legacy:73',
        intended_recipient_reference: 'historical-opaque-reference',
        assigned_at: exportedAt,
        shipped_at: exportedAt,
      });

      database.exec('DELETE FROM order_items; DELETE FROM orders;');
      assert.equal(tableCount(database, 'piece_fulfillments'), 1);
    } finally {
      database.close();
    }
  });
});

describe('private registry recovery export', () => {
  it('reads the complete boundary in one database batch snapshot', async () => {
    let batchCalls = 0;
    const DB = {
      prepare(sql: string) {
        return { sql, bind() { return this; } };
      },
      async batch(statements: Array<{ sql: string }>) {
        batchCalls += 1;
        assert.equal(statements.length, REGISTRY_RECOVERY_TABLES.length);
        assert.equal(statements.some((statement) => /FROM "user"/i.test(statement.sql)), true);
        assert.equal(statements.some((statement) => /FROM "account"/i.test(statement.sql)), true);
        return statements.map(() => ({ results: [] }));
      },
    };
    const archive = await buildPrivateRecoveryExport({
      DB,
      REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
      REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
    }, { exportedAt });
    assert.equal(batchCalls, 1);
    const payload = await decryptPrivateRecoveryExport(archive, { key: exportKey, keyId: exportKeyId });
    assert.equal(Object.values(payload.tables).every((rows) => rows.length === 0), true);
  });

  it('encrypts every registry table with counts, digests, deterministic rows, and only referenced auth accounts', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);

      const archive = await buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const serialized = JSON.stringify(archive);
      for (const privateValue of [
        '987654321', 'private acquisition note', 'private-evidence.pdf',
        'prior@example.com', 'ENCRYPTED-OWNERSHIP-ENVELOPE', 'current-password-hash',
      ]) assert.doesNotMatch(serialized, new RegExp(privateValue));

      assert.equal(archive.manifest.schemaVersion, PRIVATE_RECOVERY_SCHEMA_VERSION);
      assert.deepEqual(archive.manifest.tables.map((table: any) => table.name), REGISTRY_RECOVERY_TABLES);
      assert.equal(archive.manifest.tables.every((table: any) => /^[a-f0-9]{64}$/.test(table.sha256)), true);

      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey,
        keyId: exportKeyId,
      });
      assert.equal(payload.tables.artwork_acquisitions[0].amount_minor, 987654321);
      assert.equal(payload.tables.artwork_acquisitions[0].private_notes, 'private acquisition note');
      assert.equal(payload.tables.artwork_claim_evidence[0].verified_email, 'prior@example.com');
      assert.equal(payload.tables.artwork_claim_requests[0].status, 'pending');
      assert.equal(payload.tables.keeper_pieces[0].last_transfer_id, 'transfer-recovery');
      assert.equal(payload.tables.artwork_transfer_intents[0].transfer_kind, 'gift');
      assert.equal(payload.tables.artwork_transfer_intents[0].target_email_commitment,
        '3'.repeat(64));
      assert.deepEqual(payload.tables.artwork_transfer_parties.map((row: any) => [
        row.party_role, row.user_id, row.public_ref,
      ]), [
        ['from', 'steward-prior', 'tp-00000000-0000-4000-8000-000000000001'],
        ['to', 'steward-current', 'tp-00000000-0000-4000-8000-000000000002'],
      ]);
      assert.equal(payload.tables.artwork_transfer_receipts[0].transfer_intent_id,
        'transfer-recovery');
      assert.equal(payload.tables.keeper_pieces[0].ownership_code_ciphertext, 'ENCRYPTED-OWNERSHIP-ENVELOPE');
      assert.equal(Object.keys(payload.tables.keeper_pieces[0]).some((key) => /plaintext|ownership_code$/i.test(key)), false);
      assert.deepEqual(payload.tables.user.map((row: any) => row.id), [
        'admin-user', 'steward-current', 'steward-prior',
      ]);
      assert.deepEqual(payload.tables.account.map((row: any) => row.id), [
        'acct-admin', 'acct-current', 'acct-prior',
      ]);
      assert.equal(serialized.includes('unrelated@example.com'), false);
      for (const table of REGISTRY_RECOVERY_TABLES) {
        const manifest = archive.manifest.tables.find((entry: any) => entry.name === table);
        assert.equal(manifest.count, payload.tables[table].length, table);
      }
      assert.equal(Object.hasOwn(payload.tables, 'session'), false);
      assert.equal(Object.hasOwn(payload.tables, 'verification'), false);
    } finally {
      database.close();
    }
  });

  it('keeps exact amounts, steward identity, notes, and evidence out of the public Drive ledger', async () => {
    const seen: string[] = [];
    const DB = {
      prepare(sql: string) {
        seen.push(sql);
        if (/FROM keeper_pieces/i.test(sql)) return { all: async () => ({ results: [] }) };
        if (/FROM artwork_lineage_events/i.test(sql)) return { all: async () => ({ results: [] }) };
        if (/FROM atlas_source_chains/i.test(sql)) return { all: async () => ({ results: [] }) };
        if (/FROM atlas_source_chain_events/i.test(sql)) return { all: async () => ({ results: [] }) };
        throw new Error(`public ledger queried private table: ${sql}`);
      },
    };
    const ledger = await buildLedgerFile({ DB });
    assert.equal(seen.length, 4);
    assert.doesNotMatch(seen.join('\n'), /artwork_acquisitions|artwork_claim_evidence|keeper_intentions|registry_maintenance_events|\buser\b|\baccount\b/i);
    assert.doesNotMatch(ledger.body, /amount_minor|private_notes|verified_email|keeper_user_id|current_display_location/i);
  });
});

describe('clean-only private registry restore', () => {
  it('decrypts and upgrades a valid schema v1 archive with empty source-chain tables', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      const currentArchive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const current = await decryptPrivateRecoveryExport(currentArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      const legacyPayload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 1,
        exportedAt,
        tables: Object.fromEntries(legacyRecoveryTables.map((name) => [name,
          name === 'keeper_pieces'
            ? current.tables[name].map(({ last_transfer_id: _lastTransferId, ...row }) => row)
            : current.tables[name],
        ])),
      };
      const legacyArchive = await encryptLegacyPayload(legacyPayload);
      const upgraded = await decryptPrivateRecoveryExport(legacyArchive as any, {
        key: exportKey, keyId: exportKeyId,
      });
      assert.equal(upgraded.schemaVersion, PRIVATE_RECOVERY_SCHEMA_VERSION);
      assert.deepEqual(upgraded.tables.atlas_source_cities, []);
      assert.deepEqual(upgraded.tables.atlas_source_chains, []);
      assert.deepEqual(upgraded.tables.atlas_source_chain_events, []);
      target.database.exec(buildRegistryRestoreSql(upgraded));
      assert.equal(tableCount(target.database, 'keeper_pieces'), 1);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('decrypts and upgrades schema v2 while preserving Atlas data', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      const currentArchive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const current = await decryptPrivateRecoveryExport(currentArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      const v2Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 2,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V2_TABLES.map((name) => [name,
          name === 'keeper_pieces'
            ? current.tables[name].map(({ last_transfer_id: _lastTransferId, ...row }) => row)
            : current.tables[name],
        ])),
      };
      const archive = await encryptLegacyPayload(v2Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });
      assert.equal(upgraded.schemaVersion, PRIVATE_RECOVERY_SCHEMA_VERSION);
      assert.equal(upgraded.tables.atlas_source_cities[0].id, 'city-ubud');
      assert.equal(upgraded.tables.keeper_pieces[0].last_transfer_id, null);
      assert.deepEqual(upgraded.tables.artwork_claim_requests, []);
      assert.deepEqual(upgraded.tables.artwork_transfer_intents, []);
      assert.deepEqual(upgraded.tables.artwork_transfer_parties, []);
      assert.deepEqual(upgraded.tables.artwork_transfer_receipts, []);
      target.database.exec(buildRegistryRestoreSql(upgraded));
      assert.equal(tableCount(target.database, 'atlas_source_cities'), 1);
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('documents the separate encrypted artifact and clean recovery database boundary', () => {
    const guide = readFileSync(
      new URL('../docs/registry-private-recovery.md', import.meta.url), 'utf8',
    );
    assert.match(guide, /REGISTRY_RECOVERY_EXPORT_KEY/);
    assert.match(guide, /REGISTRY_RECOVERY_EXPORT_KEY_ID/);
    assert.match(guide, /restore-sql/);
    assert.match(guide, /new, fully migrated recovery database/i);
    assert.match(guide, /never.*production/i);
    assert.match(guide, /not.*Google Drive|never.*Drive/i);
    assert.doesNotMatch(guide, /[A-Za-z0-9+/]{43}=|ownership code:\s*[A-Z0-9-]+/i);
  });

  it('restores a verified archive into one fully migrated empty database and refuses a second restore', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, { key: exportKey, keyId: exportKeyId });
      const sql = buildRegistryRestoreSql(payload);

      assert.doesNotMatch(sql, /INSERT\s+OR\s+IGNORE/i);
      assert.match(sql, /BEGIN IMMEDIATE/i);
      assert.match(sql, /registry_recovery_target_not_empty/i);
      target.database.exec(sql);
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(tableCount(target.database, table), payload.tables[table].length, table);
      }
      assert.equal(target.database.prepare(
        "SELECT last_transfer_id FROM keeper_pieces WHERE id = 'kp-recovery'",
      ).get()?.last_transfer_id, 'transfer-recovery');
      assert.equal(target.database.prepare(
        "SELECT transfer_kind FROM artwork_transfer_intents WHERE id = 'transfer-recovery'",
      ).get()?.transfer_kind, 'gift');
      assert.deepEqual(target.database.prepare(
        "SELECT party_role, user_id, public_ref FROM artwork_transfer_parties ORDER BY id",
      ).all().map((row: any) => [row.party_role, row.user_id, row.public_ref]), [
        ['from', 'steward-prior', 'tp-00000000-0000-4000-8000-000000000001'],
        ['to', 'steward-current', 'tp-00000000-0000-4000-8000-000000000002'],
      ]);
      assert.equal(target.database.prepare(
        "SELECT transfer_intent_id FROM artwork_transfer_receipts WHERE id = 'receipt-recovery'",
      ).get()?.transfer_intent_id, 'transfer-recovery');
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);

      assert.throws(() => target.database.exec(sql), /registry_recovery_target_not_empty/i);
      assert.equal(tableCount(target.database, 'keeper_pieces'), 1);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('replays two transfer receipts in lineage order and restores the final keeper state', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      appendSecondTransfer(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });

      target.database.exec(buildRegistryRestoreSql(payload));

      assert.deepEqual({ ...target.database.prepare(
        `SELECT keeper_user_id, claimed_at, steward_version, lineage_event_count,
                lineage_head_hash, last_transfer_id
           FROM keeper_pieces WHERE id = 'kp-recovery'`,
      ).get() }, {
        keeper_user_id: 'steward-event-only',
        claimed_at: '2026-08-01T03:04:05.000Z',
        steward_version: 2,
        lineage_event_count: 3,
        lineage_head_hash: '6'.repeat(64),
        last_transfer_id: 'transfer-second-recovery',
      });
      assert.equal(tableCount(target.database, 'artwork_transfer_receipts'), 2);
      assert.deepEqual(target.database.prepare(
        'SELECT target_email_commitment FROM artwork_transfer_intents ORDER BY id',
      ).all().map((row: any) => row.target_email_commitment), [
        '3'.repeat(64),
        '4'.repeat(64),
      ]);
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('aborts before restoring anything when even one target table is non-empty', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      target.database.exec(`INSERT INTO registry_artworks
        (id, title, created_at) VALUES ('UL-999', 'Conflict', '${exportedAt}')`);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, { key: exportKey, keyId: exportKeyId });

      assert.throws(
        () => target.database.exec(buildRegistryRestoreSql(payload)),
        /registry_recovery_target_not_empty/i,
      );
      assert.equal(tableCount(target.database, 'registry_artworks'), 1);
      assert.equal(tableCount(target.database, 'keeper_pieces'), 0);
      assert.equal(tableCount(target.database, 'artwork_acquisitions'), 0);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('also refuses a recovery database that already contains an authentication verification token', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      target.database.exec(`INSERT INTO verification
        (id, identifier, value, expiresAt, createdAt, updatedAt)
        VALUES ('verification-existing', 'existing@example.com', 'token', 2, 1, 1)`);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, { key: exportKey, keyId: exportKeyId });

      assert.throws(
        () => target.database.exec(buildRegistryRestoreSql(payload)),
        /registry_recovery_target_not_empty/i,
      );
      assert.equal(tableCount(target.database, 'verification'), 1);
      assert.equal(tableCount(target.database, 'keeper_pieces'), 0);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('rolls back every restored row when a permissive SQL runner continues after an insert failure', async () => {
    const source = createSqliteD1();
    const directory = mkdtempSync(join(tmpdir(), 'registry-private-rollback-'));
    const targetPath = join(directory, 'target.sqlite');
    try {
      source.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });
      const validSql = buildRegistryRestoreSql(payload);
      const brokenSql = validSql.replace('987654321', '-1');
      assert.notEqual(brokenSql, validSql);

      const target = new DatabaseSync(targetPath);
      target.exec('PRAGMA foreign_keys = ON;');
      target.exec(registryMigrations);
      target.close();

      const restored = spawnSync('/usr/bin/sqlite3', [targetPath], {
        input: brokenSql,
        encoding: 'utf8',
      });
      assert.notEqual(restored.status, 0);

      const inspected = new DatabaseSync(targetPath);
      try {
        for (const table of REGISTRY_RECOVERY_TABLES) {
          assert.equal(tableCount(inspected, table), 0, table);
        }
      } finally {
        inspected.close();
      }
    } finally {
      source.database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects unsupported, incomplete, malformed, and tampered artifacts before SQL exists', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      const archive = await buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });

      await assert.rejects(
        () => decryptPrivateRecoveryExport({ ...archive, version: 999 } as any, { key: exportKey, keyId: exportKeyId }),
        /unsupported_recovery_archive/i,
      );
      const tampered = structuredClone(archive) as any;
      tampered.manifest.tables[0].count += 1;
      await assert.rejects(
        () => decryptPrivateRecoveryExport(tampered, { key: exportKey, keyId: exportKeyId }),
        /recovery_archive_(?:authentication|digest|manifest)/i,
      );
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });
      const malformedRow = structuredClone(payload) as any;
      malformedRow.tables.registry_artworks = [{ id: 'UL-999', surprise: 'unsupported' }];
      assert.throws(
        () => buildRegistryRestoreSql(malformedRow),
        /recovery_payload_columns_registry_artworks/i,
      );
      const missingId = structuredClone(payload) as any;
      delete missingId.tables.artwork_acquisitions[0].id;
      assert.throws(
        () => buildRegistryRestoreSql(missingId),
        /recovery_payload_columns_artwork_acquisitions/i,
      );
      assert.throws(
        () => buildRegistryRestoreSql({
          kind: 'registry-private-recovery-payload',
          schemaVersion: PRIVATE_RECOVERY_SCHEMA_VERSION,
          exportedAt,
          tables: { keeper_pieces: [] },
        } as any),
        /recovery_payload_tables/i,
      );
      assert.throws(() => buildRegistryRestoreSql(null as any), /recovery_payload_shape/i);
    } finally {
      database.close();
    }
  });

  it('makes the offline restore-sql command require an authenticated private archive and key file', async () => {
    const { database, env } = createSqliteD1();
    const directory = mkdtempSync(join(tmpdir(), 'registry-private-recovery-'));
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      const archive = await buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const archivePath = join(directory, 'registry-private-recovery.json');
      const keyPath = join(directory, 'registry-private-recovery.key');
      const sqlPath = join(directory, 'restore.sql');
      writeFileSync(archivePath, JSON.stringify(archive));
      writeFileSync(keyPath, `${exportKeyId}\n${exportKey}\n`);

      const restored = spawnSync('npx', [
        'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, sqlPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(restored.status, 0, restored.stderr);
      assert.match(restored.stdout, /new, fully migrated recovery database/i);
      assert.match(readFileSync(sqlPath, 'utf8'), /registry_recovery_target_not_empty/i);
      assert.equal(statSync(sqlPath).mode & 0o777, 0o600);

      const noOutput = spawnSync('npx', [
        'tsx', 'scripts/registry-ledger.ts', 'restore-sql', archivePath, keyPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(noOutput.status, 0);
      assert.doesNotMatch(noOutput.stdout, /private acquisition note|current-password-hash/);

      const overwrite = spawnSync('npx', [
        'tsx', 'scripts/registry-ledger.ts', 'restore-sql', archivePath, keyPath, sqlPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(overwrite.status, 0);
      assert.match(overwrite.stderr, /refusing.*existing|already exists/i);

      const legacy = spawnSync('npx', [
        'tsx', 'scripts/registry-ledger.ts', 'to-sql', archivePath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(legacy.status, 0);
      assert.doesNotMatch(legacy.stderr, /wrangler d1 execute adrian-website --remote/i);

      const tampered = structuredClone(archive) as any;
      tampered.ciphertext = `${tampered.ciphertext.slice(0, -2)}AA`;
      writeFileSync(archivePath, JSON.stringify(tampered));
      const refused = spawnSync('npx', [
        'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, join(directory, 'refused.sql'),
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /authentication|broken|invalid|refusing/i);
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
