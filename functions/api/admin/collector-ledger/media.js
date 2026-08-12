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
const MEDIA_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
]);
const ALLOWED_ARTWORK_HEADERS = new Set([
  'x-artwork-record-id', 'x-artwork-media-role',
]);
const STORED_MEDIA_KEYS = [
  'id', 'artwork_record_id', 'media_role', 'storage_reference', 'sha256',
  'content_type', 'byte_length', 'uploaded_by_user_id', 'created_at',
].sort();

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

function validStoredMediaRow(row) {
  try {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || Object.keys(row).sort().join('\0') !== STORED_MEDIA_KEYS.join('\0')) return false;
    const extension = MEDIA_EXTENSIONS.get(row.content_type);
    return validPrivateId(row.id)
      && validPrivateId(row.artwork_record_id)
      && MEDIA_ROLES.has(row.media_role)
      && typeof row.sha256 === 'string' && /^[0-9a-f]{64}$/.test(row.sha256)
      && typeof row.storage_reference === 'string'
      && row.storage_reference
        === `artwork-ledger/${row.artwork_record_id}/${row.sha256}.${extension}`
      && CONTENT_TYPES.has(row.content_type)
      && typeof row.byte_length === 'number' && Number.isSafeInteger(row.byte_length)
      && row.byte_length >= 1 && row.byte_length <= MAX_MEDIA_BYTES
      && validPrivateId(row.uploaded_by_user_id)
      && typeof row.created_at === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.created_at)
      && new Date(row.created_at).toISOString() === row.created_at;
  } catch { return false; }
}

function validArtworkRow(row, artworkRecordId) {
  try {
    return row && typeof row === 'object' && !Array.isArray(row)
      && Object.keys(row).length === 1 && row.id === artworkRecordId;
  } catch { return false; }
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

async function findByStorageReference(env, reference) {
  return env.DB.prepare(`
    SELECT id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at
      FROM artist_artwork_media WHERE storage_reference = ?1 LIMIT 1
  `).bind(reference).first();
}

function insertedExactlyOnce(result) {
  try {
    return result && typeof result === 'object' && !Array.isArray(result)
      && result.success === true
      && result.meta && typeof result.meta === 'object' && !Array.isArray(result.meta)
      && result.meta.changes === 1;
  } catch { return false; }
}

function replayResponse(row) {
  return new Response(JSON.stringify({ media: safeMedia(row), replayed: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function resolveMetadataRace(env, id, expected) {
  let row;
  try { row = await findById(env, id); } catch {
    return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
  }
  if (row !== null) {
    if (!validStoredMediaRow(row)) {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }
    if (!exactStored(row, expected)) {
      return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
    }
    return replayResponse(row);
  }

  let duplicate;
  try { duplicate = await findByStorageReference(env, expected.reference); } catch {
    return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
  }
  if (duplicate === null || !validStoredMediaRow(duplicate)) {
    return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
  }
  if (duplicate.id === id && exactStored(duplicate, expected)) {
    return replayResponse(duplicate);
  }
  return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
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
    if (keyedExisting !== null && !validStoredMediaRow(keyedExisting)) {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }
    if (keyedExisting && !exactHeaders(keyedExisting, headerExpectation)) {
      return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
    }

    let artwork;
    try {
      artwork = await env.DB.prepare(
        'SELECT id FROM artist_artwork_records WHERE id = ?1',
      ).bind(artworkRecordId).first();
    } catch {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }
    if (artwork === null) return jsonResponse({ ok: false, error: 'artwork_record_not_found' }, 404);
    if (!validArtworkRow(artwork, artworkRecordId)) {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }

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
    try { existing = keyedExisting || await findById(env, id); } catch {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }
    if (existing) {
      if (!validStoredMediaRow(existing)) {
        return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
      }
      if (!exactStored(existing, expected)) {
        return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
      }
      return replayResponse(existing);
    }
    if (existing !== null) {
      return jsonResponse({ ok: false, error: 'media_metadata_failed' }, 503);
    }

    const createdAt = new Date().toISOString();
    let inserted;
    try {
      inserted = await env.DB.prepare(`
        INSERT INTO artist_artwork_media
          (id, artwork_record_id, media_role, storage_reference, sha256,
           content_type, byte_length, uploaded_by_user_id, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `).bind(
        id, artworkRecordId, role, verified.reference, verified.sha256,
        verified.contentType, verified.byteLength, administrator.userId, createdAt,
      ).run();
    } catch {
      return resolveMetadataRace(env, id, expected);
    }
    if (!insertedExactlyOnce(inserted)) {
      return resolveMetadataRace(env, id, expected);
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
