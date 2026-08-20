/**
 * /api/admin/artworks/[id]/message — the artist's message for one physical
 * instance, sealed until its caretaker unlocks (migration 040).
 *
 * GET without keeperPieceId lists the artwork's registered instances with a
 * body-free summary of each active message; GET ?keeperPieceId= returns the
 * chosen instance's active message with its body (the artist wrote it and
 * may read it back). POST { keeperPieceId, body } writes a new sealed
 * message, superseding any active prior for the same instance.
 *
 * Message bodies are NEVER part of any public payload. They are not in the
 * Piece Record: the generator (functions/api/_lib/pieceRecord.js) queries
 * only keeper_pieces, artwork_catalog_snapshots, certificate content,
 * collector_claim_ordinals, artwork_lineage_events, collector_dreams, and
 * collector_shine_removals, never artist_messages, so no regeneration is
 * needed or performed here.
 *
 * Guarded like registration itself: admin session plus the registry step-up
 * unlock (mirroring register-artwork.js).
 */
import {
  jsonResponse,
  requireDb,
  requireRegistryUnlock,
} from '../../../_lib/admin.js';
import {
  createArtistMessage,
  readForArtist,
} from '../../../_lib/artistMessage.js';
import { normalizedArtworkId } from './media.js';

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

async function instanceRows(env, artworkId) {
  const result = await env.DB.prepare(
    `SELECT id, edition_number, public_code, keeper_user_id, claimed_at, released_at
       FROM keeper_pieces
      WHERE piece_id = ?1 AND public_code IS NOT NULL
      ORDER BY edition_number ASC, id ASC`,
  ).bind(artworkId).all();
  const rows = Array.isArray(result) ? result : result?.results;
  return Array.isArray(rows) ? rows : [];
}

async function instanceForArtwork(env, artworkId, keeperPieceId) {
  const rows = await instanceRows(env, artworkId);
  return rows.find((row) => row.id === keeperPieceId) ?? null;
}

function messageSummary(message) {
  if (!message) return null;
  return {
    id: message.id,
    createdAt: message.createdAt,
    revealedAt: message.revealedAt,
  };
}

function errorStatus(code) {
  if (['invalid_message_body', 'invalid_keeper_piece_id', 'invalid_created_at'].includes(code)) {
    return 400;
  }
  if (code === 'instance_not_found') return 404;
  if (code === 'artist_message_conflict') return 409;
  if (code === 'db_not_configured') return 503;
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

  const artworkId = normalizedArtworkId(params?.id);
  if (!artworkId) return jsonResponse({ ok: false, error: 'unknown_artwork' }, 404);

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const keeperPieceId = url.searchParams.get('keeperPieceId');
      if (keeperPieceId) {
        const instance = await instanceForArtwork(env, artworkId, keeperPieceId);
        if (!instance) return jsonResponse({ ok: false, error: 'instance_not_found' }, 404);
        const message = await readForArtist(env.DB, keeperPieceId);
        return jsonResponse({ ok: true, artworkId, keeperPieceId, message });
      }
      const rows = await instanceRows(env, artworkId);
      const instances = [];
      for (const row of rows) {
        const message = await readForArtist(env.DB, row.id);
        instances.push({
          keeperPieceId: row.id,
          editionNumber: Number(row.edition_number),
          publicCode: row.public_code,
          held: Boolean(row.keeper_user_id && row.claimed_at && !row.released_at),
          message: messageSummary(message),
        });
      }
      return jsonResponse({ ok: true, artworkId, instances });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }
    if (!exactKeys(body, ['keeperPieceId', 'body'])
      || typeof body.keeperPieceId !== 'string' || !body.keeperPieceId.trim()) {
      return jsonResponse({ ok: false, error: 'invalid_message_request' }, 400);
    }
    const keeperPieceId = body.keeperPieceId.trim();
    const instance = await instanceForArtwork(env, artworkId, keeperPieceId);
    if (!instance) return jsonResponse({ ok: false, error: 'instance_not_found' }, 404);

    const message = await createArtistMessage(env.DB, {
      keeperPieceId,
      body: body.body,
      createdAt: new Date().toISOString(),
    });
    return jsonResponse({
      ok: true,
      artworkId,
      keeperPieceId,
      message: messageSummary(message),
    }, 201);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code) return jsonResponse({ ok: false, error: code }, errorStatus(code));
    return jsonResponse({ ok: false, error: 'message_request_failed' }, 500);
  }
}
