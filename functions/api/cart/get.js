/**
 * GET /api/cart/get
 *
 * Returns the signed-in user's persisted cart rows. The shape matches
 * the serializeCart() format on the client: [{ productId, quantity }].
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse([], { status: 200 }, request, env);

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) return jsonResponse([], { status: 200 }, request, env);

  const { results } = await env.DB
    .prepare('SELECT product_id, quantity, configurator_json FROM cart_items WHERE user_id = ?1 ORDER BY added_at')
    .bind(user.id)
    .all();

  const rows = (results ?? []).map((r) => ({
    productId: r.product_id,
    quantity: r.quantity,
    configurator: r.configurator_json ? safeParse(r.configurator_json) : undefined,
  }));
  return jsonResponse(rows, { status: 200 }, request, env);
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}
