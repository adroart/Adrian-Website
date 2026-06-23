/**
 * GET /api/atlas/mirror?pieceId=...&editionNumber=0
 *
 * The thin PIECE-LENS read path for the Living Legacy constellation scaffold.
 *
 * One Atlas, two lenses (Decision A + D in todo/plans/living-legacy.md):
 *   - mandalacodes renders the MANDALA / codon lens (the deck's 64 codons as
 *     rings on a globe) over the shared public atlas state.
 *   - Adrian-Website renders the PIECE lens (a physical artwork as one star,
 *     its keeper's home, its lineage) over the SAME source.
 *
 * The canonical, append-only ledger and its public projection live on
 * mandalacodes (atlas/public.json in R2, served at https://mandalacodes.com/api/atlas).
 * This endpoint does NOT rebuild any of that — it fetches that one public
 * source and projects just the requested piece's presence out of it. No keeper
 * identity, no personal data, no chain mutation happens here; it is a read.
 *
 * Gated behind the `livingLegacy` flag — 404 when off so the surface is
 * invisible until the feature ships. Degrades to a calm "not yet on the map"
 * shape (never an error wall) when the upstream is unreachable or the piece has
 * no public placement yet.
 */

import { legacyEnabled, notFound, json } from '../_lib/keeper.js';

/** Where the shared public atlas state is served. Overridable via env for
 *  preview deploys; defaults to the live mandalacodes endpoint. */
function atlasSource(env) {
  return env?.ATLAS_PUBLIC_URL || 'https://mandalacodes.com/api/atlas';
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const url = new URL(request.url);
  const pieceId = (url.searchParams.get('pieceId') || '').trim();
  const editionNumber = parseInt(url.searchParams.get('editionNumber') || '0', 10) || 0;
  if (!pieceId) return json({ ok: false, error: 'pieceId is required' }, 400);

  let publicState = null;
  try {
    const res = await fetch(atlasSource(env), {
      headers: { Accept: 'application/json' },
      // The public state is cacheable; a short edge cache keeps the piece page
      // fast without going stale for long.
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (res.ok) publicState = await res.json();
  } catch {
    // Upstream unreachable — fall through to the calm "not on the map" shape.
  }

  // The public projection is a set of placed lights keyed by piece + edition.
  // Shape is intentionally tolerant: we read what the lens needs and ignore the
  // rest, so a change to the mandalacodes projection never breaks this read.
  const star = findStar(publicState, pieceId, editionNumber);

  return json({
    ok: true,
    pieceId,
    editionNumber,
    onMap: Boolean(star),
    star, // null when the piece has no public placement yet
    // The full constellation lives on the canonical lens.
    constellationUrl: 'https://mandalacodes.com/atlas',
  });
}

/**
 * Pull the single light for (pieceId, editionNumber) out of whatever array the
 * public state exposes. We probe the common field names rather than hard-coding
 * one, since the projection is owned by mandalacodes.
 */
function findStar(publicState, pieceId, editionNumber) {
  if (!publicState || typeof publicState !== 'object') return null;
  const candidates =
    (Array.isArray(publicState.lights) && publicState.lights) ||
    (Array.isArray(publicState.pieces) && publicState.pieces) ||
    (Array.isArray(publicState.placements) && publicState.placements) ||
    [];
  for (const light of candidates) {
    if (!light || typeof light !== 'object') continue;
    const lid = light.pieceId ?? light.piece_id ?? light.id;
    const led = light.editionNumber ?? light.edition_number ?? 0;
    if (lid === pieceId && (led ?? 0) === editionNumber) {
      return light;
    }
  }
  return null;
}
