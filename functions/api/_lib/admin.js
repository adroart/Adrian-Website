const COOKIE_NAME = 'admin_session';

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function isAdminAuthed(request, env) {
  return Boolean(env.UPLOAD_SECRET) && getCookie(request, COOKIE_NAME) === env.UPLOAD_SECRET;
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function requireAdmin(request, env) {
  if (isAdminAuthed(request, env)) return null;
  return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
}

export function requireDb(env) {
  if (env.DB) return null;
  return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);
}
