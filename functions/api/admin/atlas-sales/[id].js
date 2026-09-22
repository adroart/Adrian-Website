/**
 * POST /api/admin/atlas-sales/:id — confirm one pending atlas sale.
 *
 * :id is the sale_id (Stripe checkout session id). Body: { pieceId,
 * editionNumber }. Admin-only. Reject and edit are deliberately not built
 * here (task scope: confirm only) — a dismiss/edit surface is a separate
 * follow-up, same as the retired mandalacodes queue kept them as separate
 * endpoints. The response reports registrationStatus "registered" only when
 * an existing canonical identity was found. Otherwise it reports "pending";
 * this endpoint never creates identity or recovery proof.
 */

import { jsonResponse, requireAdmin, requireDb } from '../../_lib/admin.js';
import { confirmPendingAtlasSale } from '../../_lib/atlasSaleConfirm.js';

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,255}$/;

const ERROR_STATUS = {
  db_not_configured: 503,
  migration_not_applied: 503,
  missing_sale_id: 400,
  missing_piece_id: 400,
  invalid_edition_number: 400,
  sale_not_found: 404,
  sale_already_resolved: 409,
};

export async function onRequest({ request, env, params }) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const saleId = params?.id;
  if (typeof saleId !== 'string' || !ID_PATTERN.test(saleId)) {
    return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const pieceId = typeof body.pieceId === 'string' ? body.pieceId.trim() : '';
  if (!pieceId) return jsonResponse({ ok: false, error: 'missing_piece_id' }, 400);
  const editionNumber = body.editionNumber === undefined || body.editionNumber === null
    ? undefined
    : body.editionNumber;
  if (!Number.isSafeInteger(editionNumber)) {
    return jsonResponse({ ok: false, error: 'invalid_edition_number' }, 400);
  }

  try {
    const result = await confirmPendingAtlasSale(env, { saleId, pieceId, editionNumber });
    return jsonResponse(result, 200);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'atlas_sale_confirm_failed';
    const status = ERROR_STATUS[code] ?? 500;
    return jsonResponse({ ok: false, error: code }, status);
  }
}
