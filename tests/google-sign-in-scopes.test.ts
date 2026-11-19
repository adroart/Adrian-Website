import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createAuth } from '../lib/account/auth.server.js';

const origin = 'https://adrianrasmussen.com';
const env = {
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: 'Local-fixture-only-Google-auth-regression-secret-2026',
  GOOGLE_CLIENT_ID: 'fixture-client-id',
  GOOGLE_CLIENT_SECRET: 'fixture-client-secret',
};

test('the real sign-in handler requests identity without inheriting previous Google API grants', async () => {
  const auth = createAuth(env);
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ provider: 'google', callbackURL: '/admin', disableRedirect: true }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json() as { url: string };
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.deepEqual(new Set(url.searchParams.get('scope')?.split(' ')), new Set(['openid', 'email', 'profile']));
  assert.equal(url.searchParams.get('include_granted_scopes'), 'false');
  assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback/google`);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('state'));
  assert.ok(response.headers.get('set-cookie'), 'the OAuth state cookie is still issued');
});

test('isolating previous grants preserves provider state, callback and PKCE binding', async () => {
  const context = await createAuth(env).$context;
  const provider = context.socialProviders.find(item => item.id === 'google');
  assert.ok(provider);
  const verifier = 'fixture-code-verifier-for-scope-isolation-2026-123456789';
  const url = await provider.createAuthorizationURL({
    state: 'fixture-oauth-state', codeVerifier: verifier,
    redirectURI: `${origin}/api/auth/callback/google`, loginHint: 'fixture@example.test',
  });
  assert.equal(url.searchParams.get('include_granted_scopes'), 'false');
  assert.equal(url.searchParams.get('state'), 'fixture-oauth-state');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'));
  assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback/google`);
  assert.equal(url.searchParams.get('client_id'), env.GOOGLE_CLIENT_ID);
  assert.equal(url.searchParams.get('login_hint'), 'fixture@example.test');
});

test('Google isolation retains callback trust checks and optional provider configuration', async () => {
  const response = await createAuth(env).handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ provider: 'google', callbackURL: 'https://untrusted.example.test/admin', disableRedirect: true }),
  }));
  assert.equal(response.status, 403);
  const unconfigured = await createAuth({ BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET }).$context;
  assert.equal(unconfigured.socialProviders.some(provider => provider.id === 'google'), false);
});
