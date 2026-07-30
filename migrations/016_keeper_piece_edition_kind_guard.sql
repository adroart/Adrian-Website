-- Durable artwork edition-kind guard.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. This migration does not rebuild keeper_pieces.
--
-- An artwork identity is either unique (edition 0) or numbered (positive
-- editions). Application checks improve error messages, while these triggers
-- are the atomic database boundary that prevents concurrent writers or future
-- code paths from mixing both structures for one piece_id.

-- Refuse to install the prospective triggers over an already-invalid registry.
-- Wrangler applies each migration transactionally, so a failed CHECK rolls this
-- temporary guard table back together with the migration.
CREATE TABLE keeper_piece_edition_existing_guard (
  conflict_count INTEGER NOT NULL
    CONSTRAINT keeper_piece_edition_existing_conflict CHECK (conflict_count = 0)
);

INSERT INTO keeper_piece_edition_existing_guard (conflict_count)
SELECT COUNT(*)
FROM (
  SELECT piece_id
  FROM keeper_pieces
  GROUP BY piece_id
  HAVING SUM(CASE WHEN edition_number = 0 THEN 1 ELSE 0 END) > 0
     AND SUM(CASE WHEN edition_number > 0 THEN 1 ELSE 0 END) > 0
);

DROP TABLE keeper_piece_edition_existing_guard;

CREATE TRIGGER IF NOT EXISTS keeper_piece_edition_range_guard_insert
BEFORE INSERT ON keeper_pieces
WHEN typeof(NEW.edition_number) <> 'integer'
  OR NEW.edition_number < 0
  OR NEW.edition_number > 9999
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_range_violation');
END;

CREATE TRIGGER IF NOT EXISTS keeper_piece_edition_range_guard_update
BEFORE UPDATE ON keeper_pieces
WHEN typeof(NEW.edition_number) <> 'integer'
  OR NEW.edition_number < 0
  OR NEW.edition_number > 9999
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_range_violation');
END;

CREATE TRIGGER IF NOT EXISTS keeper_piece_edition_kind_guard_insert
BEFORE INSERT ON keeper_pieces
WHEN (
  NEW.edition_number = 0
  AND EXISTS (
    SELECT 1 FROM keeper_pieces
    WHERE piece_id = NEW.piece_id AND edition_number > 0
  )
) OR (
  NEW.edition_number > 0
  AND EXISTS (
    SELECT 1 FROM keeper_pieces
    WHERE piece_id = NEW.piece_id AND edition_number = 0
  )
)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_kind_conflict');
END;

CREATE TRIGGER IF NOT EXISTS keeper_piece_edition_kind_guard_update
BEFORE UPDATE OF piece_id, edition_number ON keeper_pieces
WHEN (
  NEW.edition_number = 0
  AND EXISTS (
    SELECT 1 FROM keeper_pieces
    WHERE piece_id = NEW.piece_id AND edition_number > 0 AND id <> OLD.id
  )
) OR (
  NEW.edition_number > 0
  AND EXISTS (
    SELECT 1 FROM keeper_pieces
    WHERE piece_id = NEW.piece_id AND edition_number = 0 AND id <> OLD.id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_edition_kind_conflict');
END;
