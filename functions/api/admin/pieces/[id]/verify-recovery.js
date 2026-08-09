import { buildArtworkPlatePackage } from '../../../../../utils/artworkPlate.ts';
import { decryptOwnershipCode } from '../../../../../utils/ownershipCodeCrypto.ts';
import {
  constantTimeEqual,
  jsonResponse,
  ownershipAuditStatement,
  requireRegistryUnlock,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import { hashRecoveryCode } from '../../../_lib/keeper.js';
import {
  backupDocumentSha256,
  parseBackupDocument,
} from '../../../_lib/plateBackup.js';
import {
  identityBackupSha256,
  parseIdentityBackupDocument,
} from '../../../_lib/identityBackup.js';
import {
  identityRecoveryDependenciesForRow,
  identityRecoveryQualificationStatement,
  recoveryDependenciesForRow,
  recoveryQualificationStatement,
} from '../../../_lib/recoveryQualification.js';

const MAX_BACKUP_DOCUMENT_BYTES = 64 * 1024;

function exactBackupRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return (keys.length === 1 && keys[0] === 'backupDocument'
      || keys.length === 2
        && keys.includes('backupDocument')
        && keys.includes('qualificationKind')
        && ['identity', 'plate'].includes(body.qualificationKind))
    && typeof body.backupDocument === 'string'
    && body.backupDocument.length > 0;
}

async function recordFailure(
  env,
  row,
  administrator,
  dependencies,
  safeFailureCode,
  status,
  identityOnly = false,
) {
  try {
    const statement = identityOnly
      ? identityRecoveryQualificationStatement(env.DB, {
        keeperPieceId: row.id,
        result: 'failed',
        copiedArtifact: true,
        dependencies,
        administrator,
        safeFailureCode,
      })
      : recoveryQualificationStatement(env.DB, {
      keeperPieceId: row.id,
      result: 'failed',
      copiedArtifacts: true,
      dependencies,
      administrator,
      safeFailureCode,
      });
    await statement.run();
  } catch {
    return jsonResponse({ ok: false, error: 'qualification_record_failed' }, 503);
  }
  return jsonResponse({ ok: false, error: safeFailureCode }, status);
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT id, piece_id, edition_number, public_code, plate_status,
              registration_status, registered_at,
              plate_generated_at, front_svg_sha256, back_svg_sha256,
              ownership_code_key_version, recovery_code_hash,
              backup_status, backup_reference, backup_sha256,
              identity_backup_status, identity_backup_reference,
              identity_backup_sha256
         FROM keeper_pieces WHERE id = ?1`,
    ).bind(params.id).first();
  } catch {
    return jsonResponse({ ok: false, error: 'registry_unavailable' }, 503);
  }
  const identityAvailable = row?.registration_status === 'registered';
  const plateAvailable = ['generated', 'active'].includes(row?.plate_status);
  if (!row || (!identityAvailable && !plateAvailable)) {
    return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_copied_artifact' }, 400);
  }
  if (!exactBackupRequest(body)) {
    return jsonResponse({ ok: false, error: 'invalid_copied_artifact' }, 400);
  }
  const qualificationKind = body.qualificationKind
    || (identityAvailable && !plateAvailable ? 'identity' : 'plate');
  const identityOnly = qualificationKind === 'identity';
  if (identityOnly && !identityAvailable) {
    return jsonResponse({ ok: false, error: 'identity_not_registered' }, 409);
  }
  if (!identityOnly && !plateAvailable) {
    return jsonResponse({ ok: false, error: 'plate_not_available' }, 409);
  }
  const backupStatus = identityOnly ? row.identity_backup_status : row.backup_status;
  const backupReference = identityOnly ? row.identity_backup_reference : row.backup_reference;
  const backupSha256 = identityOnly ? row.identity_backup_sha256 : row.backup_sha256;
  if (backupStatus !== 'verified') {
    return jsonResponse({ ok: false, error: 'backup_not_verified' }, 409);
  }
  if (typeof backupSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(backupSha256)) {
    return jsonResponse({ ok: false, error: 'backup_digest_missing' }, 409);
  }
  const prefix = identityOnly ? 'identities' : 'plates';
  const expectedReference = `${prefix}/${row.public_code}/${backupSha256}.json`;
  if (backupReference !== expectedReference) {
    return jsonResponse({ ok: false, error: 'backup_reference_mismatch' }, 409);
  }
  const dependencies = identityOnly
    ? identityRecoveryDependenciesForRow(row, env)
    : recoveryDependenciesForRow(row, env);

  const backupBytes = new TextEncoder().encode(body.backupDocument);
  if (backupBytes.byteLength > MAX_BACKUP_DOCUMENT_BYTES) {
    return recordFailure(
      env, row, authorization, dependencies, 'copied_artifact_too_large', 413, identityOnly,
    );
  }

  try {
    await writeOwnershipAudit(env, {
      keeperPieceId: row.id,
      action: identityOnly ? 'verify_copied_identity_recovery' : 'verify_copied_recovery',
      outcome: 'authorized',
    });
  } catch {
    return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
  }

  let backup;
  try {
    const actualSha256 = identityOnly
      ? await identityBackupSha256(backupBytes)
      : await backupDocumentSha256(backupBytes);
    if (!constantTimeEqual(actualSha256, backupSha256)) {
      return recordFailure(
        env, row, authorization, dependencies, 'backup_digest_mismatch', 409, identityOnly,
      );
    }
    backup = identityOnly
      ? parseIdentityBackupDocument(backupBytes)
      : parseBackupDocument(backupBytes);
    const backupPieceId = identityOnly ? backup.artworkId : backup.pieceId;
    const backupEditionNumber = identityOnly
      ? backup.edition.kind === 'unique' ? 0 : backup.edition.number
      : backup.editionNumber;
    if (backup.publicCode !== row.public_code
      || backupPieceId !== row.piece_id
      || backupEditionNumber !== row.edition_number
      || (identityOnly
        ? backup.registeredAt !== row.registered_at
          || backup.ownershipCodeVerifier !== row.recovery_code_hash
        : backup.plateGeneratedAt !== row.plate_generated_at)
      || backup.envelope.keyVersion !== String(row.ownership_code_key_version)) {
      return recordFailure(
        env, row, authorization, dependencies, 'backup_identity_mismatch', 409, identityOnly,
      );
    }
  } catch {
    return recordFailure(
      env, row, authorization, dependencies, 'backup_integrity_error', 409, identityOnly,
    );
  }

  const identity = {
    publicCode: backup.publicCode,
    pieceId: identityOnly ? backup.artworkId : backup.pieceId,
    editionNumber: identityOnly
      ? backup.edition.kind === 'unique' ? 0 : backup.edition.number
      : backup.editionNumber,
  };
  let ownershipCode;
  try {
    ownershipCode = await decryptOwnershipCode(backup.envelope, identity, env);
  } catch {
    return recordFailure(
      env, row, authorization, dependencies, 'backup_decryption_failed', 503, identityOnly,
    );
  }

  const verifier = await hashRecoveryCode(ownershipCode);
  if (!constantTimeEqual(verifier, row.recovery_code_hash)) {
    return recordFailure(
      env, row, authorization, dependencies,
      'ownership_code_verifier_mismatch', 409, identityOnly,
    );
  }

  if (identityOnly) {
    if (typeof env.DB.batch !== 'function') {
      return jsonResponse({ ok: false, error: 'atomic_write_unavailable' }, 503);
    }
    const qualifiedAt = new Date().toISOString();
    try {
      await env.DB.batch([
        identityRecoveryQualificationStatement(env.DB, {
          keeperPieceId: row.id,
          result: 'passed',
          copiedArtifact: true,
          dependencies,
          administrator: authorization,
          qualifiedAt,
        }),
        ownershipAuditStatement(env, {
          keeperPieceId: row.id,
          action: 'verify_copied_identity_recovery',
          outcome: 'qualified',
          createdAt: qualifiedAt,
        }),
      ]);
    } catch {
      return jsonResponse({ ok: false, error: 'qualification_record_failed' }, 503);
    }
    return jsonResponse({
      ok: true,
      recoveryStatus: 'passed',
      qualificationStatus: 'current',
      qualifiedAt,
      publicCode: row.public_code,
      pieceId: row.piece_id,
      editionNumber: row.edition_number,
      identityBackupReference: row.identity_backup_reference,
      identityBackupSha256: row.identity_backup_sha256,
      keyVersion: String(row.ownership_code_key_version),
    });
  }

  const plate = await buildArtworkPlatePackage({
    publicCode: backup.publicCode,
    ownershipCode,
    artworkId: backup.pieceId,
    editionNumber: backup.editionNumber,
    generatedAt: backup.plateGeneratedAt,
  });
  if (
    !constantTimeEqual(plate.frontSha256, row.front_svg_sha256)
    || !constantTimeEqual(plate.undersideSha256, row.back_svg_sha256)
  ) {
    return recordFailure(
      env, row, authorization, dependencies, 'fabrication_hash_mismatch', 409, false,
    );
  }

  if (typeof env.DB.batch !== 'function') {
    return jsonResponse({ ok: false, error: 'atomic_write_unavailable' }, 503);
  }
  const qualifiedAt = new Date().toISOString();
  try {
    await env.DB.batch([
      recoveryQualificationStatement(env.DB, {
        keeperPieceId: row.id,
        result: 'passed',
        copiedArtifacts: true,
        dependencies,
        administrator: authorization,
        qualifiedAt,
      }),
      ownershipAuditStatement(env, {
        keeperPieceId: row.id,
        action: 'verify_copied_recovery',
        outcome: 'qualified',
        createdAt: qualifiedAt,
      }),
    ]);
  } catch {
    return jsonResponse({ ok: false, error: 'qualification_record_failed' }, 503);
  }

  return jsonResponse({
    ok: true,
    recoveryStatus: 'passed',
    qualificationStatus: 'current',
    qualifiedAt,
    publicCode: row.public_code,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    backupReference: row.backup_reference,
    backupSha256: row.backup_sha256,
    keyVersion: String(row.ownership_code_key_version),
    frontSha256: row.front_svg_sha256,
    undersideSha256: row.back_svg_sha256,
  });
}
