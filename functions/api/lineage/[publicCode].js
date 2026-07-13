import { buildLineageEvent } from '../_lib/lineage.js';

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

function parsePublicPayload(value) {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid public payload');
  }
  return parsed;
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

  const publicCode = String(params?.publicCode || '');
  if (!PUBLIC_CODE_PATTERN.test(publicCode)) {
    return json({ ok: false, error: 'not_found' }, 404);
  }
  if (!env?.DB) {
    return json({ ok: false, error: 'registry_unavailable' }, 503);
  }

  let artwork;
  let rows;
  try {
    artwork = await env.DB.prepare(
      `SELECT id, piece_id, edition_number, public_code
         FROM keeper_pieces
        WHERE public_code = ?1
          AND plate_status = 'active'`,
    ).bind(publicCode).first();

    if (!artwork) return json({ ok: false, error: 'not_found' }, 404);

    const result = await env.DB.prepare(
      `SELECT sequence, event_type, event_at, previous_hash, event_hash, public_payload_json
         FROM artwork_lineage_events
        WHERE keeper_piece_id = ?1
        ORDER BY sequence ASC`,
    ).bind(artwork.id).all();
    rows = Array.isArray(result) ? result : result?.results;
    if (!Array.isArray(rows)) throw new Error('invalid D1 result');
  } catch {
    return json({ ok: false, error: 'registry_unavailable' }, 503);
  }

  const events = [];
  let previousHash = null;
  try {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const sequence = index + 1;
      if (row.sequence !== sequence || row.previous_hash !== previousHash) {
        throw new Error('broken lineage sequence');
      }

      const publicPayload = parsePublicPayload(row.public_payload_json);
      const recomputed = await buildLineageEvent({
        keeperPieceId: artwork.id,
        sequence: row.sequence,
        eventType: row.event_type,
        eventAt: row.event_at,
        previousHash: row.previous_hash,
        publicPayload,
      });
      if (recomputed.eventHash !== row.event_hash) {
        throw new Error('broken lineage hash');
      }

      events.push({
        sequence: row.sequence,
        eventType: row.event_type,
        eventAt: row.event_at,
        previousHash: row.previous_hash,
        eventHash: row.event_hash,
        publicPayload,
      });
      previousHash = row.event_hash;
    }
  } catch {
    return json({ ok: false, error: 'lineage_integrity_error' }, 409);
  }

  return json({
    ok: true,
    artwork: {
      pieceId: artwork.piece_id,
      editionNumber: artwork.edition_number,
      publicCode: artwork.public_code,
    },
    events,
  });
}
