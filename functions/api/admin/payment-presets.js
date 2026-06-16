import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import {
  normalizePaymentPresetInput,
  serializePaymentPresetRow,
  validatePaymentPreset,
} from '../_lib/invoices.js';

export async function onRequest(context) {
  const { request, env } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listPaymentPresets(env);
  if (request.method === 'POST') return createPaymentPreset(request, env);
  return new Response('Method not allowed', { status: 405 });
}

async function listPaymentPresets(env) {
  const { results } = await env.DB
    .prepare(
      `SELECT * FROM payment_presets
       WHERE is_active = 1
       ORDER BY
         is_default DESC,
         CASE method
           WHEN 'wise' THEN 1
           WHEN 'crypto' THEN 2
           WHEN 'bank' THEN 3
           ELSE 9
         END,
         label COLLATE NOCASE ASC`,
    )
    .all();
  return jsonResponse({ ok: true, presets: (results || []).map(serializePaymentPresetRow) });
}

async function createPaymentPreset(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const preset = normalizePaymentPresetInput(body);
  const error = validatePaymentPreset(preset);
  if (error) return jsonResponse({ ok: false, error }, 400);

  if (preset.isDefault) {
    await env.DB.prepare('UPDATE payment_presets SET is_default = 0, updated_at = unixepoch()').run();
  }

  const row = await env.DB
    .prepare(
      `INSERT INTO payment_presets
        (label, method, currency, instructions, details, url, is_default, is_active)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       RETURNING *`,
    )
    .bind(
      preset.label,
      preset.method,
      preset.currency,
      preset.instructions,
      preset.details,
      preset.url,
      preset.isDefault ? 1 : 0,
      preset.isActive ? 1 : 0,
    )
    .first();

  return jsonResponse({ ok: true, preset: serializePaymentPresetRow(row) }, 201);
}
