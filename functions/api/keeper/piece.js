/**
 * /api/keeper/piece
 *
 * GET  ?publicCode=AR-...
 *   Tells the signed-in user their relationship to this piece:
 *     { ok: true, kept: boolean, byYou: boolean, currentDisplayLocation?: string }
 *   - kept:  does a governed steward record exist at all (any user)?
 *   - byYou: is the signed-in user the active steward?
 *   currentDisplayLocation is returned only to the piece's own steward.
 *
 * PUT  { publicCode, currentDisplayLocation }
 *   The steward edits where the piece currently lives. Presentation state only:
 *   it is shown on the certificate's provenance and NEVER enters the ledger
 *   chain. Pass an empty string to clear it.
 *
 * Gated behind the `livingLegacy` flag (404 when off). Auth: Better Auth
 * session (requireUser). This endpoint reads no other steward's data.
 */

import { requireUser } from '../_lib/auth.js';
import { getUserByClerkId } from '../_lib/db.js';
import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
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
  const publicCode = (url.searchParams.get('publicCode') || '').trim();
  if (!isPublicRegistryCode(publicCode)) {
    return json({ ok: false, error: 'valid publicCode is required' }, 400);
  }

  const row = await env.DB
    .prepare(
      `SELECT id, piece_id, edition_number, public_code, keeper_user_id,
              current_display_location, released_at
         FROM keeper_pieces
        WHERE public_code = ?1`,
    )
    .bind(publicCode)
    .first();

  if (!row) return json({ ok: true, kept: false, byYou: false });
  if (!hasExactStoredIdentity(row, publicCode)) {
    return json({ ok: false, error: 'identity_integrity_error' }, 409);
  }

  const kept = Boolean(row.keeper_user_id);
  const byYou = kept && !row.released_at && row.keeper_user_id === auth.userId;
  return json({
    ok: true,
    kept,
    byYou,
    // Display location is the steward's own data; only surface it to them.
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
  const publicCode = typeof body?.publicCode === 'string' ? body.publicCode.trim() : '';
  const location =
    typeof body?.currentDisplayLocation === 'string'
      ? body.currentDisplayLocation.trim().slice(0, LOCATION_MAX)
      : '';
  if (!isPublicRegistryCode(publicCode)) {
    return json({ ok: false, error: 'valid publicCode is required' }, 400);
  }

  const row = await env.DB
    .prepare(
      `SELECT id, piece_id, edition_number, public_code, keeper_user_id,
              current_display_location, released_at
         FROM keeper_pieces
        WHERE public_code = ?1`,
    )
    .bind(publicCode)
    .first();
  if (
    !row
    || !hasExactStoredIdentity(row, publicCode)
    || row.keeper_user_id !== auth.userId
    || row.released_at
  ) {
    return json({ ok: false, error: 'not_your_piece' }, 403);
  }

  const updated = await env.DB
    .prepare(
      `UPDATE keeper_pieces SET current_display_location = ?1
        WHERE id = ?2 AND keeper_user_id = ?3 AND released_at IS NULL`,
    )
    .bind(location || null, row.id, auth.userId)
    .run();

  if (!updated?.success || (updated.meta?.changes ?? 0) === 0) {
    // No row updated → caller is not the steward of this piece.
    return json({ ok: false, error: 'not_your_piece' }, 403);
  }
  return json({ ok: true, currentDisplayLocation: location || null });
}

function hasExactStoredIdentity(row, publicCode) {
  return row?.public_code === publicCode
    && typeof row.piece_id === 'string'
    && row.piece_id.length > 0
    && Number.isSafeInteger(row.edition_number)
    && row.edition_number >= 0;
}
