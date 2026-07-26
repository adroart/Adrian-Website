/**
 * GET /api/works/:id — public minimal record for an admin-created DRAFT piece.
 *
 * The public catalog (data/mockData.ts) is served client-side by WorksPage; this
 * endpoint is only the fallback for draft pieces that live in the D1
 * `registry_artworks` table (migration 015). It returns nothing secret — just a
 * title, series, and edition size — and only AFTER a plate has been issued for
 * the piece, so a bare draft (registered but never minted) is not exposed.
 */
import { isMissingTableError } from '../_lib/keeper.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const id = typeof params?.id === 'string' ? params.id.trim().toUpperCase() : '';
  if (!id) return json({ ok: false, error: 'not_found' }, 404);
  if (!env?.DB) return json({ ok: false, error: 'not_found' }, 404);

  try {
    const draft = await env.DB
      .prepare('SELECT id, title, series, edition_size FROM registry_artworks WHERE id = ?1')
      .bind(id)
      .first();
    if (!draft) return json({ ok: false, error: 'not_found' }, 404);

    // Only expose the record once a plate has actually been issued for it.
    const plate = await env.DB
      .prepare('SELECT 1 FROM keeper_pieces WHERE piece_id = ?1 LIMIT 1')
      .bind(id)
      .first();
    if (!plate) return json({ ok: false, error: 'not_found' }, 404);

    return json({
      ok: true,
      artwork: {
        id: draft.id,
        title: draft.title,
        series: draft.series || null,
        editionSize: draft.edition_size == null ? null : Number(draft.edition_size),
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: false, error: 'lookup_failed' }, 500);
  }
}
