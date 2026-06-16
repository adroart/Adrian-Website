/**
 * POST /api/collections/add-item
 * Body: { collectionId: number, kind: 'card' | 'artwork' | 'product', ref: string }
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { ensureUser } from '../_lib/db.js';

const KINDS = new Set(['card', 'artwork', 'product']);

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
  const collectionId = Number(body?.collectionId);
  const kind = String(body?.kind ?? '');
  const ref = typeof body?.ref === 'string' ? body.ref.trim().slice(0, 80) : '';
  if (!collectionId || !KINDS.has(kind) || !ref) {
    return jsonResponse({ error: 'invalid_payload' }, { status: 400 }, request, env);
  }

  // Ownership check before mutating.
  const ownsRow = await env.DB
    .prepare('SELECT 1 FROM collections WHERE id = ?1 AND user_id = ?2')
    .bind(collectionId, user.id)
    .first();
  if (!ownsRow) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env);

  await env.DB
    .prepare(
      `INSERT INTO collection_items (collection_id, kind, ref)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(collection_id, kind, ref) DO NOTHING`,
    )
    .bind(collectionId, kind, ref)
    .run();
  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
