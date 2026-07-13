-- Private proof retained for governed ownership claims. This table is admin-only.
CREATE TABLE IF NOT EXISTS artwork_claim_evidence (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  verified_email TEXT NOT NULL CHECK (length(verified_email) BETWEEN 1 AND 254),
  ip_address TEXT CHECK (ip_address IS NULL OR length(ip_address) <= 64),
  user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 512),
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_piece_created
  ON artwork_claim_evidence(keeper_piece_id, created_at DESC);

-- Public, secret-free, append-only event chain. Payloads contain operational
-- state only; private actor/contact/network evidence is kept above.
CREATE TABLE IF NOT EXISTS artwork_lineage_events (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  public_payload_json TEXT NOT NULL,
  CHECK ((sequence = 1 AND previous_hash IS NULL) OR (sequence > 1 AND previous_hash IS NOT NULL)),
  UNIQUE (keeper_piece_id, sequence),
  UNIQUE (keeper_piece_id, previous_hash),
  UNIQUE (event_hash)
);
CREATE INDEX IF NOT EXISTS idx_lineage_piece_sequence
  ON artwork_lineage_events(keeper_piece_id, sequence);

CREATE TRIGGER IF NOT EXISTS artwork_lineage_no_update
BEFORE UPDATE ON artwork_lineage_events
BEGIN
  SELECT RAISE(ABORT, 'artwork lineage is append-only');
END;

CREATE TRIGGER IF NOT EXISTS artwork_lineage_no_delete
BEFORE DELETE ON artwork_lineage_events
BEGIN
  SELECT RAISE(ABORT, 'artwork lineage is append-only');
END;
