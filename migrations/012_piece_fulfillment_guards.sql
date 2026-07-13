-- A studio/manual handoff reference identifies one intended physical delivery.
-- It is opaque and non-sensitive, but must not be reused for another plate.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_piece_fulfillments_manual_reference
  ON piece_fulfillments(intended_recipient_reference)
  WHERE assignment_type = 'manual';
