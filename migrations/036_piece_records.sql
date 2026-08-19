-- Generated permanent Piece Records, bound to their exact immutable R2 bytes.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- One row per generated record file (docs/piece-record-format.md). The file
-- itself lives write-once in R2 at records/{public_code}/{record_hash}.html
-- and the row is inserted only after the stored bytes are read back and
-- byte-compared. The address pin mirrors migration 021's backup-reference
-- pinning so a row can never point anywhere but its own content address.

CREATE TABLE piece_records (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 128),
  public_code TEXT NOT NULL CHECK (
    length(public_code) = 11
    AND public_code GLOB 'AR-????????'
    AND public_code NOT GLOB 'AR-*[^A-Z0-9]*'
  ),
  record_hash TEXT NOT NULL CHECK (
    length(record_hash) = 64
    AND record_hash = lower(record_hash)
    AND record_hash NOT GLOB '*[^0-9a-f]*'
  ),
  r2_key TEXT NOT NULL CHECK (length(trim(r2_key)) BETWEEN 1 AND 1000),
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'registration', 'activation', 'bind', 'transfer', 'yearly',
    'contribution', 'attachment', 'on_demand'
  )),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(created_at) IS NOT NULL
  ),
  UNIQUE (public_code, record_hash)
);

CREATE INDEX idx_piece_records_code_time
  ON piece_records(public_code, created_at DESC, id DESC);

CREATE TRIGGER piece_records_r2_key_address_insert_guard
BEFORE INSERT ON piece_records
WHEN NEW.r2_key <> 'records/' || NEW.public_code || '/' || NEW.record_hash || '.html'
BEGIN
  SELECT RAISE(ABORT, 'piece_record_r2_key_address_mismatch');
END;

CREATE TRIGGER piece_records_no_update
BEFORE UPDATE ON piece_records
BEGIN
  SELECT RAISE(ABORT, 'piece records are append-only');
END;

CREATE TRIGGER piece_records_no_delete
BEFORE DELETE ON piece_records
BEGIN
  SELECT RAISE(ABORT, 'piece records are append-only');
END;

PRAGMA foreign_key_check;
