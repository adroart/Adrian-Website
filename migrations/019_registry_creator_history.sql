-- Typed creator-managed history for each physical artwork.
-- Current entries may be corrected or removed from the current view, while
-- registry_maintenance_events retains every consequential before/after state.

CREATE TABLE artwork_provenance_entries (
  id ANY PRIMARY KEY CHECK (
    typeof(id) = 'text' AND length(trim(id)) BETWEEN 1 AND 128
  ),
  keeper_piece_id ANY NOT NULL
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT CHECK (
      typeof(keeper_piece_id) = 'text'
      AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128
    ),
  entry_type ANY NOT NULL CHECK (
    typeof(entry_type) = 'text'
    AND entry_type IN (
      'contributor', 'creation_place', 'intention',
      'material', 'technique', 'note'
    )
  ),
  title ANY NOT NULL CHECK (
    typeof(title) = 'text' AND length(trim(title)) BETWEEN 1 AND 300
  ),
  detail ANY CHECK (
    detail IS NULL
    OR (typeof(detail) = 'text' AND length(detail) <= 5000)
  ),
  role ANY CHECK (
    role IS NULL
    OR (typeof(role) = 'text' AND length(trim(role)) BETWEEN 1 AND 300)
  ),
  occurred_at ANY CHECK (
    occurred_at IS NULL
    OR (typeof(occurred_at) = 'text'
      AND length(trim(occurred_at)) BETWEEN 1 AND 40)
  ),
  visibility ANY NOT NULL CHECK (
    typeof(visibility) = 'text'
    AND visibility IN ('private', 'steward', 'public')
  ),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (
    typeof(record_version) = 'integer' AND record_version >= 1
  ),
  created_at ANY NOT NULL CHECK (
    typeof(created_at) = 'text' AND length(trim(created_at)) BETWEEN 1 AND 40
  ),
  updated_at ANY NOT NULL CHECK (
    typeof(updated_at) = 'text' AND length(trim(updated_at)) BETWEEN 1 AND 40
  ),
  removed_at ANY CHECK (
    removed_at IS NULL
    OR (typeof(removed_at) = 'text'
      AND length(trim(removed_at)) BETWEEN 1 AND 40)
  ),
  CHECK (entry_type <> 'contributor' OR role IS NOT NULL)
) STRICT;

CREATE INDEX idx_artwork_provenance_piece_current
  ON artwork_provenance_entries(keeper_piece_id, removed_at, created_at, id);

CREATE INDEX idx_artwork_provenance_piece_visibility
  ON artwork_provenance_entries(keeper_piece_id, visibility, removed_at, created_at, id);

CREATE TRIGGER artwork_provenance_entries_identity_immutable
BEFORE UPDATE OF id, keeper_piece_id, created_at ON artwork_provenance_entries
WHEN NEW.id IS NOT OLD.id
  OR NEW.keeper_piece_id IS NOT OLD.keeper_piece_id
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'creator-history identity is immutable');
END;

CREATE TRIGGER artwork_provenance_entries_record_version_auto_increment
AFTER UPDATE OF entry_type, title, detail, role, occurred_at, visibility, removed_at
ON artwork_provenance_entries
WHEN NEW.record_version = OLD.record_version
  AND (
    NEW.entry_type IS NOT OLD.entry_type
    OR NEW.title IS NOT OLD.title
    OR NEW.detail IS NOT OLD.detail
    OR NEW.role IS NOT OLD.role
    OR NEW.occurred_at IS NOT OLD.occurred_at
    OR NEW.visibility IS NOT OLD.visibility
    OR NEW.removed_at IS NOT OLD.removed_at
  )
BEGIN
  UPDATE artwork_provenance_entries
     SET record_version = record_version + 1
   WHERE id = NEW.id;
END;

CREATE TRIGGER artwork_provenance_entries_no_delete
BEFORE DELETE ON artwork_provenance_entries
BEGIN
  SELECT RAISE(ABORT, 'remove from current view instead of deleting creator history');
END;
