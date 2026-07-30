import { jsonResponse, requireAdmin, requireDb, requireRegistryUnlock } from '../_lib/admin.js';
import {
  registryAdminEnabled,
  notFound,
  migrationNotApplied,
  isMissingTableError,
} from '../_lib/keeper.js';
import { issueRegistryPlate } from '../_lib/registryPlateIssuance.js';

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

function serialize(row) {
  return {
    id: row.id,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    publicCode: row.public_code || null,
    plateStatus: row.plate_status || 'legacy',
    backupStatus: row.backup_status || null,
    backupReference: row.backup_reference || null,
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
  };
}

async function listPieces(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, piece_id, edition_number, public_code, plate_status,
              backup_status, backup_reference, front_svg_sha256, back_svg_sha256,
              plate_generated_at, plate_activated_at, backup_at, keeper_user_id,
              current_display_location, registered_at, claimed_at, released_at
         FROM keeper_pieces
        ORDER BY COALESCE(plate_generated_at, registered_at, claimed_at) DESC`,
    ).all();
    return jsonResponse({ ok: true, pieces: (results || []).map(serialize) });
  } catch (error) {
    if (isSchemaMissing(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'list_failed' }, 500);
  }
}

function isSchemaMissing(error) {
  return isMissingTableError(error) || /no such column/i.test(String(error?.message || ''));
}
