import { buildArtworkPlatePackage } from '../../../../../utils/artworkPlate.ts';
import { decryptOwnershipCode } from '../../../../../utils/ownershipCodeCrypto.ts';
import {
  constantTimeEqual,
  jsonResponse,
  requireRegistryUnlock,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import { hashRecoveryCode } from '../../../_lib/keeper.js';
import {
  backupDocumentSha256,
  parseBackupDocument,
  readBackupObjectBytes,
} from '../../../_lib/plateBackup.js';

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'backup_not_configured' }, 503);
  }

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT id, piece_id, edition_number, public_code, plate_status,
              plate_generated_at, front_svg_sha256, back_svg_sha256,
              ownership_code_key_version, recovery_code_hash,
              backup_status, backup_reference, backup_sha256
         FROM keeper_pieces WHERE id = ?1`,
    ).bind(params.id).first();
  } catch {
    return jsonResponse({ ok: false, error: 'registry_unavailable' }, 503);
  }
  if (!row || !['generated', 'active'].includes(row.plate_status)) {
    return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
  }
  if (row.backup_status !== 'verified') {
    return jsonResponse({ ok: false, error: 'backup_not_verified' }, 409);
  }
  if (typeof row.backup_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.backup_sha256)) {
    return jsonResponse({ ok: false, error: 'backup_digest_missing' }, 409);
  }
  const expectedReference = `plates/${row.public_code}/${row.backup_sha256}.json`;
  if (row.backup_reference !== expectedReference) {
    return jsonResponse({ ok: false, error: 'backup_reference_mismatch' }, 409);
  }

  try {
    await writeOwnershipAudit(env, {
      keeperPieceId: row.id,
      action: 'verify_r2_recovery',
      outcome: 'authorized',
    });
  } catch {
    return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
  }

  let stored;
  try {
    stored = await env.ARTWORK_REGISTRY_BACKUP.get(expectedReference);
  } catch {
    return jsonResponse({ ok: false, error: 'backup_unavailable' }, 503);
  }
  if (!stored) return jsonResponse({ ok: false, error: 'backup_unavailable' }, 503);

  let backupBytes;
  let backup;
  try {
    backupBytes = await readBackupObjectBytes(stored);
    const actualSha256 = await backupDocumentSha256(backupBytes);
    if (!constantTimeEqual(actualSha256, row.backup_sha256)) {
      return jsonResponse({ ok: false, error: 'backup_digest_mismatch' }, 409);
    }
    backup = parseBackupDocument(backupBytes);
    if (
      backup.publicCode !== row.public_code
      || backup.pieceId !== row.piece_id
      || backup.editionNumber !== row.edition_number
      || backup.plateGeneratedAt !== row.plate_generated_at
      || backup.envelope.keyVersion !== String(row.ownership_code_key_version)
    ) {
      throw new Error('backup identity mismatch');
    }
  } catch {
    return jsonResponse({ ok: false, error: 'backup_integrity_error' }, 409);
  }

  const identity = {
    publicCode: backup.publicCode,
    pieceId: backup.pieceId,
    editionNumber: backup.editionNumber,
  };
  let ownershipCode;
  try {
    ownershipCode = await decryptOwnershipCode(backup.envelope, identity, env);
  } catch {
    return jsonResponse({ ok: false, error: 'backup_decryption_failed' }, 503);
  }

  const verifier = await hashRecoveryCode(ownershipCode);
  if (!constantTimeEqual(verifier, row.recovery_code_hash)) {
    return jsonResponse({ ok: false, error: 'ownership_code_verifier_mismatch' }, 409);
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
    return jsonResponse({ ok: false, error: 'fabrication_hash_mismatch' }, 409);
  }

  return jsonResponse({
    ok: true,
    recoveryStatus: 'passed',
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
