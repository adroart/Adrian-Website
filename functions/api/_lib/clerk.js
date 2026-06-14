/**
 * Shared auth helpers for Pages Functions.
 *
 * NOTE ON THE NAME: this file is still called clerk.js so the 16 endpoints that
 * import `requireUser`/`jsonResponse` from it don't all have to change. It no
 * longer uses Clerk — it validates the self-owned Better Auth session cookie.
 * The return contract is unchanged: `{ userId, email }` or a 401 Response.
 *
 * `userId` is the Better Auth user id. The D1 users row stores it in the
 * `clerk_user_id` column (kept as the generic "external auth id" column), so
 * `getUserByClerkId(env.DB, auth.userId)` keeps working without a rename.
 */

import { createAuth } from '../../../lib/account/auth.server.js';

/**
 * Verify the request's Better Auth session cookie. Returns
 * `{ userId, email, session, user }` on success, `null` on any failure.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function verifyRequest(request, env) {
  if (!env.DB) return null;
  try {
    const auth = createAuth(env);
    const data = await auth.api.getSession({ headers: request.headers });
    if (!data || !data.user?.id) return null;
    return {
      userId: data.user.id,
      email: data.user.email ?? null,
      session: data.session,
      user: data.user,
    };
  } catch {
    return null;
  }
}

/**
 * Require a verified user. On success returns the auth context. On failure
 * returns a fully formed 401 `Response` the handler should return immediately.
 * @param {Request} request
 * @param {Record<string, any>} env
 */
export async function requireUser(request, env) {
  const auth = await verifyRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return auth;
}

/**
 * Standard CORS preflight + headers used across the account-aware endpoints.
 * Same allow-list as /api/checkout — keep them in sync.
 */
const ALLOWED_ORIGINS = [
  'https://adrianrasmussen.com',
  'https://www.adrianrasmussen.com',
  'https://adrian-rasmussen-art.pages.dev',
];

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow localhost during local dev (no production secret set, or explicit dev URL).
  const isDev = !env?.BETTER_AUTH_URL || env.BETTER_AUTH_URL.includes('localhost');
  if (isDev) {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
}

export function corsHeaders(origin, env) {
  if (!isAllowedOrigin(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

export function jsonResponse(body, init = {}, request = null, env = null) {
  const origin = request?.headers?.get?.('Origin') ?? null;
  const cors = origin && env ? corsHeaders(origin, env) : {};
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers || {}) },
  });
}
