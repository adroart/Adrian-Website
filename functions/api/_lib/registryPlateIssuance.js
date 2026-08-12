import { constantTimeEqual, jsonResponse } from './admin.js';
import {
  genKeeperPieceId,
  hashRecoveryCode,
  isMissingTableError,
  migrationNotApplied,
} from './keeper.js';
import {
  buildLineageEvent,
} from './lineage.js';
import {
  backupPlateEnvelope,
  plateBackupIsVerified,
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

function isSchemaMissing(error) {
  return isMissingTableError(error) || /no such column/i.test(String(error?.message || ''));
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
  let storedRow;
  try {
    storedRow = await env.DB.prepare(
      'SELECT * FROM keeper_pieces WHERE id = ?1',
    ).bind(row.id).first();
  } catch {
    return { status: row.backup_status || 'pending', warning: 'backup_status_record_failed' };
  }
  if (!storedRow) {
    return { status: row.backup_status || 'pending', warning: 'backup_status_record_failed' };
  }
  Object.assign(row, storedRow);
  const result = await backupPlateEnvelope(env.ARTWORK_REGISTRY_BACKUP, storedRow);
  try {
    await recordPlateBackupResult(env.DB, storedRow, result);
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
    const current = await env.DB.prepare(
      'SELECT * FROM keeper_pieces WHERE id = ?1',
    ).bind(storedRow.id).first().catch(() => null);
    const sameSource = current && [
      'public_code', 'piece_id', 'edition_number', 'plate_generated_at',
      'front_svg_sha256', 'back_svg_sha256', 'ownership_code_ciphertext',
      'ownership_code_nonce', 'ownership_code_key_version', 'recovery_code_hash',
    ].every((field) => current[field] === storedRow[field]);
    if (
      sameSource
      && result.status === 'verified'
      && plateBackupIsVerified(current)
      && current.backup_reference === result.reference
      && current.backup_sha256 === result.sha256
    ) {
      Object.assign(row, current);
      return { status: 'verified' };
    }
    if (sameSource && result.status === 'failed' && current.backup_status === 'failed') {
      Object.assign(row, current);
      return { status: 'failed', warning: 'online_backup_failed' };
    }
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
  const backup = plateBackupIsVerified(row)
    ? { status: 'verified' }
    : await backupRegistryPlate(env, row);
  return jsonResponse(withBackupOutcome(await packageFromStoredRegistryPlate(row, env), backup));
}

function optionalPlateInput(input) {
  const keeperPieceId = typeof input?.keeperPieceId === 'string'
    ? input.keeperPieceId.trim()
    : '';
  const idempotencyKey = typeof input?.idempotencyKey === 'string'
    ? input.idempotencyKey.trim()
    : '';
  const userId = typeof input?.authorization?.userId === 'string'
    ? input.authorization.userId.trim()
    : '';
  const email = typeof input?.authorization?.email === 'string'
    ? input.authorization.email.trim().toLowerCase()
    : '';
  const unlockExpiresAt = input?.authorization?.registryUnlockExpiresAt;
  if (!keeperPieceId || keeperPieceId.length > 128) return { error: 'invalid_keeper_piece_id' };
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return { error: 'invalid_idempotency_key' };
  }
  if (!userId || userId.length > 128 || !email || email.length > 254) {
    return { error: 'invalid_administrator_identity' };
  }
  if (!Number.isSafeInteger(unlockExpiresAt) || unlockExpiresAt <= Math.floor(Date.now() / 1000)) {
    return { error: 'registry_unlock_required' };
  }
  const preparedAtProvided = input.preparedAt !== undefined;
  const preparedAt = !preparedAtProvided
    ? new Date().toISOString()
    : typeof input.preparedAt === 'string'
      ? input.preparedAt.trim()
      : '';
  const parsedPreparedAt = new Date(preparedAt);
  if (!preparedAt || Number.isNaN(parsedPreparedAt.getTime())) return { error: 'invalid_prepared_at' };
  return {
    keeperPieceId,
    idempotencyKey,
    authorization: { userId, email, registryUnlockExpiresAt: unlockExpiresAt },
    preparedAt: parsedPreparedAt.toISOString(),
    preparedAtProvided,
  };
}

async function optionalPlateFingerprint(input) {
  const bytes = new TextEncoder().encode(JSON.stringify({
    action: 'prepare_optional_plate',
    keeperPieceId: input.keeperPieceId,
    idempotencyKey: input.idempotencyKey,
    administratorUserId: input.authorization.userId,
    administratorEmail: input.authorization.email,
    preparedAt: input.preparedAtProvided ? input.preparedAt : null,
  }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function findPlatePreparationEvent(env, idempotencyKey) {
  return env.DB.prepare(
    `SELECT id, idempotency_key, event_type, keeper_piece_id, artwork_id,
            administrator_user_id, administrator_email, reason, before_json,
            after_json, outcome, related_record_id, mutation_fingerprint,
            created_at
       FROM registry_maintenance_events
      WHERE idempotency_key = ?1`,
  ).bind(idempotencyKey).first();
}

function parseExactPlateSnapshot(value) {
  try {
    const parsed = JSON.parse(value);
    const keys = [
      'keeperPieceId', 'artworkId', 'plateStatus', 'plateGeneratedAt',
      'frontSha256', 'undersideSha256', 'backupStatus', 'backupReference',
      'backupSha256', 'recordVersion',
    ];
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || Object.keys(parsed).length !== keys.length
      || Object.keys(parsed).some((key) => !keys.includes(key))) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function replayOptionalPlate(env, existing, input, fingerprint) {
  if (!existing) return null;
  if (existing.idempotency_key !== input.idempotencyKey
    || existing.event_type !== 'plate_prepared'
    || existing.keeper_piece_id !== input.keeperPieceId
    || existing.administrator_user_id !== input.authorization.userId
    || existing.administrator_email !== input.authorization.email
    || existing.outcome !== 'succeeded'
    || existing.related_record_id !== input.keeperPieceId
    || existing.mutation_fingerprint !== fingerprint) {
    return { ok: false, error: 'idempotency_conflict' };
  }
  const before = parseExactPlateSnapshot(existing.before_json);
  const after = parseExactPlateSnapshot(existing.after_json);
  if (!before || !after || before.keeperPieceId !== input.keeperPieceId
    || before.plateStatus !== 'legacy' || after.plateStatus !== 'generated'
    || after.recordVersion !== before.recordVersion + 1
    || existing.artwork_id !== after.artworkId) {
    return { ok: false, error: 'idempotency_conflict' };
  }
  const row = await env.DB.prepare('SELECT * FROM keeper_pieces WHERE id = ?1')
    .bind(input.keeperPieceId).first();
  if (!row || row.registration_status !== 'registered' || row.plate_status !== 'generated'
    || row.piece_id !== after.artworkId || row.plate_generated_at !== after.plateGeneratedAt
    || row.front_svg_sha256 !== after.frontSha256
    || row.back_svg_sha256 !== after.undersideSha256
    || row.backup_status !== 'verified' || row.backup_reference !== after.backupReference
    || row.backup_sha256 !== after.backupSha256 || !plateBackupIsVerified(row)) {
    return { ok: false, error: 'plate_preparation_state_mismatch' };
  }
  try {
    const plate = await packageFromStoredRegistryPlate(row, env);
    return {
      ...plate,
      replayed: true,
      eventId: existing.id,
      generatedAt: row.plate_generated_at,
      backupStatus: 'verified',
    };
  } catch {
    return { ok: false, error: 'plate_preparation_failed' };
  }
}

function platePreparationEventStatement(env, {
  input, row, plate, backup, fingerprint, eventId,
}) {
  const before = JSON.stringify({
    keeperPieceId: row.id,
    artworkId: row.piece_id,
    plateStatus: row.plate_status,
    plateGeneratedAt: row.plate_generated_at,
    frontSha256: row.front_svg_sha256,
    undersideSha256: row.back_svg_sha256,
    backupStatus: row.backup_status,
    backupReference: row.backup_reference,
    backupSha256: row.backup_sha256,
    recordVersion: row.record_version,
  });
  const after = JSON.stringify({
    keeperPieceId: row.id,
    artworkId: row.piece_id,
    plateStatus: 'generated',
    plateGeneratedAt: input.preparedAt,
    frontSha256: plate.frontSha256,
    undersideSha256: plate.undersideSha256,
    backupStatus: 'verified',
    backupReference: backup.reference,
    backupSha256: backup.sha256,
    recordVersion: row.record_version + 1,
  });
  return env.DB.prepare(
    `INSERT INTO registry_maintenance_events
       (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
        administrator_user_id, administrator_email, reason, before_json,
        after_json, outcome, related_record_id, mutation_fingerprint, created_at)
     SELECT ?1, ?2, 'plate_prepared', ?3, ?4, ?5, ?6, ?7, ?8, ?9,
            'succeeded', ?3, ?10, ?11
      WHERE changes() = 1`,
  ).bind(
    eventId,
    input.idempotencyKey,
    row.id,
    row.piece_id,
    input.authorization.userId,
    input.authorization.email,
    'Prepare optional physical artwork plate.',
    before,
    after,
    fingerprint,
    input.preparedAt,
  );
}

/** Add optional physical fabrication to an already registered identity. */
export async function prepareOptionalPlate(env, rawInput) {
  const input = optionalPlateInput(rawInput);
  if (input.error) return { ok: false, error: input.error };
  if (!registryPlateCryptoConfigured(env)) {
    return { ok: false, error: 'ownership_code_crypto_not_configured' };
  }
  if (typeof env?.DB?.batch !== 'function') {
    return { ok: false, error: 'atomic_write_unavailable' };
  }
  const fingerprint = await optionalPlateFingerprint(input);
  try {
    const existing = await findPlatePreparationEvent(env, input.idempotencyKey);
    const replay = await replayOptionalPlate(env, existing, input, fingerprint);
    if (replay) return replay;

    const row = await env.DB.prepare('SELECT * FROM keeper_pieces WHERE id = ?1')
      .bind(input.keeperPieceId).first();
    if (!row) return { ok: false, error: 'keeper_piece_not_found' };
    if (row.registration_status !== 'registered') {
      return { ok: false, error: 'artwork_not_registered' };
    }
    if (row.plate_status !== 'legacy' || row.plate_generated_at !== null
      || row.front_svg_sha256 !== null || row.back_svg_sha256 !== null) {
      return { ok: false, error: 'plate_identity_locked' };
    }
    const expectedIdentityReference = `identities/${row.public_code}/${row.identity_backup_sha256}.json`;
    if (row.identity_backup_status !== 'verified'
      || row.identity_backup_reference !== expectedIdentityReference
      || !/^[0-9a-f]{64}$/.test(row.identity_backup_sha256 || '')) {
      return { ok: false, error: 'identity_backup_not_verified' };
    }

    const ownershipCode = await decryptOwnershipCode(
      envelopeFromRow(row),
      {
        publicCode: row.public_code,
        pieceId: row.piece_id,
        editionNumber: row.edition_number,
      },
      env,
    );
    const verifier = await hashRecoveryCode(ownershipCode);
    if (!constantTimeEqual(verifier, row.recovery_code_hash)) {
      return { ok: false, error: 'ownership_code_verifier_mismatch' };
    }
    const plate = await buildArtworkPlatePackage({
      publicCode: row.public_code,
      ownershipCode,
      artworkId: row.piece_id,
      editionNumber: row.edition_number,
      generatedAt: input.preparedAt,
    });
    const plateRow = {
      ...row,
      plate_generated_at: input.preparedAt,
      front_svg_sha256: plate.frontSha256,
      back_svg_sha256: plate.undersideSha256,
    };
    const backup = await backupPlateEnvelope(env.ARTWORK_REGISTRY_BACKUP, plateRow);
    if (backup.status !== 'verified') return { ok: false, error: 'plate_backup_failed' };

    const update = env.DB.prepare(
      `UPDATE keeper_pieces
          SET plate_status = 'generated', plate_generated_at = ?1,
              front_svg_sha256 = ?2, back_svg_sha256 = ?3,
              backup_status = 'verified', backup_reference = ?4,
              backup_sha256 = ?5, backup_at = ?1
        WHERE id = ?6 AND registration_status = 'registered'
          AND plate_status = 'legacy' AND plate_generated_at IS NULL
          AND front_svg_sha256 IS NULL AND back_svg_sha256 IS NULL
          AND record_version = ?7 AND public_code = ?8 AND issuance_key = ?9
          AND recovery_code_hash = ?10 AND ownership_code_ciphertext = ?11
          AND ownership_code_nonce = ?12 AND ownership_code_key_version = ?13
          AND keeper_user_id IS ?14 AND lineage_head_hash IS ?15
          AND lineage_event_count = ?16 AND identity_backup_status = 'verified'
          AND identity_backup_reference = ?17 AND identity_backup_sha256 = ?18`,
    ).bind(
      input.preparedAt,
      plate.frontSha256,
      plate.undersideSha256,
      backup.reference,
      backup.sha256,
      row.id,
      row.record_version,
      row.public_code,
      row.issuance_key,
      row.recovery_code_hash,
      row.ownership_code_ciphertext,
      row.ownership_code_nonce,
      row.ownership_code_key_version,
      row.keeper_user_id,
      row.lineage_head_hash,
      row.lineage_event_count,
      row.identity_backup_reference,
      row.identity_backup_sha256,
    );
    const eventId = `rme-${crypto.randomUUID()}`;
    const event = platePreparationEventStatement(env, {
      input, row, plate, backup, fingerprint, eventId,
    });
    const results = await env.DB.batch([update, event]);
    if (results?.[0]?.meta?.changes !== 1 || results?.[1]?.meta?.changes !== 1) {
      const raced = await findPlatePreparationEvent(env, input.idempotencyKey);
      const replay = await replayOptionalPlate(env, raced, input, fingerprint);
      if (replay) return replay;
      return { ok: false, error: 'plate_preparation_conflict' };
    }
    return {
      ok: true,
      replayed: false,
      eventId,
      ownershipCode,
      ...plate,
      generatedAt: input.preparedAt,
      backupStatus: 'verified',
    };
  } catch (error) {
    try {
      const raced = await findPlatePreparationEvent(env, input.idempotencyKey);
      const replay = await replayOptionalPlate(env, raced, input, fingerprint);
      if (replay) return replay;
    } catch {
      // Preserve the safe failure below.
    }
    if (isSchemaMissing(error)) return { ok: false, error: 'registry_migration_required' };
    return { ok: false, error: 'plate_preparation_failed' };
  }
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
    return jsonResponse({ ok: false, error: 'artwork_registration_required' }, 409);
  } catch (error) {
    if (isSchemaMissing(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'issuance_failed' }, 500);
  }
}
