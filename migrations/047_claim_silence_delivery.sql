-- Durable evidence for claim-silence notifications. A row exists only after
-- the provider accepted the message. Stable provider keys make a retry after
-- an ambiguous process failure safe without claiming an unsent delivery.
CREATE TABLE claim_silence_deliveries (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 5 AND 128 AND id GLOB 'csd-*'),
  window_id TEXT NOT NULL REFERENCES claim_silence_windows(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN (
    'initial_steward', 'completion_steward', 'completion_claimant'
  )),
  provider_idempotency_key TEXT NOT NULL UNIQUE CHECK (
    length(provider_idempotency_key) BETWEEN 8 AND 180
  ),
  sent_at TEXT NOT NULL CHECK (
    sent_at GLOB '????-??-??T??:??:??*Z' AND julianday(sent_at) IS NOT NULL
  ),
  UNIQUE (window_id, kind)
);

CREATE INDEX idx_claim_silence_deliveries_window
  ON claim_silence_deliveries(window_id, kind);

CREATE TRIGGER claim_silence_deliveries_no_update
BEFORE UPDATE ON claim_silence_deliveries
BEGIN
  SELECT RAISE(ABORT, 'silence deliveries are append-only');
END;

CREATE TRIGGER claim_silence_deliveries_no_delete
BEFORE DELETE ON claim_silence_deliveries
BEGIN
  SELECT RAISE(ABORT, 'silence deliveries are append-only');
END;

PRAGMA foreign_key_check;
