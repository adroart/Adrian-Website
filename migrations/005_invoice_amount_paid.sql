-- Adrian Rasmussen Art — track partial payments on an invoice.
-- Apply via: wrangler d1 migrations apply adrian-website --remote
--
-- NOTE: this shares the 005_ prefix with 005_atlas_legacy.sql. Wrangler applies
-- in filename order ('a' < 'i'), so atlas_legacy runs first, then this. Both are
-- already applied; do NOT renumber an applied migration (D1 tracks by filename
-- and would re-run it, failing on the duplicate ADD COLUMN). Future migrations
-- continue from 006/007 with unique prefixes.
--
-- amount_paid_cents accumulates what the buyer has paid. Balance due is
-- total_cents - amount_paid_cents. Status becomes 'paid' when fully paid.

ALTER TABLE invoices ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;
