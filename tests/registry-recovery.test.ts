import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
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
  buildVerifiedRegistryRestoreSql,
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
  REGISTRY_RECOVERY_V5_TABLES,
  REGISTRY_RECOVERY_V6_TABLES,
  REGISTRY_RECOVERY_V7_TABLES,
  REGISTRY_RECOVERY_V8_TABLES,
  REGISTRY_RECOVERY_COLUMNS,
  REGISTRY_RECOVERY_ORDER_COLUMNS,
  REGISTRY_RECOVERY_ORDER_COLUMN_TYPES,
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
\n${phase2Migrations}\n${readMigration('032_artist_verified_sales.sql')}
\n${readMigration('033_artwork_contributors.sql')}
\n${readMigration('034_artwork_contributor_invite_rate_limit.sql')}
\n${readMigration('035_city_floor_removal.sql')}
\n${readMigration('036_artwork_catalog_snapshots.sql')}
\n${readMigration('037_piece_records.sql')}
\n${readMigration('038_transfer_silence.sql')}
\n${readMigration('039_piece_media.sql')}
\n${readMigration('040_artist_messages.sql')}
\n${readMigration('041_collector_shine_removals.sql')}
\n${readMigration('042_collector_dream_tiers.sql')}`;

const exportKey = Buffer.alloc(32, 91).toString('base64');
const exportKeyId = 'registry-recovery-key-v1';
const exportedAt = '2026-07-31T03:04:05.000Z';

const legacyRecoveryTables = REGISTRY_RECOVERY_V1_TABLES;

/** Strips migration 042's collector_dreams columns for a schema < 9 legacy payload table map. */
function withoutDreamTierColumns(name: string, rows: any[]) {
  if (name !== 'collector_dreams') return rows;
  return rows.map(({ tier, heirs_may_share, ...rest }) => rest);
}

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
        : payload.schemaVersion === 4 ? REGISTRY_RECOVERY_V4_TABLES
          : payload.schemaVersion === 5 ? REGISTRY_RECOVERY_V5_TABLES
            : payload.schemaVersion === 6 ? REGISTRY_RECOVERY_V6_TABLES
              : payload.schemaVersion === 7 ? REGISTRY_RECOVERY_V7_TABLES
                : REGISTRY_RECOVERY_V8_TABLES;
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

    -- Migration 042 tier fixtures: a keep dream with heirs sharing turned
    -- off, and a sealed dream (heirs_may_share pinned to 0 by the seal
    -- insert guard). Neither piece already carries an active dream, so
    -- both satisfy collector_dreams_one_current without archiving anything.
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at,
       heirs_may_share)
    VALUES
      ('dream-tier-keep-heirs-off', 'kp-ordinal-first', 'steward-current',
       'A private keep-tier dream the keeper chose to keep from any heir.',
       'family', 'private', 'dream-tier-keep-heirs-off-create', 1,
       '2026-08-09T03:04:05.000Z', '2026-08-09T03:04:05.000Z', 0);
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at,
       tier, heirs_may_share)
    VALUES
      ('dream-tier-seal', 'kp-ordinal-second', 'steward-current',
       'A sealed dream meant for the writer alone, always.',
       'self', 'private', 'dream-tier-seal-create', 1,
       '2026-08-09T04:04:05.000Z', '2026-08-09T04:04:05.000Z',
       'seal', 0);

    -- A shine-tier dream reached through the real audited ledger, not a
    -- direct tier stamp: an already-open anonymous share on its own new
    -- piece (so it starts a lone keep-tier dream, satisfying
    -- collector_dream_tier_change_exact_application's keep-with-open-share
    -- precondition), then one collector_dream_tier_changes row that the
    -- AFTER INSERT apply-exactly trigger flips to shine.
    INSERT INTO registry_artworks (id, title, series, created_at) VALUES
      ('UL-104', 'Tier Fixture', 'Universal Language', '${exportedAt}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, lineage_head_hash, lineage_event_count)
    VALUES
      ('kp-tier-recovery', 'UL-104', 0, 'steward-current', '${'d'.repeat(64)}',
       '2026-08-08T03:04:05.000Z', '${'c'.repeat(64)}', 0);
    BEGIN IMMEDIATE;
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at,
       public_shared_at)
    VALUES
      ('dream-tier-shine', 'kp-tier-recovery', 'steward-current',
       'An anonymous dream already open when the tier model landed.',
       'planet', 'anonymous', 'dream-tier-shine-create', 1,
       '2026-08-08T03:34:05.000Z', '2026-08-08T03:34:05.000Z',
       '2026-08-08T03:34:05.000Z');
    INSERT INTO collector_dream_tier_changes
      (id, dream_id, author_user_id, from_tier, to_tier, idempotency_key,
       resulting_version, created_at)
    VALUES
      ('tier-change-shine', 'dream-tier-shine', 'steward-current', 'keep',
       'shine', 'tier-change-shine-create', 2, '2026-08-08T03:44:05.000Z');
    COMMIT;

    INSERT INTO collector_letters
      (id, keeper_piece_id, kind, body, created_at, event_key)
    VALUES
      ('letter-${'8'.repeat(64)}', 'kp-recovery', 'transfer',
       'This piece entered a new chapter with its keeper.',
       '2026-08-02T03:04:05.000Z', 'transfer:transfer-recovery'),
      ('letter-${'9'.repeat(64)}', 'kp-recovery', 'anniversary',
       'A year with this piece invites a quiet reflection.',
       '2026-08-05T03:04:05.000Z', 'anniversary:kp-recovery:2026');

    INSERT INTO artwork_catalog_snapshots
      (id, artwork_id, snapshot_hash, canonical_json, source, created_at)
    VALUES
      ('acs-ul-100-${'2'.repeat(32)}', 'UL-100', '${'2'.repeat(64)}',
       '{"category":"multidimensional-art","id":"UL-100","title":"Art of Living"}',
       'mockData', '${exportedAt}'),
      ('acs-ul-101-${'4'.repeat(32)}', 'UL-101', '${'4'.repeat(64)}',
       '{"category":"multidimensional-art","id":"UL-101","title":"Invitation Work"}',
       'admin', '${exportedAt}');
    INSERT INTO piece_records
      (id, public_code, record_hash, r2_key, trigger_event, created_at)
    VALUES
      ('pr-${'5'.repeat(64)}', 'AR-7KQ9M2WX', '${'5'.repeat(64)}',
       'records/AR-7KQ9M2WX/${'5'.repeat(64)}.html', 'registration', '${exportedAt}'),
      ('pr-${'6'.repeat(64)}', 'AR-8KQ9M2WX', '${'6'.repeat(64)}',
       'records/AR-8KQ9M2WX/${'6'.repeat(64)}.html', 'on_demand',
       '2026-08-02T03:04:05.000Z');
  `);
}

const phase3Actors = [
  ['case-creator', 'Case Creator'],
  ['record-creator', 'Record Creator'],
  ['sale-verifier', 'Sale Verifier'],
  ['reconnection-actor', 'Reconnection Actor'],
  ['record-event-actor', 'Record Event Actor'],
  ['sale-event-actor', 'Sale Event Actor'],
  ['media-uploader', 'Media Uploader'],
  ['ledger-creator', 'Ledger Creator'],
] as const;

function seedArtistSalesRecovery(database: DatabaseSync) {
  for (const [id, name] of phase3Actors) {
    database.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 1, 1)`,
    ).run(id, name, `${id}@example.com`);
    database.prepare(
      `INSERT INTO account
        (id, userId, accountId, providerId, password, createdAt, updatedAt)
       VALUES (?, ?, ?, 'credential', ?, 1, 1)`,
    ).run(`acct-${id}`, id, id, `${id}-password-hash`);
  }
  database.exec(`
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES ('historical-verifier', 'Historical Verifier',
      'historical-verifier@example.com', 1, 1, 1);
    INSERT INTO account
      (id, userId, accountId, providerId, password, createdAt, updatedAt)
    VALUES ('acct-historical-verifier', 'historical-verifier', 'historical-verifier',
      'credential', 'historical-verifier-password-hash', 1, 1);
  `);

  const digest = (value: string) => value.repeat(64).slice(0, 64);
  const saleBase = {
    reconnectionCaseId: 'reconnect-old-sale', occurrencePrecision: 'year',
    occurredOn: '2017', buyerEmail: 'collector@example.com', currency: 'USD',
    totalMinor: 600000, privateReference: 'Studio notebook 2017',
    privateNotes: 'The first remembered note.', verifiedByUserId: 'sale-verifier',
    recordedAt: exportedAt,
  };
  const saleCorrectionOne = {
    ...saleBase,
    privateNotes: 'Corrected from the studio notebook.',
    verifiedByUserId: 'historical-verifier',
  };
  const saleCorrectionTwo = { ...saleCorrectionOne, totalMinor: 610000 };
  database.exec(`
    INSERT INTO artist_reconnection_cases
      (id, recipient_email, recipient_name, private_context, status,
       created_by_user_id, idempotency_key, request_digest, created_at, updated_at)
    VALUES
      ('reconnect-old-sale', 'collector@example.com', 'Historical Collector',
       'Email-only reconnection without a complete artwork record.', 'open',
       'case-creator', 'reconnect-old-sale-create', '${digest('1')}',
       '${exportedAt}', '${exportedAt}');
    INSERT INTO artist_reconnection_cases
      (id, recipient_email, status, created_by_user_id, idempotency_key,
       request_digest, created_at, updated_at)
    VALUES
      ('Z-case', 'z-case@example.com', 'open', 'case-creator', 'Z-case-create',
       '${digest('e')}', '${exportedAt}', '${exportedAt}'),
      ('a-case', 'a-case@example.com', 'open', 'case-creator', 'a-case-create',
       '${digest('f')}', '${exportedAt}', '${exportedAt}'),
      ('é-case', 'unicode-case@example.com', 'open', 'case-creator', 'unicode-case-create',
       '${digest('0')}', '${exportedAt}', '${exportedAt}');

    INSERT INTO artist_artwork_records
      (id, artwork_id, edition_json, keeper_piece_id, identification_status,
       created_by_user_id, created_at, updated_at)
    VALUES
      ('record-linked', 'UL-101', '{"kind":"unique","number":null,"size":null}',
       'kp-invited', 'identity_linked', 'record-creator', '${exportedAt}', '${exportedAt}'),
      ('record-identified', 'UL-100', '{"kind":"unique","number":null,"size":null}',
       NULL, 'identified', 'record-creator', '${exportedAt}', '${exportedAt}'),
      ('record-corrected', NULL, NULL, NULL, 'unresolved',
       'record-creator', '${exportedAt}', '${exportedAt}');

    BEGIN IMMEDIATE;
    INSERT INTO artist_artwork_record_events
      (id, artwork_record_id, action, before_json, after_json, resulting_version,
       actor_user_id, idempotency_key, request_digest, created_at)
    VALUES
      ('record-event-identify', 'record-corrected', 'identified',
       '{"artworkId":null,"editionJson":null,"keeperPieceId":null,"identificationStatus":"unresolved","recordVersion":1}',
       '{"artworkId":"UL-102","editionJson":{"kind":"unique","number":null,"size":null},"keeperPieceId":null,"identificationStatus":"identified","recordVersion":2}',
       2, 'record-event-actor', 'record-corrected-identify', '${digest('2')}',
       '2026-08-01T03:04:05.000Z');
    UPDATE artist_artwork_records
       SET artwork_id = 'UL-102',
           edition_json = '{"kind":"unique","number":null,"size":null}',
           identification_status = 'identified', record_version = 2,
           last_event_id = 'record-event-identify', updated_at = '2026-08-01T03:04:05.000Z'
     WHERE id = 'record-corrected';
    COMMIT;

    INSERT INTO artist_verified_sales
      (id, reconnection_case_id, occurrence_precision, occurred_on, buyer_email,
       currency, total_minor, private_reference, private_notes, verified_by_user_id,
       idempotency_key, request_digest, recorded_at)
    VALUES
      ('sale-three-artworks', 'reconnect-old-sale', 'year', '2017',
       'collector@example.com', 'USD', 600000, 'Studio notebook 2017',
       'The first remembered note.', 'sale-verifier', 'sale-three-artworks-create',
       '${digest('3')}', '${exportedAt}');

    INSERT INTO artist_verified_sale_items
      (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
    VALUES
      ('sale-item-linked', 'sale-three-artworks', 'record-linked', 100000, 'USD', '${exportedAt}'),
      ('sale-item-identified', 'sale-three-artworks', 'record-identified', 200000, 'USD', '${exportedAt}'),
      ('sale-item-corrected', 'sale-three-artworks', 'record-corrected', NULL, NULL, '${exportedAt}');

    INSERT INTO artist_artwork_price_entries
      (id, artwork_record_id, sale_item_id, amount_minor, currency, occurred_on,
       occurrence_precision, recorded_at)
    VALUES
      ('price-linked', 'record-linked', 'sale-item-linked', 100000, 'USD', '2017', 'year', '${exportedAt}'),
      ('price-identified', 'record-identified', 'sale-item-identified', 200000, 'USD', '2017', 'year', '${exportedAt}');

    INSERT INTO artist_artwork_media
      (id, artwork_record_id, media_role, storage_reference, sha256, content_type,
       byte_length, uploaded_by_user_id, created_at)
    VALUES
      ('media-evidence', 'record-linked', 'identification_evidence',
       'artist-ledger/record-linked/evidence.webp',
       'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
       'image/webp', 11,
       'media-uploader', '${exportedAt}'),
      ('media-certificate', 'record-linked', 'certificate_image',
       'artist-ledger/record-linked/certificate.jpg',
       '762d1fd3665f154d08cfd678ab966ab398415ba755f2ddb884fe4abd3bf57726',
       'image/jpeg', 13,
       'media-uploader', '${exportedAt}');

    INSERT INTO artist_artwork_ledger_entries
      (id, artwork_record_id, sale_id, message, media_id, created_by_user_id,
       idempotency_key, request_digest, created_at)
    VALUES
      ('ledger-shared-linked', 'record-linked', 'sale-three-artworks',
       'A message shared across the sale.', NULL, 'ledger-creator',
       'ledger-shared-linked', '${digest('4')}', '${exportedAt}'),
      ('ledger-shared-identified', 'record-identified', 'sale-three-artworks',
       'A message shared across the sale.', NULL, 'ledger-creator',
       'ledger-shared-identified', '${digest('5')}', '${exportedAt}'),
      ('ledger-shared-corrected', 'record-corrected', 'sale-three-artworks',
       'A message shared across the sale.', NULL, 'ledger-creator',
       'ledger-shared-corrected', '${digest('6')}', '${exportedAt}'),
      ('ledger-specific', 'record-linked', 'sale-three-artworks',
       'A message for this artwork only.', 'media-certificate', 'ledger-creator',
       'ledger-specific', '${digest('7')}', '2026-08-02T03:04:05.000Z');

    INSERT INTO artist_reconnection_events
      (id, reconnection_case_id, event_type, private_note, artwork_record_id,
       actor_user_id, idempotency_key, request_digest, created_at)
    VALUES
      ('reconnect-event-note', 'reconnect-old-sale', 'note_added',
       'Collector replied with a photograph.', NULL, 'reconnection-actor',
       'reconnect-note', '${digest('8')}', '${exportedAt}'),
      ('reconnect-event-artwork', 'reconnect-old-sale', 'artwork_added',
       NULL, 'record-linked', 'reconnection-actor', 'reconnect-artwork',
       '${digest('9')}', '2026-08-01T03:04:05.000Z');
  `);
  database.prepare(
    `INSERT INTO artist_verified_sale_events
      (id, sale_id, sequence, event_type, before_json, after_json, reason,
       actor_user_id, idempotency_key, request_digest, created_at)
     VALUES (?, 'sale-three-artworks', ?, 'corrected', ?, ?, ?,
       'sale-event-actor', ?, ?, ?)`,
  ).run(
    'z-sale-correction-one', 1, JSON.stringify(saleBase), JSON.stringify(saleCorrectionOne),
    'Studio notebook clarified the note.', 'sale-correction-one', digest('c'),
    '2026-08-03T03:04:05.000Z',
  );
  database.prepare(
    `INSERT INTO artist_verified_sale_events
      (id, sale_id, sequence, event_type, before_json, after_json, reason,
       actor_user_id, idempotency_key, request_digest, created_at)
     VALUES (?, 'sale-three-artworks', ?, 'corrected', ?, ?, ?,
       'sale-event-actor', ?, ?, ?)`,
  ).run(
    'a-sale-correction-two', 2, JSON.stringify(saleCorrectionOne), JSON.stringify(saleCorrectionTwo),
    'The total included delivery.', 'sale-correction-two', digest('d'),
    '2026-08-04T03:04:05.000Z',
  );
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

const contributorUsers = [
  ['contributor-pending', 'pending-contributor@example.com'],
  ['contributor-accepted', 'accepted-contributor@example.com'],
  ['contributor-revoked', 'revoked-contributor@example.com'],
  ['contributor-expired', 'expired-contributor@example.com'],
  ['contributor-invite-revoked', 'invitation-revoked@example.com'],
  ['contributor-old-epoch', 'old-epoch-contributor@example.com'],
] as const;

function seedContributorRecovery(database: DatabaseSync) {
  const operationalRateTriggerSql = database.prepare(
    `SELECT sql FROM sqlite_master
      WHERE type = 'trigger' AND name = 'artwork_contributor_invite_rate_limit_guard'`,
  ).get()?.sql;
  if (operationalRateTriggerSql) {
    database.exec('DROP TRIGGER artwork_contributor_invite_rate_limit_guard;');
  }
  try {
  for (const [id, email] of contributorUsers) {
    database.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 1, 1)`,
    ).run(id, id, email);
    database.prepare(
      `INSERT INTO account
        (id, userId, accountId, providerId, password, createdAt, updatedAt)
       VALUES (?, ?, ?, 'credential', ?, 1, 1)`,
    ).run(`acct-${id}`, id, id, `password-${id}`);
  }
  database.exec(`
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES ('UL-200', 'Contributor Recovery', 'Universal Language', NULL, '${exportedAt}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       registered_at, claimed_at, lineage_head_hash, lineage_event_count)
    VALUES
      ('kp-contributor', 'UL-200', 0, 'steward-current', '${'7'.repeat(64)}',
       '${exportedAt}', '${exportedAt}', '${'8'.repeat(64)}', 0);

    INSERT INTO artwork_contributor_invitations
      (id, keeper_piece_id, keeper_user_id, steward_version,
       intended_recipient_user_id, intended_recipient_email, token_hash,
       idempotency_key, request_fingerprint, invited_at, expires_at)
    VALUES
      ('aci-00000000-0000-4000-8000-000000000001', 'kp-contributor',
       'steward-current', 0, 'contributor-pending', 'pending-contributor@example.com',
       '${'1'.repeat(64)}', 'contributor-pending', '${'a'.repeat(64)}',
       '2026-07-31T04:00:00.000Z', '2026-09-01T04:00:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000002', 'kp-contributor',
       'steward-current', 0, 'contributor-expired', 'expired-contributor@example.com',
       '${'2'.repeat(64)}', 'contributor-expired', '${'b'.repeat(64)}',
       '2026-07-01T04:00:00.000Z', '2026-07-02T04:00:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000003', 'kp-contributor',
       'steward-current', 0, 'contributor-invite-revoked',
       'invitation-revoked@example.com', '${'3'.repeat(64)}',
       'contributor-invitation-revoked', '${'c'.repeat(64)}',
       '2026-07-31T05:00:00.000Z', '2026-09-01T05:00:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000004', 'kp-contributor',
       'steward-current', 0, 'contributor-accepted', 'accepted-contributor@example.com',
       '${'4'.repeat(64)}', 'contributor-accepted', '${'d'.repeat(64)}',
       '2026-07-31T06:00:00.000Z', '2026-09-01T06:00:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000005', 'kp-contributor',
       'steward-current', 0, 'contributor-revoked', 'revoked-contributor@example.com',
       '${'5'.repeat(64)}', 'contributor-access-revoked', '${'e'.repeat(64)}',
       '2026-07-31T07:00:00.000Z', '2026-09-01T07:00:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000006', 'kp-recovery',
       'steward-current', 1, 'contributor-old-epoch', 'old-epoch-contributor@example.com',
       '${'6'.repeat(64)}', 'contributor-old-epoch', '${'f'.repeat(64)}',
       '2026-07-31T08:00:00.000Z', '2026-09-01T08:00:00.000Z');

    INSERT INTO artwork_contributor_revocations
      (revocation_kind, invitation_id, revoked_by_keeper_user_id, steward_version,
       idempotency_key, request_fingerprint, revoked_at)
    VALUES
      ('invitation', 'aci-00000000-0000-4000-8000-000000000003',
       'steward-current', 0, 'revoke-contributor-invitation', '${'9'.repeat(64)}',
       '2026-07-31T05:30:00.000Z');
    INSERT INTO artwork_contributor_invitation_acceptances
      (invitation_id, accepted_by_user_id, presented_token_hash,
       idempotency_key, request_fingerprint, accepted_at)
    VALUES
      ('aci-00000000-0000-4000-8000-000000000004', 'contributor-accepted',
       '${'4'.repeat(64)}', 'accept-contributor-active', '${'0'.repeat(64)}',
       '2026-07-31T06:30:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000005', 'contributor-revoked',
       '${'5'.repeat(64)}', 'accept-contributor-revoked', '${'1'.repeat(64)}',
       '2026-07-31T07:30:00.000Z'),
      ('aci-00000000-0000-4000-8000-000000000006', 'contributor-old-epoch',
       '${'6'.repeat(64)}', 'accept-contributor-old-epoch', '${'2'.repeat(64)}',
       '2026-07-31T08:30:00.000Z');
    INSERT INTO artwork_contributor_revocations
      (revocation_kind, invitation_id, revoked_by_keeper_user_id, steward_version,
       idempotency_key, request_fingerprint, revoked_at)
    VALUES
      ('access', 'aci-00000000-0000-4000-8000-000000000005',
       'steward-current', 0, 'revoke-contributor-access', '${'3'.repeat(64)}',
       '2026-07-31T08:00:00.000Z');
  `);
  appendSecondTransfer(database);
  } finally {
    if (operationalRateTriggerSql) database.exec(String(operationalRateTriggerSql));
  }
}

function tableCount(database: DatabaseSync, table: string) {
  return Number((database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as any).count);
}

function createMediaBackup(overrides: Record<string, {
  body?: string;
  contentType?: string;
}> = {}) {
  const defaults = {
    'artist-ledger/record-linked/evidence.webp': {
      body: 'hello world', contentType: 'image/webp',
    },
    'artist-ledger/record-linked/certificate.jpg': {
      body: 'certificate!!', contentType: 'image/jpeg',
    },
  };
  const objects = { ...defaults, ...overrides };
  return {
    async get(key: string) {
      const object = objects[key as keyof typeof objects];
      if (!object || object.body === undefined) return null;
      const bytes = new TextEncoder().encode(object.body);
      return {
        size: bytes.byteLength,
        httpMetadata: { contentType: object.contentType },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, Math.ceil(bytes.length / 2)));
            controller.enqueue(bytes.slice(Math.ceil(bytes.length / 2)));
            controller.close();
          },
        }),
      };
    },
  };
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
  it('freezes the schema-v7 manifest and adds both permanent-record tables in schema v8', () => {
    assert.deepEqual(REGISTRY_RECOVERY_V7_TABLES.slice(0, REGISTRY_RECOVERY_V6_TABLES.length),
      REGISTRY_RECOVERY_V6_TABLES);
    assert.deepEqual(REGISTRY_RECOVERY_V7_TABLES.slice(-4), [
      'artwork_contributor_invitations',
      'artwork_contributor_revocations',
      'artwork_contributor_invitation_acceptances',
      'artwork_contributor_access_grants',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_V8_TABLES.slice(0, REGISTRY_RECOVERY_V7_TABLES.length),
      REGISTRY_RECOVERY_V7_TABLES);
    assert.deepEqual(REGISTRY_RECOVERY_V8_TABLES.slice(-2), [
      'artwork_catalog_snapshots',
      'piece_records',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artwork_catalog_snapshots, [
      'id', 'artwork_id', 'snapshot_hash', 'canonical_json', 'source', 'created_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.piece_records, [
      'id', 'public_code', 'record_hash', 'r2_key', 'trigger_event', 'created_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMNS.artwork_catalog_snapshots, ['id']);
    assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMNS.piece_records, ['id']);
    assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMN_TYPES.artwork_catalog_snapshots, ['text']);
    assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMN_TYPES.piece_records, ['text']);
  });

  it('archives every schema-v8 permanent-record column exactly as migrations 035 and 036 define them', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec('PRAGMA foreign_keys = ON;');
      database.exec(registryMigrations);
      for (const table of REGISTRY_RECOVERY_V8_TABLES.slice(-2)) {
        assert.deepEqual(database.prepare(`PRAGMA table_info("${table}")`).all()
          .map((row: any) => row.name), REGISTRY_RECOVERY_COLUMNS[table], table);
      }
    } finally {
      database.close();
    }
  });

  it('freezes the schema-v8 manifest and adds the dream tier-change ledger in schema v9', () => {
    assert.equal(PRIVATE_RECOVERY_SCHEMA_VERSION, 9);
    assert.deepEqual(REGISTRY_RECOVERY_TABLES.slice(0, REGISTRY_RECOVERY_V8_TABLES.length),
      REGISTRY_RECOVERY_V8_TABLES);
    assert.deepEqual(REGISTRY_RECOVERY_TABLES.slice(-1), ['collector_dream_tier_changes']);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.collector_dream_tier_changes, [
      'id', 'dream_id', 'author_user_id', 'from_tier', 'to_tier', 'idempotency_key',
      'resulting_version', 'created_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.collector_dreams.slice(-2), [
      'tier', 'heirs_may_share',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMNS.collector_dream_tier_changes, ['id']);
    assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMN_TYPES.collector_dream_tier_changes, ['text']);
  });

  it('archives every schema-v9 dream-tier column exactly as migration 042 defines it', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec('PRAGMA foreign_keys = ON;');
      database.exec(registryMigrations);
      for (const table of ['collector_dreams', 'collector_dream_tier_changes'] as const) {
        assert.deepEqual(database.prepare(`PRAGMA table_info("${table}")`).all()
          .map((row: any) => row.name), REGISTRY_RECOVERY_COLUMNS[table], table);
      }
    } finally {
      database.close();
    }
  });

  it('freezes the schema-v6 manifest and adds every migration 033 private table in schema v7', () => {
    assert.deepEqual(REGISTRY_RECOVERY_V6_TABLES.slice(-10), [
      'artist_reconnection_cases',
      'artist_reconnection_events',
      'artist_artwork_records',
      'artist_artwork_record_events',
      'artist_verified_sales',
      'artist_verified_sale_events',
      'artist_verified_sale_items',
      'artist_artwork_media',
      'artist_artwork_ledger_entries',
      'artist_artwork_price_entries',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_V7_TABLES.slice(-4), [
      'artwork_contributor_invitations',
      'artwork_contributor_revocations',
      'artwork_contributor_invitation_acceptances',
      'artwork_contributor_access_grants',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artwork_contributor_invitations, [
      'id', 'keeper_piece_id', 'keeper_user_id', 'steward_version',
      'intended_recipient_user_id', 'intended_recipient_email', 'token_hash',
      'idempotency_key', 'request_fingerprint', 'invited_at', 'expires_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artwork_contributor_revocations, [
      'revocation_kind', 'invitation_id', 'revoked_by_keeper_user_id',
      'steward_version', 'idempotency_key', 'request_fingerprint', 'revoked_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artwork_contributor_invitation_acceptances, [
      'invitation_id', 'accepted_by_user_id', 'presented_token_hash',
      'idempotency_key', 'request_fingerprint', 'accepted_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artwork_contributor_access_grants, [
      'invitation_id', 'keeper_piece_id', 'contributor_user_id', 'keeper_user_id',
      'steward_version', 'granted_at',
    ]);
  });

  it('freezes the schema-v5 manifest and adds all private sale tables in schema v6', () => {
    assert.deepEqual(REGISTRY_RECOVERY_V5_TABLES, [
      'user', 'account', 'users', 'profiles', 'registry_artworks',
      'registry_catalog_membership', 'keeper_pieces', 'artwork_claim_requests',
      'artwork_transfer_intents', 'artwork_transfer_parties', 'atlas_source_cities',
      'atlas_source_chains', 'atlas_source_chain_events', 'keeper_intentions',
      'piece_fulfillments', 'artwork_acquisitions', 'artwork_provenance_entries',
      'artwork_claim_evidence', 'artwork_lineage_events', 'collector_claim_ordinals',
      'collector_dreams', 'collector_dream_markers', 'collector_dream_mutations',
      'collector_dream_rituals', 'collector_letters', 'ownership_code_audit',
      'registry_maintenance_events', 'registry_recovery_qualifications',
      'artwork_identity_recovery_qualifications', 'artwork_invitations',
      'artwork_invitation_redemptions', 'artwork_invitation_redemption_completions',
      'certificate_templates', 'certificate_assignment_operations',
      'certificate_artwork_assignments', 'certificate_artwork_overrides',
      'certificate_override_history', 'collector_curated_cities',
      'collector_person_privacy', 'collector_piece_privacy',
      'collector_consent_history', 'artwork_transfer_receipts',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_V6_TABLES.slice(-10), [
      'artist_reconnection_cases',
      'artist_reconnection_events',
      'artist_artwork_records',
      'artist_artwork_record_events',
      'artist_verified_sales',
      'artist_verified_sale_events',
      'artist_verified_sale_items',
      'artist_artwork_media',
      'artist_artwork_ledger_entries',
      'artist_artwork_price_entries',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artist_verified_sale_events, [
      'id', 'sale_id', 'sequence', 'event_type', 'before_json', 'after_json', 'reason',
      'actor_user_id', 'idempotency_key', 'request_digest', 'created_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artist_artwork_media, [
      'id', 'artwork_record_id', 'media_role', 'storage_reference', 'sha256',
      'content_type', 'byte_length', 'uploaded_by_user_id', 'created_at',
    ]);
    assert.deepEqual(REGISTRY_RECOVERY_COLUMNS.artist_artwork_price_entries, [
      'id', 'artwork_record_id', 'sale_item_id', 'amount_minor', 'currency',
      'occurred_on', 'occurrence_precision', 'recorded_at',
    ]);
  });

  it('keeps the schema-v4 manifest immutable and adds the Phase 2 recovery boundary in v5', () => {
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

  it('archives every schema-v6 sale column exactly as migration 032 defines it', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec('PRAGMA foreign_keys = ON;');
      database.exec(registryMigrations);
      for (const table of REGISTRY_RECOVERY_V6_TABLES.slice(-10)) {
        assert.deepEqual(database.prepare(`PRAGMA table_info("${table}")`).all()
          .map((row: any) => row.name), REGISTRY_RECOVERY_COLUMNS[table], table);
      }
    } finally {
      database.close();
    }
  });

  it('archives every schema-v7 contributor column exactly as migration 033 defines it', () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec('PRAGMA foreign_keys = ON;');
      database.exec(registryMigrations);
      for (const table of REGISTRY_RECOVERY_V7_TABLES.slice(-4)) {
        assert.deepEqual(database.prepare(`PRAGMA table_info("${table}")`).all()
          .map((row: any) => row.name), REGISTRY_RECOVERY_COLUMNS[table], table);
      }
      assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMNS.artwork_contributor_revocations,
        ['revocation_kind', 'invitation_id']);
      assert.deepEqual(REGISTRY_RECOVERY_ORDER_COLUMN_TYPES.artwork_contributor_revocations,
        ['text', 'text']);
    } finally {
      database.close();
    }
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
        assert.equal(statements.some((statement) =>
          /FROM "artist_reconnection_cases" ORDER BY CAST\("id" AS BLOB\) ASC/.test(
            statement.sql,
          )), true);
        assert.equal(statements.some((statement) =>
          /FROM users AS collector_user[\s\S]*ORDER BY collector_user\.id ASC/.test(
            statement.sql,
          )), true);
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

  it('exports every contributor state with exact Better Auth closure and no unrelated account', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      seedContributorRecovery(database);

      const archive = await buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });

      assert.equal(payload.tables.artwork_contributor_invitations.length, 6);
      assert.deepEqual(payload.tables.artwork_contributor_revocations.map((row: any) => [
        row.revocation_kind, row.invitation_id,
      ]), [
        ['access', 'aci-00000000-0000-4000-8000-000000000005'],
        ['invitation', 'aci-00000000-0000-4000-8000-000000000003'],
      ]);
      assert.equal(payload.tables.artwork_contributor_invitation_acceptances.length, 3);
      assert.equal(payload.tables.artwork_contributor_access_grants.length, 3);
      assert.deepEqual(contributorUsers.map(([id]) => id).filter((id) =>
        !payload.tables.user.some((row: any) => row.id === id)), []);
      assert.deepEqual(contributorUsers.map(([id]) => id).filter((id) =>
        !payload.tables.account.some((row: any) => row.userId === id)), []);
      assert.equal(payload.tables.user.some((row: any) => row.id === 'unrelated-user'), false);
      assert.equal(payload.tables.account.some((row: any) => row.userId === 'unrelated-user'), false);
    } finally {
      database.close();
    }
  });

  it('exports a complete verified sale boundary with exact actor closure and private media metadata', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      seedArtistSalesRecovery(database);

      const archive = await buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });

      assert.deepEqual(payload.tables.artist_verified_sale_items.map((row: any) => row.id), [
        'sale-item-corrected', 'sale-item-identified', 'sale-item-linked',
      ]);
      assert.deepEqual(payload.tables.artist_reconnection_cases.map((row: any) => row.id), [
        'Z-case', 'a-case', 'reconnect-old-sale', 'é-case',
      ]);
      assert.equal(payload.tables.artist_verified_sale_events.length, 2);
      assert.deepEqual(payload.tables.artist_verified_sale_events.map((row: any) => row.reason), [
        'The total included delivery.', 'Studio notebook clarified the note.',
      ]);
      assert.deepEqual(payload.tables.artist_artwork_media.map((row: any) => ({
        storageReference: row.storage_reference,
        sha256: row.sha256,
        contentType: row.content_type,
        byteLength: row.byte_length,
        role: row.media_role,
      })), [{
        storageReference: 'artist-ledger/record-linked/certificate.jpg',
        sha256: '762d1fd3665f154d08cfd678ab966ab398415ba755f2ddb884fe4abd3bf57726',
        contentType: 'image/jpeg', byteLength: 13,
        role: 'certificate_image',
      }, {
        storageReference: 'artist-ledger/record-linked/evidence.webp',
        sha256: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
        contentType: 'image/webp', byteLength: 11,
        role: 'identification_evidence',
      }]);
      assert.deepEqual(payload.tables.user
        .filter((row: any) => phase3Actors.some(([id]) => id === row.id))
        .map((row: any) => row.id), phase3Actors.map(([id]) => id).sort());
      assert.equal(payload.tables.user.some((row: any) => row.id === 'historical-verifier'), true);
      assert.equal(payload.tables.account.some((row: any) =>
        row.userId === 'historical-verifier'), true);
      assert.equal(payload.tables.user.some((row: any) => row.id === 'unrelated-user'), false);
      assert.equal(JSON.stringify(archive).includes('artist-ledger/record-linked'), false);
    } finally {
      database.close();
    }
  });

  it('fails closed when a verified-sale actor is missing from Better Auth', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      seedArtistSalesRecovery(database);
      database.exec('PRAGMA foreign_keys = OFF;');
      database.exec(`DELETE FROM account WHERE userId = 'historical-verifier';
        DELETE FROM user WHERE id = 'historical-verifier';`);
      database.exec('PRAGMA foreign_keys = ON;');

      await assert.rejects(() => buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt }), /registry_recovery_missing_referenced_user/);
    } finally {
      database.close();
    }
  });

  it('fails closed when a historical sale snapshot verifier is malformed', async () => {
    const { database, env } = createSqliteD1();
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      seedArtistSalesRecovery(database);
      database.exec(`DROP TRIGGER artist_verified_sale_events_no_update;
        UPDATE artist_verified_sale_events
           SET after_json = '{"verifiedByUserId":null}'
         WHERE id = 'z-sale-correction-one';`);

      await assert.rejects(() => buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt }), /registry_recovery_malformed_sale_event_verifier/);
    } finally {
      database.close();
    }
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
        row.last_mutation_id, row.fulfilled_at, row.tier, row.heirs_may_share,
      ]), [
        [
          'dream-current', 'steward-current', null, 3, 'mutation-current',
          '2026-08-05T03:04:05.000Z', 'keep', 1,
        ],
        [
          'dream-prior', 'steward-prior', exportedAt, 3, 'mutation-prior', null,
          'keep', 1,
        ],
        [
          'dream-tier-keep-heirs-off', 'steward-current', null, 1, null, null,
          'keep', 0,
        ],
        ['dream-tier-seal', 'steward-current', null, 1, null, null, 'seal', 0],
        ['dream-tier-shine', 'steward-current', null, 2, null, null, 'shine', 1],
      ]);
      assert.deepEqual(payload.tables.collector_dream_tier_changes.map((row: any) => [
        row.id, row.dream_id, row.author_user_id, row.from_tier, row.to_tier,
        row.resulting_version,
      ]), [
        ['tier-change-shine', 'dream-tier-shine', 'steward-current', 'keep', 'shine', 2],
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
    assert.doesNotMatch(seen.join('\n'), /artwork_acquisitions|artwork_claim_evidence|keeper_intentions|registry_maintenance_events|artwork_contributor|\buser\b|\baccount\b/i);
    assert.doesNotMatch(ledger.body, /amount_minor|private_notes|verified_email|keeper_user_id|current_display_location/i);
    assert.doesNotMatch(ledger.body, /contributor-(?:pending|accepted|revoked|old-epoch)/i);
  });
});

describe('clean-only private registry restore', () => {
  it('restores exact contributor lifecycle and epoch state with live SQL parity', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedContributorRecovery(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });
      const liveObjects = [
        ['view', 'artwork_contributor_current_access'],
        ['trigger', 'artwork_contributor_invite_reservation_guard'],
        ['trigger', 'artwork_contributor_invite_rate_limit_guard'],
        ['trigger', 'artwork_contributor_invite_reservation_complete'],
        ['trigger', 'artwork_contributor_invitation_insert_guard'],
        ['trigger', 'artwork_contributor_invitation_accept_guard'],
        ['trigger', 'artwork_contributor_invitation_accept_grant'],
        ['trigger', 'artwork_contributor_grant_guard'],
        ['trigger', 'artwork_contributor_invitation_revoke_guard'],
        ['trigger', 'artwork_contributor_access_revoke_guard'],
      ] as const;
      const normalize = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
      const beforeSql = new Map(liveObjects.map(([type, name]) => [name, normalize(
        target.database.prepare(
          'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
        ).get(type, name)?.sql,
      )]));

      target.database.exec(buildRegistryRestoreSql(payload));

      assert.deepEqual(target.database.prepare(
        `SELECT invitation_id, contributor_user_id, keeper_user_id, steward_version
           FROM artwork_contributor_current_access ORDER BY invitation_id`,
      ).all().map((row: any) => ({ ...row })), [{
        invitation_id: 'aci-00000000-0000-4000-8000-000000000004',
        contributor_user_id: 'contributor-accepted',
        keeper_user_id: 'steward-current',
        steward_version: 0,
      }]);
      assert.equal(tableCount(target.database, 'artwork_contributor_invitations'), 6);
      assert.equal(tableCount(target.database, 'artwork_contributor_invitation_acceptances'), 3);
      assert.equal(tableCount(target.database, 'artwork_contributor_access_grants'), 3);
      assert.equal(tableCount(target.database, 'artwork_contributor_revocations'), 2);
      assert.equal(tableCount(target.database, 'artwork_contributor_invite_rate_limits'), 0);
      assert.equal(tableCount(target.database, 'artwork_contributor_invite_reservations'), 0);
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);
      for (const [type, name] of liveObjects) {
        assert.equal(normalize(target.database.prepare(
          'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
        ).get(type, name)?.sql), beforeSql.get(name), name);
      }

      const restoredArchive = await buildPrivateRecoveryExport({
        ...target.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const restored = await decryptPrivateRecoveryExport(restoredArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(canonicalRecoveryJson(restored.tables[table]),
          canonicalRecoveryJson(payload.tables[table]), table);
      }
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('restores eleven historical same-hour invitations without reconstructing operational state', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedContributorRecovery(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = structuredClone(await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      }));
      const historical = payload.tables.artwork_contributor_invitations.find((row: any) =>
        row.id === 'aci-00000000-0000-4000-8000-000000000002')!;
      for (let index = 7; index <= 17; index += 1) {
        payload.tables.artwork_contributor_invitations.push({
          ...historical,
          id: `aci-00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          token_hash: index.toString(16).padStart(64, '0'),
          idempotency_key: `historical-contributor-burst-${index}`,
          request_fingerprint: (index + 32).toString(16).padStart(64, '0'),
          invited_at: `2026-07-01T04:${String(index).padStart(2, '0')}:00.000Z`,
          expires_at: `2026-07-02T04:${String(index).padStart(2, '0')}:00.000Z`,
        });
      }
      payload.tables.artwork_contributor_invitations.sort((left: any, right: any) =>
        Buffer.from(left.id).compare(Buffer.from(right.id)));

      target.database.exec(buildRegistryRestoreSql(payload));

      assert.equal(payload.tables.artwork_contributor_invitations.filter((row: any) =>
        String(row.idempotency_key).startsWith('historical-contributor-burst-')).length, 11);
      assert.equal(tableCount(target.database, 'artwork_contributor_invitations'), 17);
      assert.equal(tableCount(target.database, 'artwork_contributor_invite_rate_limits'), 0);
      assert.equal(tableCount(target.database, 'artwork_contributor_invite_reservations'), 0);
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('rolls back when an operational contributor trigger is missing or altered at recreation', async () => {
    const source = createSqliteD1();
    const missingTarget = createSqliteD1();
    const alteredTarget = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      missingTarget.database.exec(registryMigrations);
      alteredTarget.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedContributorRecovery(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });
      const sql = buildRegistryRestoreSql(payload);

      const missingMarker = 'CREATE TRIGGER artwork_contributor_invite_rate_limit_guard';
      const missingStart = sql.lastIndexOf(missingMarker);
      assert.notEqual(missingStart, -1);
      const missingSql = `${sql.slice(0, missingStart)}${sql.slice(missingStart).replace(
        missingMarker, 'CREATE TRIGGER omitted_artwork_contributor_invite_rate_limit_guard',
      )}`;
      assert.throws(() => missingTarget.database.exec(missingSql),
        /registry_recovery_incomplete_restore/i);

      const alteredMarker = 'CREATE TRIGGER artwork_contributor_invite_reservation_guard';
      const alteredStart = sql.lastIndexOf(alteredMarker);
      assert.notEqual(alteredStart, -1);
      const alteredSql = `${sql.slice(0, alteredStart)}${sql.slice(alteredStart).replace(
        "'contributor invite reservation unavailable'",
        "'altered contributor invite reservation unavailable'",
      )}`;
      assert.throws(() => alteredTarget.database.exec(alteredSql),
        /registry_recovery_incomplete_restore/i);

      for (const target of [missingTarget, alteredTarget]) {
        for (const table of REGISTRY_RECOVERY_TABLES) {
          assert.equal(tableCount(target.database, table), 0, table);
        }
        assert.equal(tableCount(target.database, 'artwork_contributor_invite_rate_limits'), 0);
        assert.equal(tableCount(target.database, 'artwork_contributor_invite_reservations'), 0);
        assert.equal(target.database.prepare(
          `SELECT COUNT(*) AS n FROM sqlite_master
            WHERE type = 'trigger'
              AND name IN (
                'artwork_contributor_invite_reservation_guard',
                'artwork_contributor_invite_rate_limit_guard',
                'artwork_contributor_invite_reservation_complete'
              )`,
        ).get().n, 3);
      }
    } finally {
      source.database.close();
      missingTarget.database.close();
      alteredTarget.database.close();
    }
  });

  it('treats contributor tables as clean-target and completion-count boundaries', async () => {
    const source = createSqliteD1();
    const occupiedTarget = createSqliteD1();
    const incompleteTarget = createSqliteD1();
    const guardlessTarget = createSqliteD1();
    const mismatchedGuardTarget = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      occupiedTarget.database.exec(registryMigrations);
      incompleteTarget.database.exec(registryMigrations);
      guardlessTarget.database.exec(registryMigrations);
      mismatchedGuardTarget.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedContributorRecovery(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });
      const sql = buildRegistryRestoreSql(payload);

      occupiedTarget.database.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TRIGGER artwork_contributor_invitation_insert_guard;
        INSERT INTO artwork_contributor_invitations
          (id, keeper_piece_id, keeper_user_id, steward_version,
           intended_recipient_user_id, intended_recipient_email, token_hash,
           idempotency_key, request_fingerprint, invited_at, expires_at)
        VALUES
          ('aci-ffffffff-ffff-4fff-8fff-ffffffffffff', 'missing-piece', 'missing-keeper',
           0, 'missing-recipient', 'missing@example.com', '${'f'.repeat(64)}',
           'occupied-contributor-target', '${'e'.repeat(64)}',
           '2026-07-31T04:00:00.000Z', '2026-09-01T04:00:00.000Z');
        PRAGMA foreign_keys = ON;
      `);
      assert.throws(() => occupiedTarget.database.exec(sql),
        /registry_recovery_target_not_empty/i);
      assert.equal(tableCount(occupiedTarget.database, 'artwork_contributor_invitations'), 1);
      assert.equal(tableCount(occupiedTarget.database, 'user'), 0);

      const contributorInsert = sql.split('\n').find((line) =>
        line.startsWith('INSERT INTO "artwork_contributor_invitations"'));
      assert.ok(contributorInsert);
      assert.throws(() => incompleteTarget.database.exec(
        sql.replace(contributorInsert, ''),
      ), /registry_recovery_incomplete_restore/i);
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(tableCount(incompleteTarget.database, table), 0, table);
      }

      const triggerMarker = 'CREATE TRIGGER artwork_contributor_access_revoke_guard';
      const triggerStart = sql.lastIndexOf(triggerMarker);
      assert.notEqual(triggerStart, -1);
      const guardlessSql = `${sql.slice(0, triggerStart)}${sql.slice(triggerStart).replace(
        triggerMarker, 'CREATE TRIGGER omitted_artwork_contributor_access_revoke_guard',
      )}`;
      assert.notEqual(guardlessSql, sql);
      assert.throws(() => guardlessTarget.database.exec(guardlessSql),
        /registry_recovery_incomplete_restore/i);
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(tableCount(guardlessTarget.database, table), 0, table);
      }
      assert.ok(guardlessTarget.database.prepare(
        `SELECT 1 FROM sqlite_master
          WHERE type = 'trigger' AND name = 'artwork_contributor_access_revoke_guard'`,
      ).get());

      const mismatchedGuardSql = `${sql.slice(0, triggerStart)}${sql.slice(triggerStart).replace(
        "'contributor access cannot be revoked'",
        "'corrupted contributor access guard'",
      )}`;
      assert.notEqual(mismatchedGuardSql, sql);
      assert.throws(() => mismatchedGuardTarget.database.exec(mismatchedGuardSql),
        /registry_recovery_incomplete_restore/i);
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(tableCount(mismatchedGuardTarget.database, table), 0, table);
      }
    } finally {
      source.database.close();
      occupiedTarget.database.close();
      incompleteTarget.database.close();
      guardlessTarget.database.close();
      mismatchedGuardTarget.database.close();
    }
  });

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

  it('decrypts schema v5 without changing any Phase 2 row or digest input', async () => {
    const source = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      const currentArchive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const current = await decryptPrivateRecoveryExport(currentArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      const v5Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 5,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V5_TABLES.map((name) => [
          name, withoutDreamTierColumns(name, current.tables[name]),
        ])),
      };
      const archive = await encryptLegacyPayload(v5Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });

      for (const table of REGISTRY_RECOVERY_V5_TABLES) {
        if (table === 'collector_dreams') continue;
        assert.equal(canonicalRecoveryJson(upgraded.tables[table]),
          canonicalRecoveryJson(v5Payload.tables[table]), table);
      }
      assert.deepEqual(upgraded.tables.collector_dreams.map((row) => row.id).sort(),
        v5Payload.tables.collector_dreams.map((row) => row.id).sort());
      for (const table of REGISTRY_RECOVERY_TABLES.slice(REGISTRY_RECOVERY_V5_TABLES.length)) {
        assert.deepEqual(upgraded.tables[table], [], table);
      }
    } finally {
      source.database.close();
    }
  });

  it('decrypts schema v6 without changing any sale row or digest input', async () => {
    const source = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedArtistSalesRecovery(source.database);
      const currentArchive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const current = await decryptPrivateRecoveryExport(currentArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      const v6Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 6,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V6_TABLES.map((name) => [
          name, withoutDreamTierColumns(name, current.tables[name]),
        ])),
      };
      const archive = await encryptLegacyPayload(v6Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });

      for (const table of REGISTRY_RECOVERY_V6_TABLES) {
        if (table === 'collector_dreams') continue;
        assert.equal(canonicalRecoveryJson(upgraded.tables[table]),
          canonicalRecoveryJson(v6Payload.tables[table]), table);
      }
      assert.deepEqual(upgraded.tables.collector_dreams.map((row) => row.id).sort(),
        v6Payload.tables.collector_dreams.map((row) => row.id).sort());
      for (const table of REGISTRY_RECOVERY_TABLES.slice(REGISTRY_RECOVERY_V6_TABLES.length)) {
        assert.deepEqual(upgraded.tables[table], [], table);
      }
    } finally {
      source.database.close();
    }
  });

  it('decrypts schema v7 without changing any contributor row or digest input', async () => {
    const source = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedArtistSalesRecovery(source.database);
      const currentArchive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const current = await decryptPrivateRecoveryExport(currentArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      assert.ok(current.tables.artwork_catalog_snapshots.length >= 2,
        'v8 fixture archives catalog snapshot rows');
      assert.ok(current.tables.piece_records.length >= 2,
        'v8 fixture archives piece record rows');
      const v7Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 7,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V7_TABLES.map((name) => [
          name, withoutDreamTierColumns(name, current.tables[name]),
        ])),
      };
      const archive = await encryptLegacyPayload(v7Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });

      assert.equal(upgraded.schemaVersion, PRIVATE_RECOVERY_SCHEMA_VERSION);
      for (const table of REGISTRY_RECOVERY_V7_TABLES) {
        if (table === 'collector_dreams') continue;
        assert.equal(canonicalRecoveryJson(upgraded.tables[table]),
          canonicalRecoveryJson(v7Payload.tables[table]), table);
      }
      assert.deepEqual(upgraded.tables.collector_dreams.map((row) => row.id).sort(),
        v7Payload.tables.collector_dreams.map((row) => row.id).sort());
      for (const table of REGISTRY_RECOVERY_TABLES.slice(REGISTRY_RECOVERY_V7_TABLES.length)) {
        assert.deepEqual(upgraded.tables[table], [], table);
      }
    } finally {
      source.database.close();
    }
  });

  it('decrypts schema v8 without changing any permanent-record row and backfills dream tiers '
    + 'exactly as migration 042 would', async () => {
    const source = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedArtistSalesRecovery(source.database);
      const currentArchive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const current = await decryptPrivateRecoveryExport(currentArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      assert.ok(current.tables.collector_dream_tier_changes.length >= 1,
        'v9 fixture archives a dream tier-change ledger row');
      const v8Payload = {
        kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
        schemaVersion: 8,
        exportedAt,
        tables: Object.fromEntries(REGISTRY_RECOVERY_V8_TABLES.map((name) => [
          name, withoutDreamTierColumns(name, current.tables[name]),
        ])),
      };
      const archive = await encryptLegacyPayload(v8Payload);
      const upgraded = await decryptPrivateRecoveryExport(archive as any, {
        key: exportKey, keyId: exportKeyId,
      });

      assert.equal(upgraded.schemaVersion, PRIVATE_RECOVERY_SCHEMA_VERSION);
      for (const table of REGISTRY_RECOVERY_V8_TABLES) {
        if (table === 'collector_dreams') continue;
        assert.equal(canonicalRecoveryJson(upgraded.tables[table]),
          canonicalRecoveryJson(v8Payload.tables[table]), table);
      }
      assert.deepEqual(upgraded.tables.collector_dream_tier_changes, [], 'no ledger yet in v8');
      // Every archived pre-tier row lands on the ALTER TABLE column defaults
      // (heirs_may_share = 1 always; tier = 'keep' unless the backfill UPDATE
      // in migration 042 would have caught it as an already-open anonymous or
      // attributed share, which lands on 'shine'). No archived row can be
      // 'seal': sealing did not exist before this schema version.
      assert.deepEqual(upgraded.tables.collector_dreams.map((row) => [
        row.id, row.tier, row.heirs_may_share,
      ]).sort((left, right) => (left[0] as string).localeCompare(right[0] as string)), [
        ['dream-current', 'shine', 1],
        ['dream-prior', 'keep', 1],
        ['dream-tier-keep-heirs-off', 'keep', 1],
        ['dream-tier-seal', 'keep', 1],
        ['dream-tier-shine', 'shine', 1],
      ]);
    } finally {
      source.database.close();
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
      source.database.exec(readMigration('032_artist_verified_sales.sql'));
      source.database.exec(readMigration('033_artwork_contributors.sql'));
      source.database.exec(readMigration('036_artwork_catalog_snapshots.sql'));
      source.database.exec(readMigration('037_piece_records.sql'));
      source.database.exec(readMigration('042_collector_dream_tiers.sql'));
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
        'collector_dreams_tier_transitions',
        'collector_dreams_seal_entry_coherence',
        'collector_dreams_seal_pins_heirs_insert',
        'collector_dreams_seal_pins_heirs_update',
        'collector_dream_tier_change_exact_application',
        'collector_dream_tier_change_apply_exactly',
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
                fulfilled_at, tier, heirs_may_share
           FROM collector_dreams ORDER BY id`,
      ).all().map((row: any) => [
        row.id, row.author_user_id, row.archived_at, row.record_version,
        row.last_mutation_id, row.fulfilled_at, row.tier, row.heirs_may_share,
      ]), [
        [
          'dream-current', 'steward-current', null, 3, 'mutation-current',
          '2026-08-05T03:04:05.000Z', 'keep', 1,
        ],
        [
          'dream-prior', 'steward-prior', exportedAt, 3, 'mutation-prior', null,
          'keep', 1,
        ],
        [
          'dream-tier-keep-heirs-off', 'steward-current', null, 1, null, null,
          'keep', 0,
        ],
        ['dream-tier-seal', 'steward-current', null, 1, null, null, 'seal', 0],
        ['dream-tier-shine', 'steward-current', null, 2, null, null, 'shine', 1],
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
      assert.deepEqual(target.database.prepare(
        `SELECT id, dream_id, author_user_id, from_tier, to_tier, resulting_version
           FROM collector_dream_tier_changes ORDER BY id`,
      ).all().map((row: any) => [
        row.id, row.dream_id, row.author_user_id, row.from_tier, row.to_tier,
        row.resulting_version,
      ]), [
        ['tier-change-shine', 'dream-tier-shine', 'steward-current', 'keep', 'shine', 2],
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

  it('preflights R2 and restores exact verified-sale rows while preserving live guards', async () => {
    const source = createSqliteD1();
    const target = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      target.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedArtistSalesRecovery(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });
      assert.throws(() => buildRegistryRestoreSql(payload),
        /registry_recovery_media_verification_required/);

      const guardedTriggers = [
        'artist_artwork_records_initial_version',
        'artist_artwork_record_events_exact_snapshot',
        'artist_artwork_records_guarded_update',
        'artist_artwork_records_no_delete',
      ];
      const triggerSqlBefore = new Map(guardedTriggers.map((trigger) => [trigger,
        String(target.database.prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
        ).get(trigger)?.sql).replace(/\s+/g, ' ').trim(),
      ]));
      const sql = await buildVerifiedRegistryRestoreSql(payload, {
        mediaBucket: createMediaBackup(),
      });
      target.database.exec(sql);

      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(tableCount(target.database, table), payload.tables[table].length, table);
      }
      assert.deepEqual(target.database.prepare(
        `SELECT id, artwork_id, identification_status, record_version, last_event_id
           FROM artist_artwork_records ORDER BY id`,
      ).all().map((row: any) => ({ ...row })), payload.tables.artist_artwork_records.map(
        ({ id, artwork_id, identification_status, record_version, last_event_id }: any) => ({
          id, artwork_id, identification_status, record_version, last_event_id,
        }),
      ));
      assert.equal(tableCount(target.database, 'artist_verified_sale_items'), 3);
      assert.equal(tableCount(target.database, 'artist_artwork_price_entries'), 2);
      assert.equal(tableCount(target.database, 'artist_verified_sale_events'), 2);
      assert.deepEqual(target.database.prepare('PRAGMA foreign_key_check').all(), []);
      for (const trigger of guardedTriggers) {
        assert.equal(String(target.database.prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
        ).get(trigger)?.sql).replace(/\s+/g, ' ').trim(), triggerSqlBefore.get(trigger), trigger);
      }

      const restoredArchive = await buildPrivateRecoveryExport({
        ...target.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const restored = await decryptPrivateRecoveryExport(restoredArchive, {
        key: exportKey, keyId: exportKeyId,
      });
      for (const table of REGISTRY_RECOVERY_TABLES) {
        assert.equal(canonicalRecoveryJson(restored.tables[table]),
          canonicalRecoveryJson(payload.tables[table]), table);
      }
    } finally {
      source.database.close();
      target.database.close();
    }
  });

  it('rejects missing or mismatched R2 media before producing restore SQL', async () => {
    const source = createSqliteD1();
    try {
      source.database.exec(registryMigrations);
      seedCompleteRegistry(source.database);
      seedArtistSalesRecovery(source.database);
      const archive = await buildPrivateRecoveryExport({
        ...source.env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const payload = await decryptPrivateRecoveryExport(archive, {
        key: exportKey, keyId: exportKeyId,
      });

      await assert.rejects(() => buildVerifiedRegistryRestoreSql(payload, {
        mediaBucket: createMediaBackup({
          'artist-ledger/record-linked/evidence.webp': { body: undefined },
        }),
      }), /registry_recovery_media_missing/);
      await assert.rejects(() => buildVerifiedRegistryRestoreSql(payload, {
        mediaBucket: createMediaBackup({
          'artist-ledger/record-linked/evidence.webp': {
            body: 'HELLO WORLD', contentType: 'image/webp',
          },
        }),
      }), /registry_recovery_media_digest_mismatch/);
      await assert.rejects(() => buildVerifiedRegistryRestoreSql(payload, {
        mediaBucket: createMediaBackup({
          'artist-ledger/record-linked/evidence.webp': {
            body: 'hello world', contentType: 'image/png',
          },
        }),
      }), /registry_recovery_media_content_type_mismatch/);
      await assert.rejects(() => buildVerifiedRegistryRestoreSql(payload, {
        mediaBucket: { async get() { throw new Error('R2 unavailable'); } },
      }), /registry_recovery_media_unreadable/);
    } finally {
      source.database.close();
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

      const restored = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, sqlPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(restored.status, 0, restored.stderr);
      assert.match(restored.stdout, /new, fully migrated recovery database/i);
      assert.match(readFileSync(sqlPath, 'utf8'), /registry_recovery_target_not_empty/i);
      assert.equal(statSync(sqlPath).mode & 0o777, 0o600);

      const noOutput = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql', archivePath, keyPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(noOutput.status, 0);
      assert.doesNotMatch(noOutput.stdout, /private acquisition note|current-password-hash/);

      const overwrite = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql', archivePath, keyPath, sqlPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(overwrite.status, 0);
      assert.match(overwrite.stderr, /refusing.*existing|already exists/i);

      const legacy = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'to-sql', archivePath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(legacy.status, 0);
      assert.doesNotMatch(legacy.stderr, /wrangler d1 execute adrian-website --remote/i);

      const tampered = structuredClone(archive) as any;
      tampered.ciphertext = `${tampered.ciphertext.slice(0, -2)}AA`;
      writeFileSync(archivePath, JSON.stringify(tampered));
      const refused = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, join(directory, 'refused.sql'),
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /authentication|broken|invalid|refusing/i);
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates V6 media-aware restore SQL only from an exact read-only local R2 copy', async () => {
    const { database, env } = createSqliteD1();
    const directory = mkdtempSync(join(tmpdir(), 'registry-media-recovery-'));
    try {
      database.exec(registryMigrations);
      seedCompleteRegistry(database);
      seedArtistSalesRecovery(database);
      const archive = await buildPrivateRecoveryExport({
        ...env,
        REGISTRY_RECOVERY_EXPORT_KEY: exportKey,
        REGISTRY_RECOVERY_EXPORT_KEY_ID: exportKeyId,
      }, { exportedAt });
      const archivePath = join(directory, 'recovery.json');
      const keyPath = join(directory, 'recovery.key');
      const mediaRoot = join(directory, 'media-copy');
      const mediaManifestPath = join(directory, 'media-manifest.json');
      mkdirSync(join(mediaRoot, 'record-linked'), { recursive: true });
      writeFileSync(join(mediaRoot, 'record-linked', 'evidence.webp'), 'hello world');
      writeFileSync(join(mediaRoot, 'record-linked', 'certificate.jpg'), 'certificate!!');
      writeFileSync(archivePath, JSON.stringify(archive));
      writeFileSync(keyPath, `${exportKeyId}\n${exportKey}\n`);
      writeFileSync(mediaManifestPath, JSON.stringify({
        version: 1,
        objects: [{
          reference: 'artist-ledger/record-linked/evidence.webp',
          file: 'record-linked/evidence.webp',
          contentType: 'image/webp',
        }, {
          reference: 'artist-ledger/record-linked/certificate.jpg',
          file: 'record-linked/certificate.jpg',
          contentType: 'image/jpeg',
        }],
      }));

      const missingOutput = join(directory, 'missing-media.sql');
      const missing = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, missingOutput,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(missing.status, 0);
      assert.equal(existsSync(missingOutput), false);

      const validOutput = join(directory, 'media-restore.sql');
      const valid = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, validOutput,
        '--media-dir', mediaRoot, '--media-manifest', mediaManifestPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(valid.status, 0, valid.stderr);
      assert.match(readFileSync(validOutput, 'utf8'), /artist_artwork_media/);
      assert.equal(statSync(validOutput).mode & 0o777, 0o600);
      assert.doesNotMatch(`${valid.stdout}\n${valid.stderr}`, /artist-ledger\//);

      writeFileSync(join(mediaRoot, 'record-linked', 'evidence.webp'), 'HELLO WORLD');
      const mismatchOutput = join(directory, 'mismatch.sql');
      const mismatch = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, mismatchOutput,
        '--media-dir', mediaRoot, '--media-manifest', mediaManifestPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(mismatch.status, 0);
      assert.equal(existsSync(mismatchOutput), false);

      writeFileSync(mediaManifestPath, JSON.stringify({
        version: 1,
        objects: [{
          reference: 'artist-ledger/record-linked/evidence.webp',
          file: '../outside.webp',
          contentType: 'image/webp',
        }],
      }));
      const traversalOutput = join(directory, 'traversal.sql');
      const traversal = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/registry-ledger.ts', 'restore-sql',
        archivePath, keyPath, traversalOutput,
        '--media-dir', mediaRoot, '--media-manifest', mediaManifestPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(traversal.status, 0);
      assert.equal(existsSync(traversalOutput), false);
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
