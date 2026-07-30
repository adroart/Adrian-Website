import { jsonResponse, requireDb, requireRegistryUnlock } from '../../../../_lib/admin.js';
import {
  canonicalMaintenanceJson,
  commitMaintenanceMutation,
  findMaintenanceEventByIdempotencyKey,
  normalizeAcquisitionInput,
  normalizeReason,
  projectMaintenanceHistorySnapshots,
} from '../../../../_lib/registryMaintenance.js';

const ACQUISITION_FIELDS = [
  'acquisitionType', 'acquiredAt', 'amountMinor', 'currency', 'acquirerReference',
  'privateNotes', 'documentReference', 'publicProvenance',
];

function snapshot(row) {
  return {
    acquisitionId: row.id,
    keeperPieceId: row.keeper_piece_id,
    acquisitionType: row.acquisition_type,
    acquiredAt: row.acquired_at ?? null,
    amountMinor: row.amount_minor ?? null,
    currency: row.currency ?? null,
    acquirerReference: row.acquirer_reference ?? null,
    privateNotes: row.private_notes ?? null,
    documentReference: row.document_reference ?? null,
    publicProvenance: row.public_provenance ?? null,
    recordVersion: row.record_version,
    updatedAt: row.updated_at,
  };
}

function exactReplay(existing, {
  keeperPieceId,
  acquisitionId,
  authorization,
  reason,
  expectedVersion,
  acquisition,
}) {
  if (!existing) return null;
  if (existing.event_type !== 'acquisition_corrected'
    || existing.keeper_piece_id !== keeperPieceId
    || existing.artwork_id != null
    || existing.related_record_id !== acquisitionId
    || existing.administrator_user_id !== authorization.userId
    || existing.administrator_email !== authorization.email
    || existing.reason !== reason
    || existing.outcome !== 'succeeded') {
    return { ok: false, error: 'idempotency_conflict' };
  }
  try {
    const snapshots = projectMaintenanceHistorySnapshots(
      'acquisition_corrected',
      existing.before_json,
      existing.after_json,
    );
    if (snapshots.warning || !snapshots.before || !snapshots.after) {
      return { ok: false, error: 'maintenance_write_failed' };
    }
    const { before, after } = snapshots;
    const expectedAfter = Object.fromEntries(ACQUISITION_FIELDS.map((field) => [field, acquisition[field]]));
    const storedAfter = Object.fromEntries(ACQUISITION_FIELDS.map((field) => [field, after[field]]));
    if (before.recordVersion !== expectedVersion
      || before.acquisitionId !== acquisitionId
      || before.keeperPieceId !== keeperPieceId
      || after.recordVersion !== expectedVersion + 1
      || after.acquisitionId !== acquisitionId
      || after.keeperPieceId !== keeperPieceId
      || canonicalMaintenanceJson(storedAfter) !== canonicalMaintenanceJson(expectedAfter)) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return { ok: true, replayed: true, eventId: existing.id, acquisition: after };
  } catch {
    return { ok: false, error: 'maintenance_write_failed' };
  }
}

function statusFor(error) {
  if (error === 'idempotency_conflict' || error === 'version_conflict') return 409;
  if (error === 'not_found') return 404;
  if (error === 'maintenance_write_failed' || error === 'atomic_write_unavailable') return 503;
  return 400;
}

export async function onRequest({ request, env, params }) {
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  if (request.method !== 'PUT') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'PUT' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const keeperPieceId = typeof params?.id === 'string' ? params.id.trim() : '';
  const acquisitionId = typeof params?.acquisitionId === 'string'
    ? params.acquisitionId.trim()
    : '';
  if (!keeperPieceId || keeperPieceId.length > 128 || !acquisitionId || acquisitionId.length > 128) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => ![
      'idempotencyKey', 'reason', 'expectedVersion', 'acquisition',
    ].includes(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) {
    return jsonResponse({ ok: false, error: 'invalid_expected_version' }, 400);
  }
  const normalized = normalizeAcquisitionInput(body.acquisition);
  if (!normalized.ok) return jsonResponse({ ok: false, error: normalized.error }, 400);
  const normalizedReason = normalizeReason(body.reason);
  if (!normalizedReason.ok) return jsonResponse({ ok: false, error: normalizedReason.error }, 400);

  let existingEvent;
  try {
    existingEvent = await findMaintenanceEventByIdempotencyKey(env, body.idempotencyKey);
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_idempotency_key' }, 400);
  }
  const replay = exactReplay(existingEvent, {
    keeperPieceId,
    acquisitionId,
    authorization,
    reason: normalizedReason.reason,
    expectedVersion: body.expectedVersion,
    acquisition: normalized.acquisition,
  });
  if (replay) return jsonResponse(replay, replay.ok ? 200 : statusFor(replay.error));

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
              currency, acquirer_reference, private_notes, document_reference,
              public_provenance, record_version, updated_at
         FROM artwork_acquisitions
        WHERE id = ?1 AND keeper_piece_id = ?2`,
    ).bind(acquisitionId, keeperPieceId).first();
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  if (row.record_version !== body.expectedVersion) {
    return jsonResponse({ ok: false, error: 'version_conflict' }, 409);
  }

  const before = snapshot(row);
  const updatedAt = new Date().toISOString();
  const after = {
    acquisitionId,
    keeperPieceId,
    ...normalized.acquisition,
    recordVersion: body.expectedVersion + 1,
    updatedAt,
  };
  const changes = { ...normalized.acquisition, updatedAt };
  const result = await commitMaintenanceMutation(env, {
    target: { type: 'acquisition', id: acquisitionId, keeperPieceId },
    changes,
    event: {
      idempotencyKey: body.idempotencyKey,
      eventType: 'acquisition_corrected',
      keeperPieceId,
      artworkId: null,
      authorization,
      reason: normalizedReason.reason,
      before,
      after,
      outcome: 'succeeded',
      relatedRecordId: acquisitionId,
      createdAt: updatedAt,
    },
    expectedVersion: body.expectedVersion,
  });
  if (!result.ok) {
    try {
      const racedEvent = await findMaintenanceEventByIdempotencyKey(env, body.idempotencyKey);
      const racedReplay = exactReplay(racedEvent, {
        keeperPieceId,
        acquisitionId,
        authorization,
        reason: normalizedReason.reason,
        expectedVersion: body.expectedVersion,
        acquisition: normalized.acquisition,
      });
      if (racedReplay) {
        return jsonResponse(racedReplay, racedReplay.ok ? 200 : statusFor(racedReplay.error));
      }
    } catch {
      // Preserve the safe mutation failure below.
    }
    return jsonResponse(result, statusFor(result.error));
  }
  if (result.replayed && result.event?.after_json) {
    const storedReplay = exactReplay(result.event, {
      keeperPieceId,
      acquisitionId,
      authorization,
      reason: normalizedReason.reason,
      expectedVersion: body.expectedVersion,
      acquisition: normalized.acquisition,
    });
    if (!storedReplay?.ok) {
      return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
    }
    return jsonResponse(storedReplay);
  }
  return jsonResponse({ ok: true, replayed: false, eventId: result.eventId, acquisition: after });
}
