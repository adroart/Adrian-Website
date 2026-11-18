import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { it } from 'node:test';

import { loadPaidInvoiceReview, reviewPaidInvoice } from '../functions/api/_lib/paidInvoiceSale.js';

const administrator = { userId: 'artist-fixture', email: 'artist@example.test' };
const now = '2026-11-17T08:00:00.000Z';
const sale = { singleArtwork: true, artworkId: 'UL-102', edition: { kind: 'unique' }, saleDate: '2026-11-17', artworkPriceCents: 300000 };

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, dir), 'utf8'));
  }
  db.exec(`INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt)
    VALUES ('artist-fixture','Studio','artist@example.test',1,1,1);
    INSERT INTO invoices (id, invoice_number, public_token, status, client_name, client_email,
      job_title, job_description, line_items_json, total_cents, amount_paid_cents, paid_at)
    VALUES (1,'AR-2026-001','invoice-test-token','paid','Collector','buyer@example.test',
      'Doorways Of The Unknown','90 cm','[{"description":"Artwork","amountCents":300000},{"description":"Shipping","amountCents":15000}]',315000,315000,1794902400),
      (2,'AR-2026-002','unpaid-test-token','paid','Collector','buyer@example.test',
      'Another piece','58 cm','[]',10000,1000,NULL);
    INSERT INTO keeper_pieces (id,piece_id,edition_number,recovery_code_hash,plate_status,
      registration_status, public_code, issuance_key, registered_at, ownership_code_ciphertext,
      ownership_code_nonce, ownership_code_key_version, identity_backup_status, identity_backup_reference,
      identity_backup_sha256, identity_backup_at)
    VALUES ('fixture-keeper','UL-102',0,'fixture-recovery','legacy', 'registered', 'AR-7KQ9M2WX',
      'fixture-issue', '${now}', 'ciphertext', 'nonce', 1, 'verified',
      'identities/AR-7KQ9M2WX/${'a'.repeat(64)}.json', '${'a'.repeat(64)}', '${now}');`);
  const prepare = (sql: string) => {
    let args: SQLInputValue[] = [];
    const statement = {
      bind(...values: SQLInputValue[]) { args = values; return statement; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      runSync() { return { success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; },
    };
    return statement;
  };
  const env = { DB: { prepare, async batch(stmts: Array<ReturnType<typeof prepare>>) {
    db.exec('BEGIN');
    try { const results = stmts.map(stmt => stmt.runSync()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } } };
  return { db, env };
}

it('connects a settled invoice to exactly one confirmed artwork sale and keeps shipping out of the artwork price', async () => {
  const { db, env } = fixture();
  try {
    const review = await loadPaidInvoiceReview(env, 1);
    assert.equal(review.invoice.totalCents, 315000);
    assert.equal(review.invoice.lineItems[1].description, 'Shipping');
    assert.equal(review.linkedSale, null);
    assert.equal('publicToken' in review.invoice, false);
    const payload = { ...sale, revision: review.invoice.revision };
    const [created, retry] = await Promise.all([
      reviewPaidInvoice(env, 1, payload, administrator, now),
      reviewPaidInvoice(env, 1, payload, administrator, now),
    ]);
    assert.equal(retry.saleId, created.saleId);
    assert.equal(retry.artworkRecordId, created.artworkRecordId);
    assert.equal(created.keeperPieceId, 'fixture-keeper');
    assert.equal((await loadPaidInvoiceReview(env, 1)).linkedSale.saleId, created.saleId);
    const row = db.prepare('SELECT buyer_email, total_minor, private_reference FROM artist_verified_sales').get();
    assert.deepEqual({ ...row }, { buyer_email: 'buyer@example.test', total_minor: 315000, private_reference: 'AR-2026-001' });
    assert.equal(db.prepare('SELECT amount_minor FROM artist_verified_sale_items').get()?.amount_minor, 300000);
    assert.equal(db.prepare('SELECT keeper_user_id FROM keeper_pieces').get()?.keeper_user_id, null);
    assert.equal(db.prepare('SELECT count(*) AS count FROM artist_verified_sales').get()?.count, 1);
  } finally { db.close(); }
});

it('rejects unpaid or stale invoices and conflicting confirmations', async () => {
  const { db, env } = fixture();
  try {
    await assert.rejects(loadPaidInvoiceReview(env, 2), { code: 'invoice_not_paid' });
    const before = await loadPaidInvoiceReview(env, 1);
    db.exec("UPDATE invoices SET job_title='Edited after review' WHERE id=1");
    await assert.rejects(reviewPaidInvoice(env, 1, { ...sale, revision: before.invoice.revision }, administrator, now), { code: 'invoice_changed' });
    const review = await loadPaidInvoiceReview(env, 1);
    const payload = { ...sale, revision: review.invoice.revision };
    await reviewPaidInvoice(env, 1, payload, administrator, now);
    await assert.rejects(reviewPaidInvoice(env, 1, { ...payload, artworkId: 'UL-100' }, administrator, now), { code: 'invoice_sale_conflict' });
    assert.equal(db.prepare('SELECT count(*) AS count FROM artist_verified_sales').get()?.count, 1);
  } finally { db.close(); }
});

it('reuses an already identified record and connects its matching physical identity', async () => {
  const { db, env } = fixture();
  try {
    db.prepare(`INSERT INTO artist_artwork_records
      (id, artwork_id, edition_json, identification_status, created_by_user_id, created_at, updated_at)
      VALUES ('prior-record','UL-102',?,'identified',?,?,?)`)
      .run(JSON.stringify({ kind: 'unique', number: null, size: null }), administrator.userId, now, now);
    const { invoice } = await loadPaidInvoiceReview(env, 1);
    const result = await reviewPaidInvoice(env, 1, { ...sale, revision: invoice.revision }, administrator, now);
    assert.equal(result.artworkRecordId, 'prior-record');
    assert.equal(result.keeperPieceId, 'fixture-keeper');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM artist_artwork_records').get()?.n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM artist_artwork_record_events').get()?.n, 1);
    db.exec("UPDATE invoices SET status='void' WHERE id=1");
    assert.equal((await loadPaidInvoiceReview(env, 1)).invoiceChangedSinceLink, true);
  } finally { db.close(); }
});

it('keeps an unregistered edition ready for registration and refuses an incomplete multi-artwork review', async () => {
  const { db, env } = fixture();
  try {
    const { invoice } = await loadPaidInvoiceReview(env, 1);
    const payload = { ...sale, revision: invoice.revision, edition: { kind: 'numbered', number: 3 } };
    await assert.rejects(reviewPaidInvoice(env, 1, { ...payload, singleArtwork: false }, administrator, now), { code: 'invalid_request' });
    const result = await reviewPaidInvoice(env, 1, payload, administrator, now);
    assert.equal(result.keeperPieceId, null);
    const record = db.prepare('SELECT edition_json, identification_status FROM artist_artwork_records').get();
    assert.equal(record?.identification_status, 'identified');
    assert.deepEqual(JSON.parse(String(record?.edition_json)), { kind: 'numbered', number: 3, size: null });
  } finally { db.close(); }
});

it('rolls back the sale if the paid invoice changes before its link commits', async () => {
  const { db, env } = fixture();
  try {
    const { invoice } = await loadPaidInvoiceReview(env, 1);
    const batch = env.DB.batch;
    env.DB.batch = async statements => {
      db.exec("UPDATE invoices SET status='void' WHERE id=1");
      return batch(statements);
    };
    await assert.rejects(reviewPaidInvoice(env, 1, { ...sale, revision: invoice.revision }, administrator, now), { code: 'invoice_changed' });
    assert.equal(db.prepare('SELECT count(*) AS n FROM artist_verified_sales').get()?.n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM artist_artwork_records').get()?.n, 0);
  } finally { db.close(); }
});
