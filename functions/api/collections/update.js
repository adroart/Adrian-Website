/**
 * POST /api/collections/update
 * Body: { id: number, name: string }
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) return jsonResponse({ error: 'user_not_synced' }, { status: 409 }, request, env);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env); }
  const id = Number(body?.id);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!id || !name) return jsonResponse({ error: 'id_and_name_required' }, { status: 400 }, request, env);

  await env.DB
    .prepare('UPDATE collections SET name = ?1 WHERE id = ?2 AND user_id = ?3')
    .bind(name, id, user.id)
    .run();
  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
