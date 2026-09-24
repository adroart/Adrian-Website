-- Immutable original-author publication of an exact historical sealed dream.
-- The publication is additive: the archived dream body is never rewritten and
-- custody/current-dream state is untouched.
CREATE TABLE collector_historical_dream_publications (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 8 AND 128),
  dream_id TEXT NOT NULL UNIQUE REFERENCES collector_dreams(id) ON DELETE RESTRICT,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL CHECK (length(trim(author_user_id)) BETWEEN 1 AND 128),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  published_at TEXT NOT NULL,
  UNIQUE (author_user_id, idempotency_key)
);

CREATE TRIGGER collector_historical_dream_publications_guard
BEFORE INSERT ON collector_historical_dream_publications BEGIN
  SELECT RAISE(ABORT, 'historical dream publication not authorized') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
     WHERE dream.id = NEW.dream_id
       AND dream.keeper_piece_id = NEW.keeper_piece_id
       AND dream.author_user_id = NEW.author_user_id
       AND dream.archived_at IS NOT NULL
       AND dream.tier = 'seal'
       AND dream.visibility = 'private'
       AND dream.public_shared_at IS NULL
  );
END;
CREATE TRIGGER collector_historical_dream_publications_no_update
BEFORE UPDATE ON collector_historical_dream_publications BEGIN
  SELECT RAISE(ABORT, 'historical dream publications are append-only');
END;
CREATE TRIGGER collector_historical_dream_publications_no_delete
BEFORE DELETE ON collector_historical_dream_publications BEGIN
  SELECT RAISE(ABORT, 'historical dream publications are permanent');
END;

PRAGMA foreign_key_check;
