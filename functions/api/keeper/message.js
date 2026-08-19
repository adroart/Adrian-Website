/**
 * /api/keeper/message
 *
 * GET ?publicCode=AR-...
 *   The artist's sealed message for one physical piece (migration 039,
 *   functions/api/_lib/artistMessage.js). Steward-only: the body NEVER
 *   appears in any response to anyone but the piece's active steward. The
 *   design moment (todo/plans/collector-screen-wording.md, the gift
 *   mechanic): "Something was left for you," met right after the vault
 *   opens, before everything else.
 *
 *   The first time the steward reaches this endpoint after the message was
 *   written, the message is revealed here (revealed_at is stamped, once,
 *   forever, by functions/api/_lib/artistMessage.js#revealForKeeper); every
 *   call after that answers the same body with firstReveal:false.
 *
 *   { ok: true, message: { body, sealedAt, revealedAt, firstReveal } }
 *   { ok: true, message: null }   -- no active message exists for this piece
 *
 * Gated behind the `livingLegacy` flag (404 when off), mirroring
 * functions/api/keeper/piece.js's guards: a verified-email Better Auth
 * session, then a steward-of-this-piece check, before any content is read.
 * A piece that is unclaimed, claimed by someone else, or released all
 * answer the same 404 as a piece that does not exist — this endpoint never
 * confirms or denies a piece's steward to anyone but the steward.
 */

import { requireUser } from '../_lib/auth.js';
import { getUserByAuthId } from '../_lib/db.js';
import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
import { readForArtist, revealForKeeper } from '../_lib/artistMessage.js';
import {
  legacyEnabled,
  notFound,
  json,
  migrationNotApplied,
  isMissingTableError,
} from '../_lib/keeper.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user?.emailVerified !== true) {
    return json({ ok: false, error: 'verified_email_required' }, 403);
  }
  if (!env.DB) return migrationNotApplied();

  const user = await getUserByAuthId(env.DB, auth.userId);
  if (!user) return json({ ok: false, error: 'account_not_synced' }, 409);

  try {
    if (request.method === 'GET') return handleGet(context, auth);
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    console.error('[keeper/message] error:', err?.message);
    return json({ ok: false, error: 'keeper_message_failed' }, 500);
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
      `SELECT id, piece_id, edition_number, public_code, keeper_user_id, released_at
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
    // Steward only. No distinction is drawn between "no such piece", "not
    // yours", and "released" — the body's very existence is never confirmed
    // to anyone but the steward who may read it.
    return notFound();
  }

  // Read the current state BEFORE stamping the reveal, so firstReveal
  // reflects whether THIS call is the one that met the message.
  const before = await readForArtist(env.DB, row.id);
  if (!before) return json({ ok: true, message: null });

  const firstReveal = before.revealedAt === null;
  const revealed = await revealForKeeper(env.DB, row.id, new Date().toISOString());
  if (!revealed) return json({ ok: true, message: null });

  return json({
    ok: true,
    message: {
      body: revealed.body,
      sealedAt: revealed.createdAt,
      revealedAt: revealed.revealedAt,
      firstReveal,
    },
  });
}

function hasExactStoredIdentity(row, publicCode) {
  return row?.public_code === publicCode
    && typeof row.piece_id === 'string'
    && row.piece_id.length > 0
    && Number.isSafeInteger(row.edition_number)
    && row.edition_number >= 0;
}
