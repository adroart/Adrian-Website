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

PRAGMA foreign_key_check;
