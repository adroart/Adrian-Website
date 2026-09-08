/**
 * confirmPendingAtlasSale(env, { saleId, pieceId, editionNumber })
 *
 * The admin-only confirm action for the atlas_sale_events queue (migration
 * 005_atlas_legacy.sql). Ported from mandalacodes' retired
 * POST /api/atlas/sales/confirm (functions/api/atlas/sales/confirm.ts,
 * frozen behind the 410 boundary since 2026-08-09) — same two moves: turn
 * the pending row into a real steward record, then flip the row to
 * 'confirmed'.
 *
 * SCHEMA NOTE (a guess, flagged for Adrian): the retired handler bound a
 * steward against mandalacodes' OLD R2 ledger (stewards.json keyed by
 * pieceId+editionNumber, holding email/name pre-claim). That store is
 * historical evidence only now (docs/ledger-successor.md). The canonical
 * collector-binding table on THIS site is `keeper_pieces`
 * (migrations/008_living_legacy.sql onward), and its live claim path
 * (functions/api/_lib/keeperClaim.js prepareFirstKeeperBind) requires a
 * FULLY REGISTERED physical plate — a recovery code already printed and
 * handed to the collector, identity-backup verified, qualification checks
 * passed — before anyone can bind to it. A Stripe confirm can supply none
 * of that: there is no printed plate yet for a piece sold online.
 *
 * So this function does the smallest honest thing the schema allows: if no
 * keeper_pieces row exists yet for (pieceId, editionNumber), it registers
 * ONE — same shape as a fresh admin registration
 * (migrations/009_keeper_register.sql: "the row exists with a hash but NO
 * keeper yet"), with a freshly generated recovery code. It deliberately
 * leaves registration_status and public_code NULL (no physical plate, no
 * identity-backup ceremony), which keeperClaim.js's own readiness guard
 * already treats as directly claimable via `public_code IS NULL`. The
 * plaintext recovery code is returned ONCE in the confirm response, exactly
 * like the existing plate-registration flow shows a code once — Adrian
 * relays it to the buyer by hand. Binding the buyer's own Better Auth
 * identity is NOT attempted here: that is the claim flow's job, gated on
 * proof of the code, and doing it automatically from a Stripe email would
 * skip that proof. This is a scope line the task deliberately drew
 * ("confirm only") and a real place the shared schema forced a choice.
 *
 * If a keeper_pieces row already exists (Adrian registered the piece by
 * hand before or during fulfillment), it is left completely untouched —
 * only the sale row moves to 'confirmed', carrying the piece it was
 * confirmed against.
 */

import { genKeeperPieceId, hashRecoveryCode, isMissingTableError } from './keeper.js';
import { generateRecoveryCode } from '../../../utils/recoveryCode.ts';

const MAX_EDITION_NUMBER = 9999;

function confirmError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeEditionNumber(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_EDITION_NUMBER) {
    throw confirmError('invalid_edition_number');
  }
  return value;
}

/**
 * @param {object} env  Cloudflare env (needs DB)
 * @param {{ saleId: string, pieceId: string, editionNumber?: number }} input
 * @returns {Promise<{
 *   ok: true,
 *   keeperPieceId: string,
 *   created: boolean,
 *   recoveryCode?: string,
 * }>}
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
    sale = await env.DB
      .prepare('SELECT * FROM atlas_sale_events WHERE sale_id = ?1')
      .bind(saleId)
      .first();
  } catch (err) {
    if (isMissingTableError(err)) throw confirmError('migration_not_applied');
    throw err;
  }
  if (!sale) throw confirmError('sale_not_found');
  if (sale.status !== 'pending') throw confirmError('sale_already_resolved');

  let keeperPieceId;
  let created = false;
  let recoveryCode;

  const existing = await env.DB
    .prepare(
      'SELECT id FROM keeper_pieces WHERE piece_id = ?1 AND edition_number = ?2',
    )
    .bind(pieceId, editionNumber)
    .first();

  if (existing) {
    keeperPieceId = existing.id;
  } else {
    keeperPieceId = genKeeperPieceId();
    recoveryCode = generateRecoveryCode();
    const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
    const now = new Date().toISOString();
    try {
      await env.DB
        .prepare(
          `INSERT INTO keeper_pieces
             (id, piece_id, edition_number, recovery_code_hash, registered_at)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(keeperPieceId, pieceId, editionNumber, recoveryCodeHash, now)
        .run();
    } catch (err) {
      if (isMissingTableError(err)) throw confirmError('migration_not_applied');
      throw err;
    }
    created = true;
  }

  const result = await env.DB
    .prepare(
      `UPDATE atlas_sale_events
         SET status = 'confirmed', confirmed_at = unixepoch(),
             piece_id = ?2, edition_number = ?3
       WHERE sale_id = ?1 AND status = 'pending'`,
    )
    .bind(saleId, pieceId, editionNumber)
    .run();
  if ((result?.meta?.changes ?? 0) === 0) {
    // Someone else confirmed it between our read and write. The keeper_pieces
    // row above is harmless either way (idempotent by piece_id+edition
    // lookup on retry), but the sale itself did not move under us.
    throw confirmError('sale_already_resolved');
  }

  return { ok: true, keeperPieceId, created, ...(recoveryCode ? { recoveryCode } : {}) };
}
