/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */

const COOKIE_NAME = 'admin_session';

export async function onRequestPost({ request }) {
  const isSecure = new URL(request.url).protocol === 'https:';
  const cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isSecure ? '; Secure' : ''}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
  });
}
