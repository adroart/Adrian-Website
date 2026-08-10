-- Mutable dreams and their private yearly ritual, attached to canonical artwork identity.

CREATE TABLE collector_dreams (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL CHECK (length(trim(author_user_id)) BETWEEN 1 AND 128),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  scope TEXT NOT NULL CHECK (scope IN ('self', 'family', 'community', 'planet')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN (
    'private', 'anonymous', 'attributed'
  )),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (record_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  public_shared_at TEXT,
  public_revoked_at TEXT,
  fulfilled_at TEXT,
  archived_at TEXT,
  last_mutation_id TEXT
    REFERENCES collector_dream_mutations(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (author_user_id, idempotency_key),
  CHECK (
    (visibility = 'private'
      AND (public_shared_at IS NULL OR public_revoked_at IS NOT NULL))
    OR (visibility IN ('anonymous', 'attributed')
      AND (public_revoked_at IS NULL OR public_shared_at IS NOT NULL))
  )
);
CREATE UNIQUE INDEX collector_dreams_one_current
  ON collector_dreams(keeper_piece_id) WHERE archived_at IS NULL;
CREATE INDEX collector_dreams_piece_history
  ON collector_dreams(keeper_piece_id, created_at, id);

CREATE TABLE collector_dream_markers (
  id TEXT PRIMARY KEY,
  dream_id TEXT NOT NULL REFERENCES collector_dreams(id) ON DELETE RESTRICT,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL CHECK (length(trim(author_user_id)) BETWEEN 1 AND 128),
  marker_kind TEXT NOT NULL CHECK (marker_kind IN (
    'milestone', 'change', 'encounter', 'fulfillment'
  )),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  created_at TEXT NOT NULL,
  UNIQUE (author_user_id, idempotency_key)
);
CREATE INDEX collector_dream_markers_thread
  ON collector_dream_markers(dream_id, created_at, id);

CREATE TABLE collector_dream_mutations (
  id TEXT PRIMARY KEY,
  dream_id TEXT NOT NULL REFERENCES collector_dreams(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL CHECK (length(trim(author_user_id)) BETWEEN 1 AND 128),
  action TEXT NOT NULL CHECK (action IN ('edit', 'share', 'revoke')),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  request_json TEXT CHECK (
    request_json IS NULL
    OR (json_valid(request_json) AND json_type(request_json) = 'object')
  ),
  resulting_version INTEGER NOT NULL CHECK (resulting_version > 1),
  created_at TEXT NOT NULL,
  UNIQUE (author_user_id, idempotency_key)
);

CREATE TABLE collector_dream_rituals (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  keeper_user_id TEXT NOT NULL CHECK (length(trim(keeper_user_id)) BETWEEN 1 AND 128),
  birthday_year INTEGER NOT NULL CHECK (birthday_year BETWEEN 1900 AND 9999),
  action TEXT NOT NULL CHECK (action IN ('reinforce', 'plant-new', 'fulfilled')),
  prior_dream_id TEXT NOT NULL REFERENCES collector_dreams(id) ON DELETE RESTRICT,
  resulting_dream_id TEXT NOT NULL REFERENCES collector_dreams(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  completed_at TEXT NOT NULL,
  UNIQUE (keeper_piece_id, keeper_user_id, birthday_year),
  UNIQUE (keeper_user_id, idempotency_key)
);
CREATE INDEX collector_dream_rituals_piece
  ON collector_dream_rituals(keeper_piece_id, completed_at, id);

CREATE TRIGGER collector_dream_markers_no_update
BEFORE UPDATE ON collector_dream_markers BEGIN
  SELECT RAISE(ABORT, 'dream markers are append-only');
END;
CREATE TRIGGER collector_dream_markers_no_delete
BEFORE DELETE ON collector_dream_markers BEGIN
  SELECT RAISE(ABORT, 'dream markers are append-only');
END;
CREATE TRIGGER collector_dream_mutations_no_update
BEFORE UPDATE ON collector_dream_mutations BEGIN
  SELECT RAISE(ABORT, 'dream mutations are append-only');
END;
CREATE TRIGGER collector_dream_mutations_no_delete
BEFORE DELETE ON collector_dream_mutations BEGIN
  SELECT RAISE(ABORT, 'dream mutations are append-only');
END;
CREATE TRIGGER collector_dream_rituals_no_update
BEFORE UPDATE ON collector_dream_rituals BEGIN
  SELECT RAISE(ABORT, 'dream rituals are append-only');
END;
CREATE TRIGGER collector_dream_rituals_no_delete
BEFORE DELETE ON collector_dream_rituals BEGIN
  SELECT RAISE(ABORT, 'dream rituals are append-only');
END;
CREATE TRIGGER collector_dreams_no_delete
BEFORE DELETE ON collector_dreams BEGIN
  SELECT RAISE(ABORT, 'dream records may not be deleted');
END;

CREATE TRIGGER collector_dreams_insert_current_keeper
BEFORE INSERT ON collector_dreams BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM keeper_pieces piece
     WHERE piece.id = NEW.keeper_piece_id
       AND piece.keeper_user_id = NEW.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  ) THEN RAISE(ABORT, 'dream requires current keeper') END;
  SELECT CASE WHEN NEW.visibility IN ('anonymous', 'attributed')
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN profiles profile ON profile.user_id = person.id
       WHERE person.auth_user_id = NEW.author_user_id
         AND date(profile.birth_date, '+18 years') <= date(NEW.created_at)
    ) THEN RAISE(ABORT, 'public dream requires established adult') END;
  SELECT CASE WHEN NEW.visibility = 'attributed'
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN collector_person_privacy privacy ON privacy.user_id = person.id
       WHERE person.auth_user_id = NEW.author_user_id
         AND privacy.share_name = 1
    ) THEN RAISE(ABORT, 'attributed dream requires name consent') END;
END;

CREATE TRIGGER collector_dreams_update_current_keeper
BEFORE UPDATE ON collector_dreams
WHEN NEW.archived_at IS OLD.archived_at
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM keeper_pieces piece
     WHERE piece.id = OLD.keeper_piece_id
       AND piece.keeper_user_id = OLD.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  ) AND NOT (
    OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
    AND NEW.body = OLD.body AND NEW.scope = OLD.scope
    AND NEW.public_shared_at IS OLD.public_shared_at
    AND NEW.fulfilled_at IS OLD.fulfilled_at
    AND NEW.archived_at IS OLD.archived_at
  ) THEN RAISE(ABORT, 'dream change requires current keeper') END;
  SELECT CASE WHEN NEW.visibility IN ('anonymous', 'attributed')
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN profiles profile ON profile.user_id = person.id
       WHERE person.auth_user_id = OLD.author_user_id
         AND date(profile.birth_date, '+18 years') <= date(NEW.updated_at)
    )
    AND NOT (
      OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.public_shared_at IS OLD.public_shared_at
    ) THEN RAISE(ABORT, 'public dream requires established adult') END;
  SELECT CASE WHEN NEW.visibility = 'attributed'
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN collector_person_privacy privacy ON privacy.user_id = person.id
       WHERE person.auth_user_id = OLD.author_user_id
         AND privacy.share_name = 1
    ) THEN RAISE(ABORT, 'attributed dream requires name consent') END;
END;

CREATE TRIGGER collector_dream_markers_current_keeper
BEFORE INSERT ON collector_dream_markers BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
    JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
     WHERE dream.id = NEW.dream_id
       AND dream.keeper_piece_id = NEW.keeper_piece_id
       AND dream.archived_at IS NULL
       AND piece.keeper_user_id = NEW.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  ) THEN RAISE(ABORT, 'dream marker requires current keeper') END;
END;

CREATE TRIGGER collector_dream_rituals_valid_completion
BEFORE INSERT ON collector_dream_rituals BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM collector_dreams prior
    JOIN collector_dreams resulting ON resulting.id = NEW.resulting_dream_id
    JOIN keeper_pieces piece ON piece.id = NEW.keeper_piece_id
     WHERE prior.id = NEW.prior_dream_id
       AND prior.keeper_piece_id = NEW.keeper_piece_id
       AND resulting.keeper_piece_id = NEW.keeper_piece_id
       AND piece.keeper_user_id = NEW.keeper_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
       AND (
         (NEW.action = 'reinforce' AND prior.id = resulting.id
           AND prior.archived_at IS NULL)
         OR (NEW.action = 'fulfilled' AND prior.id = resulting.id
           AND prior.fulfilled_at IS NULL AND prior.archived_at IS NULL)
         OR (NEW.action = 'plant-new' AND prior.id <> resulting.id
           AND prior.archived_at = NEW.completed_at
           AND resulting.archived_at IS NULL
           AND resulting.created_at = NEW.completed_at)
       )
  ) THEN RAISE(ABORT, 'invalid dream ritual completion') END;
END;

-- One mutation insert performs the exact permitted dream update. No caller can
-- combine an unrelated field change with an audit that labels it as edit,
-- share, or revoke, and a zero-row update aborts the insert statement.
-- Trusted clean recovery temporarily removes this guard so older archives can
-- restore historical rows that predate request_json, then recreates it exactly.
CREATE TRIGGER collector_dream_mutation_exact_application
BEFORE INSERT ON collector_dream_mutations
BEGIN
  SELECT CASE WHEN NEW.request_json IS NULL
    OR json_valid(NEW.request_json) = 0
    OR json_type(NEW.request_json) <> 'object'
    OR NOT EXISTS (
      SELECT 1
        FROM collector_dreams dream
        JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
       WHERE dream.id = NEW.dream_id
         AND dream.author_user_id = NEW.author_user_id
         AND dream.archived_at IS NULL
         AND dream.record_version + 1 = NEW.resulting_version
         AND piece.keeper_user_id = NEW.author_user_id
         AND piece.claimed_at IS NOT NULL
         AND piece.released_at IS NULL
         AND piece.plate_status NOT IN ('void', 'superseded')
         AND (
           (
             NEW.action = 'edit'
             AND json_remove(
               NEW.request_json, '$.body', '$.scope', '$.expectedVersion'
             ) = '{}'
             AND json_type(NEW.request_json, '$.body') = 'text'
             AND json_type(NEW.request_json, '$.scope') = 'text'
             AND json_type(NEW.request_json, '$.expectedVersion') = 'integer'
             AND dream.record_version =
               json_extract(NEW.request_json, '$.expectedVersion')
           )
           OR (
             NEW.action = 'share'
             AND json_remove(NEW.request_json, '$.visibility') = '{}'
             AND json_extract(NEW.request_json, '$.visibility')
               IN ('anonymous', 'attributed')
           )
           OR (
             NEW.action = 'revoke'
             AND json_remove(NEW.request_json, '$.visibility') = '{}'
             AND json_extract(NEW.request_json, '$.visibility') = 'private'
             AND dream.public_shared_at IS NOT NULL
           )
         )
    ) THEN RAISE(ABORT, 'dream mutation did not apply exactly') END;
END;

CREATE TRIGGER collector_dream_mutation_apply_exactly
AFTER INSERT ON collector_dream_mutations
BEGIN
  UPDATE collector_dreams
     SET body = json_extract(NEW.request_json, '$.body'),
         scope = json_extract(NEW.request_json, '$.scope'),
         updated_at = NEW.created_at,
         record_version = record_version + 1,
         last_mutation_id = NEW.id
   WHERE NEW.action = 'edit'
     AND id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND record_version = json_extract(NEW.request_json, '$.expectedVersion');

  UPDATE collector_dreams
     SET visibility = json_extract(NEW.request_json, '$.visibility'),
         public_shared_at = NEW.created_at,
         public_revoked_at = NULL,
         updated_at = NEW.created_at,
         record_version = record_version + 1,
         last_mutation_id = NEW.id
   WHERE NEW.action = 'share'
     AND id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND record_version + 1 = NEW.resulting_version;

  UPDATE collector_dreams
     SET visibility = 'private',
         public_revoked_at = NEW.created_at,
         updated_at = NEW.created_at,
         record_version = record_version + 1,
         last_mutation_id = NEW.id
   WHERE NEW.action = 'revoke'
     AND id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND public_shared_at IS NOT NULL
     AND record_version + 1 = NEW.resulting_version;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
     WHERE dream.id = NEW.dream_id
       AND dream.last_mutation_id = NEW.id
       AND dream.record_version = NEW.resulting_version
       AND dream.updated_at = NEW.created_at
       AND (
         (NEW.action = 'edit'
           AND dream.body = json_extract(NEW.request_json, '$.body')
           AND dream.scope = json_extract(NEW.request_json, '$.scope'))
         OR (NEW.action = 'share'
           AND dream.visibility = json_extract(NEW.request_json, '$.visibility')
           AND dream.public_shared_at = NEW.created_at
           AND dream.public_revoked_at IS NULL)
         OR (NEW.action = 'revoke'
           AND dream.visibility = 'private'
           AND dream.public_shared_at IS NOT NULL
           AND dream.public_revoked_at = NEW.created_at)
       )
  ) THEN RAISE(ABORT, 'dream mutation did not apply exactly') END;
END;

-- Every mutable dream update is either the exact effect of the mutation row
-- already being inserted, a ritual fulfillment row already being inserted, or
-- a narrow fail-safe closure. A caller cannot pre-change another field and
-- then hide it beneath a valid mutation audit in the same transaction.
CREATE TRIGGER collector_dreams_runtime_update_guard
BEFORE UPDATE ON collector_dreams
BEGIN
  SELECT CASE WHEN NOT (
    EXISTS (
      SELECT 1 FROM collector_dream_mutations mutation
       WHERE mutation.id = NEW.last_mutation_id
         AND mutation.dream_id = OLD.id
         AND mutation.author_user_id = OLD.author_user_id
         AND mutation.resulting_version = OLD.record_version + 1
         AND NEW.record_version = mutation.resulting_version
         AND NEW.updated_at = mutation.created_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND (
           (mutation.action = 'edit'
             AND NEW.body = json_extract(mutation.request_json, '$.body')
             AND NEW.scope = json_extract(mutation.request_json, '$.scope')
             AND NEW.visibility = OLD.visibility
             AND NEW.public_shared_at IS OLD.public_shared_at
             AND NEW.public_revoked_at IS OLD.public_revoked_at
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
           OR (mutation.action = 'share'
             AND NEW.body = OLD.body AND NEW.scope = OLD.scope
             AND NEW.visibility = json_extract(mutation.request_json, '$.visibility')
             AND NEW.public_shared_at = mutation.created_at
             AND NEW.public_revoked_at IS NULL
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
           OR (mutation.action = 'revoke'
             AND NEW.body = OLD.body AND NEW.scope = OLD.scope
             AND NEW.visibility = 'private'
             AND NEW.public_shared_at IS OLD.public_shared_at
             AND NEW.public_revoked_at = mutation.created_at
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
         )
    )
    OR EXISTS (
      SELECT 1 FROM collector_dream_rituals ritual
       WHERE ritual.action = 'fulfilled'
         AND ritual.prior_dream_id = OLD.id
         AND ritual.resulting_dream_id = OLD.id
         AND ritual.completed_at = NEW.fulfilled_at
         AND OLD.fulfilled_at IS NULL
         AND NEW.body = OLD.body AND NEW.scope = OLD.scope
         AND NEW.visibility = OLD.visibility
         AND NEW.public_shared_at IS OLD.public_shared_at
         AND NEW.public_revoked_at IS OLD.public_revoked_at
         AND NEW.archived_at IS OLD.archived_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.last_mutation_id IS OLD.last_mutation_id
         AND NEW.updated_at = ritual.completed_at
         AND NEW.record_version = OLD.record_version + 1
    )
    OR (
      OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
      AND NEW.updated_at = NEW.archived_at
      AND NEW.record_version = OLD.record_version + 1
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.visibility = OLD.visibility
      AND NEW.public_shared_at IS OLD.public_shared_at
      AND NEW.public_revoked_at IS (
        CASE WHEN OLD.public_shared_at IS NOT NULL
          THEN NEW.archived_at ELSE OLD.public_revoked_at END
      )
      AND NEW.fulfilled_at IS OLD.fulfilled_at
      AND NEW.keeper_piece_id = OLD.keeper_piece_id
      AND NEW.author_user_id = OLD.author_user_id
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.created_at = OLD.created_at
      AND NEW.last_mutation_id IS OLD.last_mutation_id
    )
    OR (
      OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
      AND NEW.updated_at = NEW.public_revoked_at
      AND NEW.record_version = OLD.record_version + 1
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.visibility IN (OLD.visibility, 'private')
      AND NEW.public_shared_at IS OLD.public_shared_at
      AND NEW.fulfilled_at IS OLD.fulfilled_at
      AND NEW.archived_at IS OLD.archived_at
      AND NEW.keeper_piece_id = OLD.keeper_piece_id
      AND NEW.author_user_id = OLD.author_user_id
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.created_at = OLD.created_at
      AND NEW.last_mutation_id IS OLD.last_mutation_id
    )
  ) THEN RAISE(ABORT, 'dream update requires exact authorization') END;
END;

CREATE TRIGGER collector_dream_ritual_fulfill_exactly
AFTER INSERT ON collector_dream_rituals
WHEN NEW.action = 'fulfilled'
BEGIN
  UPDATE collector_dreams
     SET fulfilled_at = NEW.completed_at,
         updated_at = NEW.completed_at,
         record_version = record_version + 1
   WHERE id = NEW.prior_dream_id
     AND id = NEW.resulting_dream_id
     AND keeper_piece_id = NEW.keeper_piece_id
     AND archived_at IS NULL
     AND fulfilled_at IS NULL;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM collector_dreams
     WHERE id = NEW.prior_dream_id
       AND fulfilled_at = NEW.completed_at
  ) THEN RAISE(ABORT, 'invalid dream ritual completion') END;
END;

-- A transfer closes the former keeper's live contribution and any public projection.
CREATE TRIGGER collector_dreams_close_on_transfer
AFTER UPDATE OF keeper_user_id ON keeper_pieces
WHEN OLD.keeper_user_id IS NOT NEW.keeper_user_id
BEGIN
  UPDATE collector_dreams
     SET archived_at = COALESCE(NEW.claimed_at, CURRENT_TIMESTAMP),
         public_revoked_at = CASE
           WHEN public_shared_at IS NOT NULL
             THEN COALESCE(NEW.claimed_at, CURRENT_TIMESTAMP)
           ELSE public_revoked_at
         END,
         updated_at = COALESCE(NEW.claimed_at, CURRENT_TIMESTAMP),
         record_version = record_version + 1
   WHERE keeper_piece_id = NEW.id AND archived_at IS NULL;
END;

-- If a known adult profile is removed or changed to a minor, close every public share.
CREATE TRIGGER collector_dreams_close_when_profile_removed
AFTER DELETE ON profiles
BEGIN
  UPDATE collector_dreams
     SET public_revoked_at = COALESCE(public_revoked_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP,
         record_version = record_version + 1
   WHERE author_user_id = (
       SELECT auth_user_id FROM users WHERE id = OLD.user_id
     )
     AND public_shared_at IS NOT NULL
     AND public_revoked_at IS NULL;
END;

CREATE TRIGGER collector_dreams_close_when_profile_becomes_minor
AFTER UPDATE OF birth_date ON profiles
WHEN date(NEW.birth_date, '+18 years') > date('now')
BEGIN
  UPDATE collector_dreams
     SET public_revoked_at = COALESCE(public_revoked_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP,
         record_version = record_version + 1
   WHERE author_user_id = (
       SELECT auth_user_id FROM users WHERE id = NEW.user_id
     )
     AND public_shared_at IS NOT NULL
     AND public_revoked_at IS NULL;
END;

-- Attribution is Ring 4 name consent, not a one-time permission. Withdrawing
-- that switch closes attributed publication in the same database statement.
CREATE TRIGGER collector_dreams_close_when_name_consent_revoked
AFTER UPDATE OF share_name ON collector_person_privacy
WHEN OLD.share_name = 1 AND NEW.share_name = 0
BEGIN
  UPDATE collector_dreams
     SET visibility = 'private',
         public_revoked_at = COALESCE(public_revoked_at, NEW.updated_at),
         updated_at = NEW.updated_at,
         record_version = record_version + 1
   WHERE author_user_id = (
       SELECT auth_user_id FROM users WHERE id = NEW.user_id
     )
     AND visibility = 'attributed'
     AND public_shared_at IS NOT NULL
     AND public_revoked_at IS NULL;
END;

CREATE TRIGGER collector_dreams_close_when_name_consent_removed
BEFORE DELETE ON collector_person_privacy
WHEN OLD.share_name = 1
BEGIN
  UPDATE collector_dreams
     SET visibility = 'private',
         public_revoked_at = COALESCE(
           public_revoked_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         ),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         record_version = record_version + 1
   WHERE author_user_id = (
       SELECT auth_user_id FROM users WHERE id = OLD.user_id
     )
     AND visibility = 'attributed'
     AND public_shared_at IS NOT NULL
     AND public_revoked_at IS NULL;
END;
