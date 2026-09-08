/**
 * GET /api/auth/handoff/accept?token=...&next=...
 *
 * Accept side of the cross-site login handoff (identity direction,
 * i64os/substrate/directions/identity.md; mint side: ../handoff.js on
 * mandalacodes.com). Verifies a one-time-token minted by the other site
 * against the shared Better Auth database — adrianrasmussen.com and
 * mandalacodes.com bind the SAME D1 database (see wrangler.toml), so the
 * token's `verification` row and the session it points at are already
 * visible here with no network call to the other site.
 *
 * Single use: verifying consumes the token, so a replayed or reloaded URL
 * fails the second time. On success, sets this site's own session cookie
 * for that same underlying session and 302s to a validated same-origin
 * `next` path.
 */

import { createAuth } from '../../../../lib/account/auth.server.js';
import { safeReturnPath } from '../../_lib/auth.js';

const DEFAULT_NEXT = '/account';

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const next = safeReturnPath(url.searchParams.get('next'), DEFAULT_NEXT);

  if (!token) {
    return new Response('Missing sign-in token', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const auth = createAuth(env, waitUntil?.bind(context));
  let result;
  try {
    result = await auth.api.verifyOneTimeToken({
      body: { token },
      headers: request.headers,
      returnHeaders: true,
    });
  } catch {
    return new Response('That sign-in link is invalid or has expired.', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const headers = new Headers({ Location: next, 'Cache-Control': 'no-store' });
  const setCookies =
    typeof result?.headers?.getSetCookie === 'function' ? result.headers.getSetCookie() : [];
  for (const cookie of setCookies) headers.append('Set-Cookie', cookie);

  return new Response(null, { status: 302, headers });
}
