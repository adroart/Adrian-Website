import { requireUser, jsonResponse } from '../_lib/auth.js';
import {
  COLLECTOR_PRIVACY_POLICY_VERSION,
  getCollectorPrivacy,
  listCollectorCuratedCities,
  updateCollectorPrivacy,
} from '../_lib/collectorPrivacy.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.get('view') === 'cities') {
        const cities = await listCollectorCuratedCities(env);
        return jsonResponse({ cities }, { status: 200 }, request, env);
      }
      const keeperPieceId = url.searchParams.get('piece');
      const state = await getCollectorPrivacy(env, { userId: auth.userId, keeperPieceId });
      return jsonResponse(state, { status: 200 }, request, env);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
    }
    const state = await updateCollectorPrivacy(env, {
      ...body,
      userId: auth.userId,
      policyVersion: COLLECTOR_PRIVACY_POLICY_VERSION,
      changedAt: new Date().toISOString(),
    });
    return jsonResponse(state, { status: 200 }, request, env);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'privacy_update_failed';
    const status = code === 'user_not_synced' || code === 'piece_not_held'
      ? 404
      : code === 'db_not_configured' || code === 'atomic_batch_unavailable'
        ? 503
        : 400;
    return jsonResponse({ error: code }, { status }, request, env);
  }
}
