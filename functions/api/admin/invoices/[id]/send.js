import { jsonResponse, requireAdmin, requireDb } from '../../../_lib/admin.js';
import { serializeStudioInvoiceRow } from '../../../_lib/invoices.js';

export async function onRequestPost({ request, env, params }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);
  const version = request.headers.get('If-Match');

  const row = await env.DB
    .prepare(
      `UPDATE invoices SET
         status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
         sent_at = CASE WHEN sent_at IS NULL THEN unixepoch() ELSE sent_at END,
         updated_at = MAX(unixepoch(), updated_at + 1)
       WHERE id = ?1 AND status != 'void'
         AND total_cents > 0 AND due_today_cents > 0
         AND json_array_length(line_items_json) > 0 AND json_array_length(payment_schedule_json) > 0
         AND (json_array_length(payment_options_json) > 0 OR payment_snapshot_json <> '{}')
         AND (?2 IS NULL OR ?2 = printf('"%d:%d"', updated_at, amount_paid_cents))
       RETURNING *`,
    )
    .bind(id, version)
    .first();

  if (!row) {
    const existing = await env.DB.prepare('SELECT status FROM invoices WHERE id = ?1').bind(id).first();
    if (!existing || existing.status === 'void') return jsonResponse({ ok: false, error: 'not_found' }, 404);
    return jsonResponse({ ok: false, error: 'invoice_not_ready_to_share' }, 409);
  }

  const invoice = serializeStudioInvoiceRow(row);
  return jsonResponse({
    ok: true,
    invoice,
    publicUrlPath: invoice.publicUrlPath,
  });
}
