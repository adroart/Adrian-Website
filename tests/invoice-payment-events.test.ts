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
  .filter((name) => name.endsWith('.sql') && Number(name.slice(0, 3)) <= 51).sort()
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

  it('does not record a payment against a currency or quoted total changed after review', async () => {
    const fx = editableFixture();
    try {
      assert.equal((await edit(fx.env, {currency: 'EUR'})).status, 200);
      const result = await invoke(fx.env, {
        paidCents: 2500, idempotencyKey: 'stale-payment-review', expectedCurrency: 'USD', expectedTotalCents: 10000,
      });
      assert.equal(result.status, 409);
      assert.equal(result.body.error, 'invoice_changed_or_locked');
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoice_payment_events').get()?.count, 0);
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

function editableFixture() {
  const fx = fixture();
  fx.database.exec(`UPDATE invoices SET subtotal_cents = 10000,
    line_items_json = '[{"description":"Original work","terms":"","amountCents":10000}]',
    payment_options_json = '[{"label":"Bank transfer","method":"bank","currency":"USD","details":"Test payment instructions"}]',
    payment_schedule_json = '[{"label":"Deposit","description":"To begin","dueTiming":"Due today","amountCents":5000},{"label":"Final payment","description":"When ready","dueTiming":"Before shipping","amountCents":5000}]',
    due_today_cents = 5000, offer_payment_choice = 1 WHERE id = 1`);
  return fx;
}

async function edit(env: any, body: unknown, method = 'PUT') {
  const { onRequest } = await import('../functions/api/admin/invoices/[id].js');
  return onRequest({
    request: new Request('https://adrianrasmussen.com/api/admin/invoices/1', {
      method, headers: { 'Content-Type': 'application/json', Origin: 'https://adrianrasmussen.com' },
      ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
    }),
    env,
    params: { id: '1' },
  });
}

describe('studio invoice edits', () => {
  it('preserves offered payment choice on ordinary edits and allows changing it explicitly', async () => {
    const fx = editableFixture();
    try {
      const saved = await edit(fx.env, { shippingText: 'Actual packing agreement' });
      assert.equal(saved.status, 200);
      assert.equal((await saved.json()).invoice.offerPaymentChoice, true);
      const disabled = await edit(fx.env, { offerPaymentChoice: false });
      assert.equal(disabled.status, 200);
      assert.equal((await disabled.json()).invoice.offerPaymentChoice, false);
    } finally { fx.database.close(); }
  });

  it('requires a receipt to mark an invoice paid and keeps settled financial facts intact', async () => {
    const fx = editableFixture();
    try {
      assert.equal((await edit(fx.env, { status: 'paid' })).status, 409);
      assert.equal((await invoke(fx.env, { paidCents: 4000, idempotencyKey: 'editable-payment-one' })).status, 200);
      assert.equal((await edit(fx.env, { currency: 'EUR', totalCents: 12000 })).status, 409);
      assert.equal((await edit(fx.env, { status: 'paid' })).status, 409);
      assert.equal((await edit(fx.env, { status: 'draft' })).status, 409);
      assert.equal((await edit(fx.env, { offerPaymentChoice: false })).status, 409);
      assert.equal((await edit(fx.env, { lineItems: [{description: 'Changed work', amountCents: 10000}] })).status, 409);
      assert.equal((await edit(fx.env, undefined, 'DELETE')).status, 409);
      assert.equal((await edit(fx.env, { notes: 'Private coordination retained' })).status, 200);
      assert.equal((await invoke(fx.env, { paidCents: 6000, idempotencyKey: 'editable-payment-two' })).status, 200);
      assert.equal((await edit(fx.env, { status: 'sent' })).status, 409);
      const result = await edit(fx.env, { notes: 'Settled' });
      assert.equal(result.status, 200);
      const invoice = (await result.json()).invoice;
      assert.equal(invoice.status, 'paid');
      assert.equal(invoice.currency, 'USD');
      assert.equal(invoice.amountPaidCents, 10000);
      assert.equal(invoice.totalCents, 10000);
    } finally { fx.database.close(); }
  });

  it('rejects changing the invoice if a receipt arrives after the update read', async () => {
    const fx = editableFixture();
    const prepare = fx.env.DB.prepare;
    try {
      fx.env.DB.prepare = (sql: string) => {
        const statement = prepare(sql);
        if (sql.includes('UPDATE invoices SET')) {
          const first = statement.first;
          statement.first = async () => {
            const receipt = await invoke(fx.env, { paidCents: 3000, idempotencyKey: 'receipt-during-edit' });
            assert.equal(receipt.status, 200);
            return first();
          };
        }
        return statement;
      };
      const result = await edit(fx.env, { currency: 'EUR', totalCents: 12000 });
      assert.equal(result.status, 409);
      assert.deepEqual({ ...fx.database.prepare('SELECT currency, total_cents, amount_paid_cents FROM invoices WHERE id = 1').get() },
        { currency: 'USD', total_cents: 10000, amount_paid_cents: 3000 });
    } finally { fx.database.close(); }
  });

  it('rejects creating an invoice in paid state without a receipt', async () => {
    const fx = editableFixture();
    try {
      const { onRequest } = await import('../functions/api/admin/invoices.js');
      fx.database.exec(`INSERT INTO payment_presets (label, method, instructions)
        VALUES ('Bank transfer', 'bank', 'Test payment instructions')`);
      const response = await onRequest({
        request: new Request('https://adrianrasmussen.com/api/admin/invoices', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://adrianrasmussen.com' },
          body: JSON.stringify({
            status: 'paid', clientName: 'Test Buyer', jobTitle: 'Test work', jobDescription: 'An original work',
            lineItems: [{description: 'Original', amountCents: 10000}],
            paymentPresetIds: [1],
            paymentSchedule: [{label: 'Full payment', description: 'To begin', dueTiming: 'Due today', amountCents: 10000}],
          }),
        }),
        env: fx.env,
      });
      assert.equal(response.status, 409);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM invoices').get()?.count, 1);
    } finally { fx.database.close(); }
  });
});

describe('studio invoice sharing', () => {
  it('only marks a complete draft sent when its saved terms match the version being shared', async () => {
    const { onRequestPost } = await import('../functions/api/admin/invoices/[id]/send.js');
    const ready = editableFixture();
    const unpriced = fixture('draft');
    try {
      ready.database.exec("UPDATE invoices SET status = 'draft' WHERE id = 1");
      const send = (env: typeof ready.env, version?: string) => onRequestPost({
        request: new Request('https://adrianrasmussen.com/api/admin/invoices/1/send', {
          method: 'POST', headers: {
            Origin: 'https://adrianrasmussen.com', ...(version ? { 'If-Match': version } : {}),
          },
        }),
        env, params: { id: '1' },
      });
      const versionFor = () => ready.database.prepare(
        `SELECT printf('"%d:%d"', updated_at, amount_paid_cents) AS version FROM invoices WHERE id = 1`,
      ).get()?.version as string;
      const before = versionFor();
      assert.equal((await edit(ready.env, { shippingText: 'Shipping agreed' })).status, 200);
      assert.equal((await send(ready.env, before)).status, 409);
      assert.equal((await send(unpriced.env)).status, 409);
      assert.equal(ready.database.prepare('SELECT status FROM invoices WHERE id=1').get()?.status, 'draft');
      const result = await send(ready.env, versionFor());
      assert.equal(result.status, 200);
      const data = await result.json();
      assert.equal(data.invoice.status, 'sent');
      assert.equal(data.invoice.shippingText, 'Shipping agreed');
      assert.ok(data.invoice.sentAt);
    } finally { ready.database.close(); unpriced.database.close(); }
  });
});

describe('accepted pricing quote to exact Studio invoice', () => {
  it('keeps one fixed invoice and a private conversation reference through sharing and a receipt', async () => {
    const fx = editableFixture();
    try {
      const { onRequestPost: accept } = await import('../functions/api/pricing/quotes/[id]/accept.js');
      const { onRequest: pricingQuotes } = await import('../functions/api/pricing/quotes.js');
      const { onRequest: adminInvoice } = await import('../functions/api/admin/invoices/[id].js');
      const { onRequestGet: buyerInvoice } = await import('../functions/api/invoices/[token].js');
      const { onRequestPost: share } = await import('../functions/api/admin/invoices/[id]/send.js');
      const { onRequestPost: receipt } = await import('../functions/api/admin/invoices/[id]/mark-paid.js');
      const studioRequest = (path: string, method = 'GET', body?: object) => new Request(`https://adrianrasmussen.com${path}`, {
        method, headers: { Origin: 'https://adrianrasmussen.com', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const quoteResponse = await pricingQuotes({
        request: studioRequest('/api/pricing/quotes', 'POST', {
          name: 'Private quote title', configuration: '90 cm', artworkId: 'UL-102',
          inputs: { diameterIn: 35.433 }, quote: 100,
        }), env: fx.env,
      });
      assert.equal(quoteResponse.status, 201);
      const { quote } = await quoteResponse.json();
      const agreement = {
        clientName: 'Example collector', clientEmail: '', artworkTitle: 'Doorways',
        configuration: '90 cm · edition 2 of 8', amountCents: 12000, termMode: 'two_part',
        conversation: 'https://example.com/private-thread?reference=sensitive-test-string',
      };
      const acceptAgreement = (body: object) => accept({
        request: studioRequest(`/api/pricing/quotes/${quote.id}/accept`, 'POST', body), env: fx.env, params: {id: quote.id},
      });
      assert.equal((await acceptAgreement({ ...agreement, conversation: 'javascript:alert(1)' })).status, 400);
      const response = await acceptAgreement(agreement);
      assert.equal(response.status, 201);
      const { invoiceId } = await response.json();
      assert.equal((await (await acceptAgreement(agreement)).json()).invoiceId, invoiceId);
      assert.equal((await acceptAgreement({ ...agreement, amountCents: 13000 })).status, 409);
      const invoicePath = `/api/admin/invoices/${invoiceId}`;
      const params = { id: String(invoiceId) };
      const read = await adminInvoice({ request: studioRequest(invoicePath), env: fx.env, params });
      const { invoice } = await read.json();
      assert.equal(invoice.status, 'draft');
      assert.equal(invoice.amountPaidCents, 0);
      assert.equal(invoice.sourceQuote.conversationUrl, agreement.conversation);
      assert.equal(invoice.sourceQuote.referenceName, 'Private quote title');
      assert.equal(invoice.sourceQuote.artworkId, 'UL-102');
      assert.equal(invoice.lineItems[0].terms, agreement.configuration);
      assert.equal(invoice.totalCents, 12000);
      assert.equal(invoice.offerPaymentChoice, false);
      assert.equal(await (await buyerInvoice({ env: fx.env, params: {token: invoice.publicToken} })).status, 404);
      const listed = await pricingQuotes({ request: studioRequest('/api/pricing/quotes'), env: fx.env });
      assert.equal((await listed.json()).quotes[0].invoiceId, invoiceId);

      fx.database.exec(`INSERT INTO payment_presets (method, label, url)
        VALUES ('paypal', 'PayPal', 'https://www.paypal.com/paypalme/example')`);
      const update = (body: object) => adminInvoice({ request: studioRequest(invoicePath, 'PUT', body), env: fx.env, params });
      const schedule = invoice.paymentSchedule.map((step: {amountCents: number}) => ({ ...step, amountCents: 7000 }));
      assert.equal((await update({ paymentPresetIds: [1], totalCents: 13000 })).status, 409);
      assert.equal((await update({
        paymentPresetIds: [1], totalCents: 14000, dueTodayCents: 7000, paymentSchedule: schedule,
        lineItems: [...invoice.lineItems, { description: 'Shipping', terms: '', amountCents: 2000 }],
      })).status, 200);
      const shared = await share({ request: studioRequest(`${invoicePath}/send`, 'POST'), env: fx.env, params });
      assert.equal(shared.status, 200);
      const publicResponse = await buyerInvoice({ env: fx.env, params: { token: invoice.publicToken } });
      assert.equal(publicResponse.status, 200);
      const publicText = await publicResponse.text();
      assert.equal(/sourceQuote|sensitive-test-string|Private quote title|UL-102/.test(publicText), false);
      const { invoice: sharedInvoice } = JSON.parse(publicText);
      assert.equal(sharedInvoice.totalCents, 14000);
      assert.equal(sharedInvoice.paymentOptions[0].method, 'paypal');
      const recordPayment = (body: object) => receipt({
        request: studioRequest(`${invoicePath}/mark-paid`, 'POST', body), env: fx.env, params,
      });
      assert.equal((await recordPayment({ paidCents: 7000, totalCents: 13000, idempotencyKey: 'source-price-replace' })).status, 409);
      const recorded = await recordPayment({ paidCents: 7000, idempotencyKey: 'source-deposit-first' });
      assert.equal(recorded.status, 200);
      assert.equal((await recorded.json()).invoice.sourceQuote.amountCents, 12000);
      assert.equal((await update({ paymentPresetIds: [1], totalCents: 12000, lineItems: invoice.lineItems,
        paymentSchedule: invoice.paymentSchedule })).status, 409);
    } finally { fx.database.close(); }
  });
});

describe('public invoice access', () => {
  it('keeps draft and unshared paid invoices private, then exposes the priced shared invoice', async () => {
    const fx = editableFixture();
    try {
      const { onRequestGet } = await import('../functions/api/invoices/[token].js');
      fx.database.exec("UPDATE invoices SET public_token = 'fixture-invoice-token' WHERE id = 1");
      const read = () => onRequestGet({ env: fx.env, params: { token: 'fixture-invoice-token' } });
      assert.equal((await read()).status, 404);
      fx.database.exec("UPDATE invoices SET status = 'draft', sent_at = unixepoch() WHERE id = 1");
      assert.equal((await read()).status, 404);
      fx.database.exec("UPDATE invoices SET status = 'paid', sent_at = NULL WHERE id = 1");
      assert.equal((await read()).status, 404);
      fx.database.exec("UPDATE invoices SET status = 'sent', sent_at = unixepoch() WHERE id = 1");
      const response = await read();
      assert.equal(response.status, 200);
      assert.equal((await response.json()).invoice.totalCents, 10000);
      fx.database.exec("UPDATE invoices SET total_cents = 0 WHERE id = 1");
      assert.equal((await read()).status, 404);
    } finally { fx.database.close(); }
  });
});
