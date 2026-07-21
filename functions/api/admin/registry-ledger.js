/**
 * /api/admin/registry-ledger
 *
 *   GET  — download the offline MASTER ledger: a deterministic, hash-chained
 *          JSONL file that is the canonical record of every issued plate
 *          identity and its append-only lineage. The online D1 database is a
 *          mirror that can be rebuilt from this file
 *          (utils/registryLedger.buildRebuildSql).
 *
 *   POST — sync that same ledger to Adrian's Google Drive, so the master copy is
 *          captured automatically with no manual download. Fails closed (503)
 *          until the Drive credentials are provisioned.
 *
 * The export carries NO plaintext Ownership Code and NO steward identity, email,
 * IP, or display location — only the recovery-code hash, the encrypted envelope,
 * the fabrication-file hashes, and the public lineage events. Both methods are
 * gated by the registry step-up unlock, like every sensitive plate operation.
 */
import { jsonResponse, requireRegistryUnlock, requireDb } from '../_lib/admin.js';
import { isMissingTableError, migrationNotApplied } from '../_lib/keeper.js';
import { buildLedgerFile } from '../_lib/registryLedgerExport.js';
import { isDriveSyncConfigured, syncLedgerToDrive } from '../_lib/driveSync.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    if (request.method === 'GET') {
      const { body } = await buildLedgerFile(env);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Content-Disposition': 'attachment; filename="registry-ledger.jsonl"',
          'Cache-Control': 'no-store',
        },
      });
    }

    // POST → Google Drive sync
    if (!isDriveSyncConfigured(env)) {
      return jsonResponse({ ok: false, error: 'drive_not_configured' }, 503);
    }
    const { body, lineCount, headHash } = await buildLedgerFile(env);
    const result = await syncLedgerToDrive(env, body);
    if (!result.ok) {
      return jsonResponse({ ok: false, error: `drive_sync_${result.reason || 'failed'}` }, 502);
    }
    return jsonResponse({
      ok: true,
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      updated: result.updated,
      lineCount,
      headHash,
    });
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    return jsonResponse({ ok: false, error: 'ledger_export_failed' }, 500);
  }
}
