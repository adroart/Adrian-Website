-- Adrian Rasmussen Art — track partial payments on an invoice.
-- Apply via: wrangler d1 migrations apply adrian-website --remote
--
-- amount_paid_cents accumulates what the buyer has paid. Balance due is
-- total_cents - amount_paid_cents. Status becomes 'paid' when fully paid.

ALTER TABLE invoices ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;
