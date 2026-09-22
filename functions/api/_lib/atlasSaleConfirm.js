/** Resolve one pending sale against the canonical artwork registry. */
import { isMissingTableError } from './keeper.js';

const MAX_EDITION_NUMBER = 9999;

function confirmError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeEditionNumber(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_EDITION_NUMBER) {
    throw confirmError('invalid_edition_number');
  }
  return value;
}

async function findCanonicalIdentity(env, pieceId, editionNumber) {
  return env.DB.prepare(
    `SELECT id, public_code, plate_status
       FROM keeper_pieces
      WHERE piece_id = ?1 AND edition_number = ?2
        AND registration_status = 'registered'
        AND identity_backup_status = 'verified'
        AND public_code IS NOT NULL
        AND issuance_key IS NOT NULL
        AND plate_status NOT IN ('void', 'superseded')
      LIMIT 1`,
  ).bind(pieceId, editionNumber).first();
}

async function confirmationResult(env, saleId, pieceId, editionNumber, replayed) {
  const identity = await findCanonicalIdentity(env, pieceId, editionNumber);
  if (identity) {
    return {
      ok: true, saleId, pieceId, editionNumber,
      keeperPieceId: identity.id,
      registrationStatus: 'registered',
      publicCode: identity.public_code,
      plateStatus: identity.plate_status,
      replayed,
    };
  }
  return {
    ok: true, saleId, pieceId, editionNumber,
    keeperPieceId: null,
    registrationStatus: 'pending',
    reason: 'canonical_registration_required',
    replayed,
  };
}

/**
 * A sale proves commerce, not that a physical identity completed the
 * registration ceremony. This operation never inserts or repairs a
 * keeper_pieces row. It reuses a complete canonical identity or reports an
 * honest pending-registration result.
 */
export async function confirmPendingAtlasSale(env, input) {
  if (!env?.DB) throw confirmError('db_not_configured');
  const saleId = typeof input?.saleId === 'string' ? input.saleId.trim() : '';
  if (!saleId) throw confirmError('missing_sale_id');
  const pieceId = typeof input?.pieceId === 'string' ? input.pieceId.trim() : '';
  if (!pieceId) throw confirmError('missing_piece_id');
  const editionNumber = normalizeEditionNumber(input?.editionNumber);

  let sale;
  try {
    sale = await env.DB.prepare(
      'SELECT sale_id, status, piece_id, edition_number FROM atlas_sale_events WHERE sale_id = ?1',
    ).bind(saleId).first();
  } catch (error) {
    if (isMissingTableError(error)) throw confirmError('migration_not_applied');
    throw error;
  }
  if (!sale) throw confirmError('sale_not_found');

  if (sale.status !== 'pending') {
    if (sale.status === 'confirmed' && sale.piece_id === pieceId
      && Number(sale.edition_number) === editionNumber) {
      return confirmationResult(env, saleId, pieceId, editionNumber, true);
    }
    throw confirmError('sale_already_resolved');
  }

  let update;
  try {
    update = await env.DB.prepare(
      `UPDATE atlas_sale_events
          SET status = 'confirmed', confirmed_at = unixepoch(),
              piece_id = ?2, edition_number = ?3
        WHERE sale_id = ?1 AND status = 'pending'`,
    ).bind(saleId, pieceId, editionNumber).run();
  } catch (error) {
    if (isMissingTableError(error)) throw confirmError('migration_not_applied');
    throw error;
  }

  if ((update?.meta?.changes ?? 0) === 0) {
    const resolved = await env.DB.prepare(
      'SELECT status, piece_id, edition_number FROM atlas_sale_events WHERE sale_id = ?1',
    ).bind(saleId).first();
    if (resolved?.status === 'confirmed' && resolved.piece_id === pieceId
      && Number(resolved.edition_number) === editionNumber) {
      return confirmationResult(env, saleId, pieceId, editionNumber, true);
    }
    throw confirmError('sale_already_resolved');
  }
  return confirmationResult(env, saleId, pieceId, editionNumber, false);
}
