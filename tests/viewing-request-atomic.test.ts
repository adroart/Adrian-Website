import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import { onRequestGet as getInvoice } from '../functions/api/invoices/[token].js';
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
    pieces: [
      { id: 'UL-1', name: 'Earth & <Breath>', code: '1', recommended: true },
      { id: 'UL-2', name: 'A Second Piece', code: '2', recommended: false },
    ],
  }));
  return { database, env: { DB: d1(database, failBatch), RESEND_API_KEY: 're_test_disabled' } };
}

function request(body: unknown = { pieceIds: ['UL-1'], message: '<please>' }, ip = '192.0.2.44') {
  return new Request('https://example.test/api/viewings/viewing_token_atomic_1234/request', {
    method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
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
        assert.deepEqual(body, { ok: true, alreadyRequested: true });
      }
      assert.equal(fx.database.prepare('SELECT COUNT(*) AS count FROM invoices').get()?.count, 1);
      const viewing = fx.database.prepare('SELECT * FROM viewings').get() as any;
      assert.deepEqual(firstBody, { ok: true, requested: 1 });
      assert.equal(typeof viewing.invoice_token, 'string');
      assert.equal(viewing.status, 'requested');
    } finally { fx.database.close(); }
  });

  it('rejects stale or explicitly empty selections and accepts a corrected exact piece', async () => {
    const fx = fixture();
    try {
      const call = (body: unknown) => onRequestPost({
        env: fx.env, params: { token: 'viewing_token_atomic_1234' }, request: request(body, '192.0.2.45'),
      });
      for (const body of [{ pieceIds: [] }, { pieceIds: ['stale'] }, { pieceIds: 'UL-1' }]) {
        const response = await call(body);
        assert.equal(response.status, 400);
        assert.deepEqual({ ...fx.database.prepare('SELECT status, invoice_token FROM viewings').get() }, {
          status: 'sent', invoice_token: null,
        });
        assert.equal(fx.database.prepare('SELECT COUNT(*) AS count FROM invoices').get()?.count, 0);
      }
      const response = await call({ pieceIds: ['UL-2'] });
      assert.equal(response.status, 200);
      const invoice = fx.database.prepare('SELECT status, line_items_json, public_token FROM invoices').get() as any;
      assert.equal(invoice.status, 'draft');
      assert.deepEqual(JSON.parse(invoice.line_items_json).map(item => item.description), ['A Second Piece · Universal Language No. 2']);
      const lookup = () => getInvoice({ env: fx.env, params: { token: invoice.public_token } });
      assert.equal((await lookup()).status, 404);
      fx.database.exec("UPDATE invoices SET status = 'paid', total_cents = 12000");
      assert.equal((await lookup()).status, 404, 'a private paid receipt has no share marker');
      fx.database.exec("UPDATE invoices SET status = 'sent', sent_at = 1736460207, total_cents = 0");
      assert.equal((await lookup()).status, 404, 'a shared zero-total invoice remains private');
      fx.database.exec("UPDATE invoices SET total_cents = 12000");
      assert.equal((await lookup()).status, 200);
      fx.database.exec("UPDATE invoices SET status = 'void'");
      assert.equal((await lookup()).status, 404);
    } finally { fx.database.close(); }
  });

  it('uses the saved recommendation only when no explicit selection was submitted', async () => {
    const fx = fixture();
    try {
      const response = await onRequestPost({
        env: fx.env, params: { token: 'viewing_token_atomic_1234' }, request: request({}, '192.0.2.46'),
      });
      assert.equal(response.status, 200);
      const invoice = fx.database.prepare('SELECT line_items_json FROM invoices').get() as any;
      assert.deepEqual(JSON.parse(invoice.line_items_json).map(item => item.description), ['Earth & <Breath> · Universal Language No. 1']);
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
