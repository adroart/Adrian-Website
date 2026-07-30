export type RecoveryDependencies = {
  schemaVersion: string;
  buildVersion: string;
  keyVersion: number;
  generatorVersion: string;
  verifierVersion: string;
  backupReference: string;
  backupSha256: string;
};

export type StoredQualification = {
  result: 'passed' | 'failed';
  copiedArtifacts: boolean | 0 | 1;
  schemaVersion: string;
  buildVersion: string;
  keyVersion: number | null;
  generatorVersion: string | null;
  verifierVersion: string;
  backupReference: string | null;
  backupSha256: string | null;
};

export type QualificationStaleReason =
  | 'qualification_missing'
  | 'qualification_failed'
  | 'copied_artifacts_required'
  | 'schema_version_changed'
  | 'build_version_changed'
  | 'key_version_changed'
  | 'generator_version_changed'
  | 'verifier_version_changed'
  | 'backup_reference_changed'
  | 'backup_sha256_changed';

export type QualificationCurrentness = {
  current: boolean;
  reasons: QualificationStaleReason[];
};

export function qualificationIsCurrent(
  qualification: StoredQualification | null,
  dependencies: RecoveryDependencies,
): QualificationCurrentness {
  if (!qualification) {
    return { current: false, reasons: ['qualification_missing'] };
  }

  const reasons: QualificationStaleReason[] = [];

  if (qualification.result !== 'passed') {
    reasons.push('qualification_failed');
  }
  if (qualification.copiedArtifacts !== true && qualification.copiedArtifacts !== 1) {
    reasons.push('copied_artifacts_required');
  }
  if (qualification.schemaVersion !== dependencies.schemaVersion) {
    reasons.push('schema_version_changed');
  }
  if (qualification.buildVersion !== dependencies.buildVersion) {
    reasons.push('build_version_changed');
  }
  if (qualification.keyVersion !== dependencies.keyVersion) {
    reasons.push('key_version_changed');
  }
  if (qualification.generatorVersion !== dependencies.generatorVersion) {
    reasons.push('generator_version_changed');
  }
  if (qualification.verifierVersion !== dependencies.verifierVersion) {
    reasons.push('verifier_version_changed');
  }
  if (qualification.backupReference !== dependencies.backupReference) {
    reasons.push('backup_reference_changed');
  }
  if (qualification.backupSha256 !== dependencies.backupSha256) {
    reasons.push('backup_sha256_changed');
  }

  return { current: reasons.length === 0, reasons };
}
