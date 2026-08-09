import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { registerArtwork } from '../functions/api/_lib/artworkRegistration.js';
import { prepareFirstKeeperBind } from '../functions/api/_lib/keeperClaim.js';
import { prepareOptionalPlate } from '../functions/api/_lib/registryPlateIssuance.js';
import {
  identityRecoveryDependenciesForRow,
  identityRecoveryQualificationStatement,
} from '../functions/api/_lib/recoveryQualification.js';

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

function applyRegistrationSchema(database: DatabaseSync) {
  for (const name of migrationNames) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
}

function registrationEnvironment(options: { failBackup?: boolean; failBatch?: boolean } = {}) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  applyRegistrationSchema(database);
  database.exec(`
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES
      ('SIG-100', 'Amphibian Dream', 'Signature', NULL,
       '2026-08-09T00:00:00.000Z'),
      ('SIG-101', 'Autumn Paladin', 'Signature', NULL,
       '2026-08-09T00:00:00.000Z');
  `);
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
      if (options.failBatch) throw new Error('simulated D1 failure');
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
  const objects = new Map<string, Uint8Array>();
  const ARTWORK_REGISTRY_BACKUP = {
    async put(key: string, value: Uint8Array) {
      if (options.failBackup) throw new Error('simulated R2 failure');
      objects.set(key, new Uint8Array(value));
    },
    async get(key: string) {
      const bytes = objects.get(key);
      return bytes ? { async arrayBuffer() { return bytes.slice().buffer; } } : null;
    },
  };
  return {
    database,
    objects,
    env: {
      DB,
      ARTWORK_REGISTRY_BACKUP,
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 9).toString('base64'),
    },
  };
}

function registrationInput(overrides: Record<string, unknown> = {}) {
  return {
    artworkId: 'SIG-100',
    edition: { kind: 'unique' as const },
    authorization: {
      userId: 'admin-one',
      email: 'artist@example.com',
      registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
    },
    idempotencyKey: 'register-sig-100',
    registeredAt: '2026-08-09T01:02:03.000Z',
    ...overrides,
  };
}

function revealedOwnershipCode(value: unknown): string {
  assert.ok(value && typeof value === 'object');
  const code = (value as { ownershipCode?: unknown }).ownershipCode;
  if (typeof code !== 'string') assert.fail('expected revealed Ownership Code');
  return code;
}

describe('artwork-first registration', () => {
  it('publishes the artwork registration interface before optional fabrication', () => {
    assert.equal(typeof registerArtwork, 'function');
    assert.equal(typeof prepareFirstKeeperBind, 'function');
  });

  it('adds registered identity and separate identity recovery state without rewriting existing rows', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    try {
      for (const name of migrationNames.slice(0, -1)) {
        database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
      }
      database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code,
           issuance_key, plate_status, registered_at)
        VALUES ('existing', 'UL-100', 1, '${'a'.repeat(64)}', 'AR-ABCDEFGH',
                'old-key', 'generated', '2026-08-01T00:00:00.000Z');
      `);
      database.exec(readFileSync(
        new URL('../migrations/025_artwork_registration.sql', import.meta.url),
        'utf8',
      ));
      const row = database.prepare(
        `SELECT id, plate_status, registration_status, identity_backup_reference
           FROM keeper_pieces WHERE id = 'existing'`,
      ).get();
      assert.deepEqual({ ...row }, {
        id: 'existing',
        plate_status: 'generated',
        registration_status: 'registered',
        identity_backup_reference: null,
      });
      assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
      const membershipColumns = database.prepare(
        "SELECT name FROM pragma_table_info('registry_catalog_membership') ORDER BY cid",
      ).all().map((entry) => entry.name);
      assert.deepEqual(membershipColumns, [
        'artwork_id', 'series', 'category', 'catalog_digest', 'first_seeded_at',
      ]);

      database.exec(`
        INSERT INTO registry_catalog_membership
          (artwork_id, series, category, catalog_digest, first_seeded_at)
        VALUES ('SIG-100', 'Signature', 'Multidimensional Art',
                '${'b'.repeat(64)}', '2026-08-09T02:00:00.000Z');
      `);
      for (const statement of [
        `UPDATE registry_catalog_membership SET series = 'Changed' WHERE artwork_id = 'SIG-100'`,
        `DELETE FROM registry_catalog_membership WHERE artwork_id = 'SIG-100'`,
        `INSERT INTO registry_catalog_membership
           (artwork_id, series, category, catalog_digest, first_seeded_at)
         VALUES ('SIG-101', 'Signature', 'Multidimensional Art',
                 '${'B'.repeat(64)}', '2026-08-09T02:00:00.000Z')`,
      ]) assert.throws(() => database.exec(statement));
    } finally {
      database.close();
    }
  });

  it('registers a backed-up permanent identity without creating plate or ownership artifacts', async () => {
    const fixture = registrationEnvironment();
    try {
      const result = await registerArtwork(fixture.env, registrationInput());
      const ownershipCode = revealedOwnershipCode(result);
      assert.equal(result.registrationStatus, 'registered');
      assert.equal(result.codeAccess, 'created');
      assert.match(result.publicCode, /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      assert.match(ownershipCode, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
      assert.equal(result.backupStatus, 'verified');

      const row = fixture.database.prepare(
        `SELECT registration_status, plate_status, plate_generated_at,
                plate_activated_at, front_svg_sha256, back_svg_sha256,
                keeper_user_id, claimed_at, identity_backup_status,
                identity_backup_reference, identity_backup_sha256,
                recovery_code_hash, ownership_code_ciphertext,
                ownership_code_nonce, issuance_key
           FROM keeper_pieces WHERE id = ?1`,
      ).get(result.keeperPieceId);
      assert.equal(row.registration_status, 'registered');
      assert.equal(row.plate_status, 'legacy');
      for (const field of [
        'plate_generated_at', 'plate_activated_at', 'front_svg_sha256',
        'back_svg_sha256', 'keeper_user_id', 'claimed_at',
      ]) assert.equal(row[field], null, field);
      assert.equal(row.identity_backup_status, 'verified');
      assert.match(String(row.identity_backup_reference), /^identities\/AR-/);
      assert.match(String(row.identity_backup_sha256), /^[0-9a-f]{64}$/);
      assert.notEqual(row.recovery_code_hash, ownershipCode);
      assert.notEqual(row.ownership_code_ciphertext, ownershipCode);
      assert.notEqual(row.ownership_code_nonce, ownershipCode);
      assert.equal(row.issuance_key, 'register-sig-100');
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM piece_fulfillments').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n, 1);
      assert.equal(fixture.objects.size, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('replays exactly with one audited same-admin reveal and otherwise returns identity only', async () => {
    const fixture = registrationEnvironment();
    try {
      const input = registrationInput();
      const created = await registerArtwork(fixture.env, input);
      const createdOwnershipCode = revealedOwnershipCode(created);
      const replay = await registerArtwork(fixture.env, input);
      assert.deepEqual(replay, {
        keeperPieceId: created.keeperPieceId,
        publicCode: created.publicCode,
        ownershipCode: createdOwnershipCode,
        codeAccess: 'active-unlock-replay',
        registrationStatus: 'registered',
        backupStatus: 'verified',
      });
      assert.equal(fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM ownership_code_audit WHERE action = 'registration_replay_reveal'",
      ).get().n, 1);

      const expired = await registerArtwork(fixture.env, registrationInput({
        authorization: {
          userId: 'admin-one', email: 'artist@example.com', registryUnlockExpiresAt: 1,
        },
      }));
      assert.deepEqual(expired, {
        keeperPieceId: created.keeperPieceId,
        publicCode: created.publicCode,
        codeAccess: 'audited-reveal-required',
        registrationStatus: 'registered',
        backupStatus: 'verified',
      });

      const otherAdministrator = await registerArtwork(fixture.env, registrationInput({
        authorization: {
          userId: 'admin-two', email: 'other@example.com',
          registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
        },
      }));
      assert.equal(Object.hasOwn(otherAdministrator, 'ownershipCode'), false);
      assert.equal(otherAdministrator.codeAccess, 'audited-reveal-required');
      assert.equal(fixture.objects.size, 1);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM keeper_pieces').get().n, 1);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('rejects reuse of a registration key with changed permanent identity input', async () => {
    const fixture = registrationEnvironment();
    try {
      await registerArtwork(fixture.env, registrationInput());
      await assert.rejects(
        registerArtwork(fixture.env, registrationInput({
          artworkId: 'SIG-101',
        })),
        (error: Error & { code?: string }) => error.code === 'idempotency_conflict',
      );
    } finally {
      fixture.database.close();
    }
  });

  it('treats a new server timestamp as an exact replay of the same client registration', async () => {
    const fixture = registrationEnvironment();
    try {
      const created = await registerArtwork(fixture.env, registrationInput());
      const replay = await registerArtwork(fixture.env, registrationInput({
        registeredAt: '2026-08-09T01:02:04.000Z',
      }));
      assert.equal(replay.keeperPieceId, created.keeperPieceId);
      assert.equal(replay.publicCode, created.publicCode);
      assert.equal(replay.codeAccess, 'active-unlock-replay');
    } finally {
      fixture.database.close();
    }
  });

  it('accepts the full documented registration-key length without expanding it in audit storage', async () => {
    const fixture = registrationEnvironment();
    try {
      const key = 'r'.repeat(128);
      const created = await registerArtwork(fixture.env, registrationInput({ idempotencyKey: key }));
      assert.equal(created.registrationStatus, 'registered');
      assert.equal(fixture.database.prepare(
        "SELECT idempotency_key FROM registry_maintenance_events WHERE event_type = 'artwork_registered'",
      ).get().idempotency_key, key);
    } finally {
      fixture.database.close();
    }
  });

  it('persists no identity or lineage when immutable backup persistence fails', async () => {
    const fixture = registrationEnvironment({ failBackup: true });
    try {
      await assert.rejects(
        registerArtwork(fixture.env, registrationInput()),
        (error: Error & { code?: string }) => error.code === 'identity_backup_failed',
      );
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM keeper_pieces').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM registry_maintenance_events').get().n, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('rejects an expired administrator unlock before backup or D1 for a new identity', async () => {
    const fixture = registrationEnvironment();
    try {
      await assert.rejects(
        registerArtwork(fixture.env, registrationInput({
          authorization: {
            userId: 'admin-one',
            email: 'artist@example.com',
            registryUnlockExpiresAt: 1,
          },
        })),
        (error: Error & { code?: string }) => error.code === 'registry_unlock_required',
      );
      assert.equal(fixture.objects.size, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM keeper_pieces').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM registry_maintenance_events').get().n, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('allows an unreferenced content-addressed backup after a later atomic D1 failure', async () => {
    const fixture = registrationEnvironment({ failBatch: true });
    try {
      await assert.rejects(registerArtwork(fixture.env, registrationInput()), /simulated D1 failure/);
      assert.equal(fixture.objects.size, 1);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM keeper_pieces').get().n, 0);
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM artwork_lineage_events').get().n, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('first-binds a qualified registered identity without activating a physical plate', async () => {
    const fixture = registrationEnvironment();
    try {
      const created = await registerArtwork(fixture.env, registrationInput());
      const createdOwnershipCode = revealedOwnershipCode(created);
      const piece = fixture.database.prepare(
        'SELECT * FROM keeper_pieces WHERE id = ?1',
      ).get(created.keeperPieceId);
      await identityRecoveryQualificationStatement(fixture.env.DB, {
        keeperPieceId: created.keeperPieceId,
        result: 'passed',
        copiedArtifact: true,
        dependencies: identityRecoveryDependenciesForRow(piece, fixture.env),
        administrator: { userId: 'admin-one', email: 'artist@example.com' },
        qualifiedAt: '2026-08-09T01:03:00.000Z',
        id: 'irq-registration',
      }).run();

      const prepared = await prepareFirstKeeperBind(fixture.env, {
        piece,
        claimant: { userId: 'collector-one', verifiedEmail: 'collector@example.com' },
        proof: { kind: 'ownership_code', reference: createdOwnershipCode },
        evidence: { ipAddress: '203.0.113.4', userAgent: 'Registration test' },
        boundAt: '2026-08-09T01:04:00.000Z',
      });
      const outcomes = await fixture.env.DB.batch(prepared.statements);
      assert.equal(outcomes[0].meta.changes, 1);
      assert.deepEqual(prepared.result, {
        keeper: {
          pieceId: 'SIG-100',
          editionNumber: 0,
          claimedAt: '2026-08-09T01:04:00.000Z',
        },
      });

      const bound = fixture.database.prepare(
        `SELECT keeper_user_id, claimed_at, registration_status, plate_status,
                plate_generated_at, plate_activated_at
           FROM keeper_pieces WHERE id = ?1`,
      ).get(created.keeperPieceId);
      assert.deepEqual({ ...bound }, {
        keeper_user_id: 'collector-one',
        claimed_at: '2026-08-09T01:04:00.000Z',
        registration_status: 'registered',
        plate_status: 'legacy',
        plate_generated_at: null,
        plate_activated_at: null,
      });
      assert.deepEqual(fixture.database.prepare(
        'SELECT event_type FROM artwork_lineage_events ORDER BY sequence',
      ).all().map((row) => row.event_type), ['issued', 'first_bound']);
      assert.equal(fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM artwork_claim_evidence WHERE outcome = 'first_bound'",
      ).get().n, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('keeps identity-qualified first bind available after optional plate fabrication', async () => {
    const fixture = registrationEnvironment();
    try {
      const created = await registerArtwork(fixture.env, registrationInput());
      const createdOwnershipCode = revealedOwnershipCode(created);
      let piece = fixture.database.prepare(
        'SELECT * FROM keeper_pieces WHERE id = ?1',
      ).get(created.keeperPieceId);
      const plate = await prepareOptionalPlate(fixture.env, {
        keeperPieceId: created.keeperPieceId,
        idempotencyKey: 'optional-plate-after-registration',
        authorization: {
          userId: 'admin-one', email: 'artist@example.com',
          registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
        },
        preparedAt: '2026-08-09T01:03:30.000Z',
      });
      assert.equal(plate.ok, true);
      piece = fixture.database.prepare(
        'SELECT * FROM keeper_pieces WHERE id = ?1',
      ).get(created.keeperPieceId);
      assert.equal(piece.plate_status, 'generated');
      await identityRecoveryQualificationStatement(fixture.env.DB, {
        keeperPieceId: created.keeperPieceId,
        result: 'passed',
        copiedArtifact: true,
        dependencies: identityRecoveryDependenciesForRow(piece, fixture.env),
        administrator: { userId: 'admin-one', email: 'artist@example.com' },
        qualifiedAt: '2026-08-09T01:03:45.000Z',
        id: 'irq-after-plate',
      }).run();

      const prepared = await prepareFirstKeeperBind(fixture.env, {
        piece,
        claimant: { userId: 'collector-after-plate', verifiedEmail: 'collector@example.com' },
        proof: { kind: 'ownership_code', reference: createdOwnershipCode },
        evidence: { ipAddress: null, userAgent: null },
        boundAt: '2026-08-09T01:04:00.000Z',
      });
      const outcomes = await fixture.env.DB.batch(prepared.statements);
      assert.equal(outcomes[0].meta.changes, 1);
      const bound = fixture.database.prepare(
        'SELECT keeper_user_id, plate_status, plate_activated_at FROM keeper_pieces WHERE id = ?1',
      ).get(created.keeperPieceId);
      assert.deepEqual({ ...bound }, {
        keeper_user_id: 'collector-after-plate',
        plate_status: 'generated',
        plate_activated_at: null,
      });
    } finally {
      fixture.database.close();
    }
  });
});
