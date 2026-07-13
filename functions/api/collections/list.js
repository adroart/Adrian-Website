/**
 * GET /api/collections/list
 *
 * Returns all of the signed-in user's collections with their items.
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { ensureUser } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse([], { status: 200 }, request, env);

  const user = await ensureUser(env.DB, { userId: auth.userId, email: auth.email });
  if (!user) return jsonResponse([], { status: 200 }, request, env);

  const { results: cols } = await env.DB
    .prepare('SELECT id, name, created_at FROM collections WHERE user_id = ?1 ORDER BY created_at')
    .bind(user.id)
    .all();
  if (!cols?.length) return jsonResponse([], { status: 200 }, request, env);

  const placeholders = cols.map((_, i) => `?${i + 1}`).join(',');
  const { results: items } = await env.DB
    .prepare(`SELECT collection_id, kind, ref FROM collection_items WHERE collection_id IN (${placeholders}) ORDER BY added_at`)
    .bind(...cols.map((c) => c.id))
    .all();

  const itemsByCol = new Map();
  for (const it of items ?? []) {
    const arr = itemsByCol.get(it.collection_id) ?? [];
    arr.push({ kind: it.kind, ref: it.ref });
    itemsByCol.set(it.collection_id, arr);
  }

  const out = cols.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: new Date(c.created_at * 1000).toISOString(),
    items: itemsByCol.get(c.id) ?? [],
  }));
  return jsonResponse(out, { status: 200 }, request, env);
}
