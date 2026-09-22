import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it } from 'node:test';

import { onRequest, replaceOrderLineItems } from '../functions/api/stripe/webhook.js';

const schema = readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8');

function d1(database: DatabaseSync, failInsert = false) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    const statement = {
      sql,
      bind(...args: SQLInputValue[]) { values = args; return statement; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      runSync() {
        if (failInsert && /INSERT INTO order_items/i.test(sql)) throw new Error('synthetic item failure');
        const info = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(info.changes) } };
      },
      async run() { return statement.runSync(); },
    };
    return statement;
  };
  return {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement) => statement.runSync());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.prepare(`INSERT INTO orders
    (id, stripe_session_id, email, status, amount_total, currency)
    VALUES (1, 'cs_retry', 'buyer@example.com', 'paid', 1000, 'USD')`).run();
  db.prepare(`INSERT INTO order_items
    (order_id, product_id, description, quantity, amount_subtotal)
    VALUES (1, 'old', 'Old item', 1, 1000)`).run();
  return db;
}

async function signed(secret: string, event: unknown) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`),
  ));
  const signature = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Request('https://example.test/api/stripe/webhook', {
    method: 'POST', body,
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}`, 'content-type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

describe('Stripe webhook retry boundaries', () => {
  it('rolls back deletion when replacement item insertion fails', async () => {
    const db = database();
    try {
      await assert.rejects(() => replaceOrderLineItems({ DB: d1(db, true) }, 'cs_retry', [{
        description: 'New item', quantity: 1, amount_subtotal: 1000,
        price: { id: 'price-new', product: 'prod-new' },
      }]));
      const items = db.prepare('SELECT product_id FROM order_items').all() as any[];
      assert.deepEqual(items.map((row) => row.product_id), ['old']);
    } finally { db.close(); }
  });

  it('returns retryable 503 for failed, invalid, or truncated line-item enrichment', async () => {
    for (const reply of [
      new Response('down', { status: 502 }),
      new Response('{}', { status: 200 }),
      new Response(JSON.stringify({ data: [], has_more: true }), { status: 200 }),
    ]) {
      const db = database();
      globalThis.fetch = (async () => reply.clone()) as typeof fetch;
      try {
        const secret = 'whsec_retry_test';
        const response = await onRequest({ request: await signed(secret, {
          type: 'checkout.session.completed', data: { object: {
            id: 'cs_retry', payment_status: 'paid', amount_total: 1000,
            currency: 'usd', customer_details: { email: 'buyer@example.com' },
          } },
        }), env: { DB: d1(db), STRIPE_WEBHOOK_SECRET: secret, STRIPE_SECRET_KEY: 'sk_test' } });
        assert.equal(response.status, 503);
        assert.equal(db.prepare('SELECT product_id FROM order_items').get()?.product_id, 'old');
      } finally { db.close(); }
    }
  });

  it('returns 503 when the paid-sale enqueue reports failure while retaining the order', async () => {
    const db = database();
    try {
      const secret = 'whsec_enqueue_test';
      const response = await onRequest({ request: await signed(secret, {
        type: 'checkout.session.completed', data: { object: {
          id: 'cs_enqueue_retry', payment_status: 'paid', amount_total: 2500,
          currency: 'usd', customer_details: { email: 'buyer@example.com' },
        } },
      }), env: { DB: d1(db), STRIPE_WEBHOOK_SECRET: secret } });
      assert.equal(response.status, 503);
      assert.equal(db.prepare(
        "SELECT status FROM orders WHERE stripe_session_id = 'cs_enqueue_retry'",
      ).get()?.status, 'paid');
    } finally { db.close(); }
  });
});
