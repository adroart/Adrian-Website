-- Admin-created draft artworks that are mintable without a code deploy.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only.
--
-- The site's public catalog lives in data/mockData.ts (compiled into the
-- bundle). This table is a small, admin-only side channel so a piece can be
-- registered from the plate desk / wizard and minted immediately, before it is
-- fleshed out into the public catalog. A draft carries only what minting needs:
-- a pattern-valid id, a title, an optional series, and an optional edition size.
-- It holds no codes, no personal data, and nothing secret.
--
-- The mint endpoint resolves an artwork from data/mockData.ts FIRST, then from
-- this table. A draft's public /works/:id record only becomes visible once a
-- plate has actually been issued for it, so bare drafts are not exposed.

CREATE TABLE IF NOT EXISTS registry_artworks (
  id TEXT PRIMARY KEY,          -- artwork id, ^[A-Z]{2,3}-[0-9]{3}$ (enforced at the app layer)
  title TEXT NOT NULL,
  series TEXT,
  edition_size INTEGER,         -- NULL for a unique / non-numbered piece
  created_at TEXT NOT NULL
);
