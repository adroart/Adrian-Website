import { jsonResponse } from '../_lib/auth.js';
import { runCollectorLetterEvents } from '../_lib/collectorLetters.js';
import { retryCaretakerPassingSenderNotices } from '../_lib/caretakerPassing.js';
import { runClaimSilenceSweep } from '../_lib/claimSilence.js';
import { legacyEnabled, notFound } from '../_lib/keeper.js';

function equalSecret(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string'
    || !provided || !expected || provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function onRequest({ request, env }) {
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'POST') {
    return jsonResponse(
      { error: 'method_not_allowed' },
      { status: 405, headers: { Allow: 'POST' } },
      request,
      env,
    );
  }
  if (!env?.DB) {
    return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);
  }
  if (!equalSecret(
    request.headers.get('X-Collector-Letters-Key'),
    env.COLLECTOR_LETTERS_SERVICE_KEY,
  )) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 }, request, env);
  }
  try {
    const now = new Date().toISOString();
    let input = {};
    try { input = await request.json(); } catch { /* empty manual request */ }
    const cursor = typeof input?.claimCursor === 'string' ? input.claimCursor : '';
    const passingCursor = typeof input?.passingCursor === 'string' ? input.passingCursor : '';
    const [run, claimSilence, passingNotices] = await Promise.all([
      runCollectorLetterEvents(env, { now }),
      runClaimSilenceSweep(env, { now, cursor, limit: 25 }),
      retryCaretakerPassingSenderNotices(env, { cursor: passingCursor, limit: 25 }),
    ]);
    return jsonResponse({ ok: true, run, claimSilence, passingNotices }, { status: 200 }, request, env);
  } catch {
    return jsonResponse(
      { ok: false, error: 'collector_letters_runner_failed' },
      { status: 503 },
      request,
      env,
    );
  }
}
