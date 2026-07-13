/**
 * POST /api/admin/login
 * Body: { password: string }
 *
 * Verifies the password against UPLOAD_SECRET in constant time and, on success,
 * sets an HttpOnly cookie holding a SIGNED, EXPIRING session token (never the
 * raw secret). Brute-force is slowed by a per-IP rate limit.
 */

import { createAdminSessionToken, verifyAdminPassword } from '../_lib/admin.js';
import { rateLimit, clientIp } from '../_lib/ratelimit.js';

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches the token TTL

function cookieHeader(value, isSecure) {
  const base = `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}`;
  return isSecure ? `${base}; Secure` : base;
}

export async function onRequestPost({ request, env }) {
  // 10 attempts per IP per 5 minutes. Best-effort (per-isolate) — see ratelimit.js.
  const limit = rateLimit(`admin-login:${clientIp(request)}`, { max: 10, windowMs: 5 * 60_000 });
  if (!limit.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'too_many_attempts' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) },
    });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  if (!(await verifyAdminPassword(env, body.password))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isSecure = new URL(request.url).protocol === 'https:';
  const token = await createAdminSessionToken(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader(token, isSecure),
    },
  });
}
