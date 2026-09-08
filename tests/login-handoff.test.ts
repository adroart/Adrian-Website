/**
 * The cross-site login handoff (identity direction,
 * i64os/substrate/directions/identity.md): a signed-in session on this site
 * mints a Better Auth one-time-token (functions/api/auth/handoff.js) and the
 * other site's accept endpoint (functions/api/auth/handoff/accept.js)
 * verifies it and sets its own session cookie. Both endpoints exist in both
 * repos; this file proves the shape once against a real Better Auth
 * instance running on a real `node:sqlite` in-memory database (Better Auth
 * 1.6 duck-types a `node:sqlite` DatabaseSync the same way it duck-types a
 * D1 binding — no shim needed, see @better-auth/kysely-adapter's dialect
 * detection), loaded with this repo's own `verification`/`session`/`user`
 * schema (migrations/006_better_auth.sql). A real email-OTP sign-in
 * produces the starting session cookie, exactly as a browser would get one.
 *
 * mandalacodes carries the mirror image of this test against its own copy
 * of the two endpoints.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, before, describe, it } from 'node:test';

import { createAuth } from '../lib/account/auth.server.js';
import { onRequest as mintHandoff } from '../functions/api/auth/handoff.js';
import { onRequest as acceptHandoff } from '../functions/api/auth/handoff/accept.js';

const schema = readFileSync(new URL('../migrations/006_better_auth.sql', import.meta.url), 'utf8');

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schema);
  return db;
}

function baseEnv(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  return {
    DB: db,
    BETTER_AUTH_SECRET: 'test-only-handoff-secret-not-a-real-value',
    BETTER_AUTH_URL: 'https://adrianrasmussen.com',
    RESEND_API_KEY: 'test-only-resend-key',
    HANDOFF_TARGET_ORIGIN: 'https://mandalacodes.test',
    ...overrides,
  };
}

/** Real email-OTP sign-in against the given env, returning the session cookie header. */
async function signIn(env: ReturnType<typeof baseEnv>, email = 'collector@example.com') {
  const originalFetch = globalThis.fetch;
  let capturedOtp = '';
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const match = /code is (\d+)/.exec(body.text);
    capturedOtp = match ? match[1] : '';
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const auth = createAuth(env);
    const sendReq = new Request('https://adrianrasmussen.com/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    });
    const sendRes = await auth.handler(sendReq);
    assert.equal(sendRes.status, 200, 'expected the sign-in code to send');

    const signInReq = new Request('https://adrianrasmussen.com/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: capturedOtp }),
    });
    const signInRes = await auth.handler(signInReq);
    assert.equal(signInRes.status, 200, 'expected sign-in to succeed');
    const cookies = signInRes.headers.getSetCookie();
    assert.ok(cookies.length > 0, 'expected a session cookie');
    return cookies.map((c) => c.split(';')[0]).join('; ');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function mintRequest(cookie: string | null, search = '') {
  return new Request(`https://adrianrasmussen.com/api/auth/handoff${search}`, {
    method: 'GET',
    headers: cookie ? { cookie } : {},
  });
}

function acceptRequest(query: string) {
  return new Request(`https://mandalacodes.test/api/auth/handoff/accept${query}`, { method: 'GET' });
}

describe('cross-site login handoff', () => {
  it('a valid token yields a session for the same user id on the other side', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({ request: mintRequest(cookie), env, waitUntil: () => {} } as any);
    assert.equal(mintRes.status, 302);
    const location = new URL(mintRes.headers.get('Location')!);
    assert.equal(location.origin, 'https://mandalacodes.test');
    assert.equal(location.pathname, '/api/auth/handoff/accept');
    const token = location.searchParams.get('token');
    assert.ok(token, 'expected a token in the redirect');

    const auth = createAuth(env);
    const originalSession = await auth.api.getSession({ headers: new Headers({ cookie }) });

    const acceptRes = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token!)}&next=${encodeURIComponent('/account')}`),
      env,
      waitUntil: () => {},
    } as any);
    assert.equal(acceptRes.status, 302);
    assert.equal(acceptRes.headers.get('Location'), '/account');
    const acceptedCookies = acceptRes.headers.getSetCookie();
    assert.ok(acceptedCookies.length > 0, 'expected accept to set a session cookie');

    const acceptedCookieHeader = acceptedCookies.map((c) => c.split(';')[0]).join('; ');
    const acceptedSession = await auth.api.getSession({ headers: new Headers({ cookie: acceptedCookieHeader }) });
    assert.ok(acceptedSession?.user?.id, 'expected the accepted cookie to resolve to a session');
    assert.equal(acceptedSession!.user.id, originalSession!.user.id);
  });

  it('a second use of the same token is rejected', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({ request: mintRequest(cookie), env, waitUntil: () => {} } as any);
    const token = new URL(mintRes.headers.get('Location')!).searchParams.get('token')!;

    const first = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token)}`),
      env,
      waitUntil: () => {},
    } as any);
    assert.equal(first.status, 302);

    const second = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token)}`),
      env,
      waitUntil: () => {},
    } as any);
    assert.equal(second.status, 400);
    assert.equal(second.headers.getSetCookie().length, 0, 'a rejected replay must not set a cookie');
  });

  it('an expired token is rejected', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({ request: mintRequest(cookie), env, waitUntil: () => {} } as any);
    const token = new URL(mintRes.headers.get('Location')!).searchParams.get('token')!;

    // The plugin stores the token hashed (storeToken: 'hashed'), so force
    // every pending verification row into the past rather than trying to
    // recompute the hash ourselves — there is only one at this point.
    db.exec(`UPDATE verification SET expiresAt = ${Date.now() - 60_000} WHERE identifier LIKE 'one-time-token:%'`);

    const res = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token)}`),
      env,
      waitUntil: () => {},
    } as any);
    assert.equal(res.status, 400);
  });

  it('an unauthenticated caller of the mint endpoint gets 401', async () => {
    const db = freshDb();
    const env = baseEnv(db);

    const res = await mintHandoff({ request: mintRequest(null), env, waitUntil: () => {} } as any);
    assert.equal(res.status, 401);
  });

  it('next with an external URL is rejected on both the mint and the accept side', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({
      request: mintRequest(cookie, `?next=${encodeURIComponent('https://evil.example/steal')}`),
      env,
      waitUntil: () => {},
    } as any);
    const location = new URL(mintRes.headers.get('Location')!);
    assert.equal(location.searchParams.get('next'), '/account', 'an external next must fall back to the default');

    const token = location.searchParams.get('token')!;
    const acceptRes = await acceptHandoff({
      request: acceptRequest(
        `?token=${encodeURIComponent(token)}&next=${encodeURIComponent('//evil.example/steal')}`,
      ),
      env,
      waitUntil: () => {},
    } as any);
    assert.equal(acceptRes.status, 302);
    assert.equal(acceptRes.headers.get('Location'), '/account', 'a protocol-relative next must fall back too');
  });

  it('resolves the target origin from BETTER_AUTH_URL when HANDOFF_TARGET_ORIGIN is unset', async () => {
    const db = freshDb();
    const prodEnv = baseEnv(db, { HANDOFF_TARGET_ORIGIN: undefined });
    const cookie = await signIn(prodEnv);
    const prodRes = await mintHandoff({ request: mintRequest(cookie), env: prodEnv, waitUntil: () => {} } as any);
    assert.equal(new URL(prodRes.headers.get('Location')!).origin, 'https://mandalacodes.com');

    const devDb = freshDb();
    const devEnv = baseEnv(devDb, {
      HANDOFF_TARGET_ORIGIN: undefined,
      BETTER_AUTH_URL: 'http://localhost:5555',
    });
    const devCookie = await signIn(devEnv);
    const devRes = await mintHandoff({ request: mintRequest(devCookie), env: devEnv, waitUntil: () => {} } as any);
    assert.equal(new URL(devRes.headers.get('Location')!).origin, 'http://localhost:2222');
  });
});
