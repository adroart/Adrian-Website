/**
 * POST /api/collections/create
 * Body: { name: string }
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { ensureUser } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const user = await ensureUser(env.DB, { userId: auth.userId, email: auth.email });
  if (!user) return jsonResponse({ error: 'user_not_synced' }, { status: 409 }, request, env);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env); }
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) return jsonResponse({ error: 'name_required' }, { status: 400 }, request, env);

  const res = await env.DB
    .prepare('INSERT INTO collections (user_id, name) VALUES (?1, ?2) RETURNING id, name, created_at')
    .bind(user.id, name)
    .first();

  return jsonResponse(
    {
      id: res.id,
      name: res.name,
      createdAt: new Date(res.created_at * 1000).toISOString(),
      items: [],
    },
    { status: 200 },
    request,
    env,
  );
}
