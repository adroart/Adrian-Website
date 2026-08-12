import { buildHologeneticProfile } from '../../../lib/astrology/profile.ts';
import { placeToUtc } from '../../../lib/astrology/places.ts';
import { ensureUser } from './db.js';

function requiredDatabase(env) {
  if (!env?.DB) throw new Error('db_not_configured');
  return env.DB;
}

function validInputs(inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return false;
  if (typeof inputs.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(inputs.date)) return false;
  if (typeof inputs.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(inputs.time)) return false;
  const [year, month, day] = inputs.date.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    return false;
  }
  const place = inputs.place;
  if (!place || typeof place !== 'object' || Array.isArray(place)) return false;
  if (typeof place.label !== 'string' || !place.label.trim() || place.label.length > 240) return false;
  if (typeof place.tzId !== 'string' || !place.tzId.trim() || place.tzId.length > 120) return false;
  if (typeof place.lat !== 'number' || !Number.isFinite(place.lat) || place.lat < -90 || place.lat > 90) return false;
  if (typeof place.lng !== 'number' || !Number.isFinite(place.lng) || place.lng < -180 || place.lng > 180) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: place.tzId }).format();
  } catch {
    return false;
  }
  return true;
}

function rowToInputs(row) {
  return {
    date: row.birth_date,
    time: row.birth_time,
    place: {
      label: row.birth_place_label,
      lat: row.lat,
      lng: row.lng,
      tzId: row.tz_id,
    },
  };
}

export async function readCollectorOnboarding(env, { userId }) {
  const db = requiredDatabase(env);
  const row = await db.prepare(`
    SELECT profile.birth_date, profile.birth_time, profile.birth_place_label,
           profile.lat, profile.lng, profile.tz_id, profile.updated_at
      FROM users AS account
      JOIN profiles AS profile ON profile.user_id = account.id
     WHERE account.auth_user_id = ?1
  `).bind(userId).first();
  if (!row) return { status: 'missing' };
  return {
    status: 'current',
    inputs: rowToInputs(row),
    updatedAt: new Date(row.updated_at * 1000).toISOString(),
  };
}

export function skipCollectorBirthProfile() {
  return { status: 'skipped' };
}

export async function saveCollectorBirthProfile(env, {
  userId,
  email,
  inputs,
  savedAt = new Date().toISOString(),
}) {
  const db = requiredDatabase(env);
  if (!validInputs(inputs)) throw new Error('invalid_inputs');
  if (typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt))) {
    throw new Error('invalid_saved_at');
  }
  let utcBirth;
  try {
    utcBirth = placeToUtc(inputs.date, inputs.time, inputs.place.tzId);
  } catch {
    throw new Error('invalid_inputs');
  }
  const computed = buildHologeneticProfile({ utcBirth });
  const user = await ensureUser(db, { userId, email });
  if (!user) throw new Error('user_not_synced');
  await db.prepare(`
    INSERT INTO profiles
      (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id,
       computed_json, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CAST(strftime('%s', ?9) AS INTEGER))
    ON CONFLICT(user_id) DO UPDATE SET
      birth_date = excluded.birth_date,
      birth_time = excluded.birth_time,
      birth_place_label = excluded.birth_place_label,
      lat = excluded.lat,
      lng = excluded.lng,
      tz_id = excluded.tz_id,
      computed_json = excluded.computed_json,
      updated_at = excluded.updated_at
  `).bind(
    user.id,
    inputs.date,
    inputs.time,
    inputs.place.label.trim(),
    inputs.place.lat,
    inputs.place.lng,
    inputs.place.tzId,
    JSON.stringify(computed),
    savedAt,
  ).run();
  return { status: 'current', inputs, computed, updatedAt: new Date(savedAt).toISOString() };
}

export async function deleteCollectorBirthProfile(env, { userId }) {
  const db = requiredDatabase(env);
  const user = await db.prepare('SELECT id FROM users WHERE auth_user_id = ?1').bind(userId).first();
  if (user) await db.prepare('DELETE FROM profiles WHERE user_id = ?1').bind(user.id).run();
  return { ok: true };
}
