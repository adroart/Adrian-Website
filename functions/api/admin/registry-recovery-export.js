/**
 * GET /api/admin/registry-recovery-export
 *
 * Downloads the encrypted, complete private registry recovery artifact. This
 * route is intentionally separate from the secret-free issuance ledger and is
 * never connected to its Google Drive sync.
 */
import { jsonResponse, requireDb, requireRegistryUnlock } from '../_lib/admin.js';
import { isMissingTableError, migrationNotApplied } from '../_lib/keeper.js';
import { buildPrivateRecoveryExport } from '../_lib/registryRecoveryExport.js';

export async function onRequest({ request, env }) {
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.REGISTRY_RECOVERY_EXPORT_KEY || !env.REGISTRY_RECOVERY_EXPORT_KEY_ID) {
    return jsonResponse({ ok: false, error: 'registry_recovery_export_not_configured' }, 503);
  }

  const exportedAt = new Date().toISOString();
  try {
    const archive = await buildPrivateRecoveryExport(env, { exportedAt });
    const safeStamp = exportedAt.replace(/:/g, '-');
    return new Response(JSON.stringify(archive), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.adrian.registry-recovery+json; charset=utf-8',
        'Content-Disposition': `attachment; filename="registry-private-recovery-${safeStamp}.json"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (isMissingTableError(error) || /no such (?:table|column)/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    if (/registry_recovery_export_not_configured|recovery_key_invalid/.test(String(error?.message || ''))) {
      return jsonResponse({ ok: false, error: 'registry_recovery_export_not_configured' }, 503);
    }
    return jsonResponse({ ok: false, error: 'registry_recovery_export_failed' }, 500);
  }
}
