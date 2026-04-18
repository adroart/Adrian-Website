/**
 * POST /api/admin/login
 * Body: { password: string }
 * Sets an HttpOnly session cookie on success.
 */

const COOKIE_NAME = 'admin_session';

function cookieHeader(value, isSecure) {
  const base = `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`;
  return isSecure ? `${base}; Secure` : base;
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  if (!body.password || body.password !== env.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isSecure = new URL(request.url).protocol === 'https:';
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader(env.UPLOAD_SECRET, isSecure),
    },
  });
}
