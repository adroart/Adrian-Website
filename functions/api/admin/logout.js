/**
 * POST /api/admin/logout
 * Clears the admin session cookie.
 */

import { clearRegistryUnlockCookie } from '../_lib/admin.js';

const LEGACY_COOKIE_NAME = 'admin_session';

export async function onRequestPost({ request }) {
  const isSecure = new URL(request.url).protocol === 'https:';
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  headers.append(
    'Set-Cookie',
    `${LEGACY_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isSecure ? '; Secure' : ''}`,
  );
  headers.append('Set-Cookie', clearRegistryUnlockCookie(request));
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  });
}
