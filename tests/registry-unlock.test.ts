import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

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

after(() => mock.reset());

const environment = (overrides: Record<string, unknown> = {}) => ({
  DB: {},
  ADMIN_EMAILS: 'artist@example.com',
  REGISTRY_STEP_UP_SECRET: 'registry-secret',
  ...overrides,
});

function request(method = 'POST', options: { origin?: string; cookie?: string; secret?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.origin !== undefined) headers.set('Origin', options.origin);
  if (options.cookie) headers.set('Cookie', options.cookie);
  return new Request('https://adrianrasmussen.com/api/admin/registry-unlock', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify({ secret: options.secret }) : undefined,
  });
}

async function endpoint() {
  return import('../functions/api/admin/registry-unlock.js');
}

async function helpers() {
  return import('../functions/api/_lib/admin.js');
}

function cookiePair(setCookie: string) {
  return setCookie.split(';', 1)[0];
}

describe('registry unlock exchange', () => {
  it('issues an identity-bound ten-minute cookie without returning the secret', async () => {
    const { onRequestPost } = await endpoint();
    const response = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'registry-secret' }),
      env: environment(),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true, expiresIn: 600 });
    const cookie = response.headers.get('Set-Cookie') || '';
    assert.match(cookie, /^registry_unlock=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
    assert.match(cookie, /Path=\/api\/admin/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /Max-Age=600/);
    assert.doesNotMatch(cookie, /registry-secret/);
  });

  it('always marks the unlock cookie Secure, including local HTTP runtimes', async () => {
    const { registryUnlockCookie } = await helpers();
    const cookie = registryUnlockCookie(
      'signed-token',
      new Request('http://localhost:8788/api/admin/registry-unlock'),
    );
    assert.match(cookie, /; Secure(?:;|$)/);
  });

  it('requires a current administrator and the exact request origin', async () => {
    const { onRequestPost } = await endpoint();
    sessionData = null;
    const guest = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'registry-secret' }),
      env: environment(),
    });
    assert.equal(guest.status, 401);

    sessionData = {
      session: { id: 'session-1' },
      user: { id: 'admin-1', email: 'artist@example.com', emailVerified: true },
    };
    for (const origin of [undefined, 'https://www.adrianrasmussen.com', 'https://example.com']) {
      const denied = await onRequestPost({
        request: request('POST', { origin, secret: 'registry-secret' }),
        env: environment(),
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('Cache-Control'), 'no-store');
    }
  });

  it('rejects wrong and missing secrets without echoing them', async () => {
    const { onRequestPost } = await endpoint();
    for (const secret of ['wrong-secret', undefined]) {
      const response = await onRequestPost({
        request: request('POST', { origin: 'https://adrianrasmussen.com', secret }),
        env: environment(),
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { ok: false, error: 'unlock_failed' });
      assert.equal(response.headers.get('Set-Cookie'), null);
    }
  });

  it('uses UPLOAD_SECRET only while REGISTRY_STEP_UP_SECRET is absent', async () => {
    const { onRequestPost } = await endpoint();
    const fallbackEnv = environment({ REGISTRY_STEP_UP_SECRET: undefined, UPLOAD_SECRET: 'transition-secret' });
    delete fallbackEnv.REGISTRY_STEP_UP_SECRET;
    const fallback = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'transition-secret' }),
      env: fallbackEnv,
    });
    assert.equal(fallback.status, 200);

    const precedence = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'transition-secret' }),
      env: environment({ REGISTRY_STEP_UP_SECRET: '', UPLOAD_SECRET: 'transition-secret' }),
    });
    assert.equal(precedence.status, 503);

    const missing = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'anything' }),
      env: { DB: {}, ADMIN_EMAILS: 'artist@example.com' },
    });
    assert.equal(missing.status, 503);
    assert.deepEqual(await missing.json(), { ok: false, error: 'registry_unlock_not_configured' });
  });
});

describe('registry unlock authorization', () => {
  it('accepts an untampered cookie only for the current administrator identity', async () => {
    const { onRequestPost } = await endpoint();
    const exchange = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'registry-secret' }),
      env: environment(),
    });
    const cookie = cookiePair(exchange.headers.get('Set-Cookie') || '');
    const { requireRegistryUnlock } = await helpers();

    const authorized = await requireRegistryUnlock(request('GET', { cookie }), environment());
    assert.ok(!(authorized instanceof Response));
    assert.equal(authorized.userId, 'admin-1');
    assert.equal(authorized.email, 'artist@example.com');

    sessionData = {
      session: { id: 'session-2' },
      user: { id: 'admin-2', email: 'artist@example.com', emailVerified: true },
    };
    const wrongUser = await requireRegistryUnlock(request('GET', { cookie }), environment());
    assert.ok(wrongUser instanceof Response);
    assert.equal(wrongUser.status, 403);
  });

  it('rejects tampered and expired cookies', async () => {
    const { createRegistryUnlockToken, requireRegistryUnlock } = await helpers();
    const identity = { userId: 'admin-1', email: 'artist@example.com' };
    const token = await createRegistryUnlockToken(environment(), identity);
    const [payload, signature] = token.split('.');
    const tampered = `${payload}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
    const expired = await createRegistryUnlockToken(environment(), identity, -1);

    for (const candidate of [tampered, expired]) {
      const result = await requireRegistryUnlock(
        request('GET', { cookie: `registry_unlock=${candidate}` }),
        environment(),
      );
      assert.ok(result instanceof Response);
      assert.equal(result.status, 403);
      assert.equal(result.headers.get('Cache-Control'), 'no-store');
    }
  });

  it('rejects a non-canonical signature encoding even when it decodes to the same bytes', async () => {
    const { createRegistryUnlockToken, requireRegistryUnlock } = await helpers();
    const identity = { userId: 'admin-1', email: 'artist@example.com' };
    const token = await createRegistryUnlockToken(environment(), identity);
    const [payload, signature] = token.split('.');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const lastIndex = alphabet.indexOf(signature.at(-1) || '');
    assert.equal(lastIndex % 4, 0, 'canonical SHA-256 base64url has zero final pad bits');
    const alternateSignature = `${signature.slice(0, -1)}${alphabet[lastIndex + 1]}`;
    assert.deepEqual(
      Buffer.from(alternateSignature, 'base64url'),
      Buffer.from(signature, 'base64url'),
      'fixture must change only ignored base64 pad bits',
    );

    const result = await requireRegistryUnlock(
      request('GET', { cookie: `registry_unlock=${payload}.${alternateSignature}` }),
      environment(),
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 403);
  });

  it('reports safe status and clears the scoped cookie', async () => {
    const { onRequestGet, onRequestPost, onRequestDelete } = await endpoint();
    const exchange = await onRequestPost({
      request: request('POST', { origin: 'https://adrianrasmussen.com', secret: 'registry-secret' }),
      env: environment(),
    });
    const cookie = cookiePair(exchange.headers.get('Set-Cookie') || '');
    const status = await onRequestGet({ request: request('GET', { cookie }), env: environment() });
    const statusBody = await status.json() as { ok: boolean; unlocked: boolean; expiresAt: string };
    assert.equal(status.status, 200);
    assert.equal(status.headers.get('Cache-Control'), 'no-store');
    assert.equal(statusBody.ok, true);
    assert.equal(statusBody.unlocked, true);
    assert.match(statusBody.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

    const cleared = await onRequestDelete({
      request: request('DELETE', { origin: 'https://adrianrasmussen.com', cookie }),
      env: environment(),
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.headers.get('Cache-Control'), 'no-store');
    assert.match(cleared.headers.get('Set-Cookie') || '', /^registry_unlock=;/);
    assert.match(cleared.headers.get('Set-Cookie') || '', /Path=\/api\/admin/);
    assert.match(cleared.headers.get('Set-Cookie') || '', /Max-Age=0/);
  });
});

describe('legacy admin logout', () => {
  it('clears both legacy admin and registry cookies without authenticating either', async () => {
    sessionData = null;
    const { onRequestPost } = await import('../functions/api/admin/logout.js');
    const response = await onRequestPost({
      request: new Request('https://adrianrasmussen.com/api/admin/logout', { method: 'POST' }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const cookies = response.headers.get('Set-Cookie') || '';
    assert.match(cookies, /admin_session=;/);
    assert.match(cookies, /registry_unlock=;/);
    assert.doesNotMatch(cookies, /better-auth/);
  });
});
