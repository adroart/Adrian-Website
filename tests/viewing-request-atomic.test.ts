import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/viewings/[token]/request.js';

const migration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

function d1(database: DatabaseSync, failBatch = false) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...args: SQLInputValue[]) { values = args; return statement; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      runSync() {
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
        const results = statements.map((statement, index) => {
          if (failBatch && index === 1) throw new Error('synthetic link failure');
          return statement.runSync();
        });
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function fixture(failBatch = false) {
  const database = new DatabaseSync(':memory:');
  database.exec(`${migration('001_init.sql')}\n${migration('002_invoices.sql')}\n${migration('003_viewings.sql')}\n${migration('004_invoice_payment_choice.sql')}`);
  database.prepare(
    `INSERT INTO viewings
       (public_token, status, recipient_name, client_email, data_json)
     VALUES (?, 'sent', 'A & <Collector>', 'collector@example.com', ?)`,
  ).run('viewing_token_atomic_1234', JSON.stringify({
    pieces: [{ id: 'UL-1', name: 'Earth & <Breath>', code: '1', recommended: true }],
  }));
  return { database, env: { DB: d1(database, failBatch), RESEND_API_KEY: 're_test_disabled' } };
}

function request() {
  return new Request('https://example.test/api/viewings/viewing_token_atomic_1234/request', {
    method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.44' },
    body: JSON.stringify({ pieceIds: ['UL-1'], message: '<please>' }),
  });
}

describe('viewing request atomic draft linkage', () => {
  it('returns the original outcome for sequential and concurrent retries', async () => {
    const fx = fixture();
    try {
      const call = () => onRequestPost({
        env: fx.env, params: { token: 'viewing_token_atomic_1234' }, request: request(),
      });
      const first = await call();
      assert.equal(first.status, 200);
      const firstBody = await first.json() as any;
      const [retry, raced] = await Promise.all([call(), call()]);
      for (const response of [retry, raced]) {
        assert.equal(response.status, 200);
        const body = await response.json() as any;
        assert.equal(body.alreadyRequested, true);
        assert.equal(body.invoiceToken, firstBody.invoiceToken);
      }
      assert.equal(fx.database.prepare('SELECT COUNT(*) AS count FROM invoices').get()?.count, 1);
      const viewing = fx.database.prepare('SELECT * FROM viewings').get() as any;
      assert.equal(viewing.invoice_token, firstBody.invoiceToken);
      assert.equal(viewing.status, 'requested');
    } finally { fx.database.close(); }
  });

  it('rolls the invoice insert back when linkage fails', async () => {
    const fx = fixture(true);
    try {
      const response = await onRequestPost({
        env: fx.env, params: { token: 'viewing_token_atomic_1234' }, request: request(),
      });
      assert.equal(response.status, 503);
      assert.equal(fx.database.prepare('SELECT COUNT(*) AS count FROM invoices').get()?.count, 0);
      const viewing = fx.database.prepare('SELECT status, invoice_token FROM viewings').get() as any;
      assert.deepEqual({ ...viewing }, { status: 'sent', invoice_token: null });
    } finally { fx.database.close(); }
  });
});
