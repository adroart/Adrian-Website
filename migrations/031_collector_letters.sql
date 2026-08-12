-- Generated letters belong to the canonical physical piece and travel with
-- it across keepers. They are private body records, never lineage events and
-- never inputs to a lineage hash.

CREATE TABLE collector_letters (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 71
    AND substr(id, 1, 7) = 'letter-'
    AND substr(id, 8) = lower(substr(id, 8))
    AND substr(id, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  keeper_piece_id TEXT NOT NULL
    REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('kin-claim', 'anniversary', 'transfer')),
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
  event_key TEXT NOT NULL CHECK (
    length(trim(event_key)) BETWEEN 5 AND 512
    AND (
      (kind = 'kin-claim' AND substr(event_key, 1, 4) = 'kin:')
      OR (kind = 'anniversary' AND substr(event_key, 1, 12) = 'anniversary:')
      OR (kind = 'transfer' AND substr(event_key, 1, 9) = 'transfer:')
    )
  ),
  UNIQUE (event_key, keeper_piece_id)
);

CREATE INDEX idx_collector_letters_piece_time
  ON collector_letters(keeper_piece_id, created_at DESC, id DESC);

CREATE INDEX idx_collector_letters_event
  ON collector_letters(event_key, keeper_piece_id);

CREATE TRIGGER collector_letters_no_update
BEFORE UPDATE ON collector_letters
BEGIN
  SELECT RAISE(ABORT, 'collector letters are append-only');
END;

CREATE TRIGGER collector_letters_no_delete
BEFORE DELETE ON collector_letters
BEGIN
  SELECT RAISE(ABORT, 'collector letters are append-only');
END;

PRAGMA foreign_key_check;
