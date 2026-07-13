import {
  jsonResponse,
  requireAdminPostStepUp,
  requireDb,
} from '../../../_lib/admin.js';
import {
  backupPlateEnvelope,
  recordPlateBackupResult,
} from '../../../_lib/plateBackup.js';

export async function onRequest({ request, env, params }) {
  const authorization = await requireAdminPostStepUp(request, env);
  if (authorization.response) return authorization.response;
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
