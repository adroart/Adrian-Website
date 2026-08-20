/**
 * Admin API for the live QR inventory shown on the private /qr page.
 *
 * Merges the legacy static entries in data/qrRegistry.ts (oracle plaques
 * printed before the artwork registry existed) with every modern artwork
 * QR code issued through /admin/register, which lives in the shared D1
 * `keeper_pieces` table. This is a read-only listing with no secrets in
 * it (no hashes, no ownership data), so it mirrors the guards on
 * functions/api/admin/overview.js: admin session required, registry
 * unlock NOT required.
 *
 *   GET /api/admin/qr-index → { ok, entries }
 */
import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { QR_REGISTRY } from '../../../data/qrRegistry.ts';

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const legacyEntries = QR_REGISTRY.map((entry) => ({
    source: 'legacy',
    code: entry.code,
    type: entry.type,
    label: entry.label,
    destination: entry.destination,
    createdAt: entry.created,
  }));

  try {
    const { results } = await env.DB.prepare(
      `SELECT public_code, piece_id, plate_status, registration_status, registered_at
         FROM keeper_pieces
        WHERE public_code LIKE 'AR-%'
        ORDER BY registered_at ASC`,
    ).all();

    const artworkEntries = (results || []).map((row) => ({
      source: 'registry',
      code: row.public_code,
      type: 'artwork',
      pieceId: row.piece_id,
      plateStatus: row.plate_status || 'legacy',
      registrationStatus: row.registration_status || null,
      registeredAt: row.registered_at || null,
    }));

    return jsonResponse({ ok: true, entries: [...legacyEntries, ...artworkEntries] });
  } catch {
    return jsonResponse({ ok: false, error: 'qr_index_incomplete' }, 503);
  }
}
