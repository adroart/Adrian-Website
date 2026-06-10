-- Adrian Rasmussen Art — let an invoice offer the buyer a payment choice.
-- Apply via: wrangler d1 migrations apply adrian-website --remote
--
-- When 1, the public invoice lets the buyer choose pay-in-full vs 2 payments,
-- and the schedule recomputes live from the chosen size + plan.

ALTER TABLE invoices ADD COLUMN offer_payment_choice INTEGER NOT NULL DEFAULT 0;
