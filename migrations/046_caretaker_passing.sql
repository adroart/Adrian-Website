-- Recipient-verified, reversible caretaker passing. Custody still moves only
-- through migration 024's governed transfer receipt gateway.
CREATE TABLE caretaker_passing_requests (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  sender_user_id TEXT NOT NULL CHECK (length(trim(sender_user_id)) BETWEEN 1 AND 128),
  recipient_email TEXT NOT NULL CHECK (length(trim(recipient_email)) BETWEEN 3 AND 254),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  transfer_kind TEXT NOT NULL CHECK (transfer_kind IN ('sale', 'gift')),
  declared_value_raw TEXT CHECK (declared_value_raw IS NULL OR length(declared_value_raw) BETWEEN 1 AND 500),
  declared_value_method TEXT CHECK (declared_value_method IS NULL OR declared_value_method IN ('paid', 'part_trade_paid', 'traded', 'given')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  idempotency_key TEXT NOT NULL,
  transfer_intent_id TEXT UNIQUE REFERENCES artwork_transfer_intents(id) ON DELETE RESTRICT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  delivery_error TEXT,
  provider_idempotency_key TEXT NOT NULL UNIQUE,
  sender_notice_status TEXT CHECK (sender_notice_status IS NULL OR sender_notice_status IN ('pending', 'sent', 'failed')),
  sender_notice_attempts INTEGER NOT NULL DEFAULT 0 CHECK (sender_notice_attempts >= 0),
  sender_notice_error TEXT,
  sender_notice_provider_idempotency_key TEXT NOT NULL UNIQUE,
  sender_notice_sent_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  cancelled_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (sender_user_id, idempotency_key),
  CHECK ((declared_value_raw IS NULL) = (declared_value_method IS NULL)),
  CHECK ((sender_notice_status = 'sent' AND sender_notice_sent_at IS NOT NULL)
      OR (sender_notice_status IS NULL AND sender_notice_sent_at IS NULL)
      OR (sender_notice_status IN ('pending', 'failed') AND sender_notice_sent_at IS NULL)),
  CHECK (
    (status = 'pending' AND accepted_at IS NULL AND cancelled_at IS NULL AND transfer_intent_id IS NULL)
    OR (status = 'accepted' AND accepted_at IS NOT NULL AND cancelled_at IS NULL AND transfer_intent_id IS NOT NULL)
    OR (status = 'cancelled' AND accepted_at IS NULL AND cancelled_at IS NOT NULL AND transfer_intent_id IS NULL)
    OR (status = 'expired' AND accepted_at IS NULL AND cancelled_at IS NULL AND transfer_intent_id IS NULL)
  )
);
CREATE UNIQUE INDEX caretaker_passing_one_pending_piece
  ON caretaker_passing_requests(keeper_piece_id) WHERE status = 'pending';
CREATE INDEX caretaker_passing_recipient
  ON caretaker_passing_requests(lower(recipient_email), status, expires_at);

CREATE TRIGGER caretaker_passing_receipt_guard
BEFORE INSERT ON artwork_transfer_receipts
WHEN EXISTS (
  SELECT 1 FROM artwork_transfer_intents intent
  JOIN caretaker_passing_requests passing ON passing.id = intent.maintenance_event_id
  WHERE intent.id = NEW.transfer_intent_id
)
BEGIN
  SELECT RAISE(ABORT, 'caretaker passing is not acceptable') WHERE NOT EXISTS (
    SELECT 1 FROM artwork_transfer_intents intent
    JOIN caretaker_passing_requests passing ON passing.id = intent.maintenance_event_id
    WHERE intent.id = NEW.transfer_intent_id
      AND passing.status = 'pending'
      AND passing.sender_user_id = intent.expected_from_user_id
      AND lower(passing.recipient_email) = (
        SELECT lower(email) FROM user WHERE id = intent.target_user_id AND emailVerified = 1
      )
      AND julianday(passing.expires_at) > julianday(NEW.committed_at)
  );
END;

CREATE TRIGGER caretaker_passing_receipt_commit
AFTER INSERT ON artwork_transfer_receipts
WHEN EXISTS (
  SELECT 1 FROM artwork_transfer_intents intent
  JOIN caretaker_passing_requests passing ON passing.id = intent.maintenance_event_id
  WHERE intent.id = NEW.transfer_intent_id
)
BEGIN
  UPDATE caretaker_passing_requests
     SET status = 'accepted', accepted_at = NEW.committed_at,
         transfer_intent_id = NEW.transfer_intent_id, updated_at = NEW.committed_at
   WHERE id = (SELECT maintenance_event_id FROM artwork_transfer_intents WHERE id = NEW.transfer_intent_id)
     AND status = 'pending';
  SELECT RAISE(ABORT, 'caretaker passing commit failed') WHERE changes() <> 1;
END;
