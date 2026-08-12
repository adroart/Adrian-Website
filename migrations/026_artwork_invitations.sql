-- Intended-recipient proof for the first keeper bind.

CREATE TABLE artwork_invitations (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 39
    AND substr(id, 1, 3) = 'iv-'
    AND substr(id, 12, 1) = '-'
    AND substr(id, 17, 1) = '-'
    AND substr(id, 18, 1) = '4'
    AND substr(id, 22, 1) = '-'
    AND substr(id, 23, 1) IN ('8', '9', 'a', 'b')
    AND substr(id, 27, 1) = '-'
    AND substr(id, 4) NOT GLOB '*[^0-9a-f-]*'
  ),
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  intended_recipient_email TEXT NOT NULL CHECK (
    length(trim(intended_recipient_email)) BETWEEN 3 AND 254
    AND intended_recipient_email = lower(trim(intended_recipient_email))
  ),
  created_by_user_id TEXT NOT NULL CHECK (
    length(trim(created_by_user_id)) BETWEEN 1 AND 128
  ),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  created_at TEXT NOT NULL CHECK (
    length(trim(created_at)) BETWEEN 20 AND 40
    AND created_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(created_at) IS NOT NULL
  ),
  expires_at TEXT NOT NULL CHECK (
    length(trim(expires_at)) BETWEEN 20 AND 40
    AND expires_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(expires_at) IS NOT NULL
    AND julianday(expires_at) > julianday(created_at)
  ),
  revoked_at TEXT CHECK (
    revoked_at IS NULL OR (
      length(trim(revoked_at)) BETWEEN 20 AND 40
      AND revoked_at GLOB '????-??-??T??:??:??*Z'
      AND julianday(revoked_at) IS NOT NULL
      AND julianday(revoked_at) >= julianday(created_at)
    )
  ),
  revoked_by_user_id TEXT CHECK (
    revoked_by_user_id IS NULL
    OR length(trim(revoked_by_user_id)) BETWEEN 1 AND 128
  ),
  CHECK (
    (revoked_at IS NULL AND revoked_by_user_id IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_artwork_invitations_piece_created
  ON artwork_invitations(keeper_piece_id, created_at DESC, id);

CREATE TABLE artwork_invitation_redemptions (
  invitation_id TEXT PRIMARY KEY
    REFERENCES artwork_invitations(id) ON DELETE RESTRICT,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  redeemed_by_user_id TEXT NOT NULL CHECK (
    length(trim(redeemed_by_user_id)) BETWEEN 1 AND 128
  ),
  verified_recipient_email TEXT NOT NULL CHECK (
    length(trim(verified_recipient_email)) BETWEEN 3 AND 254
    AND verified_recipient_email = lower(trim(verified_recipient_email))
  ),
  proof_reference TEXT NOT NULL UNIQUE CHECK (
    proof_reference = invitation_id
  ),
  presented_token_hash TEXT NOT NULL CHECK (
    length(presented_token_hash) = 64
    AND presented_token_hash = lower(presented_token_hash)
    AND presented_token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  redeemed_at TEXT NOT NULL CHECK (
    length(trim(redeemed_at)) BETWEEN 20 AND 40
    AND redeemed_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(redeemed_at) IS NOT NULL
  )
);

-- The authorization receipt is inserted before the canonical first-bind
-- statements. This completion receipt is inserted last and is the structural
-- transaction assertion: an incomplete bind raises here and rolls everything
-- back, including proof consumption.
CREATE TABLE artwork_invitation_redemption_completions (
  invitation_id TEXT PRIMARY KEY
    REFERENCES artwork_invitation_redemptions(invitation_id) ON DELETE RESTRICT,
  completed_at TEXT NOT NULL CHECK (
    length(trim(completed_at)) BETWEEN 20 AND 40
    AND completed_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(completed_at) IS NOT NULL
  )
);

CREATE TRIGGER artwork_invitation_redemption_guard
BEFORE INSERT ON artwork_invitation_redemptions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artwork_invitations invitation
      JOIN keeper_pieces piece ON piece.id = invitation.keeper_piece_id
     WHERE invitation.id = NEW.invitation_id
       AND invitation.keeper_piece_id = NEW.keeper_piece_id
       AND invitation.token_hash = NEW.presented_token_hash
       AND invitation.intended_recipient_email = NEW.verified_recipient_email
       AND invitation.revoked_at IS NULL
       AND julianday(invitation.created_at) <= julianday(NEW.redeemed_at)
       AND julianday(invitation.expires_at) > julianday(NEW.redeemed_at)
       AND piece.keeper_user_id IS NULL
       AND piece.claimed_at IS NULL
       AND piece.released_at IS NULL
  ) THEN RAISE(ABORT, 'invitation redemption is not available') END;
END;

CREATE TRIGGER artwork_invitation_redemption_complete
BEFORE INSERT ON artwork_invitation_redemption_completions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM artwork_invitation_redemptions redemption
      JOIN keeper_pieces piece ON piece.id = redemption.keeper_piece_id
      JOIN artwork_lineage_events lineage
        ON lineage.keeper_piece_id = piece.id
       AND lineage.event_type = 'first_bound'
       AND lineage.event_at = redemption.redeemed_at
       AND lineage.sequence = piece.lineage_event_count
       AND lineage.event_hash = piece.lineage_head_hash
      JOIN artwork_claim_evidence evidence
        ON evidence.keeper_piece_id = piece.id
       AND evidence.actor_user_id = redemption.redeemed_by_user_id
       AND evidence.verified_email = redemption.verified_recipient_email
       AND evidence.outcome = 'first_bound'
       AND evidence.created_at = redemption.redeemed_at
     WHERE redemption.invitation_id = NEW.invitation_id
       AND NEW.completed_at = redemption.redeemed_at
       AND piece.keeper_user_id = redemption.redeemed_by_user_id
       AND piece.claimed_at = redemption.redeemed_at
       AND piece.released_at IS NULL
       AND redemption.proof_reference = redemption.invitation_id
       AND json_valid(lineage.public_payload_json)
       AND json_type(lineage.public_payload_json) = 'object'
       AND (SELECT COUNT(*) FROM json_each(lineage.public_payload_json)) = 0
  ) THEN RAISE(ABORT, 'invitation redemption did not complete') END;
END;

CREATE TRIGGER artwork_invitations_immutable_fields
BEFORE UPDATE OF id, keeper_piece_id, token_hash, intended_recipient_email,
  created_by_user_id, idempotency_key, created_at, expires_at
ON artwork_invitations
BEGIN
  SELECT RAISE(ABORT, 'artwork invitation identity is immutable');
END;

CREATE TRIGGER artwork_invitations_revoke_once
BEFORE UPDATE OF revoked_at, revoked_by_user_id ON artwork_invitations
WHEN OLD.revoked_at IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM artwork_invitation_redemptions redemption
     WHERE redemption.invitation_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'artwork invitation cannot be revoked');
END;

CREATE TRIGGER artwork_invitations_no_delete
BEFORE DELETE ON artwork_invitations
BEGIN
  SELECT RAISE(ABORT, 'artwork invitations may not be deleted');
END;

CREATE TRIGGER artwork_invitation_redemptions_no_update
BEFORE UPDATE ON artwork_invitation_redemptions
BEGIN
  SELECT RAISE(ABORT, 'artwork invitation redemptions are append-only');
END;

CREATE TRIGGER artwork_invitation_redemptions_no_delete
BEFORE DELETE ON artwork_invitation_redemptions
BEGIN
  SELECT RAISE(ABORT, 'artwork invitation redemptions are append-only');
END;

CREATE TRIGGER artwork_invitation_redemption_completions_no_update
BEFORE UPDATE ON artwork_invitation_redemption_completions
BEGIN
  SELECT RAISE(ABORT, 'artwork invitation redemption completions are append-only');
END;

CREATE TRIGGER artwork_invitation_redemption_completions_no_delete
BEFORE DELETE ON artwork_invitation_redemption_completions
BEGIN
  SELECT RAISE(ABORT, 'artwork invitation redemption completions are append-only');
END;

PRAGMA foreign_key_check;
