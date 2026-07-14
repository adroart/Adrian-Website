import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import {
  generateInvoiceNumber,
  normalizeInvoiceInput,
  serializeInvoiceRow,
  validateInvoice,
} from '../_lib/invoices.js';

export async function onRequest(context) {
  const { request, env } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listInvoices(request, env);
  if (request.method === 'POST') return createInvoice(request, env);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

async function listInvoices(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);

  let query = 'SELECT * FROM invoices';
  const bindings = [];
  if (status) {
    query += ' WHERE status = ?1';
    bindings.push(status);
  }
  // limit/offset are integer-coerced above, safe to inline.
  query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const stmt = env.DB.prepare(query);
  const { results } = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
  return jsonResponse({ ok: true, invoices: (results || []).map(serializeInvoiceRow) });
}

async function createInvoice(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const invoiceNumber = body?.invoiceNumber || await nextInvoiceNumber(env);
  const requestedPresetIds = normalizeRequestedPresetIds(body);
  const paymentPresets = requestedPresetIds.length ? await getActivePaymentPresets(env, requestedPresetIds) : [];
  if (requestedPresetIds.length && paymentPresets.length !== requestedPresetIds.length) {
    return jsonResponse({ ok: false, error: 'payment_preset_not_found' }, 400);
  }

  const invoice = normalizeInvoiceInput({ ...body, invoiceNumber }, paymentPresets);
  const error = validateInvoice(invoice);
  if (error) return jsonResponse({ ok: false, error }, 400);

  const row = await env.DB
    .prepare(
      `INSERT INTO invoices
        (
          invoice_number, public_token, status, client_name, client_email, client_location,
          job_title, job_description, currency, subtotal_cents, shipping_text, total_cents,
          due_today_cents, current_step_index, payment_preset_id, payment_preset_ids_json,
          payment_snapshot_json, payment_options_json, line_items_json, payment_schedule_json,
          notes, offer_payment_choice, sent_at, paid_at
        )
       VALUES
        (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22,
         CASE WHEN ?3 = 'sent' THEN unixepoch() ELSE NULL END,
         CASE WHEN ?3 = 'paid' THEN unixepoch() ELSE NULL END)
       RETURNING *`,
    )
    .bind(
      invoice.invoiceNumber,
      invoice.publicToken,
      invoice.status,
      invoice.clientName,
      invoice.clientEmail,
      invoice.clientLocation,
      invoice.jobTitle,
      invoice.jobDescription,
      invoice.currency,
      invoice.subtotalCents,
      invoice.shippingText,
      invoice.totalCents,
      invoice.dueTodayCents,
      invoice.currentStepIndex,
      invoice.paymentPresetId,
      JSON.stringify(invoice.paymentPresetIds),
      JSON.stringify(invoice.paymentSnapshot),
      JSON.stringify(invoice.paymentOptions),
      JSON.stringify(invoice.lineItems),
      JSON.stringify(invoice.paymentSchedule),
      invoice.notes,
      invoice.offerPaymentChoice ? 1 : 0,
    )
    .first();

  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) }, 201);
}

async function nextInvoiceNumber(env) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const row = await env.DB
    .prepare(
      `SELECT invoice_number FROM invoices
       WHERE invoice_number LIKE ?1
       ORDER BY invoice_number DESC
       LIMIT 1`,
    )
    .bind(`AR-${year}-%`)
    .first();
  return generateInvoiceNumber(row?.invoice_number, now);
}

function normalizeRequestedPresetIds(body) {
  const ids = Array.isArray(body?.paymentPresetIds)
    ? body.paymentPresetIds
    : body?.paymentPresetId
      ? [body.paymentPresetId]
      : [];
  return [...new Set(ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))].slice(0, 8);
}

async function getActivePaymentPresets(env, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map((_, index) => `?${index + 1}`).join(', ');
  const { results } = await env.DB
    .prepare(`SELECT * FROM payment_presets WHERE is_active = 1 AND id IN (${placeholders})`)
    .bind(...ids)
    .all();
  const byId = new Map((results || []).map(row => [row.id, row]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}
