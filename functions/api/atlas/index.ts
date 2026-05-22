/**
 * GET /api/atlas
 *
 * Public, no auth. Returns the cached PublicAtlasState. If the cache is
 * missing (cold bucket, or post-deploy), regenerate from the raw ledger.
 *
 * Cached for 60s via Cache-Control per the spec.
 */

import type { PagesContext } from './_helpers';
import {
  readPublicState,
  readLedger,
  regeneratePublicState,
} from './_helpers';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { env } = context;

  let state = await readPublicState(env);
  if (!state) {
    const events = await readLedger(env);
    state = await regeneratePublicState(env, events);
  }

  return new Response(JSON.stringify({ ok: true, state }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
