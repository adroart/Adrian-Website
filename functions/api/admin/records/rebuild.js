/**
 * POST /api/admin/records/rebuild
 *
 * Regenerate the permanent Piece Record for one piece
 * ({ "publicCode": "AR-XXXXXXXX" }) or, when publicCode is omitted, for a
 * page of every piece with a public registry identity (ordered by public
 * code), via the deterministic generator in _lib/pieceRecord.js with
 * trigger_event 'on_demand'.
 *
 * Capped, not one request per registry: the bulk path used to walk every
 * piece in a single request, so a large enough registry could run past the
 * platform's request time limit mid-loop and lose the whole summary with
 * nothing written down about what had already been rebuilt. It now processes
 * at most RECORDS_REBUILD_BATCH_LIMIT pieces per call and reports
 * { hasMore, nextCursor } so the caller pages through the rest with
 * { "cursor": nextCursor } -- one small, boundable request at a time,
 * however large the registry grows. The cursor is a public_code, not an
 * offset, so a bulk rebuild in progress never skips or repeats a piece even
 * if the registry gains a new one between pages.
 *
 * Idempotency: regeneration of unchanged content is a clean no-op. The
 * rebuilt record is compared with the newest stored record's canonical JSON
 * ignoring only generatedAt and trigger (the two caller-supplied stamps); an
 * equal record is reported "unchanged" and nothing new is written, so
 * rebuilds never churn new files for identical content. Should identical
 * bytes ever be republished anyway (same generatedAt retried), the write
 * path is already safe: write-once content-addressed R2 (read back and
 * byte-compared) plus the UNIQUE(public_code, record_hash) guard on the
 * append-only piece_records insert absorb the conflict gracefully. Paging
 * itself is exactly as safe to repeat: each page is its own idempotent
 * rebuild of the pieces it covers, so retrying, restarting from the top, or
 * re-running the whole thing after it already finished changes nothing for
 * pieces that already match.
 *
 * Per-piece outcomes are reported so a partial failure never hides:
 *   generated  — a new record file now exists under a new hash
 *   unchanged  — the rebuilt record matches the newest stored one
 *   failed     — generation or verified storage failed (with the error code)
 *
 * Guarded like every registry-wide admin operation: admin session plus the
 * registry step-up unlock.
 *
 * The per-piece build/compare/publish work lives in _lib/pieceRecordRefresh.js
 * now, shared with every registry-event trigger site; this endpoint is a
 * thin loop over that helper for 'on_demand' regeneration.
 */
import { jsonResponse, requireRegistryUnlock, requireDb } from '../../_lib/admin.js';
import { isMissingTableError, migrationNotApplied, legacyEnabled } from '../../_lib/keeper.js';
import { refreshPieceRecord } from '../../_lib/pieceRecordRefresh.js';

const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

// How many pieces one bulk-rebuild request touches. Small enough that even
// the slowest per-piece rebuild (a full lineage recompute plus a verified
// R2 round trip) stays comfortably inside the platform's request time limit;
// large enough that a registry of a few hundred pieces finishes in a small
// number of pages rather than dozens.
export const RECORDS_REBUILD_BATCH_LIMIT = 25;

// Thin wrapper: this endpoint always regenerates with trigger 'on_demand'
// and reports every piece's outcome, never throwing per-piece (the shared
// helper's contract), so a missing table now surfaces as a 'failed' outcome
// on each row rather than aborting the whole batch. The outer try/catch
// below still exists for the "list every registered piece" query itself.
async function rebuildOne(env, publicCode, generatedAt, includeLegacySections) {
  return refreshPieceRecord(env, {
    publicCode, trigger: 'on_demand', generatedAt, includeLegacySections,
  });
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
  const cursor = body?.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !cursor.trim())) {
    return jsonResponse({ ok: false, error: 'invalid_cursor' }, 400);
  }
  if (requestedCode !== undefined && cursor !== undefined) {
    return jsonResponse({ ok: false, error: 'cursor_requires_bulk_rebuild' }, 400);
  }

  const generatedAt = new Date().toISOString();
  const includeLegacySections = legacyEnabled();
  try {
    let publicCodes;
    let hasMore = false;
    if (requestedCode !== undefined) {
      publicCodes = [String(requestedCode)];
    } else {
      // One capped, cursor-ordered page of every piece with a public
      // registry identity (registered or grandfathered before migration 025
      // backfilled registration_status). Fetching one extra row is how
      // hasMore is known without a separate COUNT query; it is trimmed back
      // off before use below.
      // The cursor value is bound twice, once per ordinal (?1 and ?2),
      // rather than reusing one ordinal in both places: D1 accepts a
      // repeated numbered parameter, but node:sqlite (this project's own
      // test runner) raises "column index out of range" on one, so binding
      // it under two ordinals keeps the same query portable to both.
      const result = await env.DB.prepare(
        `SELECT public_code
           FROM keeper_pieces
          WHERE public_code IS NOT NULL
            AND (?1 IS NULL OR public_code > ?2)
          ORDER BY public_code ASC
          LIMIT ?3`,
      ).bind(cursor ?? null, cursor ?? null, RECORDS_REBUILD_BATCH_LIMIT + 1).all();
      const rows = Array.isArray(result) ? result : result?.results;
      if (!Array.isArray(rows)) {
        return jsonResponse({ ok: false, error: 'registry_unavailable' }, 503);
      }
      const codes = rows
        .map((row) => String(row.public_code || ''))
        .filter((code) => PUBLIC_CODE_PATTERN.test(code));
      hasMore = codes.length > RECORDS_REBUILD_BATCH_LIMIT;
      publicCodes = hasMore ? codes.slice(0, RECORDS_REBUILD_BATCH_LIMIT) : codes;
    }

    const outcomes = [];
    for (const publicCode of publicCodes) {
      outcomes.push(await rebuildOne(env, publicCode, generatedAt, includeLegacySections));
    }
    const failed = outcomes.filter((outcome) => outcome.status === 'failed').length;
    const nextCursor = hasMore ? publicCodes[publicCodes.length - 1] : null;
    return jsonResponse({
      ok: failed === 0,
      generatedAt,
      trigger: 'on_demand',
      total: outcomes.length,
      generated: outcomes.filter((outcome) => outcome.status === 'generated').length,
      unchanged: outcomes.filter((outcome) => outcome.status === 'unchanged').length,
      failed,
      outcomes,
      // Only meaningful for the bulk path; a single-piece rebuild is always
      // its own complete, one-page result.
      hasMore,
      nextCursor,
    }, failed === 0 ? 200 : 207);
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    return jsonResponse({ ok: false, error: 'records_rebuild_failed' }, 500);
  }
}
