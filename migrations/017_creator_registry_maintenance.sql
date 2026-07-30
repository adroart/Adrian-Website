-- Private creator-managed acquisition records and append-only maintenance history.
-- OWNED BY ADRIAN-WEBSITE. Apply from this checkout:
--   wrangler d1 migrations apply adrian-website --remote
-- Additive only. Prior migrations remain immutable.

ALTER TABLE keeper_pieces
  ADD COLUMN record_version INTEGER NOT NULL DEFAULT 0
  CHECK (typeof(record_version) = 'integer' AND record_version >= 0);

ALTER TABLE keeper_pieces
  ADD COLUMN steward_version INTEGER NOT NULL DEFAULT 0
  CHECK (typeof(steward_version) = 'integer' AND steward_version >= 0);

CREATE TABLE artwork_acquisitions (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  acquisition_type TEXT NOT NULL CHECK (acquisition_type IN (
    'sale', 'gift', 'retained', 'loan', 'consignment', 'inheritance', 'other'
  )),
  acquired_at TEXT CHECK (
    acquired_at IS NULL OR length(trim(acquired_at)) BETWEEN 1 AND 40
  ),
  amount_minor INTEGER CHECK (
    amount_minor IS NULL
    OR (typeof(amount_minor) = 'integer' AND amount_minor >= 0)
  ),
  currency TEXT,
  acquirer_reference TEXT CHECK (
    acquirer_reference IS NULL OR length(acquirer_reference) <= 200
  ),
  private_notes TEXT CHECK (private_notes IS NULL OR length(private_notes) <= 5000),
  document_reference TEXT CHECK (
    document_reference IS NULL OR length(document_reference) <= 1000
  ),
  public_provenance TEXT CHECK (
    public_provenance IS NULL OR length(public_provenance) <= 2000
  ),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (
    typeof(record_version) = 'integer' AND record_version >= 1
  ),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) BETWEEN 1 AND 40),
  updated_at TEXT NOT NULL CHECK (length(trim(updated_at)) BETWEEN 1 AND 40),
  CHECK (
    (amount_minor IS NULL AND currency IS NULL)
    OR (
      amount_minor IS NOT NULL
      AND typeof(currency) = 'text'
      AND length(currency) = 3
      AND currency GLOB '[A-Z][A-Z][A-Z]'
    )
  )
);

CREATE INDEX idx_artwork_acquisitions_piece_acquired
  ON artwork_acquisitions(keeper_piece_id, acquired_at DESC);

CREATE TABLE registry_maintenance_events (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 1 AND 80),
  keeper_piece_id TEXT REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  artwork_id TEXT CHECK (artwork_id IS NULL OR length(trim(artwork_id)) BETWEEN 1 AND 80),
  administrator_user_id TEXT NOT NULL CHECK (
    length(trim(administrator_user_id)) BETWEEN 1 AND 128
  ),
  administrator_email TEXT NOT NULL CHECK (
    length(trim(administrator_email)) BETWEEN 1 AND 254
  ),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  before_json TEXT NOT NULL CHECK (json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed')),
  related_record_id TEXT CHECK (
    related_record_id IS NULL OR length(trim(related_record_id)) BETWEEN 1 AND 128
  ),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) BETWEEN 1 AND 40)
);

CREATE INDEX idx_registry_maintenance_piece_created
  ON registry_maintenance_events(keeper_piece_id, created_at DESC);

CREATE INDEX idx_registry_maintenance_type_created
  ON registry_maintenance_events(event_type, created_at DESC);

CREATE TRIGGER registry_maintenance_events_no_update
BEFORE UPDATE ON registry_maintenance_events
BEGIN
  SELECT RAISE(ABORT, 'registry maintenance history is append-only');
END;

CREATE TRIGGER registry_maintenance_events_no_delete
BEFORE DELETE ON registry_maintenance_events
BEGIN
  SELECT RAISE(ABORT, 'registry maintenance history is append-only');
END;
