import {
  createReconnectionCase,
  createVerifiedSale,
  listArtistSaleWorkspace,
} from '../_lib/artistSales.js';
import { jsonResponse, requireDb, requireRegistryUnlock } from '../_lib/admin.js';

const JSON_LIMIT = 96 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CASE_STATUSES = new Set(['open', 'partially_resolved', 'resolved', 'closed']);
const IDENTIFICATION_STATUSES = new Set(['unresolved', 'identified', 'identity_linked']);

export function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

export function normalizeIdempotencyKey(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key && key.length <= 256 ? key : null;
}

export function validPrivateId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export async function readStrictJson(request) {
  if (request.headers.get('Content-Type') !== 'application/json') {
    throw Object.assign(new Error(), { code: 'invalid_json' });
  }
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^(?:0|[1-9]\d*)$/.test(declared)
    || Number(declared) > JSON_LIMIT)) throw Object.assign(new Error(), { code: 'invalid_json' });
  if (!request.body) throw Object.assign(new Error(), { code: 'invalid_json' });
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error();
      length += value.byteLength;
      if (length > JSON_LIMIT) throw new Error();
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* best effort */ }
    throw Object.assign(new Error(), { code: 'invalid_json' });
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch {
    throw Object.assign(new Error(), { code: 'invalid_json' });
  }
}

const VALIDATION_ERRORS = new Set([
  'invalid_request', 'invalid_money', 'invalid_artwork_record_id', 'unsupported_media_type',
  'invalid_media_size', 'invalid_media_source',
]);
const MISSING_ERRORS = new Set([
  'sale_not_found', 'artwork_record_not_found', 'artwork_not_found', 'keeper_identity_not_found',
  'reconnection_case_not_found',
]);
const CONFLICT_ERRORS = new Set([
  'idempotency_conflict', 'version_conflict', 'artwork_identity_mismatch',
]);
const RETRY_ERRORS = new Set([
  'atomic_write_unavailable', 'atomic_write_failed', 'media_upload_busy',
  'media_upload_timeout', 'media_backup_failed', 'media_backup_conflict',
  'media_metadata_failed', 'integrity_error',
]);

export function mappedError(error, fallback = 'artist_sales_failed') {
  const code = typeof error?.code === 'string' ? error.code : fallback;
  if (VALIDATION_ERRORS.has(code)) return jsonResponse({ ok: false, error: code }, 400);
  if (MISSING_ERRORS.has(code)) return jsonResponse({ ok: false, error: code }, 404);
  if (CONFLICT_ERRORS.has(code)) return jsonResponse({ ok: false, error: code }, 409);
  if (RETRY_ERRORS.has(code)) return jsonResponse({ ok: false, error: code }, 503);
  if (code === 'media_upload_cancelled') {
    return jsonResponse({ ok: false, error: 'media_upload_cancelled' }, 499);
  }
  return jsonResponse({ ok: false, error: fallback }, 500);
}

export function safeSale(sale) {
  return {
    saleId: sale.saleId,
    reconnectionCaseId: sale.reconnectionCaseId,
    occurrence: sale.occurrence,
    buyerEmail: sale.buyerEmail,
    total: sale.total,
    privateReference: sale.privateReference,
    privateNotes: sale.privateNotes,
    recordedAt: sale.recordedAt,
    sequence: sale.sequence,
    ...(Array.isArray(sale.identificationStatuses)
      ? { identificationStatuses: [...sale.identificationStatuses] } : {}),
  };
}

export function safeLedgerEntry(entry) {
  return {
    ledgerEntryId: entry.ledgerEntryId,
    message: entry.message,
    mediaId: entry.mediaId,
    createdAt: entry.createdAt,
    media: entry.media ? {
      role: entry.media.mediaRole,
      contentType: entry.media.contentType,
      byteLength: entry.media.byteLength,
    } : null,
  };
}

function safeSaleFacts(facts) {
  return {
    reconnectionCaseId: facts.reconnectionCaseId,
    occurrence: facts.occurrence,
    buyerEmail: facts.buyerEmail,
    total: facts.total,
    privateReference: facts.privateReference,
    privateNotes: facts.privateNotes,
    recordedAt: facts.recordedAt,
  };
}

export function safeDetail(detail) {
  return {
    sale: safeSale(detail.sale),
    originalSale: safeSale(detail.originalSale),
    effectiveSale: safeSale(detail.effectiveSale),
    corrections: detail.corrections.map((correction) => ({
      saleEventId: correction.saleEventId,
      sequence: correction.sequence,
      reason: correction.reason,
      createdAt: correction.createdAt,
      before: safeSaleFacts(correction.before),
      after: safeSaleFacts(correction.after),
    })),
    items: detail.items.map((item) => ({
      saleItemId: item.saleItemId,
      artworkRecordId: item.artworkRecordId,
      artworkId: item.artworkId,
      edition: item.edition,
      keeperPieceId: item.keeperPieceId,
      identificationStatus: item.identificationStatus,
      recordVersion: item.recordVersion,
      price: item.price,
      priceEntries: item.priceEntries.map((price) => ({
        priceEntryId: price.priceEntryId,
        amountMinor: price.amountMinor,
        currency: price.currency,
        occurrence: price.occurrence,
        recordedAt: price.recordedAt,
      })),
      ledgerEntries: item.ledgerEntries.map(safeLedgerEntry),
    })),
    events: detail.events.map((event) => ({
      saleEventId: event.saleEventId,
      sequence: event.sequence,
      eventType: event.eventType,
      reason: event.reason,
      createdAt: event.createdAt,
    })),
  };
}

export function safeMutationResult(action, result) {
  if (action === 'createReconnection') {
    return {
      reconnectionCaseId: result.reconnectionCaseId,
      recipientEmail: result.recipientEmail,
      status: result.status,
      replayed: result.replayed,
    };
  }
  if (action === 'createSale') {
    return {
      saleId: result.saleId,
      itemIds: [...result.itemIds],
      artworkRecordIds: [...result.artworkRecordIds],
      priceEntryIds: [...result.priceEntryIds],
      replayed: result.replayed,
    };
  }
  if (['addReconnectionNote', 'recordReconnectionEmail', 'changeReconnectionStatus'].includes(action)) {
    return {
      reconnectionEventId: result.reconnectionEventId,
      eventType: result.eventType,
      ...(result.status === undefined ? {} : { status: result.status }),
      replayed: result.replayed,
    };
  }
  if (action === 'correctSale') {
    return {
      saleEventId: result.saleEventId,
      saleId: result.saleId,
      sequence: result.sequence,
      reason: result.reason,
      replayed: result.replayed,
    };
  }
  if (['identifyArtwork', 'linkIdentity'].includes(action)) {
    return {
      artworkRecordId: result.artworkRecordId,
      identificationStatus: result.identificationStatus,
      artworkId: result.artworkId,
      edition: result.edition,
      keeperPieceId: result.keeperPieceId,
      recordVersion: result.recordVersion,
      replayed: result.replayed,
    };
  }
  if (['append', 'selectCertificateImage'].includes(action)) {
    return {
      ledgerEntryId: result.ledgerEntryId,
      artworkRecordId: result.artworkRecordId,
      saleId: result.saleId,
      message: result.message,
      mediaId: result.mediaId,
      replayed: result.replayed,
    };
  }
  if (action === 'appendSharedSaleMessage') {
    return {
      saleEventId: result.saleEventId,
      saleId: result.saleId,
      sequence: result.sequence,
      entries: result.entries.map((entry) => ({
        ledgerEntryId: entry.ledgerEntryId,
        artworkRecordId: entry.artworkRecordId,
      })),
      replayed: result.replayed,
    };
  }
  throw Object.assign(new Error(), { code: 'invalid_request' });
}

async function authorized(request, env) {
  const administrator = await requireRegistryUnlock(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  return administrator;
}

export function requireZeroSearchParams(url) {
  return new URL(url).searchParams.size === 0;
}

function readFilters(url) {
  const params = new URL(url).searchParams;
  const reconnectionCaseIds = params.getAll('reconnectionCaseId');
  if (reconnectionCaseIds.length > 0) {
    if (params.size !== 1 || reconnectionCaseIds.length !== 1
      || !validPrivateId(reconnectionCaseIds[0])) {
      throw Object.assign(new Error(), { code: 'invalid_request' });
    }
    return { reconnectionCaseId: reconnectionCaseIds[0] };
  }
  const allowed = new Set(['caseStatus', 'search', 'identificationStatus', 'limit', 'offset']);
  if ([...params.keys()].some((key) => !allowed.has(key) || params.getAll(key).length !== 1)) {
    throw Object.assign(new Error(), { code: 'invalid_request' });
  }
  const filters = {};
  for (const key of ['caseStatus', 'search', 'identificationStatus']) {
    if (!params.has(key)) continue;
    const value = params.get(key)?.trim();
    if (!value || (key === 'search' ? value.length > 200
      : key === 'caseStatus' ? !CASE_STATUSES.has(value)
        : !IDENTIFICATION_STATUSES.has(value))) {
      throw Object.assign(new Error(), { code: 'invalid_request' });
    }
    filters[key] = value;
  }
  for (const key of ['limit', 'offset']) {
    if (!params.has(key)) continue;
    const value = params.get(key);
    if (!/^(?:0|[1-9]\d*)$/.test(value || '')) {
      throw Object.assign(new Error(), { code: 'invalid_request' });
    }
    filters[key] = Number(value);
  }
  return filters;
}

function safeWorkspace(workspace) {
  return {
    sales: workspace.sales.map(safeSale),
    reconnectionCases: workspace.reconnectionCases.map((item) => ({
      reconnectionCaseId: item.reconnectionCaseId,
      recipientEmail: item.recipientEmail,
      recipientName: item.recipientName,
      privateContext: item.privateContext,
      status: item.status,
      createdAt: item.createdAt,
    })),
    pagination: {
      limit: workspace.pagination.limit,
      offset: workspace.pagination.offset,
      sales: {
        hasMore: workspace.pagination.sales.hasMore,
        nextOffset: workspace.pagination.sales.nextOffset,
      },
      reconnectionCases: {
        hasMore: workspace.pagination.reconnectionCases.hasMore,
        nextOffset: workspace.pagination.reconnectionCases.nextOffset,
      },
    },
  };
}

export async function onRequest({ request, env }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  if (request.method === 'POST' && !requireZeroSearchParams(request.url)) {
    return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  }
  const administrator = await authorized(request, env);
  if (administrator instanceof Response) return administrator;

  if (request.method === 'GET') {
    try {
      const workspace = safeWorkspace(await listArtistSaleWorkspace(env, readFilters(request.url)));
      return jsonResponse({ ok: true, ...workspace });
    } catch (error) { return mappedError(error); }
  }

  let body;
  try { body = await readStrictJson(request); } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const key = normalizeIdempotencyKey(body?.idempotencyKey);
  if (!key) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  const authority = { userId: administrator.userId, email: administrator.email };
  const recordedAt = new Date().toISOString();
  try {
    let result;
    let status = 200;
    if (body.action === 'createReconnection'
      && exactKeys(body, ['action', 'recipientEmail', 'recipientName', 'privateContext', 'idempotencyKey'])) {
      result = await createReconnectionCase(env, {
        recipientEmail: body.recipientEmail, recipientName: body.recipientName,
        privateContext: body.privateContext, idempotencyKey: key,
        administrator: authority, createdAt: recordedAt,
      });
      status = result.replayed ? 200 : 201;
    } else if (body.action === 'createSale' && exactKeys(body, [
      'action', 'occurrence', 'buyerEmail', 'total', 'privateReference', 'privateNotes',
      'reconnectionCaseId', 'artworks', 'idempotencyKey',
    ])) {
      result = await createVerifiedSale(env, {
        occurrence: body.occurrence, buyerEmail: body.buyerEmail, total: body.total,
        privateReference: body.privateReference, privateNotes: body.privateNotes,
        reconnectionCaseId: body.reconnectionCaseId, artworks: body.artworks,
        idempotencyKey: key, administrator: authority, recordedAt,
      });
      status = result.replayed ? 200 : 201;
    } else {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
    }
    return jsonResponse({ ok: true, result: safeMutationResult(body.action, result) }, status);
  } catch (error) { return mappedError(error); }
}
