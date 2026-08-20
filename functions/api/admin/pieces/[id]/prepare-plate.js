/**
 * POST /api/admin/pieces/:id/prepare-plate
 *
 * Generates the OPTIONAL physical fabrication plate for an artwork identity
 * that is already registered (registration_status = 'registered') but has
 * never had a plate built (plate_status = 'legacy'). This is the missing
 * first step of the fabricate stage: registerArtworkWithRecord always mints
 * an identity with plate_status 'legacy', and until this endpoint existed
 * there was no way to move that identity to 'generated' — the fabricate
 * stage's "Recover fabrication package" (functions/api/admin/pieces/[id]/package.js)
 * only ever recovers a plate that already exists, so it 404s (plate_not_found)
 * for a legacy-plate identity.
 *
 * All the actual generation, hashing, encrypted-envelope backup, lineage
 * bookkeeping, and the atomic conditional-UPDATE guard against a stale row
 * live in prepareOptionalPlate (functions/api/_lib/registryPlateIssuance.js).
 * This handler only supplies guards mirroring its siblings (backup.js,
 * activate.js, package.js, reveal.js) and the session-derived administrator
 * identity — no client-supplied identity or edition fields are ever trusted;
 * prepareOptionalPlate reads the artwork id, edition number, and every other
 * plate input from the stored row itself.
 */
import {
  jsonResponse,
  requireRegistryUnlock,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import { prepareOptionalPlate } from '../../../_lib/registryPlateIssuance.js';

// prepareOptionalPlate's own error surface, renamed where this endpoint's
// eligibility contract calls for a clearer public code. Anything not listed
// here reaches the caller as a flat 500 plate_preparation_failed.
const ERROR_STATUS = {
  keeper_piece_not_found: 404,
  artwork_not_registered: 409,
  plate_identity_locked: 409,
  identity_backup_not_verified: 409,
  plate_preparation_conflict: 409,
  idempotency_conflict: 409,
  plate_backup_failed: 503,
  ownership_code_crypto_not_configured: 503,
  atomic_write_unavailable: 503,
  registry_migration_required: 503,
};

const ERROR_CODE = {
  keeper_piece_not_found: 'piece_not_found',
  artwork_not_registered: 'piece_not_eligible',
  plate_identity_locked: 'plate_already_generated',
  idempotency_conflict: 'plate_preparation_conflict',
};

function mapPrepareError(code) {
  const status = ERROR_STATUS[code] || 500;
  const error = ERROR_CODE[code] || code || 'plate_preparation_failed';
  return jsonResponse({ ok: false, error }, status);
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const keeperPieceId = typeof params?.id === 'string' ? params.id : '';

  try {
    const row = await env.DB.prepare(
      'SELECT id, registration_status, plate_status FROM keeper_pieces WHERE id = ?1',
    ).bind(keeperPieceId).first();
    if (!row) return jsonResponse({ ok: false, error: 'piece_not_found' }, 404);
    if (row.registration_status !== 'registered') {
      return jsonResponse({ ok: false, error: 'piece_not_eligible' }, 409);
    }
    if (row.plate_status !== 'legacy') {
      return jsonResponse({ ok: false, error: 'plate_already_generated' }, 409);
    }

    try {
      await writeOwnershipAudit(env, {
        keeperPieceId: row.id,
        action: 'prepare_plate',
        outcome: 'authorized',
      });
    } catch {
      return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
    }

    const result = await prepareOptionalPlate(env, {
      keeperPieceId: row.id,
      // Every request mints and consumes its own idempotency key: the
      // conditional UPDATE inside prepareOptionalPlate (WHERE plate_status =
      // 'legacy' ...) is what makes a concurrent or repeated click safe, not
      // idempotency-key replay. A genuine double-click simply lands on the
      // plate_already_generated guard above or, in the race window, on
      // prepareOptionalPlate's own plate_identity_locked outcome.
      idempotencyKey: crypto.randomUUID(),
      authorization: {
        userId: authorization.userId,
        email: authorization.email,
        registryUnlockExpiresAt: authorization.registryUnlockExpiresAt,
      },
    });
    if (!result.ok) return mapPrepareError(result.error);

    return jsonResponse({
      ok: true,
      plateStatus: 'generated',
      plateGeneratedAt: result.generatedAt,
      backupStatus: result.backupStatus,
      ownershipCode: result.ownershipCode,
      publicCode: result.publicCode,
      publicUrl: result.publicUrl,
      frontSvg: result.frontSvg,
      undersideSvg: result.undersideSvg,
      frontSha256: result.frontSha256,
      undersideSha256: result.undersideSha256,
      manifest: result.manifest,
    }, 201);
  } catch {
    return jsonResponse({ ok: false, error: 'plate_preparation_failed' }, 500);
  }
}
