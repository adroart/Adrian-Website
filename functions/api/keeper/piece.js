/**
 * /api/keeper/piece
 *
 * GET  ?pieceId=...&editionNumber=0
 *   Tells the signed-in user their relationship to this piece:
 *     { ok: true, kept: boolean, byYou: boolean, currentDisplayLocation?: string }
 *   - kept:  does an active keeper binding exist at all (any user)?
 *   - byYou: is the signed-in user that keeper?
 *   currentDisplayLocation is returned only to the piece's own keeper.
 *
 * PUT  { pieceId, editionNumber?, currentDisplayLocation }
 *   The keeper edits where the piece currently lives. Presentation state only:
 *   it is shown on the certificate's provenance and NEVER enters the ledger
 *   chain. Pass an empty string to clear it.
 *
 * Gated behind the `livingLegacy` flag (404 when off). Auth: Better Auth
 * session (requireUser). This endpoint reads no other keeper's data.
 */

import { requireUser } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';
import {
  legacyEnabled,
  notFound,
  json,
  migrationNotApplied,
  isMissingTableError,
} from '../_lib/keeper.js';

const LOCATION_MAX = 200;

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return migrationNotApplied();

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) return json({ ok: false, error: 'account_not_synced' }, 409);

  try {
    if (request.method === 'GET') return handleGet(context, auth);
    if (request.method === 'PUT') return handlePut(context, auth);
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    console.error('[keeper/piece] error:', err?.message);
    return json({ ok: false, error: 'keeper_piece_failed' }, 500);
  }
}

async function handleGet(context, auth) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pieceId = (url.searchParams.get('pieceId') || '').trim();
  const editionNumber = parseInt(url.searchParams.get('editionNumber') || '0', 10) || 0;
  if (!pieceId) return json({ ok: false, error: 'pieceId is required' }, 400);

  const row = await env.DB
    .prepare(
      `SELECT keeper_user_id, current_display_location
         FROM keeper_pieces
        WHERE piece_id = ?1 AND edition_number = ?2 AND released_at IS NULL`,
    )
    .bind(pieceId, editionNumber)
    .first();

  if (!row) return json({ ok: true, kept: false, byYou: false });

  const byYou = row.keeper_user_id === auth.userId;
  return json({
    ok: true,
    kept: true,
    byYou,
    // Display location is the keeper's own data; only surface it to them.
    ...(byYou ? { currentDisplayLocation: row.current_display_location ?? null } : {}),
  });
}

async function handlePut(context, auth) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const pieceId = typeof body?.pieceId === 'string' ? body.pieceId.trim() : '';
  const editionNumber = Number.isInteger(body?.editionNumber) ? body.editionNumber : 0;
  let location =
    typeof body?.currentDisplayLocation === 'string'
      ? body.currentDisplayLocation.trim().slice(0, LOCATION_MAX)
      : '';
  if (!pieceId) return json({ ok: false, error: 'pieceId is required' }, 400);

  const updated = await env.DB
    .prepare(
      `UPDATE keeper_pieces SET current_display_location = ?1
        WHERE piece_id = ?2 AND edition_number = ?3
          AND keeper_user_id = ?4 AND released_at IS NULL`,
    )
    .bind(location || null, pieceId, editionNumber, auth.userId)
    .run();

  if (!updated?.success || (updated.meta?.changes ?? 0) === 0) {
    // No row updated → caller is not the keeper of this piece.
    return json({ ok: false, error: 'not_your_piece' }, 403);
  }
  return json({ ok: true, currentDisplayLocation: location || null });
}
