/**
 * POST /api/auth/sync-user
 *
 * Called once per session after Better Auth reports a signed-in user. Idempotent:
 * upserts the D1 users bridge row (keyed by the external auth id, stored in the
 * legacy clerk_user_id column), creates (or finds) a Stripe Customer for that
 * email, and links them. Returns the persisted row. Customer endpoints also
 * lazily upsert this row via ensureUser, so a missed call here is non-fatal.
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { getUserByClerkId, upsertUser, setUserStripeCustomer, relinkOrdersByEmail } from '../_lib/db.js';
import { ensureStripeCustomer } from '../_lib/stripe.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) {
    return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);
  }

  const email = auth.email;
  if (!email) {
    return jsonResponse({ error: 'email_missing_from_jwt' }, { status: 400 }, request, env);
  }

  // Initial upsert (creates row if missing, refreshes email if changed).
  let user = await upsertUser(env.DB, {
    clerkUserId: auth.userId,
    email,
    stripeCustomerId: null,
  });

  // Re-link any guest orders that match this email but had no user_id.
  if (user?.id && auth.user?.emailVerified === true) {
    await relinkOrdersByEmail(env.DB, user.id, email);
  }

  // Ensure a Stripe customer is associated. Skip if Stripe isn't
  // configured yet — this endpoint should still succeed so the rest of
  // the account flow works.
  if (env.STRIPE_SECRET_KEY && user && !user.stripe_customer_id) {
    try {
      const stripeCustomerId = await ensureStripeCustomer(env, {
        email,
        clerkUserId: auth.userId,
      });
      await setUserStripeCustomer(env.DB, user.id, stripeCustomerId);
      user = await getUserByClerkId(env.DB, auth.userId);
    } catch (err) {
      // Don't fail the whole sync just because Stripe is unavailable;
      // the next sync will retry.
      console.warn('[sync-user] stripe customer ensure failed:', err);
    }
  }

  return jsonResponse({ user }, { status: 200 }, request, env);
}
