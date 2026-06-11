import { jsonResponse, requireAdmin, requireDb } from '../../../_lib/admin.js';
import { serializeInvoiceRow } from '../../../_lib/invoices.js';

/**
 * POST /api/admin/invoices/:id/mark-paid
 * Body (optional): { paidCents }  — the amount actually paid. For variant
 * invoices, the admin passes the chosen size's total so the recorded amount
 * matches what the buyer decided; defaults to the invoice's stored total.
 *
 * Stamps paid_at, flips status to 'paid', and records the paid amount in
 * total_cents/due_today_cents so the figure reflects the buyer's choice.
 */
export async function onRequestPost({ request, env, params }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const paidCents = Number.isFinite(body.paidCents) && body.paidCents > 0 ? Math.round(body.paidCents) : null;

  const row = await env.DB
    .prepare(
      `UPDATE invoices SET
         status = 'paid',
         paid_at = CASE WHEN paid_at IS NULL THEN unixepoch() ELSE paid_at END,
         total_cents = COALESCE(?2, total_cents),
         due_today_cents = COALESCE(?2, due_today_cents),
         updated_at = unixepoch()
       WHERE id = ?1 AND status != 'void'
       RETURNING *`,
    )
    .bind(id, paidCents)
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) });
}
