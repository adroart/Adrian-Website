-- Assignment and shipment state for one exact physical artwork instance.
-- Recipient references must be opaque, non-sensitive application references;
-- names, email addresses and postal addresses do not belong in this table.

CREATE TABLE IF NOT EXISTS piece_fulfillments (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL UNIQUE
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  order_item_id INTEGER UNIQUE
    REFERENCES order_items(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL
    CHECK (assignment_type IN ('stripe_order', 'manual')),
  intended_recipient_reference TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  shipped_at TEXT,
  claimed_at TEXT,
  corrected_at TEXT,
  correction_reason TEXT,
  CHECK (
    (assignment_type = 'stripe_order' AND order_item_id IS NOT NULL)
    OR (assignment_type = 'manual' AND order_item_id IS NULL)
  ),
  CHECK (
    (corrected_at IS NULL AND correction_reason IS NULL)
    OR (corrected_at IS NOT NULL AND correction_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_piece_fulfillments_assignment
  ON piece_fulfillments(assignment_type, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_piece_fulfillments_shipped
  ON piece_fulfillments(shipped_at);
