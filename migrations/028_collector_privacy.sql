-- Private-by-default collector visibility. Ring 1 is invariant and therefore
-- has no stored switch. Every optional field below defaults to closed.

CREATE TABLE collector_curated_cities (
  id TEXT PRIMARY KEY CHECK (
    length(trim(id)) BETWEEN 2 AND 120
    AND id = lower(id)
    AND id NOT GLOB '*[^a-z0-9-]*'
  ),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 240),
  population INTEGER NOT NULL CHECK (population >= 50000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE collector_person_privacy (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_derived_chart INTEGER NOT NULL DEFAULT 0 CHECK (share_derived_chart IN (0, 1)),
  share_face INTEGER NOT NULL DEFAULT 0 CHECK (share_face IN (0, 1)),
  share_name INTEGER NOT NULL DEFAULT 0 CHECK (share_name IN (0, 1)),
  share_intention INTEGER NOT NULL DEFAULT 0 CHECK (share_intention IN (0, 1)),
  share_business INTEGER NOT NULL DEFAULT 0 CHECK (share_business IN (0, 1)),
  share_mission INTEGER NOT NULL DEFAULT 0 CHECK (share_mission IN (0, 1)),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 80),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '????-??-??T??:??:??*Z' AND julianday(updated_at) IS NOT NULL
  )
);

CREATE TABLE collector_piece_privacy (
  keeper_piece_id TEXT PRIMARY KEY REFERENCES keeper_pieces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_city INTEGER NOT NULL DEFAULT 0 CHECK (share_city IN (0, 1)),
  city_id TEXT REFERENCES collector_curated_cities(id) ON DELETE RESTRICT,
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 80),
  updated_at TEXT NOT NULL CHECK (
    updated_at GLOB '????-??-??T??:??:??*Z' AND julianday(updated_at) IS NOT NULL
  ),
  CHECK (
    (share_city = 0 AND city_id IS NULL)
    OR (share_city = 1 AND city_id IS NOT NULL)
  )
);

CREATE INDEX idx_collector_piece_privacy_user
  ON collector_piece_privacy(user_id, keeper_piece_id);

CREATE TABLE collector_consent_history (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 40
    AND substr(id, 1, 8) = 'consent-'
    AND substr(id, 9) NOT GLOB '*[^0-9a-f]*'
  ),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN ('person', 'piece')),
  target_ref TEXT NOT NULL CHECK (length(trim(target_ref)) BETWEEN 1 AND 128),
  before_json TEXT NOT NULL CHECK (json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 80),
  changed_at TEXT NOT NULL CHECK (
    changed_at GLOB '????-??-??T??:??:??*Z' AND julianday(changed_at) IS NOT NULL
  )
);

CREATE INDEX idx_collector_consent_history_user_time
  ON collector_consent_history(user_id, changed_at, id);

-- Consent history is a structural privacy boundary. Only the six person
-- switches or the two piece-city fields can enter it, even if a future writer
-- bypasses the application helper.
CREATE TRIGGER collector_consent_history_safe_insert
BEFORE INSERT ON collector_consent_history
WHEN NOT (
  NEW.policy_version = 'collector-privacy-v1'
  AND (
  (
    NEW.scope = 'person'
    AND NEW.target_ref = 'person'
    AND json_remove(
      NEW.before_json, '$.shareDerivedChart', '$.shareFace', '$.shareName',
      '$.shareIntention', '$.shareBusiness', '$.shareMission'
    ) = '{}'
    AND json_remove(
      NEW.after_json, '$.shareDerivedChart', '$.shareFace', '$.shareName',
      '$.shareIntention', '$.shareBusiness', '$.shareMission'
    ) = '{}'
    AND json_type(NEW.before_json, '$.shareDerivedChart') IN ('true', 'false')
    AND json_type(NEW.before_json, '$.shareFace') IN ('true', 'false')
    AND json_type(NEW.before_json, '$.shareName') IN ('true', 'false')
    AND json_type(NEW.before_json, '$.shareIntention') IN ('true', 'false')
    AND json_type(NEW.before_json, '$.shareBusiness') IN ('true', 'false')
    AND json_type(NEW.before_json, '$.shareMission') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.shareDerivedChart') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.shareFace') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.shareName') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.shareIntention') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.shareBusiness') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.shareMission') IN ('true', 'false')
  )
  OR
  (
    NEW.scope = 'piece'
    AND EXISTS (
      SELECT 1 FROM keeper_pieces WHERE keeper_pieces.id = NEW.target_ref
    )
    AND json_remove(NEW.before_json, '$.shareCity', '$.cityId') = '{}'
    AND json_remove(NEW.after_json, '$.shareCity', '$.cityId') = '{}'
    AND json_type(NEW.before_json, '$.shareCity') IN ('true', 'false')
    AND json_type(NEW.before_json, '$.cityId') IN ('null', 'text')
    AND json_type(NEW.after_json, '$.shareCity') IN ('true', 'false')
    AND json_type(NEW.after_json, '$.cityId') IN ('null', 'text')
    AND (
      (
        json_extract(NEW.before_json, '$.shareCity') = 0
        AND json_type(NEW.before_json, '$.cityId') = 'null'
      )
      OR (
        json_extract(NEW.before_json, '$.shareCity') = 1
        AND EXISTS (
          SELECT 1 FROM collector_curated_cities
           WHERE id = json_extract(NEW.before_json, '$.cityId')
             AND population >= 50000
        )
      )
    )
    AND (
      (
        json_extract(NEW.after_json, '$.shareCity') = 0
        AND json_type(NEW.after_json, '$.cityId') = 'null'
      )
      OR (
        json_extract(NEW.after_json, '$.shareCity') = 1
        AND EXISTS (
          SELECT 1 FROM collector_curated_cities
           WHERE id = json_extract(NEW.after_json, '$.cityId')
             AND active = 1 AND population >= 50000
        )
      )
    )
  )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'collector consent history accepts safe snapshots only');
END;

CREATE TRIGGER collector_consent_history_no_update
BEFORE UPDATE ON collector_consent_history
BEGIN
  SELECT RAISE(ABORT, 'collector consent history is append-only');
END;

CREATE TRIGGER collector_consent_history_no_delete
BEFORE DELETE ON collector_consent_history
BEGIN
  SELECT RAISE(ABORT, 'collector consent history is append-only');
END;

CREATE TRIGGER collector_adult_person_privacy_insert_guard
BEFORE INSERT ON collector_person_privacy
WHEN (
  NEW.share_derived_chart = 1 OR NEW.share_face = 1 OR NEW.share_name = 1
  OR NEW.share_intention = 1 OR NEW.share_business = 1 OR NEW.share_mission = 1
) AND NOT EXISTS (
  SELECT 1 FROM profiles
   WHERE profiles.user_id = NEW.user_id
     AND date(profiles.birth_date) = profiles.birth_date
     AND date(profiles.birth_date, '+18 years') <= date(NEW.updated_at)
)
BEGIN
  SELECT RAISE(ABORT, 'adult status is required for publicity');
END;

CREATE TRIGGER collector_adult_person_privacy_update_guard
BEFORE UPDATE ON collector_person_privacy
WHEN (
  NEW.share_derived_chart = 1 OR NEW.share_face = 1 OR NEW.share_name = 1
  OR NEW.share_intention = 1 OR NEW.share_business = 1 OR NEW.share_mission = 1
) AND NOT EXISTS (
  SELECT 1 FROM profiles
   WHERE profiles.user_id = NEW.user_id
     AND date(profiles.birth_date) = profiles.birth_date
     AND date(profiles.birth_date, '+18 years') <= date(NEW.updated_at)
)
BEGIN
  SELECT RAISE(ABORT, 'adult status is required for publicity');
END;

CREATE TRIGGER collector_adult_piece_privacy_insert_guard
BEFORE INSERT ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1 FROM profiles
   WHERE profiles.user_id = NEW.user_id
     AND date(profiles.birth_date) = profiles.birth_date
     AND date(profiles.birth_date, '+18 years') <= date(NEW.updated_at)
)
BEGIN
  SELECT RAISE(ABORT, 'adult status is required for publicity');
END;

CREATE TRIGGER collector_adult_piece_privacy_update_guard
BEFORE UPDATE ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1 FROM profiles
   WHERE profiles.user_id = NEW.user_id
     AND date(profiles.birth_date) = profiles.birth_date
     AND date(profiles.birth_date, '+18 years') <= date(NEW.updated_at)
)
BEGIN
  SELECT RAISE(ABORT, 'adult status is required for publicity');
END;

CREATE TRIGGER collector_active_city_piece_privacy_insert_guard
BEFORE INSERT ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1 FROM collector_curated_cities
   WHERE id = NEW.city_id AND active = 1 AND population >= 50000
)
BEGIN
  SELECT RAISE(ABORT, 'piece privacy requires an active curated city');
END;

CREATE TRIGGER collector_active_city_piece_privacy_update_guard
BEFORE UPDATE ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1 FROM collector_curated_cities
   WHERE id = NEW.city_id AND active = 1 AND population >= 50000
)
BEGIN
  SELECT RAISE(ABORT, 'piece privacy requires an active curated city');
END;

CREATE TRIGGER collector_piece_privacy_current_keeper_insert_guard
BEFORE INSERT ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1
    FROM keeper_pieces AS piece
    JOIN users AS account ON account.id = NEW.user_id
   WHERE piece.id = NEW.keeper_piece_id
     AND piece.keeper_user_id = account.auth_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'piece privacy requires the current keeper');
END;

CREATE TRIGGER collector_piece_privacy_current_keeper_update_guard
BEFORE UPDATE ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1
    FROM keeper_pieces AS piece
    JOIN users AS account ON account.id = NEW.user_id
   WHERE piece.id = NEW.keeper_piece_id
     AND piece.keeper_user_id = account.auth_user_id
)
BEGIN
  SELECT RAISE(ABORT, 'piece privacy requires the current keeper');
END;

-- Retiring a city closes every current city-level disclosure in the same
-- statement. The history guard permits the previously valid city in the
-- before snapshot, but an after snapshot can open only onto an active city.
CREATE TRIGGER collector_curated_city_retire_revoke
AFTER UPDATE OF active ON collector_curated_cities
WHEN OLD.active = 1 AND NEW.active = 0
AND EXISTS (
  SELECT 1 FROM collector_piece_privacy
   WHERE city_id = NEW.id AND share_city = 1
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'piece',
    keeper_piece_id,
    json_object('shareCity', json('true'), 'cityId', city_id),
    json_object('shareCity', json('false'), 'cityId', json('null')),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM collector_piece_privacy
  WHERE city_id = NEW.id AND share_city = 1;

  UPDATE collector_piece_privacy
     SET share_city = 0,
         city_id = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE city_id = NEW.id AND share_city = 1;
END;

-- Optional public choices require a shared profile that establishes adulthood.
-- If an adult profile is later changed to a minor profile, close every switch
-- and record that revocation in the same statement.
CREATE TRIGGER collector_minor_profile_insert_revoke
AFTER INSERT ON profiles
WHEN COALESCE(
  date(NEW.birth_date) = NEW.birth_date
  AND date(NEW.birth_date, '+18 years') <= date(NEW.updated_at, 'unixepoch'),
  0
) = 0
AND EXISTS (
  SELECT 1 FROM collector_person_privacy
   WHERE user_id = NEW.user_id
     AND (
       share_derived_chart = 1 OR share_face = 1 OR share_name = 1
       OR share_intention = 1 OR share_business = 1 OR share_mission = 1
     )
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'person',
    'person',
    json_object(
      'shareDerivedChart', json(CASE share_derived_chart WHEN 1 THEN 'true' ELSE 'false' END),
      'shareFace', json(CASE share_face WHEN 1 THEN 'true' ELSE 'false' END),
      'shareName', json(CASE share_name WHEN 1 THEN 'true' ELSE 'false' END),
      'shareIntention', json(CASE share_intention WHEN 1 THEN 'true' ELSE 'false' END),
      'shareBusiness', json(CASE share_business WHEN 1 THEN 'true' ELSE 'false' END),
      'shareMission', json(CASE share_mission WHEN 1 THEN 'true' ELSE 'false' END)
    ),
    json_object(
      'shareDerivedChart', json('false'), 'shareFace', json('false'),
      'shareName', json('false'), 'shareIntention', json('false'),
      'shareBusiness', json('false'), 'shareMission', json('false')
    ),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
  FROM collector_person_privacy
  WHERE user_id = NEW.user_id;

  UPDATE collector_person_privacy
     SET share_derived_chart = 0,
         share_face = 0,
         share_name = 0,
         share_intention = 0,
         share_business = 0,
         share_mission = 0,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
   WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER collector_minor_profile_update_revoke
AFTER UPDATE OF birth_date ON profiles
WHEN COALESCE(
  date(NEW.birth_date) = NEW.birth_date
  AND date(NEW.birth_date, '+18 years') <= date(NEW.updated_at, 'unixepoch'),
  0
) = 0
AND EXISTS (
  SELECT 1 FROM collector_person_privacy
   WHERE user_id = NEW.user_id
     AND (
       share_derived_chart = 1 OR share_face = 1 OR share_name = 1
       OR share_intention = 1 OR share_business = 1 OR share_mission = 1
     )
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'person',
    'person',
    json_object(
      'shareDerivedChart', json(CASE share_derived_chart WHEN 1 THEN 'true' ELSE 'false' END),
      'shareFace', json(CASE share_face WHEN 1 THEN 'true' ELSE 'false' END),
      'shareName', json(CASE share_name WHEN 1 THEN 'true' ELSE 'false' END),
      'shareIntention', json(CASE share_intention WHEN 1 THEN 'true' ELSE 'false' END),
      'shareBusiness', json(CASE share_business WHEN 1 THEN 'true' ELSE 'false' END),
      'shareMission', json(CASE share_mission WHEN 1 THEN 'true' ELSE 'false' END)
    ),
    json_object(
      'shareDerivedChart', json('false'), 'shareFace', json('false'),
      'shareName', json('false'), 'shareIntention', json('false'),
      'shareBusiness', json('false'), 'shareMission', json('false')
    ),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
  FROM collector_person_privacy
  WHERE user_id = NEW.user_id;

  UPDATE collector_person_privacy
     SET share_derived_chart = 0,
         share_face = 0,
         share_name = 0,
         share_intention = 0,
         share_business = 0,
         share_mission = 0,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
   WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER collector_minor_profile_insert_piece_revoke
AFTER INSERT ON profiles
WHEN COALESCE(
  date(NEW.birth_date) = NEW.birth_date
  AND date(NEW.birth_date, '+18 years') <= date(NEW.updated_at, 'unixepoch'),
  0
) = 0
AND EXISTS (
  SELECT 1 FROM collector_piece_privacy
   WHERE user_id = NEW.user_id AND share_city = 1
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'piece',
    keeper_piece_id,
    json_object('shareCity', json('true'), 'cityId', city_id),
    json_object('shareCity', json('false'), 'cityId', json('null')),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
  FROM collector_piece_privacy
  WHERE user_id = NEW.user_id AND share_city = 1;

  UPDATE collector_piece_privacy
     SET share_city = 0,
         city_id = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
   WHERE user_id = NEW.user_id AND share_city = 1;
END;

CREATE TRIGGER collector_minor_profile_update_piece_revoke
AFTER UPDATE OF birth_date ON profiles
WHEN COALESCE(
  date(NEW.birth_date) = NEW.birth_date
  AND date(NEW.birth_date, '+18 years') <= date(NEW.updated_at, 'unixepoch'),
  0
) = 0
AND EXISTS (
  SELECT 1 FROM collector_piece_privacy
   WHERE user_id = NEW.user_id AND share_city = 1
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'piece',
    keeper_piece_id,
    json_object('shareCity', json('true'), 'cityId', city_id),
    json_object('shareCity', json('false'), 'cityId', json('null')),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
  FROM collector_piece_privacy
  WHERE user_id = NEW.user_id AND share_city = 1;

  UPDATE collector_piece_privacy
     SET share_city = 0,
         city_id = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.updated_at, 'unixepoch')
   WHERE user_id = NEW.user_id AND share_city = 1;
END;

-- Removing the shared profile also removes the positive adult-status evidence.
-- Close all public choices before the profile disappears.
CREATE TRIGGER collector_profile_delete_person_revoke
BEFORE DELETE ON profiles
WHEN EXISTS (
  SELECT 1 FROM collector_person_privacy
   WHERE user_id = OLD.user_id
     AND (
       share_derived_chart = 1 OR share_face = 1 OR share_name = 1
       OR share_intention = 1 OR share_business = 1 OR share_mission = 1
     )
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'person',
    'person',
    json_object(
      'shareDerivedChart', json(CASE share_derived_chart WHEN 1 THEN 'true' ELSE 'false' END),
      'shareFace', json(CASE share_face WHEN 1 THEN 'true' ELSE 'false' END),
      'shareName', json(CASE share_name WHEN 1 THEN 'true' ELSE 'false' END),
      'shareIntention', json(CASE share_intention WHEN 1 THEN 'true' ELSE 'false' END),
      'shareBusiness', json(CASE share_business WHEN 1 THEN 'true' ELSE 'false' END),
      'shareMission', json(CASE share_mission WHEN 1 THEN 'true' ELSE 'false' END)
    ),
    json_object(
      'shareDerivedChart', json('false'), 'shareFace', json('false'),
      'shareName', json('false'), 'shareIntention', json('false'),
      'shareBusiness', json('false'), 'shareMission', json('false')
    ),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM collector_person_privacy
  WHERE user_id = OLD.user_id;

  UPDATE collector_person_privacy
     SET share_derived_chart = 0,
         share_face = 0,
         share_name = 0,
         share_intention = 0,
         share_business = 0,
         share_mission = 0,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER collector_profile_delete_piece_revoke
BEFORE DELETE ON profiles
WHEN EXISTS (
  SELECT 1 FROM collector_piece_privacy
   WHERE user_id = OLD.user_id AND share_city = 1
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'piece',
    keeper_piece_id,
    json_object('shareCity', json('true'), 'cityId', city_id),
    json_object('shareCity', json('false'), 'cityId', json('null')),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM collector_piece_privacy
  WHERE user_id = OLD.user_id AND share_city = 1;

  UPDATE collector_piece_privacy
     SET share_city = 0,
         city_id = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE user_id = OLD.user_id AND share_city = 1;
END;

-- City consent belongs to a specific keeper's relationship with the piece.
-- A transfer closes it in the same database statement, before the next keeper
-- can make an independent choice.
CREATE TRIGGER collector_piece_privacy_transfer_revoke
AFTER UPDATE OF keeper_user_id ON keeper_pieces
WHEN NEW.keeper_user_id IS NOT OLD.keeper_user_id
AND EXISTS (
  SELECT 1 FROM collector_piece_privacy
   WHERE keeper_piece_id = NEW.id AND share_city = 1
)
BEGIN
  INSERT INTO collector_consent_history
    (id, user_id, scope, target_ref, before_json, after_json,
     policy_version, changed_at)
  SELECT
    'consent-' || lower(hex(randomblob(16))),
    user_id,
    'piece',
    keeper_piece_id,
    json_object('shareCity', json('true'), 'cityId', city_id),
    json_object('shareCity', json('false'), 'cityId', json('null')),
    policy_version,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM collector_piece_privacy
  WHERE keeper_piece_id = NEW.id AND share_city = 1;

  UPDATE collector_piece_privacy
     SET share_city = 0,
         city_id = NULL,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE keeper_piece_id = NEW.id AND share_city = 1;
END;

PRAGMA foreign_key_check;
