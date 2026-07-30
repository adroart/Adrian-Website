import { jsonResponse, requireAdmin, requireDb, requireRegistryUnlock } from '../_lib/admin.js';
import {
  registryAdminEnabled,
  notFound,
  migrationNotApplied,
  isMissingTableError,
} from '../_lib/keeper.js';
import { issueRegistryPlate } from '../_lib/registryPlateIssuance.js';
import {
  recoveryDependenciesForRow,
  recoveryQualificationStatus,
  storedQualificationFromRow,
} from '../_lib/recoveryQualification.js';
import { plateBackupIsVerified } from '../_lib/plateBackup.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'POST') {
    const authorization = await requireRegistryUnlock(request, env);
    if (authorization instanceof Response) return authorization;
  } else {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;
  }
  if (!registryAdminEnabled(env)) return notFound();
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listPieces(env);
  if (request.method === 'POST') return issueRegistryPlate(request, env);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

function serialize(row, qualification, env) {
  const backupStatus = row.backup_status === 'verified' && !plateBackupIsVerified(row)
    ? 'pending'
    : row.backup_status || null;
  return {
    id: row.id,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    publicCode: row.public_code || null,
    plateStatus: row.plate_status || 'legacy',
    backupStatus,
    backupReference: row.backup_reference || null,
    backupSha256: row.backup_sha256 || null,
    frontSha256: row.front_svg_sha256 || null,
    undersideSha256: row.back_svg_sha256 || null,
    plateGeneratedAt: row.plate_generated_at || null,
    plateActivatedAt: row.plate_activated_at || null,
    backupAt: row.backup_at || null,
    keeperBound: Boolean(row.keeper_user_id) && !row.released_at,
    currentDisplayLocation: row.current_display_location || null,
    registeredAt: row.registered_at || null,
    claimedAt: row.claimed_at || null,
    releasedAt: row.released_at || null,
    recoveryQualification: recoveryQualificationStatus(
      qualification,
      recoveryDependenciesForRow(row, env),
    ),
  };
}

async function listPieces(env) {
  try {
    const [{ results }, { results: qualificationRows }] = await Promise.all([
      env.DB.prepare(
        `SELECT id, piece_id, edition_number, public_code, plate_status,
                backup_status, backup_reference, backup_sha256,
                ownership_code_key_version, front_svg_sha256, back_svg_sha256,
                plate_generated_at, plate_activated_at, backup_at, keeper_user_id,
                current_display_location, registered_at, claimed_at, released_at
           FROM keeper_pieces
          ORDER BY COALESCE(plate_generated_at, registered_at, claimed_at) DESC`,
      ).all(),
      env.DB.prepare(
        `SELECT id, keeper_piece_id, result, copied_artifacts, schema_version,
                build_version, key_version, generator_version, verifier_version,
                backup_reference, backup_sha256, qualified_at
           FROM registry_recovery_qualifications
          WHERE scope = 'piece' AND result = 'passed' AND copied_artifacts = 1
          ORDER BY qualified_at DESC, id DESC`,
      ).all(),
    ]);
    const latestByPiece = new Map();
    for (const row of qualificationRows || []) {
      if (!latestByPiece.has(row.keeper_piece_id)) {
        latestByPiece.set(row.keeper_piece_id, storedQualificationFromRow(row));
      }
    }
    return jsonResponse({
      ok: true,
      pieces: (results || []).map((row) => serialize(
        row,
        latestByPiece.get(row.id) || null,
        env,
      )),
    });
  } catch (error) {
    if (isSchemaMissing(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'list_failed' }, 500);
  }
}

function isSchemaMissing(error) {
  return isMissingTableError(error) || /no such column/i.test(String(error?.message || ''));
}
