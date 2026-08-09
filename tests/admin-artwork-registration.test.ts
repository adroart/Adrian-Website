import assert from 'node:assert/strict';
import { after, beforeEach, describe, it, mock } from 'node:test';

const ORIGIN = 'https://adrianrasmussen.com';
const STEP_UP_SECRET = 'registration-step-up-secret';

type Identity = {
  userId: string;
  email: string;
  user: { id: string; email: string; emailVerified: boolean };
  session: { id: string };
};

let identity: Identity | Response = new Response(
  JSON.stringify({ ok: false, error: 'unauthorized' }),
  { status: 401, headers: { 'Cache-Control': 'no-store' } },
);
let registrationCalls: Array<{ env: Record<string, unknown>; input: Record<string, unknown> }> = [];
let registrationImplementation: (
  env: Record<string, unknown>,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>> = async () => ({
  keeperPieceId: 'kp-registered',
  publicCode: 'AR-7KQ9M2WX',
  ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
  codeAccess: 'created',
  registrationStatus: 'registered',
  backupStatus: 'verified',
});

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireAdmin: async (request: Request) => {
      if (identity instanceof Response) return identity.clone();
      if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) {
        return new Response(JSON.stringify({ ok: false, error: 'origin_forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      return identity;
    },
  },
});

mock.module('../functions/api/_lib/artworkRegistration.js', {
  namedExports: {
    registerArtwork: async (env: Record<string, unknown>, input: Record<string, unknown>) => {
      registrationCalls.push({ env, input });
      return registrationImplementation(env, input);
    },
  },
});

const { onRequest } = await import('../functions/api/admin/registrations.js');
const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');

const adminIdentity: Identity = {
  userId: 'admin-user',
  email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};

beforeEach(() => {
  identity = new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  registrationCalls = [];
  registrationImplementation = async () => ({
    keeperPieceId: 'kp-registered',
    publicCode: 'AR-7KQ9M2WX',
    ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
    codeAccess: 'created',
    registrationStatus: 'registered',
    backupStatus: 'verified',
  });
});

after(() => mock.reset());

function environment(overrides: Record<string, unknown> = {}) {
  return {
    DB: {
      batch: async () => [],
      prepare: () => ({
        bind() { return this; },
        async first() { return null; },
      }),
    },
    ARTWORK_REGISTRY_BACKUP: { put: async () => {}, get: async () => null },
    REGISTRY_STEP_UP_SECRET: STEP_UP_SECRET,
    ...overrides,
  };
}

async function unlockedCookie(env = environment()) {
  const token = await createRegistryUnlockToken(env, adminIdentity);
  return `better-auth.session_token=admin-session; registry_unlock=${token}`;
}

function registrationRequest(options: {
  method?: string;
  origin?: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
} = {}) {
  const method = options.method ?? 'POST';
  const headers = new Headers();
  if (options.origin !== undefined) headers.set('Origin', options.origin);
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.body !== undefined || options.rawBody !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  return new Request(`${ORIGIN}/api/admin/registrations`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD'
      ? undefined
      : options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
}

const validBody = {
  artworkId: 'SIG-100',
  edition: { kind: 'unique' },
  idempotencyKey: 'register-sig-100',
};

async function invoke(options: Parameters<typeof registrationRequest>[0] = {}, env = environment()) {
  return onRequest({ request: registrationRequest(options), env });
}

function codedError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe('POST /api/admin/registrations security boundary', () => {
  it('is POST-only and returns private no-store errors', async () => {
    const response = await invoke({ method: 'GET' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
    assert.equal(registrationCalls.length, 0);
  });

  it('requires central admin identity, exact same origin, and active registry step-up', async () => {
    const env = environment();
    const guest = await invoke({ origin: ORIGIN, body: validBody }, env);
    assert.equal(guest.status, 401);

    identity = new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
    const nonAdmin = await invoke({ origin: ORIGIN, body: validBody }, env);
    assert.equal(nonAdmin.status, 403);

    identity = adminIdentity;
    for (const origin of [undefined, 'https://www.adrianrasmussen.com', 'https://example.com']) {
      const denied = await invoke({ origin, body: validBody }, env);
      assert.equal(denied.status, 403, String(origin));
      assert.deepEqual(await denied.json(), { ok: false, error: 'origin_forbidden' });
    }

    const locked = await invoke({ origin: ORIGIN, body: validBody }, env);
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });
    assert.equal(registrationCalls.length, 0);
  });

  it('requires both database and immutable identity-backup bindings after authorization', async () => {
    identity = adminIdentity;
    const completeEnv = environment();
    const cookie = await unlockedCookie(completeEnv);

    const missingDb = await invoke(
      { origin: ORIGIN, cookie, body: validBody },
      environment({ DB: undefined }),
    );
    assert.equal(missingDb.status, 503);
    assert.deepEqual(await missingDb.json(), { ok: false, error: 'db_not_configured' });

    const missingBackup = await invoke(
      { origin: ORIGIN, cookie, body: validBody },
      environment({ ARTWORK_REGISTRY_BACKUP: undefined }),
    );
    assert.equal(missingBackup.status, 503);
    assert.deepEqual(await missingBackup.json(), { ok: false, error: 'backup_not_configured' });
    assert.equal(registrationCalls.length, 0);
  });
});

describe('POST /api/admin/registrations input and output contract', () => {
  it('accepts only the exact public registration request shape', async () => {
    identity = adminIdentity;
    const env = environment();
    const cookie = await unlockedCookie(env);

    const malformed = await invoke({
      origin: ORIGIN, cookie, rawBody: '{not-json',
    }, env);
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { ok: false, error: 'invalid_json' });

    for (const body of [
      { ...validBody, administratorUserId: 'body-admin' },
      { ...validBody, userId: 'body-user' },
      { ...validBody, authorization: adminIdentity },
      { ...validBody, registeredAt: '1999-01-01T00:00:00.000Z' },
      { ...validBody, ownershipCode: 'ATTACKER-CODE' },
      { ...validBody, publicCode: 'AR-ABCDEFGH' },
      { ...validBody, backupReference: 'attacker/backup.json' },
    ]) {
      const response = await invoke({ origin: ORIGIN, cookie, body }, env);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: 'invalid_registration' });
    }

    for (const edition of [
      { kind: 'unique', number: 0 },
      { kind: 'numbered', number: 1 },
      { kind: 'numbered', number: 1, size: 7, extra: true },
      { kind: 'numbered', number: '1', size: 7 },
      { kind: 'numbered', number: 0, size: 7 },
      { kind: 'numbered', number: 2, size: 1 },
      { kind: 'numbered', number: 1, size: '7' },
      { kind: 'numbered', number: 1, size: 0 },
      { kind: 'other' },
    ]) {
      const response = await invoke({
        origin: ORIGIN, cookie, body: { ...validBody, edition },
      }, env);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: 'invalid_edition' });
    }

    for (const idempotencyKey of [null, '', '   ', 'x'.repeat(129)]) {
      const response = await invoke({
        origin: ORIGIN, cookie, body: { ...validBody, idempotencyKey },
      }, env);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false, error: 'idempotency_key_required' });
    }
    assert.equal(registrationCalls.length, 0);
  });

  it('passes only authenticated server authority and server time to the core', async () => {
    identity = adminIdentity;
    const env = environment();
    const cookie = await unlockedCookie(env);
    const before = Date.now();
    const response = await invoke({ origin: ORIGIN, cookie, body: validBody }, env);
    const afterTime = Date.now();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(registrationCalls.length, 1);
    assert.equal(registrationCalls[0].env, env);
    const registeredAt = String(registrationCalls[0].input.registeredAt);
    assert.ok(Date.parse(registeredAt) >= before && Date.parse(registeredAt) <= afterTime);
    assert.deepEqual(registrationCalls[0].input, {
      artworkId: 'SIG-100',
      edition: { kind: 'unique' },
      idempotencyKey: 'register-sig-100',
      authorization: {
        userId: 'admin-user',
        email: 'artist@example.com',
        registryUnlockExpiresAt: registrationCalls[0].input.authorization
          && (registrationCalls[0].input.authorization as Record<string, unknown>).registryUnlockExpiresAt,
      },
      registeredAt,
    });
    const authorization = registrationCalls[0].input.authorization as Record<string, unknown>;
    assert.equal(typeof authorization.registryUnlockExpiresAt, 'number');
    assert.ok(Number(authorization.registryUnlockExpiresAt) > Math.floor(Date.now() / 1000));
    assert.deepEqual(await response.json(), {
      ok: true,
      keeperPieceId: 'kp-registered',
      publicCode: 'AR-7KQ9M2WX',
      ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
      codeAccess: 'created',
      registrationStatus: 'registered',
      backupStatus: 'verified',
    });
  });

  it('returns plaintext only when the registration core explicitly returns it', async () => {
    identity = adminIdentity;
    const env = environment();
    const cookie = await unlockedCookie(env);
    registrationImplementation = async () => ({
      keeperPieceId: 'kp-registered',
      publicCode: 'AR-7KQ9M2WX',
      codeAccess: 'audited-reveal-required',
      registrationStatus: 'registered',
      backupStatus: 'verified',
      internalBackupReference: 'must-not-leak',
    });

    const response = await invoke({ origin: ORIGIN, cookie, body: validBody }, env);
    assert.equal(response.status, 200);
    const payload = await response.json() as Record<string, unknown>;
    assert.deepEqual(payload, {
      ok: true,
      keeperPieceId: 'kp-registered',
      publicCode: 'AR-7KQ9M2WX',
      codeAccess: 'audited-reveal-required',
      registrationStatus: 'registered',
      backupStatus: 'verified',
    });
    assert.equal(Object.hasOwn(payload, 'ownershipCode'), false);
    assert.doesNotMatch(JSON.stringify(payload), /backupReference|must-not-leak/i);
  });

  it('normalizes the registration key while keeping retry time under server authority', async () => {
    identity = adminIdentity;
    const env = environment();
    const cookie = await unlockedCookie(env);
    let attempt = 0;
    registrationImplementation = async (_env, input) => {
      attempt += 1;
      assert.equal(input.idempotencyKey, 'register-sig-100');
      assert.equal(typeof input.registeredAt, 'string');
      assert.ok(Number.isFinite(Date.parse(String(input.registeredAt))));
      return {
        keeperPieceId: 'kp-registered',
        publicCode: 'AR-7KQ9M2WX',
        ownershipCode: 'K7QM-9XTR-2PHV-N4WB',
        codeAccess: attempt === 1 ? 'created' : 'active-unlock-replay',
        registrationStatus: 'registered',
        backupStatus: 'verified',
      };
    };

    const first = await invoke({
      origin: ORIGIN,
      cookie,
      body: { ...validBody, idempotencyKey: '  register-sig-100  ' },
    }, env);
    const replay = await invoke({
      origin: ORIGIN, cookie, body: validBody,
    }, env);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.equal(registrationCalls.length, 2);

    registrationImplementation = async () => { throw codedError('idempotency_conflict'); };
    const changed = await invoke({
      origin: ORIGIN,
      cookie,
      body: { ...validBody, artworkId: 'SIG-101' },
    }, env);
    assert.equal(changed.status, 409);
    assert.deepEqual(await changed.json(), { ok: false, error: 'idempotency_conflict' });
  });

  it('preserves stable registration errors with their intended status', async () => {
    identity = adminIdentity;
    const env = environment();
    const cookie = await unlockedCookie(env);
    const cases = [
      ['invalid_registration', 400],
      ['unknown_artwork', 404],
      ['edition_metadata_required', 409],
      ['invalid_edition', 400],
      ['idempotency_key_required', 400],
      ['idempotency_conflict', 409],
      ['registration_conflict', 409],
      ['identity_backup_failed', 503],
      ['atomic_write_unavailable', 503],
      ['ownership_code_crypto_not_configured', 503],
      ['public_code_collision', 503],
    ] as const;

    for (const [code, status] of cases) {
      registrationImplementation = async () => { throw codedError(code); };
      const response = await invoke({ origin: ORIGIN, cookie, body: validBody }, env);
      assert.equal(response.status, status, code);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { ok: false, error: code });
    }

    registrationImplementation = async () => { throw new Error('database internals'); };
    const unexpected = await invoke({ origin: ORIGIN, cookie, body: validBody }, env);
    assert.equal(unexpected.status, 500);
    const unexpectedBody = await unexpected.text();
    assert.deepEqual(JSON.parse(unexpectedBody), { ok: false, error: 'registration_failed' });
    assert.doesNotMatch(unexpectedBody, /database internals/);
  });
});
