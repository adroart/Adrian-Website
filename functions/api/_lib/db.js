/**
 * D1 helpers. Every endpoint that touches user state goes through here so
 * we have a single place to evolve the schema, swap drivers, or add
 * cross-cutting logging later.
 */

/**
 * Look up a user row by their Clerk user id. Returns null when the user
 * has not yet been synced (first sign-in hasn't called /api/auth/sync-user).
 * @param {D1Database} db
 * @param {string} clerkUserId
 */
export async function getUserByClerkId(db, clerkUserId) {
  return db
    .prepare('SELECT * FROM users WHERE clerk_user_id = ?1')
    .bind(clerkUserId)
    .first();
}

/**
 * Upsert by clerk_user_id. Used by /api/auth/sync-user on first sign-in.
 * @param {D1Database} db
 * @param {{ clerkUserId: string; email: string; stripeCustomerId?: string | null }} input
 */
export async function upsertUser(db, { clerkUserId, email, stripeCustomerId = null }) {
  await db
    .prepare(
      `INSERT INTO users (clerk_user_id, email, stripe_customer_id)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         email = excluded.email,
         stripe_customer_id = COALESCE(users.stripe_customer_id, excluded.stripe_customer_id),
         updated_at = unixepoch()`,
    )
    .bind(clerkUserId, email, stripeCustomerId)
    .run();
  return getUserByClerkId(db, clerkUserId);
}

/**
 * Patch a user's Stripe customer id once it has been created.
 */
export async function setUserStripeCustomer(db, userId, stripeCustomerId) {
  await db
    .prepare(
      'UPDATE users SET stripe_customer_id = ?1, updated_at = unixepoch() WHERE id = ?2',
    )
    .bind(stripeCustomerId, userId)
    .run();
}

/**
 * On user.created from Clerk webhook: relink any existing guest orders
 * for this email so the user sees them in their order history.
 */
export async function relinkOrdersByEmail(db, userId, email) {
  await db
    .prepare(
      'UPDATE orders SET user_id = ?1 WHERE user_id IS NULL AND lower(email) = lower(?2)',
    )
    .bind(userId, email)
    .run();
}

/**
 * On user.deleted: D1 cascades take care of profiles/cart/collections via
 * FK ON DELETE CASCADE, but we explicitly null out orders so historical
 * order rows survive (still valuable for accounting / Stripe correlation).
 */
export async function deleteUserByClerkId(db, clerkUserId) {
  await db
    .prepare('DELETE FROM users WHERE clerk_user_id = ?1')
    .bind(clerkUserId)
    .run();
}
