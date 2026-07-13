import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import { buildArtworkPlatePackage, generatePublicPlateCode } from '../../../utils/artworkPlate.ts';
import {
  decryptOwnershipCode,
  encryptOwnershipCode,
} from '../../../utils/ownershipCodeCrypto.ts';
import { generateRecoveryCode } from '../../../utils/recoveryCode.ts';
import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import {
  legacyEnabled,
  notFound,
  migrationNotApplied,
  isMissingTableError,
  hashRecoveryCode,
  genKeeperPieceId,
} from '../_lib/keeper.js';
import { backupPlateEnvelope } from '../_lib/plateBackup.js';

const MAX_EDITION_WITHOUT_BOUND = 9999;
const MAX_ISSUANCE_KEY_LENGTH = 128;
const PUBLIC_CODE_ATTEMPTS = 8;

export async function onRequest(context) {
  const { request, env } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!legacyEnabled()) return notFound();
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listPieces(env);
  if (request.method === 'POST') return issuePiece(request, env);
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

function validateInput(body) {
  const pieceId = typeof body?.pieceId === 'string' ? body.pieceId.trim().toUpperCase() : '';
  const artwork = FULL_ARCHIVE.find((piece) => piece.id === pieceId);
  if (!artwork) return { error: 'unknown_artwork' };

  const editionNumber = body?.editionNumber;
  const upperBound = Number.isInteger(artwork.editionSize)
    ? artwork.editionSize
    : MAX_EDITION_WITHOUT_BOUND;
  if (
    !Number.isSafeInteger(editionNumber) ||
    editionNumber < 0 ||
    editionNumber > upperBound
  ) {
    return { error: 'invalid_edition_number' };
  }

  const issuanceKey = typeof body?.issuanceKey === 'string' ? body.issuanceKey.trim() : '';
  if (!issuanceKey || issuanceKey.length > MAX_ISSUANCE_KEY_LENGTH) {
    return { error: 'issuance_key_required' };
  }
  return { pieceId, editionNumber, issuanceKey };
}

function envelopeFromRow(row) {
  return {
    ciphertext: row.ownership_code_ciphertext,
    nonce: row.ownership_code_nonce,
    keyVersion: String(row.ownership_code_key_version),
  };
}

function contextFromRow(row) {
  return {
    publicCode: row.public_code,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
  };
}

async function packageFromStoredRow(row, env) {
  const ownershipCode = await decryptOwnershipCode(
    envelopeFromRow(row),
    contextFromRow(row),
    env,
  );
  const plate = await buildArtworkPlatePackage({
    publicCode: row.public_code,
    ownershipCode,
    artworkId: row.piece_id,
    editionNumber: row.edition_number,
    generatedAt: row.plate_generated_at,
  });
  return { ok: true, ownershipCode, ...plate };
}

async function replayIssuedPackage(row, input, env) {
  if (row.piece_id !== input.pieceId || row.edition_number !== input.editionNumber) {
    return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
  }
  if (row.plate_status !== 'generated') {
    return jsonResponse({ ok: false, error: 'plate_identity_locked' }, 409);
  }
  return jsonResponse(await packageFromStoredRow(row, env), 200);
}

function cryptoConfigured(env) {
  const version = env.OWNERSHIP_CODE_ACTIVE_KEY_VERSION;
  return typeof version === 'string' && /^\d+$/.test(version) && Boolean(env[`OWNERSHIP_CODE_KEY_V${version}`]);
}

async function findByIssuanceKey(env, issuanceKey) {
  return env.DB.prepare(
    `SELECT * FROM keeper_pieces WHERE issuance_key = ?1`,
  ).bind(issuanceKey).first();
}

async function recordBackupResult(env, row, result) {
  const at = result.status === 'verified' ? new Date().toISOString() : null;
  await env.DB.prepare(
    `UPDATE keeper_pieces
        SET backup_status = ?1, backup_reference = ?2, backup_at = ?3
      WHERE id = ?4`,
  ).bind(result.status, result.reference, at, row.id).run();
}

async function issuePiece(request, env) {
  if (!cryptoConfigured(env)) {
    return jsonResponse({ ok: false, error: 'ownership_code_crypto_not_configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const input = validateInput(body);
  if (input.error) return jsonResponse({ ok: false, error: input.error }, 400);

  try {
    const replay = await findByIssuanceKey(env, input.issuanceKey);
    if (replay) return replayIssuedPackage(replay, input, env);

    const duplicate = await env.DB.prepare(
      `SELECT id FROM keeper_pieces WHERE piece_id = ?1 AND edition_number = ?2`,
    ).bind(input.pieceId, input.editionNumber).first();
    if (duplicate) return jsonResponse({ ok: false, error: 'artwork_edition_already_issued' }, 409);

    for (let attempt = 0; attempt < PUBLIC_CODE_ATTEMPTS; attempt += 1) {
      const id = genKeeperPieceId();
      const publicCode = generatePublicPlateCode();
      const ownershipCode = generateRecoveryCode();
      const generatedAt = new Date().toISOString();
      const context = { publicCode, pieceId: input.pieceId, editionNumber: input.editionNumber };
      const [verifier, envelope, plate] = await Promise.all([
        hashRecoveryCode(ownershipCode),
        encryptOwnershipCode(ownershipCode, context, env),
        buildArtworkPlatePackage({
          publicCode,
          ownershipCode,
          artworkId: input.pieceId,
          editionNumber: input.editionNumber,
          generatedAt,
        }),
      ]);

      const row = {
        id,
        piece_id: input.pieceId,
        edition_number: input.editionNumber,
        public_code: publicCode,
        plate_generated_at: generatedAt,
        ownership_code_ciphertext: envelope.ciphertext,
        ownership_code_nonce: envelope.nonce,
        ownership_code_key_version: envelope.keyVersion,
      };

      try {
        await env.DB.prepare(
          `INSERT INTO keeper_pieces
             (id, piece_id, edition_number, recovery_code_hash, public_code,
              issuance_key, plate_status, plate_generated_at, front_svg_sha256,
              back_svg_sha256, ownership_code_ciphertext, ownership_code_nonce,
              ownership_code_key_version, backup_status, registered_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
        ).bind(
          id, input.pieceId, input.editionNumber, verifier, publicCode,
          input.issuanceKey, 'generated', generatedAt, plate.frontSha256,
          plate.undersideSha256, envelope.ciphertext, envelope.nonce,
          envelope.keyVersion, 'pending', generatedAt,
        ).run();
      } catch (error) {
        if (/public_code/i.test(String(error?.message || '')) && /unique/i.test(String(error?.message || ''))) {
          continue;
        }
        if (/unique/i.test(String(error?.message || ''))) {
          const concurrentReplay = await findByIssuanceKey(env, input.issuanceKey);
          if (concurrentReplay) return replayIssuedPackage(concurrentReplay, input, env);
          return jsonResponse({ ok: false, error: 'issuance_conflict' }, 409);
        }
        throw error;
      }

      const backup = await backupPlateEnvelope(env.ARTWORK_REGISTRY_BACKUP, row);
      await recordBackupResult(env, row, backup);
      return jsonResponse({ ok: true, ownershipCode, ...plate }, 201);
    }
    return jsonResponse({ ok: false, error: 'public_code_collision' }, 503);
  } catch (error) {
    if (isSchemaMissing(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'issuance_failed' }, 500);
  }
}
