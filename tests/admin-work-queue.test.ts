import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readAdminWorkQueue } from '../functions/api/_lib/adminWorkQueue.js';

type Row = Record<string, unknown>;
const NOW = '2026-08-11T12:00:00.000Z';

const keepers = [
  ['kp-missing', 'UL-100'], ['kp-stale', 'UL-101'],
  ['kp-ready', 'UL-102'], ['kp-expired', 'UL-103'],
  ['kp-unresolved', 'UL-104'], ['kp-legacy', 'UL-105'],
].map(([id, piece_id]) => ({
  id, piece_id, edition_number: 0, keeper_user_id: null,
  registered_at: '2026-08-01T00:00:00.000Z', claimed_at: null, released_at: null,
  public_code: `AR-${id}`, plate_status: 'legacy', backup_status: 'missing',
  backup_reference: null, backup_sha256: null, ownership_code_key_version: 1,
  front_svg_sha256: null, back_svg_sha256: null,
  identity_backup_status: 'verified', identity_backup_reference: `identity/${id}.json`,
  identity_backup_sha256: 'a'.repeat(64), registration_status: 'registered',
  plate_generated_at: null, plate_activated_at: null,
}));

function rows(sql: string, bindings: unknown[]): Row[] {
  if (sql.includes('artwork_identity_recovery_qualifications')) {
    const qualifications = keepers.filter(({ id }) => id !== 'kp-missing').map(({ id }) => ({
      id: `iq-${id}`, keeper_piece_id: id, result: 'passed', copied_artifact: 1, schema_version: '1',
      build_version: id === 'kp-stale' ? 'old-build' : 'registry-recovery-build-v1',
      key_version: 1, verifier_version: 'copied-identity-v1',
      backup_reference: `identity/${id}.json`, backup_sha256: 'a'.repeat(64),
      qualified_at: '2026-08-10T00:00:00.000Z',
    }));
    if (sql.includes('ROW_NUMBER')) return qualifications;
    return qualifications.filter(({ keeper_piece_id }) => keeper_piece_id === String(bindings[0]));
  }
  if (sql.includes('registry_recovery_qualifications')) return [];
  if (sql.includes('artist_verified_sale_items')) return [{
    id: 'item-identified', sale_id: 'sale-identified',
    artwork_record_id: 'record-identified', created_at: '2026-08-10T00:00:00.000Z',
  }];
  if (sql.includes('artist_artwork_records')) return [{
    id: 'record-identified', artwork_id: 'UL-106', keeper_piece_id: null,
    identification_status: 'identified', created_at: '2026-08-02T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
  }];
  if (sql.includes('artist_verified_sales')) return [{
    id: 'sale-identified', buyer_email: 'collector@example.com',
    recorded_at: '2026-08-10T00:00:00.000Z', artwork_record_id: 'record-identified',
    artwork_id: 'UL-106', keeper_piece_id: null,
  }];
  if (sql.includes('keeper_pieces')) return keepers;
  if (sql.includes('invoices')) {
    const invoices = [
    { id: 1, invoice_number: 'INV-PAID', public_token: 'paid-token', status: 'paid', client_name: 'Mira', job_title: 'Original sculpture', total_cents: 10000, amount_paid_cents: 10000, updated_at: 1786406400, paid_at: 1786406400 },
    { id: 2, invoice_number: 'INV-OPEN', public_token: 'open-token', status: 'sent', client_name: 'Noah', job_title: 'Commission', total_cents: 20000, amount_paid_cents: 0, updated_at: 1786406400, paid_at: null },
    { id: 3, invoice_number: 'INV-PART', public_token: 'part-token', status: 'sent', client_name: 'Aya', job_title: 'Edition', total_cents: 30000, amount_paid_cents: 5000, updated_at: 1786406400, paid_at: null },
    { id: 4, invoice_number: 'INV-LATE', public_token: 'late-token', status: 'overdue', client_name: 'Leo', job_title: 'Sculpture', total_cents: 40000, amount_paid_cents: 0, updated_at: 1786406400, paid_at: null },
    { id: 5, invoice_number: 'INV-DRAFT', public_token: 'linked-draft-invoice-token', status: 'draft', client_name: 'Ilan', job_title: 'Requested work', total_cents: 50000, amount_paid_cents: 0, updated_at: 1786406400, paid_at: null },
    ];
    return sql.includes("status IN ('sent', 'paid', 'overdue')")
      ? invoices.filter((invoice) => ['sent', 'paid', 'overdue'].includes(invoice.status)
        || Number(invoice.amount_paid_cents) > 0)
      : invoices;
  }
  if (sql.includes('viewings')) return [
    { id: 11, public_token: 'draft-token', status: 'draft', recipient_name: 'Sofia', invoice_token: null, updated_at: 1786406400, requested_at: null },
    { id: 12, public_token: 'request-token', status: 'requested', recipient_name: 'Ilan', invoice_token: 'linked-draft-invoice-token', updated_at: 1786406400, requested_at: 1786406400 },
    { id: 13, public_token: 'duplicate-request-token', status: 'requested', recipient_name: 'Noah', invoice_token: 'open-token', updated_at: 1786406400, requested_at: 1786406400 },
    { id: 14, public_token: 'paid-request-token', status: 'requested', recipient_name: 'Mira', invoice_token: 'paid-token', updated_at: 1786406400, requested_at: 1786406400 },
    { id: 15, public_token: 'same-draft-request-token', status: 'requested', recipient_name: 'Ilan', invoice_token: 'linked-draft-invoice-token', updated_at: 1786406400, requested_at: 1786406400 },
  ];
  if (sql.includes('artwork_invitations')) return [
    { id: 'iv-ready', keeper_piece_id: 'kp-ready', created_at: '2026-08-10T00:00:00.000Z', expires_at: '2099-08-20T00:00:00.000Z', revoked_at: null, redeemed_at: null },
    { id: 'iv-expired', keeper_piece_id: 'kp-expired', created_at: '2025-08-01T00:00:00.000Z', expires_at: '2025-08-10T00:00:00.000Z', revoked_at: null, redeemed_at: null },
  ];
  if (sql.includes('artwork_acquisitions')) return [{
    id: 'acq-legacy', keeper_piece_id: 'kp-legacy', acquisition_type: 'sale',
    acquired_at: '2025-06-01', updated_at: '2026-08-01T00:00:00.000Z', piece_id: 'UL-105',
  }];
  if (sql.includes('artist_reconnection_cases')) return [{
    id: 'case-one', recipient_name: 'Private Collector', created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z', effective_status: 'open',
    last_touched_at: '2026-08-10T00:00:00.000Z',
  }];
  return [];
}

function database(fail = '', seen: string[] = []) {
  return { prepare(sql: string) {
    seen.push(sql);
    if (fail && sql.includes(fail)) throw new Error(`no such table: ${fail}`);
    let bindings: unknown[] = [];
    return {
      bind(...values: unknown[]) { bindings = values; return this; },
      async all() { return { results: rows(sql, bindings) }; },
      async first() { return rows(sql, bindings)[0] ?? null; },
    };
  } };
}

describe('admin work queue', () => {
  it('returns exact item-level actions for every supported actionable state', async () => {
    const seen: string[] = [];
    const result = await readAdminWorkQueue({ DB: database('', seen) }, { now: NOW });
    const states = (domain: string) => result.queue.items
      .filter((item) => item.domain === domain).map((item) => item.state).sort();

    assert.equal(result.queue.complete, true);
    assert.deepEqual(states('recovery'), ['missing', 'stale']);
    assert.deepEqual(states('sale_artwork'), ['ready_for_registration']);
    assert.deepEqual(states('invoice'), ['open', 'overdue', 'partial']);
    assert.deepEqual(states('viewing'), ['draft', 'requested_with_invoice']);
    assert.deepEqual(states('invitation'), ['expired', 'ready']);
    assert.deepEqual(states('legacy_sale'), []);
    for (const item of result.queue.items) {
      assert.deepEqual(Object.keys(item).sort(), ['actionLabel', 'domain', 'href', 'signal', 'state', 'title']);
      assert.ok(item.title && item.signal && item.actionLabel);
      assert.match(item.href, /^\//);
    }
    assert.equal(result.queue.items.length <= 50, true);
    assert.equal(result.recentArtworks.length <= 5, true);
    assert.equal(result.recentCollectors.length <= 5, true);
    assert.equal(result.queue.items.find((item) => item.domain === 'sale_artwork')?.href,
      '/admin/registrations?artworkId=UL-106&artistArtworkRecordId=record-identified');
    assert.equal(result.queue.items.some((item) => item.href.includes('invoiceId=1')), false);
    assert.doesNotMatch(JSON.stringify(result.queue), /sale verification|verify sale/i);
    assert.equal(result.queue.items.some((item) => item.href.includes('keeperPieceId=kp-unresolved')), false);
    assert.equal(seen.filter((sql) => sql.includes('artwork_acquisitions')).length, 0,
      'legacy acquisition alerts are deferred until an exact completion relation exists');
    assert.equal(seen.filter((sql) => sql.includes('artwork_identity_recovery_qualifications')).length, 1);
    assert.equal(seen.filter((sql) => sql.includes('registry_recovery_qualifications')).length, 1);
    assert.equal(result.queue.items.find((item) => item.state === 'open')?.href,
      '/admin/invoices?invoiceId=2');
    assert.equal(result.queue.items.find((item) => item.state === 'draft')?.href,
      '/admin/viewings?viewingId=11');
    assert.equal(result.queue.items.find((item) => item.state === 'requested_with_invoice')?.href,
      '/admin/invoices?invoiceId=5');
    assert.equal(result.queue.items.filter((item) => item.href === '/admin/invoices?invoiceId=2').length, 1,
      'one linked request and invoice must project as one canonical task');
    assert.deepEqual(result.recentCollectors, [{
      title: 'Collector reconnection', signal: 'open · 1 day ago',
      href: '/admin/collector-sales?reconnectionCaseId=case-one',
    }]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /collector@example\.com|paid-token|request-token|Private Collector|\bMira\b|\bNoah\b/,
    );
    assert.deepEqual(await readAdminWorkQueue({ DB: database() }, { now: NOW }), result);
  });

  it('fails closed instead of returning a clean queue when any source fails', async () => {
    await assert.rejects(
      readAdminWorkQueue({ DB: database('artwork_invitations') }, { now: NOW }),
      /work_queue_incomplete/,
    );
  });
});
