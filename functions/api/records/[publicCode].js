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
 * The stable public-code URL always resolves the newest record row. A rebuild
 * can therefore change its public projection (including a privacy removal),
 * even though each R2 object and piece_records row is append-only. Clients
 * must revalidate this stable URL before reusing it. Only a URL that names a
 * particular content hash may be cached immutable.
 */

// Copied exactly from functions/qr/[number].js, the canonical public-code shape.
const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const LATEST_RECORD_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

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

function etagFor(recordHash) {
  return `"${recordHash}"`;
}

/**
 * Conditional GET/HEAD uses weak comparison for If-None-Match as required
 * for GET and HEAD. Supporting comma-separated validators also lets a client
 * revalidate after it has seen more than one version of a stable URL.
 */
function matchesIfNoneMatch(request, etag) {
  const condition = request.headers.get('If-None-Match');
  if (!condition) return false;
  return condition.split(',').some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//i, '');
    return normalized === '*' || normalized === etag;
  });
}

function latestRecordHeaders(recordHash) {
  return {
    'Cache-Control': LATEST_RECORD_CACHE_CONTROL,
    ETag: etagFor(recordHash),
  };
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

  const headers = latestRecordHeaders(row.record_hash);
  if (matchesIfNoneMatch(request, headers.ETag)) {
    return new Response(null, { status: 304, headers });
  }

  if (isHead) {
    // Deliberately never reads R2: the whole point of HEAD is a cheap probe.
    return new Response(null, {
      status: 200,
      headers,
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
      ...headers,
    },
  });
}
