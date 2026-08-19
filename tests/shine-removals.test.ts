import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';

type SessionData = {
  session: { id: string };
  user: { id: string; email: string; emailVerified: boolean };
} | null;

let sessionData: SessionData = null;

before(() => {
  mock.module('../lib/account/auth.server.js', {
    namedExports: {
      createAuth: () => ({ api: { getSession: async () => sessionData } }),
    },
  });
});

beforeEach(() => {
  sessionData = null;
});

after(() => mock.reset());

import { buildPieceRecord } from '../functions/api/_lib/pieceRecord.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/**
 * Every migration numbered 001 through 040, applied in file order. Migration
 * 037 (and, before this test was written, 038/039) is owned by another agent
 * authoring concurrently with this file: whichever of them exist on disk at
 * test-run time are picked up, so this suite is green whether or not they
 * have landed yet.
 */
function migrationsThrough040() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 40)
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
    .join('\n');
}

/** In-memory D1-shaped SQLite wrapper, including batch() (registry-maintenance.test.ts shape). */
function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      get sql() { return sql; },
      get values() { return values; },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return {
    prepare,
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

/** Write-once fake R2 matching the slice of the API pieceRecord.js uses. */
function fakeBucket() {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
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
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      objects.set(
        key,
        value instanceof Uint8Array ? value.slice() : new TextEncoder().encode(String(value)),
      );
      return {};
    },
  };
}

const PUBLIC_CODE = 'AR-ABCDEFGH';
const KEEPER_PIECE_ID = 'kp-shine-one';
const OTHER_KEEPER_PIECE_ID = 'kp-shine-two';
const REMOVE_DREAM_ID = 'dream-remove-1';
const KEEP_DREAM_ID = 'dream-keep-1';
const OTHER_PIECE_DREAM_ID = 'dream-other-piece';

const REMOVED_WORDS = 'The quiet lantern of my grandmothers hands, still lit.';
const KEPT_WORDS = 'Bright water moving over stones in April light.';

function seedRegistry(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES ('auth-keeper', 'Quiet Keeper', 'keeper@example.com', 1, 1, 1);
    INSERT INTO users (auth_user_id, clerk_user_id, email)
    VALUES ('auth-keeper', 'auth-keeper', 'keeper@example.com');
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
    SELECT id, '1980-01-15', '12:00', 'Private birthplace', 0, 0, 'UTC', '{}'
      FROM users;
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at, public_code, plate_status)
    VALUES
      ('${KEEPER_PIECE_ID}', 'UL-901', 1, 'auth-keeper', '${'a'.repeat(64)}',
       '2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
       '${PUBLIC_CODE}', 'active'),
      ('${OTHER_KEEPER_PIECE_ID}', 'UL-902', 0, 'auth-keeper', '${'b'.repeat(64)}',
       '2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
       NULL, 'active');
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at, public_shared_at)
    VALUES
      ('${REMOVE_DREAM_ID}', '${KEEPER_PIECE_ID}', 'auth-keeper',
       '${REMOVED_WORDS}', 'family', 'anonymous',
       'dream-seed-remove', 1,
       '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z',
       '2026-08-05T00:00:00.000Z'),
      ('${OTHER_PIECE_DREAM_ID}', '${OTHER_KEEPER_PIECE_ID}', 'auth-keeper',
       'A hope that belongs to the other piece entirely.', 'self', 'anonymous',
       'dream-seed-other', 1,
       '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z',
       '2026-08-05T00:00:00.000Z');
  `);
  // A second archived dream on the same piece, planted via the ritual's
  // archive-and-replace path so both the removed and kept dream can carry
  // public_shared_at at once (collector_dreams_one_current only allows one
  // *current*, non-archived row per piece).
  db.exec(`
    INSERT INTO collector_dreams
      (id, keeper_piece_id, author_user_id, body, scope, visibility,
       idempotency_key, record_version, created_at, updated_at,
       public_shared_at, archived_at)
    VALUES
      ('${KEEP_DREAM_ID}', '${KEEPER_PIECE_ID}', 'auth-keeper',
       '${KEPT_WORDS}', 'planet', 'anonymous',
       'dream-seed-keep', 1,
       '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z',
       '2026-08-04T00:00:00.000Z', '2026-08-06T00:00:00.000Z');
  `);
}

async function fixtureEnv() {
  const database = new DatabaseSync(':memory:');
  database.exec(migrationsThrough040());
  seedRegistry(database);
  const env = {
    DB: d1(database),
    ARTWORK_REGISTRY_BACKUP: fakeBucket(),
    ADMIN_EMAILS: 'artist@example.com',
    REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret',
  };
  return { database, env };
}

const ORIGIN = 'https://adrianrasmussen.com';

function request(
  path_: string,
  method: string,
  body?: unknown,
  cookie = 'better-auth.session_token=test-session',
) {
  const headers = new Headers({ Cookie: cookie, Origin: ORIGIN });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(`${ORIGIN}${path_}`, {
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

async function unlockedCookie(environment: any) {
  const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
  const token = await createRegistryUnlockToken(environment, {
    userId: 'user-1',
    email: 'artist@example.com',
    session: { id: 'session-1' },
  });
  return `better-auth.session_token=test-session; registry_unlock=${token}`;
}

function removalBody(overrides: Record<string, unknown> = {}) {
  return {
    contentId: REMOVE_DREAM_ID,
    keeperPieceId: KEEPER_PIECE_ID,
    reason: 'Abusive language reported by a visitor to the piece page.',
    idempotencyKey: 'shine-removal-seed-0001',
    ...overrides,
  };
}

describe('shine removals endpoint guards', () => {
  it('requires an admin session for GET', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    const guest = await onRequest({
      request: request(`/api/admin/shine-removals?keeperPieceId=${KEEPER_PIECE_ID}`, 'GET'),
      env,
    });
    assert.equal(guest.status, 401);

    signIn('collector@example.com');
    const nonAdmin = await onRequest({
      request: request(`/api/admin/shine-removals?keeperPieceId=${KEEPER_PIECE_ID}`, 'GET'),
      env,
    });
    assert.equal(nonAdmin.status, 403);
  });

  it('requires an admin session and the registry step-up unlock for POST', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');

    const guest = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody()), env,
    });
    assert.equal(guest.status, 401);

    signIn('collector@example.com');
    const nonAdmin = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody()), env,
    });
    assert.equal(nonAdmin.status, 403);

    signIn();
    const locked = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody()), env,
    });
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });
  });

  it('rejects unsupported methods', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    signIn();
    const cookie = await unlockedCookie(env);
    const response = await onRequest({
      request: request('/api/admin/shine-removals', 'PUT', undefined, cookie), env,
    });
    assert.equal(response.status, 405);
  });
});

describe('shine removals endpoint validation', () => {
  it('rejects malformed and unknown-field bodies', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const badJson = await onRequest({
      request: new Request(`${ORIGIN}/api/admin/shine-removals`, {
        method: 'POST',
        headers: new Headers({ Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json' }),
        body: '{not json',
      }),
      env,
    });
    assert.equal(badJson.status, 400);
    assert.deepEqual(await badJson.json(), { ok: false, error: 'invalid_json' });

    const extraField = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST', removalBody({ extra: 'nope' }), cookie,
      ),
      env,
    });
    assert.equal(extraField.status, 400);
    assert.deepEqual(await extraField.json(), { ok: false, error: 'invalid_input' });

    const missingReason = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST', removalBody({ reason: '' }), cookie,
      ),
      env,
    });
    assert.equal(missingReason.status, 400);
    assert.deepEqual(await missingReason.json(), { ok: false, error: 'reason_required' });

    const badIdempotency = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST', removalBody({ idempotencyKey: '' }), cookie,
      ),
      env,
    });
    assert.equal(badIdempotency.status, 400);
    assert.deepEqual(await badIdempotency.json(), { ok: false, error: 'invalid_idempotency_key' });
  });

  it('rejects unknown content and content that belongs to a different piece', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const unknown = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST', removalBody({ contentId: 'dream-nonexistent' }), cookie,
      ),
      env,
    });
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { ok: false, error: 'content_not_found' });

    const wrongPiece = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST',
        removalBody({ contentId: OTHER_PIECE_DREAM_ID }), cookie,
      ),
      env,
    });
    assert.equal(wrongPiece.status, 404);
    assert.deepEqual(await wrongPiece.json(), { ok: false, error: 'content_not_found' });
  });
});

describe('shine removals endpoint action', () => {
  it('records a removal, writes an audit row, and lists it back on GET', async () => {
    const { env, database } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody(), cookie), env,
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.replayed, false);
    assert.equal(body.removal.contentId, REMOVE_DREAM_ID);
    assert.equal(body.removal.keeperPieceId, KEEPER_PIECE_ID);
    assert.equal(body.removal.removedByUserId, 'user-1');
    assert.equal(body.removal.removedReason, removalBody().reason);
    assert.match(body.removal.id, /^csr-/);
    assert.match(body.eventId, /^rme-/);
    // The record was regenerated fail-soft, on demand, for the piece.
    assert.equal(body.records.publicCode, PUBLIC_CODE);
    assert.ok(['generated', 'unchanged'].includes(body.records.status), body.records.status);

    const removalRow = database.prepare(
      'SELECT * FROM collector_shine_removals WHERE content_id = ?',
    ).get(REMOVE_DREAM_ID) as any;
    assert.ok(removalRow);
    assert.equal(removalRow.keeper_piece_id, KEEPER_PIECE_ID);
    assert.equal(removalRow.idempotency_key, removalBody().idempotencyKey);

    const eventRow = database.prepare(
      "SELECT * FROM registry_maintenance_events WHERE event_type = 'shine_removal'",
    ).get() as any;
    assert.ok(eventRow);
    assert.equal(eventRow.keeper_piece_id, KEEPER_PIECE_ID);
    assert.equal(eventRow.artwork_id, null);
    assert.equal(eventRow.related_record_id, REMOVE_DREAM_ID);
    assert.equal(eventRow.administrator_user_id, 'user-1');
    assert.equal(eventRow.administrator_email, 'artist@example.com');
    assert.equal(eventRow.outcome, 'succeeded');
    assert.match(eventRow.mutation_fingerprint, /^[0-9a-f]{64}$/);
    assert.doesNotThrow(() => JSON.parse(eventRow.before_json));
    const after = JSON.parse(eventRow.after_json);
    assert.equal(after.contentId, REMOVE_DREAM_ID);
    assert.equal(after.removedByUserId, 'user-1');

    // GET lists the removal back for this piece.
    const list = await onRequest({
      request: request(
        `/api/admin/shine-removals?keeperPieceId=${KEEPER_PIECE_ID}`, 'GET', undefined, cookie,
      ),
      env,
    });
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.ok, true);
    assert.equal(listed.removals.length, 1);
    assert.equal(listed.removals[0].contentId, REMOVE_DREAM_ID);
  });

  it('replays idempotently by idempotency key and by content_id, and rejects key reuse', async () => {
    const { env, database } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const first = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody(), cookie), env,
    });
    assert.equal(first.status, 201);
    const firstBody = await first.json();

    // Exact replay: same idempotency key, same content.
    const replay = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody(), cookie), env,
    });
    assert.equal(replay.status, 200);
    const replayBody = await replay.json();
    assert.equal(replayBody.ok, true);
    assert.equal(replayBody.replayed, true);
    assert.deepEqual(replayBody.removal, firstBody.removal);

    // Idempotent by UNIQUE(content_id) alone: a different idempotency key,
    // same content and piece, is still a clean 200 with the existing row —
    // restoring shone content is not a thing, so retrying a removal can
    // never duplicate or error.
    const retryDifferentKey = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST',
        removalBody({ idempotencyKey: 'shine-removal-seed-0002' }), cookie,
      ),
      env,
    });
    assert.equal(retryDifferentKey.status, 200);
    const retryBody = await retryDifferentKey.json();
    assert.equal(retryBody.replayed, true);
    assert.deepEqual(retryBody.removal, firstBody.removal);

    const removalCount = database.prepare(
      'SELECT COUNT(*) AS count FROM collector_shine_removals',
    ).get() as any;
    assert.equal(removalCount.count, 1);
    const eventCount = database.prepare(
      "SELECT COUNT(*) AS count FROM registry_maintenance_events WHERE event_type = 'shine_removal'",
    ).get() as any;
    assert.equal(eventCount.count, 1);

    // Key reuse against different content is a genuine conflict, not a replay.
    const conflict = await onRequest({
      request: request(
        '/api/admin/shine-removals', 'POST',
        removalBody({ contentId: KEEP_DREAM_ID }), cookie,
      ),
      env,
    });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), { ok: false, error: 'idempotency_conflict' });
  });

  it('excludes the removed dream from a regenerated record while a different shining dream remains', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/shine-removals.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const before = await buildPieceRecord(env, {
      publicCode: PUBLIC_CODE,
      trigger: 'on_demand',
      generatedAt: '2026-08-19T00:00:00.000Z',
      includeLegacySections: true,
    });
    const beforeWords = before.record.shines.entries.map((entry: any) => entry.words);
    assert.ok(beforeWords.includes(REMOVED_WORDS));
    assert.ok(beforeWords.includes(KEPT_WORDS));

    const response = await onRequest({
      request: request('/api/admin/shine-removals', 'POST', removalBody(), cookie), env,
    });
    assert.equal(response.status, 201);

    const after = await buildPieceRecord(env, {
      publicCode: PUBLIC_CODE,
      trigger: 'on_demand',
      generatedAt: '2026-08-19T01:00:00.000Z',
      includeLegacySections: true,
    });
    const afterWords = after.record.shines.entries.map((entry: any) => entry.words);
    assert.ok(!afterWords.includes(REMOVED_WORDS), 'removed dream no longer shines');
    assert.ok(afterWords.includes(KEPT_WORDS), 'the other shining dream remains');
    assert.ok(!after.canonicalJson.includes(REMOVED_WORDS));
  });
});

describe('collector_shine_removals is append-only', () => {
  it('blocks UPDATE and DELETE on the removal table', async () => {
    const { database } = await fixtureEnv();
    database.exec(`
      INSERT INTO collector_shine_removals
        (id, content_id, keeper_piece_id, removed_reason, removed_by_user_id,
         idempotency_key, removed_at)
      VALUES
        ('csr-seed-1', '${REMOVE_DREAM_ID}', '${KEEPER_PIECE_ID}',
         'Abusive language.', 'user-1', 'shine-removal-direct-0001',
         '2026-08-19T00:00:00.000Z');
    `);
    assert.throws(
      () => database.exec("UPDATE collector_shine_removals SET removed_reason = 'x' WHERE id = 'csr-seed-1'"),
      /append-only/,
    );
    assert.throws(
      () => database.exec("DELETE FROM collector_shine_removals WHERE id = 'csr-seed-1'"),
      /append-only/,
    );
  });

  it('rejects a removal row whose content does not belong to the named piece', async () => {
    const { database } = await fixtureEnv();
    assert.throws(
      () => database.exec(`
        INSERT INTO collector_shine_removals
          (id, content_id, keeper_piece_id, removed_reason, removed_by_user_id,
           idempotency_key, removed_at)
        VALUES
          ('csr-seed-2', '${REMOVE_DREAM_ID}', '${OTHER_KEEPER_PIECE_ID}',
           'Mismatched piece.', 'user-1', 'shine-removal-direct-0002',
           '2026-08-19T00:00:00.000Z');
      `),
      /must belong to the named piece/,
    );
  });
});
