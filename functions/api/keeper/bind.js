/**
 * POST /api/keeper/bind
 *
 * Body: { publicCode: string, ownershipCode: string, note?: string }
 *
 * Binds the signed-in user as the steward of a physical piece. The proof of
 * ownership is the permanent Ownership Code printed on the underside
 * of the art (utils/recoveryCode.ts), distinct from the public QR number,
 * which is look-only. Its verifier is matched; readable ciphertext is stored
 * online for authorized recovery, while plaintext never enters logs.
 *
 * REGISTRATION IS THE GATE. A piece row is born when the artist registers it
 * (functions/api/admin/pieces.js), which mints the Ownership Code, stores its
 * verifier plus a recoverable encrypted envelope, and leaves keeper_user_id /
 * claimed_at NULL. Binding never creates a row: with no registered verifier there is nothing to prove
 * possession against. The state machine on a POST is exactly five arms:
 *   1. No row for this piece/edition      → 404 not_registered (register first).
 *   2. Ready registry plate or legacy row, unclaimed, code MATCHES
 *                                      → FIRST BIND: stamp steward + claimed_at.
 *   3. Registered, unclaimed, code WRONG   → 403 code_mismatch (no leak beyond that).
 *   4. Live steward bound (released_at NULL)→ idempotent if it is YOU, else the
 *                                            contested-claim handoff (202).
 *   5. Any row ever claimed, even released → governed contested-claim handoff.
 *
 * Returns the legacy compatibility key `keeper` on a fresh bind and the same
 * shape when the caller is already the steward.
 * A CONTESTED bind records a request for manual review when the receiver accepts
 * it. It never changes the current steward or registration in this endpoint.
 *
 * Contested requests live in this registry's canonical D1. They remain pending
 * for human resolution and never change the steward in this endpoint.
 *
 * INVARIANT: nothing written here enters a ledger hash. keeper_pieces is mutable
 * D1; public lineage carries only opaque ids and commitments. recovery_code_hash
 * is the online verifier; plaintext never enters logs.
 *
 * Auth: Better Auth session cookie (requireUser). The email-fallback identity
 * claim that mandalacodes' steward bind allows is NOT used here. Binding keys
 * strictly off the verified session userId.
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
  hashRecoveryCode,
} from '../_lib/keeper.js';
import { openContestedClaim } from '../_lib/claimRequests.js';
import { claimEvidenceStatement } from '../_lib/lineage.js';
import { prepareFirstKeeperBind } from '../_lib/keeperClaim.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const verifiedEmail = typeof auth.email === 'string' ? auth.email.trim() : '';
  if (!verifiedEmail || auth.user?.emailVerified !== true) {
    return json(
      {
        ok: false,
        error: 'verified_email_required',
        message: 'Verify your email before claiming artwork. If you just verified it, sign out and sign in again with the email code.',
      },
      403,
    );
  }

  if (!env.DB) return migrationNotApplied();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Whitelist discipline: publicCode selects one permanent plate identity.
  // Artwork id and edition are always derived from that row, never from the
  // browser. Reject old/forged identity fields so callers cannot mistake them
  // for authoritative inputs.
  if (
    Object.prototype.hasOwnProperty.call(body ?? {}, 'pieceId')
    || Object.prototype.hasOwnProperty.call(body ?? {}, 'editionNumber')
    || Object.prototype.hasOwnProperty.call(body ?? {}, 'recoveryCode')
  ) {
    return json({ ok: false, error: 'identity_fields_forbidden' }, 400);
  }
  const publicCode = typeof body?.publicCode === 'string' ? body.publicCode.trim() : '';
  const ownershipCode = typeof body?.ownershipCode === 'string'
    ? body.ownershipCode
    : '';
  // Optional evidence note, used ONLY on the contested-claim path ("bought at
  // the Vienna auction, lot 12"). Mutable-store only; never hashed, never
  // required, capped to the canonical claim-request limit (500).
  const note =
    typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : undefined;
  if (!isPublicRegistryCode(publicCode) || !ownershipCode) {
    return json({ ok: false, error: 'publicCode and ownershipCode are required' }, 400);
  }

  // Resolve the internal user row (keeper_user_id is the opaque Better Auth id).
  const user = await getUserByAuthId(env.DB, auth.userId);
  if (!user) {
    // Should be rare. sync-user runs on first sign-in. Surface a clear retry.
    return json({ ok: false, error: 'account_not_synced' }, 409);
  }

  const codeHash = await hashRecoveryCode(ownershipCode);
  const nowIso = new Date().toISOString();

  try {
    // Fetch THE row for this permanent public identity. public_code is unique,
    // so we do not filter on released_at here: we want
    // to see released rows too: claimed_at is the permanent signal that the
    // piece remains in the governed claim path.
    const existing = await env.DB
      .prepare(
        `SELECT id, piece_id, edition_number, keeper_user_id,
                recovery_code_hash, claimed_at, released_at, public_code,
                plate_status, backup_status, backup_reference, backup_sha256,
                ownership_code_key_version, registration_status,
                identity_backup_status, identity_backup_reference,
                identity_backup_sha256
           FROM keeper_pieces
          WHERE public_code = ?1`,
      )
      .bind(publicCode)
      .first();

    // ── Case 1: no row at all ────────────────────────────────────────────────
    // Registration is the gate. A piece must be registered by the admin (which
    // mints and protects the Ownership Code) before anyone can claim it. We do NOT
    // silently create a binding here: with no registered verifier there is nothing
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

    if (
      existing.public_code !== publicCode
      || typeof existing.piece_id !== 'string'
      || !existing.piece_id
      || !Number.isSafeInteger(existing.edition_number)
      || existing.edition_number < 0
    ) {
      return json({ ok: false, error: 'identity_integrity_error' }, 409);
    }
    const pieceId = existing.piece_id;
    const editionNumber = existing.edition_number;

    // Possession of the exact permanent Ownership Code is required before any
    // direct bind or governed claim. A guessed code cannot create claim traffic.
    if (existing.recovery_code_hash !== codeHash) {
      return json(
        {
          ok: false,
          error: 'code_mismatch',
          message: 'That Ownership Code did not match. Check the code on the underside of the art.',
        },
        403,
      );
    }

    // A current steward's re-scan is idempotent.
    if (existing.keeper_user_id === auth.userId && !existing.released_at) {
      return json({
        ok: true,
        keeper: { pieceId, editionNumber, claimedAt: existing.claimed_at },
      });
    }

    // Any row that has ever been claimed remains governed forever. Release
    // does not turn the permanent Ownership Code back into a bearer instrument.
    if (existing.claimed_at || existing.keeper_user_id) {
      // Bound to someone else → a CONTESTED claim. We do not steal the binding.
      // The receiver decides whether a request was opened, already existed, or
      // was stopped by a guardrail. This endpoint reports that result without
      // changing the current steward or registration.
      //
      // The requester's email seeds the eventual steward record on approval so
      // the holder can recognize the buyer. It must come from the verified
      // session, never the request body.
      const requesterEmail = verifiedEmail;

      await claimEvidenceStatement(env, {
        keeperPieceId: existing.id,
        actorUserId: auth.userId,
        verifiedEmail,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        outcome: 'contested_attempt',
        createdAt: nowIso,
        dedupeWithinSeconds: 15 * 60,
      }).run();

      const claim = await openContestedClaim(env, {
        keeperPieceId: existing.id,
        requesterUserId: auth.userId,
        requesterEmail,
        note,
        expectedKeeperUserId: existing.keeper_user_id,
        openedAt: nowIso,
      });

      if (claim.status === 'opened') {
        return json(
          {
            ok: true,
            status: 'claim_requested',
            message: 'Your stewardship request is recorded for manual review. The current steward and registration remain unchanged.',
            claim: { pieceId, editionNumber, outcome: 'opened' },
          },
          202,
        );
      }
      if (claim.status === 'duplicate') {
        return json(
          {
            ok: true,
            status: 'claim_requested',
            message: 'An existing stewardship request is already recorded for manual review. The current steward and registration remain unchanged.',
            claim: { pieceId, editionNumber, outcome: 'duplicate' },
          },
          202,
        );
      }
      if (claim.status === 'rate_limited') {
        return json(
          {
            ok: false,
            error: 'claim_rate_limited',
            message: 'No new request was recorded. Please wait before trying again.',
          },
          429,
        );
      }
      if (claim.status === 'self') {
        return json(
          {
            ok: false,
            error: 'already_current_steward',
            message: 'You are already the current steward for this piece. No request was recorded.',
          },
          409,
        );
      }

      return json({
        ok: false,
        error: 'bind_conflict',
        message: 'This piece changed steward while your request was being recorded. Reload and try again.',
      }, 409);
    }

    // ── Case 2: FIRST BIND ──────────────────────────────────────────────────
    // Only a never-claimed row reaches here. Stamp this user as the steward,
    // record first-bound lineage, and retain private claim evidence atomically.
    if (typeof env.DB.batch !== 'function') {
      return json({ ok: false, error: 'atomic_write_unavailable' }, 503);
    }
    let prepared;
    try {
      prepared = await prepareFirstKeeperBind(env, {
        piece: existing,
        claimant: { userId: auth.userId, verifiedEmail },
        proof: { kind: 'ownership_code', reference: ownershipCode },
        evidence: {
          ipAddress: request.headers.get('CF-Connecting-IP'),
          userAgent: request.headers.get('User-Agent'),
        },
        boundAt: nowIso,
      });
    } catch (error) {
      if (error?.code === 'plate_not_ready') {
        return json({
          ok: false,
          error: 'plate_not_ready',
          message: 'This artwork plate is not active with a verified backup yet.',
        }, 409);
      }
      if (error?.code === 'plate_recovery_not_qualified') {
        return json({
          ok: false,
          error: 'plate_recovery_not_qualified',
          message: 'This artwork is temporarily unavailable while its recovery proof is renewed.',
        }, 409);
      }
      if (error?.code === 'identity_not_ready'
        || error?.code === 'identity_recovery_not_qualified') {
        return json({
          ok: false,
          error: 'identity_recovery_not_qualified',
          message: 'This artwork is temporarily unavailable while its identity recovery proof is renewed.',
        }, 409);
      }
      throw error;
    }
    const [updated] = await env.DB.batch(prepared.statements);

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

    return json({ ok: true, ...prepared.result });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    // Never leak internals; never log the plaintext code (we never had it past
    // the hash anyway).
    console.error('[keeper/bind] error:', err?.message);
    return json({ ok: false, error: 'bind_failed' }, 500);
  }
}
