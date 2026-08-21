/**
 * /api/admin/artworks/[id]/media — the "Add to this piece" media surface.
 *
 * POST admits one photograph or forever video for the artwork generally
 * (artwork-scoped piece_media, migration 039) through the content-addressed
 * write-once admission layer in _lib/pieceMedia.js, then regenerates the
 * permanent Piece Record for every registered instance of the artwork with
 * trigger_event 'attachment', FAIL-SOFT with per-instance outcomes: a record
 * failure never fails the attach. GET lists the artwork's active media rows.
 *
 * Body: JSON { kind: 'photo' | 'video', contentType, bytes } with bytes as
 * standard base64. Guarded like registration itself: admin session plus the
 * registry step-up unlock (mirroring register-artwork.js).
 */
import {
  jsonResponse,
  requireDb,
  requireRegistryUnlock,
} from '../../../_lib/admin.js';
import { resolveArtwork } from '../../../_lib/artworkCatalog.js';
import { legacyEnabled } from '../../../_lib/keeper.js';
import { admitPieceMedia, listPieceMedia } from '../../../_lib/pieceMedia.js';
import { refreshPieceRecord } from '../../../_lib/pieceRecordRefresh.js';

const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
const ALLOWED_KINDS = new Set(['photo', 'video']);

export function normalizedArtworkId(raw) {
  const id = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return ARTWORK_ID_PATTERN.test(id) && !id.startsWith('AR-') ? id : null;
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function decodeBase64(value) {
  if (typeof value !== 'string' || !value || value.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Regenerate the Piece Record for every registered instance of one artwork
 * with trigger_event 'attachment', via the shared refresh helper
 * (_lib/pieceRecordRefresh.js) so this never diverges from the same
 * idempotency comparison every other trigger site uses. Fail-soft by
 * contract: every failure is an outcome, never a throw.
 */
export async function regenerateArtworkRecords(env, artworkId, generatedAt) {
  let rows = [];
  try {
    const result = await env.DB.prepare(
      `SELECT public_code FROM keeper_pieces
        WHERE piece_id = ?1 AND public_code IS NOT NULL
        ORDER BY edition_number ASC, id ASC`,
    ).bind(artworkId).all();
    const listed = Array.isArray(result) ? result : result?.results;
    rows = Array.isArray(listed) ? listed : [];
  } catch {
    return { total: 0, generated: 0, unchanged: 0, failed: 0, outcomes: [] };
  }
  const includeLegacySections = legacyEnabled();
  const outcomes = [];
  for (const row of rows) {
    const publicCode = String(row.public_code || '');
    outcomes.push(await refreshPieceRecord(env, {
      publicCode, trigger: 'attachment', generatedAt, includeLegacySections,
    }));
  }
  return {
    total: outcomes.length,
    generated: outcomes.filter((outcome) => outcome.status === 'generated').length,
    unchanged: outcomes.filter((outcome) => outcome.status === 'unchanged').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length,
    outcomes,
  };
}

function errorStatus(code) {
  if ([
    'invalid_piece_media_kind', 'invalid_piece_media_content_type',
    'invalid_piece_media_size', 'invalid_piece_media_bytes',
    'invalid_piece_media_parent', 'invalid_media_request',
  ].includes(code)) return 400;
  if (code === 'unknown_artwork') return 404;
  if (['media_upload_busy', 'artwork_edition_metadata_conflict'].includes(code)) return 409;
  if ([
    'media_backup_failed', 'media_backup_not_configured', 'db_not_configured',
    'piece_media_insert_failed',
  ].includes(code)) return 503;
  return 500;
}

export async function onRequest({ request, env, params }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'media_backup_not_configured' }, 503);
  }

  const artworkId = normalizedArtworkId(params?.id);
  if (!artworkId) return jsonResponse({ ok: false, error: 'unknown_artwork' }, 404);

  try {
    const artwork = await resolveArtwork(env, artworkId);
    if (!artwork) return jsonResponse({ ok: false, error: 'unknown_artwork' }, 404);

    if (request.method === 'GET') {
      const media = await listPieceMedia(env.DB, { artworkId });
      return jsonResponse({ ok: true, artworkId, media });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }
    if (!exactKeys(body, ['kind', 'contentType', 'bytes'])
      || !ALLOWED_KINDS.has(body.kind)) {
      return jsonResponse({ ok: false, error: 'invalid_media_request' }, 400);
    }
    const bytes = decodeBase64(body.bytes);
    if (!bytes) return jsonResponse({ ok: false, error: 'invalid_media_request' }, 400);

    const media = await admitPieceMedia(env, env.DB, {
      artworkId,
      kind: body.kind,
      contentType: body.contentType,
      bytes,
    });
    const records = await regenerateArtworkRecords(env, artworkId, new Date().toISOString());
    return jsonResponse({ ok: true, artworkId, media, records }, 201);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code) return jsonResponse({ ok: false, error: code }, errorStatus(code));
    return jsonResponse({ ok: false, error: 'media_request_failed' }, 500);
  }
}
