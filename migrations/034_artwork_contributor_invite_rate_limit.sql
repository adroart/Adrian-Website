-- Transient contributor-invite security state, intentionally excluded from
-- encrypted business recovery. Restores start with a fresh rate-limit window.
--
-- Contributor invitations are rare, but a keeper may legitimately set up a
-- small group at once. Ten attempts per UTC hour preserves that burst while
-- durably bounding account-state probes across isolates. This mutable bucket
-- is keyed only to the authenticated keeper and stores no recipient, artwork,
-- proof, or request identifiers.
CREATE TABLE artwork_contributor_invite_rate_limits (
  keeper_user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE RESTRICT
    CHECK (length(trim(keeper_user_id)) BETWEEN 1 AND 128),
  window_started_at TEXT NOT NULL CHECK (
    length(window_started_at) = 24
    AND window_started_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(window_started_at) IS NOT NULL
  ),
  attempt_count INTEGER NOT NULL CHECK (
    typeof(attempt_count) = 'integer' AND attempt_count BETWEEN 1 AND 10
  ),
  last_attempt_at TEXT NOT NULL CHECK (
    length(last_attempt_at) = 24
    AND last_attempt_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(last_attempt_at) >= julianday(window_started_at)
    AND julianday(last_attempt_at) < julianday(window_started_at, '+1 hour')
  )
);

-- Transient winner-election state. It binds one private idempotency key to one
-- immutable request digest without storing recipient, artwork, proof, or token
-- data. A short renewable lease permits generation-CAS takeover after a worker
-- disappears. Completed rows let racing losers find the business invitation.
CREATE TABLE artwork_contributor_invite_reservations (
  idempotency_key TEXT PRIMARY KEY CHECK (
    length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  request_fingerprint TEXT NOT NULL CHECK (
    length(request_fingerprint) = 64
    AND request_fingerprint = lower(request_fingerprint)
    AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  keeper_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT
    CHECK (length(trim(keeper_user_id)) BETWEEN 1 AND 128),
  lease_generation INTEGER NOT NULL CHECK (
    typeof(lease_generation) = 'integer' AND lease_generation >= 1
  ),
  reservation_status TEXT NOT NULL CHECK (
    reservation_status IN ('reserved', 'completed')
  ),
  reserved_at TEXT NOT NULL CHECK (
    length(reserved_at) = 24
    AND reserved_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(reserved_at) IS NOT NULL
  ),
  lease_expires_at TEXT NOT NULL CHECK (
    length(lease_expires_at) = 24
    AND lease_expires_at GLOB '????-??-??T??:??:??.???Z'
    AND julianday(lease_expires_at) > julianday(reserved_at)
  ),
  completed_invitation_id TEXT UNIQUE CHECK (
    completed_invitation_id IS NULL OR (
      length(completed_invitation_id) = 40
      AND substr(completed_invitation_id, 1, 4) = 'aci-'
    )
  ),
  completed_at TEXT CHECK (
    completed_at IS NULL OR (
      length(completed_at) = 24
      AND completed_at GLOB '????-??-??T??:??:??.???Z'
      AND julianday(completed_at) >= julianday(reserved_at)
    )
  ),
  CHECK (
    (reservation_status = 'reserved'
      AND completed_invitation_id IS NULL AND completed_at IS NULL)
    OR
    (reservation_status = 'completed'
      AND completed_invitation_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

-- Application-created invitations must still own the current private lease.
-- Historical/offline inserts without an operational reservation remain
-- possible for the separately guarded recovery path.
CREATE TRIGGER artwork_contributor_invite_reservation_guard
BEFORE INSERT ON artwork_contributor_invitations
WHEN EXISTS (
  SELECT 1 FROM artwork_contributor_invite_reservations
   WHERE idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM artwork_contributor_invite_reservations
     WHERE idempotency_key = NEW.idempotency_key
       AND request_fingerprint = NEW.request_fingerprint
       AND keeper_user_id = NEW.keeper_user_id
       AND reservation_status = 'reserved'
       AND completed_invitation_id IS NULL
       AND julianday(lease_expires_at) > julianday('now')
  ) THEN RAISE(ABORT, 'contributor invite reservation unavailable') END;
END;

-- The counter update and invitation insertion are one SQLite statement. If an
-- identical in-flight request loses the invitation uniqueness race, SQLite
-- rolls its counter update back before the application replays the winner.
CREATE TRIGGER artwork_contributor_invite_rate_limit_guard
BEFORE INSERT ON artwork_contributor_invitations
BEGIN
  INSERT INTO artwork_contributor_invite_rate_limits
    (keeper_user_id, window_started_at, attempt_count, last_attempt_at)
  VALUES (
    NEW.keeper_user_id,
    strftime('%Y-%m-%dT%H:00:00.000Z', NEW.invited_at),
    1,
    NEW.invited_at
  )
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
      AND artwork_contributor_invite_rate_limits.attempt_count < 10
    )
  );
  SELECT CASE WHEN changes() <> 1
    THEN RAISE(ABORT, 'contributor invite rate limited') END;
END;

CREATE TRIGGER artwork_contributor_invite_reservation_complete
AFTER INSERT ON artwork_contributor_invitations
WHEN EXISTS (
  SELECT 1 FROM artwork_contributor_invite_reservations
   WHERE idempotency_key = NEW.idempotency_key
)
BEGIN
  UPDATE artwork_contributor_invite_reservations
     SET reservation_status = 'completed',
         completed_invitation_id = NEW.id,
         completed_at = NEW.invited_at
   WHERE idempotency_key = NEW.idempotency_key
     AND request_fingerprint = NEW.request_fingerprint
     AND keeper_user_id = NEW.keeper_user_id
     AND reservation_status = 'reserved';
  SELECT CASE WHEN changes() <> 1
    THEN RAISE(ABORT, 'contributor invite reservation completion failed') END;
END;

PRAGMA foreign_key_check;
