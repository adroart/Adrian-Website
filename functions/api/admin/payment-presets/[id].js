import { jsonResponse, requireAdmin, requireDb } from '../../_lib/admin.js';
import {
  normalizePaymentPresetInput,
  serializePaymentPresetRow,
  validatePaymentPreset,
} from '../../_lib/invoices.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);

  if (request.method === 'GET') return getPaymentPreset(env, id);
  if (request.method === 'PUT') return updatePaymentPreset(request, env, id);
  if (request.method === 'DELETE') return deletePaymentPreset(env, id);
  return new Response('Method not allowed', { status: 405 });
}

async function getPaymentPreset(env, id) {
  const row = await env.DB.prepare('SELECT * FROM payment_presets WHERE id = ?1').bind(id).first();
  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, preset: serializePaymentPresetRow(row) });
}

async function updatePaymentPreset(request, env, id) {
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
    await env.DB
      .prepare('UPDATE payment_presets SET is_default = 0, updated_at = unixepoch() WHERE id != ?1')
      .bind(id)
      .run();
  }

  const row = await env.DB
    .prepare(
      `UPDATE payment_presets SET
         label = ?1,
         method = ?2,
         currency = ?3,
         instructions = ?4,
         details = ?5,
         url = ?6,
         is_default = ?7,
         is_active = ?8,
         updated_at = unixepoch()
       WHERE id = ?9
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
      id,
    )
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, preset: serializePaymentPresetRow(row) });
}

async function deletePaymentPreset(env, id) {
  const row = await env.DB
    .prepare(
      `UPDATE payment_presets SET
         is_active = 0,
         is_default = 0,
         updated_at = unixepoch()
       WHERE id = ?1
       RETURNING *`,
    )
    .bind(id)
    .first();

  if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, preset: serializePaymentPresetRow(row) });
}
