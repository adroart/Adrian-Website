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

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    const pending = await env.DB
      .prepare(
        `SELECT * FROM atlas_sale_events
         WHERE status = 'pending'
         ORDER BY received_at DESC, sale_id ASC`,
      )
      .all();
    const resolved = await env.DB
      .prepare(
        `SELECT * FROM atlas_sale_events
         WHERE status != 'pending'
         ORDER BY confirmed_at DESC, received_at DESC
         LIMIT ?1`,
      )
      .bind(RECENT_RESOLVED_LIMIT)
      .all();

    return jsonResponse({
      ok: true,
      pending: (pending.results ?? []).map(toQueueItem),
      resolved: (resolved.results ?? []).map(toQueueItem),
    });
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
