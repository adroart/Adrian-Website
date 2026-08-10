import { requireUser, jsonResponse } from '../_lib/auth.js';
import { legacyEnabled, notFound } from '../_lib/keeper.js';
import {
  appendCollectorDreamMarker,
  createCollectorDream,
  getCollectorDreamState,
  setCollectorDreamSharing,
  updateCollectorDream,
} from '../_lib/collectorDreams.js';

const ACTION_FIELDS = Object.freeze({
  create: new Set(['action', 'keeperPieceId', 'body', 'scope', 'idempotencyKey']),
  update: new Set([
    'action', 'keeperPieceId', 'body', 'scope', 'expectedVersion', 'idempotencyKey',
  ]),
  share: new Set(['action', 'keeperPieceId', 'visibility', 'idempotencyKey']),
  revoke: new Set(['action', 'keeperPieceId', 'visibility', 'idempotencyKey']),
  marker: new Set(['action', 'keeperPieceId', 'kind', 'body', 'idempotencyKey']),
});

function exactBody(body, fields) {
  return body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).length === fields.size
    && Object.keys(body).every((field) => fields.has(field));
}

function errorStatus(code) {
  if (code === 'piece_not_held' || code === 'current_dream_missing') return 404;
  if (code === 'current_dream_exists' || code === 'version_conflict'
    || code === 'idempotency_conflict') return 409;
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
      const state = await getCollectorDreamState(env, {
        userId: auth.userId, keeperPieceId,
      });
      return jsonResponse(state, { status: 200 }, request, env);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
    }
    const fields = Object.hasOwn(ACTION_FIELDS, body?.action)
      ? ACTION_FIELDS[body.action]
      : null;
    if (!fields || !exactBody(body, fields)) {
      return jsonResponse({ error: 'invalid_input' }, { status: 400 }, request, env);
    }
    const base = {
      userId: auth.userId,
      keeperPieceId: body.keeperPieceId,
      idempotencyKey: body.idempotencyKey,
      now: new Date().toISOString(),
    };
    let state;
    if (body.action === 'create') {
      state = await createCollectorDream(env, {
        ...base, body: body.body, scope: body.scope,
      });
    } else if (body.action === 'update') {
      state = await updateCollectorDream(env, {
        ...base, body: body.body, scope: body.scope,
        expectedVersion: body.expectedVersion,
      });
    } else if (body.action === 'share' || body.action === 'revoke') {
      const validVisibility = body.action === 'revoke'
        ? body.visibility === 'private'
        : body.visibility === 'anonymous' || body.visibility === 'attributed';
      if (!validVisibility) throw new Error('invalid_visibility');
      state = await setCollectorDreamSharing(env, {
        ...base, visibility: body.visibility,
      });
    } else {
      state = await appendCollectorDreamMarker(env, {
        ...base, kind: body.kind, body: body.body,
      });
    }
    return jsonResponse(state, { status: 200 }, request, env);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'collector_dream_failed';
    return jsonResponse({ error: code }, { status: errorStatus(code) }, request, env);
  }
}
