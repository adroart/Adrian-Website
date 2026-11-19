-- Text contributed to one artwork and places deliberately recorded by its keeper.
-- A contributor grant is a writing permission only. Publication is irreversible.
CREATE TABLE collector_reflections (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES artwork_contributor_access_grants(invitation_id) ON DELETE RESTRICT,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  steward_version INTEGER NOT NULL CHECK (steward_version >= 0),
  successor_access INTEGER NOT NULL DEFAULT 0 CHECK (successor_access IN (0, 1)),
  created_at TEXT NOT NULL,
  offered_at TEXT,
  published_at TEXT,
  CHECK (published_at IS NULL OR offered_at IS NOT NULL)
);

CREATE INDEX collector_reflections_piece ON collector_reflections(keeper_piece_id, created_at);

CREATE TRIGGER collector_public_reflection_immutable
BEFORE UPDATE ON collector_reflections WHEN OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'public reflection is immutable');
END;

CREATE TRIGGER collector_public_reflection_permanent
BEFORE DELETE ON collector_reflections WHEN OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'public reflection is permanent');
END;

CREATE TABLE collector_place_milestones (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  author_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  place_id TEXT NOT NULL REFERENCES atlas_source_cities(id) ON DELETE RESTRICT,
  grain TEXT NOT NULL CHECK (grain IN ('city', 'region')),
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 9999),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  steward_version INTEGER NOT NULL CHECK (steward_version >= 0),
  successor_access INTEGER NOT NULL DEFAULT 0 CHECK (successor_access IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX collector_place_milestones_piece ON collector_place_milestones(keeper_piece_id, year);
