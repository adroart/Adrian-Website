import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { readAdminWorkQueue } from '../_lib/adminWorkQueue.js';

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    return jsonResponse({ ok: true, ...await readAdminWorkQueue(env) });
  } catch {
    return jsonResponse({ ok: false, error: 'overview_incomplete' }, 503);
  }
}
