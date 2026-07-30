import { ARTWORK_PLATE_GENERATOR_VERSION } from '../../../utils/artworkPlate.ts';
import {
  qualificationIsCurrent,
} from '../../../utils/registryRecovery.ts';
import { BACKUP_SCHEMA_VERSION } from './plateBackup.js';

export const RECOVERY_VERIFIER_VERSION = 'copied-plate-v1';

export function recoveryBuildVersion(env) {
  const configured = env?.REGISTRY_BUILD_VERSION || env?.CF_PAGES_COMMIT_SHA;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim().slice(0, 256)
    : 'development';
}

export function recoveryDependenciesForRow(row, env) {
  return {
    schemaVersion: String(BACKUP_SCHEMA_VERSION),
    buildVersion: recoveryBuildVersion(env),
    keyVersion: Number(row.ownership_code_key_version),
    generatorVersion: ARTWORK_PLATE_GENERATOR_VERSION,
    verifierVersion: RECOVERY_VERIFIER_VERSION,
    backupReference: row.backup_reference,
    backupSha256: row.backup_sha256,
  };
}

export function storedQualificationFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    result: row.result,
    copiedArtifacts: row.copied_artifacts,
    schemaVersion: row.schema_version,
    buildVersion: row.build_version,
    keyVersion: row.key_version,
    generatorVersion: row.generator_version,
    verifierVersion: row.verifier_version,
    backupReference: row.backup_reference,
    backupSha256: row.backup_sha256,
    qualifiedAt: row.qualified_at,
  };
}

export async function loadLatestPassedPieceQualification(db, keeperPieceId) {
  const row = await db.prepare(
    `SELECT id, result, copied_artifacts, schema_version, build_version,
            key_version, generator_version, verifier_version,
            backup_reference, backup_sha256, qualified_at
       FROM registry_recovery_qualifications
      WHERE keeper_piece_id = ?1
        AND scope = 'piece'
        AND result = 'passed'
        AND copied_artifacts = 1
      ORDER BY qualified_at DESC, id DESC
      LIMIT 1`,
  ).bind(keeperPieceId).first();
  return storedQualificationFromRow(row);
}

export function recoveryQualificationStatus(qualification, dependencies) {
  const currentness = qualificationIsCurrent(qualification, dependencies);
  return {
    status: currentness.current ? 'current' : qualification ? 'stale' : 'missing',
    reasons: currentness.reasons,
    qualifiedAt: qualification?.qualifiedAt || null,
  };
}

export function recoveryQualificationStatement(db, {
  keeperPieceId,
  result,
  copiedArtifacts,
  dependencies,
  administrator,
  safeFailureCode = null,
  qualifiedAt = new Date().toISOString(),
  id = crypto.randomUUID(),
}) {
  return db.prepare(
    `INSERT INTO registry_recovery_qualifications
       (id, keeper_piece_id, scope, result, copied_artifacts,
        schema_version, build_version, key_version, generator_version,
        verifier_version, backup_reference, backup_sha256,
        administrator_user_id, administrator_email, safe_failure_code,
        qualified_at)
     VALUES (?1, ?2, 'piece', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
             ?12, ?13, ?14, ?15)`,
  ).bind(
    id,
    keeperPieceId,
    result,
    copiedArtifacts ? 1 : 0,
    dependencies.schemaVersion,
    dependencies.buildVersion,
    dependencies.keyVersion,
    dependencies.generatorVersion,
    dependencies.verifierVersion,
    dependencies.backupReference,
    dependencies.backupSha256,
    administrator.userId,
    administrator.email,
    safeFailureCode,
    qualifiedAt,
  );
}
