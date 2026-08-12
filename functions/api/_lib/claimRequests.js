export const CLAIM_REQUEST_NOTE_MAX = 500;
export const MAX_PENDING_CLAIMS_PER_REQUESTER = 3;

function text(value, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized && normalized.length <= max ? normalized : null;
}

export async function openContestedClaim(env, input) {
  if (!env?.DB) throw new Error('claim_request_db_required');
  const keeperPieceId = text(input?.keeperPieceId, 128);
  const requesterUserId = text(input?.requesterUserId, 128);
  const requesterEmail = text(input?.requesterEmail, 254)?.toLowerCase() || null;
  const expectedKeeperUserId = text(input?.expectedKeeperUserId, 128);
  const openedAt = text(input?.openedAt, 40);
  const noteValue = typeof input?.note === 'string' ? input.note.trim() : '';
  const note = noteValue ? noteValue.slice(0, CLAIM_REQUEST_NOTE_MAX) : null;
  if (!keeperPieceId || !requesterUserId || !requesterEmail
    || !expectedKeeperUserId || !openedAt) {
    throw new Error('invalid_claim_request');
  }
  if (requesterUserId === expectedKeeperUserId) {
    return { ok: false, status: 'self', reason: 'already_current_keeper' };
  }

  const id = `claim-${crypto.randomUUID()}`;
  const inserted = await env.DB.prepare(
    `INSERT INTO artwork_claim_requests
       (id, keeper_piece_id, requester_user_id, requester_email, note,
        routed_to_user_id, status, created_at)
     SELECT ?1, piece.id, ?3, ?4, ?5, piece.keeper_user_id, 'pending', ?7
       FROM keeper_pieces piece
      WHERE piece.id = ?2
        AND piece.keeper_user_id = ?6
        AND piece.claimed_at IS NOT NULL
        AND piece.keeper_user_id <> ?3
        AND NOT EXISTS (
          SELECT 1 FROM artwork_claim_requests prior
           WHERE prior.keeper_piece_id = piece.id
             AND prior.requester_user_id = ?3 AND prior.status = 'pending'
        )
        AND (SELECT COUNT(*) FROM artwork_claim_requests open_by_user
              WHERE open_by_user.requester_user_id = ?3
                AND open_by_user.status = 'pending') < ?8
        AND (SELECT COUNT(*) FROM artwork_claim_requests open_by_email
              WHERE lower(open_by_email.requester_email) = ?4
                AND open_by_email.status = 'pending') < ?8`,
  ).bind(
    id, keeperPieceId, requesterUserId, requesterEmail, note,
    expectedKeeperUserId, openedAt, MAX_PENDING_CLAIMS_PER_REQUESTER,
  ).run();
  if (inserted?.success === true && Number(inserted.meta?.changes) === 1) {
    return { ok: true, status: 'opened', requestId: id };
  }

  const current = await env.DB.prepare(
    `SELECT keeper_user_id, claimed_at FROM keeper_pieces WHERE id = ?1`,
  ).bind(keeperPieceId).first();
  if (!current || current.keeper_user_id !== expectedKeeperUserId || !current.claimed_at) {
    return { ok: false, reason: 'keeper_changed' };
  }
  if (current.keeper_user_id === requesterUserId) {
    return { ok: false, status: 'self', reason: 'already_current_keeper' };
  }
  const duplicate = await env.DB.prepare(
    `SELECT id FROM artwork_claim_requests
      WHERE keeper_piece_id = ?1 AND requester_user_id = ?2 AND status = 'pending'
      LIMIT 1`,
  ).bind(keeperPieceId, requesterUserId).first();
  if (duplicate) return { ok: true, status: 'duplicate', requestId: duplicate.id };
  return { ok: false, status: 'rate_limited', reason: 'rate_limited' };
}
