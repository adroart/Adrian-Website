/**
 * /api/pricing/quotes  (admin only)
 *   GET  — list saved calibration quotes, newest first.
 *   POST — save a priced piece.
 */

import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { serializeQuoteRow, normalizeQuoteInput, validateQuote } from '../_lib/pricing.js';

export async function onRequest(context) {
  const { request, env } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listQuotes(env);
  if (request.method === 'POST') return createQuote(request, env);
  return new Response('Method not allowed', { status: 405 });
}

async function listQuotes(env) {
  const { results } = await env.DB
    .prepare('SELECT * FROM pricing_quotes ORDER BY created_at DESC')
    .all();
  return jsonResponse({ ok: true, quotes: (results || []).map(serializeQuoteRow) });
}

async function createQuote(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const quote = normalizeQuoteInput(body);
  const error = validateQuote(quote);
  if (error) return jsonResponse({ ok: false, error }, 400);

  const row = await env.DB
    .prepare(
      `INSERT INTO pricing_quotes (name, inputs_json, suggested_retail, quote, actual_price)
       VALUES (?1, ?2, ?3, ?4, ?5)
       RETURNING *`,
    )
    .bind(
      quote.name,
      JSON.stringify(quote.inputs),
      quote.suggestedRetail,
      quote.quote,
      quote.actualPrice,
    )
    .first();

  return jsonResponse({ ok: true, quote: serializeQuoteRow(row) }, 201);
}
