/**
 * POST /api/orders/claim
 *
 * Body: { stripeSessionId: string }
 *
 * Attaches a previously-guest order to the signed-in user, but only when
 * the session's customer_details.email matches the user's email. Used by
 * the /order-confirmed "Save this order to your account" flow.
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);
  if (!env.STRIPE_SECRET_KEY) return jsonResponse({ error: 'stripe_not_configured' }, { status: 503 }, request, env);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env); }
  const sid = typeof body?.stripeSessionId === 'string' ? body.stripeSessionId : null;
  if (!sid || !sid.startsWith('cs_')) {
    return jsonResponse({ error: 'invalid_session_id' }, { status: 400 }, request, env);
  }

  // Verify with Stripe that this session belongs to the user's email.
  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!stripeRes.ok) {
    return jsonResponse({ error: 'stripe_session_not_found' }, { status: 404 }, request, env);
  }
  const session = await stripeRes.json();
  const sessionEmail = (session?.customer_details?.email || session?.customer_email || '').toLowerCase();
  if (!sessionEmail) {
    return jsonResponse({ error: 'session_has_no_email' }, { status: 400 }, request, env);
  }
  if (!auth.email || sessionEmail !== auth.email.toLowerCase()) {
    return jsonResponse({ error: 'email_mismatch' }, { status: 403 }, request, env);
  }

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) {
    return jsonResponse({ error: 'user_not_synced' }, { status: 409 }, request, env);
  }

  const res = await env.DB
    .prepare('UPDATE orders SET user_id = ?1 WHERE stripe_session_id = ?2 AND (user_id IS NULL OR user_id = ?1)')
    .bind(user.id, sid)
    .run();

  return jsonResponse({ ok: true, changes: res.meta?.changes ?? 0 }, { status: 200 }, request, env);
}
