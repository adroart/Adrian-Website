/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events with HMAC verification (no SDK). Listens
 * for checkout success and payment reversal events, persisting orders + line
 * items into D1 without allowing late success delivery to erase a terminal
 * reversal state. Idempotent on stripe_session_id UNIQUE.
 *
 * Configure in the Stripe dashboard:
 *   - Endpoint: https://<site>/api/stripe/webhook
 *   - Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *     checkout.session.async_payment_failed, charge.refunded,
 *     payment_intent.canceled, payment_intent.payment_failed,
 *     charge.dispute.created
 *   - Set STRIPE_WEBHOOK_SECRET (Functions env)
 */

import { verifyStripeWebhook } from '../_lib/stripe.js';
import { notifyMandalacodes } from '../_lib/atlasSale.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('webhook_not_configured', { status: 503 });
  if (!env.DB) return new Response('db_not_configured', { status: 503 });

  const verified = await verifyStripeWebhook(request, env);
  if (!verified) return new Response('invalid_signature', { status: 400 });

  const { event } = verified;
  try {
    if (await applyOrderStatusEvent(env, event)) {
      return new Response('ok', { status: 200 });
    }
  } catch {
    return new Response('order_status_update_failed', { status: 503 });
  }
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return new Response('ok', { status: 200 });
  }

  const s = event.data?.object;
  if (!s?.id || !s.id.startsWith('cs_')) return new Response('ok', { status: 200 });

  const sessionId = s.id;
  const piId = s.payment_intent ?? null;
  const email = (s.customer_details?.email || s.customer_email || '').toLowerCase();
  const status = s.payment_status === 'paid' ? 'paid' : (s.payment_status || 'pending');
  const amountTotal = s.amount_total ?? 0;
  const currency = (s.currency || 'usd').toLowerCase();

  // Look up the user by stripe_customer_id first, then fall back to email
  // matching. user_id stays null for guest checkouts; later /api/orders/claim
  // or the Clerk user.created webhook will attach them.
  let userId = null;
  if (s.customer) {
    const u = await env.DB
      .prepare('SELECT id FROM users WHERE stripe_customer_id = ?1')
      .bind(s.customer)
      .first();
    if (u) userId = u.id;
  }
  if (!userId && email) {
    const u = await env.DB
      .prepare('SELECT id FROM users WHERE lower(email) = ?1')
      .bind(email)
      .first();
    if (u) userId = u.id;
  }

  // Insert the order; ON CONFLICT idempotently no-ops when this webhook
  // fires twice for the same session.
  const orderInsert = await upsertCheckoutOrder(env, {
    userId, sessionId, piId, email, status, amountTotal, currency,
  });

  // Fetch line items separately because the webhook payload doesn't
  // include them.
  if (env.STRIPE_SECRET_KEY) {
    try {
      const liRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=100&expand[]=data.price.product`,
        { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
      );
      if (liRes.ok) {
        const lineItems = await liRes.json();
        const orderRow = await env.DB
          .prepare('SELECT id FROM orders WHERE stripe_session_id = ?1')
          .bind(sessionId)
          .first();
        const orderId = orderRow?.id;
        if (orderId) {
          // Replace any existing items so retries stay consistent.
          await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?1').bind(orderId).run();
          const stmts = [];
          for (const li of lineItems.data ?? []) {
            const productId =
              (typeof li.price?.product === 'object' ? li.price.product?.metadata?.product_id : null) ||
              (typeof li.price?.product === 'string' ? li.price.product : null) ||
              li.price?.id ||
              'unknown';
            stmts.push(
              env.DB
                .prepare(
                  `INSERT INTO order_items (order_id, product_id, description, quantity, amount_subtotal)
                   VALUES (?1, ?2, ?3, ?4, ?5)`,
                )
                .bind(
                  orderId,
                  String(productId),
                  li.description || '',
                  li.quantity || 1,
                  li.amount_subtotal ?? 0,
                ),
            );
          }
          if (stmts.length) await env.DB.batch(stmts);
        }
      }
    } catch (err) {
      console.warn('[stripe/webhook] line items fetch failed:', err);
    }
  }

  // Notify the mandalacodes living-legacy atlas of the sale (M4 sale bridge).
  // Best-effort and out-of-band: it enqueues a PENDING row for Adrian to
  // confirm in /admin/atlas, never touches the ledger, and must never block
  // or fail this order write. waitUntil lets its retries finish after we've
  // already 200'd Stripe. No-ops quietly until SALE_WEBHOOK_SECRET is set.
  if (status === 'paid') {
    context.waitUntil(
      notifyMandalacodes(env, {
        saleId: sessionId,
        buyerEmail: email,
        buyerName: s.customer_details?.name || undefined,
        saleDate: new Date((s.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        priceCents: amountTotal,
        currency: currency.toUpperCase(),
        // sku/pieceId/editionNumber left unset: Adrian picks the piece in the
        // admin queue (the webhook's word never decides which piece moves).
      }).catch((err) => console.warn('[stripe/webhook] atlas notify failed:', err)),
    );
  }

  return new Response('ok', { status: 200 });
}

export async function upsertCheckoutOrder(env, {
  userId, sessionId, piId, email, status, amountTotal, currency,
}) {
  return env.DB
    .prepare(
      `INSERT INTO orders (user_id, stripe_session_id, stripe_payment_intent_id, email, status, amount_total, currency)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(stripe_session_id) DO UPDATE SET
         status = CASE
           WHEN orders.status IN ('refunded', 'disputed', 'canceled', 'failed') THEN orders.status
           ELSE excluded.status
         END,
         stripe_payment_intent_id = COALESCE(orders.stripe_payment_intent_id, excluded.stripe_payment_intent_id),
         user_id = COALESCE(orders.user_id, excluded.user_id)`,
    )
    .bind(userId, sessionId, piId, email, status, amountTotal, currency)
    .run();
}

export async function applyOrderStatusEvent(env, event) {
  const object = event?.data?.object || {};
  let status = null;
  let column = null;
  let reference = null;
  if (event?.type === 'checkout.session.async_payment_failed') {
    status = 'failed'; column = 'stripe_session_id'; reference = object.id;
  } else if (event?.type === 'charge.refunded') {
    status = 'refunded'; column = 'stripe_payment_intent_id';
    reference = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
  } else if (event?.type === 'payment_intent.canceled') {
    status = 'canceled'; column = 'stripe_payment_intent_id'; reference = object.id;
  } else if (event?.type === 'payment_intent.payment_failed') {
    status = 'failed'; column = 'stripe_payment_intent_id'; reference = object.id;
  } else if (event?.type === 'charge.dispute.created') {
    status = 'disputed'; column = 'stripe_payment_intent_id';
    reference = typeof object.charge === 'object'
      ? (typeof object.charge.payment_intent === 'string' ? object.charge.payment_intent : object.charge.payment_intent?.id)
      : null;
    if (!reference && typeof object.charge === 'string' && env.STRIPE_SECRET_KEY) {
      const response = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(object.charge)}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      });
      if (response.ok) {
        const charge = await response.json();
        reference = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      }
    }
  }
  if (!status) return false;
  if (!reference || (column !== 'stripe_session_id' && column !== 'stripe_payment_intent_id')) {
    throw new Error('order status reference unresolved');
  }
  const result = await env.DB.prepare(`UPDATE orders SET status = ?1 WHERE ${column} = ?2`)
      .bind(status, reference).run();
  if (!result?.success || (result.meta?.changes ?? 0) === 0) {
    throw new Error('order status target unresolved');
  }
  return true;
}
