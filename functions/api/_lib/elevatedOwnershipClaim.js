import { commitMaintenanceMutation } from './registryMaintenance.js';
import { claimEvidenceStatement, prepareNextLineageEvent } from './lineage.js';
import { syncTransferCollectorLetters } from './collectorLetters.js';
import { refreshPieceRecord } from './pieceRecordRefresh.js';
import { legacyEnabled } from './keeper.js';

async function sha(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Prove that the current acquisition did not use the Ownership Code.  The
 * holder and acquisition timestamp must match the immutable source record;
 * older invitations and transfers cannot classify a later custody period.
 */
export async function currentNonCodeCustodyProof(db, piece) {
  if (!piece?.id || !piece.keeper_user_id || !piece.claimed_at) return null;
  try {
    const proof = await db.prepare(
      `SELECT CASE
         WHEN EXISTS (
           SELECT 1 FROM artwork_invitation_redemptions redemption
            WHERE redemption.keeper_piece_id = ?1
              AND redemption.redeemed_by_user_id = ?2
              AND redemption.redeemed_at = ?3
         ) THEN 'invitation'
         WHEN EXISTS (
           SELECT 1
             FROM artwork_transfer_receipts receipt
             JOIN artwork_transfer_intents intent ON intent.id = receipt.transfer_intent_id
             JOIN registry_maintenance_events event ON event.id = intent.maintenance_event_id
            WHERE intent.keeper_piece_id = ?1
              AND intent.target_user_id = ?2
              AND intent.created_at = ?3
              AND receipt.committed_at = intent.created_at
              -- These governed gateways themselves consume true-code proof.
              -- A receipt is not automatically a non-code acquisition.
              AND event.idempotency_key NOT LIKE 'elevated-code:%'
              AND event.idempotency_key NOT LIKE 'silence-pass:%'
         ) THEN 'governed_transfer'
         ELSE NULL
       END AS proof_kind`,
    ).bind(piece.id, piece.keeper_user_id, piece.claimed_at).first();
    return proof?.proof_kind || null;
  } catch {
    // Older or partially deployed schemas fail closed into the contested path.
    return null;
  }
}

export async function elevateOwnershipCodeClaim(env, {
  piece, claimant, evidence = {}, claimedAt,
}) {
  const proofKind = await currentNonCodeCustodyProof(env.DB, piece);
  if (!proofKind) return { ok: false, error: 'not_non_code_custody' };
  if (!env?.DB?.batch) return { ok: false, error: 'atomic_write_unavailable' };

  const commitment = await sha(
    `adrian-website:elevated-code-claim:v1\n${piece.id}\n${claimant.verifiedEmail}`,
  );
  const stableKey = await sha(
    `elevated-code-claim:v1\n${piece.id}\n${piece.keeper_user_id}\n${piece.steward_version}\n${claimant.userId}`,
  );
  const intentId = `transfer-${crypto.randomUUID()}`;
  const eventId = `rme-${crypto.randomUUID()}`;
  const fromRef = `tp-${crypto.randomUUID()}`;
  const toRef = `tp-${crypto.randomUUID()}`;
  const lineage = await prepareNextLineageEvent(env, {
    keeperPieceId: piece.id,
    eventType: 'transferred',
    eventAt: claimedAt,
    publicPayload: { fromRef, toRef, transferKind: 'artist-rebind' },
    onlyIfPreviousChanged: true,
  });
  const before = {
    keeperPieceId: piece.id, artworkId: piece.piece_id,
    keeperUserId: piece.keeper_user_id, claimedAt: piece.claimed_at,
    releasedAt: piece.released_at, currentDisplayLocation: piece.current_display_location,
    stewardVersion: piece.steward_version,
  };
  const after = {
    ...before, keeperUserId: claimant.userId, claimedAt, releasedAt: null,
    currentDisplayLocation: null, stewardVersion: piece.steward_version + 1,
  };
  const intent = env.DB.prepare(
    `INSERT INTO artwork_transfer_intents
       (id, keeper_piece_id, expected_from_user_id, target_user_id, target_email_commitment,
        expected_steward_version, expected_lineage_count, expected_lineage_hash, transfer_kind,
        maintenance_event_id, lineage_event_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'artist-rebind', ?9, ?10, ?11)`,
  ).bind(intentId, piece.id, piece.keeper_user_id, claimant.userId, commitment,
    piece.steward_version, piece.lineage_event_count, piece.lineage_head_hash,
    eventId, lineage.event.id, claimedAt);
  const party = (role, userId, publicRef) => env.DB.prepare(
    `INSERT INTO artwork_transfer_parties
       (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(`party-${crypto.randomUUID()}`, intentId, role, userId, publicRef, claimedAt);
  const privateProof = claimEvidenceStatement(env, {
    keeperPieceId: piece.id,
    actorUserId: claimant.userId,
    verifiedEmail: claimant.verifiedEmail,
    ipAddress: evidence.ipAddress,
    userAgent: evidence.userAgent,
    outcome: 'elevated_code_claim',
    createdAt: claimedAt,
  });
  const resolveClaims = env.DB.prepare(
    `UPDATE artwork_claim_requests
        SET status = 'declined', resolved_at = ?2, resolved_by_user_id = ?3
      WHERE keeper_piece_id = ?1 AND status = 'pending'`,
  ).bind(piece.id, claimedAt, claimant.userId);
  const supersedeWindows = env.DB.prepare(
    `UPDATE claim_silence_windows SET status = 'superseded'
      WHERE keeper_piece_id = ?1 AND status IN ('open', 'reminded')`,
  ).bind(piece.id);
  const receipt = env.DB.prepare(
    `INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
     VALUES (?1, ?2, ?3)`,
  ).bind(`receipt-${crypto.randomUUID()}`, intentId, claimedAt);

  const result = await commitMaintenanceMutation(env, {
    target: { type: 'keeper_steward', id: piece.id, artworkId: piece.piece_id },
    changes: {
      keeperUserId: claimant.userId, claimedAt, releasedAt: null,
      currentDisplayLocation: null,
    },
    event: {
      id: eventId, idempotencyKey: `elevated-code:${stableKey}`,
      eventType: 'steward_transferred', keeperPieceId: piece.id, artworkId: piece.piece_id,
      authorization: { userId: claimant.userId, email: claimant.verifiedEmail },
      reason: 'Elevated true Ownership Code claim over custody acquired without that code.',
      before, after, outcome: 'succeeded', relatedRecordId: piece.id, createdAt: claimedAt,
    },
    expectedVersion: piece.steward_version,
    // The maintenance event's structural guard consumes changes() from the
    // immediately preceding statement. Keep the append-only proof last: it
    // must insert exactly once or the event and receipt cannot commit.
    beforeStatements: [resolveClaims, supersedeWindows, intent,
      party('from', piece.keeper_user_id, fromRef),
      party('to', claimant.userId, toRef), privateProof],
    afterStatements: [lineage.statement],
    gatewayStatement: receipt,
  });
  if (!result.ok) {
    const current = await env.DB.prepare(
      'SELECT keeper_user_id, claimed_at FROM keeper_pieces WHERE id = ?1',
    ).bind(piece.id).first();
    if (current?.keeper_user_id === claimant.userId) {
      return { ok: true, replayed: true, claimedAt: current.claimed_at };
    }
    return result;
  }
  await syncTransferCollectorLetters(env, { transferIntentId: intentId }).catch(() => {});
  await refreshPieceRecord(env, {
    publicCode: piece.public_code, trigger: 'transfer', generatedAt: claimedAt,
    includeLegacySections: legacyEnabled(),
  }).catch(() => {});
  return { ok: true, replayed: result.replayed, claimedAt };
}
