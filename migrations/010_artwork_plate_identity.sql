-- Permanent artwork plate identity and recoverable Ownership Code envelope.
-- Additive only: existing keeper_pieces rows remain valid and are classified
-- as legacy plates until a new physical identity is explicitly issued.

ALTER TABLE keeper_pieces ADD COLUMN public_code TEXT;
ALTER TABLE keeper_pieces ADD COLUMN issuance_key TEXT;
ALTER TABLE keeper_pieces
  ADD COLUMN plate_status TEXT NOT NULL DEFAULT 'legacy'
  CHECK (plate_status IN ('legacy', 'generated', 'active'));
ALTER TABLE keeper_pieces ADD COLUMN plate_generated_at TEXT;
ALTER TABLE keeper_pieces ADD COLUMN plate_activated_at TEXT;
ALTER TABLE keeper_pieces ADD COLUMN front_svg_sha256 TEXT;
ALTER TABLE keeper_pieces ADD COLUMN back_svg_sha256 TEXT;
ALTER TABLE keeper_pieces ADD COLUMN ownership_code_ciphertext TEXT;
ALTER TABLE keeper_pieces ADD COLUMN ownership_code_nonce TEXT;
ALTER TABLE keeper_pieces ADD COLUMN ownership_code_key_version INTEGER;
ALTER TABLE keeper_pieces ADD COLUMN backup_status TEXT;
ALTER TABLE keeper_pieces ADD COLUMN backup_reference TEXT;
ALTER TABLE keeper_pieces ADD COLUMN backup_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_keeper_pieces_public_code
  ON keeper_pieces(public_code)
  WHERE public_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_keeper_pieces_issuance_key
  ON keeper_pieces(issuance_key)
  WHERE issuance_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_keeper_pieces_plate_status
  ON keeper_pieces(plate_status);

-- Audit metadata deliberately excludes plaintext codes, ciphertext and nonces.
CREATE TABLE IF NOT EXISTS ownership_code_audit (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  request_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ownership_code_audit_piece_created
  ON ownership_code_audit(keeper_piece_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_code_audit_request
  ON ownership_code_audit(request_id);
