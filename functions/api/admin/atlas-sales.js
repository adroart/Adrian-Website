/**
 * GET /api/admin/atlas-sales
 *
 * Admin-only viewer for the atlas_sale_events queue (migration
 * 005_atlas_legacy.sql). Populated directly by the Stripe webhook
 * (functions/api/_lib/atlasSale.js) since B1 (2026-09-08) — this is the
 * first place anywhere that queue is readable again, replacing the
 * mandalacodes admin list that now sits behind the atlas 410 boundary.
 *
 * Buyer email and price are D1-only data (never the ledger, never public);
 * shown here because the admin is the person who acts on the queue.
 * raw_json (the full webhook payload) is withheld — it is dispute evidence,
 * not dashboard data, matching the retired mandalacodes handler's choice.
 */

import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { isMissingTableError } from '../_lib/keeper.js';

const RECENT_RESOLVED_LIMIT = 10;
const MAX_RESOLVED_LIMIT = 25;

function encodeCursor(row) {
  const value = JSON.stringify([
    row.confirmed_at ?? -1,
    row.received_at,
    row.sale_id,
  ]);
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeCursor(value) {
  if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded));
    if (!Array.isArray(parsed) || parsed.length !== 3
      || !Number.isSafeInteger(parsed[0]) || parsed[0] < -1
      || !Number.isSafeInteger(parsed[1]) || parsed[1] < 0
      || typeof parsed[2] !== 'string' || !parsed[2] || parsed[2].length > 255) return null;
    return { confirmedAt: parsed[0], receivedAt: parsed[1], saleId: parsed[2] };
  } catch {
    return null;
  }
}

function paginationFromUrl(requestUrl) {
  const params = new URL(requestUrl).searchParams;
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? RECENT_RESOLVED_LIMIT : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RESOLVED_LIMIT) return null;
  const rawCursor = params.get('cursor');
  const cursor = rawCursor === null ? undefined : decodeCursor(rawCursor);
  if (rawCursor !== null && !cursor) return null;
  return { limit, cursor };
}

function toQueueItem(row) {
  return {
    saleId: row.sale_id,
    sku: row.sku,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    buyerEmail: row.buyer_email,
    buyerName: row.buyer_name,
    saleDate: row.sale_date,
    priceCents: row.price_cents,
    currency: row.currency,
    status: row.status,
    receivedAt: row.received_at,
    confirmedAt: row.confirmed_at,
    dismissedReason: row.dismissed_reason,
  };
}

export async function listAtlasSales(db, requestUrl) {
  const pagination = paginationFromUrl(requestUrl);
  if (!pagination) return { error: 'invalid_pagination' };
  const { limit, cursor } = pagination;
  const pending = await db
    .prepare(
      `SELECT * FROM atlas_sale_events
       WHERE status = 'pending'
       ORDER BY received_at DESC, sale_id ASC`,
    )
    .all();
  const cursorWhere = cursor
    ? `AND (
         COALESCE(confirmed_at, -1) < ?2
         OR (COALESCE(confirmed_at, -1) = ?2 AND received_at < ?3)
         OR (COALESCE(confirmed_at, -1) = ?2 AND received_at = ?3 AND sale_id > ?4)
       )`
    : '';
  const statement = db.prepare(
    `SELECT * FROM atlas_sale_events
     WHERE status != 'pending'
     ${cursorWhere}
     ORDER BY COALESCE(confirmed_at, -1) DESC, received_at DESC, sale_id ASC
     LIMIT ?1`,
  );
  const resolvedResult = cursor
    ? await statement.bind(limit + 1, cursor.confirmedAt, cursor.receivedAt, cursor.saleId).all()
    : await statement.bind(limit + 1).all();
  const resolvedRows = resolvedResult.results ?? [];
  const hasMore = resolvedRows.length > limit;
  const pageRows = resolvedRows.slice(0, limit);
  return {
    pending: (pending.results ?? []).map(toQueueItem),
    resolved: pageRows.map(toQueueItem),
    pagination: {
      resolved: {
        hasMore,
        nextCursor: hasMore && pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]) : null,
      },
    },
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    const result = await listAtlasSales(env.DB, request.url);
    if (result.error) return jsonResponse({ ok: false, error: result.error }, 400);
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    if (isMissingTableError(err)) {
      return jsonResponse(
        { ok: false, error: 'migration_not_applied' },
        503,
      );
    }
    throw err;
  }
}
