import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { encryptOwnershipCode } from '../utils/ownershipCodeCrypto.ts';
import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';

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

const registrationMigrations = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql', '017_creator_registry_maintenance.sql',
  '018_registry_plate_lifecycle.sql', '019_registry_creator_history.sql',
  '020_registry_recovery_qualification.sql', '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
].map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).join('\n');

function openDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  return database;
}

function sqliteD1(database: DatabaseSync) {
  return {
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
      database.exec('BEGIN IMMEDIATE;');
      try {
        const results = statements.map((statement) => {
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
    assert.equal(typeof issuance.prepareOptionalPlate, 'function');
  });

  it('keeps the legacy plate endpoint replay-only and cannot mint a new identity', async () => {
    const { issueRegistryPlate } = await import('../functions/api/_lib/registryPlateIssuance.js');
    let unexpectedDatabaseWork = false;
    let batchCalled = false;
    let backupWritten = false;
    const env = {
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 4).toString('base64'),
      DB: {
        prepare(sql: string) {
          if (/SELECT \* FROM keeper_pieces WHERE issuance_key/i.test(sql)) {
            return { bind() { return this; }, async first() { return null; } };
          }
          unexpectedDatabaseWork = true;
          throw new Error(`legacy endpoint attempted new identity work: ${sql}`);
        },
        async batch() { batchCalled = true; return []; },
      },
      ARTWORK_REGISTRY_BACKUP: {
        async put() { backupWritten = true; },
      },
    };
    const response = await issueRegistryPlate(new Request('https://example.test/api/admin/pieces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pieceId: 'UL-100', editionNumber: 2, editionKind: 'numbered',
        issuanceKey: 'legacy-new-identity-attempt', uniqueConfirmed: false,
      }),
    }), env);

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'artwork_registration_required',
    });
    assert.equal(unexpectedDatabaseWork, false);
    assert.equal(batchCalled, false);
    assert.equal(backupWritten, false);
  });

  it('adds optional fabrication to the same registered identity with its own replay-safe audit', async () => {
    const issuance = await import('../functions/api/_lib/registryPlateIssuance.js');
    assert.equal(typeof issuance.prepareOptionalPlate, 'function');
    const database = openDatabase();
    const key = Buffer.alloc(32, 9).toString('base64');
    const ownershipCode = 'K7QM-9XTR-2PHV-N4WB';
    const publicCode = 'AR-7KQ9M2WX';
    const pieceId = 'UL-100';
    const editionNumber = 2;
    const registeredAt = '2026-08-09T10:00:00.000Z';
    const identityBackupSha256 = 'a'.repeat(64);
    const cryptoEnv = {
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: key,
    };
    const [envelope, verifier] = await Promise.all([
      encryptOwnershipCode(ownershipCode, { publicCode, pieceId, editionNumber }, cryptoEnv),
      hashRecoveryCode(ownershipCode),
    ]);
    const objects = new Map<string, Uint8Array>();
    const bucket = {
      async put(reference: string, value: Uint8Array) {
        if (!objects.has(reference)) objects.set(reference, new Uint8Array(value));
      },
      async get(reference: string) {
        const value = objects.get(reference);
        return value ? { async arrayBuffer() { return value.slice().buffer; } } : null;
      },
    };

    try {
      database.exec(registrationMigrations);
      database.prepare(
        `INSERT INTO keeper_pieces
           (id, piece_id, edition_number, recovery_code_hash, public_code,
            issuance_key, plate_status, registered_at, lineage_head_hash,
            lineage_event_count, ownership_code_ciphertext, ownership_code_nonce,
            ownership_code_key_version, registration_status, registered_by_user_id,
            identity_backup_status, identity_backup_reference,
            identity_backup_sha256, identity_backup_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'legacy', ?7, 'lineage-head-before',
                 3, ?8, ?9, ?10, 'registered', 'admin-register', 'verified',
                 ?11, ?12, ?13)`,
      ).run(
        'kp-registered', pieceId, editionNumber, verifier, publicCode,
        'registration-key', registeredAt, envelope.ciphertext, envelope.nonce,
        Number(envelope.keyVersion),
        `identities/${publicCode}/${identityBackupSha256}.json`,
        identityBackupSha256, registeredAt,
      );
      const baseDb = sqliteD1(database);
      let batchCalls = 0;
      const env = {
        DB: {
          ...baseDb,
          async batch(statements: any[]) {
            const results = await baseDb.batch(statements);
            batchCalls += 1;
            if (batchCalls !== 1) return results;
            return results.map((result: any, index: number) => index === 0
              ? { ...result, meta: { ...result.meta, changes: 0 } }
              : result);
          },
        },
        ARTWORK_REGISTRY_BACKUP: bucket,
        ...cryptoEnv,
      };
      const input = {
        keeperPieceId: 'kp-registered',
        idempotencyKey: 'plate-preparation-kp-registered',
        authorization: {
          userId: 'admin-fabricator',
          email: 'fabricator@example.com',
          registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
        },
        preparedAt: '2026-08-09T12:00:00.000Z',
      };
      const result: any = await issuance.prepareOptionalPlate(env, input);
      assert.equal(result.ok, true);
      assert.equal(result.replayed, true);
      assert.equal(result.ownershipCode, ownershipCode);

      const stored = database.prepare('SELECT * FROM keeper_pieces WHERE id = ?1')
        .get('kp-registered');
      assert.deepEqual({
        id: stored.id,
        publicCode: stored.public_code,
        issuanceKey: stored.issuance_key,
        recoveryHash: stored.recovery_code_hash,
        ciphertext: stored.ownership_code_ciphertext,
        nonce: stored.ownership_code_nonce,
        keyVersion: stored.ownership_code_key_version,
        keeperUserId: stored.keeper_user_id,
        lineageHead: stored.lineage_head_hash,
        lineageCount: stored.lineage_event_count,
      }, {
        id: 'kp-registered',
        publicCode,
        issuanceKey: 'registration-key',
        recoveryHash: verifier,
        ciphertext: envelope.ciphertext,
        nonce: envelope.nonce,
        keyVersion: Number(envelope.keyVersion),
        keeperUserId: null,
        lineageHead: 'lineage-head-before',
        lineageCount: 3,
      });
      assert.equal(stored.registration_status, 'registered');
      assert.equal(stored.plate_status, 'generated');
      assert.equal(stored.plate_generated_at, input.preparedAt);
      assert.match(String(stored.front_svg_sha256), /^[0-9a-f]{64}$/);
      assert.match(String(stored.back_svg_sha256), /^[0-9a-f]{64}$/);
      assert.equal(stored.backup_status, 'verified');
      assert.match(String(stored.backup_reference), /^plates\/AR-7KQ9M2WX\/[0-9a-f]{64}\.json$/);

      const event = database.prepare(
        `SELECT event_type, administrator_user_id, administrator_email, outcome
           FROM registry_maintenance_events WHERE idempotency_key = ?1`,
      ).get(input.idempotencyKey);
      assert.deepEqual({ ...event }, {
        event_type: 'plate_prepared',
        administrator_user_id: input.authorization.userId,
        administrator_email: input.authorization.email,
        outcome: 'succeeded',
      });

      const replay: any = await issuance.prepareOptionalPlate(env, input);
      assert.equal(replay.ok, true);
      assert.equal(replay.replayed, true);
      const changedTimestamp = await issuance.prepareOptionalPlate(env, {
        ...input,
        preparedAt: '2026-08-09T12:00:01.000Z',
      });
      assert.deepEqual(changedTimestamp, { ok: false, error: 'idempotency_conflict' });
      assert.equal(database.prepare(
        `SELECT COUNT(*) AS count FROM registry_maintenance_events
          WHERE idempotency_key = ?1`,
      ).get(input.idempotencyKey).count, 1);
      assert.equal(objects.size, 1);
    } finally {
      database.close();
    }
  });
});
