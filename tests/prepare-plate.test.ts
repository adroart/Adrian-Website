import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

/**
 * POST /api/admin/pieces/:id/prepare-plate — generates the optional physical
 * fabrication plate for an artwork identity that registerArtworkWithRecord
 * already minted (registration_status 'registered') but that has never had a
 * plate built (plate_status 'legacy'). Real migrations, in-memory D1 and R2,
 * modeled on tests/register-artwork.test.ts and the prepareOptionalPlate unit
 * coverage in tests/registry-plate-lifecycle.test.ts.
 */

const ORIGIN = 'https://adrianrasmussen.com';
const STEP_UP_SECRET = 'prepare-plate-step-up-secret';

const adminIdentity = {
  userId: 'admin-user',
  email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireAdmin: async () => adminIdentity,
  },
});

const { onRequest } = await import('../functions/api/admin/pieces/[id]/prepare-plate.js');
const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
const { hashRecoveryCode } = await import('../functions/api/_lib/keeper.js');
const { encryptOwnershipCode } = await import('../utils/ownershipCodeCrypto.ts');

after(() => mock.reset());

const migrationNames = [
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
];

function openDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of migrationNames) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
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

type Fixture = ReturnType<typeof makeFixture>;

function makeFixture() {
  const database = openDatabase();
  const objects = new Map<string, Uint8Array>();
  const ARTWORK_REGISTRY_BACKUP = {
    async put(key: string, value: Uint8Array | string) {
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
      objects.set(key, bytes);
    },
    async get(key: string) {
      const bytes = objects.get(key);
      return bytes ? {
        async arrayBuffer() { return bytes.slice().buffer; },
        async text() { return new TextDecoder().decode(bytes); },
      } : null;
    },
  };
  return {
    database,
    objects,
    env: {
      DB: sqliteD1(database),
      ARTWORK_REGISTRY_BACKUP,
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 9).toString('base64'),
      REGISTRY_STEP_UP_SECRET: STEP_UP_SECRET,
    } as Record<string, unknown>,
  };
}

/** A registered identity minted the way registerArtworkWithRecord mints one. */
async function insertRegisteredPiece(fixture: Fixture, options: {
  id: string;
  publicCode: string;
  pieceId?: string;
  editionNumber?: number;
  plateStatus?: string;
  ownershipCode?: string;
}) {
  const {
    id, publicCode, pieceId = 'UL-100', editionNumber = 2,
    plateStatus = 'legacy', ownershipCode = 'K7QM-9XTR-2PHV-N4WB',
  } = options;
  const registeredAt = '2026-08-09T10:00:00.000Z';
  const identityBackupSha256 = 'a'.repeat(64);
  const [envelope, verifier] = await Promise.all([
    encryptOwnershipCode(ownershipCode, { publicCode, pieceId, editionNumber }, fixture.env as any),
    hashRecoveryCode(ownershipCode),
  ]);
  fixture.database.prepare(
    `INSERT INTO keeper_pieces
       (id, piece_id, edition_number, recovery_code_hash, public_code,
        issuance_key, plate_status, registered_at, lineage_head_hash,
        lineage_event_count, ownership_code_ciphertext, ownership_code_nonce,
        ownership_code_key_version, registration_status, registered_by_user_id,
        identity_backup_status, identity_backup_reference,
        identity_backup_sha256, identity_backup_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'lineage-head-before',
             3, ?9, ?10, ?11, ?12, 'admin-register', 'verified', ?13, ?14, ?15)`,
  ).run(
    id, pieceId, editionNumber, verifier, publicCode, `issue-${id}`,
    plateStatus, registeredAt, envelope.ciphertext, envelope.nonce,
    Number(envelope.keyVersion), 'registered',
    `identities/${publicCode}/${identityBackupSha256}.json`, identityBackupSha256, registeredAt,
  );
  return { ownershipCode, publicCode, pieceId, editionNumber };
}

/** A pre-registration legacy row: no permanent identity was ever registered. */
function insertLegacyPreRegistrationPiece(fixture: Fixture, options: {
  id: string; publicCode: string; pieceId?: string; editionNumber?: number;
}) {
  const { id, publicCode, pieceId = 'UL-200', editionNumber = 1 } = options;
  fixture.database.prepare(
    `INSERT INTO keeper_pieces
       (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key, plate_status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'legacy')`,
  ).run(id, pieceId, editionNumber, `hash-${id}`, publicCode, `issue-${id}`);
}

async function invoke(fixture: Fixture, keeperPieceId: string, options: { withUnlock?: boolean } = {}) {
  const { withUnlock = true } = options;
  const headers: Record<string, string> = {};
  if (withUnlock) {
    const token = await createRegistryUnlockToken(fixture.env, adminIdentity);
    headers.Cookie = `registry_unlock=${token}`;
  }
  const request = new Request(
    `${ORIGIN}/api/admin/pieces/${encodeURIComponent(keeperPieceId)}/prepare-plate`,
    { method: 'POST', headers },
  );
  return onRequest({ request, env: fixture.env, params: { id: keeperPieceId } });
}

function rowFor(fixture: Fixture, keeperPieceId: string) {
  return fixture.database.prepare('SELECT * FROM keeper_pieces WHERE id = ?1').get(keeperPieceId) as any;
}

function auditActionsFor(fixture: Fixture, keeperPieceId: string) {
  return (fixture.database.prepare(
    'SELECT action, outcome FROM ownership_code_audit WHERE keeper_piece_id = ?1 ORDER BY created_at ASC',
  ).all(keeperPieceId) as Array<{ action: string; outcome: string }>).map((row) => ({ ...row }));
}

describe('POST /api/admin/pieces/:id/prepare-plate', () => {
  it('generates plate files for a registered legacy identity: hashes, backup, and status transition', async () => {
    const fixture = makeFixture();
    try {
      const { publicCode, ownershipCode, pieceId, editionNumber } = await insertRegisteredPiece(fixture, {
        id: 'kp-eligible-1', publicCode: 'AR-7KQ9M2WX',
      });

      const response = await invoke(fixture, 'kp-eligible-1');
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const payload = await response.json() as Record<string, unknown>;
      assert.equal(payload.ok, true);
      assert.equal(payload.plateStatus, 'generated');
      assert.equal(payload.backupStatus, 'verified');
      assert.equal(payload.ownershipCode, ownershipCode);
      assert.equal(payload.publicCode, publicCode);
      assert.match(String(payload.frontSha256), /^[0-9a-f]{64}$/);
      assert.match(String(payload.undersideSha256), /^[0-9a-f]{64}$/);
      assert.ok(payload.manifest && typeof payload.manifest === 'object');
      assert.equal((payload.manifest as Record<string, unknown>).artworkId, pieceId);
      assert.equal((payload.manifest as Record<string, unknown>).editionNumber, editionNumber);

      const row = rowFor(fixture, 'kp-eligible-1');
      assert.equal(row.plate_status, 'generated');
      assert.equal(row.registration_status, 'registered');
      assert.match(String(row.front_svg_sha256), /^[0-9a-f]{64}$/);
      assert.match(String(row.back_svg_sha256), /^[0-9a-f]{64}$/);
      assert.equal(row.front_svg_sha256, payload.frontSha256);
      assert.equal(row.back_svg_sha256, payload.undersideSha256);
      assert.equal(row.backup_status, 'verified');
      assert.match(String(row.backup_reference), /^plates\/AR-7KQ9M2WX\/[0-9a-f]{64}\.json$/);
      assert.ok(fixture.objects.has(row.backup_reference), 'the plate backup envelope was written to R2');

      const audit = auditActionsFor(fixture, 'kp-eligible-1');
      assert.deepEqual(audit, [{ action: 'prepare_plate', outcome: 'authorized' }]);
    } finally {
      fixture.database.close();
    }
  });

  it('409s a second call once the plate already exists', async () => {
    const fixture = makeFixture();
    try {
      await insertRegisteredPiece(fixture, { id: 'kp-eligible-2', publicCode: 'AR-8LR3N9YZ' });

      const first = await invoke(fixture, 'kp-eligible-2');
      assert.equal(first.status, 201);

      const second = await invoke(fixture, 'kp-eligible-2');
      assert.equal(second.status, 409);
      assert.deepEqual(await second.json(), { ok: false, error: 'plate_already_generated' });

      // The second attempt did not disturb the plate the first call generated.
      const row = rowFor(fixture, 'kp-eligible-2');
      assert.equal(row.plate_status, 'generated');
      assert.equal(auditActionsFor(fixture, 'kp-eligible-2').length, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('rejects a piece that was already generated or activated, without touching it', async () => {
    const fixture = makeFixture();
    try {
      await insertRegisteredPiece(fixture, {
        id: 'kp-already-generated', publicCode: 'AR-2QW7M4KX', plateStatus: 'generated',
        editionNumber: 3, ownershipCode: 'B2CD-3EFG-4HJK-5MNP',
      });
      await insertRegisteredPiece(fixture, {
        id: 'kp-already-active', publicCode: 'AR-3RX8N5LY', plateStatus: 'active',
        editionNumber: 4, ownershipCode: 'C3DE-4FGH-5JKM-6NPQ',
      });

      const generated = await invoke(fixture, 'kp-already-generated');
      assert.equal(generated.status, 409);
      assert.deepEqual(await generated.json(), { ok: false, error: 'plate_already_generated' });
      assert.equal(auditActionsFor(fixture, 'kp-already-generated').length, 0);

      const active = await invoke(fixture, 'kp-already-active');
      assert.equal(active.status, 409);
      assert.deepEqual(await active.json(), { ok: false, error: 'plate_already_generated' });
      assert.equal(auditActionsFor(fixture, 'kp-already-active').length, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('rejects a legacy row that was never a registered identity', async () => {
    const fixture = makeFixture();
    try {
      insertLegacyPreRegistrationPiece(fixture, { id: 'kp-legacy-only', publicCode: 'AR-4TY2P6MQ' });

      const response = await invoke(fixture, 'kp-legacy-only');
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { ok: false, error: 'piece_not_eligible' });
      assert.equal(auditActionsFor(fixture, 'kp-legacy-only').length, 0);

      const row = rowFor(fixture, 'kp-legacy-only');
      assert.equal(row.plate_status, 'legacy');
      assert.equal(row.front_svg_sha256, null);
    } finally {
      fixture.database.close();
    }
  });

  it('404s an unknown piece id', async () => {
    const fixture = makeFixture();
    try {
      const response = await invoke(fixture, 'kp-does-not-exist');
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { ok: false, error: 'piece_not_found' });
    } finally {
      fixture.database.close();
    }
  });

  it('rejects any non-POST method', async () => {
    const fixture = makeFixture();
    try {
      await insertRegisteredPiece(fixture, { id: 'kp-method-guard', publicCode: 'AR-5UZ3Q7NR' });
      const token = await createRegistryUnlockToken(fixture.env, adminIdentity);
      const request = new Request(
        `${ORIGIN}/api/admin/pieces/kp-method-guard/prepare-plate`,
        { method: 'GET', headers: { Cookie: `registry_unlock=${token}` } },
      );
      const response = await onRequest({ request, env: fixture.env, params: { id: 'kp-method-guard' } });
      assert.equal(response.status, 405);
      assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
    } finally {
      fixture.database.close();
    }
  });

  it('refuses to run without an active private-registry unlock', async () => {
    const fixture = makeFixture();
    try {
      await insertRegisteredPiece(fixture, { id: 'kp-unlock-guard', publicCode: 'AR-6VA4R8PS' });
      const response = await invoke(fixture, 'kp-unlock-guard', { withUnlock: false });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { ok: false, error: 'registry_locked' });

      const row = rowFor(fixture, 'kp-unlock-guard');
      assert.equal(row.plate_status, 'legacy');
      assert.equal(auditActionsFor(fixture, 'kp-unlock-guard').length, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('answers db_not_configured when the D1 binding is missing', async () => {
    const fixture = makeFixture();
    try {
      const token = await createRegistryUnlockToken(fixture.env, adminIdentity);
      const request = new Request(
        `${ORIGIN}/api/admin/pieces/kp-no-db/prepare-plate`,
        { method: 'POST', headers: { Cookie: `registry_unlock=${token}` } },
      );
      const response = await onRequest({
        request,
        env: { ...fixture.env, DB: undefined },
        params: { id: 'kp-no-db' },
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ok: false, error: 'db_not_configured' });
    } finally {
      fixture.database.close();
    }
  });
});
