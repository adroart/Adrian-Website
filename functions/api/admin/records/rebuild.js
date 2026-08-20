/**
 * POST /api/admin/records/rebuild
 *
 * Regenerate the permanent Piece Record for one piece
 * ({ "publicCode": "AR-XXXXXXXX" }) or for EVERY piece with a public
 * registry identity when publicCode is omitted, via the deterministic
 * generator in _lib/pieceRecord.js with trigger_event 'on_demand'.
 *
 * Idempotency: regeneration of unchanged content is a clean no-op. The
 * rebuilt record is compared with the newest stored record's canonical JSON
 * ignoring only generatedAt and trigger (the two caller-supplied stamps); an
 * equal record is reported "unchanged" and nothing new is written, so
 * rebuilds never churn new files for identical content. Should identical
 * bytes ever be republished anyway (same generatedAt retried), the write
 * path is already safe: write-once content-addressed R2 (read back and
 * byte-compared) plus the UNIQUE(public_code, record_hash) guard on the
 * append-only piece_records insert absorb the conflict gracefully.
 *
 * Per-piece outcomes are reported so a partial failure never hides:
 *   generated  — a new record file now exists under a new hash
 *   unchanged  — the rebuilt record matches the newest stored one
 *   failed     — generation or verified storage failed (with the error code)
 *
 * Guarded like every registry-wide admin operation: admin session plus the
 * registry step-up unlock.
 */
import { jsonResponse, requireRegistryUnlock, requireDb } from '../../_lib/admin.js';
import { isMissingTableError, migrationNotApplied, legacyEnabled } from '../../_lib/keeper.js';
import {
  buildPieceRecord, canonicalRecordJson, publishPieceRecord,
} from '../../_lib/pieceRecord.js';

const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

async function latestRecord(env, publicCode) {
  const row = await env.DB.prepare(
    `SELECT record_hash
       FROM piece_records
      WHERE public_code = ?1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  ).bind(publicCode).first();
  return row ?? null;
}

/** Canonical JSON of a record with the caller-supplied stamps held constant. */
function substantiveRecordJson(record) {
  return canonicalRecordJson({ ...record, generatedAt: '', trigger: '' });
}

async function storedCanonicalRecord(env, publicCode, recordHash) {
  try {
    const stored = await env.ARTWORK_REGISTRY_BACKUP.get(
      `records/${publicCode}/${recordHash}.json`,
    );
    if (!stored) return null;
    const parsed = JSON.parse(await stored.text());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function rebuildOne(env, publicCode, generatedAt, includeLegacySections) {
  try {
    const built = await buildPieceRecord(env, {
      publicCode,
      trigger: 'on_demand',
      generatedAt,
      includeLegacySections,
    });
    const previous = await latestRecord(env, publicCode);
    if (previous) {
      if (previous.record_hash === built.recordHash) {
        return { publicCode, status: 'unchanged', recordHash: previous.record_hash };
      }
      const previousRecord = await storedCanonicalRecord(env, publicCode, previous.record_hash);
      if (previousRecord
        && substantiveRecordJson(previousRecord) === substantiveRecordJson(built.record)) {
        return { publicCode, status: 'unchanged', recordHash: previous.record_hash };
      }
    }
    const result = await publishPieceRecord(env, {
      publicCode,
      trigger: 'on_demand',
      generatedAt,
      includeLegacySections,
    });
    if (result.status !== 'verified') {
      return { publicCode, status: 'failed', error: 'record_storage_failed' };
    }
    return { publicCode, status: 'generated', recordHash: result.recordHash };
  } catch (error) {
    if (isMissingTableError(error)) throw error;
    return {
      publicCode,
      status: 'failed',
      error: String(error?.code || error?.message || 'record_generation_failed'),
    };
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'records_bucket_not_configured' }, 503);
  }

  let body = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const requestedCode = body?.publicCode;
  if (requestedCode !== undefined && !PUBLIC_CODE_PATTERN.test(String(requestedCode || ''))) {
    return jsonResponse({ ok: false, error: 'invalid_public_code' }, 400);
  }

  const generatedAt = new Date().toISOString();
  const includeLegacySections = legacyEnabled();
  try {
    let publicCodes;
    if (requestedCode !== undefined) {
      publicCodes = [String(requestedCode)];
    } else {
      // Every piece with a public registry identity (registered or
      // grandfathered before migration 025 backfilled registration_status).
      const result = await env.DB.prepare(
        `SELECT public_code
           FROM keeper_pieces
          WHERE public_code IS NOT NULL
          ORDER BY public_code ASC`,
      ).all();
      const rows = Array.isArray(result) ? result : result?.results;
      if (!Array.isArray(rows)) {
        return jsonResponse({ ok: false, error: 'registry_unavailable' }, 503);
      }
      publicCodes = rows
        .map((row) => String(row.public_code || ''))
        .filter((code) => PUBLIC_CODE_PATTERN.test(code));
    }

    const outcomes = [];
    for (const publicCode of publicCodes) {
      outcomes.push(await rebuildOne(env, publicCode, generatedAt, includeLegacySections));
    }
    const failed = outcomes.filter((outcome) => outcome.status === 'failed').length;
    return jsonResponse({
      ok: failed === 0,
      generatedAt,
      trigger: 'on_demand',
      total: outcomes.length,
      generated: outcomes.filter((outcome) => outcome.status === 'generated').length,
      unchanged: outcomes.filter((outcome) => outcome.status === 'unchanged').length,
      failed,
      outcomes,
    }, failed === 0 ? 200 : 207);
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    return jsonResponse({ ok: false, error: 'records_rebuild_failed' }, 500);
  }
}
