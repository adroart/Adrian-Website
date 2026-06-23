/**
 * POST /api/keeper/bind
 *
 * Body: { recoveryCode: string, pieceId: string, editionNumber?: number }
 *
 * Binds the signed-in user as the keeper of a physical piece. The proof of
 * ownership is the long recovery code printed under a scratch panel on the back
 * of the art (utils/recoveryCode.ts) — distinct from the public QR number,
 * which is look-only. The code is hashed and matched; the plaintext is never
 * stored or logged.
 *
 * REGISTRATION IS THE GATE. A piece row is born when the artist registers it
 * (functions/api/admin/pieces.js), which mints the recovery code, stores ONLY
 * its hash, and leaves keeper_user_id / claimed_at NULL (migration 009). Binding
 * never creates a row: with no registered hash there is nothing to prove
 * possession against. The state machine on a POST is exactly five arms:
 *   1. No row for this piece/edition      → 404 not_registered (register first).
 *   2. Registered, unclaimed, code MATCHES → FIRST BIND: stamp keeper + claimed_at.
 *   3. Registered, unclaimed, code WRONG   → 403 code_mismatch (no leak beyond that).
 *   4. Live keeper bound (released_at NULL)→ idempotent if it is YOU, else the
 *                                            contested-claim handoff (202).
 *   5. Released piece (released_at set)    → re-bindable like case 2: the printed
 *                                            code re-binds the next holder.
 *
 * Returns: { ok: true, keeper: { pieceId, editionNumber, claimedAt } } on a
 * fresh bind; the same shape (idempotent) when the caller is already the keeper.
 * On a CONTESTED bind (the piece already has a living keeper) it does NOT 409:
 * it opens a claim request and returns 202 with { ok: true, status: 'claim_requested', claim }.
 *
 * CONTESTED CLAIMS, the handoff into the patient escalation window:
 * A piece that already has an active keeper no longer hits a dead 409. Instead
 * this opens a pending CLAIM REQUEST that routes (per the existing routing) to
 * the current holder, and the response tells the requester their claim has
 * started, the holder is being notified, and it resolves over a patient window.
 *
 * The escalation + resolve flow is NOT reimplemented here. It lives, merged, on
 * mandalacodes: utils/claimWindow.ts (the 30-day, 4-warning CLAIM_WARNING_DAYS
 * window) and the steward resolve endpoints. The single source of truth for the
 * request is mandalacodes' R2 store atlas/claimRequests.json. This file only
 * CREATES the request there and points the requester at that flow.
 *
 * INTEGRATION SHAPE (decision): shape (1), one shared store, server-to-server.
 * Adrian-Website does not bind the atlas R2 bucket (wrangler.toml: MUSIC_BUCKET
 * + shared D1 only), so it cannot write atlas/claimRequests.json directly; and
 * mandalacodes' user-facing request-claim endpoint authenticates with a
 * per-domain session cookie that cannot be forwarded from here. So the bind
 * step validates the requester's session locally, then makes a machine-auth
 * HMAC call (functions/api/_lib/claimBridge.js, mirroring the M4 sale webhook)
 * to mandalacodes, which appends to the ONE store and runs the existing
 * routing / dedupe / rate-limit / escalation. No claim machinery is forked here.
 *
 * Honored invariants of that flow: a single holder "no" stops the claim cold;
 * only unanswered silence across the FULL window frees the piece to the
 * requester; mere inactivity never frees anything. Those rules live in
 * mandalacodes/utils/claimWindow.ts and run on the mandalacodes side.
 *
 * INVARIANT: nothing written here enters a ledger hash. keeper_pieces is mutable
 * D1; the chain (mandalacodes side) carries only opaque ids + salted
 * commitments. The recovery_code_hash is a SHA-256 hash, never the plaintext.
 *
 * Auth: Better Auth session cookie (requireUser). The email-fallback identity
 * claim that mandalacodes' steward bind allows is NOT used here — binding keys
 * strictly off the verified session userId.
 */

import { requireUser } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';
import {
  legacyEnabled,
  notFound,
  json,
  migrationNotApplied,
  isMissingTableError,
  hashRecoveryCode,
} from '../_lib/keeper.js';
import { requestContestedClaim } from '../_lib/claimBridge.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return migrationNotApplied();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Whitelist discipline: the server decides what reaches D1.
  const recoveryCode = typeof body?.recoveryCode === 'string' ? body.recoveryCode : '';
  const pieceId = typeof body?.pieceId === 'string' ? body.pieceId.trim() : '';
  const editionNumber = Number.isInteger(body?.editionNumber) ? body.editionNumber : 0;
  // Optional evidence note, used ONLY on the contested-claim path ("bought at
  // the Vienna auction, lot 12"). Mutable-store only; never hashed, never
  // required, capped to mandalacodes' CLAIM_REQUEST_NOTE_MAX (500).
  const note =
    typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : undefined;
  if (!recoveryCode || !pieceId) {
    return json({ ok: false, error: 'recoveryCode and pieceId are required' }, 400);
  }

  // Resolve the internal user row (keeper_user_id is the opaque Better Auth id).
  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) {
    // Should be rare — sync-user runs on first sign-in. Surface a clear retry.
    return json({ ok: false, error: 'account_not_synced' }, 409);
  }

  const codeHash = await hashRecoveryCode(recoveryCode);
  const nowIso = new Date().toISOString();

  try {
    // Fetch THE row for this piece/edition. UNIQUE(piece_id, edition_number)
    // guarantees at most one, so we do not filter on released_at here: we want
    // to see a released row too, because a released piece is re-bindable by the
    // next holder of the printed code (case 5 below). registered_at + claimed_at
    // + released_at together tell us which state-machine arm to take.
    const existing = await env.DB
      .prepare(
        `SELECT id, keeper_user_id, recovery_code_hash, claimed_at, released_at
           FROM keeper_pieces
          WHERE piece_id = ?1 AND edition_number = ?2`,
      )
      .bind(pieceId, editionNumber)
      .first();

    // ── Case 1: no row at all ────────────────────────────────────────────────
    // Registration is the gate. A piece must be registered by the admin (which
    // mints + hashes the recovery code) before anyone can claim it. We do NOT
    // silently create a binding here: with no registered hash there is nothing
    // to prove possession against, and an auto-create would let any signed-in
    // user seize an unregistered piece by inventing a code. Reject clearly.
    if (!existing) {
      return json(
        {
          ok: false,
          error: 'not_registered',
          message:
            'This piece is not registered yet. The artist must register it before it can be claimed.',
        },
        404,
      );
    }

    // ── Case 4: a LIVE keeper already holds this piece ───────────────────────
    // keeper_user_id set AND released_at NULL. This is the only arm that routes
    // into the contested-claim handoff. A registered-but-unclaimed row (no
    // keeper) must NOT reach here — that is the bug this rewrite kills.
    if (existing.keeper_user_id && !existing.released_at) {
      // Already bound to THIS user → idempotent success (re-scan / refresh).
      if (existing.keeper_user_id === auth.userId) {
        return json({
          ok: true,
          keeper: { pieceId, editionNumber, claimedAt: existing.claimed_at },
        });
      }
      // Bound to someone else → a CONTESTED claim. We do NOT 409 and we do NOT
      // steal the binding. We open a pending claim request on the shared store
      // (mandalacodes) and hand the requester into the patient escalation
      // window. The current holder is notified; a single "no" stops it cold;
      // only unanswered silence across the full window ever frees the piece;
      // mere inactivity never frees. All of that runs on the mandalacodes side
      // (utils/claimWindow.ts + the steward resolve endpoints) against this one
      // request: we are creating the request, not adjudicating it.
      //
      // The requester's email seeds the eventual steward record on approval so
      // the holder can recognize the buyer. It must come from the verified
      // session, never the request body.
      const requesterEmail = (auth.email || '').trim();
      if (!requesterEmail) {
        return json(
          {
            ok: false,
            error: 'email_required_for_claim',
            message:
              'Your account needs a verified email before you can request a contested piece. Add one and try again.',
          },
          400,
        );
      }

      const bridge = await requestContestedClaim(env, {
        pieceId,
        editionNumber,
        requesterRef: auth.userId,
        requesterEmail,
        note,
      });

      if (!bridge.ok) {
        // The handoff could not be opened. Distinguish "not configured yet"
        // from a transient failure so the requester is not told they were
        // refused when the bridge is simply pending provisioning.
        if (bridge.reason === 'secret_unset') {
          return json(
            {
              ok: false,
              error: 'claim_handoff_unconfigured',
              message:
                'Stewardship transfers are not switched on yet. The current keeper has not been notified. Please try again later.',
            },
            503,
          );
        }
        return json(
          {
            ok: false,
            error: 'claim_handoff_failed',
            message:
              'We could not start your claim just now. The current keeper has not been notified. Please try again shortly.',
          },
          502,
        );
      }

      // 202 Accepted: the claim has STARTED, nothing has bound. The holder is
      // being notified; resolution is patient. status carries the receiver's
      // word: 'opened' on a fresh request, or a friendly no-op reason
      // ('duplicate' when this requester already has an open request for the
      // piece, 'rate_limited', 'self'). All are honest, non-binding outcomes.
      return json(
        {
          ok: true,
          status: 'claim_requested',
          message:
            'This piece already has a keeper, so your claim has begun. The current keeper is being notified and your request resolves over a patient window. A keeper can decline at any time, which ends the claim; only unanswered silence across the full window frees the piece.',
          claim: {
            pieceId,
            editionNumber,
            outcome: bridge.status ?? 'opened',
          },
        },
        202,
      );
    }

    // ── Cases 2, 3, 5: the row is bindable (registered-unclaimed, OR released) ─
    // Reaching here means there is NO live keeper: either the piece was
    // registered and never claimed (keeper_user_id NULL), or it was released
    // (released_at set) and is back in circulation for the next holder. Both
    // resolve the same way: the printed recovery code is the proof. We compare
    // the incoming code's hash to the stored hash and bind on a match.
    //
    // Released pieces (case 5) route through this same unclaimed-and-registered
    // path on purpose: a release puts the piece back to "awaiting its first new
    // keeper", and whoever physically holds it (and thus the printed code) is
    // the legitimate next keeper. We do NOT route a release into the contested
    // path, because there is no live holder to contest. If the artist wanted a
    // fresh code on release, re-registration mints one; the stored hash is
    // whatever currently anchors the piece.
    if (existing.recovery_code_hash !== codeHash) {
      // ── Case 3: code does NOT match ────────────────────────────────────────
      // Reject. We do not reveal whether the piece exists beyond "the code did
      // not match" — same message whether unclaimed or released.
      return json(
        {
          ok: false,
          error: 'code_mismatch',
          message: 'That recovery code did not match. Check the code on the back of the art.',
        },
        403,
      );
    }

    // ── Case 2 (and case 5 on a matching code): FIRST BIND ───────────────────
    // The code matches the registered hash. Stamp this user as the keeper and
    // record claimed_at. UPDATE (not INSERT): the row already exists from
    // registration. We bind only when there is no live keeper, so the WHERE
    // guard (keeper_user_id IS NULL AND released_at NULL, OR released_at set)
    // also defends against a concurrent first-bind racing us. On release we
    // clear released_at so the row is active again under the new keeper.
    const updated = await env.DB
      .prepare(
        `UPDATE keeper_pieces
            SET keeper_user_id = ?1, claimed_at = ?2, released_at = NULL
          WHERE id = ?3
            AND (keeper_user_id IS NULL OR released_at IS NOT NULL)`,
      )
      .bind(auth.userId, nowIso, existing.id)
      .run();

    if (!updated?.success || (updated.meta?.changes ?? 0) === 0) {
      // The guard matched no row → a concurrent bind beat us to this piece.
      // Treat it as contested rather than silently overwriting.
      return json(
        {
          ok: false,
          error: 'bind_conflict',
          message: 'This piece was just claimed by someone else. Reload and try again.',
        },
        409,
      );
    }

    return json({
      ok: true,
      keeper: { pieceId, editionNumber, claimedAt: nowIso },
    });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    // Never leak internals; never log the plaintext code (we never had it past
    // the hash anyway).
    console.error('[keeper/bind] error:', err?.message);
    return json({ ok: false, error: 'bind_failed' }, 500);
  }
}
