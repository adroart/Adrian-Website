/**
 * GET /api/orders/list
 *
 * Returns the signed-in user's orders + line items in reverse-chronological
 * order. Shape:
 *   [{
 *     id, stripeSessionId, status, amountTotal, currency, createdAt,
 *     items: [{ productId, description, quantity, amountSubtotal }]
 *   }]
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { ensureUser } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse([], { status: 200 }, request, env);

  const user = await ensureUser(env.DB, { userId: auth.userId, email: auth.email });
  if (!user) return jsonResponse([], { status: 200 }, request, env);

  const { results: ordersRows } = await env.DB
    .prepare(
      `SELECT id, stripe_session_id, stripe_payment_intent_id, status,
              amount_total, currency, created_at
         FROM orders
        WHERE user_id = ?1
        ORDER BY created_at DESC
        LIMIT 100`,
    )
    .bind(user.id)
    .all();
  const orders = ordersRows ?? [];
  if (orders.length === 0) return jsonResponse([], { status: 200 }, request, env);

  const orderIds = orders.map((o) => o.id);
  // D1 doesn't support array bind for IN; build a placeholder list.
  const placeholders = orderIds.map((_, i) => `?${i + 1}`).join(',');
  const { results: itemRows } = await env.DB
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
    .bind(...orderIds)
    .all();

  const itemsByOrder = new Map();
  for (const i of itemRows ?? []) {
    const arr = itemsByOrder.get(i.order_id) ?? [];
    arr.push({
      productId: i.product_id,
      description: i.description ?? '',
      quantity: i.quantity,
      amountSubtotal: i.amount_subtotal,
    });
    itemsByOrder.set(i.order_id, arr);
  }

  const out = orders.map((o) => ({
    id: o.id,
    stripeSessionId: o.stripe_session_id,
    stripePaymentIntentId: o.stripe_payment_intent_id ?? null,
    status: o.status,
    amountTotal: o.amount_total,
    currency: (o.currency || '').toUpperCase(),
    createdAt: new Date(o.created_at * 1000).toISOString(),
    items: itemsByOrder.get(o.id) ?? [],
  }));
  return jsonResponse(out, { status: 200 }, request, env);
}
