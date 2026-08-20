/**
 * GET /api/works/:id — public minimal record for a registered artwork that is
 * absent from the compiled static catalog (data/mockData.ts).
 *
 * WorksPage renders directly from the static catalog when the id is there;
 * this endpoint is only its fallback for artworks that exist solely in the
 * registry — either an admin draft (registry_artworks, migration 015) or an
 * artwork typed inline during registration. It serves any REGISTERED
 * identity (keeper_pieces.registration_status = 'registered'), not only ones
 * with a fabricated plate, since identity and optional plate fabrication are
 * independent.
 *
 * Metadata comes from resolveArtwork, which prefers the artwork's newest
 * catalog snapshot (title, series, category, year, dimensions, materials,
 * description, edition — frozen at registration time) over the thinner draft
 * row. It returns nothing secret: no codes, no keeper identity, no ownership
 * material.
 */
import { isMissingTableError } from '../_lib/keeper.js';
import { resolveArtwork } from '../_lib/artworkCatalog.js';

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
    const registered = await env.DB
      .prepare(
        `SELECT 1 FROM keeper_pieces
          WHERE piece_id = ?1 AND registration_status = 'registered' LIMIT 1`,
      )
      .bind(id)
      .first();
    if (!registered) return json({ ok: false, error: 'not_found' }, 404);

    const artwork = await resolveArtwork(env, id);
    // A plain 'catalog' resolution (no snapshot, no draft) means the id is
    // already served directly from the static catalog the client holds —
    // this fallback exists only for what that catalog does not have.
    if (!artwork || artwork.source === 'catalog') {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    return json({
      ok: true,
      artwork: {
        id: artwork.id,
        title: artwork.title,
        series: artwork.series ?? null,
        year: artwork.year ?? null,
        dimensions: artwork.dimensions ?? null,
        materials: artwork.materials ?? [],
        category: artwork.category ?? null,
        description: artwork.description ?? null,
        edition: {
          kind: artwork.editionKind === 'unique' || artwork.editionKind === 'numbered'
            ? artwork.editionKind
            : null,
          size: artwork.editionSize ?? null,
        },
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return json({ ok: false, error: 'not_found' }, 404);
    return json({ ok: false, error: 'lookup_failed' }, 500);
  }
}
