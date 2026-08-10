import {
  appendReconnectionEvent,
  correctVerifiedSale,
  getArtistSaleDetail,
  identifyArtworkRecord,
  linkArtworkIdentity,
} from '../../_lib/artistSales.js';
import { jsonResponse, requireDb, requireRegistryUnlock } from '../../_lib/admin.js';
import {
  exactKeys,
  mappedError,
  normalizeIdempotencyKey,
  readStrictJson,
  safeDetail,
  safeMutationResult,
  validPrivateId,
} from '../collector-sales.js';

async function authorize(request, env) {
  const administrator = await requireRegistryUnlock(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  return missingDb || administrator;
}

function authority(administrator) {
  return { userId: administrator.userId, email: administrator.email };
}

function ownsArtwork(detail, artworkRecordId) {
  return detail.items.some((item) => item.artworkRecordId === artworkRecordId);
}

export async function onRequest({ request, env, params }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const administrator = await authorize(request, env);
  if (administrator instanceof Response) return administrator;
  const id = params?.id;
  if (!validPrivateId(id)) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);

  if (request.method === 'GET') {
    try {
      return jsonResponse({ ok: true, ...safeDetail(await getArtistSaleDetail(env, id)) });
    } catch (error) { return mappedError(error); }
  }

  let body;
  try { body = await readStrictJson(request); } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const key = normalizeIdempotencyKey(body?.idempotencyKey);
  if (!key) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  const administratorInput = authority(administrator);
  const now = new Date().toISOString();
  try {
    let result;
    if (body.action === 'addReconnectionNote' && exactKeys(body, [
      'action', 'reconnectionCaseId', 'note', 'idempotencyKey',
    ])) {
      result = await appendReconnectionEvent(env, {
        reconnectionCaseId: body.reconnectionCaseId, eventType: 'note_added',
        privateNote: body.note, artworkRecordId: null, newStatus: null,
        idempotencyKey: key, administrator: administratorInput, createdAt: now,
      });
    } else if (body.action === 'recordReconnectionEmail' && exactKeys(body, [
      'action', 'reconnectionCaseId', 'note', 'idempotencyKey',
    ])) {
      result = await appendReconnectionEvent(env, {
        reconnectionCaseId: body.reconnectionCaseId, eventType: 'email_sent',
        privateNote: body.note === null ? 'Manual email activity recorded.' : body.note,
        artworkRecordId: null, newStatus: null, idempotencyKey: key,
        administrator: administratorInput, createdAt: now,
      });
    } else if (body.action === 'changeReconnectionStatus' && exactKeys(body, [
      'action', 'reconnectionCaseId', 'newStatus', 'idempotencyKey',
    ])) {
      result = await appendReconnectionEvent(env, {
        reconnectionCaseId: body.reconnectionCaseId, eventType: 'status_changed',
        privateNote: null, artworkRecordId: null, newStatus: body.newStatus,
        idempotencyKey: key, administrator: administratorInput, createdAt: now,
      });
    } else if (body.action === 'correctSale' && exactKeys(body, [
      'action', 'expectedSequence', 'occurrence', 'buyerEmail', 'total',
      'privateReference', 'privateNotes', 'reason', 'idempotencyKey',
    ])) {
      const detail = await getArtistSaleDetail(env, id);
      result = await correctVerifiedSale(env, {
        saleId: id, expectedSequence: body.expectedSequence,
        replacement: {
          reconnectionCaseId: detail.sale.reconnectionCaseId,
          occurrence: body.occurrence, buyerEmail: body.buyerEmail, total: body.total,
          privateReference: body.privateReference, privateNotes: body.privateNotes,
        },
        reason: body.reason, idempotencyKey: key, administrator: administratorInput,
        correctedAt: now,
      });
    } else if (body.action === 'identifyArtwork' && exactKeys(body, [
      'action', 'artworkRecordId', 'artworkId', 'edition', 'expectedVersion', 'idempotencyKey',
    ])) {
      const detail = await getArtistSaleDetail(env, id);
      if (!ownsArtwork(detail, body.artworkRecordId)) {
        return jsonResponse({ ok: false, error: 'artwork_record_not_found' }, 404);
      }
      result = await identifyArtworkRecord(env, {
        artworkRecordId: body.artworkRecordId, artworkId: body.artworkId,
        edition: body.edition, expectedVersion: body.expectedVersion, idempotencyKey: key,
        administrator: administratorInput, identifiedAt: now,
      });
    } else if (body.action === 'linkIdentity' && exactKeys(body, [
      'action', 'artworkRecordId', 'keeperPieceId', 'expectedVersion', 'idempotencyKey',
    ])) {
      const detail = await getArtistSaleDetail(env, id);
      if (!ownsArtwork(detail, body.artworkRecordId)) {
        return jsonResponse({ ok: false, error: 'artwork_record_not_found' }, 404);
      }
      result = await linkArtworkIdentity(env, {
        artworkRecordId: body.artworkRecordId, keeperPieceId: body.keeperPieceId,
        expectedVersion: body.expectedVersion, idempotencyKey: key,
        administrator: administratorInput, linkedAt: now,
      });
    } else {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
    }
    return jsonResponse(
      { ok: true, result: safeMutationResult(body.action, result) },
      result.replayed ? 200 : 201,
    );
  } catch (error) { return mappedError(error); }
}
