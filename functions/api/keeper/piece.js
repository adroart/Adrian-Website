/**
 * /api/keeper/piece
 *
 * GET  ?publicCode=AR-...
 *   Tells the signed-in user their relationship to this piece:
 *     { ok: true, kept: boolean, byYou: boolean, contributor: boolean,
 *       currentDisplayLocation?: string, pendingClaim?: {...} }
 *   - kept:  does a governed steward record exist at all (any user)?
 *   - byYou: is the signed-in user the active steward?
 *   currentDisplayLocation is returned only to the piece's own steward.
 *   pendingClaim is returned only to the piece's own steward (byYou), and
 *   only when a thirty-day silence window is currently open against this
 *   piece (functions/api/_lib/claimSilence.js): { openedAt, deadline,
 *   remindersSent }. remindersSent is a count only; nothing about the
 *   claimant is ever included, matching the boundary refuseSilencePass and
 *   the reminder emails already keep. See functions/api/keeper/claim-refusal.js
 *   for the steward's one door to refuse it.
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
import { getUserByAuthId } from '../_lib/db.js';
import {
  isPublicRegistryCode,
  projectPublicCreatorHistory,
} from '../../../utils/publicRegistry.ts';
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

  const user = await getUserByAuthId(env.DB, auth.userId);
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

  if (!row) return json({ ok: true, kept: false, byYou: false, contributor: false });
  if (!hasExactStoredIdentity(row, publicCode)) {
    return json({ ok: false, error: 'identity_integrity_error' }, 409);
  }

  const kept = Boolean(row.keeper_user_id);
  const byYou = kept && !row.released_at && row.keeper_user_id === auth.userId;
  const contributorRow = await env.DB.prepare(
    `SELECT EXISTS (
       SELECT 1
         FROM artwork_contributor_current_access
        WHERE keeper_piece_id = ?1 AND contributor_user_id = ?2
     ) AS is_contributor`,
  ).bind(row.id, auth.userId).first();
  const contributor = !byYou && Number(contributorRow?.is_contributor) === 1;
  let stewardHistory = [];
  // Additive: an open silence window against the steward's own piece, if
  // any. Never affects a guest or non-steward response, and a missing
  // migration 038 silently omits the field rather than failing the whole
  // lookup — the same fail-open-on-absence stance evaluateSilence takes.
  let pendingClaim;
  if (byYou) {
    const historyRows = await env.DB.prepare(
      `SELECT entry_type AS entryType, title, detail, role, occurred_at AS occurredAt
         FROM artwork_provenance_entries
        WHERE keeper_piece_id = ?1 AND visibility = 'steward' AND removed_at IS NULL
        ORDER BY COALESCE(occurred_at, created_at), created_at, id`,
    ).bind(row.id).all();
    stewardHistory = projectPublicCreatorHistory(historyRows?.results || []);

    try {
      const openWindow = await env.DB.prepare(
        `SELECT id, opened_at, deadline_at
           FROM claim_silence_windows
          WHERE keeper_piece_id = ?1 AND status IN ('open', 'reminded')
          ORDER BY opened_at
          LIMIT 1`,
      ).bind(row.id).first();
      if (openWindow) {
        const reminderCount = await env.DB.prepare(
          'SELECT COUNT(*) AS count FROM claim_silence_reminders WHERE window_id = ?1',
        ).bind(openWindow.id).first();
        pendingClaim = {
          openedAt: openWindow.opened_at,
          deadline: openWindow.deadline_at,
          remindersSent: Number(reminderCount?.count ?? 0),
        };
      }
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      // migration 038 not applied yet: pendingClaim simply stays absent.
    }
  }
  return json({
    ok: true,
    kept,
    byYou,
    contributor,
    // Display location is the steward's own data; only surface it to them.
    ...(byYou ? {
      keeperPieceId: row.id,
      currentDisplayLocation: row.current_display_location ?? null,
      stewardHistory,
    } : {}),
    ...(pendingClaim ? { pendingClaim } : {}),
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
