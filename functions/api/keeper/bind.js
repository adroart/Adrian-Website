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
 * Returns: { ok: true, keeper: { pieceId, editionNumber, claimedAt } } on a
 * fresh bind; the same shape (idempotent) when the caller is already the keeper.
 *
 * SCOPE (Phase 1 slice): first-bind-on-an-empty-piece only. The full
 * multi-warning CLAIM-BLOCK window for contested claims (resale/inheritance,
 * Decision B) is being built SEPARATELY in mandalacodes — see
 * `mandalacodes/utils/claimWindow.ts` (the patient 30-day, 4-warning window).
 * Here, a piece that already has an active keeper rejects with 409; it does NOT
 * silently steal the binding.
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
  genKeeperPieceId,
} from '../_lib/keeper.js';

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
    // Is there already an ACTIVE binding for this piece/edition?
    const existing = await env.DB
      .prepare(
        `SELECT id, keeper_user_id, recovery_code_hash, claimed_at
           FROM keeper_pieces
          WHERE piece_id = ?1 AND edition_number = ?2 AND released_at IS NULL`,
      )
      .bind(pieceId, editionNumber)
      .first();

    if (existing) {
      // Already bound to THIS user → idempotent success (re-scan / refresh).
      if (existing.keeper_user_id === auth.userId) {
        return json({
          ok: true,
          keeper: { pieceId, editionNumber, claimedAt: existing.claimed_at },
        });
      }
      // Bound to someone else. This Phase-1 slice does NOT contest — the
      // patient claim-block window lives in mandalacodes/utils/claimWindow.ts.
      return json(
        {
          ok: false,
          error: 'piece_already_kept',
          message:
            'This piece already has a keeper. A transfer of stewardship runs through a separate, patient process.',
        },
        409,
      );
    }

    // The recovery code must match the one the artist registered for this piece.
    // The registry's recoveryCodeHash is the artist-side anchor; a real
    // deployment may also seed this hash at sale time. We compare against the
    // hash carried on the request (already SHA-256'd) — the plaintext never
    // touches D1. The UNIQUE(recovery_code_hash) constraint additionally stops
    // the same code binding two different pieces.
    const id = genKeeperPieceId();
    let inserted;
    try {
      inserted = await env.DB
        .prepare(
          `INSERT INTO keeper_pieces
             (id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(id, pieceId, editionNumber, auth.userId, codeHash, nowIso)
        .run();
    } catch (insErr) {
      // UNIQUE violation: either the piece got bound concurrently, or this
      // exact recovery code is already in use for another piece.
      if (/unique/i.test(String(insErr?.message))) {
        return json(
          { ok: false, error: 'bind_conflict', message: 'This piece or code is already bound.' },
          409,
        );
      }
      throw insErr;
    }

    if (!inserted?.success) {
      return json({ ok: false, error: 'bind_failed' }, 500);
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
