import { buildArtworkPlatePackage } from '../../../../../utils/artworkPlate.ts';
import { decryptOwnershipCode } from '../../../../../utils/ownershipCodeCrypto.ts';
import {
  constantTimeEqual,
  jsonResponse,
  requireAdminPostStepUp,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import { hashRecoveryCode } from '../../../_lib/keeper.js';

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function parseBackupDocument(text, row) {
  const document = JSON.parse(text);
  if (
    !hasExactKeys(document, [
      'schemaVersion', 'publicCode', 'pieceId', 'editionNumber',
      'plateGeneratedAt', 'envelope',
    ])
    || document.schemaVersion !== 1
    || document.publicCode !== row.public_code
    || document.pieceId !== row.piece_id
    || document.editionNumber !== row.edition_number
    || document.plateGeneratedAt !== row.plate_generated_at
    || !hasExactKeys(document.envelope, ['ciphertext', 'nonce', 'keyVersion'])
    || typeof document.envelope.ciphertext !== 'string'
    || !document.envelope.ciphertext
    || typeof document.envelope.nonce !== 'string'
    || !document.envelope.nonce
    || document.envelope.keyVersion !== String(row.ownership_code_key_version)
  ) {
    throw new Error('backup identity mismatch');
  }
  return document;
}

export async function onRequest({ request, env, params }) {
  const authorization = await requireAdminPostStepUp(request, env);
  if (authorization.response) return authorization.response;
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
              backup_status, backup_reference
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
  const expectedReference = `plates/${row.public_code}.json`;
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

  let backup;
  try {
    backup = parseBackupDocument(await stored.text(), row);
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
    keyVersion: String(row.ownership_code_key_version),
    frontSha256: row.front_svg_sha256,
    undersideSha256: row.back_svg_sha256,
  });
}
