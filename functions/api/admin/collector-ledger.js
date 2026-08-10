import {
  appendArtworkLedgerEntry,
  appendSharedSaleMessage,
  getArtistSaleDetail,
} from '../_lib/artistSales.js';
import { jsonResponse, requireDb, requireRegistryUnlock } from '../_lib/admin.js';
import {
  exactKeys,
  mappedError,
  normalizeIdempotencyKey,
  readStrictJson,
  safeDetail,
  safeMutationResult,
  safeSale,
  validPrivateId,
} from './collector-sales.js';

function rows(result) { return Array.isArray(result?.results) ? result.results : []; }

async function authorize(request, env) {
  const administrator = await requireRegistryUnlock(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  return missingDb || administrator;
}

async function ledgerDetail(env, artworkRecordId) {
  const record = await env.DB.prepare(`
    SELECT id, artwork_id, edition_json, keeper_piece_id,
           identification_status, record_version, created_at, updated_at
      FROM artist_artwork_records WHERE id = ?1
  `).bind(artworkRecordId).first();
  if (!record) throw Object.assign(new Error(), { code: 'artwork_record_not_found' });
  const saleRow = await env.DB.prepare(`
    SELECT sale_id FROM artist_verified_sale_items
     WHERE artwork_record_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 1
  `).bind(artworkRecordId).first();
  let saleContext = null;
  if (saleRow?.sale_id) {
    const detail = safeDetail(await getArtistSaleDetail(env, saleRow.sale_id));
    saleContext = {
      sale: safeSale(detail.sale),
      item: detail.items.find((item) => item.artworkRecordId === artworkRecordId) || null,
      events: detail.events,
    };
  }
  const ledger = rows(await env.DB.prepare(`
    SELECT entry.id, entry.sale_id, entry.message, entry.media_id, entry.created_at,
           media.media_role, media.content_type, media.byte_length, media.sha256
      FROM artist_artwork_ledger_entries entry
      LEFT JOIN artist_artwork_media media ON media.id = entry.media_id
     WHERE entry.artwork_record_id = ?1
     ORDER BY entry.created_at, entry.id
  `).bind(artworkRecordId).all()).map((entry) => ({
    ledgerEntryId: entry.id,
    saleId: entry.sale_id,
    message: entry.message,
    mediaId: entry.media_id,
    createdAt: entry.created_at,
    media: entry.media_id ? {
      role: entry.media_role,
      contentType: entry.content_type,
      byteLength: Number(entry.byte_length),
      sha256: entry.sha256,
    } : null,
  }));
  const media = rows(await env.DB.prepare(`
    SELECT id, media_role, content_type, byte_length, sha256, created_at
      FROM artist_artwork_media WHERE artwork_record_id = ?1
     ORDER BY created_at, id
  `).bind(artworkRecordId).all()).map((item) => ({
    id: item.id,
    artworkRecordId,
    role: item.media_role,
    contentType: item.content_type,
    byteLength: Number(item.byte_length),
    sha256: item.sha256,
    createdAt: item.created_at,
  }));
  const selected = [...ledger].reverse().find((entry) => (
    entry.media?.role === 'certificate_image'
  )) || null;
  let edition = null;
  try { edition = record.edition_json === null ? null : JSON.parse(record.edition_json); } catch { edition = null; }
  return {
    artworkRecord: {
      artworkRecordId: record.id,
      artworkId: record.artwork_id,
      edition,
      keeperPieceId: record.keeper_piece_id,
      identificationStatus: record.identification_status,
      recordVersion: Number(record.record_version),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    },
    ledgerEntries: ledger,
    media,
    selectedCertificateImage: selected ? {
      ledgerEntryId: selected.ledgerEntryId,
      mediaId: selected.mediaId,
      selectedAt: selected.createdAt,
    } : null,
    saleContext,
  };
}

export async function onRequest({ request, env }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const administrator = await authorize(request, env);
  if (administrator instanceof Response) return administrator;

  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => key !== 'artworkRecordId')
      || params.getAll('artworkRecordId').length !== 1
      || !validPrivateId(params.get('artworkRecordId'))) {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
    }
    try {
      return jsonResponse({ ok: true, ...await ledgerDetail(env, params.get('artworkRecordId')) });
    } catch (error) { return mappedError(error, 'artist_ledger_failed'); }
  }

  let body;
  try { body = await readStrictJson(request); } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const key = normalizeIdempotencyKey(body?.idempotencyKey);
  if (!key) return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  const administratorInput = { userId: administrator.userId, email: administrator.email };
  const createdAt = new Date().toISOString();
  try {
    let result;
    if (body.action === 'append' && exactKeys(body, [
      'action', 'artworkRecordId', 'saleId', 'message', 'mediaId', 'idempotencyKey',
    ])) {
      result = await appendArtworkLedgerEntry(env, {
        artworkRecordId: body.artworkRecordId, saleId: body.saleId,
        message: body.message, mediaId: body.mediaId, idempotencyKey: key,
        administrator: administratorInput, createdAt,
      });
    } else if (body.action === 'appendSharedSaleMessage' && exactKeys(body, [
      'action', 'saleId', 'artworkRecordIds', 'message', 'idempotencyKey',
    ])) {
      const detail = await getArtistSaleDetail(env, body.saleId);
      result = await appendSharedSaleMessage(env, {
        saleId: body.saleId, artworkRecordIds: body.artworkRecordIds,
        message: body.message, expectedSequence: detail.sale.sequence,
        idempotencyKey: key, administrator: administratorInput, createdAt,
      });
    } else if (body.action === 'selectCertificateImage' && exactKeys(body, [
      'action', 'artworkRecordId', 'mediaId', 'idempotencyKey',
    ])) {
      const media = await env.DB.prepare(`
        SELECT id FROM artist_artwork_media
         WHERE id = ?1 AND artwork_record_id = ?2 AND media_role = 'certificate_image'
      `).bind(body.mediaId, body.artworkRecordId).first();
      if (!media) return jsonResponse({ ok: false, error: 'artwork_record_not_found' }, 404);
      result = await appendArtworkLedgerEntry(env, {
        artworkRecordId: body.artworkRecordId, saleId: null, message: null,
        mediaId: body.mediaId, idempotencyKey: key,
        administrator: administratorInput, createdAt,
      });
    } else {
      return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
    }
    return jsonResponse(
      { ok: true, result: safeMutationResult(body.action, result) },
      result.replayed ? 200 : 201,
    );
  } catch (error) { return mappedError(error, 'artist_ledger_failed'); }
}
