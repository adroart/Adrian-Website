-- Register permanent artwork identity before optional physical fabrication.

ALTER TABLE keeper_pieces ADD COLUMN registration_status TEXT CHECK (
  registration_status IS NULL OR registration_status = 'registered'
);
ALTER TABLE keeper_pieces ADD COLUMN registered_by_user_id TEXT CHECK (
  registered_by_user_id IS NULL
  OR length(trim(registered_by_user_id)) BETWEEN 1 AND 128
);
ALTER TABLE keeper_pieces ADD COLUMN identity_backup_status TEXT CHECK (
  identity_backup_status IS NULL OR identity_backup_status = 'verified'
);
ALTER TABLE keeper_pieces ADD COLUMN identity_backup_reference TEXT CHECK (
  identity_backup_reference IS NULL
  OR length(trim(identity_backup_reference)) BETWEEN 1 AND 1000
);
ALTER TABLE keeper_pieces ADD COLUMN identity_backup_sha256 TEXT CHECK (
  identity_backup_sha256 IS NULL
  OR (
    length(identity_backup_sha256) = 64
    AND identity_backup_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);
ALTER TABLE keeper_pieces ADD COLUMN identity_backup_at TEXT CHECK (
  identity_backup_at IS NULL
  OR (
    length(trim(identity_backup_at)) BETWEEN 20 AND 40
    AND identity_backup_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(identity_backup_at) IS NOT NULL
  )
);

-- Existing permanent identities remain registered without inventing a new
-- backup or administrator. Their current plate and recovery guarantees remain
-- exactly as they were before this migration.
UPDATE keeper_pieces
   SET registration_status = 'registered'
 WHERE public_code IS NOT NULL;

CREATE TRIGGER keeper_piece_registered_identity_insert_guard
BEFORE INSERT ON keeper_pieces
WHEN NEW.registration_status = 'registered' AND (
  NEW.public_code IS NULL
  OR NEW.issuance_key IS NULL
  OR NEW.registered_at IS NULL
  OR NEW.ownership_code_ciphertext IS NULL
  OR NEW.ownership_code_nonce IS NULL
  OR NEW.ownership_code_key_version IS NULL
  OR NEW.identity_backup_status <> 'verified'
  OR NEW.identity_backup_reference IS NULL
  OR NEW.identity_backup_sha256 IS NULL
  OR NEW.identity_backup_at IS NULL
  OR NEW.identity_backup_reference <>
    'identities/' || NEW.public_code || '/' || NEW.identity_backup_sha256 || '.json'
)
BEGIN
  SELECT RAISE(ABORT, 'registered artwork identity is incomplete');
END;

CREATE TRIGGER keeper_piece_registered_identity_update_guard
BEFORE UPDATE OF registration_status, public_code, issuance_key, registered_at,
  ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
  identity_backup_status, identity_backup_reference, identity_backup_sha256,
  identity_backup_at
ON keeper_pieces
WHEN NEW.registration_status = 'registered' AND (
  NEW.public_code IS NULL
  OR NEW.issuance_key IS NULL
  OR NEW.registered_at IS NULL
  OR NEW.ownership_code_ciphertext IS NULL
  OR NEW.ownership_code_nonce IS NULL
  OR NEW.ownership_code_key_version IS NULL
  OR NEW.identity_backup_status <> 'verified'
  OR NEW.identity_backup_reference IS NULL
  OR NEW.identity_backup_sha256 IS NULL
  OR NEW.identity_backup_at IS NULL
  OR NEW.identity_backup_reference <>
    'identities/' || NEW.public_code || '/' || NEW.identity_backup_sha256 || '.json'
)
BEGIN
  SELECT RAISE(ABORT, 'registered artwork identity is incomplete');
END;

CREATE TABLE artwork_identity_recovery_qualifications (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 128),
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  result TEXT NOT NULL CHECK (result IN ('passed', 'failed')),
  copied_artifact INTEGER NOT NULL CHECK (copied_artifact IN (0, 1)),
  schema_version TEXT NOT NULL CHECK (length(trim(schema_version)) BETWEEN 1 AND 128),
  build_version TEXT NOT NULL CHECK (length(trim(build_version)) BETWEEN 1 AND 256),
  key_version INTEGER NOT NULL CHECK (key_version >= 1),
  verifier_version TEXT NOT NULL CHECK (length(trim(verifier_version)) BETWEEN 1 AND 128),
  backup_reference TEXT NOT NULL CHECK (length(trim(backup_reference)) BETWEEN 1 AND 1000),
  backup_sha256 TEXT NOT NULL CHECK (
    length(backup_sha256) = 64 AND backup_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  administrator_user_id TEXT NOT NULL CHECK (
    length(trim(administrator_user_id)) BETWEEN 1 AND 128
  ),
  administrator_email TEXT NOT NULL CHECK (
    length(trim(administrator_email)) BETWEEN 1 AND 254
  ),
  safe_failure_code TEXT CHECK (
    safe_failure_code IS NULL
    OR (
      length(safe_failure_code) BETWEEN 1 AND 80
      AND safe_failure_code GLOB '[a-z]*'
      AND safe_failure_code NOT GLOB '*[^a-z0-9_]*'
    )
  ),
  qualified_at TEXT NOT NULL CHECK (
    length(trim(qualified_at)) BETWEEN 20 AND 40
    AND qualified_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(qualified_at) IS NOT NULL
  ),
  CHECK (
    (result = 'failed' AND safe_failure_code IS NOT NULL)
    OR (result = 'passed' AND safe_failure_code IS NULL AND copied_artifact = 1)
  )
);

CREATE INDEX idx_artwork_identity_qualification_piece_time
  ON artwork_identity_recovery_qualifications(keeper_piece_id, qualified_at DESC, id);

CREATE TRIGGER artwork_identity_qualifications_no_update
BEFORE UPDATE ON artwork_identity_recovery_qualifications
BEGIN
  SELECT RAISE(ABORT, 'artwork identity recovery qualifications are append-only');
END;

CREATE TRIGGER artwork_identity_qualifications_no_delete
BEFORE DELETE ON artwork_identity_recovery_qualifications
BEGIN
  SELECT RAISE(ABORT, 'artwork identity recovery qualifications are append-only');
END;

-- Catalog membership says that a work belongs in the registry experience. It
-- intentionally carries no physical instance, public code, Ownership Code,
-- edition claim, keeper, or lineage identity.
CREATE TABLE registry_catalog_membership (
  artwork_id TEXT PRIMARY KEY CHECK (
    typeof(artwork_id) = 'text'
    AND artwork_id GLOB '[A-Z][A-Z]*-[0-9][0-9][0-9]'
    AND length(artwork_id) BETWEEN 6 AND 7
  ),
  series TEXT CHECK (
    series IS NULL
    OR (typeof(series) = 'text' AND length(trim(series)) BETWEEN 1 AND 80)
  ),
  category TEXT NOT NULL CHECK (
    typeof(category) = 'text' AND length(trim(category)) BETWEEN 1 AND 80
  ),
  catalog_digest TEXT NOT NULL CHECK (
    typeof(catalog_digest) = 'text'
    AND length(catalog_digest) = 64
    AND catalog_digest = lower(catalog_digest)
    AND catalog_digest NOT GLOB '*[^0-9a-f]*'
  ),
  first_seeded_at TEXT NOT NULL CHECK (
    length(trim(first_seeded_at)) BETWEEN 20 AND 40
    AND first_seeded_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(first_seeded_at) IS NOT NULL
  )
);

CREATE TRIGGER registry_catalog_membership_no_update
BEFORE UPDATE ON registry_catalog_membership
BEGIN
  SELECT RAISE(ABORT, 'registry catalog membership is immutable');
END;

CREATE TRIGGER registry_catalog_membership_no_delete
BEFORE DELETE ON registry_catalog_membership
BEGIN
  SELECT RAISE(ABORT, 'registry catalog membership is immutable');
END;

PRAGMA foreign_key_check;
