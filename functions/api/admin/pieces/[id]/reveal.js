import { buildArtworkPlatePackage } from '../../../../../utils/artworkPlate.ts';
import { decryptOwnershipCode } from '../../../../../utils/ownershipCodeCrypto.ts';
import {
  jsonResponse,
  requireAdminPostStepUp,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';

function envelope(row) {
  return {
    ciphertext: row.ownership_code_ciphertext,
    nonce: row.ownership_code_nonce,
    keyVersion: String(row.ownership_code_key_version),
  };
}

function identity(row) {
  return {
    publicCode: row.public_code,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
  };
}

export async function onRequest({ request, env, params }) {
  const authorization = await requireAdminPostStepUp(request, env);
  if (authorization.response) return authorization.response;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    const row = await env.DB.prepare(
      'SELECT * FROM keeper_pieces WHERE id = ?1',
    ).bind(params.id).first();
    if (!row || !['generated', 'active'].includes(row.plate_status)) {
      return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
    }

    try {
      await writeOwnershipAudit(env, {
        keeperPieceId: row.id,
        action: 'reveal',
        outcome: 'authorized',
      });
    } catch {
      return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
    }

    const ownershipCode = await decryptOwnershipCode(envelope(row), identity(row), env);
    const plate = await buildArtworkPlatePackage({
      publicCode: row.public_code,
      ownershipCode,
      artworkId: row.piece_id,
      editionNumber: row.edition_number,
      generatedAt: row.plate_generated_at,
    });
    if (
      plate.frontSha256 !== row.front_svg_sha256 ||
      plate.undersideSha256 !== row.back_svg_sha256
    ) {
      return jsonResponse({ ok: false, error: 'fabrication_hash_mismatch' }, 409);
    }
    return jsonResponse({ ok: true, ownershipCode, undersideSvg: plate.undersideSvg });
  } catch {
    return jsonResponse({ ok: false, error: 'reveal_failed' }, 500);
  }
}
