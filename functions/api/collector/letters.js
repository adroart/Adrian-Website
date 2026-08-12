import { requireUser, jsonResponse } from '../_lib/auth.js';
import { legacyEnabled, notFound } from '../_lib/keeper.js';
import {
  generateCollectorLetters,
  getCollectorLetters,
} from '../_lib/collectorLetters.js';

const POST_FIELDS = Object.freeze({
  'kin-claim': new Set(['kind', 'keeperPieceId']),
  anniversary: new Set(['kind', 'keeperPieceId']),
  transfer: new Set(['kind', 'transferIntentId']),
});

function exactBody(body, fields) {
  return body && typeof body === 'object' && !Array.isArray(body)
    && Object.keys(body).length === fields.size
    && Object.keys(body).every((field) => fields.has(field));
}

function equalSecret(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string'
    || !provided || !expected || provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function errorStatus(code) {
  if (code === 'piece_not_held' || code === 'piece_not_active'
    || code === 'source_piece_not_active' || code === 'completed_transfer_missing') return 404;
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
  if (!env?.DB) {
    return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);
  }
  try {
    if (request.method === 'GET') {
      const auth = await requireUser(request, env);
      if (auth instanceof Response) return auth;
      const keeperPieceId = new URL(request.url).searchParams.get('piece');
      const letters = await getCollectorLetters(env, {
        userId: auth.userId,
        keeperPieceId,
      });
      return jsonResponse({ letters }, { status: 200 }, request, env);
    }

    if (!equalSecret(
      request.headers.get('X-Collector-Letters-Key'),
      env.COLLECTOR_LETTERS_SERVICE_KEY,
    )) {
      return jsonResponse({ error: 'unauthorized' }, { status: 401 }, request, env);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
    }
    const fields = body && Object.hasOwn(POST_FIELDS, body.kind)
      ? POST_FIELDS[body.kind]
      : null;
    if (!fields || !exactBody(body, fields)) {
      return jsonResponse({ error: 'invalid_input' }, { status: 400 }, request, env);
    }
    const letters = await generateCollectorLetters(env, {
      ...body,
      now: new Date().toISOString(),
    });
    return jsonResponse({ letters }, { status: 200 }, request, env);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'collector_letters_failed';
    return jsonResponse({ error: code }, { status: errorStatus(code) }, request, env);
  }
}
