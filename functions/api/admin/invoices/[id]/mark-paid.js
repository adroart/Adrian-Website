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

  const current = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?1 AND status != "void"').bind(id).first();
  if (!current) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  // If a fixed total was supplied (variant invoices), set it before computing balance.
  const setTotal = Number.isFinite(body.totalCents) && body.totalCents > 0 ? Math.round(body.totalCents) : null;
  const total = setTotal ?? current.total_cents;

  // Record a payment: full settle (no amount) pays the balance; a partial
  // amount accumulates. Status becomes 'paid' only when fully covered.
  const already = current.amount_paid_cents || 0;
  const payment = Number.isFinite(body.paidCents) && body.paidCents > 0 ? Math.round(body.paidCents) : (total - already);
  const newPaid = Math.min(total, already + payment);
  const fullyPaid = newPaid >= total;

  const row = await env.DB
    .prepare(
      `UPDATE invoices SET
         amount_paid_cents = ?2,
         total_cents = ?3,
         status = CASE WHEN ?4 = 1 THEN 'paid' ELSE status END,
         paid_at = CASE WHEN ?4 = 1 AND paid_at IS NULL THEN unixepoch() ELSE paid_at END,
         updated_at = unixepoch()
       WHERE id = ?1
       RETURNING *`,
    )
    .bind(id, newPaid, total, fullyPaid ? 1 : 0)
    .first();

  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) });
}
