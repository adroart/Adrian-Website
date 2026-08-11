import {
  constantTimeEqual,
  jsonResponse,
  registryStepUpSecret,
  requireDb,
  requireRegistryUnlock,
} from '../../../_lib/admin.js';
import {
  commitMaintenanceMutation,
  findMaintenanceEventByIdempotencyKey,
  matchesMaintenanceMutationFingerprint,
  normalizeReason,
  projectMaintenanceHistorySnapshots,
} from '../../../_lib/registryMaintenance.js';
import { handleRegistryPlateLifecycle } from '../../../_lib/registryPlateLifecycle.js';
import { prepareNextLineageEvent } from '../../../_lib/lineage.js';
import { syncTransferCollectorLetters } from '../../../_lib/collectorLetters.js';

const REQUEST_FIELDS = new Set([
  'action', 'targetEmail', 'transferKind', 'reason', 'idempotencyKey', 'expectedStewardVersion',
]);
// A sale transfer changes custody only. Verified sale facts and price history stay in collector sales.
const TRANSFER_KINDS = new Set(['sale', 'gift', 'inheritance', 'artist-rebind']);
const STEWARD_FIELDS = [
  'keeperUserId', 'claimedAt', 'releasedAt', 'currentDisplayLocation',
];
const SNAPSHOT_FIELDS = new Set([
  'keeperPieceId', 'artworkId', ...STEWARD_FIELDS, 'stewardVersion',
]);

function snapshot(row) {
  return {
    keeperPieceId: row.id,
    artworkId: row.piece_id,
    keeperUserId: row.keeper_user_id ?? null,
    claimedAt: row.claimed_at ?? null,
    releasedAt: row.released_at ?? null,
    currentDisplayLocation: row.current_display_location ?? null,
    stewardVersion: row.steward_version,
  };
}

function hasExactSnapshotShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== SNAPSHOT_FIELDS.size || keys.some((key) => !SNAPSHOT_FIELDS.has(key))) {
    return false;
  }
  return typeof value.keeperPieceId === 'string'
    && typeof value.artworkId === 'string'
    && Number.isSafeInteger(value.stewardVersion)
    && STEWARD_FIELDS.every((field) => value[field] === null || typeof value[field] === 'string');
}

function validStoredClaimTime(value) {
  if (typeof value !== 'string' || !value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

async function transferRequestCommitment(env, {
  keeperPieceId,
  targetEmail,
  transferKind,
  expectedVersion,
}) {
  const secret = registryStepUpSecret(env);
  if (!secret) throw new Error('registry_unlock_not_configured');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const requestIdentity = JSON.stringify([
    'adrian-website:ownership-transfer-request:v1',
    keeperPieceId,
    targetEmail,
    transferKind,
    expectedVersion,
  ]);
  const signature = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(requestIdentity),
  ));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function exactReplay(existing, {
  action,
  keeperPieceId,
  artworkId,
  targetEmailCommitment,
  authorization,
  reason,
  idempotencyKey,
  expectedVersion,
  transferKind,
  env,
}) {
  if (!existing) return null;
  const eventType = 'steward_transferred';
  if (existing.idempotency_key !== idempotencyKey
    || existing.event_type !== eventType
    || existing.keeper_piece_id !== keeperPieceId
    || existing.artwork_id !== artworkId
    || existing.related_record_id !== keeperPieceId
    || existing.administrator_user_id !== authorization.userId
    || existing.administrator_email !== authorization.email
    || existing.reason !== reason
    || existing.outcome !== 'succeeded') {
    return { ok: false, error: 'idempotency_conflict' };
  }

  const snapshots = projectMaintenanceHistorySnapshots(
    eventType,
    existing.before_json,
    existing.after_json,
  );
  if (snapshots.warning
    || !hasExactSnapshotShape(snapshots.before)
    || !hasExactSnapshotShape(snapshots.after)) {
    return { ok: false, error: 'maintenance_write_failed' };
  }
  const { before, after } = snapshots;
  if (before.keeperPieceId !== keeperPieceId
    || before.artworkId !== artworkId
    || before.stewardVersion !== expectedVersion
    || after.keeperPieceId !== keeperPieceId
    || after.artworkId !== artworkId
    || after.stewardVersion !== expectedVersion + 1) {
    return { ok: false, error: 'idempotency_conflict' };
  }
  const intent = await env.DB.prepare(
    `SELECT id, target_user_id, target_email_commitment, transfer_kind
       FROM artwork_transfer_intents WHERE maintenance_event_id = ?1`,
  ).bind(existing.id).first();
  if (!intent
    || intent.transfer_kind !== transferKind
    || typeof intent.target_user_id !== 'string'
    || !intent.target_user_id
    || !constantTimeEqual(intent.target_email_commitment, targetEmailCommitment)) {
    return { ok: false, error: 'idempotency_conflict' };
  }
  const targetUserId = intent.target_user_id;
  if (after.keeperUserId !== targetUserId
    || !validStoredClaimTime(after.claimedAt)
    || after.releasedAt !== null
    || after.currentDisplayLocation !== null) {
    return { ok: false, error: 'idempotency_conflict' };
  }

  const changes = Object.fromEntries(STEWARD_FIELDS.map((field) => [field, after[field]]));
  const fingerprintMatches = await matchesMaintenanceMutationFingerprint(existing, {
    target: { type: 'keeper_steward', id: keeperPieceId, artworkId },
    changes,
    event: {
      eventType,
      keeperPieceId,
      artworkId,
      authorization,
      reason,
      before,
      after,
      outcome: 'succeeded',
      relatedRecordId: keeperPieceId,
    },
    expectedVersion,
  });
  if (!fingerprintMatches) return { ok: false, error: 'idempotency_conflict' };
  await syncTransferCollectorLetters(env, { transferIntentId: intent.id });
  return { ok: true, replayed: true, eventId: existing.id, steward: after };
}

function statusFor(error) {
  if ([
    'idempotency_conflict', 'version_conflict', 'target_unverified',
    'target_ambiguous', 'target_is_current_steward', 'no_current_steward',
  ].includes(error)) return 409;
  if (error === 'not_found' || error === 'target_not_found') return 404;
  if (error === 'maintenance_write_failed' || error === 'atomic_write_unavailable') return 503;
  return 400;
}

async function resolveTransferTarget(env, targetEmail) {
  try {
    const query = await env.DB.prepare(
      `SELECT id, emailVerified
         FROM user
        WHERE lower(email) = ?1
        LIMIT 2`,
    ).bind(targetEmail).all();
    const rows = Array.isArray(query?.results) ? query.results : [];
    if (rows.length === 0) return { ok: false, error: 'target_not_found' };
    if (rows.length > 1) return { ok: false, error: 'target_ambiguous' };
    const row = rows[0];
    if (row.emailVerified !== 1 && row.emailVerified !== true) {
      return { ok: false, error: 'target_unverified' };
    }
    if (typeof row.id !== 'string' || !row.id.trim() || row.id.trim().length > 128) {
      return { ok: false, error: 'maintenance_write_failed' };
    }
    return { ok: true, userId: row.id.trim() };
  } catch {
    return { ok: false, error: 'maintenance_write_failed' };
  }
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
  if (body && typeof body === 'object' && !Array.isArray(body)
    && ['correct_link', 'void_plate', 'replace_plate'].includes(body.action)) {
    const result = await handleRegistryPlateLifecycle({
      body, env, keeperPieceId, authorization,
    });
    return jsonResponse(result.body, result.status);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !REQUEST_FIELDS.has(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }
  if (body.action !== 'transfer_steward') {
    return jsonResponse({ ok: false, error: 'invalid_action' }, 400);
  }
  if (!Number.isSafeInteger(body.expectedStewardVersion) || body.expectedStewardVersion < 0) {
    return jsonResponse({ ok: false, error: 'invalid_expected_steward_version' }, 400);
  }
  const reason = normalizeReason(body.reason);
  if (!reason.ok) return jsonResponse({ ok: false, error: reason.error }, 400);
  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return jsonResponse({ ok: false, error: 'invalid_idempotency_key' }, 400);
  }

  const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLowerCase() : '';
  if (!targetEmail) {
    return jsonResponse({ ok: false, error: 'target_email_required' }, 400);
  }
  if (targetEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return jsonResponse({ ok: false, error: 'invalid_target_email' }, 400);
  }
  const transferKind = typeof body.transferKind === 'string' ? body.transferKind : '';
  if (!TRANSFER_KINDS.has(transferKind)) {
    return jsonResponse({ ok: false, error: 'invalid_transfer_kind' }, 400);
  }
  let targetEmailCommitment;
  try {
    targetEmailCommitment = await transferRequestCommitment(env, {
      keeperPieceId,
      targetEmail,
      transferKind,
      expectedVersion: body.expectedStewardVersion,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
  }

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT id, piece_id, keeper_user_id, claimed_at, released_at,
              current_display_location, steward_version
         FROM keeper_pieces
        WHERE id = ?1`,
    ).bind(keeperPieceId).first();
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  const before = snapshot(row);

  let existingEvent;
  try {
    existingEvent = await findMaintenanceEventByIdempotencyKey(env, idempotencyKey);
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  const replayInput = {
    action: body.action,
    keeperPieceId,
    artworkId: before.artworkId,
    targetEmailCommitment,
    authorization,
    reason: reason.reason,
    idempotencyKey,
    expectedVersion: body.expectedStewardVersion,
    transferKind,
    env,
  };
  const replay = await exactReplay(existingEvent, replayInput);
  if (replay) return jsonResponse(replay, replay.ok ? 200 : statusFor(replay.error));

  const target = await resolveTransferTarget(env, targetEmail);
  if (!target.ok) return jsonResponse(target, statusFor(target.error));
  const targetUserId = target.userId;

  if (before.stewardVersion !== body.expectedStewardVersion) {
    return jsonResponse({ ok: false, error: 'version_conflict' }, 409);
  }
  if (!before.keeperUserId || !before.claimedAt) {
    return jsonResponse({ ok: false, error: 'no_current_steward' }, 409);
  }
  if (before.keeperUserId === targetUserId) {
    return jsonResponse({ ok: false, error: 'target_is_current_steward' }, 409);
  }

  const eventType = 'steward_transferred';
  const transferAt = new Date().toISOString();
  const changes = {
    keeperUserId: targetUserId,
    claimedAt: transferAt,
    releasedAt: null,
    currentDisplayLocation: null,
  };
  const after = {
    keeperPieceId,
    artworkId: before.artworkId,
    ...changes,
    stewardVersion: body.expectedStewardVersion + 1,
  };
  const maintenanceEventId = `rme-${crypto.randomUUID()}`;
  const transferIntentId = `transfer-${crypto.randomUUID()}`;
  const fromRef = `tp-${crypto.randomUUID()}`;
  const toRef = `tp-${crypto.randomUUID()}`;
  let lineage;
  try {
    lineage = await prepareNextLineageEvent(env, {
      keeperPieceId,
      eventType: 'transferred',
      eventAt: transferAt,
      publicPayload: { fromRef, toRef, transferKind },
      onlyIfPreviousChanged: true,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
  }
  const intentStatement = env.DB.prepare(
    `INSERT INTO artwork_transfer_intents
       (id, keeper_piece_id, expected_from_user_id, target_user_id, target_email_commitment,
        expected_steward_version, expected_lineage_count, expected_lineage_hash,
        transfer_kind, maintenance_event_id, lineage_event_id, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE EXISTS (
        SELECT 1 FROM keeper_pieces
         WHERE id = ?2 AND keeper_user_id = ?3 AND claimed_at = ?13
           AND steward_version = ?6 AND lineage_event_count = ?7
           AND lineage_head_hash IS ?8
      )`,
  ).bind(
    transferIntentId, keeperPieceId, before.keeperUserId, targetUserId,
    targetEmailCommitment, body.expectedStewardVersion, lineage.event.sequence - 1,
    lineage.event.previousHash, transferKind, maintenanceEventId, lineage.event.id,
    transferAt, before.claimedAt,
  );
  const partyStatement = (role, userId, publicRef) => env.DB.prepare(
    `INSERT INTO artwork_transfer_parties
       (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE EXISTS (SELECT 1 FROM artwork_transfer_intents WHERE id = ?2)`,
  ).bind(`party-${crypto.randomUUID()}`, transferIntentId, role, userId, publicRef, transferAt);
  const receiptStatement = env.DB.prepare(
    `INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
     VALUES (?1, ?2, ?3)`,
  ).bind(`receipt-${crypto.randomUUID()}`, transferIntentId, transferAt);
  const result = await commitMaintenanceMutation(env, {
    target: { type: 'keeper_steward', id: keeperPieceId, artworkId: before.artworkId },
    changes,
    event: {
      idempotencyKey,
      id: maintenanceEventId,
      eventType,
      keeperPieceId,
      artworkId: before.artworkId,
      authorization,
      reason: reason.reason,
      before,
      after,
      outcome: 'succeeded',
      relatedRecordId: keeperPieceId,
      createdAt: changes.claimedAt ?? new Date().toISOString(),
    },
    expectedVersion: body.expectedStewardVersion,
    beforeStatements: [
      intentStatement,
      partyStatement('from', before.keeperUserId, fromRef),
      partyStatement('to', targetUserId, toRef),
    ],
    afterStatements: [lineage.statement],
    gatewayStatement: receiptStatement,
  });
  if (!result.ok) {
    try {
      const racedEvent = await findMaintenanceEventByIdempotencyKey(env, idempotencyKey);
      const racedReplay = await exactReplay(racedEvent, replayInput);
      if (racedReplay) {
        return jsonResponse(racedReplay, racedReplay.ok ? 200 : statusFor(racedReplay.error));
      }
    } catch {
      // Preserve the safe mutation failure below.
    }
    return jsonResponse(result, statusFor(result.error));
  }
  if (result.replayed && result.event) {
    const storedReplay = await exactReplay(result.event, replayInput);
    if (!storedReplay?.ok) {
      return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
    }
    return jsonResponse(storedReplay);
  }
  await syncTransferCollectorLetters(env, { transferIntentId });
  return jsonResponse({ ok: true, replayed: false, eventId: result.eventId, steward: after });
}
