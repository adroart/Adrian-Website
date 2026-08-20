/**
 * /api/admin/records/export
 *
 *   GET  — download the archive of every current public Piece Record as one
 *          deterministic STORE-only zip (piece-records.zip): the newest
 *          record per piece at records/{publicCode}.html plus a
 *          records/index.html front door.
 *
 *   POST — mirror that same zip to Adrian's Google Drive as the managed file
 *          piece-records.zip, updated in place with Drive's own revision
 *          history, exactly the registry-ledger.js pattern (GET = download,
 *          POST = Drive sync). Fails closed (503) until the Drive
 *          credentials are provisioned.
 *
 * Every stored record already passed the pieceRecord.js privacy strip-pass,
 * so the archive is public-safe and travels unencrypted, unlike the private
 * recovery export. Both methods are still gated by the registry step-up
 * unlock, like every other registry-wide admin operation.
 */
import { jsonResponse, requireRegistryUnlock, requireDb } from '../../_lib/admin.js';
import { isMissingTableError, migrationNotApplied } from '../../_lib/keeper.js';
import { buildPieceRecordsArchive, RECORDS_ARCHIVE_FILENAME } from '../../_lib/recordArchive.js';
import { isDriveSyncConfigured, syncRecordsArchiveToDrive } from '../../_lib/driveSync.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'records_bucket_not_configured' }, 503);
  }

  try {
    if (request.method === 'GET') {
      const { bytes } = await buildPieceRecordsArchive(env);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${RECORDS_ARCHIVE_FILENAME}"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // POST → Google Drive mirror
    if (!isDriveSyncConfigured(env)) {
      return jsonResponse({ ok: false, error: 'drive_not_configured' }, 503);
    }
    const { bytes, pieces } = await buildPieceRecordsArchive(env);
    const result = await syncRecordsArchiveToDrive(env, bytes);
    if (!result.ok) {
      return jsonResponse({ ok: false, error: `drive_sync_${result.reason || 'failed'}` }, 502);
    }
    return jsonResponse({
      ok: true,
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      updated: result.updated,
      pieceCount: pieces.length,
      byteLength: bytes.byteLength,
    });
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    if (/record_object_missing/.test(String(error?.message || ''))) {
      return jsonResponse({ ok: false, error: 'record_object_missing' }, 500);
    }
    return jsonResponse({ ok: false, error: 'records_export_failed' }, 500);
  }
}
