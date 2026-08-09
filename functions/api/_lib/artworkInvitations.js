import { prepareFirstKeeperBind } from './keeperClaim.js';
import { resolveArtwork } from './artworkCatalog.js';

function invitationError(code) {
  const error = new Error(code);
  error.code = code;
  error.isInvitationError = true;
  return error;
}

function normalizedEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    email.length < 3
    || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) throw invitationError('invalid_recipient_email');
  return email;
}

function requiredText(value, code, maximum = 128) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maximum) throw invitationError(code);
  return text;
}

function isoInstant(value, code) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw invitationError(code);
  }
  return value;
}

function bytesToBase64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createToken() {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function invitationStatus(row, at) {
  if (row.redeemed_at) return 'used';
  if (row.revoked_at) return 'revoked';
  if (Date.parse(row.expires_at) <= Date.parse(at)) return 'expired';
  return 'available';
}

function publicArtwork(row) {
  return {
    artworkId: row.piece_id,
    title: row.artwork_title,
    publicCode: row.public_code,
    edition: row.edition_number === 0
      ? { kind: 'unique' }
      : {
          kind: 'numbered',
          number: row.edition_number,
          size: Number.isSafeInteger(row.artwork_edition_size)
            ? row.artwork_edition_size
            : null,
        },
  };
}

async function invitationByToken(env, token) {
  const presented = requiredText(token, 'invitation_not_found', 512);
  const tokenHash = await sha256Hex(presented);
  const row = await env.DB.prepare(
    `SELECT invitation.id, invitation.keeper_piece_id, invitation.token_hash,
            invitation.intended_recipient_email, invitation.expires_at,
            invitation.revoked_at, redemption.redeemed_at,
            piece.piece_id, piece.edition_number, piece.public_code,
            piece.keeper_user_id, piece.claimed_at, piece.released_at,
            piece.recovery_code_hash, piece.plate_status, piece.backup_status,
            piece.backup_reference, piece.backup_sha256,
            piece.ownership_code_key_version, piece.registration_status,
            piece.identity_backup_status, piece.identity_backup_reference,
            piece.identity_backup_sha256
       FROM artwork_invitations invitation
       JOIN keeper_pieces piece ON piece.id = invitation.keeper_piece_id
       LEFT JOIN artwork_invitation_redemptions redemption
         ON redemption.invitation_id = invitation.id
      WHERE invitation.token_hash = ?1`,
  ).bind(tokenHash).first();
  if (!row) throw invitationError('invitation_not_found');
  const artwork = await resolveArtwork(env, row.piece_id);
  if (!artwork) throw invitationError('invitation_not_found');
  return {
    row: {
      ...row,
      artwork_title: artwork.title,
      artwork_edition_size: artwork.editionSize,
    },
    tokenHash,
  };
}

export async function createArtworkInvitation(env, {
  keeperPieceId,
  intendedRecipientEmail,
  createdBy,
  expiresAt,
  idempotencyKey,
  createdAt = new Date().toISOString(),
}) {
  if (!env?.DB) throw invitationError('db_not_configured');
  const pieceId = requiredText(keeperPieceId, 'invalid_invitation');
  const recipientEmail = normalizedEmail(intendedRecipientEmail);
  const administratorId = requiredText(createdBy, 'invalid_creator');
  const key = requiredText(idempotencyKey, 'idempotency_key_required');
  const created = isoInstant(createdAt, 'invalid_created_at');
  const expires = isoInstant(expiresAt, 'invalid_expiry');
  if (Date.parse(expires) <= Date.parse(created)) throw invitationError('invalid_expiry');

  const replay = await env.DB.prepare(
    'SELECT id FROM artwork_invitations WHERE idempotency_key = ?1',
  ).bind(key).first();
  if (replay) throw invitationError('invitation_already_created');

  const piece = await env.DB.prepare(
    `SELECT id, keeper_user_id, claimed_at, released_at, registration_status
       FROM keeper_pieces WHERE id = ?1`,
  ).bind(pieceId).first();
  if (!piece) throw invitationError('piece_not_found');
  if (piece.registration_status !== 'registered') throw invitationError('piece_not_registered');
  if (piece.keeper_user_id || piece.claimed_at || piece.released_at) {
    throw invitationError('piece_already_held');
  }

  const token = createToken();
  const tokenHash = await sha256Hex(token);
  const invitationId = `iv-${crypto.randomUUID()}`;
  try {
    await env.DB.prepare(
      `INSERT INTO artwork_invitations
         (id, keeper_piece_id, token_hash, intended_recipient_email,
          created_by_user_id, idempotency_key, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      invitationId,
      pieceId,
      tokenHash,
      recipientEmail,
      administratorId,
      key,
      created,
      expires,
    ).run();
  } catch (error) {
    const raced = await env.DB.prepare(
      'SELECT id FROM artwork_invitations WHERE idempotency_key = ?1',
    ).bind(key).first();
    if (raced) throw invitationError('invitation_already_created');
    throw error;
  }
  return { invitationId, token };
}

export async function inspectArtworkInvitation(
  env,
  token,
  inspectedAt = new Date().toISOString(),
) {
  if (!env?.DB) throw invitationError('db_not_configured');
  const at = isoInstant(inspectedAt, 'invalid_inspection_time');
  const { row } = await invitationByToken(env, token);
  return {
    invitationId: row.id,
    artwork: publicArtwork(row),
    status: invitationStatus(row, at),
  };
}

export async function listArtworkInvitations(env, now = new Date().toISOString()) {
  if (!env?.DB) throw invitationError('db_not_configured');
  const at = isoInstant(now, 'invalid_inspection_time');
  const { results = [] } = await env.DB.prepare(
    `SELECT invitation.id, invitation.keeper_piece_id,
            invitation.intended_recipient_email, invitation.created_at,
            invitation.expires_at, invitation.revoked_at, redemption.redeemed_at,
            piece.piece_id, piece.edition_number, piece.public_code
       FROM artwork_invitations invitation
       JOIN keeper_pieces piece ON piece.id = invitation.keeper_piece_id
       LEFT JOIN artwork_invitation_redemptions redemption
         ON redemption.invitation_id = invitation.id
      ORDER BY invitation.created_at DESC, invitation.id DESC`,
  ).all();
  return Promise.all(results.map(async (row) => {
    const artwork = await resolveArtwork(env, row.piece_id);
    if (!artwork) throw invitationError('invitation_artwork_missing');
    return {
      invitationId: row.id,
      keeperPieceId: row.keeper_piece_id,
      intendedRecipientEmail: row.intended_recipient_email,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: invitationStatus(row, at),
      artwork: publicArtwork({
        ...row,
        artwork_title: artwork.title,
        artwork_edition_size: artwork.editionSize,
      }),
    };
  }));
}

export async function revokeArtworkInvitation(env, {
  invitationId,
  revokedBy,
  revokedAt = new Date().toISOString(),
}) {
  if (!env?.DB) throw invitationError('db_not_configured');
  const id = requiredText(invitationId, 'invitation_not_found');
  const administratorId = requiredText(revokedBy, 'invalid_creator');
  const at = isoInstant(revokedAt, 'invalid_revoked_at');
  const current = await env.DB.prepare(
    `SELECT invitation.id, invitation.revoked_at, invitation.expires_at,
            redemption.redeemed_at
       FROM artwork_invitations invitation
       LEFT JOIN artwork_invitation_redemptions redemption
         ON redemption.invitation_id = invitation.id
      WHERE invitation.id = ?1`,
  ).bind(id).first();
  if (!current) throw invitationError('invitation_not_found');
  const status = invitationStatus(current, at);
  if (status !== 'available') throw invitationError(`invitation_${status}`);
  const outcome = await env.DB.prepare(
    `UPDATE artwork_invitations
        SET revoked_at = ?1, revoked_by_user_id = ?2
      WHERE id = ?3 AND revoked_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM artwork_invitation_redemptions redemption
           WHERE redemption.invitation_id = artwork_invitations.id
        )`,
  ).bind(at, administratorId, id).run();
  if ((outcome?.meta?.changes ?? 0) !== 1) throw invitationError('invitation_unavailable');
  return { invitationId: id, status: 'revoked' };
}

export async function redeemArtworkInvitation(env, {
  token,
  claimant,
  evidence = {},
  redeemedAt,
}) {
  if (!env?.DB) throw invitationError('db_not_configured');
  if (typeof env.DB.batch !== 'function') throw invitationError('atomic_write_unavailable');
  const at = isoInstant(redeemedAt, 'invalid_redeemed_at');
  const userId = requiredText(claimant?.userId, 'verified_claimant_required');
  const verifiedEmail = normalizedEmail(claimant?.verifiedEmail);
  const { row, tokenHash } = await invitationByToken(env, token);
  const status = invitationStatus(row, at);
  if (status !== 'available') throw invitationError(`invitation_${status}`);
  if (row.intended_recipient_email !== verifiedEmail) {
    throw invitationError('invitation_recipient_mismatch');
  }
  if (row.keeper_user_id || row.claimed_at || row.released_at) {
    throw invitationError('piece_already_held');
  }

  let prepared;
  try {
    prepared = await prepareFirstKeeperBind(env, {
      piece: { ...row, id: row.keeper_piece_id, invitation_proof_verified: true },
      claimant: { userId, verifiedEmail },
      proof: { kind: 'invitation', reference: row.id },
      evidence: {
        ipAddress: evidence?.ipAddress ?? null,
        userAgent: evidence?.userAgent ?? null,
      },
      boundAt: at,
    });
  } catch (error) {
    if (error?.code === 'first_bind_unavailable') throw invitationError('piece_already_held');
    throw error;
  }

  const receipt = env.DB.prepare(
    `INSERT INTO artwork_invitation_redemptions
       (invitation_id, keeper_piece_id, redeemed_by_user_id,
        verified_recipient_email, proof_reference, presented_token_hash, redeemed_at)
     VALUES (?1, ?2, ?3, ?4, ?1, ?5, ?6)`,
  ).bind(row.id, row.keeper_piece_id, userId, verifiedEmail, tokenHash, at);
  const completion = env.DB.prepare(
    `INSERT INTO artwork_invitation_redemption_completions
       (invitation_id, completed_at)
     VALUES (?1, ?2)`,
  ).bind(row.id, at);

  try {
    const results = await env.DB.batch([receipt, ...prepared.statements, completion]);
    if (!results?.[0]?.success || !results?.[1]?.success) {
      throw invitationError('invitation_redemption_failed');
    }
    if ((results[1].meta?.changes ?? 0) !== 1) {
      throw invitationError('piece_already_held');
    }
    const completionResult = results[results.length - 1];
    if (!completionResult?.success || (completionResult.meta?.changes ?? 0) !== 1) {
      throw invitationError('invitation_redemption_failed');
    }
  } catch (error) {
    if (error?.isInvitationError === true) throw error;
    const latest = await env.DB.prepare(
      `SELECT invitation.revoked_at, invitation.expires_at, redemption.redeemed_at,
              piece.keeper_user_id, piece.claimed_at
         FROM artwork_invitations invitation
         JOIN keeper_pieces piece ON piece.id = invitation.keeper_piece_id
         LEFT JOIN artwork_invitation_redemptions redemption
           ON redemption.invitation_id = invitation.id
        WHERE invitation.id = ?1`,
    ).bind(row.id).first();
    const latestStatus = latest ? invitationStatus(latest, at) : null;
    if (latestStatus && latestStatus !== 'available') {
      throw invitationError(`invitation_${latestStatus}`);
    }
    if (latest?.keeper_user_id || latest?.claimed_at) {
      throw invitationError('piece_already_held');
    }
    throw error;
  }
  return prepared.result;
}
