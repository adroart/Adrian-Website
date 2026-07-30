-- Detach dormant fulfillment history from the retired commerce tables.
--
-- The live registry no longer creates or reads fulfillments from checkout.
-- Existing rows remain private historical facts, but a registry recovery must
-- not require orders, payment data or any commerce provider. The old numeric
-- source id is retained only as an opaque, namespaced string.

CREATE TABLE piece_fulfillments_registry_only (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL UNIQUE
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  legacy_source_reference TEXT UNIQUE CHECK (
    legacy_source_reference IS NULL
    OR (
      typeof(legacy_source_reference) = 'text'
      AND length(trim(legacy_source_reference)) BETWEEN 1 AND 128
    )
  ),
  assignment_type TEXT NOT NULL
    CHECK (assignment_type IN ('legacy', 'manual')),
  intended_recipient_reference TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  shipped_at TEXT,
  claimed_at TEXT,
  corrected_at TEXT,
  correction_reason TEXT,
  CHECK (
    (assignment_type = 'legacy' AND legacy_source_reference IS NOT NULL)
    OR (assignment_type = 'manual' AND legacy_source_reference IS NULL)
  ),
  CHECK (
    (corrected_at IS NULL AND correction_reason IS NULL)
    OR (corrected_at IS NOT NULL AND correction_reason IS NOT NULL)
  )
);

INSERT INTO piece_fulfillments_registry_only (
  id, keeper_piece_id, legacy_source_reference, assignment_type,
  intended_recipient_reference, assigned_at, shipped_at, claimed_at,
  corrected_at, correction_reason
)
SELECT
  id,
  keeper_piece_id,
  CASE WHEN assignment_type = 'stripe_order'
    THEN 'legacy:' || CAST(order_item_id AS TEXT)
    ELSE NULL
  END,
  CASE WHEN assignment_type = 'stripe_order' THEN 'legacy' ELSE 'manual' END,
  intended_recipient_reference,
  assigned_at,
  shipped_at,
  claimed_at,
  corrected_at,
  correction_reason
FROM piece_fulfillments;

DROP TABLE piece_fulfillments;
ALTER TABLE piece_fulfillments_registry_only RENAME TO piece_fulfillments;

CREATE INDEX idx_piece_fulfillments_assignment
  ON piece_fulfillments(assignment_type, assigned_at DESC);
CREATE INDEX idx_piece_fulfillments_shipped
  ON piece_fulfillments(shipped_at);
CREATE UNIQUE INDEX uniq_piece_fulfillments_manual_reference
  ON piece_fulfillments(intended_recipient_reference)
  WHERE assignment_type = 'manual';
