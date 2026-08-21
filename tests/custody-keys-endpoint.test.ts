import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateCustodyKeys } from '../utils/custodyEnvelope';

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

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/**
 * Every migration present on disk at test-run time, applied in file order.
 * This endpoint only touches registry_maintenance_events (migration 017,
 * renamed in 018), but other agents may be authoring migrations
 * concurrently in this worktree (see shine-removals.test.ts), so this reads
 * whatever exists rather than hardcoding a cutoff number that would go
 * stale.
 */
function allMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'))
    .join('\n');
}

/** In-memory D1-shaped SQLite wrapper (shine-removals.test.ts shape). */
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

const RECOVERY_KEY_B64 = Buffer.alloc(32, 7).toString('base64');
const RECOVERY_KEY_ID = 'registry-recovery-key-test';
const OWNERSHIP_V1_B64 = Buffer.alloc(32, 9).toString('base64');
const OWNERSHIP_V2_B64 = Buffer.alloc(32, 11).toString('base64');

/** Fake env with every secret this endpoint reads. Values are test-only. */
function fixtureEnv(overrides: Record<string, unknown> = {}) {
  const database = new DatabaseSync(':memory:');
  database.exec(allMigrations());
  const env = {
    DB: d1(database),
    ADMIN_EMAILS: 'artist@example.com',
    REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret',
    REGISTRY_RECOVERY_EXPORT_KEY: RECOVERY_KEY_B64,
    REGISTRY_RECOVERY_EXPORT_KEY_ID: RECOVERY_KEY_ID,
    OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '2',
    OWNERSHIP_CODE_KEY_V1: OWNERSHIP_V1_B64,
    OWNERSHIP_CODE_KEY_V2: OWNERSHIP_V2_B64,
    ...overrides,
  };
  return { database, env };
}

const ORIGIN = 'https://adrianrasmussen.com';

function request(
  method: string,
  cookie = 'better-auth.session_token=test-session',
) {
  return new Request(`${ORIGIN}/api/admin/custody-keys`, {
    method,
    headers: new Headers({ Cookie: cookie, Origin: ORIGIN }),
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

describe('custody keys endpoint guards', () => {
  it('never answers GET: 405 naming POST as the only allowed method', async () => {
    const { env } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('GET', cookie), env });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
    assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
  });

  it('rejects other methods the same way', async () => {
    const { env } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('PUT', cookie), env });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  });

  it('refuses an unauthenticated or non-admin caller the same way other admin endpoints do', async () => {
    const { env } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');

    const guest = await onRequest({ request: request('POST'), env });
    assert.equal(guest.status, 401);

    signIn('collector@example.com');
    const nonAdmin = await onRequest({ request: request('POST'), env });
    assert.equal(nonAdmin.status, 403);
  });

  it('refuses an admin session without the registry step-up unlock, same shape as other unlocked endpoints', async () => {
    const { env } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();

    const locked = await onRequest({ request: request('POST'), env });
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });
  });

  it('fails closed with a named 503 when the recovery export key is not configured', async () => {
    const { env } = fixtureEnv({
      REGISTRY_RECOVERY_EXPORT_KEY: undefined,
      REGISTRY_RECOVERY_EXPORT_KEY_ID: undefined,
    });
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('POST', cookie), env });
    assert.equal(response.status, 503);
    assert.deepEqual(
      await response.json(),
      { ok: false, error: 'registry_recovery_export_not_configured' },
    );

    // Same failure when only the id half is missing.
    const { env: envMissingId } = fixtureEnv({ REGISTRY_RECOVERY_EXPORT_KEY_ID: undefined });
    const cookieForMissingId = await unlockedCookie(envMissingId);
    const idResponse = await onRequest({
      request: request('POST', cookieForMissingId), env: envMissingId,
    });
    assert.equal(idResponse.status, 503);
    assert.deepEqual(
      await idResponse.json(),
      { ok: false, error: 'registry_recovery_export_not_configured' },
    );
  });
});

describe('custody keys endpoint response', () => {
  it('returns every configured key version, never cacheable, matching CustodyKeys exactly', async () => {
    const { env } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('POST', cookie), env });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Pragma'), 'no-cache');

    const body = await response.json();
    assert.equal(body.registryRecoveryExportKeyB64, RECOVERY_KEY_B64);
    assert.equal(body.registryRecoveryExportKeyId, RECOVERY_KEY_ID);
    assert.deepEqual(body.ownershipCodeKeys, [
      { version: 1, keyB64: OWNERSHIP_V1_B64 },
      { version: 2, keyB64: OWNERSHIP_V2_B64 },
    ]);
    assert.match(body.notes, /^Keys taken from the live environment on \d{4}-\d{2}-\d{2}/);
    assert.match(body.notes, /active ownership code key version 2/);

    // The response body itself is a valid CustodyKeys, no wrapper fields.
    assert.doesNotThrow(() => validateCustodyKeys(body));
    assert.deepEqual(Object.keys(body).sort(), [
      'notes', 'ownershipCodeKeys', 'registryRecoveryExportKeyB64', 'registryRecoveryExportKeyId',
    ]);
  });

  it('collects every OWNERSHIP_CODE_KEY_V<n> present, not only the active one', async () => {
    const OWNERSHIP_V5_B64 = Buffer.alloc(32, 13).toString('base64');
    const { env } = fixtureEnv({
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '5',
      OWNERSHIP_CODE_KEY_V5: OWNERSHIP_V5_B64,
    });
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('POST', cookie), env });
    const body = await response.json();
    assert.deepEqual(body.ownershipCodeKeys, [
      { version: 1, keyB64: OWNERSHIP_V1_B64 },
      { version: 2, keyB64: OWNERSHIP_V2_B64 },
      { version: 5, keyB64: OWNERSHIP_V5_B64 },
    ]);
    assert.match(body.notes, /active ownership code key version 5/);
  });

  it('skips a malformed ownership code key binding rather than returning it broken', async () => {
    const { env } = fixtureEnv({ OWNERSHIP_CODE_KEY_V1: 'not-valid-base64-32-bytes' });
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('POST', cookie), env });
    const body = await response.json();
    assert.deepEqual(body.ownershipCodeKeys, [{ version: 2, keyB64: OWNERSHIP_V2_B64 }]);
  });

  it('states plainly when no ownership code key version is active', async () => {
    const { env } = fixtureEnv({ OWNERSHIP_CODE_ACTIVE_KEY_VERSION: undefined });
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('POST', cookie), env });
    const body = await response.json();
    assert.match(body.notes, /no ownership code key version currently active/);
  });
});

describe('custody keys endpoint audit', () => {
  it('records the export in registry_maintenance_events before returning the keys, with no key material in the row', async () => {
    const { env, database } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({ request: request('POST', cookie), env });
    assert.equal(response.status, 200);

    const rows = database.prepare(
      "SELECT * FROM registry_maintenance_events WHERE event_type = 'custody_keys_exported'",
    ).all() as any[];
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row.keeper_piece_id, null);
    assert.equal(row.artwork_id, null);
    assert.equal(row.administrator_user_id, 'user-1');
    assert.equal(row.administrator_email, 'artist@example.com');
    assert.equal(row.outcome, 'succeeded');
    assert.equal(row.related_record_id, null);
    assert.match(row.mutation_fingerprint, /^[0-9a-f]{64}$/);
    assert.doesNotThrow(() => JSON.parse(row.before_json));
    assert.doesNotThrow(() => JSON.parse(row.after_json));

    // No key material anywhere in the audit row, only ids/versions/timestamps.
    const serializedRow = JSON.stringify(row);
    assert.ok(!serializedRow.includes(RECOVERY_KEY_B64));
    assert.ok(!serializedRow.includes(OWNERSHIP_V1_B64));
    assert.ok(!serializedRow.includes(OWNERSHIP_V2_B64));
    const after = JSON.parse(row.after_json);
    assert.equal(after.registryRecoveryExportKeyId, RECOVERY_KEY_ID);
    assert.deepEqual(after.ownershipCodeKeyVersions, [1, 2]);
    assert.equal(after.activeOwnershipCodeKeyVersion, 2);
  });

  it('writes one audit row per call: repeat exports are each recorded, not deduplicated', async () => {
    const { env, database } = fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/custody-keys.js');
    signIn();
    const cookie = await unlockedCookie(env);

    await onRequest({ request: request('POST', cookie), env });
    await onRequest({ request: request('POST', cookie), env });

    const count = database.prepare(
      "SELECT COUNT(*) AS count FROM registry_maintenance_events WHERE event_type = 'custody_keys_exported'",
    ).get() as any;
    assert.equal(count.count, 2);
  });
});
