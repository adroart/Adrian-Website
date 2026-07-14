/**
 * PUT /api/profile/put
 *
 * Body: { inputs, computed }
 *
 * Upserts the profile row for the signed-in user. Persists both the
 * inputs (so the user can edit later) and the computed Hologenetic
 * Profile JSON (so other devices read it without re-running astronomy).
 */

import { requireUser, jsonResponse } from '../_lib/auth.js';
import { ensureUser } from '../_lib/db.js';

function validInputs(x) {
  if (!x || typeof x !== 'object') return false;
  if (typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return false;
  if (typeof x.time !== 'string' || !/^\d{2}:\d{2}$/.test(x.time)) return false;
  const p = x.place;
  if (!p || typeof p !== 'object') return false;
  if (typeof p.label !== 'string' || !p.label.trim()) return false;
  if (typeof p.tzId !== 'string' || !p.tzId.trim()) return false;
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return false;
  return true;
}

function validComputed(c) {
  if (!c || typeof c !== 'object') return false;
  const keys = ['lifesWork', 'evolution', 'radiance', 'purpose', 'attraction', 'iq', 'eq', 'sq', 'core', 'culture', 'pearl'];
  for (const k of keys) {
    const gl = c[k];
    if (!gl || typeof gl.gate !== 'number' || typeof gl.line !== 'number') return false;
    if (gl.gate < 1 || gl.gate > 64 || gl.line < 1 || gl.line > 6) return false;
  }
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
  }

  if (!validInputs(body?.inputs)) {
    return jsonResponse({ error: 'invalid_inputs' }, { status: 400 }, request, env);
  }
  if (!validComputed(body?.computed)) {
    return jsonResponse({ error: 'invalid_computed' }, { status: 400 }, request, env);
  }

  const user = await ensureUser(env.DB, { userId: auth.userId, email: auth.email });
  if (!user) {
    // Should not happen — ensureUser upserts the bridge row. Surface for debugging.
    return jsonResponse({ error: 'user_not_synced' }, { status: 409 }, request, env);
  }

  const { inputs, computed } = body;

  await env.DB
    .prepare(
      `INSERT INTO profiles (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, unixepoch())
       ON CONFLICT(user_id) DO UPDATE SET
         birth_date = excluded.birth_date,
         birth_time = excluded.birth_time,
         birth_place_label = excluded.birth_place_label,
         lat = excluded.lat,
         lng = excluded.lng,
         tz_id = excluded.tz_id,
         computed_json = excluded.computed_json,
         updated_at = unixepoch()`,
    )
    .bind(
      user.id,
      inputs.date,
      inputs.time,
      inputs.place.label,
      inputs.place.lat,
      inputs.place.lng,
      inputs.place.tzId,
      JSON.stringify(computed),
    )
    .run();

  return jsonResponse({ ok: true }, { status: 200 }, request, env);
}
