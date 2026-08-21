/**
 * /api/admin/shine-removals — the audited abuse-management removal action.
 *
 * While the artist is alive he can remove abusive collector content from
 * display AFTER it has already shone. This is never a gate before
 * publication: nothing here can prevent a piece of content from shining in
 * the first place, only remove it from view once it has.
 *
 * POST records one removal (migration 041, collector_shine_removals) against
 * a shone collector_dreams row, and writes a registry_maintenance_events
 * audit row (event_type 'shine_removal') in the house append-only shape
 * (migration 017 / _lib/registryMaintenance.js): idempotency_key, before/
 * after JSON, a mutation fingerprint. The affected piece's permanent Piece
 * Record is then regenerated on demand (_lib/pieceRecord.js, trigger
 * 'on_demand'), fail-soft: a record-regeneration failure never fails the
 * removal itself and is reported as its own outcome.
 *
 * A removal is permanent -- restoring shone content is not a thing; the
 * piece did not un-happen, it stopped shining (the one exception to
 * once-shone-stays-shone). Both the removal row's UNIQUE(content_id) and its
 * idempotency key make a retried request a clean replay, never a duplicate.
 *
 * GET lists the removals recorded for one piece.
 *
 * Guarded like every registry-wide admin write: admin session for reads,
 * plus the registry step-up unlock for the write (mirrors maintenance.js and
 * admin/records/rebuild.js).
 */
import {
  jsonResponse, requireAdmin, requireDb, requireRegistryUnlock,
} from '../_lib/admin.js';
import { isMissingTableError, legacyEnabled, migrationNotApplied } from '../_lib/keeper.js';
import {
  MAINTENANCE_IDEMPOTENCY_KEY_MAX,
  canonicalMaintenanceJson,
  maintenanceMutationFingerprint,
  normalizeReason,
} from '../_lib/registryMaintenance.js';
import { refreshPieceRecord } from '../_lib/pieceRecordRefresh.js';

const EVENT_TYPE = 'shine_removal';

function normalizedId(value, max = 128) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= max ? text : null;
}

function serializeRemoval(row) {
  return {
    id: row.id,
    contentId: row.content_id,
    keeperPieceId: row.keeper_piece_id,
    removedReason: row.removed_reason,
    removedByUserId: row.removed_by_user_id,
    removedAt: row.removed_at,
  };
}

/**
 * Regenerate the Piece Record for one keeper piece with trigger_event
 * 'on_demand', through the shared refresh helper (_lib/pieceRecordRefresh.js).
 *
 * This used to carry its own copy of the compare step, and that copy was
 * bugged: it only ever compared previous.record_hash === built.recordHash.
 * Because generatedAt sits inside the hashed record, that equality is
 * essentially never true across two calls made at different times, so every
 * shine removal churned a new record file even when nothing substantive had
 * changed. The shared helper carries the same substantive-comparison
 * fallback admin/records/rebuild.js always had (ignoring generatedAt and
 * trigger), which is the fix.
 */
async function regenerateOne(env, keeperPieceId, generatedAt) {
  return refreshPieceRecord(env, {
    keeperPieceId, trigger: 'on_demand', generatedAt, includeLegacySections: legacyEnabled(),
  });
}

async function handleGet(request, env) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const keeperPieceId = normalizedId(new URL(request.url).searchParams.get('keeperPieceId'));
  if (!keeperPieceId) return jsonResponse({ ok: false, error: 'invalid_keeper_piece_id' }, 400);

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, content_id, keeper_piece_id, removed_reason, removed_by_user_id, removed_at
         FROM collector_shine_removals
        WHERE keeper_piece_id = ?1
        ORDER BY removed_at ASC, id ASC`,
    ).bind(keeperPieceId).all();
    return jsonResponse({
      ok: true,
      keeperPieceId,
      removals: (results || []).map(serializeRemoval),
    });
  } catch (error) {
    if (isMissingTableError(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'shine_removals_list_failed' }, 500);
  }
}

async function handlePost(request, env) {
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const allowedFields = new Set(['contentId', 'keeperPieceId', 'reason', 'idempotencyKey']);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !allowedFields.has(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }
  const contentId = normalizedId(body.contentId);
  const keeperPieceId = normalizedId(body.keeperPieceId);
  const idempotencyKey = normalizedId(body.idempotencyKey, MAINTENANCE_IDEMPOTENCY_KEY_MAX);
  if (!contentId) return jsonResponse({ ok: false, error: 'invalid_content_id' }, 400);
  if (!keeperPieceId) return jsonResponse({ ok: false, error: 'invalid_keeper_piece_id' }, 400);
  if (!idempotencyKey) return jsonResponse({ ok: false, error: 'invalid_idempotency_key' }, 400);
  const normalizedReason = normalizeReason(body.reason);
  if (!normalizedReason.ok) {
    return jsonResponse({ ok: false, error: normalizedReason.error }, 400);
  }
  const { reason } = normalizedReason;

  try {
    // The content must exist and belong to the named piece today it is
    // always a collector_dreams row id. Anything else -- unknown id, or a
    // piece mismatch -- is rejected rather than silently acting on it.
    const content = await env.DB.prepare(
      'SELECT id, keeper_piece_id FROM collector_dreams WHERE id = ?1',
    ).bind(contentId).first();
    if (!content || content.keeper_piece_id !== keeperPieceId) {
      return jsonResponse({ ok: false, error: 'content_not_found' }, 404);
    }

    // Idempotent replay by UNIQUE(content_id): restoring shone content is
    // not a thing, so a retry against already-removed content -- with any
    // reason, any idempotency key -- is a clean 200, never a duplicate or a
    // conflict, as long as it still names the same piece.
    const existingByContent = await env.DB.prepare(
      `SELECT id, content_id, keeper_piece_id, removed_reason, removed_by_user_id, removed_at
         FROM collector_shine_removals WHERE content_id = ?1`,
    ).bind(contentId).first();
    if (existingByContent) {
      if (existingByContent.keeper_piece_id !== keeperPieceId) {
        return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
      }
      return jsonResponse({
        ok: true, replayed: true, removal: serializeRemoval(existingByContent),
      });
    }

    // Idempotent replay by idempotency key: content_id is UNIQUE and no row
    // matched above, so a key match here means the same request key was
    // reused for different content -- a genuine conflict, not a replay.
    const existingByKey = await env.DB.prepare(
      'SELECT id FROM collector_shine_removals WHERE idempotency_key = ?1',
    ).bind(idempotencyKey).first();
    if (existingByKey) {
      return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
    }

    const removalId = `csr-${crypto.randomUUID()}`;
    const eventId = `rme-${crypto.randomUUID()}`;
    const removedAt = new Date().toISOString();
    const mutationFingerprint = await maintenanceMutationFingerprint({
      operation: EVENT_TYPE, contentId, keeperPieceId, reason,
    });
    const beforeJson = canonicalMaintenanceJson({ contentId, keeperPieceId, removed: false });
    const afterJson = canonicalMaintenanceJson({
      contentId,
      keeperPieceId,
      removedReason: reason,
      removedByUserId: authorization.userId,
      removedAt,
    });

    const removalStatement = env.DB.prepare(
      `INSERT INTO collector_shine_removals
         (id, content_id, keeper_piece_id, removed_reason, removed_by_user_id,
          idempotency_key, removed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      removalId, contentId, keeperPieceId, reason, authorization.userId,
      idempotencyKey, removedAt,
    );
    const eventStatement = env.DB.prepare(
      `INSERT INTO registry_maintenance_events
         (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
          administrator_user_id, administrator_email, reason, before_json,
          after_json, outcome, related_record_id, mutation_fingerprint, created_at)
       VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, ?8, ?9, 'succeeded', ?10, ?11, ?12)`,
    ).bind(
      eventId, idempotencyKey, EVENT_TYPE, keeperPieceId,
      authorization.userId, authorization.email, reason, beforeJson, afterJson,
      contentId, mutationFingerprint, removedAt,
    );

    if (typeof env.DB.batch !== 'function') {
      return jsonResponse({ ok: false, error: 'atomic_write_unavailable' }, 503);
    }
    let results;
    try {
      results = await env.DB.batch([removalStatement, eventStatement]);
    } catch {
      // A concurrent identical request may have already landed the row.
      const raced = await env.DB.prepare(
        `SELECT id, content_id, keeper_piece_id, removed_reason, removed_by_user_id, removed_at
           FROM collector_shine_removals WHERE content_id = ?1`,
      ).bind(contentId).first();
      if (raced && raced.keeper_piece_id === keeperPieceId) {
        return jsonResponse({ ok: true, replayed: true, removal: serializeRemoval(raced) });
      }
      return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
    }
    const [removalResult, eventResult] = results;
    if (removalResult?.success !== true || eventResult?.success !== true
      || removalResult?.meta?.changes !== 1 || eventResult?.meta?.changes !== 1) {
      return jsonResponse({ ok: false, error: 'maintenance_write_failed' }, 503);
    }

    const records = await regenerateOne(env, keeperPieceId, removedAt);
    return jsonResponse({
      ok: true,
      replayed: false,
      eventId,
      removal: serializeRemoval({
        id: removalId,
        content_id: contentId,
        keeper_piece_id: keeperPieceId,
        removed_reason: reason,
        removed_by_user_id: authorization.userId,
        removed_at: removedAt,
      }),
      records,
    }, 201);
  } catch (error) {
    if (isMissingTableError(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'shine_removal_failed' }, 500);
  }
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return handleGet(request, env);
  if (request.method === 'POST') return handlePost(request, env);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
}
