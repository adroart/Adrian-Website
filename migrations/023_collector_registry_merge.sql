-- Collector registry merge. Additive and safe for the shared D1 deployment.
--
-- Both sites already use this exact database. The legacy login columns remain
-- temporarily so either deployed version can run during the rollout. New code
-- reads auth_user_id and writes both values. Triggers keep older writers in
-- sync until a later migration can remove the compatibility columns.

ALTER TABLE users ADD COLUMN auth_user_id TEXT;
UPDATE users SET auth_user_id = clerk_user_id WHERE auth_user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

CREATE TRIGGER IF NOT EXISTS users_auth_id_sync_after_insert
AFTER INSERT ON users
WHEN NEW.auth_user_id IS NULL AND NEW.clerk_user_id IS NOT NULL
BEGIN
  UPDATE users SET auth_user_id = NEW.clerk_user_id WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS users_auth_id_sync_from_legacy
AFTER UPDATE OF clerk_user_id ON users
WHEN NEW.clerk_user_id IS NOT NEW.auth_user_id
BEGIN
  UPDATE users SET auth_user_id = NEW.clerk_user_id WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS users_auth_id_sync_to_legacy
AFTER UPDATE OF auth_user_id ON users
WHEN NEW.auth_user_id IS NOT NULL AND NEW.auth_user_id IS NOT NEW.clerk_user_id
BEGIN
  UPDATE users SET clerk_user_id = NEW.auth_user_id WHERE id = NEW.id;
END;

ALTER TABLE atlas_inscriptions ADD COLUMN author_user_id TEXT;
UPDATE atlas_inscriptions
   SET author_user_id = author_clerk_id
 WHERE author_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_atlas_inscriptions_author_user
  ON atlas_inscriptions(author_user_id);

CREATE TRIGGER IF NOT EXISTS atlas_inscriptions_auth_id_sync_after_insert
AFTER INSERT ON atlas_inscriptions
WHEN NEW.author_user_id IS NULL AND NEW.author_clerk_id IS NOT NULL
BEGIN
  UPDATE atlas_inscriptions
     SET author_user_id = NEW.author_clerk_id
   WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS atlas_inscriptions_auth_id_sync_from_legacy
AFTER UPDATE OF author_clerk_id ON atlas_inscriptions
WHEN NEW.author_clerk_id IS NOT NEW.author_user_id
BEGIN
  UPDATE atlas_inscriptions
     SET author_user_id = NEW.author_clerk_id
   WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS atlas_inscriptions_auth_id_sync_to_legacy
AFTER UPDATE OF author_user_id ON atlas_inscriptions
WHEN NEW.author_user_id IS NOT NULL AND NEW.author_user_id IS NOT NEW.author_clerk_id
BEGIN
  UPDATE atlas_inscriptions
     SET author_clerk_id = NEW.author_user_id
   WHERE id = NEW.id;
END;

-- Exact Mandala Atlas source chains are retained separately from this site's
-- local lineage envelope. The two hash formats are intentionally not mixed.
CREATE TABLE atlas_source_cities (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  region TEXT,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (
    length(country_code) = 2 AND country_code = upper(country_code)
  ),
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180)
);

CREATE TABLE atlas_source_chains (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL UNIQUE
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  source_system TEXT NOT NULL CHECK (source_system = 'mandalacodes-atlas'),
  source_reference TEXT NOT NULL CHECK (length(source_reference) BETWEEN 12 AND 2048),
  moved_on TEXT NOT NULL CHECK (moved_on = '2026-08-09'),
  source_event_count INTEGER NOT NULL CHECK (source_event_count > 0),
  source_head_hash TEXT NOT NULL UNIQUE CHECK (
    length(source_head_hash) = 64 AND source_head_hash = lower(source_head_hash)
  )
);

CREATE TABLE atlas_source_chain_events (
  id TEXT PRIMARY KEY,
  source_chain_id TEXT NOT NULL
    REFERENCES atlas_source_chains(id) ON DELETE RESTRICT,
  source_sequence INTEGER NOT NULL CHECK (source_sequence > 0),
  source_event_id TEXT NOT NULL UNIQUE,
  source_event_type TEXT NOT NULL,
  source_event_at TEXT NOT NULL,
  source_previous_hash TEXT CHECK (
    source_previous_hash IS NULL OR (
      length(source_previous_hash) = 64
      AND source_previous_hash = lower(source_previous_hash)
    )
  ),
  source_event_hash TEXT NOT NULL UNIQUE CHECK (
    length(source_event_hash) = 64 AND source_event_hash = lower(source_event_hash)
  ),
  source_event_json TEXT NOT NULL CHECK (json_valid(source_event_json)),
  UNIQUE (source_chain_id, source_sequence),
  UNIQUE (source_chain_id, source_previous_hash)
);

CREATE INDEX idx_atlas_source_events_chain
  ON atlas_source_chain_events(source_chain_id, source_sequence);

CREATE TRIGGER atlas_source_cities_no_update
BEFORE UPDATE ON atlas_source_cities
BEGIN
  SELECT RAISE(ABORT, 'atlas source cities are append-only');
END;

CREATE TRIGGER atlas_source_cities_no_delete
BEFORE DELETE ON atlas_source_cities
BEGIN
  SELECT RAISE(ABORT, 'atlas source cities are append-only');
END;

CREATE TRIGGER atlas_source_chains_no_update
BEFORE UPDATE ON atlas_source_chains
BEGIN
  SELECT RAISE(ABORT, 'atlas source chains are append-only');
END;

CREATE TRIGGER atlas_source_chains_no_delete
BEFORE DELETE ON atlas_source_chains
BEGIN
  SELECT RAISE(ABORT, 'atlas source chains are append-only');
END;

CREATE TRIGGER atlas_source_chain_events_no_update
BEFORE UPDATE ON atlas_source_chain_events
BEGIN
  SELECT RAISE(ABORT, 'atlas source chain events are append-only');
END;

CREATE TRIGGER atlas_source_chain_events_no_delete
BEFORE DELETE ON atlas_source_chain_events
BEGIN
  SELECT RAISE(ABORT, 'atlas source chain events are append-only');
END;
