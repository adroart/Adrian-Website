/**
 * D1 helpers. Every endpoint that touches user state goes through here so
 * we have a single place to evolve the schema, swap drivers, or add
 * cross-cutting logging later.
 */

/**
 * Look up a bridge user row by its current authentication id.
 * @param {D1Database} db
 * @param {string} authUserId
 */
export async function getUserByAuthId(db, authUserId) {
  return db
    .prepare('SELECT * FROM users WHERE auth_user_id = ?1')
    .bind(authUserId)
    .first();
}

/**
 * Upsert by auth_user_id. Both columns are written during the shared-D1
 * rollout so an older deployment on either site remains compatible.
 * @param {D1Database} db
 * @param {{ authUserId: string; email: string; stripeCustomerId?: string | null }} input
 */
export async function upsertUser(db, { authUserId, email, stripeCustomerId = null }) {
  await db
    .prepare(
      `INSERT INTO users (auth_user_id, clerk_user_id, email, stripe_customer_id)
       VALUES (?1, ?1, ?2, ?3)
       ON CONFLICT(auth_user_id) DO UPDATE SET
         clerk_user_id = excluded.auth_user_id,
         email = excluded.email,
         stripe_customer_id = COALESCE(users.stripe_customer_id, excluded.stripe_customer_id),
         updated_at = unixepoch()`,
    )
    .bind(authUserId, email, stripeCustomerId)
    .run();
  return getUserByAuthId(db, authUserId);
}

/** Patch a user's Stripe customer id once it has been created. */
export async function setUserStripeCustomer(db, userId, stripeCustomerId) {
  await db
    .prepare('UPDATE users SET stripe_customer_id = ?1, updated_at = unixepoch() WHERE id = ?2')
    .bind(stripeCustomerId, userId)
    .run();
}

/** Relink verified guest orders to the authenticated bridge user. */
export async function relinkOrdersByEmail(db, userId, email) {
  await db
    .prepare('UPDATE orders SET user_id = ?1 WHERE user_id IS NULL AND lower(email) = lower(?2)')
    .bind(userId, email)
    .run();
}

/**
 * Lazily ensure the app bridge row exists for an authenticated session.
 * @param {D1Database} db
 * @param {{ userId: string, email?: string | null }} auth
 */
export async function ensureUser(db, { userId, email }) {
  await db
    .prepare(
      `INSERT INTO users (auth_user_id, clerk_user_id, email)
       VALUES (?1, ?1, ?2)
       ON CONFLICT(auth_user_id) DO UPDATE SET
         clerk_user_id = excluded.auth_user_id,
         email = excluded.email,
         updated_at = unixepoch()`,
    )
    .bind(userId, email || '')
    .run();
  return getUserByAuthId(db, userId);
}
