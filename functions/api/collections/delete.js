/**
 * POST /api/collections/delete
 * Body: { id: number }
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { ensureUser } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const user = await ensureUser(env.DB, { userId: auth.userId, email: auth.email });
  if (!user) return jsonResponse({ ok: true }, { status: 200 }, request, env);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env); }
  const id = Number(body?.id);
  if (!id) return jsonResponse({ error: 'id_required' }, { status: 400 }, request, env);

  await env.DB
    .prepare('DELETE FROM collections WHERE id = ?1 AND user_id = ?2')
    .bind(id, user.id)
    .run();
  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
