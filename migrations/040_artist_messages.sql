-- The artist's message: words placed inside one physical piece, sealed until
-- its caretaker unlocks. A message belongs to exactly one physical instance
-- (keeper_piece_id); artwork-wide messages are out of scope. While
-- revealed_at IS NULL and the piece is unclaimed the body is returned to the
-- artist only; after reveal it stays readable to the caretaker. Bodies are
-- NEVER part of the public Piece Record: the record generator
-- (functions/api/_lib/pieceRecord.js) queries named tables and never this one.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- Rows are permanent: no DELETE, ever. The only permitted UPDATEs are the
-- two one-way stamps, each set at most once from NULL: revealed_at (the
-- caretaker met the message) and superseded_at (the artist wrote a newer
-- message for the same piece before reveal). The body is immutable after
-- insert. At most one ACTIVE (non-superseded) message exists per piece,
-- enforced by a partial unique index.

CREATE TABLE artist_messages (
  id TEXT PRIMARY KEY CHECK (
    typeof(id) = 'text'
    AND substr(id, 1, 3) = 'am-'
    AND length(trim(id)) BETWEEN 4 AND 128
  ),
  keeper_piece_id TEXT NOT NULL
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  -- The 031 collector-letters body discipline, mirrored exactly: plain text,
  -- one paragraph, no '@' (so no email can ride in), no newlines, and none
  -- of the internal identifier prefixes.
  body TEXT NOT NULL CHECK (
    typeof(body) = 'text'
    AND length(body) BETWEEN 1 AND 2000
    AND body = trim(body)
    AND instr(body, '@') = 0
    AND instr(body, char(10)) = 0
    AND instr(body, char(13)) = 0
    AND lower(body) NOT GLOB '*auth-*'
    AND lower(body) NOT GLOB '*kp-*'
    AND lower(body) NOT GLOB '*tp-*'
    AND lower(body) NOT GLOB '*dream-*'
    AND lower(body) NOT GLOB '*consent-*'
  ),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(created_at) IS NOT NULL
  ),
  revealed_at TEXT CHECK (
    revealed_at IS NULL
    OR (
      revealed_at GLOB '????-??-??T??:??:??*Z'
      AND julianday(revealed_at) IS NOT NULL
    )
  ),
  superseded_at TEXT CHECK (
    superseded_at IS NULL
    OR (
      superseded_at GLOB '????-??-??T??:??:??*Z'
      AND julianday(superseded_at) IS NOT NULL
    )
  )
);

CREATE INDEX idx_artist_messages_piece_time
  ON artist_messages(keeper_piece_id, created_at DESC, id DESC);

-- One active (non-superseded) message per physical piece.
CREATE UNIQUE INDEX idx_artist_messages_one_active
  ON artist_messages(keeper_piece_id) WHERE superseded_at IS NULL;

-- The only permitted UPDATEs: revealed_at NULL -> value once, and
-- superseded_at NULL -> value once. Identity, body, and created_at are
-- immutable; a stamp already set can never change or clear.
CREATE TRIGGER artist_messages_update_guard
BEFORE UPDATE ON artist_messages
BEGIN
  SELECT RAISE(ABORT, 'artist message update must be a first reveal or a first supersede')
   WHERE NEW.id IS NOT OLD.id
    OR NEW.keeper_piece_id IS NOT OLD.keeper_piece_id
    OR NEW.body IS NOT OLD.body
    OR NEW.created_at IS NOT OLD.created_at
    OR (OLD.revealed_at IS NOT NULL AND NEW.revealed_at IS NOT OLD.revealed_at)
    OR (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS NOT OLD.superseded_at);
END;

CREATE TRIGGER artist_messages_no_delete
BEFORE DELETE ON artist_messages
BEGIN
  SELECT RAISE(ABORT, 'artist messages are permanent, never deleted');
END;

PRAGMA foreign_key_check;
