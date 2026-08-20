-- Audited abuse-management removals for shone collector content.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- While the artist is alive he can remove abusive shone collector content
-- from display AFTER publication (never a gate before it: publication is
-- never blocked in advance). A removal here does not touch the underlying
-- collector_dreams row at all; it only marks that one piece of content as
-- no longer eligible to shine in a regenerated Piece Record. Once-shone-
-- stays-shone (migration 029 / docs/piece-record-format.md) has exactly one
-- exception, and this table is it: the piece did not un-happen, it stopped
-- shining. functions/api/_lib/pieceRecord.js reads this table by exact name
-- and column shape (gatherShines): SELECT content_id FROM
-- collector_shine_removals WHERE keeper_piece_id = ?1.
--
-- Append-only and content-addressed by removal: UNIQUE(content_id) means a
-- given piece of content can only ever be removed once, so a retried removal
-- request is naturally idempotent at the database layer, and no UPDATE or
-- DELETE is ever permitted (mirroring registry_maintenance_events, migration
-- 017, and piece_records, migration 036) -- restoring shone content is not a
-- thing; a removal is permanent.

CREATE TABLE collector_shine_removals (
  id TEXT PRIMARY KEY CHECK (
    typeof(id) = 'text'
    AND substr(id, 1, 4) = 'csr-'
    AND length(trim(id)) BETWEEN 5 AND 128
  ),
  content_id TEXT NOT NULL UNIQUE REFERENCES collector_dreams(id) ON DELETE RESTRICT CHECK (
    typeof(content_id) = 'text' AND length(trim(content_id)) BETWEEN 1 AND 128
  ),
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT CHECK (
    typeof(keeper_piece_id) = 'text' AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128
  ),
  removed_reason TEXT NOT NULL CHECK (
    typeof(removed_reason) = 'text' AND length(trim(removed_reason)) BETWEEN 1 AND 500
  ),
  removed_by_user_id TEXT NOT NULL CHECK (
    typeof(removed_by_user_id) = 'text' AND length(trim(removed_by_user_id)) BETWEEN 1 AND 128
  ),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text' AND length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  removed_at TEXT NOT NULL CHECK (
    removed_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(removed_at) IS NOT NULL
  )
);

CREATE INDEX idx_collector_shine_removals_piece
  ON collector_shine_removals(keeper_piece_id, removed_at);

-- Defense in depth beneath the endpoint's own check: a removal can only ever
-- be filed against content that actually belongs to the named piece.
CREATE TRIGGER collector_shine_removals_content_belongs_to_piece
BEFORE INSERT ON collector_shine_removals
BEGIN
  SELECT RAISE(ABORT, 'shine removal content must belong to the named piece')
   WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams
     WHERE id = NEW.content_id AND keeper_piece_id = NEW.keeper_piece_id
  );
END;

CREATE TRIGGER collector_shine_removals_no_update
BEFORE UPDATE ON collector_shine_removals
BEGIN
  SELECT RAISE(ABORT, 'shine removals are append-only: a removal is permanent, it stopped shining');
END;

CREATE TRIGGER collector_shine_removals_no_delete
BEFORE DELETE ON collector_shine_removals
BEGIN
  SELECT RAISE(ABORT, 'shine removals are append-only: a removal is permanent, it stopped shining');
END;

PRAGMA foreign_key_check;
