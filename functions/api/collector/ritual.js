import { requireUser, jsonResponse } from '../_lib/auth.js';
import { legacyEnabled, notFound } from '../_lib/keeper.js';
import {
  completeYearlyRitual,
  getYearlyRitualEligibility,
} from '../_lib/collectorDreams.js';

const ACTION_FIELDS = Object.freeze({
  reinforce: new Set(['keeperPieceId', 'action', 'idempotencyKey']),
  fulfilled: new Set(['keeperPieceId', 'action', 'idempotencyKey']),
  'plant-new': new Set(['keeperPieceId', 'action', 'idempotencyKey', 'body', 'scope']),
});

function errorStatus(code) {
  if (code === 'piece_not_held' || code === 'current_dream_missing') return 404;
  if (code === 'ritual_already_completed' || code === 'idempotency_conflict') return 409;
  if (code === 'db_not_configured' || code === 'atomic_batch_unavailable') return 503;
  return 400;
}

export async function onRequest({ request, env }) {
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse(
      { error: 'method_not_allowed' },
      { status: 405, headers: { Allow: 'GET, POST' } },
      request,
      env,
    );
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);
  try {
    if (request.method === 'GET') {
      const keeperPieceId = new URL(request.url).searchParams.get('piece');
      const eligibility = await getYearlyRitualEligibility(env, {
        userId: auth.userId, keeperPieceId, now: new Date().toISOString(),
      });
      return jsonResponse(eligibility, { status: 200 }, request, env);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
    }
    const fields = body && typeof body === 'object' && !Array.isArray(body)
      && Object.hasOwn(ACTION_FIELDS, body.action)
      ? ACTION_FIELDS[body.action]
      : null;
    if (!fields || Object.keys(body).length !== fields.size
      || Object.keys(body).some((field) => !fields.has(field))) {
      return jsonResponse({ error: 'invalid_input' }, { status: 400 }, request, env);
    }
    const result = await completeYearlyRitual(env, {
      userId: auth.userId,
      keeperPieceId: body.keeperPieceId,
      action: body.action,
      idempotencyKey: body.idempotencyKey,
      body: body.body,
      scope: body.scope,
      now: new Date().toISOString(),
    });
    return jsonResponse(result, { status: 200 }, request, env);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'collector_ritual_failed';
    return jsonResponse({ error: code }, { status: errorStatus(code) }, request, env);
  }
}
