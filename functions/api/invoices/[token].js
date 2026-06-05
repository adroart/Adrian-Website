import { jsonResponse } from '../_lib/admin.js';
import { serializeInvoiceRow } from '../_lib/invoices.js';

export async function onRequestGet({ env, params }) {
  if (!env.DB) return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);

  const token = typeof params.token === 'string' ? params.token.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  const row = await env.DB
    .prepare("SELECT * FROM invoices WHERE public_token = ?1 AND status != 'void'")
    .bind(token)
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  return jsonResponse({ ok: true, invoice: serializeInvoiceRow(row) });
}
