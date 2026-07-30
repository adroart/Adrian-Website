import { resolveArtwork } from './artworkCatalog.js';
import { jsonResponse } from './admin.js';
import {
  genKeeperPieceId,
  hashRecoveryCode,
  isMissingTableError,
  migrationNotApplied,
} from './keeper.js';
import {
  buildLineageEvent,
  lineageAnchorStatement,
  lineageStatement,
} from './lineage.js';
import {
  backupPlateEnvelope,
  recordPlateBackupResult,
} from './plateBackup.js';
import { buildArtworkPlatePackage, generatePublicPlateCode } from '../../../utils/artworkPlate.ts';
import {
  decryptOwnershipCode,
  encryptOwnershipCode,
  isCanonicalOwnershipCodeKeyVersion,
} from '../../../utils/ownershipCodeCrypto.ts';
import { generateRecoveryCode } from '../../../utils/recoveryCode.ts';

const MAX_ISSUANCE_KEY_LENGTH = 128;
const MAX_EDITION_NUMBER = 9999;
const PUBLIC_CODE_ATTEMPTS = 8;

function isSchemaMissing(error) {
  return isMissingTableError(error) || /no such column/i.test(String(error?.message || ''));
}

function editionConstraintResponse(error) {
  const message = String(error?.message || '');
  if (/keeper_piece_edition_kind_conflict/i.test(message)) {
    return jsonResponse({ ok: false, error: 'artwork_edition_kind_conflict' }, 409);
  }
  if (/keeper_piece_edition_range_violation/i.test(message)) {
    return jsonResponse({ ok: false, error: 'invalid_edition_number' }, 400);
  }
  return null;
}

function validateBasicInput(body) {
  const pieceId = typeof body?.pieceId === 'string' ? body.pieceId.trim().toUpperCase() : '';
  if (!pieceId) return { error: 'unknown_artwork' };
  const editionNumber = body?.editionNumber;
  if (editionNumber === undefined) return { error: 'edition_number_required' };
  if (!Number.isSafeInteger(editionNumber) || editionNumber < 0 || editionNumber > MAX_EDITION_NUMBER) {
    return { error: 'invalid_edition_number' };
  }
  const issuanceKey = typeof body?.issuanceKey === 'string' ? body.issuanceKey.trim() : '';
  if (!issuanceKey || issuanceKey.length > MAX_ISSUANCE_KEY_LENGTH) {
    return { error: 'issuance_key_required' };
  }
  let requestedEditionKind = null;
  if (body?.editionKind !== undefined && body?.editionKind !== null) {
    requestedEditionKind = typeof body.editionKind === 'string' ? body.editionKind.trim() : '';
    if (!requestedEditionKind) return { error: 'edition_required' };
    if (requestedEditionKind !== 'unique' && requestedEditionKind !== 'numbered') {
      return { error: 'invalid_edition_kind' };
    }
  }
  return {
    pieceId,
    editionNumber,
    issuanceKey,
    requestedEditionKind,
    uniqueConfirmed: body?.uniqueConfirmed === true,
  };
}

async function validateNewIssuance(env, basic) {
  const artwork = await resolveArtwork(env, basic.pieceId);
  if (!artwork) return { error: 'unknown_artwork' };
  const editionKind = artwork.editionKind;
  if (editionKind === 'unspecified') return { error: 'edition_metadata_required' };
  if (basic.requestedEditionKind && basic.requestedEditionKind !== editionKind) {
    return { error: 'invalid_edition_kind' };
  }
  if (editionKind === 'unique') {
    if (basic.editionNumber !== 0) return { error: 'invalid_edition_number' };
    if (!basic.uniqueConfirmed) return { error: 'unique_confirmation_required' };
  } else if (basic.editionNumber < 1 || basic.editionNumber > artwork.editionSize) {
    return { error: 'invalid_edition_number' };
  }
  return { ...basic, editionKind };
}

export function registryPlateCryptoConfigured(env) {
  const version = env.OWNERSHIP_CODE_ACTIVE_KEY_VERSION;
  if (!isCanonicalOwnershipCodeKeyVersion(version)) return false;
  const encodedKey = env[`OWNERSHIP_CODE_KEY_V${version}`];
  if (typeof encodedKey !== 'string'
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedKey)) {
    return false;
  }
  try {
    const binary = atob(encodedKey);
    return binary.length === 32 && btoa(binary) === encodedKey;
  } catch {
    return false;
  }
}

export async function createRegistryPlateCandidate(env, input) {
  if (!registryPlateCryptoConfigured(env)) {
    const error = new Error('ownership_code_crypto_not_configured');
    error.code = 'ownership_code_crypto_not_configured';
    throw error;
  }
  const id = input.keeperPieceId || genKeeperPieceId();
  const publicCode = input.publicCode || generatePublicPlateCode();
  const ownershipCode = input.ownershipCode || generateRecoveryCode();
  const generatedAt = input.generatedAt || new Date().toISOString();
  const context = {
    publicCode,
    pieceId: input.pieceId,
    editionNumber: input.editionNumber,
  };
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
  const lineageEvent = await buildLineageEvent({
    keeperPieceId: id,
    sequence: 1,
    eventType: 'issued',
    eventAt: generatedAt,
    previousHash: null,
    publicPayload: {
      pieceId: input.pieceId,
      editionNumber: input.editionNumber,
      publicCode,
    },
  });
  return {
    id,
    pieceId: input.pieceId,
    editionNumber: input.editionNumber,
    issuanceKey: input.issuanceKey,
    publicCode,
    ownershipCode,
    generatedAt,
    verifier,
    envelope,
    plate,
    lineageEvent,
  };
}

export function registryPlateInsertStatement(env, candidate, options = {}) {
  const valueClause = options.onlyIfPreviousChanged === true
    ? `SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
              ?13, ?14, ?15, ?16 WHERE changes() = 1`
    : `VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
              ?13, ?14, ?15, ?16)`;
  return env.DB.prepare(
    `INSERT INTO keeper_pieces
       (id, piece_id, edition_number, recovery_code_hash, public_code,
        issuance_key, plate_status, plate_generated_at, front_svg_sha256,
        back_svg_sha256, ownership_code_ciphertext, ownership_code_nonce,
        ownership_code_key_version, backup_status, registered_at,
        supersedes_keeper_piece_id)
     ${valueClause}`,
  ).bind(
    candidate.id,
    candidate.pieceId,
    candidate.editionNumber,
    candidate.verifier,
    candidate.publicCode,
    candidate.issuanceKey,
    'generated',
    candidate.generatedAt,
    candidate.plate.frontSha256,
    candidate.plate.undersideSha256,
    candidate.envelope.ciphertext,
    candidate.envelope.nonce,
    candidate.envelope.keyVersion,
    'pending',
    candidate.generatedAt,
    options.supersedesKeeperPieceId ?? null,
  );
}

function envelopeFromRow(row) {
  return {
    ciphertext: row.ownership_code_ciphertext,
    nonce: row.ownership_code_nonce,
    keyVersion: String(row.ownership_code_key_version),
  };
}

export async function packageFromStoredRegistryPlate(row, env) {
  const ownershipCode = await decryptOwnershipCode(
    envelopeFromRow(row),
    {
      publicCode: row.public_code,
      pieceId: row.piece_id,
      editionNumber: row.edition_number,
    },
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

export async function backupRegistryPlate(env, row) {
  const result = await backupPlateEnvelope(env.ARTWORK_REGISTRY_BACKUP, row);
  try {
    await recordPlateBackupResult(env.DB, row.id, result);
    row.backup_status = result.status;
    if (result.status === 'verified') {
      row.backup_reference = result.reference;
      row.backup_sha256 = result.sha256;
    }
    return {
      status: result.status,
      warning: result.status === 'failed' ? 'online_backup_failed' : undefined,
    };
  } catch {
    return {
      status: row.backup_status || 'pending',
      warning: 'backup_status_record_failed',
    };
  }
}

function withBackupOutcome(packageBody, backup) {
  return {
    ...packageBody,
    backupStatus: backup.status,
    ...(backup.warning ? { warning: backup.warning } : {}),
  };
}

async function findByIssuanceKey(env, issuanceKey) {
  return env.DB.prepare('SELECT * FROM keeper_pieces WHERE issuance_key = ?1')
    .bind(issuanceKey).first();
}

async function replayIssuedPackage(row, input, env) {
  const storedEditionKind = row.edition_number === 0 ? 'unique' : 'numbered';
  if (row.piece_id !== input.pieceId
    || row.edition_number !== input.editionNumber
    || (input.requestedEditionKind && input.requestedEditionKind !== storedEditionKind)) {
    return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
  }
  if (row.plate_status !== 'generated') {
    return jsonResponse({ ok: false, error: 'plate_identity_locked' }, 409);
  }
  const backup = row.backup_status === 'verified'
    ? { status: 'verified' }
    : await backupRegistryPlate(env, row);
  return jsonResponse(withBackupOutcome(await packageFromStoredRegistryPlate(row, env), backup));
}

async function findEditionKindConflict(env, input) {
  const comparison = input.editionKind === 'unique' ? '> 0' : '= 0';
  return env.DB.prepare(
    `SELECT id FROM keeper_pieces
      WHERE piece_id = ?1 AND edition_number ${comparison}
        AND plate_status NOT IN ('void', 'superseded')
      LIMIT 1`,
  ).bind(input.pieceId).first();
}

export async function issueRegistryPlate(request, env) {
  if (!registryPlateCryptoConfigured(env)) {
    return jsonResponse({ ok: false, error: 'ownership_code_crypto_not_configured' }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const basic = validateBasicInput(body);
  if (basic.error) return jsonResponse({ ok: false, error: basic.error }, 400);

  try {
    const replay = await findByIssuanceKey(env, basic.issuanceKey);
    if (replay) return replayIssuedPackage(replay, basic, env);
    const input = await validateNewIssuance(env, basic);
    if (input.error) return jsonResponse({ ok: false, error: input.error }, 400);
    if (await findEditionKindConflict(env, input)) {
      return jsonResponse({ ok: false, error: 'artwork_edition_kind_conflict' }, 409);
    }
    const duplicate = await env.DB.prepare(
      `SELECT id FROM keeper_pieces
        WHERE piece_id = ?1 AND edition_number = ?2
          AND plate_status NOT IN ('void', 'superseded')`,
    ).bind(input.pieceId, input.editionNumber).first();
    if (duplicate) return jsonResponse({ ok: false, error: 'artwork_edition_already_issued' }, 409);

    for (let attempt = 0; attempt < PUBLIC_CODE_ATTEMPTS; attempt += 1) {
      const candidate = await createRegistryPlateCandidate(env, input);
      try {
        if (typeof env.DB.batch !== 'function') throw new Error('atomic write unavailable');
        await env.DB.batch([
          registryPlateInsertStatement(env, candidate),
          lineageStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
          lineageAnchorStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
        ]);
      } catch (error) {
        const editionConstraint = editionConstraintResponse(error);
        if (editionConstraint) return editionConstraint;
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
      const row = {
        id: candidate.id,
        public_code: candidate.publicCode,
        piece_id: candidate.pieceId,
        edition_number: candidate.editionNumber,
        plate_generated_at: candidate.generatedAt,
        ownership_code_ciphertext: candidate.envelope.ciphertext,
        ownership_code_nonce: candidate.envelope.nonce,
        ownership_code_key_version: candidate.envelope.keyVersion,
        backup_status: 'pending',
      };
      const backup = await backupRegistryPlate(env, row);
      return jsonResponse(
        withBackupOutcome({ ok: true, ownershipCode: candidate.ownershipCode, ...candidate.plate }, backup),
        201,
      );
    }
    return jsonResponse({ ok: false, error: 'public_code_collision' }, 503);
  } catch (error) {
    if (isSchemaMissing(error)) return migrationNotApplied();
    const editionConstraint = editionConstraintResponse(error);
    if (editionConstraint) return editionConstraint;
    if (error?.code === 'artwork_edition_metadata_conflict'
      || error?.code === 'invalid_stored_edition_metadata') {
      return jsonResponse({ ok: false, error: error.code }, 500);
    }
    return jsonResponse({ ok: false, error: 'issuance_failed' }, 500);
  }
}
