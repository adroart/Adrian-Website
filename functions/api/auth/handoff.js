/**
 * GET /api/auth/handoff
 *
 * Mint side of the cross-site login handoff with mandalacodes.com (identity
 * direction, i64os/substrate/directions/identity.md): both sites bind the
 * SAME D1 database (see wrangler.toml), so a signed-in collector on either
 * site can arrive on the other already signed in, with no re-entered code
 * and no network call between the two sites.
 *
 * Requires an existing session on this site (401 otherwise — this is a
 * server-to-server style handoff, not a public sign-in door). Mints a
 * Better Auth one-time-token bound to this session (single use, 2-minute
 * expiry, hashed at rest, server-side only — see lib/account/auth.server.js)
 * and 302s to the oracle site's /api/auth/handoff/accept, which verifies
 * the token against the shared database and sets its own session cookie
 * for the same underlying session.
 *
 * `?next=` is a same-origin-relative path on the ORACLE site (validated
 * there, on arrival, not here) — this endpoint only forwards whatever was
 * asked for, defaulted if absent or unsafe-looking.
 */

import { createAuth } from '../../../lib/account/auth.server.js';
import { requireUser, safeReturnPath } from '../_lib/auth.js';

const TARGET_ORIGIN_PROD = 'https://mandalacodes.com';
const TARGET_ORIGIN_DEV = 'http://localhost:2222';
const DEFAULT_NEXT = '/account';

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { 'Cache-Control': 'no-store' } });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  const betterAuth = createAuth(env, waitUntil?.bind(context));
  let token;
  try {
    const result = await betterAuth.api.generateOneTimeToken({ headers: request.headers });
    token = result?.token;
  } catch {
    token = null;
  }
  if (!token) {
    return new Response(JSON.stringify({ error: 'handoff_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get('next'), DEFAULT_NEXT);
  const targetOrigin =
    env.HANDOFF_TARGET_ORIGIN ||
    ((env.BETTER_AUTH_URL || '').includes('localhost') ? TARGET_ORIGIN_DEV : TARGET_ORIGIN_PROD);

  const acceptUrl = new URL('/api/auth/handoff/accept', targetOrigin);
  acceptUrl.searchParams.set('token', token);
  acceptUrl.searchParams.set('next', next);

  return new Response(null, {
    status: 302,
    headers: { Location: acceptUrl.toString(), 'Cache-Control': 'no-store' },
  });
}
