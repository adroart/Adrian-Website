import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

let signedInUser = {
  userId: 'better-auth-user-1',
  email: 'buyer@example.com',
  user: { id: 'better-auth-user-1', email: 'buyer@example.com', emailVerified: false },
};
let relinkCalls = 0;
let ensureUserCalls = 0;
let orderUpdateCalls = 0;
let fetchCalls = 0;
const originalFetch = globalThis.fetch;

before(() => {
  mock.module('../functions/api/_lib/auth.js', {
    namedExports: {
      verifyRequest: async () => signedInUser,
      requireUser: async () => signedInUser,
      jsonResponse: (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
        ...init,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }),
    },
  });
  mock.module('../functions/api/_lib/db.js', {
    namedExports: {
      getUserByClerkId: async () => ({ id: 'bridge-user-1', stripe_customer_id: null }),
      upsertUser: async () => ({ id: 'bridge-user-1', stripe_customer_id: null }),
      setUserStripeCustomer: async () => undefined,
      relinkOrdersByEmail: async () => { relinkCalls += 1; },
      ensureUser: async () => {
        ensureUserCalls += 1;
        return { id: 'bridge-user-1' };
      },
    },
  });
  mock.module('../functions/api/_lib/stripe.js', {
    namedExports: { ensureStripeCustomer: async () => 'cus_test' },
  });
});

beforeEach(() => {
  signedInUser = {
    userId: 'better-auth-user-1',
    email: 'buyer@example.com',
    user: { id: 'better-auth-user-1', email: 'buyer@example.com', emailVerified: false },
  };
  relinkCalls = 0;
  ensureUserCalls = 0;
  orderUpdateCalls = 0;
  fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ customer_details: { email: 'buyer@example.com' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  mock.reset();
});

function post(path: string, body?: unknown) {
  return new Request(`https://adrianrasmussen.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://adrianrasmussen.com' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const db = {
  prepare: () => ({
    bind: () => ({
      run: async () => {
        orderUpdateCalls += 1;
        return { meta: { changes: 1 } };
      },
    }),
  }),
};

describe('verified-email customer identity bridge', () => {
  it('does not relink guest orders by email for an unverified session', async () => {
    const { onRequest } = await import('../functions/api/auth/sync-user.js');
    const response = await onRequest({ request: post('/api/auth/sync-user'), env: { DB: db } });

    assert.equal(response.status, 200);
    assert.equal(relinkCalls, 0);
  });

  it('retains guest-order relinking for a verified session', async () => {
    signedInUser.user.emailVerified = true;
    const { onRequest } = await import('../functions/api/auth/sync-user.js');
    const response = await onRequest({ request: post('/api/auth/sync-user'), env: { DB: db } });

    assert.equal(response.status, 200);
    assert.equal(relinkCalls, 1);
  });

  it('rejects an unverified order claim before Stripe lookup or database writes', async () => {
    const { onRequest } = await import('../functions/api/orders/claim.js');
    const response = await onRequest({
      request: post('/api/orders/claim', { stripeSessionId: 'cs_test_123' }),
      env: { DB: db, STRIPE_SECRET_KEY: 'sk_test' },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'verified_email_required' });
    assert.equal(fetchCalls, 0);
    assert.equal(ensureUserCalls, 0);
    assert.equal(orderUpdateCalls, 0);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  it('retains order claiming for a verified matching email', async () => {
    signedInUser.user.emailVerified = true;
    const { onRequest } = await import('../functions/api/orders/claim.js');
    const response = await onRequest({
      request: post('/api/orders/claim', { stripeSessionId: 'cs_test_123' }),
      env: { DB: db, STRIPE_SECRET_KEY: 'sk_test' },
    });

    assert.equal(response.status, 200);
    assert.equal(fetchCalls, 1);
    assert.equal(ensureUserCalls, 1);
    assert.equal(orderUpdateCalls, 1);
  });
});

describe('Clerk retirement', () => {
  it('uses only the central auth module in customer runtime handlers', () => {
    const paths = [
      'functions/api/auth/sync-user.js',
      'functions/api/checkout.js',
      ...['profile', 'cart', 'collections', 'orders', 'keeper'].flatMap((dir) => {
        const directory = resolve(root, `functions/api/${dir}`);
        return readdirSync(directory)
          .filter((name) => name.endsWith('.js'))
          .map((name) => `functions/api/${dir}/${name}`);
      }),
    ];
    for (const path of paths) {
      assert.doesNotMatch(source(path), /_lib\/clerk\.js/, path);
    }
    assert.equal(existsSync(resolve(root, 'functions/api/_lib/clerk.js')), false);
  });

  it('has no public Clerk webhook handler and no unused svix dependency', () => {
    assert.equal(existsSync(resolve(root, 'functions/api/clerk/webhook.js')), false);
    assert.equal(existsSync(resolve(root, 'functions/api/clerk')), false);
    const pkg = JSON.parse(source('package.json'));
    assert.equal(pkg.dependencies?.svix, undefined);
    assert.doesNotMatch(source('package-lock.json'), /node_modules\/svix/);
  });

  it('lets account routes reach the SPA and keeps checkout on central Better Auth', () => {
    assert.doesNotMatch(source('public/_redirects'), /^\/account(?:\/\*)?\s+/m);
    const checkout = source('functions/api/checkout.js');
    assert.match(checkout, /import\(['"]\.\/_lib\/auth\.js['"]\)/);
    assert.doesNotMatch(checkout, /CLERK_|Clerk bearer token/);
  });

  it('requires a verified email before any artwork ownership claim', () => {
    const bind = source('functions/api/keeper/bind.js');
    assert.match(bind, /auth\.user\?\.emailVerified !== true/);
    assert.match(bind, /verified_email_required/);
  });
});
