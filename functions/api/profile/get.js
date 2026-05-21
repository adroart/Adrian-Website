/**
 * GET /api/profile/get
 *
 * Returns the signed-in user's Hologenetic Profile as the StoredProfile
 * shape consumed by lib/profile/storage.ts (inputs + computed + updatedAt).
 * Returns 204 No Content when the user has no profile saved.
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) return new Response(null, { status: 204 });

  const row = await env.DB
    .prepare('SELECT birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json, updated_at FROM profiles WHERE user_id = ?1')
    .bind(user.id)
    .first();
  if (!row) return new Response(null, { status: 204 });

  let computed;
  try {
    computed = JSON.parse(row.computed_json);
  } catch {
    return jsonResponse({ error: 'profile_corrupt' }, { status: 500 }, request, env);
  }

  return jsonResponse(
    {
      inputs: {
        date: row.birth_date,
        time: row.birth_time,
        place: {
          label: row.birth_place_label,
          lat: row.lat,
          lng: row.lng,
          tzId: row.tz_id,
        },
      },
      computed,
      updatedAt: new Date(row.updated_at * 1000).toISOString(),
    },
    { status: 200 },
    request,
    env,
  );
}
