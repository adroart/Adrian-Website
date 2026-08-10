import { storeArtworkLedgerMedia } from '../../_lib/artworkLedgerMedia.js';
import { jsonResponse, requireDb, requireRegistryUnlock } from '../../_lib/admin.js';
import {
  mappedError,
  normalizeIdempotencyKey,
  requireZeroSearchParams,
  validPrivateId,
} from '../collector-sales.js';

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MEDIA_ROLES = new Set(['identification_evidence', 'certificate_image']);
const ALLOWED_ARTWORK_HEADERS = new Set([
  'x-artwork-record-id', 'x-artwork-media-role',
]);

function canonicalLength(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) && length <= MAX_MEDIA_BYTES ? length : null;
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function mediaIdentityId(userId, idempotencyKey) {
  const mediaDigest = await digest(JSON.stringify({
    namespace: 'artist-artwork-media-idempotency-v1',
    userId,
    idempotencyKey,
  }));
  return `media-${mediaDigest.slice(0, 32)}`;
}

function safeMedia(row) {
  return {
    id: row.id,
    artworkRecordId: row.artwork_record_id,
    role: row.media_role,
    contentType: row.content_type,
    byteLength: Number(row.byte_length),
    createdAt: row.created_at,
  };
}

function exactStored(row, expected) {
  return row
    && row.id === expected.id
    && row.artwork_record_id === expected.artworkRecordId
    && row.media_role === expected.role
    && row.storage_reference === expected.reference
    && row.sha256 === expected.sha256
    && row.content_type === expected.contentType
    && Number(row.byte_length) === expected.byteLength
    && row.uploaded_by_user_id === expected.userId;
}

function exactHeaders(row, expected) {
  return row
    && row.id === expected.id
    && row.artwork_record_id === expected.artworkRecordId
    && row.media_role === expected.role
    && row.content_type === expected.contentType
    && Number(row.byte_length) === expected.byteLength
    && row.uploaded_by_user_id === expected.userId;
}

async function findById(env, id) {
  return env.DB.prepare(`
    SELECT id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at
      FROM artist_artwork_media WHERE id = ?1 LIMIT 1
  `).bind(id).first();
}

async function findExisting(env, id, reference) {
  return env.DB.prepare(`
    SELECT id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at
      FROM artist_artwork_media
     WHERE id = ?1 OR storage_reference = ?2 LIMIT 1
  `).bind(id, reference).first();
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  if (!requireZeroSearchParams(request.url)) {
    return jsonResponse({ ok: false, error: 'invalid_request' }, 400);
  }
  const administrator = await requireRegistryUnlock(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'backup_not_configured' }, 503);
  }

  const unexpectedAuthorityHeader = [...request.headers.keys()].some((name) => (
    name.startsWith('x-artwork-') && !ALLOWED_ARTWORK_HEADERS.has(name)
  ));
  const artworkRecordId = request.headers.get('X-Artwork-Record-Id');
  const role = request.headers.get('X-Artwork-Media-Role');
  const key = normalizeIdempotencyKey(request.headers.get('X-Idempotency-Key'));
  const contentType = request.headers.get('Content-Type');
  const contentLength = canonicalLength(request.headers.get('X-Content-Length'));
  const platformLengthHeader = request.headers.get('Content-Length');
  const platformLength = platformLengthHeader === null ? null : canonicalLength(platformLengthHeader);
  if (unexpectedAuthorityHeader || !validPrivateId(artworkRecordId)
    || !MEDIA_ROLES.has(role) || !key || !CONTENT_TYPES.has(contentType)
    || contentLength === null || (platformLengthHeader !== null && platformLength !== contentLength)
    || !request.body) {
    return jsonResponse({ ok: false, error: 'invalid_media_upload' }, 400);
  }

  try {
    const id = await mediaIdentityId(administrator.userId, key);
    const headerExpectation = {
      id, artworkRecordId, role, contentType, byteLength: contentLength,
      userId: administrator.userId,
    };
    let keyedExisting;
    try { keyedExisting = await findById(env, id); } catch {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }
    if (keyedExisting && !exactHeaders(keyedExisting, headerExpectation)) {
      return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
    }

    const artwork = await env.DB.prepare(
      'SELECT id FROM artist_artwork_records WHERE id = ?1',
    ).bind(artworkRecordId).first();
    if (!artwork) return jsonResponse({ ok: false, error: 'artwork_record_not_found' }, 404);

    const verified = await storeArtworkLedgerMedia(env.ARTWORK_REGISTRY_BACKUP, {
      artworkRecordId,
      source: request.body,
      contentLength,
      contentType,
      signal: request.signal,
    });
    const expected = {
      id, artworkRecordId, role, reference: verified.reference,
      sha256: verified.sha256, contentType: verified.contentType,
      byteLength: verified.byteLength, userId: administrator.userId,
    };
    let existing;
    try { existing = keyedExisting || await findExisting(env, id, verified.reference); } catch {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }
    if (existing) {
      if (!exactStored(existing, expected)) {
        return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
      }
      return new Response(JSON.stringify({ media: safeMedia(existing), replayed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const createdAt = new Date().toISOString();
    try {
      const inserted = await env.DB.prepare(`
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `).bind(
        id, artworkRecordId, role, verified.reference, verified.sha256,
        verified.contentType, verified.byteLength, administrator.userId, createdAt,
      ).run();
      if (inserted?.success === false) throw new Error('metadata_insert_failed');
    } catch {
      let concurrent;
      try { concurrent = await findExisting(env, id, verified.reference); } catch {
        return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
      }
      if (concurrent) {
        if (!exactStored(concurrent, expected)) {
          return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
        }
        return new Response(JSON.stringify({ media: safeMedia(concurrent), replayed: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }

    return new Response(JSON.stringify({
      media: safeMedia({
        id, artwork_record_id: artworkRecordId, media_role: role,
        content_type: verified.contentType, byte_length: verified.byteLength, created_at: createdAt,
      }),
      replayed: false,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return mappedError(error, 'media_upload_failed');
  }
}
