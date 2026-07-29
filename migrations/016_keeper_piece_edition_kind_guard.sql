-- Durable artwork edition-kind guard.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. This migration does not rebuild keeper_pieces.
--
-- An artwork identity is either unique (edition 0) or numbered (positive
-- editions). Application checks improve error messages, while these triggers
-- are the atomic database boundary that prevents concurrent writers or future
-- code paths from mixing both structures for one piece_id.

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
