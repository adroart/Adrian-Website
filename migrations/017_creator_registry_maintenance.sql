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
  id ANY PRIMARY KEY CHECK (
    typeof(id) = 'text' AND length(trim(id)) BETWEEN 1 AND 128
  ),
  keeper_piece_id ANY NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT CHECK (
    typeof(keeper_piece_id) = 'text' AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128
  ),
  acquisition_type ANY NOT NULL CHECK (
    typeof(acquisition_type) = 'text'
    AND acquisition_type IN (
      'sale', 'gift', 'retained', 'loan', 'consignment', 'inheritance', 'other'
    )
  ),
  acquired_at ANY CHECK (
    acquired_at IS NULL
    OR (typeof(acquired_at) = 'text' AND length(trim(acquired_at)) BETWEEN 1 AND 40)
  ),
  amount_minor INTEGER CHECK (
    amount_minor IS NULL
    OR (typeof(amount_minor) = 'integer' AND amount_minor >= 0)
  ),
  currency ANY CHECK (currency IS NULL OR typeof(currency) = 'text'),
  acquirer_reference ANY CHECK (
    acquirer_reference IS NULL
    OR (typeof(acquirer_reference) = 'text' AND length(acquirer_reference) <= 200)
  ),
  private_notes ANY CHECK (
    private_notes IS NULL
    OR (typeof(private_notes) = 'text' AND length(private_notes) <= 5000)
  ),
  document_reference ANY CHECK (
    document_reference IS NULL
    OR (typeof(document_reference) = 'text' AND length(document_reference) <= 1000)
  ),
  public_provenance ANY CHECK (
    public_provenance IS NULL
    OR (typeof(public_provenance) = 'text' AND length(public_provenance) <= 2000)
  ),
  record_version INTEGER NOT NULL DEFAULT 1 CHECK (
    typeof(record_version) = 'integer' AND record_version >= 1
  ),
  created_at ANY NOT NULL CHECK (
    typeof(created_at) = 'text' AND length(trim(created_at)) BETWEEN 1 AND 40
  ),
  updated_at ANY NOT NULL CHECK (
    typeof(updated_at) = 'text' AND length(trim(updated_at)) BETWEEN 1 AND 40
  ),
  CHECK (
    (amount_minor IS NULL AND currency IS NULL)
    OR (
      amount_minor IS NOT NULL
      AND typeof(currency) = 'text'
      AND length(currency) = 3
      AND currency GLOB '[A-Z][A-Z][A-Z]'
    )
  )
) STRICT;

CREATE INDEX idx_artwork_acquisitions_piece_acquired
  ON artwork_acquisitions(keeper_piece_id, acquired_at DESC);

CREATE TABLE registry_maintenance_events (
  id ANY PRIMARY KEY CHECK (
    typeof(id) = 'text' AND length(trim(id)) BETWEEN 1 AND 128
  ),
  idempotency_key ANY NOT NULL UNIQUE CHECK (
    typeof(idempotency_key) = 'text'
    AND length(trim(idempotency_key)) BETWEEN 1 AND 128
  ),
  event_type ANY NOT NULL CHECK (
    typeof(event_type) = 'text' AND length(trim(event_type)) BETWEEN 1 AND 80
  ),
  keeper_piece_id ANY REFERENCES keeper_pieces(id) ON DELETE RESTRICT CHECK (
    keeper_piece_id IS NULL
    OR (typeof(keeper_piece_id) = 'text' AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128)
  ),
  artwork_id ANY CHECK (
    artwork_id IS NULL
    OR (typeof(artwork_id) = 'text' AND length(trim(artwork_id)) BETWEEN 1 AND 80)
  ),
  administrator_user_id ANY NOT NULL CHECK (
    typeof(administrator_user_id) = 'text'
    AND length(trim(administrator_user_id)) BETWEEN 1 AND 128
  ),
  administrator_email ANY NOT NULL CHECK (
    typeof(administrator_email) = 'text'
    AND length(trim(administrator_email)) BETWEEN 1 AND 254
  ),
  reason ANY NOT NULL CHECK (
    typeof(reason) = 'text' AND length(trim(reason)) BETWEEN 1 AND 500
  ),
  before_json ANY NOT NULL CHECK (
    typeof(before_json) = 'text' AND json_valid(before_json)
  ),
  after_json ANY NOT NULL CHECK (
    typeof(after_json) = 'text' AND json_valid(after_json)
  ),
  outcome ANY NOT NULL CHECK (
    typeof(outcome) = 'text' AND outcome IN ('succeeded', 'failed')
  ),
  related_record_id ANY CHECK (
    related_record_id IS NULL
    OR (typeof(related_record_id) = 'text' AND length(trim(related_record_id)) BETWEEN 1 AND 128)
  ),
  created_at ANY NOT NULL CHECK (
    typeof(created_at) = 'text' AND length(trim(created_at)) BETWEEN 1 AND 40
  )
) STRICT;

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
