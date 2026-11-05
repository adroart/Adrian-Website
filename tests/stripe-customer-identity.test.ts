import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

let auth: any;
const originalFetch = globalThis.fetch;
const shopEnabled = LAUNCH_FLAGS.shopEnabled;
let calls: Array<{ url: string; body: URLSearchParams }>;
before(() => {
  mock.module('../functions/api/_lib/auth.js', { namedExports: {
    requireUser: async () => auth ?? new Response('unauthorized', { status: 401 }),
    verifyRequest: async () => auth,
    jsonResponse: (body: unknown, init: ResponseInit = {}) => Response.json(body, {
      ...init, headers: { 'Cache-Control': 'no-store' },
    }),
  } });
  mock.module('../functions/api/_lib/atlasSale.js', { namedExports: {
    recordPendingAtlasSale: async () => ({ ok: true }),
  } });
});
beforeEach(() => {
  auth = { userId: 'account', email: 'owner@example.com', user: {
    id: 'account', email: 'owner@example.com', emailVerified: false,
  } };
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: new URLSearchParams(String(init?.body ?? '')) });
    if (url.includes('/customers?')) return Response.json({ data: [{ id: 'cus_owner' }] });
    if (url.includes('/line_items')) return Response.json({ data: [], has_more: false });
    if (url.endsWith('/checkout/sessions')) return Response.json({ url: 'https://checkout.example.test/synthetic' });
    throw new Error('Unexpected network request: ' + url);
  }) as typeof fetch;
});
after(() => { globalThis.fetch = originalFetch; LAUNCH_FLAGS.shopEnabled = shopEnabled; mock.reset(); });

function fixture({ verified = false, bridgeEmail = 'owner@example.com', customer = null as string | null, orphan = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/006_better_auth.sql', import.meta.url), 'utf8'));
  db.exec('ALTER TABLE users ADD COLUMN auth_user_id TEXT; CREATE UNIQUE INDEX fixture_auth_id ON users(auth_user_id);');
  if (!orphan) db.prepare('INSERT INTO user (id, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 0, 0)')
    .run('account', 'owner@example.com', Number(verified));
  db.prepare('INSERT INTO users (auth_user_id, clerk_user_id, email, stripe_customer_id) VALUES (?, ?, ?, ?)')
    .run('account', 'account', bridgeEmail, customer);
  const binding = { prepare(sql: string) {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...args: SQLInputValue[]) { values = args; return statement; },
      async first() { return db.prepare(sql).get(...values) ?? null; },
      async all() { return { results: db.prepare(sql).all(...values) }; },
      async run() { const info = db.prepare(sql).run(...values); return { success: true, meta: { changes: Number(info.changes) } }; },
    }; return statement;
  }, async batch(statements: any[]) { return Promise.all(statements.map(s => s.run())); } };
  return { db, env: { DB: binding, STRIPE_SECRET_KEY: 'sk_test_synthetic', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic' } };
}
function request(path: string, body?: unknown) {
  return new Request(`https://adrianrasmussen.com/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: 'https://adrianrasmussen.com', 'Content-Type': 'application/json', 'cf-connecting-ip': path + Math.random() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function eventRequest(secret: string, customer: string | null = null, email = 'owner@example.com') {
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: {
    id: 'cs_synthetic', customer, payment_status: 'paid', amount_total: 1234, currency: 'usd',
    customer_details: { email },
  } } });
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)));
  const signature = Array.from(mac, byte => byte.toString(16).padStart(2, '0')).join('');
  return new Request('https://adrianrasmussen.com/api/stripe/webhook', { method: 'POST', body,
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
  });
}

describe('verified Stripe customer association', () => {
  for (const verified of [false, true]) it(`sync only resolves a Stripe customer for verified ownership (${verified})`, async () => {
    const f = fixture({ verified }); auth.user.emailVerified = verified;
    try {
      const { onRequest } = await import('../functions/api/auth/sync-user.js');
      const response = await onRequest({ request: request('auth/sync-user', {}), env: f.env });
      assert.equal(response.status, 200);
      assert.equal(calls.filter(c => c.url.includes('/customers?')).length, Number(verified));
      assert.equal(f.db.prepare('SELECT stripe_customer_id FROM users').get()?.stripe_customer_id, verified ? 'cus_owner' : null);
    } finally { f.db.close(); }
  });

  for (const mode of ['email', 'customer'] as const) {
    for (const scenario of ['unverified', 'verified', 'stale', 'orphan', 'guest'] as const) it(`signed webhook ${mode} match requires authoritative verified identity (${scenario})`, async () => {
      const customer = mode === 'customer' ? 'cus_owner' : null;
      const f = fixture({ verified: scenario === 'verified' || scenario === 'stale', customer,
        bridgeEmail: scenario === 'stale' ? 'stale@example.com' : 'owner@example.com', orphan: scenario === 'orphan' });
      try {
        if (scenario === 'guest') f.db.exec('DELETE FROM users; DELETE FROM user;');
        const { onRequest } = await import('../functions/api/stripe/webhook.js');
        const response = await onRequest({ request: await eventRequest(f.env.STRIPE_WEBHOOK_SECRET, customer), env: f.env });
        assert.equal(response.status, 200);
        const order = f.db.prepare('SELECT user_id, email, amount_total FROM orders').get();
        assert.equal(order?.user_id, scenario === 'verified' ? 1 : null);
        assert.equal(order?.email, 'owner@example.com');
        assert.equal(order?.amount_total, 1234);
      } finally { f.db.close(); }
    });
  }

  for (const verified of [false, true]) it(`order reads gate existing associations on verified ownership (${verified})`, async () => {
    const f = fixture({ verified }); auth.user.emailVerified = verified;
    f.db.prepare("INSERT INTO orders (user_id, stripe_session_id, email, status, amount_total, currency) VALUES (1, 'cs_existing', 'owner@example.com', 'paid', 1234, 'USD')").run();
    try {
      const { onRequest } = await import('../functions/api/orders/list.js');
      const response = await onRequest({ request: request('orders/list'), env: f.env });
      assert.equal(response.status, verified ? 200 : 403);
      const body = await response.json();
      if (verified) assert.equal(body[0].stripeSessionId, 'cs_existing');
      else assert.deepEqual(body, { error: 'verified_email_required' });
    } finally { f.db.close(); }
  });

  for (const mode of ['unverified', 'verified', 'guest', 'stale'] as const) it(`checkout preserves guest behavior and only uses verified customer links (${mode})`, async () => {
    const f = fixture({ verified: mode === 'verified' || mode === 'stale', customer: 'cus_owner', bridgeEmail: mode === 'stale' ? 'stale@example.com' : 'owner@example.com' });
    if (mode === 'guest') auth = null; else auth.user.emailVerified = mode === 'verified' || mode === 'stale';
    const prior = LAUNCH_FLAGS.shopEnabled; LAUNCH_FLAGS.shopEnabled = true;
    try {
      const { onRequestPost } = await import('../functions/api/checkout.js');
      const response = await onRequestPost({ request: request('checkout', { items: [{ stripePriceId: 'price_synthetic', quantity: 1 }] }), env: f.env });
      assert.equal(response.status, 200);
      const checkout = calls.find(c => c.url.endsWith('/checkout/sessions'));
      assert.ok(checkout);
      assert.equal(checkout.body.get('customer'), mode === 'verified' ? 'cus_owner' : null);
    } finally { LAUNCH_FLAGS.shopEnabled = prior; f.db.close(); }
  });
});


it('does not trust a legacy customer ID when the purchase email belongs to someone else', async () => {
  const f = fixture({ verified: true, customer: 'cus_owner' });
  try {
    const { onRequest } = await import('../functions/api/stripe/webhook.js');
    const response = await onRequest({ request: await eventRequest(f.env.STRIPE_WEBHOOK_SECRET, 'cus_owner', 'someone-else@example.com'), env: f.env });
    assert.equal(response.status, 200);
    assert.equal(f.db.prepare('SELECT user_id FROM orders').get()?.user_id, null);
  } finally { f.db.close(); }
});
