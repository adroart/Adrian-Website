import { requireUser, jsonResponse } from '../_lib/auth.js';
import { legacyEnabled, notFound } from '../_lib/keeper.js';
import { clientErrorCode } from '../_lib/clientError.js';
import {
  appendCollectorDreamMarker,
  createCollectorDream,
  getCollectorDreamState,
  setCollectorDreamSharing,
  setCollectorDreamTier,
  updateCollectorDream,
} from '../_lib/collectorDreams.js';

// `optional` fields may be present or absent; everything in `required` must
// be present and nothing outside the union may appear. create's tier and
// heirsMayShare are optional so pre-tier clients keep their exact shape.
const ACTION_FIELDS = Object.freeze({
  create: {
    required: new Set(['action', 'keeperPieceId', 'body', 'scope', 'idempotencyKey']),
    optional: new Set(['tier', 'heirsMayShare']),
  },
  update: {
    required: new Set([
      'action', 'keeperPieceId', 'body', 'scope', 'expectedVersion', 'idempotencyKey',
    ]),
    optional: new Set(),
  },
  share: {
    required: new Set(['action', 'keeperPieceId', 'visibility', 'idempotencyKey']),
    optional: new Set(),
  },
  revoke: {
    required: new Set(['action', 'keeperPieceId', 'visibility', 'idempotencyKey']),
    optional: new Set(),
  },
  tier: {
    required: new Set(['action', 'keeperPieceId', 'tier', 'idempotencyKey']),
    optional: new Set(),
  },
  marker: {
    required: new Set(['action', 'keeperPieceId', 'kind', 'body', 'idempotencyKey']),
    optional: new Set(),
  },
});

function exactBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.every((field) => fields.required.has(field) || fields.optional.has(field))
    && [...fields.required].every((field) => keys.includes(field));
}

function errorStatus(code) {
  if (code === 'piece_not_held' || code === 'current_dream_missing') return 404;
  if (code === 'current_dream_exists' || code === 'version_conflict'
    || code === 'idempotency_conflict' || code === 'outside_birthday_window'
    || code === 'shine_is_permanent' || code === 'shone_cannot_seal'
    || code === 'dream_sealed' || code === 'tier_unchanged') return 409;
  if (code === 'db_not_configured' || code === 'atomic_batch_unavailable'
    || code === 'dream_tiers_unavailable') return 503;
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
        ...base,
        body: body.body,
        scope: body.scope,
        ...(body.tier !== undefined ? { tier: body.tier } : {}),
        ...(body.heirsMayShare !== undefined ? { heirsMayShare: body.heirsMayShare } : {}),
      });
    } else if (body.action === 'tier') {
      state = await setCollectorDreamTier(env, { ...base, tier: body.tier });
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
    const code = clientErrorCode(error, 'collector_dream_failed');
    return jsonResponse({ error: code }, { status: errorStatus(code) }, request, env);
  }
}
