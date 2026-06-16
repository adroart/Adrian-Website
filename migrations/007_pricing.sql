-- Adrian Rasmussen Art — pricing model storage.
-- Apply via: wrangler d1 migrations apply adrian-website --remote
--
-- Two tables back the pricing tools (utils/pricing/*):
--   pricing_config  — a single authoritative copy of the tuned model, read
--                     publicly by the customer Pricing Explorer and written
--                     only by the admin calculator. Stored as one JSON blob so
--                     the schema can evolve in TypeScript without migrations.
--   pricing_quotes  — priced pieces saved for calibration: what the formula
--                     suggested vs. what was actually charged. Money is in
--                     whole dollars (REAL), matching the dollar-based engine;
--                     this is an internal estimation tool, not a payment ledger.

CREATE TABLE IF NOT EXISTS pricing_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS pricing_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  inputs_json TEXT NOT NULL DEFAULT '{}',
  suggested_retail REAL NOT NULL DEFAULT 0,
  quote REAL NOT NULL DEFAULT 0,
  actual_price REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pricing_quotes_created ON pricing_quotes(created_at DESC);
