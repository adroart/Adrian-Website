import { resolveArtwork } from './artworkCatalog.js';
import {
  buildMaintenanceEventStatement,
  findMaintenanceEventByIdempotencyKey,
  maintenanceMutationFingerprint,
  normalizeReason,
  projectMaintenanceHistorySnapshots,
} from './registryMaintenance.js';
import {
  lineageAnchorStatement,
  lineageStatement,
  prepareNextLineageEvent,
} from './lineage.js';
import {
  backupRegistryPlate,
  createRegistryPlateCandidate,
  packageFromStoredRegistryPlate,
  registryPlateCryptoConfigured,
  registryPlateInsertStatement,
} from './registryPlateIssuance.js';
import { decryptOwnershipCode } from '../../../utils/ownershipCodeCrypto.ts';

const ACTION_FIELDS = {
  correct_link: new Set([
    'action', 'artworkId', 'editionNumber', 'physicalEngravingMatches',
    'reason', 'idempotencyKey', 'expectedRecordVersion',
  ]),
  void_plate: new Set([
    'action', 'physicalDisposition', 'reason', 'idempotencyKey', 'expectedRecordVersion',
  ]),
  replace_plate: new Set([
    'action', 'physicalDisposition', 'reason', 'idempotencyKey', 'expectedRecordVersion',
  ]),
};

function response(body, status = 200) {
  return { body, status };
}

function statusFor(error) {
  if (['idempotency_conflict', 'version_conflict', 'link_collision', 'link_unchanged',
    'plate_not_generated', 'plate_not_active', 'plate_identity_locked'].includes(error)) return 409;
  if (error === 'not_found' || error === 'unknown_artwork') return 404;
  if (error === 'maintenance_write_failed' || error === 'atomic_write_unavailable'
    || error === 'ownership_code_crypto_not_configured') return 503;
  return 400;
}

function normalizeBase(body) {
  const fields = ACTION_FIELDS[body?.action];
  if (!fields || Object.keys(body).length !== fields.size
    || Object.keys(body).some((key) => !fields.has(key))) {
    return { error: fields ? 'invalid_input' : 'invalid_action' };
  }
  if (!Number.isSafeInteger(body.expectedRecordVersion) || body.expectedRecordVersion < 0) {
    return { error: 'invalid_expected_record_version' };
  }
  const reason = normalizeReason(body.reason);
  if (!reason.ok) return { error: reason.error };
  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return { error: 'invalid_idempotency_key' };
  }
  return {
    action: body.action,
    expectedRecordVersion: body.expectedRecordVersion,
    reason: reason.reason,
    idempotencyKey,
  };
}

function normalizeDisposition(value) {
  const disposition = typeof value === 'string' ? value.trim() : '';
  return disposition && disposition.length <= 1000 ? disposition : null;
}

function normalizeArtworkId(value) {
  const artworkId = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{2,3}-[0-9]{3}$/.test(artworkId) ? artworkId : null;
}

async function requestFingerprint(input, keeperPieceId, authorization) {
  return maintenanceMutationFingerprint({
    action: input.action,
    keeperPieceId,
    expectedRecordVersion: input.expectedRecordVersion,
    reason: input.reason,
    administratorUserId: authorization.userId,
    administratorEmail: authorization.email,
    ...(input.action === 'correct_link'
      ? { artworkId: input.artworkId, editionNumber: input.editionNumber, physicalEngravingMatches: true }
      : { physicalDisposition: input.physicalDisposition }),
  });
}

function safeSnapshots(existing) {
  const snapshots = projectMaintenanceHistorySnapshots(
    existing.event_type,
    existing.before_json,
    existing.after_json,
  );
  return snapshots.warning ? null : snapshots;
}

function hasExactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

async function exactReplay(env, existing, input, keeperPieceId, authorization) {
  if (!existing) return null;
  const eventType = input.action === 'correct_link'
    ? 'link_corrected'
    : input.action === 'void_plate'
      ? 'plate_voided'
      : 'plate_replaced';
  const fingerprint = await requestFingerprint(input, keeperPieceId, authorization);
  if (existing.idempotency_key !== input.idempotencyKey
    || existing.event_type !== eventType
    || existing.keeper_piece_id !== keeperPieceId
    || existing.administrator_user_id !== authorization.userId
    || existing.administrator_email !== authorization.email
    || existing.reason !== input.reason
    || existing.outcome !== 'succeeded'
    || existing.mutation_fingerprint !== fingerprint) {
    return response({ ok: false, error: 'idempotency_conflict' }, 409);
  }
  const snapshots = safeSnapshots(existing);
  if (!snapshots) return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  if (input.action === 'correct_link') {
    const keys = ['keeperPieceId', 'pieceId', 'editionNumber', 'recordVersion'];
    const record = snapshots.after;
    if (!hasExactKeys(snapshots.before, keys) || !hasExactKeys(record, keys)
      || existing.artwork_id !== input.artworkId
      || existing.related_record_id !== keeperPieceId
      || snapshots.before.keeperPieceId !== keeperPieceId
      || snapshots.before.recordVersion !== input.expectedRecordVersion
      || record?.keeperPieceId !== keeperPieceId
      || record?.pieceId !== input.artworkId
      || record?.editionNumber !== input.editionNumber
      || record?.recordVersion !== input.expectedRecordVersion + 1) {
      return response({ ok: false, error: 'idempotency_conflict' }, 409);
    }
    return response({ ok: true, replayed: true, eventId: existing.id, record });
  }
  if (input.action === 'void_plate') {
    const keys = [
      'keeperPieceId', 'artworkId', 'plateStatus', 'physicalDisposition', 'recordVersion',
    ];
    const record = snapshots.after;
    if (!hasExactKeys(snapshots.before, keys) || !hasExactKeys(record, keys)
      || existing.related_record_id !== keeperPieceId
      || existing.artwork_id !== snapshots.before.artworkId
      || snapshots.before.keeperPieceId !== keeperPieceId
      || snapshots.before.plateStatus !== 'generated'
      || snapshots.before.recordVersion !== input.expectedRecordVersion
      || record?.keeperPieceId !== keeperPieceId
      || record?.plateStatus !== 'void'
      || record?.physicalDisposition !== input.physicalDisposition
      || record?.recordVersion !== input.expectedRecordVersion + 1) {
      return response({ ok: false, error: 'idempotency_conflict' }, 409);
    }
    return response({ ok: true, replayed: true, eventId: existing.id, record });
  }

  const replacementId = snapshots.after?.keeperPieceId;
  const replacementKeys = [
    'keeperPieceId', 'artworkId', 'publicCode', 'plateStatus',
    'supersedesKeeperPieceId', 'supersededByKeeperPieceId', 'replacedAt', 'recordVersion',
  ];
  if (!hasExactKeys(snapshots.before, replacementKeys)
    || !hasExactKeys(snapshots.after, replacementKeys)
    || typeof replacementId !== 'string'
    || snapshots.before?.keeperPieceId !== keeperPieceId
    || snapshots.before?.plateStatus !== 'active'
    || snapshots.before?.recordVersion !== input.expectedRecordVersion
    || snapshots.after?.plateStatus !== 'generated'
    || snapshots.after?.recordVersion !== 0
    || snapshots.after?.supersedesKeeperPieceId !== keeperPieceId
    || existing.artwork_id !== snapshots.before.artworkId
    || existing.related_record_id !== replacementId) {
    return response({ ok: false, error: 'idempotency_conflict' }, 409);
  }
  const row = await env.DB.prepare('SELECT * FROM keeper_pieces WHERE id = ?1')
    .bind(replacementId).first();
  if (!row || row.supersedes_keeper_piece_id !== keeperPieceId
    || row.public_code !== snapshots.after.publicCode
    || row.plate_generated_at !== snapshots.after.replacedAt
    || existing.created_at !== snapshots.after.replacedAt) {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  if (row.plate_status !== 'generated') {
    return response({ ok: false, error: 'plate_identity_locked' }, 409);
  }
  try {
    const plate = await packageFromStoredRegistryPlate(row, env);
    return response({
      ok: true,
      replayed: true,
      eventId: existing.id,
      replacement: {
        ...plate,
        generatedAt: row.plate_generated_at,
        backupStatus: row.backup_status,
        ...(row.backup_status === 'failed' ? { warning: 'online_backup_failed' } : {}),
        ...(row.backup_status === 'pending' ? { warning: 'backup_status_record_failed' } : {}),
      },
    });
  } catch {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
}

function eventDetails({
  input, keeperPieceId, artworkId, authorization, before, after,
  eventType, relatedRecordId, createdAt, fingerprint, eventId,
}) {
  return {
    id: eventId,
    idempotencyKey: input.idempotencyKey,
    eventType,
    keeperPieceId,
    artworkId,
    authorization,
    reason: input.reason,
    before,
    after,
    outcome: 'succeeded',
    relatedRecordId,
    createdAt,
    mutationFingerprint: fingerprint,
  };
}

function batchSucceeded(results, count) {
  return Array.isArray(results) && results.length === count
    && results.every((result) => result?.success === true && result?.meta?.changes === 1);
}

async function appendLifecycleBatch(env, statements) {
  if (typeof env?.DB?.batch !== 'function') return { ok: false, error: 'atomic_write_unavailable' };
  try {
    const results = await env.DB.batch(statements);
    return batchSucceeded(results, statements.length)
      ? { ok: true }
      : { ok: false, error: 'version_conflict' };
  } catch (error) {
    const message = String(error?.message || '');
    if (/unique/i.test(message)) return { ok: false, error: 'link_collision' };
    return { ok: false, error: 'maintenance_write_failed' };
  }
}

async function validateEdition(env, artworkId, editionNumber) {
  const artwork = await resolveArtwork(env, artworkId);
  if (!artwork) return { error: 'unknown_artwork' };
  if (artwork.editionKind === 'unspecified') return { error: 'edition_metadata_required' };
  if (artwork.editionKind === 'unique') {
    return editionNumber === 0 ? { artwork } : { error: 'invalid_edition_number' };
  }
  return Number.isSafeInteger(editionNumber)
    && editionNumber >= 1
    && editionNumber <= artwork.editionSize
    ? { artwork }
    : { error: 'invalid_edition_number' };
}

async function correctLink(env, input, row, keeperPieceId, authorization, fingerprint) {
  if (input.physicalEngravingMatches !== true) {
    return response({ ok: false, error: 'physical_engraving_confirmation_required' }, 400);
  }
  if (row.plate_status !== 'generated' && row.plate_status !== 'active') {
    return response({ ok: false, error: 'plate_identity_locked' }, 409);
  }
  if (row.piece_id === input.artworkId && row.edition_number === input.editionNumber) {
    return response({ ok: false, error: 'link_unchanged' }, 409);
  }
  const edition = await validateEdition(env, input.artworkId, input.editionNumber);
  if (edition.error) return response({ ok: false, error: edition.error }, statusFor(edition.error));
  const collision = await env.DB.prepare(
    `SELECT id FROM keeper_pieces
      WHERE piece_id = ?1 AND edition_number = ?2
        AND plate_status NOT IN ('void', 'superseded') AND id <> ?3`,
  ).bind(input.artworkId, input.editionNumber, keeperPieceId).first();
  if (collision) return response({ ok: false, error: 'link_collision' }, 409);

  let correctedPackage;
  try {
    const ownershipCode = await decryptOwnershipCode({
      ciphertext: row.ownership_code_ciphertext,
      nonce: row.ownership_code_nonce,
      keyVersion: String(row.ownership_code_key_version),
    }, {
      publicCode: row.public_code,
      pieceId: row.piece_id,
      editionNumber: row.edition_number,
    }, env);
    correctedPackage = await createRegistryPlateCandidate(env, {
      keeperPieceId: row.id,
      pieceId: input.artworkId,
      editionNumber: input.editionNumber,
      issuanceKey: row.issuance_key,
      publicCode: row.public_code,
      ownershipCode,
      generatedAt: row.plate_generated_at,
    });
  } catch {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }

  const before = {
    keeperPieceId, pieceId: row.piece_id, editionNumber: row.edition_number,
    recordVersion: row.record_version,
  };
  const after = {
    keeperPieceId, pieceId: input.artworkId, editionNumber: input.editionNumber,
    recordVersion: input.expectedRecordVersion + 1,
  };
  const createdAt = new Date().toISOString();
  const eventId = `rme-${crypto.randomUUID()}`;
  let lineage;
  try {
    lineage = await prepareNextLineageEvent(env, {
      keeperPieceId, eventType: 'link_corrected', eventAt: createdAt,
      publicPayload: { pieceId: input.artworkId, editionNumber: input.editionNumber },
      onlyIfPreviousChanged: true,
    });
  } catch {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  const mutation = env.DB.prepare(
    `UPDATE keeper_pieces
        SET piece_id = ?1, edition_number = ?2, ownership_code_ciphertext = ?3,
            ownership_code_nonce = ?4, ownership_code_key_version = ?5,
            front_svg_sha256 = ?6, back_svg_sha256 = ?7,
            backup_status = 'pending', backup_reference = NULL, backup_at = NULL,
            record_version = record_version + 1
      WHERE id = ?8 AND record_version = ?9 AND piece_id IS ?10
        AND edition_number IS ?11 AND plate_status IN ('generated', 'active')`,
  ).bind(
    input.artworkId, input.editionNumber,
    correctedPackage.envelope.ciphertext, correctedPackage.envelope.nonce,
    correctedPackage.envelope.keyVersion,
    correctedPackage.plate.frontSha256, correctedPackage.plate.undersideSha256,
    keeperPieceId, input.expectedRecordVersion,
    row.piece_id, row.edition_number,
  );
  const event = buildMaintenanceEventStatement(env, eventDetails({
    input, keeperPieceId, artworkId: input.artworkId, authorization, before, after,
    eventType: 'link_corrected', relatedRecordId: keeperPieceId, createdAt, fingerprint, eventId,
  }));
  const result = await appendLifecycleBatch(env, [
    mutation, event, lineage.statement, lineage.anchorStatement,
  ]);
  if (!result.ok) return response(result, statusFor(result.error));
  return response({ ok: true, replayed: false, eventId, record: after });
}

async function voidPlate(env, input, row, keeperPieceId, authorization, fingerprint) {
  if (row.plate_status !== 'generated') {
    return response({ ok: false, error: 'plate_not_generated' }, 409);
  }
  const before = {
    keeperPieceId, artworkId: row.piece_id, plateStatus: row.plate_status,
    physicalDisposition: row.physical_disposition ?? null, recordVersion: row.record_version,
  };
  const after = {
    keeperPieceId, artworkId: row.piece_id, plateStatus: 'void',
    physicalDisposition: input.physicalDisposition,
    recordVersion: input.expectedRecordVersion + 1,
  };
  const createdAt = new Date().toISOString();
  const eventId = `rme-${crypto.randomUUID()}`;
  let lineage;
  try {
    lineage = await prepareNextLineageEvent(env, {
      keeperPieceId, eventType: 'voided', eventAt: createdAt,
      publicPayload: { plateStatus: 'void' }, onlyIfPreviousChanged: true,
    });
  } catch {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  const mutation = env.DB.prepare(
    `UPDATE keeper_pieces
        SET plate_status = 'void', physical_disposition = ?1,
            record_version = record_version + 1
      WHERE id = ?2 AND record_version = ?3 AND piece_id IS ?4
        AND plate_status = 'generated'`,
  ).bind(input.physicalDisposition, keeperPieceId, input.expectedRecordVersion, row.piece_id);
  const event = buildMaintenanceEventStatement(env, eventDetails({
    input, keeperPieceId, artworkId: row.piece_id, authorization, before, after,
    eventType: 'plate_voided', relatedRecordId: keeperPieceId, createdAt, fingerprint, eventId,
  }));
  const result = await appendLifecycleBatch(env, [
    mutation, event, lineage.statement, lineage.anchorStatement,
  ]);
  if (!result.ok) return response(result, statusFor(result.error));
  return response({ ok: true, replayed: false, eventId, record: after });
}

async function replacementIssuanceKey(input, keeperPieceId) {
  const digest = await maintenanceMutationFingerprint({
    kind: 'replacement_issuance', keeperPieceId, idempotencyKey: input.idempotencyKey,
  });
  return `replacement-${digest}`;
}

async function replacePlate(env, input, row, keeperPieceId, authorization, fingerprint) {
  if (!registryPlateCryptoConfigured(env)) {
    return response({ ok: false, error: 'ownership_code_crypto_not_configured' }, 503);
  }
  if (row.plate_status !== 'active') {
    return response({ ok: false, error: 'plate_not_active' }, 409);
  }
  const generatedAt = new Date().toISOString();
  const eventId = `rme-${crypto.randomUUID()}`;
  const issuanceKey = await replacementIssuanceKey(input, keeperPieceId);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let candidate;
    let oldLineage;
    try {
      candidate = await createRegistryPlateCandidate(env, {
        pieceId: row.piece_id,
        editionNumber: row.edition_number,
        issuanceKey,
        generatedAt,
      });
      oldLineage = await prepareNextLineageEvent(env, {
        keeperPieceId, eventType: 'superseded', eventAt: generatedAt,
        publicPayload: { plateStatus: 'superseded' }, onlyIfPreviousChanged: true,
      });
    } catch {
      return response({ ok: false, error: 'maintenance_write_failed' }, 503);
    }
    const before = {
      keeperPieceId, artworkId: row.piece_id, publicCode: row.public_code,
      plateStatus: 'active', supersedesKeeperPieceId: row.supersedes_keeper_piece_id ?? null,
      supersededByKeeperPieceId: null, replacedAt: row.replaced_at ?? null,
      recordVersion: row.record_version,
    };
    const after = {
      keeperPieceId: candidate.id, artworkId: row.piece_id, publicCode: candidate.publicCode,
      plateStatus: 'generated', supersedesKeeperPieceId: keeperPieceId,
      supersededByKeeperPieceId: null, replacedAt: generatedAt, recordVersion: 0,
    };
    const mutation = env.DB.prepare(
      `UPDATE keeper_pieces
          SET plate_status = 'superseded', superseded_by_keeper_piece_id = ?1,
              physical_disposition = ?2, replaced_at = ?3,
              record_version = record_version + 1
        WHERE id = ?4 AND record_version = ?5 AND piece_id IS ?6
          AND edition_number IS ?7 AND plate_status = 'active'
          AND superseded_by_keeper_piece_id IS NULL`,
    ).bind(
      candidate.id, input.physicalDisposition, generatedAt, keeperPieceId,
      input.expectedRecordVersion, row.piece_id, row.edition_number,
    );
    const event = buildMaintenanceEventStatement(env, eventDetails({
      input, keeperPieceId, artworkId: row.piece_id, authorization, before, after,
      eventType: 'plate_replaced', relatedRecordId: candidate.id,
      createdAt: generatedAt, fingerprint, eventId,
    }));
    const statements = [
      mutation,
      event,
      registryPlateInsertStatement(env, candidate, {
        supersedesKeeperPieceId: keeperPieceId,
        onlyIfPreviousChanged: true,
      }),
      oldLineage.statement,
      oldLineage.anchorStatement,
      lineageStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
      lineageAnchorStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
    ];
    try {
      const results = await env.DB.batch(statements);
      if (!batchSucceeded(results, statements.length)) {
        return response({ ok: false, error: 'version_conflict' }, 409);
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (/public_code/i.test(message) && /unique/i.test(message)) continue;
      if (/unique/i.test(message)) return response({ ok: false, error: 'link_collision' }, 409);
      return response({ ok: false, error: 'maintenance_write_failed' }, 503);
    }

    const replacementRow = {
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
    const backup = await backupRegistryPlate(env, replacementRow);
    return response({
      ok: true,
      replayed: false,
      eventId,
      replacement: {
        ok: true,
        ownershipCode: candidate.ownershipCode,
        ...candidate.plate,
        generatedAt,
        backupStatus: backup.status,
        ...(backup.warning ? { warning: backup.warning } : {}),
      },
    }, 201);
  }
  return response({ ok: false, error: 'public_code_collision' }, 503);
}

export async function handleRegistryPlateLifecycle({ body, env, keeperPieceId, authorization }) {
  const input = normalizeBase(body);
  if (input.error) return response({ ok: false, error: input.error }, statusFor(input.error));
  if (body.action === 'correct_link') {
    input.artworkId = normalizeArtworkId(body.artworkId);
    input.editionNumber = body.editionNumber;
    input.physicalEngravingMatches = body.physicalEngravingMatches;
    if (!input.artworkId || !Number.isSafeInteger(input.editionNumber)
      || input.editionNumber < 0 || input.editionNumber > 9999) {
      return response({ ok: false, error: 'invalid_input' }, 400);
    }
  } else {
    input.physicalDisposition = normalizeDisposition(body.physicalDisposition);
    if (!input.physicalDisposition) {
      return response({ ok: false, error: 'invalid_physical_disposition' }, 400);
    }
  }

  let fingerprint;
  let existing;
  try {
    fingerprint = await requestFingerprint(input, keeperPieceId, authorization);
    existing = await findMaintenanceEventByIdempotencyKey(env, input.idempotencyKey);
    const replay = await exactReplay(env, existing, input, keeperPieceId, authorization);
    if (replay) return replay;
  } catch {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }

  let row;
  try {
    row = await env.DB.prepare('SELECT * FROM keeper_pieces WHERE id = ?1')
      .bind(keeperPieceId).first();
  } catch {
    return response({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  if (!row) return response({ ok: false, error: 'not_found' }, 404);
  if (row.record_version !== input.expectedRecordVersion) {
    return response({ ok: false, error: 'version_conflict' }, 409);
  }

  const result = input.action === 'correct_link'
    ? await correctLink(env, input, row, keeperPieceId, authorization, fingerprint)
    : input.action === 'void_plate'
      ? await voidPlate(env, input, row, keeperPieceId, authorization, fingerprint)
      : await replacePlate(env, input, row, keeperPieceId, authorization, fingerprint);
  if (!result.body?.ok) {
    try {
      const raced = await findMaintenanceEventByIdempotencyKey(env, input.idempotencyKey);
      const replay = await exactReplay(env, raced, input, keeperPieceId, authorization);
      if (replay) return replay;
    } catch {
      // Preserve the safe operation error when replay classification is unavailable.
    }
  }
  return result;
}
