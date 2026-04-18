/**
 * GET /api/admin/verify
 * Returns { ok: true } if the admin session cookie is valid.
 */

const COOKIE_NAME = 'admin_session';

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function onRequestGet({ request, env }) {
  const session = getCookie(request, COOKIE_NAME);
  const ok = session === env.UPLOAD_SECRET;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
