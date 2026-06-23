-- Living Legacy front-door schema (Phase 1 of todo/plans/living-legacy.md).
-- OWNED BY ADRIAN-WEBSITE: this repo owns the shared `adrian-website` D1 schema.
-- Apply from THIS checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only — D1 has no down-migrations. Never edit an applied migration;
-- add the next-numbered file instead.
--
-- Two tables, both gated behind the `livingLegacy` launch flag at the app layer:
--
--   keeper_pieces      — binds a physical piece + edition to a keeper (the
--                        Better Auth userId). One keeper per (piece, edition).
--                        The recovery code printed on the back of the art is
--                        NEVER stored in plaintext here — only its SHA-256 hash,
--                        which is what a bind request is checked against. The
--                        current display location is keeper-editable presentation
--                        state; it never reaches the ledger chain.
--
--   keeper_intentions  — the yearly fused INTENTION and any anytime journaling.
--                        Mirrors atlas_inscriptions' erasure-safe shape exactly:
--                        the chain (on mandalacodes, via the shared inscription
--                        path) holds only {inscriptionId, contentHash, kind};
--                        the body + salt live HERE so a legal erasure (body +
--                        salt nulled, erased_at set) makes the chain commitment
--                        unlinkable without touching a single hash.
--
-- INVARIANT (law): no row here ever enters a ledger hash. Names, emails, birth
-- data, and intention free-text stay in these mutable D1 rows. The chain carries
-- opaque ids, event types, dates, and salted content commitments only.

CREATE TABLE IF NOT EXISTS keeper_pieces (
  id TEXT PRIMARY KEY,                          -- opaque binding id (kp-...)
  piece_id TEXT NOT NULL,                       -- Artwork.id in FULL_ARCHIVE
  edition_number INTEGER NOT NULL DEFAULT 0,    -- ledger chain-key convention: editionNumber ?? 0
  keeper_user_id TEXT NOT NULL,                 -- Better Auth user id (opaque; the users.clerk_user_id value)
  recovery_code_hash TEXT NOT NULL UNIQUE,      -- SHA-256 hex of the long code on the back of the art; plaintext never stored
  current_display_location TEXT,                -- keeper-editable; presentation only, never chain, never required
  claimed_at TEXT NOT NULL,                     -- ISO timestamp of the bind
  released_at TEXT,                             -- ISO timestamp if the binding is later released (transfer); NULL while active
  UNIQUE (piece_id, edition_number)             -- one active+historical binding row per piece/edition (first-bind-on-empty)
);

CREATE INDEX IF NOT EXISTS idx_keeper_pieces_keeper
  ON keeper_pieces(keeper_user_id);
CREATE INDEX IF NOT EXISTS idx_keeper_pieces_piece
  ON keeper_pieces(piece_id, edition_number);

CREATE TABLE IF NOT EXISTS keeper_intentions (
  id TEXT PRIMARY KEY,                          -- opaque, referenced by the chain's inscriptionId (int-...)
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,    -- ledger chain-key convention: editionNumber ?? 0
  author_user_id TEXT,                          -- opaque Better Auth userId; nullable (author account may be gone)
  kind TEXT NOT NULL CHECK (kind IN ('motivation', 'journal')),
                                                -- 'motivation' = the yearly birthday-locked intention;
                                                -- 'journal'     = anytime reflection, never locks
  body TEXT,                                    -- NULL after legal erasure
  body_hash TEXT NOT NULL,                      -- SHA-256(salt || body) hex — equals the chain event's contentHash
  content_salt TEXT,                            -- random 16-byte hex; deleted WITH body on erasure (unlinkability)
  confirmed_at TEXT,                            -- ISO; NULL while pending the confirm-before-it-sets grace window
  sets_for_year INTEGER,                        -- the calendar year a 'motivation' is locked for (e.g. 2026)
  birthday_window INTEGER NOT NULL DEFAULT 0,   -- boolean: was this set inside the keeper's birthday window
  created_at TEXT NOT NULL,                     -- ISO timestamp (authoring time)
  erased_at TEXT,                               -- ISO timestamp of legal erasure; row becomes a tombstone
  erase_reason TEXT                             -- admin-only audit note; never returned to keepers
);

CREATE INDEX IF NOT EXISTS idx_keeper_intentions_piece
  ON keeper_intentions(piece_id, edition_number);
CREATE INDEX IF NOT EXISTS idx_keeper_intentions_author
  ON keeper_intentions(author_user_id);
-- One LOCKED yearly motivation per (piece, edition, year): a partial unique index
-- counts only confirmed, non-erased motivations, so a keeper may draft/redraft
-- before confirming but only one motivation can SET per year.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_keeper_motivation_year
  ON keeper_intentions(piece_id, edition_number, sets_for_year)
  WHERE kind = 'motivation' AND confirmed_at IS NOT NULL AND erased_at IS NULL;
