/**
 * Shared Clerk + auth helpers for Pages Functions.
 *
 * Verifies the JWT in the `Authorization: Bearer ...` header against Clerk's
 * JWKs. Returns the user's Clerk ID + primary email, or null if verification
 * fails. Endpoints requiring auth use `requireUser(request, env)` which
 * either returns a populated context or a 401 Response ready to send.
 */

import { verifyToken } from '@clerk/backend';

/**
 * Pull the bearer token from the Authorization header.
 * @param {Request} request
 * @returns {string | null}
 */
export function bearerToken(request) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify the request's bearer token. Returns `{ userId, email, payload }`
 * on success, `null` on any failure (missing token, bad signature, expired).
 * @param {Request} request
 * @param {{ CLERK_SECRET_KEY?: string }} env
 * @returns {Promise<null | { userId: string; email: string | null; payload: any }>}
 */
export async function verifyRequest(request, env) {
  const token = bearerToken(request);
  if (!token) return null;
  if (!env.CLERK_SECRET_KEY) return null;
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    if (!payload || !payload.sub) return null;
    // Clerk includes the primary email in the JWT when configured. Fall back
    // to null and let the caller fetch the user record if needed.
    const email =
      (typeof payload.email === 'string' && payload.email) ||
      (Array.isArray(payload.email_addresses) && payload.email_addresses[0]?.email_address) ||
      null;
    return { userId: payload.sub, email, payload };
  } catch {
    return null;
  }
}

/**
 * Require a verified user. On success returns the auth context. On failure
 * returns a fully formed 401 `Response` that the handler should immediately
 * return to the client.
 *
 * @param {Request} request
 * @param {{ CLERK_SECRET_KEY?: string }} env
 * @returns {Promise<{ userId: string; email: string | null; payload: any } | Response>}
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
  if (env?.CLERK_SECRET_KEY?.startsWith?.('sk_test_')) {
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
