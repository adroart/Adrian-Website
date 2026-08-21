// Tests for the four newly-wired Piece Record triggers: activation, transfer,
// bind, contribution (functions/api/_lib/pieceRecordRefresh.js's callers in
// admin/pieces/[id]/activate.js, admin/maintenance/[id]/actions.js,
// _lib/keeperClaim.js, and _lib/collectorDreams.js). Before this change only
// registration/attachment/on_demand ever wrote a record, so a collector who
// claimed or received a piece read a record frozen at registration.
//
// Uses the same real in-memory SQLite + migration approach as
// tests/record-archive.test.ts and tests/collector-dream-tiers.test.ts,
// extended through migration 042 (dynamically, so this file never drifts
// from the migrations directory the way a hand-copied list can).
//
// Run note: uses node:test's mock.module, so invoke with
// `node --import tsx --test --experimental-test-module-mocks tests/piece-record-triggers.test.ts`.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { LAUNCH_FLAGS } from '../launchFlags.ts';

/* ── admin session mock, exactly tests/record-archive.test.ts's shape ──── */

type SessionData = {
  session: { id: string };
  user: { id: string; email: string; emailVerified: boolean };
} | null;

let sessionData: SessionData = null;

/* ── controllable collector-letters stub ─────────────────────────────────
 * The real syncFirstBindCollectorLetters/syncTransferCollectorLetters
 * (_lib/collectorLetters.js) already swallow every internal error and never
 * throw. To prove the try/catch guards added around their call sites in
 * keeperClaim.js and actions.js actually hold -- not just that the real
 * implementation happens to be well-behaved today -- this stub can be told
 * to throw outright, and records every call so a test can assert the record
 * refresh still ran (or the letters call still happened) independently of
 * the other guarded block's outcome. */
let lettersBehavior: 'ok' | 'throw' = 'ok';
const letterCalls: string[] = [];
mock.module('../functions/api/_lib/collectorLetters.js', {
  namedExports: {
    async syncFirstBindCollectorLetters(_env: unknown, input: { keeperPieceId: string }) {
      letterCalls.push(`bind:${input.keeperPieceId}`);
      if (lettersBehavior === 'throw') throw new Error('letters sync boom');
      return { ok: true, created: 0 };
    },
    async syncTransferCollectorLetters(_env: unknown, input: { transferIntentId: string }) {
      letterCalls.push(`transfer:${input.transferIntentId}`);
      if (lettersBehavior === 'throw') throw new Error('letters sync boom');
      return { ok: true, created: 0 };
    },
  },
});

before(() => {
  mock.module('../lib/account/auth.server.js', {
    namedExports: {
      createAuth: () => ({
        api: { getSession: async () => sessionData },
      }),
    },
  });
});

beforeEach(() => {
  sessionData = null;
  lettersBehavior = 'ok';
  letterCalls.length = 0;
});

after(() => mock.reset());

const { onRequest: activatePiece } = await import('../functions/api/admin/pieces/[id]/activate.js');
const { onRequest: maintenanceAction } = await import('../functions/api/admin/maintenance/[id]/actions.js');
const { prepareFirstKeeperBind } = await import('../functions/api/_lib/keeperClaim.js');
const {
  createCollectorDream, setCollectorDreamTier,
} = await import('../functions/api/_lib/collectorDreams.js');
const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
const {
  recoveryDependenciesForRow, recoveryQualificationStatement,
} = await import('../functions/api/_lib/recoveryQualification.js');
const { hashRecoveryCode } = await import('../functions/api/_lib/keeper.js');
const { ensureCatalogSnapshot } = await import('../functions/api/_lib/catalogSnapshot.js');

/* ── migrations, every one through 042, read straight off disk ──────────── */

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));
function migrationsThrough042() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 42)
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
    .join('\n');
}
const MIGRATIONS = migrationsThrough042();

/* ── D1 stand-in: batch runs as one real transaction, same as the other
 * migration-042-era suites (collector-dream-tiers.test.ts, claim-silence.test.ts) ── */

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** Write-once fake R2, same shape as tests/record-archive.test.ts. */
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

async function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    ${MIGRATIONS}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES
      ('user-1', 'Artist', 'artist@example.com', 1, 1, 1),
      ('collector-a', 'Collector A', 'collector-a@example.com', 1, 1, 1),
      ('collector-b', 'Collector B', 'collector-b@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email) VALUES
      ('collector-a', 'collector-a', 'collector-a@example.com'),
      ('collector-b', 'collector-b', 'collector-b@example.com');
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    VALUES
      (1, '1982-01-15', '23:39', 'Santa Cruz', 36.9741, -122.0308,
        'America/Los_Angeles', '{}'),
      (2, '1990-01-15', '12:00', 'Denpasar', -8.67, 115.21,
        'Asia/Makassar', '{}');
  `);
  const env = {
    DB: d1(database),
    ARTWORK_REGISTRY_BACKUP: fakeBucket(),
    ADMIN_EMAILS: 'artist@example.com',
    REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret',
  };
  return { database, env };
}

function request(path: string, method: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ Origin: 'https://adrianrasmussen.com' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  return new Request(`https://adrianrasmussen.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function signIn(email = 'artist@example.com') {
  sessionData = {
    session: { id: 'session-1' },
    user: { id: 'user-1', email, emailVerified: true },
  };
}

async function unlockedCookie(env: Record<string, unknown>) {
  const token = await createRegistryUnlockToken(env, {
    userId: 'user-1', email: 'artist@example.com', session: { id: 'session-1' },
  });
  return `better-auth.session_token=test-session; registry_unlock=${token}`;
}

function piece_records(database: DatabaseSync, publicCode: string) {
  return database.prepare(
    'SELECT * FROM piece_records WHERE public_code = ? ORDER BY created_at ASC, id ASC',
  ).all(publicCode) as Array<{ trigger_event: string; record_hash: string; r2_key: string }>;
}

/* ── activation fixture: a plate ready to flip 'generated' -> 'active' ──── */

async function seedActivationReadyPiece(
  fx: Awaited<ReturnType<typeof fixture>>,
  { id, pieceId, publicCode, recoveryHash }: {
    id: string; pieceId: string; publicCode: string; recoveryHash: string;
  },
) {
  const backupSha256 = 'a'.repeat(64);
  const backupReference = `plates/${publicCode}/${backupSha256}.json`;
  const frontSha256 = 'b'.repeat(64);
  const backSha256 = 'c'.repeat(64);
  fx.database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
       plate_status, plate_generated_at, front_svg_sha256, back_svg_sha256,
       ownership_code_key_version, backup_status, backup_reference, backup_sha256,
       registered_at)
    VALUES (?1, ?2, 0, ?3, ?4, ?5, 'generated', ?6, ?7, ?8, 1, 'verified', ?9, ?10, ?6)
  `).run(
    id, pieceId, recoveryHash, publicCode, `issuance-${id}`,
    '2026-08-01T00:00:00.000Z', frontSha256, backSha256, backupReference, backupSha256,
  );
  const dependencies = recoveryDependenciesForRow(
    { ownership_code_key_version: 1, backup_reference: backupReference, backup_sha256: backupSha256 },
    fx.env,
  );
  await recoveryQualificationStatement(fx.env.DB, {
    keeperPieceId: id, result: 'passed', copiedArtifacts: true, dependencies,
    administrator: { userId: 'admin-1', email: 'admin@example.com' },
  }).run();
  await ensureCatalogSnapshot(fx.env, {
    id: pieceId, title: `Piece ${pieceId}`, series: 'Universal Language',
    category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
    description: 'A trigger-test fixture piece.',
  }, { source: 'mockData', createdAt: '2026-08-01T00:00:00.000Z' });
  return { id, pieceId, publicCode, frontSha256, backSha256 };
}

function activationBody(piece: { frontSha256: string; backSha256: string }) {
  return {
    realMetalQrScanned: true,
    artworkEditionPublicCodeMatch: true,
    undersideOwnershipCodeMatch: true,
    attachmentAndAbrasionInspected: true,
    frontSha256: piece.frontSha256,
    undersideSha256: piece.backSha256,
  };
}

describe('activation trigger (functions/api/admin/pieces/[id]/activate.js)', () => {
  it('publishes a Piece Record with trigger_event activation on a fresh activation', async () => {
    const fx = await fixture();
    const piece = await seedActivationReadyPiece(fx, {
      id: 'kp-act-ok', pieceId: 'UL-810', publicCode: 'AR-7KQ9M2WX', recoveryHash: 'd'.repeat(64),
    });
    signIn();
    const cookie = await unlockedCookie(fx.env);

    const response = await activatePiece({
      request: request(`/api/admin/pieces/${piece.id}/activate`, 'POST', activationBody(piece), cookie),
      env: fx.env, params: { id: piece.id },
    });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.plateStatus, 'active');
    assert.equal(body.record.status, 'generated');
    assert.equal(body.record.publicCode, piece.publicCode);

    const rows = piece_records(fx.database, piece.publicCode);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].trigger_event, 'activation');
    assert.equal(rows[0].record_hash, body.record.recordHash);
  });

  it('THE MOST IMPORTANT ONE: a record-publish failure never turns a committed activation into a failure', async () => {
    const fx = await fixture();
    const piece = await seedActivationReadyPiece(fx, {
      id: 'kp-act-fail', pieceId: 'UL-811', publicCode: 'AR-8LR3N5XY', recoveryHash: 'e'.repeat(64),
    });
    signIn();
    const cookie = await unlockedCookie(fx.env);
    fx.env.ARTWORK_REGISTRY_BACKUP.failPut = true;

    const response = await activatePiece({
      request: request(`/api/admin/pieces/${piece.id}/activate`, 'POST', activationBody(piece), cookie),
      env: fx.env, params: { id: piece.id },
    });
    // Never a 500, never activation_conflict: the D1 batch already committed
    // plate_status = 'active' before the record publish is even attempted.
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.plateStatus, 'active');
    assert.equal(body.record.status, 'failed');
    assert.equal(body.record.error, 'record_storage_failed');

    const row = fx.database.prepare(
      'SELECT plate_status FROM keeper_pieces WHERE id = ?',
    ).get(piece.id) as any;
    assert.equal(row.plate_status, 'active');
    assert.equal(piece_records(fx.database, piece.publicCode).length, 0);

    // The retry with R2 healthy again must see the idempotent arm (already
    // active), not activation_conflict -- the exact failure mode the shared
    // helper's never-throws contract exists to prevent.
    fx.env.ARTWORK_REGISTRY_BACKUP.failPut = false;
    const retry = await activatePiece({
      request: request(`/api/admin/pieces/${piece.id}/activate`, 'POST', activationBody(piece), cookie),
      env: fx.env, params: { id: piece.id },
    });
    assert.equal(retry.status, 200);
    const retryBody = await retry.json() as any;
    assert.equal(retryBody.idempotent, true);
    assert.equal(retryBody.plateStatus, 'active');
  });
});

/* ── transfer fixture: a bound piece ready for admin steward transfer ──── */

async function seedBoundPiece(
  fx: Awaited<ReturnType<typeof fixture>>,
  { id, pieceId, publicCode, keeperUserId }: {
    id: string; pieceId: string; publicCode: string; keeperUserId: string;
  },
) {
  fx.database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, public_code,
       plate_status, keeper_user_id, claimed_at, registered_at, steward_version)
    VALUES (?1, ?2, 0, ?3, ?4, 'active', ?5, ?6, ?6, 0)
  `).run(id, pieceId, `hash-${id}`, publicCode, keeperUserId, '2026-08-01T00:00:00.000Z');
  await ensureCatalogSnapshot(fx.env, {
    id: pieceId, title: `Piece ${pieceId}`, series: 'Universal Language',
    category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
    description: 'A trigger-test fixture piece.',
  }, { source: 'mockData', createdAt: '2026-08-01T00:00:00.000Z' });
}

function transferBody(overrides: Record<string, unknown> = {}) {
  return {
    action: 'transfer_steward',
    targetEmail: 'collector-b@example.com',
    transferKind: 'gift',
    reason: 'A trigger-wiring test transfer.',
    idempotencyKey: 'transfer-trigger-test',
    expectedStewardVersion: 0,
    ...overrides,
  };
}

describe('transfer trigger (functions/api/admin/maintenance/[id]/actions.js)', () => {
  it('publishes a Piece Record with trigger_event transfer, and the replay path never appends a second row', async () => {
    const fx = await fixture();
    await seedBoundPiece(fx, {
      id: 'kp-transfer-1', pieceId: 'UL-820', publicCode: 'AR-9MS4P6YZ', keeperUserId: 'collector-a',
    });
    signIn();
    const cookie = await unlockedCookie(fx.env);

    const first = await maintenanceAction({
      request: request('/api/admin/maintenance/kp-transfer-1/actions', 'POST', transferBody(), cookie),
      env: fx.env, params: { id: 'kp-transfer-1' },
    });
    assert.equal(first.status, 200);
    const firstBody = await first.json() as any;
    assert.equal(firstBody.replayed, false);
    assert.equal(firstBody.record.status, 'generated');
    assert.equal(firstBody.record.publicCode, 'AR-9MS4P6YZ');
    assert.ok(letterCalls.some((call) => call.startsWith('transfer:')));

    const rowsAfterFirst = piece_records(fx.database, 'AR-9MS4P6YZ');
    assert.equal(rowsAfterFirst.length, 1);
    assert.equal(rowsAfterFirst[0].trigger_event, 'transfer');

    // The exact same request again: an idempotent replay. No second record row.
    const replay = await maintenanceAction({
      request: request('/api/admin/maintenance/kp-transfer-1/actions', 'POST', transferBody(), cookie),
      env: fx.env, params: { id: 'kp-transfer-1' },
    });
    assert.equal(replay.status, 200);
    const replayBody = await replay.json() as any;
    assert.equal(replayBody.replayed, true);
    assert.equal(piece_records(fx.database, 'AR-9MS4P6YZ').length, 1);
  });

  it('never lets a failing collector-letters sync escape as a 500 on an already-committed transfer', async () => {
    const fx = await fixture();
    await seedBoundPiece(fx, {
      id: 'kp-transfer-2', pieceId: 'UL-821', publicCode: 'AR-3ND6Q8ZA', keeperUserId: 'collector-a',
    });
    signIn();
    const cookie = await unlockedCookie(fx.env);
    lettersBehavior = 'throw';

    const response = await maintenanceAction({
      request: request('/api/admin/maintenance/kp-transfer-2/actions', 'POST', transferBody({
        idempotencyKey: 'transfer-letters-fail',
      }), cookie),
      env: fx.env, params: { id: 'kp-transfer-2' },
    });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.replayed, false);
    // The transfer committed and the record still published, despite the
    // letters sync throwing.
    assert.equal(body.record.status, 'generated');
    const stored = fx.database.prepare(
      "SELECT keeper_user_id FROM keeper_pieces WHERE id = 'kp-transfer-2'",
    ).get() as any;
    assert.equal(stored.keeper_user_id, 'collector-b');
  });
});

/* ── bind trigger: prepareFirstKeeperBind + afterCommit, called directly ── */

async function seedBindReadyPiece(
  fx: Awaited<ReturnType<typeof fixture>>,
  { id, pieceId, publicCode, ownershipCode }: {
    id: string; pieceId: string; publicCode: string; ownershipCode: string;
  },
) {
  const backupSha256 = 'a'.repeat(64);
  const backupReference = `plates/${publicCode}/${backupSha256}.json`;
  fx.database.prepare(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       public_code, issuance_key, plate_status, backup_status,
       backup_reference, backup_sha256, ownership_code_key_version, registered_at)
    VALUES (?1, ?2, 0, NULL, ?3, ?4, ?5, 'active', 'verified', ?6, ?7, 1, ?8)
  `).run(
    id, pieceId, await hashRecoveryCode(ownershipCode), publicCode, `issuance-${id}`,
    backupReference, backupSha256, '2026-07-01T00:00:00.000Z',
  );
  const dependencies = recoveryDependenciesForRow(
    { ownership_code_key_version: 1, backup_reference: backupReference, backup_sha256: backupSha256 },
    fx.env,
  );
  await recoveryQualificationStatement(fx.env.DB, {
    keeperPieceId: id, result: 'passed', copiedArtifacts: true, dependencies,
    administrator: { userId: 'admin-1', email: 'admin@example.com' },
  }).run();
  await ensureCatalogSnapshot(fx.env, {
    id: pieceId, title: `Piece ${pieceId}`, series: 'Universal Language',
    category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
    description: 'A trigger-test fixture piece.',
  }, { source: 'mockData', createdAt: '2026-08-01T00:00:00.000Z' });
  const row = fx.database.prepare('SELECT * FROM keeper_pieces WHERE id = ?').get(id);
  return { id, pieceId, publicCode, row };
}

describe('bind trigger (functions/api/_lib/keeperClaim.js prepareFirstKeeperBind)', () => {
  it('publishes a Piece Record with trigger_event bind on a fresh first bind', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const piece = await seedBindReadyPiece(fx, {
        id: 'kp-bind-1', pieceId: 'UL-830', publicCode: 'AR-4PT7R9AB', ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      });
      const prepared = await prepareFirstKeeperBind(fx.env, {
        piece: piece.row,
        claimant: { userId: 'collector-a', verifiedEmail: 'collector-a@example.com' },
        proof: { kind: 'ownership_code', reference: 'K7QM-9XTR-2PHV-N4WB' },
        evidence: {},
        boundAt: '2026-08-05T00:00:00.000Z',
      });
      const [updated] = await fx.env.DB.batch(prepared.statements);
      assert.equal(updated.meta.changes, 1);
      await prepared.afterCommit();

      const rows = piece_records(fx.database, piece.publicCode);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].trigger_event, 'bind');
      assert.ok(letterCalls.includes(`bind:${piece.id}`));
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });

  it('guards the letters sync and the record refresh independently: a failure in either never suppresses the other', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      // Letters throw; the record refresh must still complete.
      const pieceA = await seedBindReadyPiece(fx, {
        id: 'kp-bind-2a', pieceId: 'UL-831', publicCode: 'AR-5QU8S2CD', ownershipCode: 'L8RN-0YUS-3QIW-M5XC',
      });
      lettersBehavior = 'throw';
      const preparedA = await prepareFirstKeeperBind(fx.env, {
        piece: pieceA.row,
        claimant: { userId: 'collector-a', verifiedEmail: 'collector-a@example.com' },
        proof: { kind: 'ownership_code', reference: 'L8RN-0YUS-3QIW-M5XC' },
        evidence: {},
        boundAt: '2026-08-05T00:00:00.000Z',
      });
      await fx.env.DB.batch(preparedA.statements);
      await assert.doesNotReject(preparedA.afterCommit());
      assert.equal(piece_records(fx.database, pieceA.publicCode).length, 1, 'record still published despite letters throwing');

      // Record refresh fails (R2 down); the letters sync must still run.
      lettersBehavior = 'ok';
      letterCalls.length = 0;
      const pieceB = await seedBindReadyPiece(fx, {
        id: 'kp-bind-2b', pieceId: 'UL-832', publicCode: 'AR-6RV9T2DE', ownershipCode: 'P9SO-1ZVT-4RJX-N6YD',
      });
      fx.env.ARTWORK_REGISTRY_BACKUP.failPut = true;
      const preparedB = await prepareFirstKeeperBind(fx.env, {
        piece: pieceB.row,
        claimant: { userId: 'collector-b', verifiedEmail: 'collector-b@example.com' },
        proof: { kind: 'ownership_code', reference: 'P9SO-1ZVT-4RJX-N6YD' },
        evidence: {},
        boundAt: '2026-08-05T00:00:00.000Z',
      });
      await fx.env.DB.batch(preparedB.statements);
      await assert.doesNotReject(preparedB.afterCommit());
      assert.ok(letterCalls.includes(`bind:${pieceB.id}`), 'letters sync still ran despite the record refresh failing');
      assert.equal(piece_records(fx.database, pieceB.publicCode).length, 0, 'the failed record publish left no row');
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});

/* ── contribution trigger: setCollectorDreamTier keep -> shine ──────────── */

describe('contribution trigger (functions/api/_lib/collectorDreams.js)', () => {
  it('publishes a Piece Record whose body contains the newly shone words (the public_shared_at ordering risk)', async () => {
    const fx = await fixture();
    const wasOn = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      const publicCode = 'AR-7SW2U3EF';
      fx.database.prepare(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
           claimed_at, registered_at, public_code, plate_status)
        VALUES ('kp-contrib-1', 'UL-840', 0, 'collector-a', '${'f'.repeat(64)}',
                '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', ?, 'active')
      `).run(publicCode);
      await ensureCatalogSnapshot(fx.env, {
        id: 'UL-840', title: 'Piece UL-840', series: 'Universal Language',
        category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
        description: 'A trigger-test fixture piece.',
      }, { source: 'mockData', createdAt: '2026-08-01T00:00:00.000Z' });

      const shoneWords = 'May the light in this wood outlast us both.';
      await createCollectorDream(fx.env, {
        userId: 'collector-a', keeperPieceId: 'kp-contrib-1',
        body: shoneWords, scope: 'family',
        idempotencyKey: 'contrib-plant', now: '2026-08-02T00:00:00.000Z',
      });
      const shone = await setCollectorDreamTier(fx.env, {
        userId: 'collector-a', keeperPieceId: 'kp-contrib-1', tier: 'shine',
        idempotencyKey: 'contrib-shine', now: '2026-08-03T00:00:00.000Z',
      });
      assert.equal(shone.current?.tier, 'shine');

      const rows = piece_records(fx.database, publicCode);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].trigger_event, 'contribution');
      const stored = fx.env.ARTWORK_REGISTRY_BACKUP.objects.get(
        `records/${publicCode}/${rows[0].record_hash}.html`,
      );
      assert.ok(stored, 'the record HTML was actually written to R2');
      const html = new TextDecoder().decode(stored);
      // This is the ordering-risk assertion: the AFTER INSERT trigger on
      // collector_dream_mutations (migration 029) writes public_shared_at
      // synchronously as part of the same statement that lands within
      // setCollectorDreamTier's db.batch/run call, so by the time
      // refreshPieceRecord runs afterward, gatherShines
      // (functions/api/_lib/pieceRecord.js) already sees it. If it did not,
      // the words would be silently absent here.
      assert.match(html, /May the light in this wood outlast us both\./);

      // A seal never publishes a record: it never shines anything.
      fx.database.prepare(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
           claimed_at, registered_at, public_code, plate_status)
        VALUES ('kp-contrib-2', 'UL-841', 0, 'collector-b', '${'0'.repeat(64)}',
                '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 'AR-8TX2V4GH', 'active')
      `).run();
      await createCollectorDream(fx.env, {
        userId: 'collector-b', keeperPieceId: 'kp-contrib-2',
        body: 'Words meant for no one else, ever.', scope: 'self',
        idempotencyKey: 'contrib-plant-seal', now: '2026-08-02T00:00:00.000Z',
      });
      await setCollectorDreamTier(fx.env, {
        userId: 'collector-b', keeperPieceId: 'kp-contrib-2', tier: 'seal',
        idempotencyKey: 'contrib-seal', now: '2026-08-03T00:00:00.000Z',
      });
      assert.equal(piece_records(fx.database, 'AR-8TX2V4GH').length, 0);
    } finally {
      LAUNCH_FLAGS.livingLegacy = wasOn;
    }
  });
});
