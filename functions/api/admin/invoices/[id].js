import { jsonResponse, requireAdmin, requireDb } from '../../_lib/admin.js';
import {
  normalizeInvoiceInput,
  serializeStudioInvoiceRow,
  validateInvoice,
} from '../../_lib/invoices.js';
import { buildPaymentSchedule } from '../../../../components/invoices/invoiceUtils.ts';

export async function onRequest(context) {
  const { request, env, params } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);

  if (request.method === 'GET') return getInvoice(env, id);
  if (request.method === 'PUT') return updateInvoice(request, env, id);
  if (request.method === 'DELETE') return voidInvoice(env, id);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

async function getInvoice(env, id) {
  const row = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?1').bind(id).first();
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, invoice: serializeStudioInvoiceRow(row) });
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
  const storedPresetIds = existingPaymentPresetIds(existing);
  const paymentPresetIds = hasPaymentPresets
    ? normalizeRequestedPresetIds(body)
    : storedPresetIds;
  const changedPresets = JSON.stringify(paymentPresetIds) !== JSON.stringify(storedPresetIds);
  const paymentPresets = changedPresets && paymentPresetIds.length
    ? await getActivePaymentPresets(env, paymentPresetIds)
    : [];
  if (changedPresets && paymentPresets.length !== paymentPresetIds.length) {
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
    offerPaymentChoice: body.offerPaymentChoice ?? Boolean(existing.offer_payment_choice),
  };

  const invoice = normalizeInvoiceInput(merged, paymentPresets);
  if (!changedPresets) {
    invoice.paymentSnapshot = safeObject(existing.payment_snapshot_json);
    invoice.paymentOptions = safeArray(existing.payment_options_json);
    if (!invoice.paymentOptions.length && Object.keys(invoice.paymentSnapshot).length) {
      invoice.paymentOptions = [invoice.paymentSnapshot];
    }
  }
  const error = validateInvoice(invoice);
  if (error) return jsonResponse({ ok: false, error }, 400);
  if (existing.source_quote_id && !matchesAcceptedQuote(safeObject(existing.source_quote_json), invoice)) {
    return jsonResponse({ ok: false, error: 'accepted_quote_locked' }, 409);
  }

  const storedTerms = normalizeInvoiceInput(serializeStudioInvoiceRow(existing));
  const changesPaymentTerms = changedPresets
    || invoice.totalCents !== existing.total_cents
    || invoice.currency !== storedTerms.currency
    || invoice.offerPaymentChoice !== storedTerms.offerPaymentChoice
    || JSON.stringify(invoice.lineItems) !== JSON.stringify(storedTerms.lineItems)
    || JSON.stringify(invoice.paymentSchedule) !== JSON.stringify(storedTerms.paymentSchedule);
  // Evaluate receipt and state guards in the write itself. A receipt can land
  // after the editor's read and may lock the total to a different variant.
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
         currency = CASE WHEN amount_paid_cents > 0 THEN currency ELSE ?8 END,
         subtotal_cents = CASE WHEN amount_paid_cents > 0 THEN subtotal_cents ELSE ?9 END,
         shipping_text = ?10,
         total_cents = CASE WHEN amount_paid_cents > 0 THEN total_cents ELSE ?11 END,
         due_today_cents = CASE WHEN amount_paid_cents > 0
           THEN COALESCE(json_extract(payment_schedule_json, printf('$[%d].amountCents', ?13)), due_today_cents)
           ELSE ?12 END,
         current_step_index = ?13,
         payment_preset_id = CASE WHEN amount_paid_cents > 0 THEN payment_preset_id ELSE ?14 END,
         payment_preset_ids_json = CASE WHEN amount_paid_cents > 0 THEN payment_preset_ids_json ELSE ?15 END,
         payment_snapshot_json = CASE WHEN amount_paid_cents > 0 THEN payment_snapshot_json ELSE ?16 END,
         payment_options_json = CASE WHEN amount_paid_cents > 0 THEN payment_options_json ELSE ?17 END,
         line_items_json = CASE WHEN amount_paid_cents > 0 THEN line_items_json ELSE ?18 END,
         payment_schedule_json = CASE WHEN amount_paid_cents > 0 THEN payment_schedule_json ELSE ?19 END,
         notes = ?20,
         offer_payment_choice = CASE WHEN amount_paid_cents > 0 THEN offer_payment_choice ELSE ?21 END,
         updated_at = MAX(unixepoch(), updated_at + 1)
       WHERE id = ?22
         AND (status = ?2 OR (status = 'paid' AND amount_paid_cents = 0 AND ?2 = 'draft'))
         AND (?2 <> 'paid' OR (paid_at IS NOT NULL AND total_cents > 0 AND amount_paid_cents = total_cents))
         AND (amount_paid_cents = 0 OR (?23 = 0 AND currency = ?8 AND total_cents = ?11
           AND line_items_json = ?24 AND payment_schedule_json = ?25
           AND (amount_paid_cents <> total_cents OR ?2 = 'paid')))
         AND updated_at IS ?26
         AND status <> 'void'
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
      changesPaymentTerms ? 1 : 0,
      existing.line_items_json,
      existing.payment_schedule_json,
      existing.updated_at,
    )
    .first();

  if (!row) {
    const error = invoice.status === 'paid' && existing.status !== 'paid'
      ? 'payment_required'
      : 'invoice_changed_or_locked';
    return jsonResponse({ ok: false, error }, 409);
  }
  return jsonResponse({ ok: true, invoice: serializeStudioInvoiceRow(row) });
}

async function voidInvoice(env, id) {
  const row = await env.DB
    .prepare("UPDATE invoices SET status = 'void', updated_at = MAX(unixepoch(), updated_at + 1) WHERE id = ?1 AND amount_paid_cents = 0 RETURNING *")
    .bind(id)
    .first();
  if (!row) {
    const existing = await env.DB.prepare('SELECT id FROM invoices WHERE id = ?1').bind(id).first();
    return jsonResponse({ ok: false, error: existing ? 'invoice_changed_or_locked' : 'not_found' }, existing ? 409 : 404);
  }
  return jsonResponse({ ok: true, invoice: serializeStudioInvoiceRow(row) });
}

function normalizeRequestedPresetIds(body) {
  const ids = Array.isArray(body?.paymentPresetIds)
    ? body.paymentPresetIds
    : body?.paymentPresetId
      ? [body.paymentPresetId]
      : [];
  return [...new Set(ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0))].slice(0, 8);
}

function matchesAcceptedQuote(source, invoice) {
  const [artwork, shipping] = invoice.lineItems;
  if (!artwork || invoice.lineItems.length > 2 || artwork.variants?.length
      || artwork.description !== source.name || artwork.terms !== source.configuration || artwork.amountCents !== source.amountCents
      || (shipping && (shipping.description !== 'Shipping' || shipping.variants?.length))
      || invoice.jobTitle !== source.name || invoice.jobDescription !== source.configuration
      || invoice.currency !== source.currency || invoice.offerPaymentChoice
      || invoice.totalCents !== source.amountCents + (shipping?.amountCents || 0)) return false;
  const expected = buildPaymentSchedule(invoice.totalCents, source.termMode);
  return invoice.dueTodayCents === expected[invoice.currentStepIndex]?.amountCents
    && invoice.paymentSchedule.length === expected.length && expected.every((step, i) => (
    Object.keys(step).every(key => step[key] === invoice.paymentSchedule[i][key])
  ));
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
