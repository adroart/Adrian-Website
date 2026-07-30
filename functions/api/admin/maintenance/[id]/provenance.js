import { jsonResponse, requireDb, requireRegistryUnlock } from '../../../_lib/admin.js';
import {
  canonicalMaintenanceJson,
  commitMaintenanceMutation,
  commitProvenanceCreate,
  findMaintenanceEventByIdempotencyKey,
  matchesMaintenanceMutationFingerprint,
  normalizeProvenanceInput,
  normalizeReason,
  projectMaintenanceHistorySnapshots,
} from '../../../_lib/registryMaintenance.js';

const BODY_FIELDS = new Set([
  'action', 'provenanceId', 'expectedVersion', 'entry', 'reason', 'idempotencyKey',
]);
const CONTENT_FIELDS = [
  'entryType', 'title', 'detail', 'role', 'occurredAt', 'visibility',
];

function snapshot(row, { includeCreatedAt = true } = {}) {
  return {
    provenanceId: row.id,
    keeperPieceId: row.keeper_piece_id,
    entryType: row.entry_type,
    title: row.title,
    detail: row.detail ?? null,
    role: row.role ?? null,
    occurredAt: row.occurred_at ?? null,
    visibility: row.visibility,
    recordVersion: row.record_version,
    ...(includeCreatedAt ? { createdAt: row.created_at } : {}),
    updatedAt: row.updated_at,
    removedAt: row.removed_at ?? null,
  };
}

function statusFor(error) {
  if (['idempotency_conflict', 'version_conflict', 'provenance_removed'].includes(error)) return 409;
  if (error === 'not_found' || error === 'keeper_piece_not_found') return 404;
  if (error === 'maintenance_write_failed' || error === 'atomic_write_unavailable') return 503;
  return 400;
}

function sameContent(snapshotValue, entry) {
  return canonicalMaintenanceJson(
    Object.fromEntries(CONTENT_FIELDS.map((field) => [field, snapshotValue[field]])),
  ) === canonicalMaintenanceJson(entry);
}

async function exactReplay(existing, {
  action,
  keeperPieceId,
  provenanceId,
  authorization,
  reason,
  expectedVersion,
  entry,
}) {
  if (!existing) return null;
  const eventType = action === 'correct' ? 'provenance_corrected' : 'provenance_removed';
  if (existing.event_type !== eventType
    || existing.keeper_piece_id !== keeperPieceId
    || existing.artwork_id != null
    || existing.related_record_id !== provenanceId
    || existing.administrator_user_id !== authorization.userId
    || existing.administrator_email !== authorization.email
    || existing.reason !== reason
    || existing.outcome !== 'succeeded') {
    return { ok: false, error: 'idempotency_conflict' };
  }
  const snapshots = projectMaintenanceHistorySnapshots(
    eventType, existing.before_json, existing.after_json,
  );
  if (snapshots.warning || !snapshots.before || !snapshots.after) {
    return { ok: false, error: 'maintenance_write_failed' };
  }
  const { before, after } = snapshots;
  if (before.provenanceId !== provenanceId
    || before.keeperPieceId !== keeperPieceId
    || before.recordVersion !== expectedVersion
    || after.provenanceId !== provenanceId
    || after.keeperPieceId !== keeperPieceId
    || after.recordVersion !== expectedVersion + 1) {
    return { ok: false, error: 'idempotency_conflict' };
  }
  const changes = action === 'correct'
    ? {
        ...Object.fromEntries(CONTENT_FIELDS.map((field) => [field, after[field]])),
        updatedAt: after.updatedAt,
        removedAt: null,
      }
    : { updatedAt: after.updatedAt, removedAt: after.removedAt };
  if (action === 'correct') {
    if (after.removedAt !== null || !sameContent(after, entry)) {
      return { ok: false, error: 'idempotency_conflict' };
    }
  } else if (typeof after.removedAt !== 'string'
    || Number.isNaN(new Date(after.removedAt).getTime())) {
    return { ok: false, error: 'maintenance_write_failed' };
  }
  const matches = await matchesMaintenanceMutationFingerprint(existing, {
    target: { type: 'provenance', id: provenanceId, keeperPieceId },
    changes,
    event: {
      eventType,
      keeperPieceId,
      artworkId: null,
      outcome: 'succeeded',
      relatedRecordId: provenanceId,
      before,
      after,
    },
    expectedVersion,
  });
  if (!matches) return { ok: false, error: 'idempotency_conflict' };
  return {
    ok: true,
    replayed: true,
    eventId: existing.id,
    provenance: after,
  };
}

export async function onRequest({ request, env, params }) {
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const keeperPieceId = typeof params?.id === 'string' ? params.id.trim() : '';
  if (!keeperPieceId || keeperPieceId.length > 128) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !BODY_FIELDS.has(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }
  if (!['create', 'correct', 'remove'].includes(body.action)) {
    return jsonResponse({ ok: false, error: 'invalid_action' }, 400);
  }
  const normalizedReason = normalizeReason(body.reason);
  if (!normalizedReason.ok) {
    return jsonResponse({ ok: false, error: normalizedReason.error }, 400);
  }
  if (body.action === 'create') {
    if (Object.hasOwn(body, 'provenanceId') || Object.hasOwn(body, 'expectedVersion')) {
      return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
    }
    const result = await commitProvenanceCreate(env, {
      keeperPieceId,
      provenance: body.entry,
      authorization,
      reason: normalizedReason.reason,
      idempotencyKey: body.idempotencyKey,
    });
    return jsonResponse(result, result.ok ? (result.replayed ? 200 : 201) : statusFor(result.error));
  }

  if (body.action === 'remove' && Object.hasOwn(body, 'entry')) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) {
    return jsonResponse({ ok: false, error: 'invalid_expected_version' }, 400);
  }
  const provenanceId = typeof body.provenanceId === 'string' ? body.provenanceId.trim() : '';
  if (!provenanceId || provenanceId.length > 128) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }
  const normalizedEntry = body.action === 'correct'
    ? normalizeProvenanceInput(body.entry)
    : { ok: true, provenance: null };
  if (!normalizedEntry.ok) {
    return jsonResponse({ ok: false, error: normalizedEntry.error }, 400);
  }

  let existingEvent;
  try {
    existingEvent = await findMaintenanceEventByIdempotencyKey(env, body.idempotencyKey);
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_idempotency_key' }, 400);
  }
  const replayInput = {
    action: body.action,
    keeperPieceId,
    provenanceId,
    authorization,
    reason: normalizedReason.reason,
    expectedVersion: body.expectedVersion,
    entry: normalizedEntry.provenance,
  };
  const replay = await exactReplay(existingEvent, replayInput);
  if (replay) return jsonResponse(replay, replay.ok ? 200 : statusFor(replay.error));

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT id, keeper_piece_id, entry_type, title, detail, role, occurred_at,
              visibility, record_version, created_at, updated_at, removed_at
         FROM artwork_provenance_entries
        WHERE id = ?1 AND keeper_piece_id = ?2`,
    ).bind(provenanceId, keeperPieceId).first();
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  if (row.record_version !== body.expectedVersion) {
    return jsonResponse({ ok: false, error: 'version_conflict' }, 409);
  }
  if (row.removed_at !== null) {
    return jsonResponse({ ok: false, error: 'provenance_removed' }, 409);
  }

  const current = snapshot(row, { includeCreatedAt: false });
  const before = body.action === 'correct'
    ? current
    : {
        provenanceId,
        keeperPieceId,
        recordVersion: current.recordVersion,
        updatedAt: current.updatedAt,
        removedAt: current.removedAt,
      };
  const updatedAt = new Date().toISOString();
  const changes = body.action === 'correct'
    ? { ...normalizedEntry.provenance, updatedAt, removedAt: null }
    : { updatedAt, removedAt: updatedAt };
  const after = {
    ...before,
    ...changes,
    recordVersion: body.expectedVersion + 1,
  };
  const eventType = body.action === 'correct' ? 'provenance_corrected' : 'provenance_removed';
  const result = await commitMaintenanceMutation(env, {
    target: { type: 'provenance', id: provenanceId, keeperPieceId },
    changes,
    event: {
      idempotencyKey: body.idempotencyKey,
      eventType,
      keeperPieceId,
      artworkId: null,
      authorization,
      reason: normalizedReason.reason,
      before,
      after,
      outcome: 'succeeded',
      relatedRecordId: provenanceId,
      createdAt: updatedAt,
    },
    expectedVersion: body.expectedVersion,
  });
  if (!result.ok) {
    try {
      const racedEvent = await findMaintenanceEventByIdempotencyKey(env, body.idempotencyKey);
      const racedReplay = await exactReplay(racedEvent, replayInput);
      if (racedReplay) {
        return jsonResponse(racedReplay, racedReplay.ok ? 200 : statusFor(racedReplay.error));
      }
    } catch {
      // Preserve the safe mutation failure.
    }
    return jsonResponse(result, statusFor(result.error));
  }
  return jsonResponse({ ok: true, replayed: false, eventId: result.eventId, provenance: after });
}
