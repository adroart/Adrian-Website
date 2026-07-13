-- Durable lineage anchor. Production rollout is permitted only where the
-- migration-013 precondition still holds: zero pre-existing registry events.
-- A non-empty environment must backfill and verify these anchors before use.
ALTER TABLE keeper_pieces ADD COLUMN lineage_head_hash TEXT;
ALTER TABLE keeper_pieces
  ADD COLUMN lineage_event_count INTEGER NOT NULL DEFAULT 0
  CHECK (lineage_event_count >= 0);
