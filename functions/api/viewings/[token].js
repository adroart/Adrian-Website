/**
 * Public viewing lookup by token — what the /viewing/:token page fetches.
 * Mirrors functions/api/invoices/[token].js. Returns the assembled artifact
 * (ViewingData) only; no admin fields. A first read flips draft/sent → viewed.
 */
import { jsonResponse } from '../_lib/admin.js';

export async function onRequestGet({ env, params }) {
  if (!env.DB) return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);

  const token = typeof params.token === 'string' ? params.token.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  const row = await env.DB
    .prepare('SELECT * FROM viewings WHERE public_token = ?1')
    .bind(token)
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  // Mark viewed on first open (does not overwrite 'requested').
  if (row.status === 'sent' || row.status === 'draft') {
    await env.DB.prepare("UPDATE viewings SET status='viewed' WHERE id=?1 AND status IN ('sent','draft')")
      .bind(row.id)
      .run();
  }

  let data = {};
  try {
    data = JSON.parse(row.data_json);
  } catch {
    data = {};
  }

  return jsonResponse({ ok: true, viewing: { token: row.public_token, recipientName: row.recipient_name, ...data } });
}
