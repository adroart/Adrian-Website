-- Verified-person contributor access, structurally separate from stewardship.
--
-- A contributor is never a keeper, claimant, heir, transfer party, recovery
-- authority, or public-lineage participant. Every invitation and access grant
-- is pinned to one exact keeper user and steward version. The current-access
-- view therefore invalidates both immediately when stewardship changes, even
-- if a former keeper later becomes keeper again.

CREATE TABLE artwork_contributor_invitations (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 40 AND substr(id, 1, 4) = 'aci-'
  ),
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  keeper_user_id TEXT NOT NULL CHECK (length(trim(keeper_user_id)) BETWEEN 1 AND 128),
  steward_version INTEGER NOT NULL CHECK (
    typeof(steward_version) = 'integer' AND steward_version >= 0
  ),
  intended_recipient_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT
    CHECK (length(trim(intended_recipient_user_id)) BETWEEN 1 AND 128),
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  request_fingerprint TEXT NOT NULL CHECK (
    length(request_fingerprint) = 64
    AND request_fingerprint = lower(request_fingerprint)
    AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  invited_at TEXT NOT NULL CHECK (
    length(invited_at) = 24
    AND invited_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(invited_at) IS NOT NULL
  ),
  expires_at TEXT NOT NULL CHECK (
    length(expires_at) = 24
    AND expires_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(expires_at) IS NOT NULL
    AND julianday(expires_at) > julianday(invited_at)
  ),
  CHECK (keeper_user_id <> intended_recipient_user_id)
);

CREATE INDEX idx_artwork_contributor_invitations_piece
  ON artwork_contributor_invitations(keeper_piece_id, keeper_user_id, steward_version, invited_at);

CREATE TABLE artwork_contributor_revocations (
  revocation_kind TEXT NOT NULL CHECK (revocation_kind IN ('invitation', 'access')),
  invitation_id TEXT NOT NULL
    REFERENCES artwork_contributor_invitations(id) ON DELETE RESTRICT,
  revoked_by_keeper_user_id TEXT NOT NULL
    CHECK (length(trim(revoked_by_keeper_user_id)) BETWEEN 1 AND 128),
  steward_version INTEGER NOT NULL CHECK (
    typeof(steward_version) = 'integer' AND steward_version >= 0
  ),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  request_fingerprint TEXT NOT NULL CHECK (
    length(request_fingerprint) = 64
    AND request_fingerprint = lower(request_fingerprint)
    AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  revoked_at TEXT NOT NULL CHECK (
    length(revoked_at) = 24
    AND revoked_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(revoked_at) IS NOT NULL
  ),
  PRIMARY KEY (revocation_kind, invitation_id)
);

CREATE TABLE artwork_contributor_invitation_acceptances (
  invitation_id TEXT PRIMARY KEY
    REFERENCES artwork_contributor_invitations(id) ON DELETE RESTRICT,
  accepted_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  presented_token_hash TEXT NOT NULL CHECK (
    length(presented_token_hash) = 64
    AND presented_token_hash = lower(presented_token_hash)
    AND presented_token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  request_fingerprint TEXT NOT NULL CHECK (
    length(request_fingerprint) = 64
    AND request_fingerprint = lower(request_fingerprint)
    AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  accepted_at TEXT NOT NULL CHECK (
    length(accepted_at) = 24
    AND accepted_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(accepted_at) IS NOT NULL
  )
);

CREATE TABLE artwork_contributor_access_grants (
  invitation_id TEXT PRIMARY KEY
    REFERENCES artwork_contributor_invitation_acceptances(invitation_id) ON DELETE RESTRICT,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  contributor_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  keeper_user_id TEXT NOT NULL CHECK (length(trim(keeper_user_id)) BETWEEN 1 AND 128),
  steward_version INTEGER NOT NULL CHECK (
    typeof(steward_version) = 'integer' AND steward_version >= 0
  ),
  granted_at TEXT NOT NULL CHECK (
    length(granted_at) = 24
    AND granted_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(granted_at) IS NOT NULL
  ),
  CHECK (keeper_user_id <> contributor_user_id)
);

CREATE VIEW artwork_contributor_current_access AS
SELECT grant.invitation_id,
       grant.keeper_piece_id,
       grant.contributor_user_id,
       grant.keeper_user_id,
       grant.steward_version,
       grant.granted_at
  FROM artwork_contributor_access_grants AS grant
  JOIN keeper_pieces AS piece
    ON piece.id = grant.keeper_piece_id
   AND piece.keeper_user_id = grant.keeper_user_id
   AND piece.steward_version = grant.steward_version
   AND piece.claimed_at IS NOT NULL
   AND piece.released_at IS NULL
  JOIN user AS contributor
    ON contributor.id = grant.contributor_user_id
   AND contributor.emailVerified = 1
  LEFT JOIN artwork_contributor_revocations AS revocation
    ON revocation.invitation_id = grant.invitation_id
   AND revocation.revocation_kind = 'access'
 WHERE revocation.invitation_id IS NULL;

CREATE TRIGGER artwork_contributor_invitation_insert_guard
BEFORE INSERT ON artwork_contributor_invitations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM keeper_pieces AS piece
      JOIN user AS recipient ON recipient.id = NEW.intended_recipient_user_id
     WHERE piece.id = NEW.keeper_piece_id
       AND piece.keeper_user_id = NEW.keeper_user_id
       AND piece.steward_version = NEW.steward_version
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND recipient.emailVerified = 1
       AND recipient.id <> piece.keeper_user_id
  ) THEN RAISE(ABORT, 'contributor invitation requires current keeper and verified recipient') END;
END;

CREATE TRIGGER artwork_contributor_invitation_accept_guard
BEFORE INSERT ON artwork_contributor_invitation_acceptances
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_invitations AS invitation
      JOIN keeper_pieces AS piece ON piece.id = invitation.keeper_piece_id
      JOIN user AS recipient ON recipient.id = invitation.intended_recipient_user_id
      LEFT JOIN artwork_contributor_revocations AS revocation
        ON revocation.invitation_id = invitation.id
       AND revocation.revocation_kind = 'invitation'
     WHERE invitation.id = NEW.invitation_id
       AND invitation.intended_recipient_user_id = NEW.accepted_by_user_id
       AND invitation.token_hash = NEW.presented_token_hash
       AND piece.keeper_user_id = invitation.keeper_user_id
       AND piece.steward_version = invitation.steward_version
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND recipient.emailVerified = 1
       AND revocation.invitation_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM artwork_claim_requests AS claim
          WHERE claim.keeper_piece_id = invitation.keeper_piece_id
            AND claim.requester_user_id = NEW.accepted_by_user_id
            AND claim.status = 'pending'
       )
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
       AND julianday(invitation.invited_at) <= julianday(NEW.accepted_at)
       AND julianday(invitation.expires_at) > julianday(NEW.accepted_at)
  ) THEN RAISE(ABORT, 'contributor invitation is not available') END;
END;

-- Proof consumption and access creation are one SQLite statement. A caller
-- cannot commit an acceptance without the matching exact-binding access grant.
CREATE TRIGGER artwork_contributor_invitation_accept_grant
AFTER INSERT ON artwork_contributor_invitation_acceptances
BEGIN
  INSERT INTO artwork_contributor_access_grants
    (invitation_id, keeper_piece_id, contributor_user_id, keeper_user_id,
     steward_version, granted_at)
  SELECT invitation.id, invitation.keeper_piece_id,
         invitation.intended_recipient_user_id, invitation.keeper_user_id,
         invitation.steward_version, NEW.accepted_at
    FROM artwork_contributor_invitations AS invitation
   WHERE invitation.id = NEW.invitation_id;
END;

CREATE TRIGGER artwork_contributor_grant_guard
BEFORE INSERT ON artwork_contributor_access_grants
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_invitation_acceptances AS acceptance
      JOIN artwork_contributor_invitations AS invitation
        ON invitation.id = acceptance.invitation_id
     WHERE acceptance.invitation_id = NEW.invitation_id
       AND invitation.keeper_piece_id = NEW.keeper_piece_id
       AND invitation.intended_recipient_user_id = NEW.contributor_user_id
       AND invitation.keeper_user_id = NEW.keeper_user_id
       AND invitation.steward_version = NEW.steward_version
       AND acceptance.accepted_at = NEW.granted_at
       AND NOT EXISTS (
         SELECT 1 FROM artwork_contributor_current_access AS current_access
          WHERE current_access.keeper_piece_id = NEW.keeper_piece_id
            AND current_access.contributor_user_id = NEW.contributor_user_id
       )
  ) THEN RAISE(ABORT, 'contributor access grant lacks accepted proof') END;
END;

CREATE TRIGGER artwork_contributor_invitation_revoke_guard
BEFORE INSERT ON artwork_contributor_revocations
WHEN NEW.revocation_kind = 'invitation'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_invitations AS invitation
      JOIN keeper_pieces AS piece ON piece.id = invitation.keeper_piece_id
     WHERE invitation.id = NEW.invitation_id
       AND invitation.keeper_user_id = NEW.revoked_by_keeper_user_id
       AND invitation.steward_version = NEW.steward_version
       AND piece.keeper_user_id = invitation.keeper_user_id
       AND piece.steward_version = invitation.steward_version
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND julianday(NEW.revoked_at) >= julianday(invitation.invited_at)
       AND julianday(NEW.revoked_at) < julianday(invitation.expires_at)
       AND NOT EXISTS (
         SELECT 1 FROM artwork_contributor_invitation_acceptances AS acceptance
          WHERE acceptance.invitation_id = invitation.id
       )
  ) THEN RAISE(ABORT, 'contributor invitation cannot be revoked') END;
END;

CREATE TRIGGER artwork_contributor_access_revoke_guard
BEFORE INSERT ON artwork_contributor_revocations
WHEN NEW.revocation_kind = 'access'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_current_access AS access
     WHERE access.invitation_id = NEW.invitation_id
       AND access.keeper_user_id = NEW.revoked_by_keeper_user_id
       AND access.steward_version = NEW.steward_version
       AND julianday(NEW.revoked_at) >= julianday(access.granted_at)
  ) THEN RAISE(ABORT, 'contributor access cannot be revoked') END;
END;

-- An active contributor may collaborate, but cannot use that relationship to
-- create a contested ownership claim. This protects every SQL caller, including
-- the existing core claim function, without broadening generic keeper auth.
CREATE TRIGGER artwork_claim_requests_contributor_guard
BEFORE INSERT ON artwork_claim_requests
WHEN EXISTS (
  SELECT 1 FROM artwork_contributor_current_access AS access
   WHERE access.keeper_piece_id = NEW.keeper_piece_id
     AND access.contributor_user_id = NEW.requester_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'active contributor cannot claim artwork');
END;

CREATE TRIGGER artwork_contributor_invitations_no_update
BEFORE UPDATE ON artwork_contributor_invitations BEGIN
  SELECT RAISE(ABORT, 'contributor invitations are append-only');
END;
CREATE TRIGGER artwork_contributor_invitations_no_delete
BEFORE DELETE ON artwork_contributor_invitations BEGIN
  SELECT RAISE(ABORT, 'contributor invitations are append-only');
END;
CREATE TRIGGER artwork_contributor_revocations_no_update
BEFORE UPDATE ON artwork_contributor_revocations BEGIN
  SELECT RAISE(ABORT, 'contributor revocations are append-only');
END;
CREATE TRIGGER artwork_contributor_revocations_no_delete
BEFORE DELETE ON artwork_contributor_revocations BEGIN
  SELECT RAISE(ABORT, 'contributor revocations are append-only');
END;
CREATE TRIGGER artwork_contributor_acceptances_no_update
BEFORE UPDATE ON artwork_contributor_invitation_acceptances BEGIN
  SELECT RAISE(ABORT, 'contributor invitation acceptances are append-only');
END;
CREATE TRIGGER artwork_contributor_acceptances_no_delete
BEFORE DELETE ON artwork_contributor_invitation_acceptances BEGIN
  SELECT RAISE(ABORT, 'contributor invitation acceptances are append-only');
END;
CREATE TRIGGER artwork_contributor_access_grants_no_update
BEFORE UPDATE ON artwork_contributor_access_grants BEGIN
  SELECT RAISE(ABORT, 'contributor access grants are append-only');
END;
CREATE TRIGGER artwork_contributor_access_grants_no_delete
BEFORE DELETE ON artwork_contributor_access_grants BEGIN
  SELECT RAISE(ABORT, 'contributor access grants are append-only');
END;
PRAGMA foreign_key_check;
