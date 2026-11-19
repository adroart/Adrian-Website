import { jsonResponse, requireAdmin, requireDb } from '../../../_lib/admin.js';
import { buildPaymentSchedule } from '../../../../../components/invoices/invoiceUtils.ts';

const TERMS = new Set(['single', 'two_part', 'three_part']);
const INPUT_KEYS = new Set(['clientName', 'clientEmail', 'artworkTitle', 'configuration', 'amountCents', 'termMode', 'conversation']);

export async function onRequestPost({ request, env, params }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missing = requireDb(env);
  if (missing) return missing;
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== params.id) {
    return jsonResponse({ ok: false, error: 'invalid_id' }, 400);
  }
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !INPUT_KEYS.has(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }

  const quote = await env.DB.prepare('SELECT * FROM pricing_quotes WHERE id = ?1').bind(id).first();
  if (!quote) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  const clientName = cleanText(body.clientName, 160);
  const clientEmail = cleanText(body.clientEmail, 240);
  const configuration = cleanText(body.configuration, 360);
  const conversation = cleanText(body.conversation, 800);
  const conversationUrl = safeConversationUrl(conversation);
  const amountCents = body.amountCents;
  if (!clientName || !configuration || !Number.isSafeInteger(amountCents) || amountCents <= 0
      || amountCents > 100_000_000 || !TERMS.has(body.termMode)) {
    return jsonResponse({ ok: false, error: 'accepted_terms_required' }, 400);
  }
  if (conversationUrl === false) return jsonResponse({ ok: false, error: 'invalid_conversation_url' }, 400);

  const savedName = cleanText(body.artworkTitle, 180) || quote.name.slice(0, 180);
  const lineItems = [{ description: savedName, terms: configuration, amountCents }];
  const schedule = buildPaymentSchedule(amountCents, body.termMode);
  if (schedule.some(step => step.amountCents <= 0)) return jsonResponse({ ok: false, error: 'accepted_terms_required' }, 400);
  const snapshot = {
    id, name: savedName, referenceName: quote.name, artworkId: quote.artwork_id, configuration, amountCents, currency: 'USD',
    termMode: body.termMode, conversation: conversationUrl ? '' : conversation, conversationUrl: conversationUrl || '',
    acceptedAt: new Date().toISOString(),
  };

  const row = await env.DB.prepare(
    `INSERT INTO invoices
       (invoice_number, public_token, status, client_name, client_email, job_title, job_description,
        currency, subtotal_cents, total_cents, due_today_cents, shipping_text, line_items_json,
        payment_schedule_json, source_quote_id, source_quote_json)
     SELECT
       'AR-' || strftime('%Y','now') || '-' || printf('%03d', 1 + COALESCE((
         SELECT MAX(CAST(substr(invoice_number, 9) AS INTEGER)) FROM invoices
          WHERE invoice_number LIKE 'AR-' || strftime('%Y','now') || '-%'
       ), 0)),
       ?1, 'draft', ?2, ?3, ?4, ?5, 'USD', ?6, ?6, ?7,
       'To be confirmed', ?8, ?9, id, ?10
       FROM pricing_quotes WHERE id = ?11 AND name = ?12
     ON CONFLICT(source_quote_id) DO NOTHING
     RETURNING id`,
  ).bind(crypto.randomUUID().replace(/-/g, ''), clientName, clientEmail, savedName, configuration, amountCents,
    schedule[0].amountCents, JSON.stringify(lineItems), JSON.stringify(schedule), JSON.stringify(snapshot), id, quote.name).first();
  if (row) return jsonResponse({ ok: true, invoiceId: row.id }, 201);

  const existing = await env.DB.prepare(
    'SELECT id, source_quote_json, client_name, client_email FROM invoices WHERE source_quote_id = ?1',
  ).bind(id).first();
  if (existing) {
    // Retrying the same acceptance after a network failure opens the exact draft,
    // and a second acceptance with changed terms can't silently replace it.
    const source = JSON.parse(existing.source_quote_json);
    if (source.name === savedName && source.configuration === configuration && source.amountCents === amountCents
        && source.termMode === body.termMode && source.conversation === snapshot.conversation
        && source.conversationUrl === snapshot.conversationUrl
        && existing.client_name === clientName && existing.client_email === clientEmail) {
      return jsonResponse({ ok: true, invoiceId: existing.id });
    }
    return jsonResponse({ ok: false, error: 'quote_already_accepted', invoiceId: existing.id }, 409);
  }
  return jsonResponse({ ok: false, error: 'quote_changed' }, 409);
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// An ordinary reference can say “Email, 17 November”. Only an explicit HTTPS
// URL becomes an external link. Other URL schemes are rejected, never linked.
function safeConversationUrl(value) {
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value) && !/^(?:https?|javascript|data|file|mailto):/i.test(value)) return null;
  try {
    if (!/^https:\/\//i.test(value)) return false;
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return false;
    return url.href;
  } catch {
    return false;
  }
}
