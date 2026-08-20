/**
 * GET /api/records/:publicCode
 *
 * Serves the newest generated Piece Record (docs/piece-record-format.md) for
 * a permanent artwork identity, streamed from write-once R2 storage.
 *
 * Launch-gating note: this endpoint itself is NOT gated on the livingLegacy
 * flag, deliberately. A stored record contains only already-public data; the
 * gate the lineage endpoint enforces (legacyEnabled()) is applied at
 * GENERATION time instead, via the includeLegacySections option callers pass
 * to buildPieceRecord/publishPieceRecord in _lib/pieceRecord.js. A record
 * generated while the flag is off simply carries no lineage or shines
 * sections, so serving it early discloses nothing the flag protects.
 */

// Copied exactly from functions/qr/[number].js, the canonical public-code shape.
const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

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
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const publicCode = String(params?.publicCode || '');
  if (!PUBLIC_CODE_PATTERN.test(publicCode)) {
    return json({ ok: false, error: 'not_found' }, 404);
  }
  if (!env?.DB || !env?.ARTWORK_REGISTRY_BACKUP) {
    return json({ ok: false, error: 'registry_unavailable' }, 503);
  }

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT record_hash, r2_key
         FROM piece_records
        WHERE public_code = ?1
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
    ).bind(publicCode).first();
  } catch (error) {
    if (error instanceof Error && /no such table/i.test(error.message)) {
      return json({ ok: false, error: 'not_found' }, 404);
    }
    return json({ ok: false, error: 'registry_unavailable' }, 503);
  }
  if (!row) return json({ ok: false, error: 'not_found' }, 404);

  let stored;
  try {
    stored = await env.ARTWORK_REGISTRY_BACKUP.get(row.r2_key);
  } catch {
    return json({ ok: false, error: 'registry_unavailable' }, 503);
  }
  if (!stored) return json({ ok: false, error: 'registry_unavailable' }, 503);

  const body = typeof stored.body !== 'undefined' && stored.body !== null
    ? stored.body
    : await stored.text();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // The file is content-addressed by its own hash; identical bytes forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${row.record_hash}"`,
    },
  });
}
