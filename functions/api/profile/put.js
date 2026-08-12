/**
 * PUT /api/profile/put
 *
 * Body: { inputs }
 *
 * Upserts the profile row for the signed-in user. Persists both the
 * inputs (so the user can edit later) and the computed Hologenetic
 * Profile JSON. The server computes the chart through the verified local adapter.
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { saveCollectorBirthProfile } from '../_lib/collectorOnboarding.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
  }

  try {
    await saveCollectorBirthProfile(env, {
      userId: auth.userId,
      email: auth.email,
      inputs: body?.inputs,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'profile_save_failed';
    return jsonResponse({ error: code }, { status: code === 'invalid_inputs' ? 400 : 500 }, request, env);
  }

  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
