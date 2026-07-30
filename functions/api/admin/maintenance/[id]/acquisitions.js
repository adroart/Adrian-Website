import { jsonResponse, requireDb, requireRegistryUnlock } from '../../../_lib/admin.js';
import { commitAcquisitionCreate } from '../../../_lib/registryMaintenance.js';

function statusFor(error) {
  if (error === 'idempotency_conflict') return 409;
  if (error === 'keeper_piece_not_found') return 404;
  if (error === 'maintenance_write_failed' || error === 'atomic_write_unavailable') return 503;
  return 400;
}

export async function onRequest({ request, env, params }) {
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const keeperPieceId = typeof params?.id === 'string' ? params.id.trim() : '';
  if (!keeperPieceId || keeperPieceId.length > 128) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !['idempotencyKey', 'reason', 'acquisition'].includes(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }

  const result = await commitAcquisitionCreate(env, {
    keeperPieceId,
    acquisition: body.acquisition,
    authorization,
    reason: body.reason,
    idempotencyKey: body.idempotencyKey,
  });
  if (!result.ok) return jsonResponse(result, statusFor(result.error));
  return jsonResponse(result, result.replayed ? 200 : 201);
}
