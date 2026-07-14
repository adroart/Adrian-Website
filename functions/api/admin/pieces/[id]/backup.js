import {
  jsonResponse,
  requireRegistryUnlock,
  requireDb,
} from '../../../_lib/admin.js';
import {
  backupPlateEnvelope,
  recordPlateBackupResult,
} from '../../../_lib/plateBackup.js';

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    const row = await env.DB.prepare(
      'SELECT * FROM keeper_pieces WHERE id = ?1',
    ).bind(params.id).first();
    if (!row || !['generated', 'active'].includes(row.plate_status)) {
      return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
    }

    const result = await backupPlateEnvelope(env.ARTWORK_REGISTRY_BACKUP, row);
    try {
      await recordPlateBackupResult(env.DB, row.id, result);
    } catch {
      return jsonResponse({ ok: false, error: 'backup_status_record_failed' }, 500);
    }
    return jsonResponse(
      { ok: result.status === 'verified', backupStatus: result.status, backupReference: result.reference },
      result.status === 'verified' ? 200 : 503,
    );
  } catch {
    return jsonResponse({ ok: false, error: 'backup_retry_failed' }, 500);
  }
}
