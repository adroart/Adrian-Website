import { getPublicCollectorDream } from '../../../_lib/collectorDreams.js';
import { legacyEnabled, notFound } from '../../../_lib/keeper.js';
import { isPublicRegistryCode } from '../../../../../utils/publicRegistry.ts';

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export async function onRequest({ request, env, params }) {
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const publicCode = params?.publicCode;
  if (!isPublicRegistryCode(publicCode)) return json({ dream: null });
  if (!env?.DB) return json({ error: 'public_dream_unavailable' }, 503);

  try {
    const piece = await env.DB.prepare(`
      SELECT id
        FROM keeper_pieces
       WHERE public_code = ?1
         AND registration_status = 'registered'
         AND keeper_user_id IS NOT NULL
         AND claimed_at IS NOT NULL
         AND released_at IS NULL
    `).bind(publicCode).first();
    if (!piece) return json({ dream: null });

    const dream = await getPublicCollectorDream(env, {
      keeperPieceId: piece.id,
      now: new Date().toISOString(),
    });
    if (!dream) return json({ dream: null });
    return json({
      dream: {
        body: dream.body,
        scope: dream.scope,
        visibility: dream.visibility,
        attribution: dream.attribution,
        sharedAt: dream.sharedAt,
      },
    });
  } catch {
    return json({ error: 'public_dream_unavailable' }, 503);
  }
}
