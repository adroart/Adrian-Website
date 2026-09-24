-- Append-only manual payment receipts. One INSERT is the atomic gateway that
-- validates and accumulates the invoice balance.
CREATE TABLE invoice_payment_events (
  id TEXT PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
  paid_cents INTEGER NOT NULL CHECK (typeof(paid_cents) = 'integer' AND paid_cents > 0),
  requested_total_cents INTEGER CHECK (
    requested_total_cents IS NULL OR (typeof(requested_total_cents) = 'integer' AND requested_total_cents > 0)
  ),
  administrator_user_id TEXT NOT NULL CHECK (length(trim(administrator_user_id)) BETWEEN 1 AND 128),
  administrator_email TEXT NOT NULL CHECK (length(trim(administrator_email)) BETWEEN 3 AND 254),
  created_at INTEGER NOT NULL
);
CREATE INDEX invoice_payment_events_invoice_time
  ON invoice_payment_events(invoice_id, created_at, id);

CREATE TRIGGER invoice_payment_event_no_update
BEFORE UPDATE ON invoice_payment_events BEGIN
  SELECT RAISE(ABORT, 'invoice payment events are append-only');
END;
CREATE TRIGGER invoice_payment_event_no_delete
BEFORE DELETE ON invoice_payment_events BEGIN
  SELECT RAISE(ABORT, 'invoice payment events are append-only');
END;

CREATE TRIGGER invoice_payment_event_validate
BEFORE INSERT ON invoice_payment_events BEGIN
  SELECT RAISE(ABORT, 'invoice not payable') WHERE NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = NEW.invoice_id AND status <> 'void'
  );
  SELECT RAISE(ABORT, 'invoice total conflict') WHERE NEW.requested_total_cents IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM invoices
       WHERE id = NEW.invoice_id AND amount_paid_cents > 0
         AND total_cents <> NEW.requested_total_cents
    );
  SELECT RAISE(ABORT, 'invoice overpayment') WHERE EXISTS (
    SELECT 1 FROM invoices
     WHERE id = NEW.invoice_id
       AND amount_paid_cents + NEW.paid_cents > COALESCE(NEW.requested_total_cents, total_cents)
  );
END;

CREATE TRIGGER invoice_payment_event_apply
AFTER INSERT ON invoice_payment_events BEGIN
  UPDATE invoices
     SET total_cents = COALESCE(NEW.requested_total_cents, total_cents),
         amount_paid_cents = amount_paid_cents + NEW.paid_cents,
         status = CASE
           WHEN amount_paid_cents + NEW.paid_cents = COALESCE(NEW.requested_total_cents, total_cents)
             THEN 'paid'
           ELSE status
         END,
         paid_at = CASE
           WHEN amount_paid_cents + NEW.paid_cents = COALESCE(NEW.requested_total_cents, total_cents)
             AND paid_at IS NULL THEN NEW.created_at
           ELSE paid_at
         END,
         updated_at = NEW.created_at
   WHERE id = NEW.invoice_id AND status <> 'void';
  SELECT RAISE(ABORT, 'invoice payment apply failed') WHERE changes() <> 1;
END;
