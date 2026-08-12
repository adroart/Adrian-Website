/**
 * DELETE /api/profile/delete
 *
 * Wipes the signed-in user's profile row. Idempotent, succeeds when no
 * profile exists.
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { deleteCollectorBirthProfile } from '../_lib/collectorOnboarding.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const result = await deleteCollectorBirthProfile(env, { userId: auth.userId });
  return jsonResponse(result, { status: 200 }, request, env);
}
