import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  qualificationIsCurrent,
  type RecoveryDependencies,
  type StoredQualification,
} from '../utils/registryRecovery';
import * as recoveryQualification from '../functions/api/_lib/recoveryQualification.js';

const migrationUrl = new URL(
  '../migrations/020_registry_recovery_qualification.sql',
  import.meta.url,
);

function migrationSource() {
  assert.ok(existsSync(migrationUrl), 'recovery qualification migration must exist');
  return readFileSync(migrationUrl, 'utf8');
}

const keeperSchema = `
  CREATE TABLE keeper_pieces (id TEXT PRIMARY KEY);
  INSERT INTO keeper_pieces (id) VALUES ('kp-qualification');
`;

const validQualification = `
  INSERT INTO registry_recovery_qualifications (
    id, keeper_piece_id, scope, result, copied_artifacts,
    schema_version, build_version, key_version, generator_version,
    verifier_version, backup_reference, backup_sha256,
    administrator_user_id, administrator_email, safe_failure_code,
    qualified_at
  ) VALUES (
    'rq-1', 'kp-qualification', 'piece', 'passed', 1,
    '020', 'build-2026-07-31', 7, 'plate-generator-v3',
    'copied-package-v2', 'plates/AR-7KQ9M2WX/abc.json', '${'a'.repeat(64)}',
    'admin-1', 'artist@example.com', NULL,
    '2026-07-31T01:02:03.000Z'
  );
`;

function sqliteJson(sql: string) {
  const output = execFileSync('sqlite3', ['-json', ':memory:'], {
    encoding: 'utf8',
    input: `PRAGMA foreign_keys = ON;\n${sql}`,
  }).trim();
  return output ? JSON.parse(output) : [];
}

function sqliteResult(sql: string) {
  return spawnSync('sqlite3', [':memory:'], {
    encoding: 'utf8',
    input: `PRAGMA foreign_keys = ON;\n${sql}`,
  });
}

describe('registry recovery qualification migration', () => {
  it('stores the administrator, copied-artifact proof, and every dependency version', () => {
    const rows = sqliteJson(`
      ${keeperSchema}
      ${migrationSource()}
      ${validQualification}
      SELECT keeper_piece_id, scope, result, copied_artifacts,
             schema_version, build_version, key_version, generator_version,
             verifier_version, backup_reference, backup_sha256,
             administrator_user_id, administrator_email, safe_failure_code,
             qualified_at
        FROM registry_recovery_qualifications;
    `);

    assert.deepEqual(rows, [{
      keeper_piece_id: 'kp-qualification',
      scope: 'piece',
      result: 'passed',
      copied_artifacts: 1,
      schema_version: '020',
      build_version: 'build-2026-07-31',
      key_version: 7,
      generator_version: 'plate-generator-v3',
      verifier_version: 'copied-package-v2',
      backup_reference: 'plates/AR-7KQ9M2WX/abc.json',
      backup_sha256: 'a'.repeat(64),
      administrator_user_id: 'admin-1',
      administrator_email: 'artist@example.com',
      safe_failure_code: null,
      qualified_at: '2026-07-31T01:02:03.000Z',
    }]);
  });

  it('has no column capable of directly storing a plaintext Ownership Code', () => {
    const columns = sqliteJson(`
      ${keeperSchema}
      ${migrationSource()}
      SELECT name FROM pragma_table_info('registry_recovery_qualifications')
       ORDER BY cid;
    `).map((row: { name: string }) => row.name);

    assert.equal(
      columns.some((name: string) =>
        /ownership|recovery_code|ciphertext|nonce|secret|plaintext/i.test(name)),
      false,
    );
  });

  it('is append-only', () => {
    for (const mutation of [
      "UPDATE registry_recovery_qualifications SET result = 'failed' WHERE id = 'rq-1';",
      "DELETE FROM registry_recovery_qualifications WHERE id = 'rq-1';",
    ]) {
      const result = sqliteResult(`
        ${keeperSchema}
        ${migrationSource()}
        ${validQualification}
        ${mutation}
      `);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /append-only/i);
    }
  });

  it('provides piece/time and scope/time lookup indexes', () => {
    const indexes = sqliteJson(`
      ${keeperSchema}
      ${migrationSource()}
      SELECT name FROM sqlite_master
       WHERE type = 'index' AND tbl_name = 'registry_recovery_qualifications'
       ORDER BY name;
    `).map((row: { name: string }) => row.name);

    assert.ok(indexes.includes('idx_registry_recovery_qualification_piece_time'));
    assert.ok(indexes.includes('idx_registry_recovery_qualification_scope_time'));
  });

  it('rejects invalid enums, booleans, versions, hashes, administrator identity, and timestamps', () => {
    const invalidValues = [
      "'rq-bad-scope', 'kp-qualification', 'account', 'passed', 1, '020', 'build', 7, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-bad-result', 'kp-qualification', 'piece', 'ok', 1, '020', 'build', 7, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-bad-copy', 'kp-qualification', 'piece', 'passed', 2, '020', 'build', 7, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-bad-key', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', 0, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-no-key', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', NULL, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-no-generator', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', 7, NULL, 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-bad-hash', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', 7, 'gen', 'verify', 'plates/a', 'NOT-A-SHA', 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-no-admin', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', 7, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', '', 'a@b.co', NULL, '2026-07-31T00:00:00Z'",
      "'rq-no-email', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', 7, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', '', NULL, '2026-07-31T00:00:00Z'",
      "'rq-bad-time', 'kp-qualification', 'piece', 'passed', 1, '020', 'build', 7, 'gen', 'verify', 'plates/a', '" + 'a'.repeat(64) + "', 'admin', 'a@b.co', NULL, 'not-an-iso-timestamp!!'",
    ];

    for (const values of invalidValues) {
      const result = sqliteResult(`
        ${keeperSchema}
        ${migrationSource()}
        INSERT INTO registry_recovery_qualifications (
          id, keeper_piece_id, scope, result, copied_artifacts,
          schema_version, build_version, key_version, generator_version,
          verifier_version, backup_reference, backup_sha256,
          administrator_user_id, administrator_email, safe_failure_code,
          qualified_at
        ) VALUES (${values});
      `);
      assert.notEqual(result.status, 0, values);
    }
  });

  it('requires copied-artifact proof as a complete reference/digest pair', () => {
    for (const proof of [
      "1, NULL, '" + 'a'.repeat(64) + "'",
      "1, 'plates/a', NULL",
    ]) {
      const result = sqliteResult(`
        ${keeperSchema}
        ${migrationSource()}
        INSERT INTO registry_recovery_qualifications (
          id, keeper_piece_id, scope, result, copied_artifacts,
          schema_version, build_version, key_version, generator_version,
          verifier_version, backup_reference, backup_sha256,
          administrator_user_id, administrator_email, safe_failure_code,
          qualified_at
        ) SELECT 'rq-proof', 'kp-qualification', 'piece', 'passed', copied,
                 '020', 'build', 7, 'gen', 'verify', reference, digest,
                 'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'
            FROM (SELECT ${proof.split(', ')[0]} AS copied,
                         ${proof.split(', ')[1]} AS reference,
                         ${proof.split(', ').slice(2).join(', ')} AS digest);
      `);
      assert.notEqual(result.status, 0, proof);
    }
  });

  it('can retain the exact reference and digest for a live-only diagnostic without qualifying it', () => {
    const rows = sqliteJson(`
      ${keeperSchema}
      ${migrationSource()}
      INSERT INTO registry_recovery_qualifications (
        id, keeper_piece_id, scope, result, copied_artifacts,
        schema_version, build_version, key_version, generator_version,
        verifier_version, backup_reference, backup_sha256,
        administrator_user_id, administrator_email, safe_failure_code,
        qualified_at
      ) VALUES (
        'rq-live-only', 'kp-qualification', 'piece', 'passed', 0,
        '020', 'build', 7, 'gen', 'verify', 'plates/live.json', '${'b'.repeat(64)}',
        'admin', 'a@b.co', NULL, '2026-07-31T00:00:00Z'
      );
      SELECT copied_artifacts, backup_reference, backup_sha256
        FROM registry_recovery_qualifications;
    `);
    assert.deepEqual(rows, [{
      copied_artifacts: 0,
      backup_reference: 'plates/live.json',
      backup_sha256: 'b'.repeat(64),
    }]);
  });

  it('requires safe machine-readable failure codes only for failed results', () => {
    const invalidFailureCodes = [
      "'rq-failed-no-code', 'failed', NULL",
      "'rq-failed-secret', 'failed', 'J4KM-7NQP-X2RD-9VTC'",
      "'rq-passed-code', 'passed', 'unexpected_error'",
    ];

    for (const values of invalidFailureCodes) {
      const [id, result, code] = values.split(', ');
      const attempt = sqliteResult(`
        ${keeperSchema}
        ${migrationSource()}
        INSERT INTO registry_recovery_qualifications (
          id, keeper_piece_id, scope, result, copied_artifacts,
          schema_version, build_version, key_version, generator_version,
          verifier_version, backup_reference, backup_sha256,
          administrator_user_id, administrator_email, safe_failure_code,
          qualified_at
        ) VALUES (${id}, 'kp-qualification', 'piece', ${result}, 0,
                  '020', 'build', 7, 'gen', 'verify', NULL, NULL,
                  'admin', 'a@b.co', ${code}, '2026-07-31T00:00:00Z');
      `);
      assert.notEqual(attempt.status, 0, values);
    }
  });
});

const dependencies: RecoveryDependencies = {
  schemaVersion: '020',
  buildVersion: 'git-b88aa29',
  keyVersion: 7,
  generatorVersion: 'plate-generator-v3',
  verifierVersion: 'copied-package-v2',
  backupReference: 'plates/AR-7KQ9M2WX/abc.json',
  backupSha256: 'a'.repeat(64),
};

const currentQualification: StoredQualification = {
  result: 'passed',
  copiedArtifacts: 1,
  ...dependencies,
};

describe('recovery qualification currentness', () => {
  it('reports a missing qualification', () => {
    assert.deepEqual(qualificationIsCurrent(null, dependencies), {
      current: false,
      reasons: ['qualification_missing'],
    });
  });

  it('requires both a passed result and copied artifacts', () => {
    assert.deepEqual(
      qualificationIsCurrent(
        { ...currentQualification, result: 'failed', copiedArtifacts: 0 },
        dependencies,
      ),
      {
        current: false,
        reasons: ['qualification_failed', 'copied_artifacts_required'],
      },
    );
  });

  it('accepts only an exact passed copied-artifact qualification', () => {
    assert.deepEqual(qualificationIsCurrent(currentQualification, dependencies), {
      current: true,
      reasons: [],
    });
  });

  it('reports every dependency that has become stale in deterministic order', () => {
    const stale: StoredQualification = {
      result: 'passed',
      copiedArtifacts: true,
      schemaVersion: '019',
      buildVersion: 'old-build',
      keyVersion: 6,
      generatorVersion: 'plate-generator-v2',
      verifierVersion: 'copied-package-v1',
      backupReference: 'plates/AR-7KQ9M2WX/old.json',
      backupSha256: 'b'.repeat(64),
    };

    assert.deepEqual(qualificationIsCurrent(stale, dependencies), {
      current: false,
      reasons: [
        'schema_version_changed',
        'build_version_changed',
        'key_version_changed',
        'generator_version_changed',
        'verifier_version_changed',
        'backup_reference_changed',
        'backup_sha256_changed',
      ],
    });
  });

  it('does not treat null stored dependency values as current', () => {
    assert.deepEqual(
      qualificationIsCurrent({
        ...currentQualification,
        keyVersion: null,
        generatorVersion: null,
        backupReference: null,
        backupSha256: null,
      }, dependencies),
      {
        current: false,
        reasons: [
          'key_version_changed',
          'generator_version_changed',
          'backup_reference_changed',
          'backup_sha256_changed',
        ],
      },
    );
  });
});

describe('registered identity recovery qualification', () => {
  it('uses identity backup proof independently from physical plate proof', () => {
    const row = {
      registration_status: 'registered',
      ownership_code_key_version: 7,
      identity_backup_reference: `identities/AR-7KQ9M2WX/${'a'.repeat(64)}.json`,
      identity_backup_sha256: 'a'.repeat(64),
      backup_reference: `plates/AR-7KQ9M2WX/${'b'.repeat(64)}.json`,
      backup_sha256: 'b'.repeat(64),
    };
    const env = { REGISTRY_BUILD_VERSION: 'build-registration' };

    assert.equal(typeof recoveryQualification.identityRecoveryDependenciesForRow, 'function');
    const identity = recoveryQualification.identityRecoveryDependenciesForRow(row, env);
    const physical = recoveryQualification.recoveryDependenciesForRow({
      ...row,
      plate_status: 'generated',
    }, env);

    assert.equal(identity.backupReference, row.identity_backup_reference);
    assert.equal(identity.backupSha256, row.identity_backup_sha256);
    assert.equal(physical.backupReference, row.backup_reference);
    assert.equal(physical.backupSha256, row.backup_sha256);
    assert.notEqual(identity.verifierVersion, physical.verifierVersion);
  });

  it('records identity qualification in its append-only identity table', () => {
    let sql = '';
    let values: unknown[] = [];
    const db = {
      prepare(source: string) {
        sql = source;
        return {
          bind(...bound: unknown[]) { values = bound; return this; },
        };
      },
    };
    const dependencies = {
      schemaVersion: '1',
      buildVersion: 'build-registration',
      keyVersion: 7,
      verifierVersion: 'copied-identity-v1',
      backupReference: `identities/AR-7KQ9M2WX/${'a'.repeat(64)}.json`,
      backupSha256: 'a'.repeat(64),
    };

    assert.equal(typeof recoveryQualification.identityRecoveryQualificationStatement, 'function');
    recoveryQualification.identityRecoveryQualificationStatement(db, {
      keeperPieceId: 'kp-registered',
      result: 'passed',
      copiedArtifact: true,
      dependencies,
      administrator: { userId: 'admin-1', email: 'artist@example.com' },
      qualifiedAt: '2026-08-09T12:00:00.000Z',
      id: 'irq-1',
    });

    assert.match(sql, /INSERT INTO artwork_identity_recovery_qualifications/);
    assert.deepEqual(values, [
      'irq-1', 'kp-registered', 'passed', 1, '1', 'build-registration', 7,
      'copied-identity-v1', dependencies.backupReference, dependencies.backupSha256,
      'admin-1', 'artist@example.com', null, '2026-08-09T12:00:00.000Z',
    ]);
  });

  it('does not accept physical qualification as current identity qualification', () => {
    const dependencies = {
      schemaVersion: '1',
      buildVersion: 'build-registration',
      keyVersion: 7,
      verifierVersion: 'copied-identity-v1',
      backupReference: `identities/AR-7KQ9M2WX/${'a'.repeat(64)}.json`,
      backupSha256: 'a'.repeat(64),
    };
    const physicalQualification = {
      result: 'passed',
      copiedArtifact: 1,
      schemaVersion: '1',
      buildVersion: 'build-registration',
      keyVersion: 7,
      verifierVersion: 'copied-plate-v1',
      backupReference: `plates/AR-7KQ9M2WX/${'b'.repeat(64)}.json`,
      backupSha256: 'b'.repeat(64),
      qualifiedAt: '2026-08-09T12:00:00.000Z',
    };

    assert.equal(typeof recoveryQualification.identityRecoveryQualificationStatus, 'function');
    assert.deepEqual(recoveryQualification.identityRecoveryQualificationStatus(
      physicalQualification,
      dependencies,
    ), {
      status: 'stale',
      reasons: [
        'verifier_version_changed', 'backup_reference_changed', 'backup_sha256_changed',
      ],
      qualifiedAt: '2026-08-09T12:00:00.000Z',
    });
  });
});
