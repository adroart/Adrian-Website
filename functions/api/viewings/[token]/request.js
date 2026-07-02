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
import { rateLimit, clientIp } from '../../_lib/ratelimit.js';

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

  // Throttle: a viewing should be requested once. Cap repeat hits per token+IP
  // so a leaked token can't be used to flood the studio inbox / spawn drafts.
  const limit = rateLimit(`viewing-request:${token}:${clientIp(request)}`, { max: 5, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return jsonResponse({ ok: false, error: 'too_many_requests' }, 429);
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

  // Idempotency: if this viewing was already turned into a request/invoice,
  // return that result instead of creating a duplicate draft and re-emailing.
  if (row.invoice_token || row.status === 'requested') {
    return jsonResponse({
      ok: true,
      alreadyRequested: true,
      invoiceAdminPath: '/admin/invoices',
      invoiceToken: row.invoice_token || null,
    });
  }

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

  // Attach the studio's active payment presets so the generated invoice is a
  // real, payable invoice (Wise/Bank/etc.) — not an orphan. Mirrors what the
  // admin creator stores: snapshot list + preset ids + primary snapshot.
  const presetRows = await env.DB
    .prepare('SELECT * FROM payment_presets WHERE is_active = 1 ORDER BY is_default DESC, id ASC LIMIT 8')
    .all();
  const presets = (presetRows.results || []).map((p) => ({
    id: p.id,
    label: String(p.label || '').slice(0, 120),
    method: String(p.method || 'custom').slice(0, 40),
    currency: String(p.currency || 'USD').slice(0, 8).toUpperCase(),
    instructions: String(p.instructions || '').slice(0, 1200),
    details: String(p.details || '').slice(0, 2000),
    url: String(p.url || '').slice(0, 500),
  }));
  const presetIds = presets.map((p) => p.id);
  const primaryId = presetIds[0] ?? null;
  const snapshot = presets[0] || {};

  await env.DB.prepare(
    `INSERT INTO invoices
       (invoice_number, public_token, status, client_name, client_email, client_location,
        job_title, job_description, currency, line_items_json,
        payment_preset_id, payment_preset_ids_json, payment_snapshot_json, payment_options_json,
        offer_payment_choice)
     VALUES (?1, ?2, 'draft', ?3, ?4, '', ?5, ?6, 'USD', ?7, ?8, ?9, ?10, ?11, 1)`,
  )
    .bind(
      invoiceNumber,
      newInvoiceToken,
      row.recipient_name,
      row.client_email || '',
      'Requested artworks',
      jobDescription,
      JSON.stringify(lineItems),
      primaryId,
      JSON.stringify(presetIds),
      JSON.stringify(snapshot),
      JSON.stringify(presets),
    )
    .run();

  await env.DB.prepare(
    "UPDATE viewings SET status='requested', requested_at=unixepoch(), invoice_token=?2 WHERE id=?1",
  )
    .bind(row.id, newInvoiceToken)
    .run();

  // Notify Adrian by email (reuses the same Resend setup as the contact form).
  // Non-blocking: a mail failure must not fail the buyer's request.
  if (env.RESEND_API_KEY && !env.RESEND_API_KEY.startsWith('re_test_')) {
    const to = env.INQUIRY_TO_EMAIL || 'hello@adrianrasmussen.com';
    const from = env.RESEND_FROM_EMAIL || 'noreply@adrianrasmussen.com';
    const note = typeof body.message === 'string' ? body.message.slice(0, 1000) : '';
    const list = chosen.map((p) => `<li>${p.name} · Universal Language No. ${p.code}</li>`).join('');
    const html = `
      <h2>${row.recipient_name} requested ${chosen.length} piece${chosen.length === 1 ? '' : 's'}</h2>
      <p>From the private viewing for <strong>${row.recipient_name}</strong>.</p>
      <ul>${list}</ul>
      ${note ? `<p><strong>Their note:</strong><br>${note.replace(/</g, '&lt;')}</p>` : ''}
      <p>A draft invoice was created and is waiting for you to price and send:<br>
      <a href="https://adrianrasmussen.com/admin/invoices">Open the draft invoice</a></p>`;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Adrian Rasmussen Art <${from}>`,
          to: [to],
          subject: `${row.recipient_name} requested ${chosen.length} piece${chosen.length === 1 ? '' : 's'} from their viewing`,
          html,
        }),
      });
    } catch (e) {
      console.error('viewing request email failed:', e);
    }
  }

  return jsonResponse({
    ok: true,
    requested: chosen.length,
    invoiceAdminPath: '/admin/invoices',
    invoiceToken: newInvoiceToken,
  });
}
