import { jsonResponse, requireRegistryUnlock, requireDb } from '../../../_lib/admin.js';

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const limit = Math.min(100, Math.max(1, Number.isSafeInteger(body?.limit) ? body.limit : 50));
  const beforeCreatedAt = typeof body?.before?.createdAt === 'string'
    && body.before.createdAt
    ? body.before.createdAt
    : null;
  const beforeId = beforeCreatedAt && typeof body?.before?.id === 'string'
    && body.before.id
    ? body.before.id
    : null;
  if (beforeCreatedAt && !beforeId) {
    return jsonResponse({ ok: false, error: 'invalid_cursor' }, 400);
  }
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, actor_user_id, verified_email, ip_address, user_agent,
              outcome, created_at
         FROM artwork_claim_evidence
        WHERE keeper_piece_id = ?1
          AND (?2 IS NULL OR created_at < ?2 OR (created_at = ?2 AND id < ?3))
        ORDER BY created_at DESC, id DESC LIMIT ?4`,
    ).bind(params.id, beforeCreatedAt, beforeId, limit).all();
    const evidence = results || [];
    return jsonResponse({
      ok: true,
      evidence,
      nextBefore: evidence.length === limit
        ? {
            createdAt: evidence.at(-1)?.created_at,
            id: evidence.at(-1)?.id,
          }
        : null,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'claim_evidence_unavailable' }, 503);
  }
}
