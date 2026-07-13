import { jsonResponse, requireAdmin, requireDb } from '../../../_lib/admin.js';

export async function onRequest({ request, env, params }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, actor_user_id, verified_email, ip_address, user_agent,
              outcome, created_at
         FROM artwork_claim_evidence
        WHERE keeper_piece_id = ?1 ORDER BY created_at DESC`,
    ).bind(params.id).all();
    return jsonResponse({ ok: true, evidence: results || [] });
  } catch {
    return jsonResponse({ ok: false, error: 'claim_evidence_unavailable' }, 503);
  }
}
