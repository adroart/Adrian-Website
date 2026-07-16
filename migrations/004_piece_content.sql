-- Atlas piece editorial content, v1 (piece-page build-out — see
-- todo/plans/piece-page-buildout.md and the "Piece-page content" decision
-- record in todo/handoff/GO-LIVE-RUNBOOK.md).
-- OWNED BY ADRIAN-WEBSITE: copy this file into that repo's migrations/ and
-- apply from THAT checkout (it owns the shared `adrian-website` D1 schema):
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only — D1 has no down-migrations.
--
-- One table, consumed by mandalacodes Functions via the shared `DB` binding:
--
--   atlas_piece_content — the mutable, admin-authored editorial layer for a
--                         piece's public page: story, extra photos,
--                         materials, provenance. Deliberately NOT part of the
--                         hash chain or the ledger — this is Adrian's writing
--                         desk, not a legal/attribution record, so it can be
--                         freely edited and re-saved without touching a
--                         single hash. `data/mockData.ts` (FULL_ARCHIVE)
--                         remains the source of truth for static fields
--                         (title, dimensions, edition); this table only
--                         supplies the fields the admin editor writes.
--
-- Until this migration is applied, GET /api/atlas/piece-content degrades to
-- an empty result (piece pages render unaffected) and the admin write
-- endpoint (/api/atlas/admin/piece-content) answers 503 migration not
-- applied, matching the 003_atlas_legacy convention.

CREATE TABLE IF NOT EXISTS atlas_piece_content (
  piece_id TEXT PRIMARY KEY,                  -- matches FULL_ARCHIVE artwork id (e.g. "UL-100")
  story TEXT,                                  -- Adrian's long-form narrative for the piece page
  materials TEXT,                              -- optional override/expansion of the static `material` field
  images TEXT,                                 -- JSON array of Cloudinary public IDs (gallery, up to 12)
  provenance TEXT,                             -- optional provenance / history note
  updated_at TEXT NOT NULL                     -- ISO timestamp of the last admin save
);
