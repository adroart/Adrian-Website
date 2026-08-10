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
  REGISTRY_RECOVERY_V3_TABLES,
  REGISTRY_RECOVERY_V4_TABLES,
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
const registryMigrationsThroughOwnership = `${registryMigrationsBeforeFulfillmentDetachment}\n${
  readMigration('022_registry_fulfillment_detachment.sql')
}\n${readMigration('023_collector_registry_merge.sql')}\n${readMigration('024_ownership_foundation.sql')}`;
const phase1Migrations = `${readMigration('025_artwork_registration.sql')}
\n${readMigration('026_artwork_invitations.sql')}\n${readMigration('027_certificate_templates.sql')}
\n${readMigration('028_collector_privacy.sql')}`;
const phase2Migrations = `${readMigration('029_collector_dreams.sql')}
\n${readMigration('030_collector_field.sql')}\n${readMigration('031_collector_letters.sql')}`;
const registryMigrations = `${registryMigrationsThroughOwnership}\n${phase1Migrations}
\n${phase2Migrations}`;

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
    ? REGISTRY_RECOVERY_V1_TABLES
    : payload.schemaVersion === 2 ? REGISTRY_RECOVERY_V2_TABLES
      : payload.schemaVersion === 3 ? REGISTRY_RECOVERY_V3_TABLES
        : REGISTRY_RECOVERY_V4_TABLES;
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
      ('invite-only', 'Invitation Administrator', 'invite@example.com', 1, 1, 1),
      ('consent-only', 'Consent Author', 'consent@example.com', 1, 1, 1),
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
      ('acct-invite', 'invite-only', 'invite-only', 'credential',
       'invite-password-hash', 1, 1),
      ('acct-consent', 'consent-only', 'consent-only', 'credential',
       'consent-password-hash', 1, 1),
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

    BEGIN IMMEDIATE;
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at)
    VALUES
      ('dream-prior', 'kp-recovery', 'steward-prior',
       'A first draft before the former keeper refined it.', 'self', 'private',
       'dream-prior-create', 1, '2026-07-30T03:04:05.000Z',
       '2026-07-30T03:04:05.000Z');
    INSERT INTO collector_dream_markers
      (id, dream_id, keeper_piece_id, author_user_id, marker_kind, body,
       idempotency_key, created_at)
    VALUES
      ('marker-prior', 'dream-prior', 'kp-recovery', 'steward-prior', 'change',
       'A private change before transfer.', 'marker-prior-create',
       '2026-07-30T03:34:05.000Z');
    INSERT INTO collector_dream_mutations
      (id, dream_id, author_user_id, action, idempotency_key, request_json,
       resulting_version, created_at)
    VALUES
      ('mutation-prior', 'dream-prior', 'steward-prior', 'edit',
       'mutation-prior-edit',
       '{"body":"A former keeper dream that travels with the piece.","scope":"community","expectedVersion":1}',
       2, '2026-07-30T04:04:05.000Z');
    COMMIT;
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
  database.exec(`
    INSERT INTO users
      (id, clerk_user_id, auth_user_id, email, created_at, updated_at)
    VALUES
      (2, 'steward-current', 'steward-current', 'current@example.com', 1, 1),
      (10, 'steward-prior', 'steward-prior', 'prior@example.com', 1, 1),
      (11, 'consent-only', 'consent-only', 'consent@example.com', 1, 1);
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
       computed_json, updated_at)
    VALUES
      (2, '1990-01-02', '12:00', 'Ubud, Bali, Indonesia', -8.5069, 115.2625,
       'Asia/Makassar', '{"activation":{"line":1}}', 1),
      (10, '1985-03-04', '08:30', 'Denpasar, Bali, Indonesia', -8.65, 115.2167,
       'Asia/Makassar', '{"activation":{"line":2}}', 1),
      (11, '1988-05-06', '09:45', 'Sanur, Bali, Indonesia', -8.69, 115.26,
       'Asia/Makassar', '{"activation":{"line":3}}', 1);

    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES ('UL-101', 'Invitation Work', 'Universal Language', NULL, '${exportedAt}');
    INSERT INTO registry_catalog_membership
      (artwork_id, series, category, catalog_digest, first_seeded_at)
    VALUES
      ('UL-100', 'Universal Language', 'multidimensional-art', '${'7'.repeat(64)}', '${exportedAt}'),
      ('UL-101', 'Universal Language', 'multidimensional-art', '${'8'.repeat(64)}', '${exportedAt}');

    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code,
       issuance_key, ownership_code_ciphertext, ownership_code_nonce,
       ownership_code_key_version, lineage_head_hash, lineage_event_count,
       registration_status, registered_by_user_id, identity_backup_status,
       identity_backup_reference, identity_backup_sha256, identity_backup_at)
    VALUES
      ('kp-invited', 'UL-101', 0, '${'9'.repeat(64)}', '${exportedAt}', 'AR-8KQ9M2WX',
       'issuance-invited', 'INVITED-ENVELOPE', 'INVITED-NONCE', 8,
       '${'a'.repeat(64)}', 1, 'registered', 'admin-user', 'verified',
       'identities/AR-8KQ9M2WX/${'b'.repeat(64)}.json', '${'b'.repeat(64)}', '${exportedAt}');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-invited-issued', 'kp-invited', 1, 'issued', '${exportedAt}', NULL,
       '${'a'.repeat(64)}', '{"publicCode":"AR-8KQ9M2WX"}');
    INSERT INTO artwork_identity_recovery_qualifications
      (id, keeper_piece_id, result, copied_artifact, schema_version, build_version,
       key_version, verifier_version, backup_reference, backup_sha256,
       administrator_user_id, administrator_email, safe_failure_code, qualified_at)
    VALUES
      ('identity-qualification-recovery', 'kp-invited', 'passed', 1, '025',
       'build-phase-1', 8, 'verifier-v2',
       'identities/AR-8KQ9M2WX/${'b'.repeat(64)}.json', '${'b'.repeat(64)}',
       'admin-user', 'admin@example.com', NULL, '${exportedAt}');

    INSERT INTO artwork_invitations
      (id, keeper_piece_id, token_hash, intended_recipient_email,
       created_by_user_id, idempotency_key, created_at, expires_at)
    VALUES
      ('iv-00000000-0000-4000-8000-000000000001', 'kp-invited', '${'c'.repeat(64)}',
       'prior@example.com', 'admin-user', 'invite-recovery',
       '2026-07-31T02:04:05.000Z', '2026-08-31T02:04:05.000Z'),
      ('iv-00000000-0000-4000-8000-000000000002', 'kp-invited', '${'0'.repeat(64)}',
       'future@example.com', 'invite-only', 'invite-future-recovery',
       '2026-07-31T02:05:05.000Z', '2026-08-31T02:05:05.000Z');
    BEGIN IMMEDIATE;
    INSERT INTO artwork_invitation_redemptions
      (invitation_id, keeper_piece_id, redeemed_by_user_id, verified_recipient_email,
       proof_reference, presented_token_hash, redeemed_at)
    VALUES
      ('iv-00000000-0000-4000-8000-000000000001', 'kp-invited', 'steward-prior',
       'prior@example.com', 'iv-00000000-0000-4000-8000-000000000001',
       '${'c'.repeat(64)}', '${exportedAt}');
    INSERT INTO artwork_claim_evidence
      (id, keeper_piece_id, actor_user_id, verified_email, outcome, created_at)
    VALUES
      ('claim-invited', 'kp-invited', 'steward-prior', 'prior@example.com',
       'first_bound', '${exportedAt}');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-invited-bound', 'kp-invited', 2, 'first_bound', '${exportedAt}',
       '${'a'.repeat(64)}', '${'d'.repeat(64)}', '{}');
    UPDATE keeper_pieces
       SET keeper_user_id = 'steward-prior', claimed_at = '${exportedAt}',
           lineage_head_hash = '${'d'.repeat(64)}', lineage_event_count = 2
     WHERE id = 'kp-invited';
    INSERT INTO artwork_invitation_redemption_completions (invitation_id, completed_at)
    VALUES ('iv-00000000-0000-4000-8000-000000000001', '${exportedAt}');
    COMMIT;

    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES
      ('maintenance-invited-transfer', 'maintenance-invited-transfer', 'steward_transferred',
       'kp-invited', 'UL-101', 'admin-user', 'admin@example.com',
       'Transfer after invitation redemption.',
       '{"keeperUserId":"steward-prior","claimedAt":"${exportedAt}","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":1}',
       '{"keeperUserId":"steward-current","claimedAt":"2026-08-02T03:04:05.000Z","releasedAt":null,"currentDisplayLocation":null,"stewardVersion":2}',
       'succeeded', 'kp-invited', '${'f'.repeat(64)}', '2026-08-02T03:04:05.000Z');
    BEGIN IMMEDIATE;
    INSERT INTO artwork_transfer_intents
      (id, keeper_piece_id, expected_from_user_id, target_user_id,
       target_email_commitment, expected_steward_version, expected_lineage_count,
       expected_lineage_hash, transfer_kind, maintenance_event_id, lineage_event_id,
       created_at)
    VALUES
      ('transfer-invited-recovery', 'kp-invited', 'steward-prior', 'steward-current',
       '${'1'.repeat(64)}', 1, 2, '${'d'.repeat(64)}', 'gift',
       'maintenance-invited-transfer', 'lineage-invited-transfer',
       '2026-08-02T03:04:05.000Z');
    INSERT INTO artwork_transfer_parties
      (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
    VALUES
      ('party-invited-from', 'transfer-invited-recovery', 'from', 'steward-prior',
       'tp-00000000-0000-4000-8000-000000000005', '2026-08-02T03:04:05.000Z'),
      ('party-invited-to', 'transfer-invited-recovery', 'to', 'steward-current',
       'tp-00000000-0000-4000-8000-000000000006', '2026-08-02T03:04:05.000Z');
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('lineage-invited-transfer', 'kp-invited', 3, 'transferred',
       '2026-08-02T03:04:05.000Z', '${'d'.repeat(64)}', '${'f'.repeat(64)}',
       '{"fromRef":"tp-00000000-0000-4000-8000-000000000005","toRef":"tp-00000000-0000-4000-8000-000000000006","transferKind":"gift"}');
    INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
    VALUES ('receipt-invited-recovery', 'transfer-invited-recovery',
      '2026-08-02T03:04:05.000Z');
    COMMIT;

    INSERT INTO certificate_templates
      (id, name, content_json, version, created_by_user_id, created_by_email,
       created_at, updated_at)
    VALUES
      ('template-recovery', 'Studio certificate', '{"origin":"Bali"}', 1,
       'admin-user', 'admin@example.com', '${exportedAt}', '${exportedAt}');
    INSERT INTO certificate_assignment_operations
      (idempotency_key, request_digest, template_id, artwork_ids_json,
       assigned_by_user_id, assigned_by_email, assigned_at)
    VALUES
      ('assignment-recovery', '${'e'.repeat(64)}', 'template-recovery', '["UL-100"]',
       'admin-user', 'admin@example.com', '${exportedAt}');
    INSERT INTO certificate_artwork_assignments
      (artwork_id, template_id, assignment_operation_key, version, assigned_at)
    VALUES ('UL-100', 'template-recovery', 'assignment-recovery', 1, '${exportedAt}');
    INSERT INTO certificate_artwork_overrides
      (artwork_id, field, mode, value_json, version, updated_by_user_id,
       updated_by_email, updated_at)
    VALUES
      ('UL-100', 'origin', 'override', '"Bali"', 1, 'admin-user',
       'admin@example.com', '${exportedAt}');
    UPDATE certificate_artwork_overrides
       SET value_json = '"Ubud, Bali"', version = 2,
           updated_at = '2026-08-01T03:04:05.000Z'
     WHERE artwork_id = 'UL-100' AND field = 'origin';

    INSERT INTO collector_curated_cities (id, label, population, active)
    VALUES
      ('ubud-bali', 'Ubud, Bali', 75000, 1),
      ('retired-city', 'Retired City', 80000, 0);
    INSERT INTO collector_person_privacy
      (user_id, share_derived_chart, share_name, policy_version, updated_at)
    VALUES
      (2, 1, 1, 'collector-privacy-v1', '${exportedAt}'),
      (10, 0, 0, 'collector-privacy-v1', '${exportedAt}'),
      (11, 0, 0, 'collector-privacy-v1', '${exportedAt}');
    INSERT INTO collector_piece_privacy
      (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
    VALUES
      ('kp-recovery', 2, 1, 'ubud-bali', 'collector-privacy-v1', '${exportedAt}');
    INSERT INTO collector_consent_history
      (id, user_id, scope, target_ref, before_json, after_json, policy_version, changed_at)
    VALUES
      ('consent-00000000000000000000000000000001', 2, 'person', 'person',
       '{"shareDerivedChart":false,"shareFace":false,"shareName":false,"shareIntention":false,"shareBusiness":false,"shareMission":false}',
       '{"shareDerivedChart":true,"shareFace":false,"shareName":true,"shareIntention":false,"shareBusiness":false,"shareMission":false}',
       'collector-privacy-v1', '${exportedAt}'),
      ('consent-00000000000000000000000000000002', 2, 'piece', 'kp-recovery',
       '{"shareCity":false,"cityId":null}', '{"shareCity":true,"cityId":"ubud-bali"}',
       'collector-privacy-v1', '${exportedAt}'),
      ('consent-00000000000000000000000000000003', 10, 'piece', 'kp-recovery',
       '{"shareCity":true,"cityId":"retired-city"}', '{"shareCity":false,"cityId":null}',
       'collector-privacy-v1', '${exportedAt}'),
      ('consent-00000000000000000000000000000004', 11, 'person', 'person',
       '{"shareDerivedChart":false,"shareFace":false,"shareName":false,"shareIntention":false,"shareBusiness":false,"shareMission":false}',
       '{"shareDerivedChart":false,"shareFace":false,"shareName":false,"shareIntention":false,"shareBusiness":false,"shareMission":false}',
       'collector-privacy-v1', '${exportedAt}');

    BEGIN IMMEDIATE;
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at)
    VALUES
      ('dream-current', 'kp-recovery', 'steward-current',
       'A current keeper dream shared by consent.', 'planet', 'private',
       'dream-current-create', 1, '2026-08-03T02:04:05.000Z',
       '2026-08-03T02:04:05.000Z');
    INSERT INTO collector_dream_markers
      (id, dream_id, keeper_piece_id, author_user_id, marker_kind, body,
       idempotency_key, created_at)
    VALUES
      ('marker-current', 'dream-current', 'kp-recovery', 'steward-current',
       'milestone', 'A current keeper milestone.', 'marker-current-create',
       '2026-08-04T03:04:05.000Z');
    INSERT INTO collector_dream_mutations
      (id, dream_id, author_user_id, action, idempotency_key, request_json,
       resulting_version, created_at)
    VALUES
      ('mutation-current', 'dream-current', 'steward-current', 'share',
       'mutation-current-share', '{"visibility":"attributed"}',
       2, '2026-08-03T03:04:05.000Z');
    INSERT INTO collector_dream_rituals
      (id, keeper_piece_id, keeper_user_id, birthday_year, action,
       prior_dream_id, resulting_dream_id, idempotency_key, completed_at)
    VALUES
      ('ritual-current', 'kp-recovery', 'steward-current', 2026, 'fulfilled',
       'dream-current', 'dream-current', 'ritual-current-fulfilled',
       '2026-08-05T03:04:05.000Z');
    COMMIT;

    INSERT INTO registry_artworks (id, title, series, created_at) VALUES
      ('UL-102', 'Ordinal First', 'Universal Language', '${exportedAt}'),
      ('UL-103', 'Ordinal Second', 'Universal Language', '${exportedAt}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, lineage_head_hash, lineage_event_count)
    VALUES
      ('kp-ordinal-first', 'UL-102', 0, 'steward-current', '${'4'.repeat(64)}',
       '2026-08-06T03:04:05.000Z', '${'5'.repeat(64)}', 1),
      ('kp-ordinal-second', 'UL-103', 0, 'steward-current', '${'6'.repeat(64)}',
       '2026-08-07T03:04:05.000Z', '${'7'.repeat(64)}', 1);
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
       event_hash, public_payload_json)
    VALUES
      ('zz-first-bound', 'kp-ordinal-first', 1, 'first_bound',
       '2026-08-06T03:04:05.000Z', NULL, '${'5'.repeat(64)}', '{}'),
      ('aa-second-bound', 'kp-ordinal-second', 1, 'first_bound',
       '2026-08-07T03:04:05.000Z', NULL, '${'7'.repeat(64)}', '{}');
    INSERT INTO collector_letters
      (id, keeper_piece_id, kind, body, created_at, event_key)
    VALUES
      ('letter-${'8'.repeat(64)}', 'kp-recovery', 'transfer',
       'This piece entered a new chapter with its keeper.',
       '2026-08-02T03:04:05.000Z', 'transfer:transfer-recovery'),
      ('letter-${'9'.repeat(64)}', 'kp-recovery', 'anniversary',
       'A year with this piece invites a quiet reflection.',
       '2026-08-05T03:04:05.000Z', 'anniversary:kp-recovery:2026');
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

const v4KeeperColumns = new Set([
  'registration_status', 'registered_by_user_id', 'identity_backup_status',
  'identity_backup_reference', 'identity_backup_sha256', 'identity_backup_at',
]);

function legacyKeeperRow(row: Record<string, unknown>, schemaVersion: 1 | 2 | 3) {
  return Object.fromEntries(Object.entries(row).filter(([column]) =>
    !v4KeeperColumns.has(column) && (schemaVersion === 3 || column !== 'last_transfer_id')));
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
  it('keeps the schema-v4 manifest immutable and adds the Phase 2 recovery boundary in v5', () => {
    assert.equal(PRIVATE_RECOVERY_SCHEMA_VERSION, 5);
    assert.deepEqual(REGISTRY_RECOVERY_V4_TABLES, [
      'user', 'account', 'users', 'profiles', 'registry_artworks',
      'registry_catalog_membership', 'keeper_pieces', 'artwork_claim_requests',
      'artwork_transfer_intents', 'artwork_transfer_parties', 'atlas_source_cities',
      'atlas_source_chains', 'atlas_source_chain_events', 'keeper_intentions',
      'piece_fulfillments', 'artwork_acquisitions', 'artwork_provenance_entries',
      'artwork_claim_evidence', 'artwork_lineage_events', 'ownership_code_audit',
      'registry_maintenance_events', 'registry_recovery_qualifications',
      'artwork_identity_recovery_qualifications', 'artwork_invitations',
      'artwork_invitation_redemptions', 'artwork_invitation_redemption_completions',
      'certificate_templates', 'certificate_assignment_operations',
      'certificate_artwork_assignments', 'certificate_artwork_overrides',
      'certificate_override_history', 'collector_curated_cities',
      'collector_person_privacy', 'collector_piece_privacy',
      'collector_consent_history', 'artwork_transfer_receipts',
    ]);
    for (const table of [
      'users',
      'profiles',
      'registry_catalog_membership',
      'artwork_identity_recovery_qualifications',
      'artwork_invitations',
      'artwork_invitation_redemptions',
      'artwork_invitation_redemption_completions',
      'certificate_templates',
      'certificate_assignment_operations',
      'certificate_artwork_assignments',
      'certificate_artwork_overrides',
      'certificate_override_history',
      'collector_curated_cities',
      'collector_person_privacy',
      'collector_piece_privacy',
      'collector_consent_history',
    ]) assert.equal(REGISTRY_RECOVERY_TABLES.includes(table as any), true, table);
    assert.equal(REGISTRY_RECOVERY_TABLES.includes('collector_letters'), true);
    assert.deepEqual(
      REGISTRY_RECOVERY_TABLES.slice(
        REGISTRY_RECOVERY_TABLES.indexOf('artwork_lineage_events'),
        REGISTRY_RECOVERY_TABLES.indexOf('collector_dream_rituals') + 1,
      ),
      [
        'artwork_lineage_events',
        'collector_claim_ordinals',
        'collector_dreams',
        'collector_dream_markers',
        'collector_dream_mutations',
        'collector_dream_rituals',
      ],
    );
  });

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
      assert.equal(payload.tables.keeper_pieces.find((row: any) => row.id === 'kp-recovery')
        ?.last_transfer_id, 'transfer-recovery');
      const originalTransfer = payload.tables.artwork_transfer_intents
        .find((row: any) => row.id === 'transfer-recovery');
      assert.equal(originalTransfer?.transfer_kind, 'gift');
      assert.equal(originalTransfer?.target_email_commitment, '3'.repeat(64));
      assert.deepEqual(payload.tables.artwork_transfer_parties
        .filter((row: any) => row.transfer_intent_id === 'transfer-recovery').map((row: any) => [
        row.party_role, row.user_id, row.public_ref,
      ]), [
        ['from', 'steward-prior', 'tp-00000000-0000-4000-8000-000000000001'],
        ['to', 'steward-current', 'tp-00000000-0000-4000-8000-000000000002'],
      ]);
      assert.equal(payload.tables.artwork_transfer_receipts
        .find((row: any) => row.id === 'receipt-recovery')?.transfer_intent_id,
      'transfer-recovery');
      const recoveredKeeper = payload.tables.keeper_pieces
        .find((row: any) => row.id === 'kp-recovery')!;
      assert.equal(recoveredKeeper.ownership_code_ciphertext, 'ENCRYPTED-OWNERSHIP-ENVELOPE');
      assert.equal(Object.keys(recoveredKeeper).some((key) => /plaintext|ownership_code$/i.test(key)), false);
      assert.deepEqual(payload.tables.user.map((row: any) => row.id), [
        'admin-user', 'consent-only', 'invite-only', 'steward-current', 'steward-prior',
      ]);
      assert.deepEqual(payload.tables.account.map((row: any) => row.id), [
        'acct-admin', 'acct-consent', 'acct-current', 'acct-invite', 'acct-prior',
      ]);
      assert.deepEqual(payload.tables.users.map((row: any) => row.id), [2, 10, 11]);
      assert.deepEqual(payload.tables.profiles.map((row: any) => row.user_id), [2, 10, 11]);
      assert.equal(payload.tables.registry_catalog_membership.length, 2);
      assert.equal(payload.tables.artwork_invitation_redemption_completions.length, 1);
      assert.equal(payload.tables.certificate_override_history.length, 2);
      assert.equal(payload.tables.collector_consent_history.length, 4);
      assert.deepEqual(payload.tables.collector_claim_ordinals.map((row: any) => [
        row.keeper_piece_id, row.first_bound_event_id, row.claim_ordinal,
      ]), [
        ['kp-invited', 'lineage-invited-bound', 1],
        ['kp-ordinal-first', 'zz-first-bound', 2],
        ['kp-ordinal-second', 'aa-second-bound', 3],
      ]);
      assert.deepEqual(payload.tables.collector_dreams.map((row: any) => [
        row.id, row.author_user_id, row.archived_at, row.record_version,
        row.last_mutation_id, row.fulfilled_at,
      ]), [
        [
          'dream-current', 'steward-current', null, 3, 'mutation-current',
          '2026-08-05T03:04:05.000Z',
        ],
        ['dream-prior', 'steward-prior', exportedAt, 3, 'mutation-prior', null],
      ]);
      assert.equal(payload.tables.collector_dream_markers.length, 2);
      assert.equal(payload.tables.collector_dream_mutations.length, 2);
      assert.deepEqual(payload.tables.collector_dream_mutations.map((row: any) => [
        row.id, row.request_json,
      ]), [
        ['mutation-current', '{"visibility":"attributed"}'],
        [
          'mutation-prior',
          '{"body":"A former keeper dream that travels with the piece.","scope":"community","expectedVersion":1}',
        ],
      ]);
      assert.equal(payload.tables.collector_dream_rituals.length, 1);
      assert.deepEqual(payload.tables.collector_letters.map((row: any) => [
        row.kind, row.event_key,
      ]), [
        ['transfer', 'transfer:transfer-recovery'],
        ['anniversary', 'anniversary:kp-recovery:2026'],
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

  it('fails closed when a consent author has no Better Auth bridge identity', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      database.exec('UPDATE users SET auth_user_id = NULL WHERE id = 10');
      await assert.rejects(() => buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt }), /registry_recovery_missing_collector_auth_user/i);
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
            ? current.tables[name].map((row) => legacyKeeperRow(row, 1))
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
      assert.equal(tableCount(target.database, 'keeper_pieces'),
        upgraded.tables.keeper_pieces.length);
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
            ? current.tables[name].map((row) => legacyKeeperRow(row, 2))
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

  it('decrypts schema v3 with identical legacy rows and empty Phase 1 tables', async () => {
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
      const v3Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 3,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V3_TABLES.map((name) => [name,
          name === 'keeper_pieces'
            ? current.tables[name].map((row) => legacyKeeperRow(row, 3))
            : current.tables[name],
        ])),
      };
      const archive = await encryptLegacyPayload(v3Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });

      for (const table of REGISTRY_RECOVERY_V3_TABLES) {
        if (table === 'keeper_pieces') continue;
        assert.equal(canonicalRecoveryJson(upgraded.tables[table]),
          canonicalRecoveryJson(v3Payload.tables[table]), table);
      }
      for (const table of REGISTRY_RECOVERY_TABLES.filter((name) =>
        !REGISTRY_RECOVERY_V3_TABLES.includes(name as any)
        && name !== 'collector_claim_ordinals')) {
        assert.deepEqual(upgraded.tables[table], [], table);
      }
      assert.deepEqual(upgraded.tables.collector_claim_ordinals, [{
        keeper_piece_id: 'kp-invited',
        first_bound_event_id: 'lineage-invited-bound',
        claim_ordinal: 1,
      }, {
        keeper_piece_id: 'kp-ordinal-first',
        first_bound_event_id: 'zz-first-bound',
        claim_ordinal: 2,
      }, {
        keeper_piece_id: 'kp-ordinal-second',
        first_bound_event_id: 'aa-second-bound',
        claim_ordinal: 3,
      }]);
      target.database.exec(buildRegistryRestoreSql(upgraded));
      assert.equal(tableCount(target.database, 'keeper_pieces'),
        upgraded.tables.keeper_pieces.length);
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('decrypts schema v4 without changing any Phase 1 row or digest input', async () => {
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
      const v4Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 4,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V4_TABLES.map((name) => [
          name, current.tables[name],
        ])),
      };
      const archive = await encryptLegacyPayload(v4Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });

      for (const table of REGISTRY_RECOVERY_V4_TABLES) {
        assert.equal(canonicalRecoveryJson(upgraded.tables[table]),
          canonicalRecoveryJson(v4Payload.tables[table]), table);
      }
      assert.deepEqual(upgraded.tables.collector_claim_ordinals, [
        {
          keeper_piece_id: 'kp-invited',
          first_bound_event_id: 'lineage-invited-bound',
          claim_ordinal: 1,
        },
        {
          keeper_piece_id: 'kp-ordinal-first',
          first_bound_event_id: 'zz-first-bound',
          claim_ordinal: 2,
        },
        {
          keeper_piece_id: 'kp-ordinal-second',
          first_bound_event_id: 'aa-second-bound',
          claim_ordinal: 3,
        },
      ]);
      for (const table of REGISTRY_RECOVERY_TABLES.filter((name) =>
        !REGISTRY_RECOVERY_V4_TABLES.includes(name as any)
        && name !== 'collector_claim_ordinals')) {
        assert.deepEqual(upgraded.tables[table], [], table);
      }

      target.database.exec(buildRegistryRestoreSql(upgraded));
      assert.deepEqual(target.database.prepare(
        `SELECT keeper_piece_id, first_bound_event_id, claim_ordinal
           FROM collector_claim_ordinals ORDER BY keeper_piece_id`,
      ).all().map((row: any) => ({ ...row })), upgraded.tables.collector_claim_ordinals);
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('restores the exact grandfathered registration shape created by migration 025', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrationsThroughOwnership);
      source.database.exec(`
        INSERT INTO registry_artworks (id, title, created_at)
        VALUES ('UL-099', 'Grandfathered Work', '${exportedAt}');
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code,
           issuance_key, ownership_code_ciphertext, ownership_code_nonce,
           ownership_code_key_version, backup_status, backup_reference, backup_sha256,
           backup_at, lineage_head_hash, lineage_event_count)
        VALUES
          ('kp-grandfathered', 'UL-099', 0, '${'1'.repeat(64)}', '${exportedAt}',
           'AR-6KQ9M2WX', 'issuance-grandfathered', 'GRANDFATHERED-ENVELOPE',
           'GRANDFATHERED-NONCE', 6, 'verified',
           'plates/AR-6KQ9M2WX/${'2'.repeat(64)}.json', '${'2'.repeat(64)}',
           '${exportedAt}', '${'3'.repeat(64)}', 1);
        INSERT INTO artwork_lineage_events
          (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
           event_hash, public_payload_json)
        VALUES
          ('lineage-grandfathered', 'kp-grandfathered', 1, 'issued', '${exportedAt}',
           NULL, '${'3'.repeat(64)}', '{"publicCode":"AR-6KQ9M2WX"}');
      `);
      source.database.exec(phase1Migrations);
      source.database.exec(phase2Migrations);
      target.database.exec(registryMigrations);
      assert.deepEqual({ ...source.database.prepare(
        `SELECT registration_status, identity_backup_status, identity_backup_reference
           FROM keeper_pieces WHERE id = 'kp-grandfathered'`,
      ).get() }, {
        registration_status: 'registered',
        identity_backup_status: null,
        identity_backup_reference: null,
      });

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
        `SELECT registration_status, identity_backup_status, identity_backup_reference
           FROM keeper_pieces WHERE id = 'kp-grandfathered'`,
      ).get() }, {
        registration_status: 'registered',
        identity_backup_status: null,
        identity_backup_reference: null,
      });
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
      const temporarilyRemovedTriggers = [
        'artwork_lineage_first_bound_assign_ordinal',
        'collector_dreams_insert_current_keeper',
        'collector_dream_markers_current_keeper',
        'collector_dream_rituals_valid_completion',
        'collector_dream_mutation_exact_application',
        'collector_dream_mutation_apply_exactly',
        'collector_dreams_runtime_update_guard',
        'collector_dream_ritual_fulfill_exactly',
      ];
      const triggerSqlBefore = new Map(temporarilyRemovedTriggers.map((trigger) => [
        trigger,
        String(target.database.prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
        ).get(trigger)?.sql).replace(/\s+/g, ' ').trim(),
      ]));

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
        `SELECT party_role, user_id, public_ref FROM artwork_transfer_parties
          WHERE transfer_intent_id = 'transfer-recovery' ORDER BY id`,
      ).all().map((row: any) => [row.party_role, row.user_id, row.public_ref]), [
        ['from', 'steward-prior', 'tp-00000000-0000-4000-8000-000000000001'],
        ['to', 'steward-current', 'tp-00000000-0000-4000-8000-000000000002'],
      ]);
      assert.equal(target.database.prepare(
        "SELECT transfer_intent_id FROM artwork_transfer_receipts WHERE id = 'receipt-recovery'",
      ).get()?.transfer_intent_id, 'transfer-recovery');
      assert.deepEqual({ ...target.database.prepare(
        `SELECT keeper_user_id, lineage_event_count, last_transfer_id
           FROM keeper_pieces WHERE id = 'kp-invited'`,
      ).get() }, {
        keeper_user_id: 'steward-current',
        lineage_event_count: 3,
        last_transfer_id: 'transfer-invited-recovery',
      });
      assert.equal(tableCount(target.database, 'artwork_invitation_redemption_completions'), 1);
      assert.equal(tableCount(target.database, 'certificate_override_history'), 2);
      assert.deepEqual(target.database.prepare(
        `SELECT keeper_piece_id, first_bound_event_id, claim_ordinal
           FROM collector_claim_ordinals ORDER BY keeper_piece_id`,
      ).all().map((row: any) => [
        row.keeper_piece_id, row.first_bound_event_id, row.claim_ordinal,
      ]), [
        ['kp-invited', 'lineage-invited-bound', 1],
        ['kp-ordinal-first', 'zz-first-bound', 2],
        ['kp-ordinal-second', 'aa-second-bound', 3],
      ]);
      assert.deepEqual(target.database.prepare(
        `SELECT id, author_user_id, archived_at, record_version, last_mutation_id,
                fulfilled_at
           FROM collector_dreams ORDER BY id`,
      ).all().map((row: any) => [
        row.id, row.author_user_id, row.archived_at, row.record_version,
        row.last_mutation_id, row.fulfilled_at,
      ]), [
        [
          'dream-current', 'steward-current', null, 3, 'mutation-current',
          '2026-08-05T03:04:05.000Z',
        ],
        ['dream-prior', 'steward-prior', exportedAt, 3, 'mutation-prior', null],
      ]);
      assert.deepEqual(target.database.prepare(
        'SELECT id, request_json FROM collector_dream_mutations ORDER BY id',
      ).all().map((row: any) => [row.id, row.request_json]), [
        ['mutation-current', '{"visibility":"attributed"}'],
        [
          'mutation-prior',
          '{"body":"A former keeper dream that travels with the piece.","scope":"community","expectedVersion":1}',
        ],
      ]);
      for (const trigger of temporarilyRemovedTriggers) {
        assert.equal(target.database.prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name = ?",
        ).get(trigger)?.count, 1, trigger);
        assert.equal(String(target.database.prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
        ).get(trigger)?.sql).replace(/\s+/g, ' ').trim(), triggerSqlBefore.get(trigger), trigger);
      }
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);

      const restoredArchive = await buildPrivateRecoveryExport({
        ...target.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const restoredPayload = await decryptPrivateRecoveryExport(restoredArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(canonicalRecoveryJson(restoredPayload.tables[table]),
          canonicalRecoveryJson(payload.tables[table]), `digest-equivalent ${table}`);
      }

      assert.throws(() => target.database.exec(sql), /registry_recovery_target_not_empty/i);
      assert.equal(tableCount(target.database, 'keeper_pieces'),
        payload.tables.keeper_pieces.length);
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
      assert.equal(tableCount(target.database, 'artwork_transfer_receipts'),
        payload.tables.artwork_transfer_receipts.length);
      assert.deepEqual(target.database.prepare(
        `SELECT target_email_commitment FROM artwork_transfer_intents
          WHERE keeper_piece_id = 'kp-recovery' ORDER BY id`,
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
      const inconsistentCertificate = structuredClone(payload) as any;
      inconsistentCertificate.tables.certificate_artwork_overrides[0].value_json = '"Tampered"';
      assert.throws(
        () => buildRegistryRestoreSql(inconsistentCertificate),
        /recovery_certificate_history_invalid/i,
      );
      const renumberedOrdinal = structuredClone(payload) as any;
      renumberedOrdinal.tables.collector_claim_ordinals[0].claim_ordinal = 99;
      assert.throws(
        () => buildRegistryRestoreSql(renumberedOrdinal),
        /recovery_claim_ordinals_invalid/i,
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
