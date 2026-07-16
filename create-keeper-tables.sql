-- One-time: create the Living Legacy keeper tables on the live database.
-- The migration tracker erroneously marked 008/009 applied while the tables were
-- never created, so `wrangler d1 migrations apply` reports "nothing to apply".
-- This file is the exact end state of 008 + 009 combined, idempotent (IF NOT EXISTS),
-- so it is safe to run and cannot harm existing data.
--
-- Run from this folder:
--   npx wrangler d1 execute adrian-website --remote --file ./create-keeper-tables.sql
--
-- After it succeeds you can delete this file.

CREATE TABLE IF NOT EXISTS keeper_pieces (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,
  keeper_user_id TEXT,
  recovery_code_hash TEXT NOT NULL UNIQUE,
  current_display_location TEXT,
  registered_at TEXT,
  claimed_at TEXT,
  released_at TEXT,
  UNIQUE (piece_id, edition_number)
);
CREATE INDEX IF NOT EXISTS idx_keeper_pieces_keeper ON keeper_pieces(keeper_user_id);
CREATE INDEX IF NOT EXISTS idx_keeper_pieces_piece ON keeper_pieces(piece_id, edition_number);

CREATE TABLE IF NOT EXISTS keeper_intentions (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,
  author_user_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('motivation', 'journal')),
  body TEXT,
  body_hash TEXT NOT NULL,
  content_salt TEXT,
  confirmed_at TEXT,
  sets_for_year INTEGER,
  birthday_window INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  erased_at TEXT,
  erase_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_keeper_intentions_piece ON keeper_intentions(piece_id, edition_number);
CREATE INDEX IF NOT EXISTS idx_keeper_intentions_author ON keeper_intentions(author_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_keeper_motivation_year
  ON keeper_intentions(piece_id, edition_number, sets_for_year)
  WHERE kind = 'motivation' AND confirmed_at IS NOT NULL AND erased_at IS NULL;
