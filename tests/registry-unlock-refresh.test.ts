import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

type SessionData = {
  session: { id: string };
  user: { id: string; email: string; emailVerified: boolean };
} | null;

let sessionData: SessionData = null;

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
  sessionData = {
    session: { id: 'session-1' },
    user: { id: 'admin-1', email: ' Artist@Example.COM ', emailVerified: true },
  };
});

afterEach(() => {
  mock.timers.reset();
});

after(() => mock.reset());

const ORIGIN = 'https://adrianrasmussen.com';

const environment = (overrides: Record<string, unknown> = {}) => ({
  DB: {},
  ADMIN_EMAILS: 'artist@example.com',
  REGISTRY_STEP_UP_SECRET: 'registry-secret',
  ...overrides,
});

const identity = {
  userId: 'admin-1',
  email: 'artist@example.com',
  session: { id: 'session-1' },
};

function refreshRequest(options: { origin?: string; cookie?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.origin !== undefined) headers.set('Origin', options.origin);
  if (options.cookie) headers.set('Cookie', options.cookie);
  return new Request(`${ORIGIN}/api/admin/registry-unlock/refresh`, {
    method: 'POST',
    headers,
  });
}

function statusRequest(cookie: string) {
  return new Request(`${ORIGIN}/api/admin/registry-unlock`, {
    method: 'GET',
    headers: new Headers({ Cookie: cookie }),
  });
}

async function endpoint() {
  return import('../functions/api/admin/registry-unlock/refresh.js');
}

async function helpers() {
  return import('../functions/api/_lib/admin.js');
}

function cookiePair(setCookie: string) {
  return setCookie.split(';', 1)[0];
}

function decodePayload(cookieOrToken: string) {
  const token = cookieOrToken.startsWith('registry_unlock=')
    ? cookieOrToken.slice('registry_unlock='.length)
    : cookieOrToken;
  const [payloadB64] = token.split('.');
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
}

/** Sign a raw payload exactly the way _lib/admin.js does, for legacy fixtures. */
async function signToken(secret: string, payload: Record<string, unknown>) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`adrian-website:registry-unlock:v1:token:${payloadB64}`),
  );
  return `${payloadB64}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
}

describe('registry unlock refresh', () => {
  it('slides the expiry forward while preserving the original unlock time', async () => {
    const startMs = Date.UTC(2026, 7, 19, 12, 0, 0);
    mock.timers.enable({ apis: ['Date'], now: startMs });
    const startSeconds = Math.floor(startMs / 1000);

    const { createRegistryUnlockToken, requireRegistryUnlock } = await helpers();
    const original = await createRegistryUnlockToken(environment(), identity);
    assert.equal(decodePayload(original).origIat, startSeconds);

    mock.timers.tick(5 * 60 * 1000);
    const { onRequestPost } = await endpoint();
    const response = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${original}` }),
      env: environment(),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true, expiresIn: 600 });
    const setCookie = response.headers.get('Set-Cookie') || '';
    assert.match(setCookie, /^registry_unlock=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
    assert.match(setCookie, /Path=\/api\/admin/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /Max-Age=600/);

    const refreshed = decodePayload(cookiePair(setCookie));
    assert.equal(refreshed.iat, startSeconds + 300);
    assert.equal(refreshed.exp, startSeconds + 300 + 600);
    assert.equal(refreshed.origIat, startSeconds, 'original unlock time is preserved');

    // Advance beyond the original expiry: the refreshed cookie still clears
    // requireRegistryUnlock even though the original cookie would not.
    mock.timers.tick(6 * 60 * 1000);
    const authorized = await requireRegistryUnlock(
      statusRequest(cookiePair(setCookie)),
      environment(),
    );
    assert.ok(!(authorized instanceof Response), 'refreshed cookie passes requireRegistryUnlock');
    assert.equal(authorized.userId, 'admin-1');
    assert.equal(authorized.registryUnlockExpiresAt, refreshed.exp);
    assert.equal(authorized.registryUnlockOriginalIat, startSeconds);

    const stale = await requireRegistryUnlock(
      statusRequest(`registry_unlock=${original}`),
      environment(),
    );
    assert.ok(stale instanceof Response, 'the original cookie has expired by now');
    assert.equal(stale.status, 403);
  });

  it('refuses to resurrect an expired cookie', async () => {
    const { createRegistryUnlockToken } = await helpers();
    const expired = await createRegistryUnlockToken(environment(), identity, -1);
    const { onRequestPost } = await endpoint();
    const response = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${expired}` }),
      env: environment(),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, error: 'registry_locked' });
    assert.equal(response.headers.get('Set-Cookie'), null);
  });

  it('answers missing and tampered cookies with the identical response', async () => {
    const { createRegistryUnlockToken } = await helpers();
    const token = await createRegistryUnlockToken(environment(), identity);
    const [payload, signature] = token.split('.');
    const tampered = `${payload}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
    const { onRequestPost } = await endpoint();

    const responses = await Promise.all([
      onRequestPost({ request: refreshRequest({ origin: ORIGIN }), env: environment() }),
      onRequestPost({
        request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${tampered}` }),
        env: environment(),
      }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.text()));

    assert.equal(responses[0].status, 403);
    assert.equal(responses[1].status, 403);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(bodies[0], JSON.stringify({ ok: false, error: 'registry_locked' }));
    assert.equal(responses[0].headers.get('Set-Cookie'), null);
    assert.equal(responses[1].headers.get('Set-Cookie'), null);
  });

  it('enforces the sixty-minute absolute cap even on a currently valid cookie', async () => {
    // A ceremony that first unlocked at T, last refreshed at T+59min. At
    // T+61min the cookie is still inside its ten-minute TTL, yet the original
    // unlock is now more than sixty minutes old.
    const originalMs = Date.UTC(2026, 7, 19, 13, 0, 0);
    mock.timers.enable({ apis: ['Date'], now: originalMs + 59 * 60 * 1000 });
    const originalIat = Math.floor(originalMs / 1000);
    const { createRegistryUnlockToken, requireRegistryUnlock } = await helpers();
    const capped = await createRegistryUnlockToken(environment(), identity, 600, originalIat);

    mock.timers.tick(2 * 60 * 1000);
    const stillValid = await requireRegistryUnlock(
      statusRequest(`registry_unlock=${capped}`),
      environment(),
    );
    assert.ok(!(stillValid instanceof Response), 'cookie itself is still within its TTL');

    const { onRequestPost } = await endpoint();
    const response = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${capped}` }),
      env: environment(),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, error: 'unlock_absolute_cap' });
    const setCookie = response.headers.get('Set-Cookie') || '';
    assert.match(setCookie, /^registry_unlock=;/);
    assert.match(setCookie, /Max-Age=0/);
    assert.match(setCookie, /Path=\/api\/admin/);
  });

  it('still allows a refresh exactly at the cap boundary', async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 7, 19, 14, 0, 0) });
    const now = Math.floor(Date.now() / 1000);
    const { createRegistryUnlockToken } = await helpers();
    const boundary = await createRegistryUnlockToken(
      environment(),
      identity,
      600,
      now - 60 * 60,
    );
    const { onRequestPost } = await endpoint();
    const response = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${boundary}` }),
      env: environment(),
    });
    assert.equal(response.status, 200);
    const refreshed = decodePayload(cookiePair(response.headers.get('Set-Cookie') || ''));
    assert.equal(refreshed.origIat, now - 60 * 60);
  });

  it('treats a legacy cookie without origIat as unlocked at its issue time', async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 7, 19, 15, 0, 0) });
    const now = Math.floor(Date.now() / 1000);
    const legacy = await signToken('registry-secret', {
      v: 2,
      userId: 'admin-1',
      email: 'artist@example.com',
      sessionId: 'session-1',
      iat: now - 60,
      exp: now - 60 + 600,
    });

    const { requireRegistryUnlock } = await helpers();
    const authorized = await requireRegistryUnlock(
      statusRequest(`registry_unlock=${legacy}`),
      environment(),
    );
    assert.ok(!(authorized instanceof Response), 'legacy cookie still validates');
    assert.equal(authorized.registryUnlockOriginalIat, now - 60);

    const { onRequestPost } = await endpoint();
    const response = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${legacy}` }),
      env: environment(),
    });
    assert.equal(response.status, 200);
    const refreshed = decodePayload(cookiePair(response.headers.get('Set-Cookie') || ''));
    assert.equal(refreshed.origIat, now - 60, 'legacy issue time becomes the cap origin');
    assert.equal(refreshed.exp, now + 600);
  });

  it('rejects a forged cookie whose expiry outlives the cap window', async () => {
    const now = Math.floor(Date.now() / 1000);
    const forged = await signToken('registry-secret', {
      v: 2,
      userId: 'admin-1',
      email: 'artist@example.com',
      sessionId: 'session-1',
      iat: now,
      origIat: now - 62 * 60,
      exp: now + 600,
    });
    // exp - origIat exceeds cap + ttl, so validation refuses it outright.
    const { requireRegistryUnlock } = await helpers();
    const result = await requireRegistryUnlock(
      statusRequest(`registry_unlock=${forged}`),
      environment(),
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 403);
  });

  it('requires an administrator session and a same-origin request', async () => {
    const { createRegistryUnlockToken } = await helpers();
    const token = await createRegistryUnlockToken(environment(), identity);
    const { onRequestPost } = await endpoint();

    sessionData = null;
    const guest = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN, cookie: `registry_unlock=${token}` }),
      env: environment(),
    });
    assert.equal(guest.status, 401);

    sessionData = {
      session: { id: 'session-1' },
      user: { id: 'admin-1', email: 'artist@example.com', emailVerified: true },
    };
    for (const origin of [undefined, 'https://example.com']) {
      const denied = await onRequestPost({
        request: refreshRequest({ origin, cookie: `registry_unlock=${token}` }),
        env: environment(),
      });
      assert.equal(denied.status, 403);
      assert.deepEqual(await denied.json(), { ok: false, error: 'origin_forbidden' });
    }
  });

  it('rejects non-POST methods and reports missing configuration safely', async () => {
    const { onRequest } = await endpoint();
    const wrongMethod = await onRequest({
      request: new Request(`${ORIGIN}/api/admin/registry-unlock/refresh`, { method: 'GET' }),
      env: environment(),
    });
    assert.equal(wrongMethod.status, 405);

    const { onRequestPost } = await endpoint();
    const unconfigured = await onRequestPost({
      request: refreshRequest({ origin: ORIGIN }),
      env: environment({ REGISTRY_STEP_UP_SECRET: '' }),
    });
    assert.equal(unconfigured.status, 503);
    assert.deepEqual(await unconfigured.json(), { ok: false, error: 'registry_unlock_not_configured' });
  });
});
