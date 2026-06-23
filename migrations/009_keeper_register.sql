-- Living Legacy admin registration (Phase 1b of todo/plans/living-legacy.md).
-- OWNED BY ADRIAN-WEBSITE: this repo owns the shared `adrian-website` D1 schema.
-- Apply from THIS checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Never edit an applied migration; this is the next-numbered file
-- after 008_living_legacy.sql.
--
-- WHY THIS MIGRATION EXISTS:
--   008 modelled keeper_pieces as bind-on-empty: a row is born the moment a
--   keeper binds, so keeper_user_id and claimed_at were both NOT NULL. The admin
--   "register a piece" page (functions/api/admin/pieces.js) creates the row
--   EARLIER: the artist registers a physical piece, the server generates and
--   hashes its recovery code, and the row exists with a hash but NO keeper yet.
--   That row is claimed later, when whoever holds the art scans and enters the
--   printed code.
--
--   So registration needs three things 008 does not provide:
--     - keeper_user_id  must be NULLABLE (no keeper at registration time)
--     - claimed_at      must be NULLABLE (nothing is claimed at registration)
--     - registered_at   a new column: when the artist registered the piece
--
--   SQLite cannot relax a NOT NULL constraint with ALTER TABLE, so this is the
--   standard 12-step table rebuild (https://sqlite.org/lang_altertable.html):
--   create the new shape, copy rows, drop old, rename. The UNIQUE constraints and
--   indexes from 008 are recreated identically. recovery_code_hash stays NOT NULL
--   UNIQUE: a registered piece always has a code. No data is lost: any existing
--   bound rows copy across with claimed_at preserved and registered_at backfilled
--   to claimed_at (they were registered-and-claimed in the same moment).
--
-- INVARIANT (unchanged): no row here ever enters a ledger hash. The plaintext
-- recovery code is never stored, only recovery_code_hash (SHA-256 hex). The
-- chain (mandalacodes side) carries opaque ids + salted commitments only.

CREATE TABLE keeper_pieces_new (
  id TEXT PRIMARY KEY,                          -- opaque binding id (kp-...)
  piece_id TEXT NOT NULL,                       -- Artwork.id in FULL_ARCHIVE
  edition_number INTEGER NOT NULL DEFAULT 0,    -- ledger chain-key convention: editionNumber ?? 0
  keeper_user_id TEXT,                          -- Better Auth user id; NULL until a keeper binds
  recovery_code_hash TEXT NOT NULL UNIQUE,      -- SHA-256 hex of the long code on the back of the art; plaintext never stored
  current_display_location TEXT,                -- keeper-editable; presentation only, never chain, never required
  registered_at TEXT,                           -- ISO timestamp the artist registered the piece (admin side)
  claimed_at TEXT,                              -- ISO timestamp of the bind; NULL until a keeper claims
  released_at TEXT,                             -- ISO timestamp if the binding is later released (transfer); NULL while active
  UNIQUE (piece_id, edition_number)             -- one row per piece/edition
);

INSERT INTO keeper_pieces_new
  (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
   current_display_location, registered_at, claimed_at, released_at)
SELECT
  id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
  current_display_location, claimed_at, claimed_at, released_at
FROM keeper_pieces;

DROP TABLE keeper_pieces;
ALTER TABLE keeper_pieces_new RENAME TO keeper_pieces;

CREATE INDEX IF NOT EXISTS idx_keeper_pieces_keeper
  ON keeper_pieces(keeper_user_id);
CREATE INDEX IF NOT EXISTS idx_keeper_pieces_piece
  ON keeper_pieces(piece_id, edition_number);
