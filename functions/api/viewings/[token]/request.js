/**
 * The Acquire seam — the client taps "Request these pieces" on a viewing.
 *
 *   POST /api/viewings/:token/request   body: { pieceIds: string[] }
 *
 * Marks the viewing 'requested' and creates a DRAFT invoice pre-filled with the
 * chosen pieces as line items (amount 0, for Adrian to price). Meaning ≠ money:
 * the viewing never carried a price; the invoice is where money enters. Returns
 * the new invoice's admin path so Adrian can open, price, and send it.
 *
 * Public (no admin gate) — the client triggers it — but it only reads the
 * viewing's own stored pieces and writes a zero-value draft, so there is no
 * pricing trust surface.
 */
import { jsonResponse } from '../../_lib/admin.js';

function invoiceToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function onRequestPost({ env, params, request }) {
  if (!env.DB) return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);

  const token = typeof params.token === 'string' ? params.token.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const requestedIds = Array.isArray(body.pieceIds) ? body.pieceIds.map(String) : [];

  const row = await env.DB.prepare('SELECT * FROM viewings WHERE public_token=?1').bind(token).first();
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  let data = {};
  try {
    data = JSON.parse(row.data_json);
  } catch {
    data = {};
  }
  const pieces = Array.isArray(data.pieces) ? data.pieces : [];
  const chosen = requestedIds.length
    ? pieces.filter((p) => requestedIds.includes(p.id))
    : pieces.filter((p) => p.recommended);

  // Build a draft invoice: each chosen piece a line item, priced at 0 for Adrian.
  const lineItems = chosen.map((p) => ({
    description: `${p.name} · Universal Language No. ${p.code}`,
    terms: '',
    amountCents: 0,
  }));

  const newInvoiceToken = invoiceToken();
  const invoiceNumber = `VIEW-${row.id}-${Date.now().toString(36).toUpperCase()}`;
  const jobDescription = `Pieces requested from a private viewing for ${row.recipient_name}.`;

  await env.DB.prepare(
    `INSERT INTO invoices
       (invoice_number, public_token, status, client_name, client_email, client_location,
        job_title, job_description, currency, line_items_json)
     VALUES (?1, ?2, 'draft', ?3, ?4, '', ?5, ?6, 'USD', ?7)`,
  )
    .bind(
      invoiceNumber,
      newInvoiceToken,
      row.recipient_name,
      row.client_email || '',
      'Requested artworks',
      jobDescription,
      JSON.stringify(lineItems),
    )
    .run();

  await env.DB.prepare(
    "UPDATE viewings SET status='requested', requested_at=unixepoch(), invoice_token=?2 WHERE id=?1",
  )
    .bind(row.id, newInvoiceToken)
    .run();

  return jsonResponse({
    ok: true,
    requested: chosen.length,
    invoiceAdminPath: '/admin/invoices',
    invoiceToken: newInvoiceToken,
  });
}
