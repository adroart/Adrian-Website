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

PRAGMA foreign_key_check;
