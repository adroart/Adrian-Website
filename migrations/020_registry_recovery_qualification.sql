-- Append-only proof that a registry recovery path was exercised by an
-- administrator against specific copied artifacts and exact system versions.
-- This table intentionally contains no Ownership Code or encrypted envelope.

CREATE TABLE registry_recovery_qualifications (
  id ANY PRIMARY KEY CHECK (
    typeof(id) = 'text' AND length(trim(id)) BETWEEN 1 AND 128
  ),
  keeper_piece_id ANY REFERENCES keeper_pieces(id) ON DELETE RESTRICT CHECK (
    keeper_piece_id IS NULL
    OR (
      typeof(keeper_piece_id) = 'text'
      AND length(trim(keeper_piece_id)) BETWEEN 1 AND 128
    )
  ),
  scope ANY NOT NULL CHECK (
    typeof(scope) = 'text'
    AND scope IN ('piece', 'registry', 'administrative')
  ),
  result ANY NOT NULL CHECK (
    typeof(result) = 'text' AND result IN ('passed', 'failed')
  ),
  copied_artifacts INTEGER NOT NULL CHECK (
    typeof(copied_artifacts) = 'integer' AND copied_artifacts IN (0, 1)
  ),
  schema_version ANY NOT NULL CHECK (
    typeof(schema_version) = 'text'
    AND length(trim(schema_version)) BETWEEN 1 AND 128
  ),
  build_version ANY NOT NULL CHECK (
    typeof(build_version) = 'text'
    AND length(trim(build_version)) BETWEEN 1 AND 256
  ),
  key_version INTEGER CHECK (
    key_version IS NULL
    OR (
      typeof(key_version) = 'integer'
      AND key_version BETWEEN 1 AND 9007199254740991
    )
  ),
  generator_version ANY CHECK (
    generator_version IS NULL
    OR (
      typeof(generator_version) = 'text'
      AND length(trim(generator_version)) BETWEEN 1 AND 128
    )
  ),
  verifier_version ANY NOT NULL CHECK (
    typeof(verifier_version) = 'text'
    AND length(trim(verifier_version)) BETWEEN 1 AND 128
  ),
  backup_reference ANY CHECK (
    backup_reference IS NULL
    OR (
      typeof(backup_reference) = 'text'
      AND length(trim(backup_reference)) BETWEEN 1 AND 1000
    )
  ),
  backup_sha256 ANY CHECK (
    backup_sha256 IS NULL
    OR (
      typeof(backup_sha256) = 'text'
      AND length(backup_sha256) = 64
      AND backup_sha256 NOT GLOB '*[^0-9a-f]*'
    )
  ),
  administrator_user_id ANY NOT NULL CHECK (
    typeof(administrator_user_id) = 'text'
    AND length(trim(administrator_user_id)) BETWEEN 1 AND 128
  ),
  administrator_email ANY NOT NULL CHECK (
    typeof(administrator_email) = 'text'
    AND length(trim(administrator_email)) BETWEEN 1 AND 254
  ),
  safe_failure_code ANY CHECK (
    safe_failure_code IS NULL
    OR (
      typeof(safe_failure_code) = 'text'
      AND length(safe_failure_code) BETWEEN 1 AND 80
      AND safe_failure_code GLOB '[a-z]*'
      AND safe_failure_code NOT GLOB '*[^a-z0-9_]*'
    )
  ),
  qualified_at ANY NOT NULL CHECK (
    typeof(qualified_at) = 'text'
    AND length(trim(qualified_at)) BETWEEN 20 AND 40
    AND qualified_at GLOB '????-??-??T??:??:??*Z'
    AND julianday(qualified_at) IS NOT NULL
  ),
  CHECK (scope = 'piece' OR keeper_piece_id IS NULL),
  CHECK (scope <> 'piece' OR keeper_piece_id IS NOT NULL),
  CHECK (
    scope <> 'piece'
    OR (key_version IS NOT NULL AND generator_version IS NOT NULL)
  ),
  CHECK (
    (backup_reference IS NULL AND backup_sha256 IS NULL)
    OR (backup_reference IS NOT NULL AND backup_sha256 IS NOT NULL)
  ),
  CHECK (
    copied_artifacts = 0
    OR (backup_reference IS NOT NULL AND backup_sha256 IS NOT NULL)
  ),
  CHECK (
    (result = 'failed' AND safe_failure_code IS NOT NULL)
    OR (result = 'passed' AND safe_failure_code IS NULL)
  )
) STRICT;

CREATE INDEX idx_registry_recovery_qualification_piece_time
  ON registry_recovery_qualifications(keeper_piece_id, qualified_at DESC, id);

CREATE INDEX idx_registry_recovery_qualification_scope_time
  ON registry_recovery_qualifications(scope, qualified_at DESC, id);

CREATE TRIGGER registry_recovery_qualifications_no_update
BEFORE UPDATE ON registry_recovery_qualifications
BEGIN
  SELECT RAISE(ABORT, 'registry recovery qualifications are append-only');
END;

CREATE TRIGGER registry_recovery_qualifications_no_delete
BEFORE DELETE ON registry_recovery_qualifications
BEGIN
  SELECT RAISE(ABORT, 'registry recovery qualifications are append-only');
END;
