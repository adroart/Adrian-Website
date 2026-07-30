import {
  jsonResponse,
  requireRegistryUnlock,
  requireDb,
  constantTimeEqual,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import {
  backupDocumentSha256,
  readBackupObjectBytes,
} from '../../../_lib/plateBackup.js';
import { backupRegistryPlate } from '../../../_lib/registryPlateIssuance.js';

export async function onRequest({ request, env, params }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }
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

    if (request.method === 'GET') return downloadBackupCopy(env, row);

    const result = await backupRegistryPlate(env, row);
    if (result.warning === 'backup_status_record_failed') {
      return jsonResponse({ ok: false, error: 'backup_status_record_failed' }, 500);
    }
    return jsonResponse(
      {
        ok: result.status === 'verified',
        backupStatus: result.status,
        backupReference: row.backup_reference || null,
        backupSha256: row.backup_sha256 || null,
      },
      result.status === 'verified' ? 200 : 503,
    );
  } catch {
    return jsonResponse({ ok: false, error: 'backup_retry_failed' }, 500);
  }
}

async function downloadBackupCopy(env, row) {
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'backup_not_configured' }, 503);
  }
  if (
    row.backup_status !== 'verified'
    || typeof row.backup_sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(row.backup_sha256)
    || row.backup_reference !== `plates/${row.public_code}/${row.backup_sha256}.json`
  ) {
    return jsonResponse({ ok: false, error: 'verified_backup_required' }, 409);
  }
  try {
    await writeOwnershipAudit(env, {
      keeperPieceId: row.id,
      action: 'download_recovery_copy',
      outcome: 'authorized',
    });
  } catch {
    return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
  }
  try {
    const stored = await env.ARTWORK_REGISTRY_BACKUP.get(row.backup_reference);
    if (!stored) return jsonResponse({ ok: false, error: 'backup_unavailable' }, 503);
    const bytes = await readBackupObjectBytes(stored);
    const digest = await backupDocumentSha256(bytes);
    if (!constantTimeEqual(digest, row.backup_sha256)) {
      return jsonResponse({ ok: false, error: 'backup_digest_mismatch' }, 409);
    }
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${row.public_code}-encrypted-recovery.json"`,
        'Cache-Control': 'no-store',
        'X-Backup-Sha256': row.backup_sha256,
      },
    });
  } catch {
    return jsonResponse({ ok: false, error: 'backup_unavailable' }, 503);
  }
}
