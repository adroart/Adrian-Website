import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { isMissingTableError } from '../_lib/keeper.js';

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const [plates, viewings, invoices] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM keeper_pieces WHERE COALESCE(plate_status, 'legacy') != 'active' OR COALESCE(backup_status, 'missing') != 'verified'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM viewings WHERE status = 'draft'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM invoices WHERE status IN ('draft', 'sent')").first(),
    ]);

    return jsonResponse({
      ok: true,
      attention: {
        plates: Number(plates?.count || 0),
        draftViewings: Number(viewings?.count || 0),
        openInvoices: Number(invoices?.count || 0),
      },
    });
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return jsonResponse({ ok: true, attention: null });
    }
    return jsonResponse({ ok: false, error: 'overview_failed' }, 500);
  }
}
