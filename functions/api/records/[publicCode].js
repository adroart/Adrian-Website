/**
 * GET /api/records/:publicCode
 * HEAD /api/records/:publicCode
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
 *
 * HEAD performs the same D1 lookup as GET but never touches R2 storage. It
 * exists so a caller can probe whether a record exists (and offer a link
 * only when it does) without paying for, or waiting on, the storage read.
 * A row in piece_records never disappears once written (the table forbids
 * UPDATE and DELETE), so a 200 HEAD response can be cached long-term; a 404
 * cannot, because the record may still be generated later.
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

function empty(status, extraHeaders = {}) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export async function onRequest({ request, env, params }) {
  const method = request.method;
  const isHead = method === 'HEAD';
  if (method !== 'GET' && !isHead) {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, HEAD' });
  }
  const publicCode = String(params?.publicCode || '');
  if (!PUBLIC_CODE_PATTERN.test(publicCode)) {
    return isHead ? empty(404) : json({ ok: false, error: 'not_found' }, 404);
  }
  if (!env?.DB || !env?.ARTWORK_REGISTRY_BACKUP) {
    return isHead ? empty(503) : json({ ok: false, error: 'registry_unavailable' }, 503);
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
      return isHead ? empty(404) : json({ ok: false, error: 'not_found' }, 404);
    }
    return isHead ? empty(503) : json({ ok: false, error: 'registry_unavailable' }, 503);
  }
  if (!row) return isHead ? empty(404) : json({ ok: false, error: 'not_found' }, 404);

  if (isHead) {
    // Deliberately never reads R2: the whole point of HEAD is a cheap probe.
    return new Response(null, {
      status: 200,
      headers: {
        // Presence is permanent once a row exists, so this can cache long.
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${row.record_hash}"`,
      },
    });
  }

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
