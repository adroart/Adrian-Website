-- Permanent local Founding Lights ordinals.
--
-- The ordinal belongs to the permanent physical identity, not to a keeper.
-- Existing first binds are ranked once in a deterministic order. Every later
-- first bind receives the next number in the same statement as its immutable
-- lineage event. Transfers never touch this table.

CREATE TABLE collector_claim_ordinals (
  keeper_piece_id TEXT PRIMARY KEY
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  first_bound_event_id TEXT NOT NULL UNIQUE
    REFERENCES artwork_lineage_events(id) ON DELETE RESTRICT,
  claim_ordinal INTEGER NOT NULL UNIQUE CHECK (
    typeof(claim_ordinal) = 'integer' AND claim_ordinal > 0
  )
);

INSERT INTO collector_claim_ordinals
  (keeper_piece_id, first_bound_event_id, claim_ordinal)
SELECT
  keeper_piece_id,
  id,
  row_number() OVER (
    ORDER BY event_at ASC, event_hash ASC, keeper_piece_id ASC
  )
FROM artwork_lineage_events
WHERE event_type = 'first_bound';

CREATE TRIGGER collector_claim_ordinals_valid_insert
BEFORE INSERT ON collector_claim_ordinals
WHEN NOT EXISTS (
  SELECT 1
    FROM artwork_lineage_events AS event
   WHERE event.id = NEW.first_bound_event_id
     AND event.keeper_piece_id = NEW.keeper_piece_id
     AND event.event_type = 'first_bound'
)
BEGIN
  SELECT RAISE(ABORT, 'claim ordinal requires its first bind');
END;

CREATE TRIGGER artwork_lineage_first_bound_assign_ordinal
AFTER INSERT ON artwork_lineage_events
WHEN NEW.event_type = 'first_bound'
BEGIN
  INSERT INTO collector_claim_ordinals
    (keeper_piece_id, first_bound_event_id, claim_ordinal)
  VALUES (
    NEW.keeper_piece_id,
    NEW.id,
    (SELECT COALESCE(MAX(claim_ordinal), 0) + 1
       FROM collector_claim_ordinals)
  );
END;

CREATE TRIGGER collector_claim_ordinals_no_update
BEFORE UPDATE ON collector_claim_ordinals
BEGIN
  SELECT RAISE(ABORT, 'claim ordinals are permanent');
END;

CREATE TRIGGER collector_claim_ordinals_no_delete
BEFORE DELETE ON collector_claim_ordinals
BEGIN
  SELECT RAISE(ABORT, 'claim ordinals are permanent');
END;

PRAGMA foreign_key_check;
