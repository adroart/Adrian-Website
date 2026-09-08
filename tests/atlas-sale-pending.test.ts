/**
 * A confirmed Stripe sale lands as a pending atlas_sale_events row, locally.
 *
 * Measured on 2026-09-08: the Stripe webhook posted every paid checkout to
 * https://mandalacodes.com/api/atlas/sale, HMAC-signed with
 * SALE_WEBHOOK_SECRET. That endpoint's middleware now answers every
 * non-read request with 410 atlas_moved (the Atlas record moved to this
 * site on 2026-08-09); the webhook retried three times and gave up
 * silently, so a real sale never became a pending row anywhere.
 * atlas_sale_events lives in the same D1 database this site already binds
 * as `DB`, so functions/api/_lib/atlasSale.js now writes it directly — no
 * HTTP, no HMAC secret, no retries. This test proves the full webhook path
 * (signature verification included, computed the same way Stripe's own
 * signing does, no network call) still lands the row.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequest as webhookRequest } from '../functions/api/stripe/webhook.js';
import { recordPendingAtlasSale } from '../functions/api/_lib/atlasSale.js';

const migration = (name: string) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

const schema = ['001_init.sql', '003_atlas_legacy.sql', '005_atlas_legacy.sql']
  .map(migration)
  .join('\n');

function d1(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) {
          values = args;
          return this;
        },
        async all() {
          return { results: database.prepare(sql).all(...values) };
        },
        async first() {
          return database.prepare(sql).get(...values) ?? null;
        },
        async run() {
          const info = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: info.changes } };
        },
      };
    },
    async batch(stmts: unknown[]) {
      // Not exercised by these tests (no line-item batch path), but kept so
      // the webhook handler's shape stays intact if that ever changes.
      return Promise.all((stmts as { run: () => Promise<unknown> }[]).map((s) => s.run()));
    },
  };
}

function freshDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(schema);
  return database;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build a Stripe-shaped request the same way Stripe itself would sign one
 *  (its own HMAC recipe, computed here — no network call to Stripe). */
async function signedStripeRequest(secret: string, event: unknown) {
  const body = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const signature = await hmacHex(secret, `${ts}.${body}`);
  return new Request('https://adrianrasmussen.com/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${ts},v1=${signature}`,
    },
    body,
  });
}

function checkoutSessionCompletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_atlas_bridge_1',
        payment_status: 'paid',
        amount_total: 42_000,
        currency: 'usd',
        created: Math.floor(Date.now() / 1000),
        customer: null,
        customer_details: { email: 'collector@example.com', name: 'A Collector' },
        ...overrides,
      },
    },
  };
}

describe('a confirmed checkout enqueues a pending atlas sale, locally', () => {
  it('inserts a pending atlas_sale_events row on checkout.session.completed', async () => {
    const database = freshDatabase();
    try {
      const env = { DB: d1(database), STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' };
      const request = await signedStripeRequest(
        env.STRIPE_WEBHOOK_SECRET,
        checkoutSessionCompletedEvent(),
      );

      const response = await webhookRequest({ request, env, waitUntil: () => {} } as any);
      assert.equal(response.status, 200);

      const row = database
        .prepare('SELECT * FROM atlas_sale_events WHERE sale_id = ?')
        .get('cs_test_atlas_bridge_1') as any;
      assert.ok(row, 'expected a pending atlas_sale_events row');
      assert.equal(row.status, 'pending');
      assert.equal(row.buyer_email, 'collector@example.com');
      assert.equal(row.buyer_name, 'A Collector');
      assert.equal(row.price_cents, 42_000);
      assert.equal(row.currency, 'USD');
    } finally {
      database.close();
    }
  });

  it('never reaches mandalacodes.com — no HTTP sender remains', async () => {
    const database = freshDatabase();
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async (...args: unknown[]) => {
      fetchCalled = true;
      throw new Error(`unexpected network call: ${String(args[0])}`);
    }) as typeof fetch;
    try {
      const env = { DB: d1(database), STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' };
      const request = await signedStripeRequest(
        env.STRIPE_WEBHOOK_SECRET,
        checkoutSessionCompletedEvent({ id: 'cs_test_atlas_bridge_2' }),
      );
      const response = await webhookRequest({ request, env, waitUntil: () => {} } as any);
      assert.equal(response.status, 200);
      assert.equal(fetchCalled, false, 'the webhook must not make any network call');
    } finally {
      globalThis.fetch = originalFetch;
      database.close();
    }
  });

  it('is idempotent on saleId — a retried webhook does not duplicate the row', async () => {
    const database = freshDatabase();
    try {
      const env = { DB: d1(database), STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' };
      const event = checkoutSessionCompletedEvent({ id: 'cs_test_atlas_bridge_3' });
      await webhookRequest({
        request: await signedStripeRequest(env.STRIPE_WEBHOOK_SECRET, event),
        env,
        waitUntil: () => {},
      } as any);
      await webhookRequest({
        request: await signedStripeRequest(env.STRIPE_WEBHOOK_SECRET, event),
        env,
        waitUntil: () => {},
      } as any);

      const rows = database
        .prepare('SELECT * FROM atlas_sale_events WHERE sale_id = ?')
        .all('cs_test_atlas_bridge_3');
      assert.equal(rows.length, 1);
    } finally {
      database.close();
    }
  });

  it('recordPendingAtlasSale is best-effort: a missing DB binding never throws', async () => {
    const result = await recordPendingAtlasSale({}, {
      saleId: 'cs_no_db',
      buyerEmail: 'a@b.com',
      saleDate: new Date().toISOString(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'db_not_configured');
  });
});
