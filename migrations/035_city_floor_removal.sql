-- Remove the 50,000-population floor on curated cities (ruling 2026-08-20):
-- collectors may share whichever curated city they live in. The population
-- column stays as information; nothing gates on it anymore.
--
-- collector_curated_cities is rebuilt without the population floor CHECK.
-- collector_piece_privacy references the table by name, so the copy -> drop ->
-- rename swap keeps its foreign key valid. The three surviving triggers whose
-- bodies name the table (and enforce the floor) are dropped before the rebuild
-- so the rename's schema re-parse never sees a dangling reference, then
-- recreated without the population condition. The retire-revoke trigger lives
-- on the rebuilt table itself, so the DROP TABLE removes it; it is recreated
-- verbatim.

PRAGMA defer_foreign_keys = on;

DROP TRIGGER collector_consent_history_safe_insert;
DROP TRIGGER collector_active_city_piece_privacy_insert_guard;
DROP TRIGGER collector_active_city_piece_privacy_update_guard;

CREATE TABLE collector_curated_cities_no_floor (
  id TEXT PRIMARY KEY CHECK (
    length(trim(id)) BETWEEN 2 AND 120
    AND id = lower(id)
    AND id NOT GLOB '*[^a-z0-9-]*'
  ),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 240),
  population INTEGER NOT NULL CHECK (population >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

INSERT INTO collector_curated_cities_no_floor (id, label, population, active)
SELECT id, label, population, active FROM collector_curated_cities;

DROP TABLE collector_curated_cities;

ALTER TABLE collector_curated_cities_no_floor RENAME TO collector_curated_cities;

-- Recreated from 028 without the population conditions. The before snapshot
-- accepts any curated city (a since-retired city stays valid history); the
-- after snapshot can open only onto an active curated city.
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
             AND active = 1
        )
      )
    )
  )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'collector consent history accepts safe snapshots only');
END;

CREATE TRIGGER collector_active_city_piece_privacy_insert_guard
BEFORE INSERT ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1 FROM collector_curated_cities
   WHERE id = NEW.city_id AND active = 1
)
BEGIN
  SELECT RAISE(ABORT, 'piece privacy requires an active curated city');
END;

CREATE TRIGGER collector_active_city_piece_privacy_update_guard
BEFORE UPDATE ON collector_piece_privacy
WHEN NEW.share_city = 1 AND NOT EXISTS (
  SELECT 1 FROM collector_curated_cities
   WHERE id = NEW.city_id AND active = 1
)
BEGIN
  SELECT RAISE(ABORT, 'piece privacy requires an active curated city');
END;

-- Recreated verbatim from 028 (dropped with the table). Retiring a city closes
-- every current city-level disclosure in the same statement.
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

PRAGMA foreign_key_check;
