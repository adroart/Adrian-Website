/**
 * /api/pricing/config
 *   GET  — public. Returns the tuned model so the customer Pricing Explorer
 *          reflects Adrian's real numbers on any device. Returns config: null
 *          when nothing has been saved yet; the client then falls back to its
 *          built-in defaults (the single source of truth for the schema).
 *   PUT  — admin only. Upserts the singleton config row.
 */

import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { validateConfig } from '../_lib/pricing.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') return getConfig(env);

  if (request.method === 'PUT') {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;
    const missingDb = requireDb(env);
    if (missingDb) return missingDb;
    return putConfig(request, env);
  }

  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

async function getConfig(env) {
  // Public read, but if the DB isn't wired up, say so softly: the client
  // falls back to its bundled defaults rather than erroring.
  if (!env.DB) return jsonResponse({ ok: true, config: null });
  try {
    const row = await env.DB
      .prepare('SELECT config_json FROM pricing_config WHERE id = 1')
      .first();
    const config = row ? JSON.parse(row.config_json) : null;
    return jsonResponse({ ok: true, config });
  } catch {
    return jsonResponse({ ok: true, config: null });
  }
}

async function putConfig(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const config = body && body.config ? body.config : body;
  const error = validateConfig(config);
  if (error) return jsonResponse({ ok: false, error }, 400);

  await env.DB
    .prepare(
      `INSERT INTO pricing_config (id, config_json, updated_at)
       VALUES (1, ?1, unixepoch())
       ON CONFLICT(id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at = unixepoch()`,
    )
    .bind(JSON.stringify(config))
    .run();

  return jsonResponse({ ok: true, config });
}
