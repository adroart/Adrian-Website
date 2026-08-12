/**
 * GET /api/profile/get
 *
 * Returns the signed-in user's Hologenetic Profile as the StoredProfile
 * shape consumed by lib/profile/storage.ts (inputs + computed + updatedAt).
 * Returns 204 No Content when the user has no profile saved.
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { readCollectorOnboarding } from '../_lib/collectorOnboarding.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const onboarding = await readCollectorOnboarding(env, { userId: auth.userId });
  if (onboarding.status === 'missing') return new Response(null, { status: 204 });
  const row = await env.DB
    .prepare(`
      SELECT profile.computed_json
        FROM users AS account
        JOIN profiles AS profile ON profile.user_id = account.id
       WHERE account.auth_user_id = ?1
    `)
    .bind(auth.userId)
    .first();
  if (!row) return new Response(null, { status: 204 });

  let computed;
  try {
    computed = JSON.parse(row.computed_json);
  } catch {
    return jsonResponse({ error: 'profile_corrupt' }, { status: 500 }, request, env);
  }

  return jsonResponse(
    {
      inputs: onboarding.inputs,
      computed,
      updatedAt: onboarding.updatedAt,
    },
    { status: 200 },
    request,
    env,
  );
}
