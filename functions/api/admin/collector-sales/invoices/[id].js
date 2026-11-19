import { jsonResponse, requireDb, requireRegistryUnlock } from '../../../_lib/admin.js';
import { loadPaidInvoiceReview, reviewPaidInvoice } from '../../../_lib/paidInvoiceSale.js';
import { exactKeys, readStrictJson, requireZeroSearchParams } from '../../collector-sales.js';

const errorStatus = {
  invalid_request: 400, invalid_json: 400, invalid_edition: 400, invalid_money: 400,
  invoice_not_found: 404, artwork_not_found: 404,
  invoice_not_paid: 409, invoice_changed: 409, invoice_sale_conflict: 409, artwork_record_ambiguous: 409, existing_invoice_reference: 409,
};

export async function onRequest({ request, env, params }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const auth = await requireRegistryUnlock(request, env);
  if (auth instanceof Response) return auth;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const id = Number(params?.id);
  if (!/^[1-9]\d*$/.test(params?.id) || !Number.isSafeInteger(id) || !requireZeroSearchParams(request.url)) {
    return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  }
  try {
    if (request.method === 'GET') return jsonResponse({ ok: true, ...await loadPaidInvoiceReview(env, id) });
    const body = await readStrictJson(request);
    if (!exactKeys(body, ['revision', 'artworkId', 'edition', 'saleDate', 'artworkPriceCents', 'singleArtwork'])
      || !exactKeys(body.edition, body.edition?.kind === 'unique' ? ['kind'] : ['kind', 'number'])) {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
    }
    const result = await reviewPaidInvoice(env, id, body, { userId: auth.userId, email: auth.email }, new Date().toISOString());
    return jsonResponse({ ok: true, result });
  } catch (error) {
    const status = Object.hasOwn(errorStatus, error?.code) ? errorStatus[error.code] : 503;
    return jsonResponse({ ok: false, error: status === 503 ? 'invoice_review_unavailable' : error.code }, status);
  }
}
