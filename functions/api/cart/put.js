/**
 * PUT /api/cart/put
 *
 * Body: Array<{ productId: string; quantity: number; configurator?: any }>
 *
 * Replaces the user's cart with the supplied rows. Idempotent — the
 * client posts the full cart on every change.
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';

const MAX_ROWS = 64;
const MAX_QTY = 10;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  let rows;
  try {
    rows = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
  }
  if (!Array.isArray(rows)) {
    return jsonResponse({ error: 'expected_array' }, { status: 400 }, request, env);
  }
  if (rows.length > MAX_ROWS) rows = rows.slice(0, MAX_ROWS);

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) {
    return jsonResponse({ error: 'user_not_synced' }, { status: 409 }, request, env);
  }

  const stmts = [
    env.DB.prepare('DELETE FROM cart_items WHERE user_id = ?1').bind(user.id),
  ];
  for (const r of rows) {
    if (typeof r?.productId !== 'string' || !r.productId) continue;
    const qty = Math.max(1, Math.min(MAX_QTY, Math.round(Number(r.quantity) || 1)));
    const cfg = r.configurator ? JSON.stringify(r.configurator) : '';
    stmts.push(
      env.DB
        .prepare(
          `INSERT INTO cart_items (user_id, product_id, quantity, configurator_json, added_at)
           VALUES (?1, ?2, ?3, ?4, unixepoch())
           ON CONFLICT(user_id, product_id, configurator_json) DO UPDATE SET
             quantity = excluded.quantity,
             added_at = unixepoch()`,
        )
        .bind(user.id, r.productId, qty, cfg),
    );
  }
  await env.DB.batch(stmts);

  return jsonResponse({ ok: true, count: stmts.length - 1 }, { status: 200 }, request, env);
}
