-- Bind every verified encrypted plate backup to its exact immutable R2 bytes.
ALTER TABLE keeper_pieces ADD COLUMN backup_sha256 TEXT CHECK (
  backup_sha256 IS NULL
  OR (
    typeof(backup_sha256) = 'text'
    AND length(backup_sha256) = 64
    AND backup_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);

CREATE TRIGGER keeper_piece_backup_reference_digest_insert_guard
BEFORE INSERT ON keeper_pieces
WHEN (NEW.backup_reference IS NULL) <> (NEW.backup_sha256 IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_backup_reference_digest_mismatch');
END;

CREATE TRIGGER keeper_piece_backup_reference_digest_update_guard
BEFORE UPDATE OF backup_reference, backup_sha256 ON keeper_pieces
WHEN (NEW.backup_reference IS NULL) <> (NEW.backup_sha256 IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_backup_reference_digest_mismatch');
END;

CREATE TRIGGER keeper_piece_backup_reference_address_insert_guard
BEFORE INSERT ON keeper_pieces
WHEN NEW.backup_reference IS NOT NULL AND (
  NEW.public_code IS NULL
  OR NEW.backup_reference <> 'plates/' || NEW.public_code || '/' || NEW.backup_sha256 || '.json'
)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_backup_reference_address_mismatch');
END;

CREATE TRIGGER keeper_piece_backup_reference_address_update_guard
BEFORE UPDATE OF public_code, backup_reference, backup_sha256 ON keeper_pieces
WHEN NEW.backup_reference IS NOT NULL AND (
  NEW.public_code IS NULL
  OR NEW.backup_reference <> 'plates/' || NEW.public_code || '/' || NEW.backup_sha256 || '.json'
)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_backup_reference_address_mismatch');
END;

CREATE TRIGGER keeper_piece_verified_backup_digest_insert_guard
BEFORE INSERT ON keeper_pieces
WHEN NEW.backup_status = 'verified'
  AND (NEW.backup_reference IS NULL OR NEW.backup_sha256 IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_verified_backup_digest_required');
END;

CREATE TRIGGER keeper_piece_verified_backup_digest_update_guard
BEFORE UPDATE OF backup_status, backup_reference, backup_sha256 ON keeper_pieces
WHEN NEW.backup_status = 'verified'
  AND (NEW.backup_reference IS NULL OR NEW.backup_sha256 IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'keeper_piece_verified_backup_digest_required');
END;
