/**
 * Admin API for private art viewings — create / update / list.
 * Mirrors functions/api/admin/invoices.js: admin-gated, D1-backed, token-minted.
 *
 *   GET  /api/admin/viewings        → list (newest first)
 *   POST /api/admin/viewings        → create or update (id present = update)
 *
 * The assembled artifact (ViewingData) is stored whole in data_json; the public
 * page reads it verbatim. "Send" is just a status flip to 'sent' (the token is
 * minted on create), so a single POST with status:'sent' delivers.
 */
import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';

function token() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function clean(value, max = 5000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function serialize(row) {
  return {
    id: row.id,
    publicToken: row.public_token,
    publicUrlPath: `/viewing/${row.public_token}`,
    status: row.status,
    recipientName: row.recipient_name,
    clientEmail: row.client_email,
    intention: row.intention,
    chart: safeParse(row.chart_json, {}),
    data: safeParse(row.data_json, {}),
    invoiceToken: row.invoice_token || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at || null,
    requestedAt: row.requested_at || null,
  };
}

function safeParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listViewings(request, env);
  if (request.method === 'POST') return saveViewing(request, env);
  return new Response('Method not allowed', { status: 405 });
}

async function listViewings(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

  let query = 'SELECT * FROM viewings';
  const bindings = [];
  if (status) {
    query += ' WHERE status = ?1';
    bindings.push(status);
  }
  query += ` ORDER BY created_at DESC LIMIT ${limit}`;

  const stmt = env.DB.prepare(query);
  const { results } = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
  return jsonResponse({ ok: true, viewings: (results || []).map(serialize) });
}

async function saveViewing(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const recipientName = clean(body.recipientName, 200).trim();
  if (!recipientName) return jsonResponse({ ok: false, error: 'recipient_name_required' }, 400);

  const status = ['draft', 'sent', 'viewed', 'requested'].includes(body.status) ? body.status : 'draft';
  const chartJson = JSON.stringify(body.chart ?? {});
  const dataJson = JSON.stringify(body.data ?? {});
  const intention = clean(body.intention, 500);
  const clientEmail = clean(body.clientEmail, 200);

  // Update path
  if (body.id) {
    await env.DB.prepare(
      `UPDATE viewings
         SET status=?1, recipient_name=?2, client_email=?3, intention=?4,
             chart_json=?5, data_json=?6, updated_at=unixepoch(),
             sent_at = CASE WHEN ?1='sent' AND sent_at IS NULL THEN unixepoch() ELSE sent_at END
       WHERE id=?7`,
    )
      .bind(status, recipientName, clientEmail, intention, chartJson, dataJson, body.id)
      .run();
    const row = await env.DB.prepare('SELECT * FROM viewings WHERE id=?1').bind(body.id).first();
    return jsonResponse({ ok: true, viewing: serialize(row) });
  }

  // Create path
  const publicToken = token();
  const row = await env.DB.prepare(
    `INSERT INTO viewings
       (public_token, status, recipient_name, client_email, intention, chart_json, data_json,
        sent_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CASE WHEN ?2='sent' THEN unixepoch() ELSE NULL END)
     RETURNING *`,
  )
    .bind(publicToken, status, recipientName, clientEmail, intention, chartJson, dataJson)
    .first();

  return jsonResponse({ ok: true, viewing: serialize(row) });
}
