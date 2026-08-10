function contributorError(code) {
  const error = new Error(code);
  error.code = code;
  error.isArtworkContributorError = true;
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
  const result = await env.DB.prepare(
    `SELECT id, emailVerified FROM user WHERE lower(email) = ?1 ORDER BY id`,
  ).bind(email).all();
  const accounts = result?.results || [];
  if (accounts.length === 0) throw contributorError('contributor_recipient_not_found');
  if (accounts.length > 1) throw contributorError('contributor_recipient_ambiguous');
  if (Number(accounts[0].emailVerified) !== 1) {
    throw contributorError('contributor_recipient_unverified');
  }
  return accounts[0].id;
}

export async function inviteArtworkContributor(env, input) {
  requireDb(env);
  const keeperPieceId = requiredText(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const keeperUserId = requiredText(input?.keeperUserId, 'keeper_authority_required');
  const recipientEmail = normalizedEmail(input?.intendedRecipientEmail);
  const idempotencyKey = requiredText(input?.idempotencyKey, 'idempotency_key_required');
  const invitedAt = isoInstant(input?.invitedAt, 'invalid_invited_at');
  const expiresAt = isoInstant(input?.expiresAt, 'invalid_contributor_expiry');
  if (Date.parse(expiresAt) <= Date.parse(invitedAt)) {
    throw contributorError('invalid_contributor_expiry');
  }
  const authority = await requireKeeperAuthority(env, {
    keeperPieceId,
    userId: keeperUserId,
    ...(input?.stewardVersion === undefined ? {} : { stewardVersion: input.stewardVersion }),
  });
  const recipientUserId = await resolveRecipient(env, recipientEmail);
  if (recipientUserId === keeperUserId) throw contributorError('contributor_cannot_be_keeper');
  const requestFingerprint = await fingerprint([
    'invite', keeperPieceId, keeperUserId, authority.stewardVersion,
    recipientUserId, invitedAt, expiresAt,
  ]);
  const replay = await env.DB.prepare(
    `SELECT id, request_fingerprint
       FROM artwork_contributor_invitations WHERE idempotency_key = ?1`,
  ).bind(idempotencyKey).first();
  if (replay) {
    if (replay.request_fingerprint !== requestFingerprint) {
      throw contributorError('contributor_idempotency_conflict');
    }
    return { invitationId: replay.id, status: 'replay' };
  }

  const token = createToken();
  const tokenHash = await sha256Hex(token);
  const invitationId = `aci-${crypto.randomUUID()}`;
  let inserted;
  try {
    inserted = await env.DB.prepare(
      `INSERT INTO artwork_contributor_invitations
         (id, keeper_piece_id, keeper_user_id, steward_version,
          intended_recipient_user_id, token_hash, idempotency_key,
          request_fingerprint, invited_at, expires_at)
       SELECT ?1, piece.id, piece.keeper_user_id, piece.steward_version,
              ?5, ?6, ?7, ?8, ?9, ?10
         FROM keeper_pieces AS piece
         JOIN user AS recipient ON recipient.id = ?5 AND recipient.emailVerified = 1
        WHERE piece.id = ?2
          AND piece.keeper_user_id = ?3
          AND piece.steward_version = ?4
          AND piece.claimed_at IS NOT NULL
          AND piece.released_at IS NULL
          AND piece.keeper_user_id <> recipient.id`,
    ).bind(
      invitationId, keeperPieceId, keeperUserId, authority.stewardVersion,
      recipientUserId, tokenHash, idempotencyKey, requestFingerprint,
      invitedAt, expiresAt,
    ).run();
  } catch (error) {
    const raced = await env.DB.prepare(
      `SELECT id, request_fingerprint
         FROM artwork_contributor_invitations WHERE idempotency_key = ?1`,
    ).bind(idempotencyKey).first();
    if (raced?.request_fingerprint === requestFingerprint) {
      return { invitationId: raced.id, status: 'replay' };
    }
    if (raced) throw contributorError('contributor_idempotency_conflict');
    throw error;
  }
  if (Number(inserted?.meta?.changes) !== 1) throw contributorError('stale_keeper_authority');
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
            piece.piece_id, piece.public_code,
            piece.keeper_user_id AS current_keeper_user_id,
            piece.steward_version AS current_steward_version,
            piece.claimed_at, piece.released_at,
            revocation.revoked_at, acceptance.accepted_at,
            acceptance.accepted_by_user_id,
            acceptance.idempotency_key AS acceptance_idempotency_key,
            acceptance.request_fingerprint AS acceptance_request_fingerprint,
            EXISTS (
              SELECT 1 FROM artwork_claim_requests AS claim
               WHERE claim.keeper_piece_id = invitation.keeper_piece_id
                 AND claim.requester_user_id = invitation.intended_recipient_user_id
                 AND claim.status = 'pending'
            ) AS has_pending_claim
       FROM artwork_contributor_invitations AS invitation
       JOIN keeper_pieces AS piece ON piece.id = invitation.keeper_piece_id
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
      keeperPieceId: invitation.keeper_piece_id,
      artworkId: invitation.piece_id,
      publicCode: invitation.public_code || null,
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
    'accept', invitation.id, tokenHash, account.userId, acceptedAt,
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
  const result = await env.DB.prepare(
    `SELECT contributor_user_id, granted_at
       FROM artwork_contributor_current_access
      WHERE keeper_piece_id = ?1
        AND keeper_user_id = ?2
        AND steward_version = ?3
      ORDER BY granted_at, contributor_user_id`,
  ).bind(
    authority.keeperPieceId, authority.keeperUserId, authority.stewardVersion,
  ).all();
  return (result?.results || []).map((row) => ({
    contributorUserId: row.contributor_user_id,
    grantedAt: row.granted_at,
    status: 'active',
  }));
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
  if ((invitationId === null) === (contributorUserId === null)) {
    throw contributorError('exact_contributor_revocation_target_required');
  }
  const authority = await requireKeeperAuthority(env, {
    keeperPieceId,
    userId: keeperUserId,
    ...(input?.stewardVersion === undefined ? {} : { stewardVersion: input.stewardVersion }),
  });
  const kind = invitationId ? 'invitation' : 'access';
  const target = invitationId || contributorUserId;
  const requestFingerprint = await fingerprint([
    'revoke', kind, keeperPieceId, keeperUserId, authority.stewardVersion,
    target, revokedAt,
  ]);
  const replay = await revocationReplay(env, idempotencyKey);
  if (replay) {
    if (replay.kind !== kind || replay.request_fingerprint !== requestFingerprint) {
      throw contributorError('contributor_idempotency_conflict');
    }
    return { invitationId: replay.invitation_id, status: 'replay' };
  }

  if (invitationId) {
    const invitation = await env.DB.prepare(
      `SELECT invitation.id, invitation.keeper_piece_id,
              invitation.keeper_user_id, invitation.steward_version,
              invitation.invited_at, acceptance.accepted_at,
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
    const status = await insertRevocation(env, {
      kind, invitationId, keeperUserId,
      stewardVersion: authority.stewardVersion,
      idempotencyKey, requestFingerprint, revokedAt,
    });
    return { invitationId, status };
  }

  const access = await env.DB.prepare(
    `SELECT invitation_id FROM artwork_contributor_current_access
      WHERE keeper_piece_id = ?1 AND keeper_user_id = ?2
        AND steward_version = ?3 AND contributor_user_id = ?4`,
  ).bind(
    keeperPieceId, keeperUserId, authority.stewardVersion, contributorUserId,
  ).first();
  if (!access) throw contributorError('contributor_access_not_found');
  const status = await insertRevocation(env, {
    kind, invitationId: access.invitation_id, keeperUserId,
    stewardVersion: authority.stewardVersion,
    idempotencyKey, requestFingerprint, revokedAt,
  });
  return { invitationId: access.invitation_id, status };
}
