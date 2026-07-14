/**
 * /api/pricing/quotes/:id  (admin only)
 *   PATCH  — update a saved quote (typically the actual price, for calibration).
 *   DELETE — remove a saved quote.
 */

import { jsonResponse, requireAdmin, requireDb } from '../../_lib/admin.js';
import { serializeQuoteRow } from '../../_lib/pricing.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonResponse({ ok: false, error: 'invalid_id' }, 400);
  }

  if (request.method === 'PATCH') return patchQuote(request, env, id);
  if (request.method === 'DELETE') return deleteQuote(env, id);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

async function patchQuote(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const sets = [];
  const binds = [];
  if (typeof body.name === 'string') {
    sets.push(`name = ?${binds.length + 1}`);
    binds.push(body.name.trim().slice(0, 200));
  }
  if ('actualPrice' in body) {
    const n = body.actualPrice == null ? null : Number(body.actualPrice);
    sets.push(`actual_price = ?${binds.length + 1}`);
    binds.push(n != null && Number.isFinite(n) && n >= 0 ? n : null);
  }
  if (sets.length === 0) return jsonResponse({ ok: false, error: 'nothing_to_update' }, 400);

  sets.push('updated_at = unixepoch()');
  binds.push(id);

  const row = await env.DB
    .prepare(`UPDATE pricing_quotes SET ${sets.join(', ')} WHERE id = ?${binds.length} RETURNING *`)
    .bind(...binds)
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, quote: serializeQuoteRow(row) });
}

async function deleteQuote(env, id) {
  await env.DB.prepare('DELETE FROM pricing_quotes WHERE id = ?1').bind(id).run();
  return jsonResponse({ ok: true });
}
