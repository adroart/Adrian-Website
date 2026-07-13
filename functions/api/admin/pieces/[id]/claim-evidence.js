import { jsonResponse, requireAdminPostStepUp, requireDb } from '../../../_lib/admin.js';

export async function onRequest({ request, env, params }) {
  const authorization = await requireAdminPostStepUp(request, env);
  if (authorization.response) return authorization.response;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const limit = Math.min(100, Math.max(1, Number.isSafeInteger(authorization.body?.limit) ? authorization.body.limit : 50));
  const before = typeof authorization.body?.before === 'string' && authorization.body.before
    ? authorization.body.before
    : null;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, actor_user_id, verified_email, ip_address, user_agent,
              outcome, created_at
         FROM artwork_claim_evidence
        WHERE keeper_piece_id = ?1 AND (?2 IS NULL OR created_at < ?2)
        ORDER BY created_at DESC LIMIT ?3`,
    ).bind(params.id, before, limit).all();
    const evidence = results || [];
    return jsonResponse({
      ok: true,
      evidence,
      nextBefore: evidence.length === limit ? evidence.at(-1)?.created_at || null : null,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'claim_evidence_unavailable' }, 503);
  }
}
