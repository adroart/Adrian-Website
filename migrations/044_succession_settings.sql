-- Succession page (/admin/succession): a home for the three blanks that
-- docs/registry-custodian-guide.md leaves for Adrian's own handwriting --
-- where the passkey is sealed, where the second sealed copy is, and who the
-- family contact and technical helper are. Filling them here lets the
-- generated Successor's Handbook read complete instead of leaving its lines
-- blank forever. Single-row settings table, same shape as pricing_config
-- (migration 007_pricing.sql).
--
-- Apply via: wrangler d1 migrations apply adrian-website --remote
-- OWNED BY ADRIAN-WEBSITE (succession page). Additive only.

CREATE TABLE IF NOT EXISTS succession_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  passkey_sealed_at TEXT NOT NULL DEFAULT '',
  passkey_second_copy_at TEXT NOT NULL DEFAULT '',
  family_contact TEXT NOT NULL DEFAULT '',
  technical_helper TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);
