import { jsonResponse, requireAdmin, requireDb } from '../../../_lib/admin.js';
import { serializeInvoiceRow } from '../../../_lib/invoices.js';

export async function onRequestPost({ request, env, params }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);

  const row = await env.DB
    .prepare(
      `UPDATE invoices SET
         status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
         sent_at = CASE WHEN sent_at IS NULL THEN unixepoch() ELSE sent_at END,
         updated_at = unixepoch()
       WHERE id = ?1 AND status != 'void'
       RETURNING *`,
    )
    .bind(id)
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  const invoice = serializeInvoiceRow(row);
  return jsonResponse({
    ok: true,
    invoice,
    publicUrlPath: invoice.publicUrlPath,
  });
}
