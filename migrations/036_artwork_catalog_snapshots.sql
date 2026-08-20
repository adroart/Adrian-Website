-- Append-only catalog metadata snapshots for permanent Piece Records.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.
--
-- A Piece Record (docs/piece-record-format.md) must stay legible after the
-- live catalog changes, so the catalog metadata it references is frozen here,
-- content-addressed by the hash of its canonical JSON. Rows are never updated
-- and never deleted; a changed catalog entry simply produces a new snapshot.

CREATE TABLE artwork_catalog_snapshots (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 160),
  artwork_id TEXT NOT NULL CHECK (length(trim(artwork_id)) BETWEEN 1 AND 80),
  snapshot_hash TEXT NOT NULL CHECK (
    length(snapshot_hash) = 64
    AND snapshot_hash = lower(snapshot_hash)
    AND snapshot_hash NOT GLOB '*[^0-9a-f]*'
  ),
  canonical_json TEXT NOT NULL CHECK (
    length(trim(canonical_json)) > 0
    AND json_valid(canonical_json)
    AND json_type(canonical_json) = 'object'
  ),
  source TEXT NOT NULL CHECK (source IN ('mockData', 'admin')),
  created_at TEXT NOT NULL CHECK (
    created_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(created_at) IS NOT NULL
  ),
  UNIQUE (artwork_id, snapshot_hash)
);

CREATE INDEX idx_artwork_catalog_snapshots_artwork_time
  ON artwork_catalog_snapshots(artwork_id, created_at DESC, id DESC);

CREATE TRIGGER artwork_catalog_snapshots_no_update
BEFORE UPDATE ON artwork_catalog_snapshots
BEGIN
  SELECT RAISE(ABORT, 'artwork catalog snapshots are append-only');
END;

CREATE TRIGGER artwork_catalog_snapshots_no_delete
BEFORE DELETE ON artwork_catalog_snapshots
BEGIN
  SELECT RAISE(ABORT, 'artwork catalog snapshots are append-only');
END;

PRAGMA foreign_key_check;
