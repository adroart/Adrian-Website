const CONTRIBUTOR_INVITE_RATE_LIMIT = 10;
const CONTRIBUTOR_INVITE_RATE_WINDOW_MS = 60 * 60 * 1000;

function contributorError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.isArtworkContributorError = true;
  Object.assign(error, details);
  return error;
}

function requiredText(value, code, maximum = 128) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maximum) throw contributorError(code);
  return normalized;
}

function normalizedEmail(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized.length < 3
    || normalized.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) throw contributorError('invalid_contributor_email');
  return normalized;
}

function isoInstant(value, code) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) {
    throw contributorError(code);
  }
  return value;
}

function nonnegativeInteger(value, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw contributorError(code);
  return number;
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

async function fingerprint(parts) {
  return sha256Hex(JSON.stringify(parts));
}

function requireDb(env) {
  if (!env?.DB) throw contributorError('contributor_db_required');
  return env.DB;
}

async function verifiedAccount(env, claimant, unavailableCode = 'verified_contributor_required') {
  const userId = requiredText(claimant?.userId, unavailableCode);
  const email = normalizedEmail(claimant?.verifiedEmail);
  const rows = await env.DB.prepare(
    `SELECT id, email, emailVerified FROM user
      WHERE id = ?1 AND lower(email) = ?2`,
  ).bind(userId, email).all();
  const accounts = rows?.results || [];
  if (accounts.length !== 1 || Number(accounts[0].emailVerified) !== 1) {
    throw contributorError(unavailableCode);
  }
  return { userId, email };
}

export async function requireKeeperAuthority(env, input) {
  requireDb(env);
  const keeperPieceId = requiredText(input?.keeperPieceId, 'keeper_piece_not_found');
  const userId = requiredText(input?.userId, 'keeper_authority_required');
  const expectedVersion = input?.stewardVersion === undefined
    ? null
    : nonnegativeInteger(input.stewardVersion, 'invalid_steward_version');
  const piece = await env.DB.prepare(
    `SELECT id, keeper_user_id, steward_version
       FROM keeper_pieces
      WHERE id = ?1 AND claimed_at IS NOT NULL AND released_at IS NULL`,
  ).bind(keeperPieceId).first();
  if (!piece) throw contributorError('keeper_piece_not_found');
  if (piece.keeper_user_id !== userId) throw contributorError('keeper_authority_required');
  if (expectedVersion !== null && Number(piece.steward_version) !== expectedVersion) {
    throw contributorError('stale_keeper_authority');
  }
  return {
    keeperPieceId: piece.id,
    keeperUserId: piece.keeper_user_id,
    stewardVersion: Number(piece.steward_version),
  };
}

async function resolveRecipient(env, email) {
  const recipient = await env.DB.prepare(
    `SELECT CASE
              WHEN COUNT(*) = 1 AND MAX(emailVerified) = 1 THEN MAX(id)
              ELSE NULL
            END AS verified_recipient_id
       FROM user
      WHERE lower(email) = ?1`,
  ).bind(email).first();
  if (!recipient?.verified_recipient_id) {
    throw contributorError('contributor_recipient_not_available');
  }
  return recipient.verified_recipient_id;
}

function inviteRateWindow(at) {
  const start = Math.floor(Date.parse(at) / CONTRIBUTOR_INVITE_RATE_WINDOW_MS)
    * CONTRIBUTOR_INVITE_RATE_WINDOW_MS;
  return new Date(start).toISOString();
}

async function consumeContributorInviteAttempt(env, keeperUserId, at) {
  const windowStartedAt = inviteRateWindow(at);
  const consumed = await env.DB.prepare(
    `INSERT INTO artwork_contributor_invite_rate_limits
       (keeper_user_id, window_started_at, attempt_count, last_attempt_at)
     VALUES (?1, ?2, 1, ?3)
     ON CONFLICT(keeper_user_id) DO UPDATE SET
       window_started_at = excluded.window_started_at,
       attempt_count = CASE
         WHEN excluded.window_started_at
              > artwork_contributor_invite_rate_limits.window_started_at THEN 1
         ELSE artwork_contributor_invite_rate_limits.attempt_count + 1
       END,
       last_attempt_at = excluded.last_attempt_at
     WHERE (
       excluded.window_started_at
         > artwork_contributor_invite_rate_limits.window_started_at
       OR (
         excluded.window_started_at
           = artwork_contributor_invite_rate_limits.window_started_at
         AND artwork_contributor_invite_rate_limits.attempt_count < ?4
       )
     )`,
  ).bind(
    keeperUserId, windowStartedAt, at, CONTRIBUTOR_INVITE_RATE_LIMIT,
  ).run();
  if (Number(consumed?.meta?.changes) === 1) return;
  const retryAfter = Math.max(1, Math.ceil(
    (Date.parse(windowStartedAt) + CONTRIBUTOR_INVITE_RATE_WINDOW_MS - Date.parse(at)) / 1000,
  ));
  throw contributorError('contributor_invite_rate_limited', { retryAfter });
}

async function contributorInviteRateLimitRetryAfter(env, keeperUserId, at) {
  const windowStartedAt = inviteRateWindow(at);
  const limited = await env.DB.prepare(
    `SELECT 1 AS is_limited FROM artwork_contributor_invite_rate_limits
      WHERE keeper_user_id = ?1
        AND window_started_at = ?2
        AND attempt_count >= ?3`,
  ).bind(keeperUserId, windowStartedAt, CONTRIBUTOR_INVITE_RATE_LIMIT).first();
  if (!limited) return null;
  return Math.max(1, Math.ceil(
    (Date.parse(windowStartedAt) + CONTRIBUTOR_INVITE_RATE_WINDOW_MS - Date.parse(at)) / 1000,
  ));
}

async function contributorRelationshipState(env, {
  keeperPieceId, keeperUserId, stewardVersion, recipientUserId, at,
}) {
  const state = await env.DB.prepare(
    `SELECT
       EXISTS (
         SELECT 1
           FROM artwork_contributor_current_access AS access
          WHERE access.keeper_piece_id = ?1
            AND access.keeper_user_id = ?2
            AND access.steward_version = ?3
            AND access.contributor_user_id = ?4
       ) AS is_active,
       EXISTS (
         SELECT 1
           FROM artwork_contributor_invitations AS invitation
           JOIN keeper_pieces AS current_piece
             ON current_piece.id = invitation.keeper_piece_id
            AND current_piece.keeper_user_id = invitation.keeper_user_id
            AND current_piece.steward_version = invitation.steward_version
            AND current_piece.claimed_at IS NOT NULL
            AND current_piece.released_at IS NULL
           JOIN user AS recipient
             ON recipient.id = invitation.intended_recipient_user_id
            AND recipient.emailVerified = 1
           LEFT JOIN artwork_contributor_invitation_acceptances AS acceptance
             ON acceptance.invitation_id = invitation.id
           LEFT JOIN artwork_contributor_revocations AS invitation_revocation
             ON invitation_revocation.invitation_id = invitation.id
            AND invitation_revocation.revocation_kind = 'invitation'
          WHERE invitation.keeper_piece_id = ?1
            AND invitation.keeper_user_id = ?2
            AND invitation.steward_version = ?3
            AND invitation.intended_recipient_user_id = ?4
            AND acceptance.invitation_id IS NULL
            AND invitation_revocation.invitation_id IS NULL
            AND julianday(invitation.expires_at) > julianday(?5)
            AND NOT EXISTS (
              SELECT 1
                FROM artwork_contributor_access_grants AS prior_grant
                JOIN artwork_contributor_revocations AS prior_revocation
                  ON prior_revocation.invitation_id = prior_grant.invitation_id
                 AND prior_revocation.revocation_kind = 'access'
               WHERE prior_grant.keeper_piece_id = invitation.keeper_piece_id
                 AND prior_grant.contributor_user_id = invitation.intended_recipient_user_id
                 AND prior_grant.keeper_user_id = invitation.keeper_user_id
                 AND prior_grant.steward_version = invitation.steward_version
                 AND julianday(prior_revocation.revoked_at) >= julianday(invitation.invited_at)
            )
       ) AS is_invited`,
  ).bind(
    keeperPieceId, keeperUserId, stewardVersion, recipientUserId, at,
  ).first();
  if (Number(state?.is_active) === 1) return 'active';
  if (Number(state?.is_invited) === 1) return 'invited';
  return null;
}

function throwRelationshipConflict(state, invitation = false) {
  if (state === 'active') {
    throw contributorError(invitation
      ? 'contributor_invitation_already_active'
      : 'contributor_already_active');
  }
  if (state === 'invited') throw contributorError('contributor_already_invited');
}

function databaseErrorIncludes(error, message) {
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (String(current?.message || current).includes(message)) return true;
    current = current?.cause;
  }
  return false;
}

async function reclassifyInvitationInsertFailure(env, {
  keeperPieceId, keeperUserId, stewardVersion, recipientUserId, recipientEmail,
}) {
  const currentEpoch = await env.DB.prepare(
    `SELECT 1 AS is_current
       FROM keeper_pieces
      WHERE id = ?1 AND keeper_user_id = ?2 AND steward_version = ?3
        AND claimed_at IS NOT NULL AND released_at IS NULL`,
  ).bind(keeperPieceId, keeperUserId, stewardVersion).first();
  if (!currentEpoch) throw contributorError('stale_keeper_authority');
  const currentRecipientUserId = await resolveRecipient(env, recipientEmail);
  if (currentRecipientUserId !== recipientUserId) {
    throw contributorError('contributor_recipient_not_available');
  }
}

export async function inviteArtworkContributor(env, input) {
  requireDb(env);
  const keeperPieceId = requiredText(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const keeperUserId = requiredText(input?.keeperUserId, 'keeper_authority_required');
  const recipientEmail = normalizedEmail(input?.intendedRecipientEmail);
  const idempotencyKey = requiredText(input?.idempotencyKey, 'idempotency_key_required');
  const invitedAt = isoInstant(input?.invitedAt, 'invalid_invited_at');
  const expiresAt = isoInstant(input?.expiresAt, 'invalid_contributor_expiry');
  const requestedVersion = input?.stewardVersion === undefined
    ? null
    : nonnegativeInteger(input.stewardVersion, 'invalid_steward_version');
  const requestFingerprint = await fingerprint([
    'invite', keeperPieceId, keeperUserId, requestedVersion,
    recipientEmail, expiresAt,
  ]);
  const replay = await env.DB.prepare(
    `SELECT id, request_fingerprint
       FROM artwork_contributor_invitations WHERE idempotency_key = ?1`,
  ).bind(idempotencyKey).first();
  if (replay?.request_fingerprint === requestFingerprint) {
    return { invitationId: replay.id, status: 'replay' };
  }
  if (Date.parse(expiresAt) <= Date.parse(invitedAt)) {
    throw contributorError('invalid_contributor_expiry');
  }
  const authority = await requireKeeperAuthority(env, {
    keeperPieceId,
    userId: keeperUserId,
    ...(requestedVersion === null ? {} : { stewardVersion: requestedVersion }),
  });
  const retryAfter = await contributorInviteRateLimitRetryAfter(
    env, keeperUserId, invitedAt,
  );
  if (retryAfter !== null) {
    const raced = await env.DB.prepare(
      `SELECT id, request_fingerprint
         FROM artwork_contributor_invitations WHERE idempotency_key = ?1`,
    ).bind(idempotencyKey).first();
    if (raced?.request_fingerprint === requestFingerprint) {
      return { invitationId: raced.id, status: 'replay' };
    }
    throw contributorError('contributor_invite_rate_limited', { retryAfter });
  }
  if (replay) {
    await consumeContributorInviteAttempt(env, keeperUserId, invitedAt);
    throw contributorError('contributor_idempotency_conflict');
  }
  let recipientUserId;
  try {
    recipientUserId = await resolveRecipient(env, recipientEmail);
    if (recipientUserId === keeperUserId) throw contributorError('contributor_cannot_be_keeper');
    throwRelationshipConflict(await contributorRelationshipState(env, {
      keeperPieceId,
      keeperUserId,
      stewardVersion: authority.stewardVersion,
      recipientUserId,
      at: invitedAt,
    }));
  } catch (error) {
    const raced = await env.DB.prepare(
      `SELECT id, request_fingerprint
         FROM artwork_contributor_invitations WHERE idempotency_key = ?1`,
    ).bind(idempotencyKey).first();
    if (raced?.request_fingerprint === requestFingerprint) {
      return { invitationId: raced.id, status: 'replay' };
    }
    await consumeContributorInviteAttempt(env, keeperUserId, invitedAt);
    throw error;
  }
  const token = createToken();
  const tokenHash = await sha256Hex(token);
  const invitationId = `aci-${crypto.randomUUID()}`;
  let inserted;
  try {
    inserted = await env.DB.prepare(
      `INSERT INTO artwork_contributor_invitations
         (id, keeper_piece_id, keeper_user_id, steward_version,
          intended_recipient_user_id, intended_recipient_email, token_hash,
          idempotency_key, request_fingerprint, invited_at, expires_at)
       SELECT ?1, piece.id, piece.keeper_user_id, piece.steward_version,
              ?5, ?6, ?7, ?8, ?9, ?10, ?11
         FROM keeper_pieces AS piece
          JOIN user AS recipient ON recipient.id = ?5 AND recipient.emailVerified = 1
        WHERE piece.id = ?2
          AND piece.keeper_user_id = ?3
          AND piece.steward_version = ?4
          AND piece.claimed_at IS NOT NULL
          AND piece.released_at IS NULL
          AND piece.keeper_user_id <> recipient.id
          AND lower(recipient.email) = ?6
          AND (
            SELECT COUNT(*) FROM user AS matching_recipient
             WHERE lower(matching_recipient.email) = ?6
          ) = 1`,
    ).bind(
      invitationId, keeperPieceId, keeperUserId, authority.stewardVersion,
      recipientUserId, recipientEmail, tokenHash, idempotencyKey,
      requestFingerprint, invitedAt, expiresAt,
    ).run();
  } catch (error) {
    const raced = await env.DB.prepare(
      `SELECT id, request_fingerprint
         FROM artwork_contributor_invitations WHERE idempotency_key = ?1`,
    ).bind(idempotencyKey).first();
    if (raced?.request_fingerprint === requestFingerprint) {
      return { invitationId: raced.id, status: 'replay' };
    }
    await consumeContributorInviteAttempt(env, keeperUserId, invitedAt);
    if (raced) throw contributorError('contributor_idempotency_conflict');
    await reclassifyInvitationInsertFailure(env, {
      keeperPieceId,
      keeperUserId,
      stewardVersion: authority.stewardVersion,
      recipientUserId,
      recipientEmail,
    });
    if (databaseErrorIncludes(error, 'contributor already active')) {
      throw contributorError('contributor_already_active');
    }
    if (databaseErrorIncludes(error, 'contributor already invited')) {
      throw contributorError('contributor_already_invited');
    }
    throwRelationshipConflict(await contributorRelationshipState(env, {
      keeperPieceId,
      keeperUserId,
      stewardVersion: authority.stewardVersion,
      recipientUserId,
      at: invitedAt,
    }));
    throw error;
  }
  if (Number(inserted?.meta?.changes) !== 1) {
    await consumeContributorInviteAttempt(env, keeperUserId, invitedAt);
    await reclassifyInvitationInsertFailure(env, {
      keeperPieceId,
      keeperUserId,
      stewardVersion: authority.stewardVersion,
      recipientUserId,
      recipientEmail,
    });
    throw contributorError('stale_keeper_authority');
  }
  return { invitationId, token, status: 'created' };
}

async function invitationByProof(env, { token, claimant }) {
  const account = await verifiedAccount(env, claimant, 'contributor_invitation_not_available');
  const presentedToken = requiredText(token, 'contributor_invitation_not_available', 512);
  const tokenHash = await sha256Hex(presentedToken);
  const invitation = await env.DB.prepare(
    `SELECT invitation.id, invitation.keeper_piece_id,
            invitation.keeper_user_id, invitation.steward_version,
            invitation.intended_recipient_user_id, invitation.token_hash,
            invitation.invited_at, invitation.expires_at,
            piece.piece_id, piece.public_code, piece.edition_number,
            artwork.edition_size AS artwork_edition_size,
            piece.keeper_user_id AS current_keeper_user_id,
            piece.steward_version AS current_steward_version,
            piece.claimed_at, piece.released_at,
            revocation.revoked_at, acceptance.accepted_at,
            acceptance.accepted_by_user_id,
            acceptance.idempotency_key AS acceptance_idempotency_key,
            acceptance.request_fingerprint AS acceptance_request_fingerprint,
            EXISTS (
              SELECT 1
                FROM artwork_contributor_current_access AS access
               WHERE access.keeper_piece_id = invitation.keeper_piece_id
                 AND access.contributor_user_id = invitation.intended_recipient_user_id
                 AND access.keeper_user_id = invitation.keeper_user_id
                 AND access.steward_version = invitation.steward_version
                 AND access.invitation_id <> invitation.id
            ) AS relationship_active,
            EXISTS (
              SELECT 1 FROM artwork_claim_requests AS claim
               WHERE claim.keeper_piece_id = invitation.keeper_piece_id
                 AND claim.requester_user_id = invitation.intended_recipient_user_id
                 AND claim.status = 'pending'
            ) AS has_pending_claim,
            EXISTS (
              SELECT 1
                FROM artwork_contributor_access_grants AS prior_grant
                JOIN artwork_contributor_revocations AS prior_revocation
                  ON prior_revocation.invitation_id = prior_grant.invitation_id
                 AND prior_revocation.revocation_kind = 'access'
               WHERE prior_grant.keeper_piece_id = invitation.keeper_piece_id
                 AND prior_grant.contributor_user_id = invitation.intended_recipient_user_id
                 AND prior_grant.keeper_user_id = invitation.keeper_user_id
                 AND prior_grant.steward_version = invitation.steward_version
                 AND julianday(prior_revocation.revoked_at) >= julianday(invitation.invited_at)
            ) AS relationship_revoked
       FROM artwork_contributor_invitations AS invitation
       JOIN keeper_pieces AS piece ON piece.id = invitation.keeper_piece_id
       LEFT JOIN registry_artworks AS artwork ON artwork.id = piece.piece_id
       LEFT JOIN artwork_contributor_revocations AS revocation
         ON revocation.invitation_id = invitation.id
        AND revocation.revocation_kind = 'invitation'
       LEFT JOIN artwork_contributor_invitation_acceptances AS acceptance
         ON acceptance.invitation_id = invitation.id
      WHERE invitation.token_hash = ?1
        AND invitation.intended_recipient_user_id = ?2`,
  ).bind(tokenHash, account.userId).first();
  if (!invitation) throw contributorError('contributor_invitation_not_available');
  return { invitation, tokenHash, account };
}

function invitationStatus(invitation, at) {
  if (invitation.accepted_at) return 'used';
  if (invitation.revoked_at) return 'revoked';
  if (Date.parse(invitation.expires_at) <= Date.parse(at)) return 'expired';
  if (
    invitation.current_keeper_user_id !== invitation.keeper_user_id
    || Number(invitation.current_steward_version) !== Number(invitation.steward_version)
    || !invitation.claimed_at
    || invitation.released_at
  ) return 'stale';
  if (Number(invitation.relationship_revoked) === 1) return 'revoked';
  if (Number(invitation.relationship_active) === 1) return 'already_active';
  if (Number(invitation.has_pending_claim) === 1) return 'claim_pending';
  return 'available';
}

export async function inspectArtworkContributorInvitation(env, input) {
  requireDb(env);
  const inspectedAt = isoInstant(input?.inspectedAt, 'invalid_inspection_time');
  const { invitation } = await invitationByProof(env, input || {});
  const status = invitationStatus(invitation, inspectedAt);
  if (status === 'stale') throw contributorError('contributor_invitation_stale');
  return {
    invitationId: invitation.id,
    artwork: {
      artworkId: invitation.piece_id,
      publicCode: invitation.public_code || null,
      edition: Number(invitation.edition_number) === 0
        ? { kind: 'unique' }
        : {
            kind: 'numbered',
            number: Number(invitation.edition_number),
            size: invitation.artwork_edition_size !== null
              && invitation.artwork_edition_size !== undefined
              && Number.isSafeInteger(Number(invitation.artwork_edition_size))
              ? Number(invitation.artwork_edition_size)
              : null,
          },
    },
    status,
  };
}

export async function acceptArtworkContributorInvitation(env, input) {
  requireDb(env);
  const acceptedAt = isoInstant(input?.acceptedAt, 'invalid_accepted_at');
  const idempotencyKey = requiredText(input?.idempotencyKey, 'idempotency_key_required');
  const { invitation, tokenHash, account } = await invitationByProof(env, input || {});
  const requestFingerprint = await fingerprint([
    'accept', invitation.id, tokenHash, account.userId,
  ]);
  const replay = await env.DB.prepare(
    `SELECT invitation_id, request_fingerprint
       FROM artwork_contributor_invitation_acceptances
      WHERE idempotency_key = ?1`,
  ).bind(idempotencyKey).first();
  if (replay) {
    if (
      replay.invitation_id !== invitation.id
      || replay.request_fingerprint !== requestFingerprint
    ) throw contributorError('contributor_idempotency_conflict');
    return { invitationId: replay.invitation_id, status: 'replay' };
  }
  const status = invitationStatus(invitation, acceptedAt);
  if (status !== 'available') throw contributorError(`contributor_invitation_${status}`);
  try {
    await env.DB.prepare(
      `INSERT INTO artwork_contributor_invitation_acceptances
         (invitation_id, accepted_by_user_id, presented_token_hash,
          idempotency_key, request_fingerprint, accepted_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(
      invitation.id, account.userId, tokenHash, idempotencyKey,
      requestFingerprint, acceptedAt,
    ).run();
  } catch (error) {
    const raced = await env.DB.prepare(
      `SELECT invitation_id, idempotency_key, request_fingerprint
         FROM artwork_contributor_invitation_acceptances
        WHERE invitation_id = ?1 OR idempotency_key = ?2`,
    ).bind(invitation.id, idempotencyKey).first();
    if (
      raced?.invitation_id === invitation.id
      && raced.idempotency_key === idempotencyKey
      && raced.request_fingerprint === requestFingerprint
    ) return { invitationId: invitation.id, status: 'replay' };
    if (raced?.idempotency_key === idempotencyKey) {
      throw contributorError('contributor_idempotency_conflict');
    }
    if (raced?.invitation_id === invitation.id) {
      throw contributorError('contributor_invitation_used');
    }
    try {
      const latest = await invitationByProof(env, input || {});
      const latestStatus = invitationStatus(latest.invitation, acceptedAt);
      if (latestStatus !== 'available') {
        throw contributorError(`contributor_invitation_${latestStatus}`);
      }
    } catch (classificationError) {
      if (classificationError?.isArtworkContributorError) throw classificationError;
      throw error;
    }
    if (
      databaseErrorIncludes(error, 'contributor invitation is not available')
      || databaseErrorIncludes(error, 'contributor access grant lacks accepted proof')
    ) throw contributorError('contributor_invitation_not_available');
    throw error;
  }
  return { invitationId: invitation.id, status: 'accepted' };
}

export async function requireContributorAccess(env, input) {
  requireDb(env);
  const keeperPieceId = requiredText(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const userId = requiredText(input?.userId, 'contributor_access_required');
  const access = await env.DB.prepare(
    `SELECT keeper_piece_id, contributor_user_id, keeper_user_id, steward_version
       FROM artwork_contributor_current_access
      WHERE keeper_piece_id = ?1 AND contributor_user_id = ?2`,
  ).bind(keeperPieceId, userId).first();
  if (!access) throw contributorError('contributor_access_required');
  return {
    keeperPieceId: access.keeper_piece_id,
    contributorUserId: access.contributor_user_id,
    keeperUserId: access.keeper_user_id,
    stewardVersion: Number(access.steward_version),
  };
}

export async function listArtworkContributors(env, input) {
  requireDb(env);
  const authority = await requireKeeperAuthority(env, {
    keeperPieceId: input?.keeperPieceId,
    userId: input?.keeperUserId,
    ...(input?.stewardVersion === undefined ? {} : { stewardVersion: input.stewardVersion }),
  });
  const at = isoInstant(input?.at, 'invalid_inspection_time');
  const [invitationResult, contributorResult] = await Promise.all([
    env.DB.prepare(
      `SELECT invitation.id, invitation.intended_recipient_email AS recipient_email,
              invitation.invited_at, invitation.expires_at,
              acceptance.accepted_at, invitation_revocation.revoked_at,
              EXISTS (
                SELECT 1
                  FROM artwork_contributor_access_grants AS prior_grant
                  JOIN artwork_contributor_revocations AS prior_revocation
                    ON prior_revocation.invitation_id = prior_grant.invitation_id
                   AND prior_revocation.revocation_kind = 'access'
                 WHERE prior_grant.keeper_piece_id = invitation.keeper_piece_id
                   AND prior_grant.contributor_user_id = invitation.intended_recipient_user_id
                   AND prior_grant.keeper_user_id = invitation.keeper_user_id
                   AND prior_grant.steward_version = invitation.steward_version
                   AND julianday(prior_revocation.revoked_at) >= julianday(invitation.invited_at)
              ) AS relationship_revoked
         FROM artwork_contributor_invitations AS invitation
         JOIN keeper_pieces AS current_piece
           ON current_piece.id = invitation.keeper_piece_id
          AND current_piece.keeper_user_id = invitation.keeper_user_id
          AND current_piece.steward_version = invitation.steward_version
          AND current_piece.claimed_at IS NOT NULL
          AND current_piece.released_at IS NULL
         LEFT JOIN artwork_contributor_invitation_acceptances AS acceptance
           ON acceptance.invitation_id = invitation.id
         LEFT JOIN artwork_contributor_revocations AS invitation_revocation
           ON invitation_revocation.invitation_id = invitation.id
          AND invitation_revocation.revocation_kind = 'invitation'
        WHERE invitation.keeper_piece_id = ?1
          AND invitation.keeper_user_id = ?2
          AND invitation.steward_version = ?3
        ORDER BY invitation.invited_at, invitation.intended_recipient_email, invitation.id`,
    ).bind(
      authority.keeperPieceId, authority.keeperUserId, authority.stewardVersion,
    ).all(),
    env.DB.prepare(
    `SELECT access.invitation_id, access.granted_at,
            invitation.intended_recipient_email AS recipient_email
       FROM artwork_contributor_current_access AS access
       JOIN artwork_contributor_invitations AS invitation
         ON invitation.id = access.invitation_id
      WHERE access.keeper_piece_id = ?1
        AND access.keeper_user_id = ?2
        AND access.steward_version = ?3
      ORDER BY access.granted_at, access.contributor_user_id`,
  ).bind(
    authority.keeperPieceId, authority.keeperUserId, authority.stewardVersion,
    ).all(),
  ]);
  return {
    invitations: (invitationResult?.results || []).map((row) => ({
      invitationId: row.id,
      recipientEmail: row.recipient_email,
      invitedAt: row.invited_at,
      expiresAt: row.expires_at,
      status: row.accepted_at
        ? 'accepted'
        : row.revoked_at || Number(row.relationship_revoked) === 1
          ? 'revoked'
          : Date.parse(row.expires_at) <= Date.parse(at)
            ? 'expired'
            : 'available',
    })),
    contributors: (contributorResult?.results || []).map((row) => ({
      accessId: row.invitation_id,
      recipientEmail: row.recipient_email,
      grantedAt: row.granted_at,
      status: 'active',
    })),
  };
}

async function revocationReplay(env, key) {
  return env.DB.prepare(
    `SELECT revocation_kind AS kind, invitation_id, idempotency_key, request_fingerprint
       FROM artwork_contributor_revocations WHERE idempotency_key = ?1`,
  ).bind(key).first();
}

async function revocationForTarget(env, kind, invitationId) {
  return env.DB.prepare(
    `SELECT revocation_kind AS kind, invitation_id, idempotency_key, request_fingerprint
       FROM artwork_contributor_revocations
      WHERE revocation_kind = ?1 AND invitation_id = ?2`,
  ).bind(kind, invitationId).first();
}

async function insertRevocation(env, {
  kind,
  invitationId,
  keeperPieceId,
  keeperUserId,
  stewardVersion,
  idempotencyKey,
  requestFingerprint,
  revokedAt,
}) {
  try {
    await env.DB.prepare(
      `INSERT INTO artwork_contributor_revocations
         (revocation_kind, invitation_id, revoked_by_keeper_user_id,
          steward_version, idempotency_key, request_fingerprint, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      kind, invitationId, keeperUserId, stewardVersion,
      idempotencyKey, requestFingerprint, revokedAt,
    ).run();
    return 'revoked';
  } catch (error) {
    const raced = await revocationReplay(env, idempotencyKey);
    if (
      raced?.kind === kind
      && raced.invitation_id === invitationId
      && raced.request_fingerprint === requestFingerprint
    ) return 'replay';
    if (raced) throw contributorError('contributor_idempotency_conflict');
    const targetRace = await revocationForTarget(env, kind, invitationId);
    if (targetRace) {
      throw contributorError(kind === 'invitation'
        ? 'contributor_invitation_revoked'
        : 'contributor_access_not_found');
    }
    const currentEpoch = await env.DB.prepare(
      `SELECT 1 AS is_current
         FROM keeper_pieces
        WHERE id = ?1 AND keeper_user_id = ?2 AND steward_version = ?3
          AND claimed_at IS NOT NULL AND released_at IS NULL`,
    ).bind(keeperPieceId, keeperUserId, stewardVersion).first();
    if (!currentEpoch) throw contributorError('stale_keeper_authority');
    if (kind === 'invitation') {
      const latest = await env.DB.prepare(
        `SELECT acceptance.accepted_at, invitation.expires_at
           FROM artwork_contributor_invitations AS invitation
           LEFT JOIN artwork_contributor_invitation_acceptances AS acceptance
             ON acceptance.invitation_id = invitation.id
          WHERE invitation.id = ?1`,
      ).bind(invitationId).first();
      if (latest?.accepted_at) throw contributorError('contributor_invitation_used');
      if (latest && Date.parse(latest.expires_at) <= Date.parse(revokedAt)) {
        throw contributorError('contributor_invitation_expired');
      }
      if (databaseErrorIncludes(error, 'contributor invitation cannot be revoked')) {
        throw contributorError('contributor_invitation_not_available');
      }
    } else if (databaseErrorIncludes(error, 'contributor access cannot be revoked')) {
      throw contributorError('contributor_access_not_found');
    }
    throw error;
  }
}

export async function revokeArtworkContributor(env, input) {
  requireDb(env);
  const keeperPieceId = requiredText(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const keeperUserId = requiredText(input?.keeperUserId, 'keeper_authority_required');
  const idempotencyKey = requiredText(input?.idempotencyKey, 'idempotency_key_required');
  const revokedAt = isoInstant(input?.revokedAt, 'invalid_revoked_at');
  const invitationId = typeof input?.invitationId === 'string'
    ? requiredText(input.invitationId, 'invalid_contributor_invitation_id')
    : null;
  const contributorUserId = typeof input?.contributorUserId === 'string'
    ? requiredText(input.contributorUserId, 'invalid_contributor_user_id')
    : null;
  const accessId = typeof input?.accessId === 'string'
    ? requiredText(input.accessId, 'invalid_contributor_access_id')
    : null;
  if ([invitationId, contributorUserId, accessId].filter(Boolean).length !== 1) {
    throw contributorError('exact_contributor_revocation_target_required');
  }
  const requestedVersion = input?.stewardVersion === undefined
    ? null
    : nonnegativeInteger(input.stewardVersion, 'invalid_steward_version');
  const kind = invitationId ? 'invitation' : 'access';
  const target = invitationId || accessId || contributorUserId;
  const requestFingerprint = await fingerprint([
    'revoke', kind, keeperPieceId, keeperUserId, requestedVersion,
    target,
  ]);
  const replay = await revocationReplay(env, idempotencyKey);
  if (replay) {
    if (replay.kind !== kind || replay.request_fingerprint !== requestFingerprint) {
      throw contributorError('contributor_idempotency_conflict');
    }
    return { invitationId: replay.invitation_id, status: 'replay' };
  }
  const authority = await requireKeeperAuthority(env, {
    keeperPieceId,
    userId: keeperUserId,
    ...(requestedVersion === null ? {} : { stewardVersion: requestedVersion }),
  });

  if (invitationId) {
    const invitation = await env.DB.prepare(
      `SELECT invitation.id, invitation.keeper_piece_id,
              invitation.keeper_user_id, invitation.steward_version,
              invitation.invited_at, invitation.expires_at, acceptance.accepted_at,
              revocation.revoked_at
         FROM artwork_contributor_invitations AS invitation
         LEFT JOIN artwork_contributor_invitation_acceptances AS acceptance
           ON acceptance.invitation_id = invitation.id
         LEFT JOIN artwork_contributor_revocations AS revocation
           ON revocation.invitation_id = invitation.id
          AND revocation.revocation_kind = 'invitation'
        WHERE invitation.id = ?1 AND invitation.keeper_piece_id = ?2`,
    ).bind(invitationId, keeperPieceId).first();
    if (!invitation) throw contributorError('contributor_invitation_not_found');
    if (
      invitation.keeper_user_id !== keeperUserId
      || Number(invitation.steward_version) !== authority.stewardVersion
    ) throw contributorError('stale_keeper_authority');
    if (invitation.accepted_at) throw contributorError('contributor_invitation_used');
    if (invitation.revoked_at) throw contributorError('contributor_invitation_revoked');
    if (Date.parse(invitation.expires_at) <= Date.parse(revokedAt)) {
      throw contributorError('contributor_invitation_expired');
    }
    const status = await insertRevocation(env, {
      kind, invitationId, keeperPieceId, keeperUserId,
      stewardVersion: authority.stewardVersion,
      idempotencyKey, requestFingerprint, revokedAt,
    });
    return { invitationId, status };
  }

  const access = await env.DB.prepare(
    `SELECT invitation_id FROM artwork_contributor_current_access
      WHERE keeper_piece_id = ?1 AND keeper_user_id = ?2
        AND steward_version = ?3
        AND ${accessId ? 'invitation_id' : 'contributor_user_id'} = ?4`,
  ).bind(
    keeperPieceId, keeperUserId, authority.stewardVersion, accessId || contributorUserId,
  ).first();
  if (!access) throw contributorError('contributor_access_not_found');
  const status = await insertRevocation(env, {
    kind, invitationId: access.invitation_id, keeperPieceId, keeperUserId,
    stewardVersion: authority.stewardVersion,
    idempotencyKey, requestFingerprint, revokedAt,
  });
  return { invitationId: access.invitation_id, status };
}
