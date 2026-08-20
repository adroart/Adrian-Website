/**
 * POST /api/keeper/claim-refusal
 *
 * Body: { publicCode: string, note?: string }
 *
 * The registered steward's one HTTP door to refuse an open thirty-day
 * silence-pass window (functions/api/_lib/claimSilence.js#refuseSilencePass).
 * Refusing marks the open window 'refused', declines the pending claim, and
 * raises a 'claim_refusal_review' event on Adrian's maintenance desk (017's
 * table) for human review — the only genuinely human case in the passing
 * design (todo/plans/collector-screen-wording.md, "The passing confirmation").
 * Everything else the engine does (reminders, the withdrawal on the
 * steward's own touch, the eventual pass) happens without a human in the
 * loop; a refusal is the one branch that must reach Adrian.
 *
 * State machine on a POST:
 *   1. No row for this publicCode                 -> 404 not_registered
 *   2. Row exists, caller is NOT the piece's
 *      current live steward (unclaimed, claimed by
 *      someone else, or released)                 -> 403 not_steward
 *   3. Caller IS the steward, no open/reminded
 *      silence window against this piece          -> 404 no_open_claim
 *   4. Caller IS the steward, an open window
 *      exists                                      -> 200 { ok: true, refused }
 *
 * Idempotent: refuseSilencePass only touches windows still in ('open',
 * 'reminded'), so a repeat call after a successful refusal finds nothing
 * left to refuse and answers 404 no_open_claim, matching case 3 rather than
 * re-raising a second maintenance event.
 *
 * Never leaks claimant identity: the response carries only the piece's own
 * publicCode and a window count, nothing about who claimed it — the same
 * boundary the reminder emails (claimSilence.js#reminderEmail) already keep,
 * which never name the claimant to the steward either.
 *
 * Gated behind the same `livingLegacy` flag as every other keeper/* endpoint
 * (functions/api/_lib/keeper.js#legacyEnabled). The silence engine has no
 * caller today outside that surface — keeper/bind.js, its only trigger, sits
 * behind the identical gate — so there is no case where this endpoint needs
 * to be reachable while the flag is off. Auth: Better Auth session cookie
 * (requireUser), verified email required to match the other mutating keeper
 * endpoints (bind, piece).
 */

import { requireUser } from '../_lib/auth.js';
import { getUserByAuthId } from '../_lib/db.js';
import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
import {
  legacyEnabled,
  notFound,
  json,
  migrationNotApplied,
  isMissingTableError,
} from '../_lib/keeper.js';
import { refuseSilencePass } from '../_lib/claimSilence.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user?.emailVerified !== true) {
    return json({ ok: false, error: 'verified_email_required' }, 403);
  }
  if (!env.DB) return migrationNotApplied();

  const user = await getUserByAuthId(env.DB, auth.userId);
  if (!user) return json({ ok: false, error: 'account_not_synced' }, 409);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const publicCode = typeof body?.publicCode === 'string' ? body.publicCode.trim() : '';
  const note = typeof body?.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, 500)
    : undefined;
  if (!isPublicRegistryCode(publicCode)) {
    return json({ ok: false, error: 'valid publicCode is required' }, 400);
  }

  const nowIso = new Date().toISOString();

  try {
    // Confirmed separately from refuseSilencePass's own lookup so a missing
    // piece (404 not_registered) and "no open claim against your piece"
    // (404 no_open_claim) stay distinguishable to the caller: unlike
    // keeper/message's deliberate blur (which protects a claimant's privacy
    // by never confirming a piece has a steward at all), a steward refusing
    // a claim already knows which piece they hold, so there is no identity
    // left to protect by merging these two cases.
    const row = await env.DB.prepare(
      'SELECT id FROM keeper_pieces WHERE public_code = ?1',
    ).bind(publicCode).first();
    if (!row) {
      return json({ ok: false, error: 'not_registered' }, 404);
    }

    const result = await refuseSilencePass(env.DB, env, {
      publicCode,
      stewardUserId: auth.userId,
      note,
    }, nowIso);

    if (result.status === 'unavailable') return migrationNotApplied();
    if (result.status === 'not_steward') {
      return json({ ok: false, error: 'not_steward' }, 403);
    }
    if (result.status === 'none') {
      return json({ ok: false, error: 'no_open_claim' }, 404);
    }
    // result.status === 'refused'
    return json({
      ok: true,
      refused: { publicCode, windows: result.windows, refusedAt: nowIso },
    });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    console.error('[keeper/claim-refusal] error:', err?.message);
    return json({ ok: false, error: 'claim_refusal_failed' }, 500);
  }
}
