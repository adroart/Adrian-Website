/**
 * GET /api/admin/verify
 * Returns { ok: true } if the admin session cookie is a valid, unexpired token.
 */

import { isAdminAuthed } from '../_lib/admin.js';

export async function onRequestGet({ request, env }) {
  const ok = await isAdminAuthed(request, env);
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
