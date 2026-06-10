import { jsonResponse, requireAdmin, requireDb } from '../../_lib/admin.js';
import {
  normalizeInvoiceInput,
  serializeInvoiceRow,
  validateInvoice,
} from '../../_lib/invoices.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);

  if (request.method === 'GET') return getInvoice(env, id);
  if (request.method === 'PUT') return updateInvoice(request, env, id);
  if (request.method === 'DELETE') return voidInvoice(env, id);
  return new Response('Method not allowed', { status: 405 });
}

async function getInvoice(env, id) {
  const row = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?1').bind(id).first();
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) });
}

async function updateInvoice(request, env, id) {
  const existing = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?1').bind(id).first();
  if (!existing) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const hasPaymentPresets =
    Object.prototype.hasOwnProperty.call(body, 'paymentPresetIds') ||
    Object.prototype.hasOwnProperty.call(body, 'paymentPresetId');
  const paymentPresetIds = hasPaymentPresets
    ? normalizeRequestedPresetIds(body)
    : existingPaymentPresetIds(existing);
  const paymentPresets = hasPaymentPresets && paymentPresetIds.length
    ? await getActivePaymentPresets(env, paymentPresetIds)
    : [];
  if (hasPaymentPresets && paymentPresetIds.length && paymentPresets.length !== paymentPresetIds.length) {
    return jsonResponse({ ok: false, error: 'payment_preset_not_found' }, 400);
  }

  const merged = {
    invoiceNumber: body.invoiceNumber ?? existing.invoice_number,
    publicToken: existing.public_token,
    status: body.status ?? existing.status,
    clientName: body.clientName ?? existing.client_name,
    clientEmail: body.clientEmail ?? existing.client_email,
    clientLocation: body.clientLocation ?? existing.client_location,
    jobTitle: body.jobTitle ?? existing.job_title,
    jobDescription: body.jobDescription ?? existing.job_description,
    currency: body.currency ?? existing.currency,
    lineItems: body.lineItems ?? safeArray(existing.line_items_json),
    paymentSchedule: body.paymentSchedule ?? safeArray(existing.payment_schedule_json),
    currentStepIndex: body.currentStepIndex ?? existing.current_step_index,
    shippingText: body.shippingText ?? existing.shipping_text,
    totalCents: body.totalCents ?? existing.total_cents,
    dueTodayCents: body.dueTodayCents ?? existing.due_today_cents,
    paymentPresetId: paymentPresetIds[0] ?? null,
    paymentPresetIds,
    notes: body.notes ?? existing.notes,
  };

  const invoice = normalizeInvoiceInput(merged, paymentPresets);
  if (!hasPaymentPresets) {
    invoice.paymentSnapshot = safeObject(existing.payment_snapshot_json);
    invoice.paymentOptions = safeArray(existing.payment_options_json);
    if (!invoice.paymentOptions.length && Object.keys(invoice.paymentSnapshot).length) {
      invoice.paymentOptions = [invoice.paymentSnapshot];
    }
  }
  const error = validateInvoice(invoice);
  if (error) return jsonResponse({ ok: false, error }, 400);

  const row = await env.DB
    .prepare(
      `UPDATE invoices SET
         invoice_number = ?1,
         status = ?2,
         client_name = ?3,
         client_email = ?4,
         client_location = ?5,
         job_title = ?6,
         job_description = ?7,
         currency = ?8,
         subtotal_cents = ?9,
         shipping_text = ?10,
         total_cents = ?11,
         due_today_cents = ?12,
         current_step_index = ?13,
         payment_preset_id = ?14,
         payment_preset_ids_json = ?15,
         payment_snapshot_json = ?16,
         payment_options_json = ?17,
         line_items_json = ?18,
         payment_schedule_json = ?19,
         notes = ?20,
         offer_payment_choice = ?21,
         updated_at = unixepoch(),
         sent_at = CASE WHEN ?2 = 'sent' AND sent_at IS NULL THEN unixepoch() ELSE sent_at END,
         paid_at = CASE WHEN ?2 = 'paid' AND paid_at IS NULL THEN unixepoch() ELSE paid_at END
       WHERE id = ?22
       RETURNING *`,
    )
    .bind(
      invoice.invoiceNumber,
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
      id,
    )
    .first();

  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) });
}

async function voidInvoice(env, id) {
  const row = await env.DB
    .prepare("UPDATE invoices SET status = 'void', updated_at = unixepoch() WHERE id = ?1 RETURNING *")
    .bind(id)
    .first();
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) });
}

function normalizeRequestedPresetIds(body) {
  const ids = Array.isArray(body?.paymentPresetIds)
    ? body.paymentPresetIds
    : body?.paymentPresetId
      ? [body.paymentPresetId]
      : [];
  return [...new Set(ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))].slice(0, 8);
}

function existingPaymentPresetIds(row) {
  const ids = safeArray(row.payment_preset_ids_json)
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0);
  if (ids.length) return ids;
  return row.payment_preset_id ? [row.payment_preset_id] : [];
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

function safeArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
