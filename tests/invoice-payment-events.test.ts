import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, describe, it, mock } from 'node:test';

let signedIn = true;
before(() => mock.module('../lib/account/auth.server.js', { namedExports: {
  createAuth: () => ({ api: { getSession: async () => signedIn ? ({
    session: { id: 'session' },
    user: { id: 'admin-user', email: 'admin@example.com', emailVerified: true },
  }) : null } }),
} }));
after(() => mock.reset());

const schema = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((name) => name.endsWith('.sql')).sort()
  .map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).join('\n');

function d1(database: DatabaseSync) {
  return { prepare(sql: string) {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() { const info = database.prepare(sql).run(...values); return { success: true, meta: { changes: info.changes } }; },
    };
  } };
}

function fixture(status = 'sent') {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(schema);
  database.prepare(`INSERT INTO invoices
    (invoice_number, public_token, status, client_name, job_title, job_description,
     currency, total_cents, due_today_cents)
    VALUES ('INV-1', 'token-1', ?, 'Collector', 'Piece', 'Original', 'USD', 10000, 10000)`)
    .run(status);
  return { database, env: { DB: d1(database), ADMIN_EMAILS: 'admin@example.com' } };
}

function request(body: unknown) {
  return new Request('https://adrianrasmussen.com/api/admin/invoices/1/mark-paid', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://adrianrasmussen.com' },
    body: JSON.stringify(body),
  });
}

async function invoke(env: any, body: unknown) {
  const { onRequestPost } = await import('../functions/api/admin/invoices/[id]/mark-paid.js');
  const response = await onRequestPost({ request: request(body), env, params: { id: '1' } } as any);
  return { status: response.status, body: await response.json() as any };
}

describe('manual invoice payment events', () => {
  it('replays the same request without double counting and conflicts on changed content', async () => {
    const fx = fixture();
    try {
      const input = { paidCents: 2500, idempotencyKey: 'payment-attempt-1' };
      const first = await invoke(fx.env, input);
      const replay = await invoke(fx.env, input);
      const conflict = await invoke(fx.env, { ...input, paidCents: 2600 });
      assert.equal(first.status, 200);
      assert.equal(first.body.replayed, false);
      assert.equal(replay.body.replayed, true);
      assert.equal(conflict.status, 409);
      assert.equal(conflict.body.error, 'idempotency_conflict');
      assert.equal(fx.database.prepare('SELECT amount_paid_cents FROM invoices WHERE id=1').get().amount_paid_cents, 2500);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoice_payment_events').get().count, 1);
    } finally { fx.database.close(); }
  });

  it('accumulates two genuinely separate concurrent payments without losing either', async () => {
    const fx = fixture();
    try {
      const results = await Promise.all([
        invoke(fx.env, { paidCents: 3000, idempotencyKey: 'separate-payment-a' }),
        invoke(fx.env, { paidCents: 2000, idempotencyKey: 'separate-payment-b' }),
      ]);
      assert.deepEqual(results.map(item => item.status), [200, 200]);
      assert.equal(fx.database.prepare('SELECT amount_paid_cents FROM invoices WHERE id=1').get().amount_paid_cents, 5000);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoice_payment_events').get().count, 2);
    } finally { fx.database.close(); }
  });

  it('replays a concurrent exact full-payment retry even when the balance is already filled', async () => {
    const fx = fixture();
    try {
      const input = { paidCents: 10000, idempotencyKey: 'same-full-payment' };
      const results = await Promise.all([invoke(fx.env, input), invoke(fx.env, input)]);
      assert.deepEqual(results.map(item => item.status), [200, 200]);
      assert.equal(results.filter(item => item.body.replayed).length, 1);
      assert.equal(fx.database.prepare('SELECT amount_paid_cents FROM invoices WHERE id=1').get().amount_paid_cents, 10000);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoice_payment_events').get().count, 1);
    } finally { fx.database.close(); }
  });

  it('preserves an explicit total choice and rejects later changes or overpayment', async () => {
    const fx = fixture();
    try {
      const chosen = await invoke(fx.env, { paidCents: 4000, totalCents: 12000, idempotencyKey: 'chosen-total-one' });
      assert.equal(chosen.status, 200);
      const changed = await invoke(fx.env, { paidCents: 1000, totalCents: 13000, idempotencyKey: 'chosen-total-two' });
      assert.equal(changed.status, 409);
      assert.equal(changed.body.error, 'total_conflict');
      const over = await invoke(fx.env, { paidCents: 9000, idempotencyKey: 'overpayment-one' });
      assert.equal(over.status, 409);
      assert.equal(over.body.error, 'overpayment');
      const row: any = fx.database.prepare('SELECT total_cents, amount_paid_cents FROM invoices WHERE id=1').get();
      assert.deepEqual([row.total_cents, row.amount_paid_cents], [12000, 4000]);
    } finally { fx.database.close(); }
  });

  it('rolls the event and invoice accumulation back together on downstream failure', async () => {
    const fx = fixture();
    try {
      fx.database.exec(`CREATE TRIGGER payment_test_failure AFTER INSERT ON invoice_payment_events
        BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END;`);
      const result = await invoke(fx.env, { paidCents: 1000, idempotencyKey: 'rollback-payment' });
      assert.equal(result.status, 503);
      assert.equal(fx.database.prepare('SELECT amount_paid_cents FROM invoices WHERE id=1').get().amount_paid_cents, 0);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoice_payment_events').get().count, 0);
    } finally { fx.database.close(); }
  });

  it('rejects void invoices and malformed or implicit payments', async () => {
    const fx = fixture('void');
    try {
      assert.equal((await invoke(fx.env, { paidCents: 1000, idempotencyKey: 'void-payment-1' })).status, 404);
      assert.equal((await invoke(fx.env, { idempotencyKey: 'missing-amount' })).body.error, 'invalid_paid_cents');
      assert.equal((await invoke(fx.env, { paidCents: 1.5, idempotencyKey: 'float-amount' })).body.error, 'invalid_paid_cents');
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoice_payment_events').get().count, 0);
    } finally { fx.database.close(); }
  });

  it('keeps the exact admin boundary', async () => {
    const fx = fixture();
    try {
      signedIn = false;
      assert.equal((await invoke(fx.env, { paidCents: 1000, idempotencyKey: 'unauthorized-payment' })).status, 401);
    } finally { signedIn = true; fx.database.close(); }
  });
});
