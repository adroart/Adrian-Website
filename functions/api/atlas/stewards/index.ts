/**
 * GET /api/atlas/stewards
 *
 * Admin-only. Returns the steward roster with every `keyHash` replaced by
 * the literal string '[REDACTED]'. The hash never leaves the server.
 */

import type { PagesContext } from '../_helpers';
import { isAdmin, json, readStewards } from '../_helpers';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  if (!isAdmin(request, env)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const stewards = await readStewards(env);
  const redacted = stewards.map((s) => ({ ...s, keyHash: '[REDACTED]' }));
  return json({ ok: true, stewards: redacted });
}
