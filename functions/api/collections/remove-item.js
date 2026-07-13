/**
 * POST /api/collections/remove-item
 * Body: { collectionId: number, kind: 'card' | 'artwork' | 'product', ref: string }
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { ensureUser } from '../_lib/db.js';

const KINDS = new Set(['card', 'artwork', 'product']);

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
  const collectionId = Number(body?.collectionId);
  const kind = String(body?.kind ?? '');
  const ref = typeof body?.ref === 'string' ? body.ref.trim() : '';
  if (!collectionId || !KINDS.has(kind) || !ref) {
    return jsonResponse({ error: 'invalid_payload' }, { status: 400 }, request, env);
  }

  await env.DB
    .prepare(
      `DELETE FROM collection_items
        WHERE kind = ?1 AND ref = ?2
          AND collection_id IN (SELECT id FROM collections WHERE id = ?3 AND user_id = ?4)`,
    )
    .bind(kind, ref, collectionId, user.id)
    .run();
  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
