-- A studio/manual handoff reference identifies one intended physical delivery.
-- It is opaque and non-sensitive, and cannot be reused by another current
-- assignment. Correcting a mistaken assignment releases the reference.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_piece_fulfillments_manual_reference
  ON piece_fulfillments(intended_recipient_reference)
  WHERE assignment_type = 'manual';
