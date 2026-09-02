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
    const identityAvailable = row?.registration_status === 'registered';
    const plateAvailable = ['generated', 'active'].includes(row?.plate_status);

    if (request.method === 'GET') {
      // Which encrypted copy the administrator is archiving. The identity
      // envelope is its own artifact with its own prefix and digest, and the
      // claim path's qualification is scoped to it, so it needs its own
      // download. Default matches verify-recovery's: identity before a plate
      // exists, plate once one does.
      const requested = new URL(request.url).searchParams.get('kind');
      if (requested !== null && !['identity', 'plate'].includes(requested)) {
        return jsonResponse({ ok: false, error: 'invalid_backup_kind' }, 400);
      }
      const kind = requested || (identityAvailable && !plateAvailable ? 'identity' : 'plate');
      if (kind === 'identity') {
        if (!identityAvailable) {
          return jsonResponse({ ok: false, error: 'identity_not_registered' }, 404);
        }
        return downloadBackupCopy(env, row, IDENTITY_COPY);
      }
      if (!plateAvailable) return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
      return downloadBackupCopy(env, row, PLATE_COPY);
    }

    if (!row || !plateAvailable) {
      return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
    }

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

/* The two encrypted copies an administrator can archive. Each names the
 * columns that carry its status, object reference and digest, the object
 * prefix its reference must match, the audit action, and the filename the
 * download lands under. */
const PLATE_COPY = {
  statusColumn: 'backup_status',
  referenceColumn: 'backup_reference',
  digestColumn: 'backup_sha256',
  prefix: 'plates',
  auditAction: 'download_recovery_copy',
  filenameSuffix: 'encrypted-recovery',
};

const IDENTITY_COPY = {
  statusColumn: 'identity_backup_status',
  referenceColumn: 'identity_backup_reference',
  digestColumn: 'identity_backup_sha256',
  prefix: 'identities',
  auditAction: 'download_identity_recovery_copy',
  filenameSuffix: 'encrypted-identity-recovery',
};

async function downloadBackupCopy(env, row, copy) {
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'backup_not_configured' }, 503);
  }
  const status = row[copy.statusColumn];
  const reference = row[copy.referenceColumn];
  const digestOfRecord = row[copy.digestColumn];
  if (
    status !== 'verified'
    || typeof digestOfRecord !== 'string'
    || !/^[0-9a-f]{64}$/.test(digestOfRecord)
    || reference !== `${copy.prefix}/${row.public_code}/${digestOfRecord}.json`
  ) {
    return jsonResponse({ ok: false, error: 'verified_backup_required' }, 409);
  }
  try {
    await writeOwnershipAudit(env, {
      keeperPieceId: row.id,
      action: copy.auditAction,
      outcome: 'authorized',
    });
  } catch {
    return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
  }
  try {
    const stored = await env.ARTWORK_REGISTRY_BACKUP.get(reference);
    if (!stored) return jsonResponse({ ok: false, error: 'backup_unavailable' }, 503);
    const bytes = await readBackupObjectBytes(stored);
    const digest = await backupDocumentSha256(bytes);
    if (!constantTimeEqual(digest, digestOfRecord)) {
      return jsonResponse({ ok: false, error: 'backup_digest_mismatch' }, 409);
    }
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${row.public_code}-${copy.filenameSuffix}.json"`,
        'Cache-Control': 'no-store',
        'X-Backup-Sha256': digestOfRecord,
      },
    });
  } catch {
    return jsonResponse({ ok: false, error: 'backup_unavailable' }, 503);
  }
}
