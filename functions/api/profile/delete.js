/**
 * DELETE /api/profile/delete
 *
 * Wipes the signed-in user's profile row. Idempotent — succeeds when no
 * profile exists.
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { ensureUser } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const user = await ensureUser(env.DB, { userId: auth.userId, email: auth.email });
  if (!user) return jsonResponse({ ok: true }, { status: 200 }, request, env);

  await env.DB
    .prepare('DELETE FROM profiles WHERE user_id = ?1')
    .bind(user.id)
    .run();

  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
