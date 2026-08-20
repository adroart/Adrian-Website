/**
 * Piece media admission: the "time capsule" media layer (migration 039,
 * table piece_media). Per-piece photos, forever videos, and artist message
 * audio are validated, hashed, written write-once and content-addressed to
 * the shared registry R2 bucket (binding ARTWORK_REGISTRY_BACKUP) at
 * media/{sha256}.{ext}, read back and byte-compared, then recorded in D1.
 * Media referenced from the self-contained Piece Record
 * (docs/piece-record-format.md) by the relative link mediaRelativePath()
 * returns, ../media/{sha256}.{ext}.
 *
 * The R2 admission lease (an etag-CAS single-writer gate on one private key)
 * mirrors functions/api/_lib/artworkLedgerMedia.js in shape: acquire by a
 * conditional put that only succeeds when no lease exists or the existing
 * lease has expired, release by a conditional put back to the observed etag.
 * This module is Web Crypto only (crypto.subtle, crypto.randomUUID) since
 * the caller already holds the complete media bytes in memory, so there is
 * no request-stream to consume chunk by chunk the way artworkLedgerMedia.js
 * does.
 */

const ADMISSION_KEY = 'media/_private/upload-admission';
const ADMISSION_LEASE_MS = 60_000;

const KIND_CONTENT_TYPES = new Map([
  ['photo', new Set(['image/jpeg', 'image/png', 'image/webp'])],
  ['video', new Set(['video/mp4'])],
  ['artist_message_audio', new Set(['audio/mpeg', 'audio/mp4'])],
]);
const KIND_BYTE_CAPS = new Map([
  ['photo', 10 * 1024 * 1024],
  ['video', 200 * 1024 * 1024],
  ['artist_message_audio', 20 * 1024 * 1024],
]);
const CONTENT_TYPE_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['video/mp4', 'mp4'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp4', 'm4a'],
]);

const ARTWORK_ID_PATTERN = /^[A-Z][A-Z]*-[0-9]{3}$/;

const PIECE_MEDIA_COLUMNS = `
  id, keeper_piece_id, artwork_id, kind, storage_reference, sha256,
  byte_length, content_type, created_at, removed_at, removed_reason
`;

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

function binaryView(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw codedError('invalid_piece_media_bytes');
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isConditionalPutError(error) {
  const property = (key) => { try { return error?.[key]; } catch { return undefined; } };
  return property('status') === 412 || property('statusCode') === 412
    || property('code') === 10031 || property('code') === '10031'
    || property('code') === 'PreconditionFailed' || property('name') === 'PreconditionFailed';
}

function parseLease(object) {
  try {
    if (!object || object.key !== ADMISSION_KEY || typeof object.etag !== 'string'
      || object.etag.length < 1 || object.etag.length > 256) throw new TypeError();
    const metadata = object.customMetadata;
    if (!metadata || typeof metadata !== 'object') throw new TypeError();
    if (Object.keys(metadata).sort().join(',') !== 'expiresAt,ownerToken,state,versionNonce') {
      throw new TypeError();
    }
    const { state, ownerToken, expiresAt, versionNonce } = metadata;
    if (state !== 'active' && state !== 'released') throw new TypeError();
    if (typeof ownerToken !== 'string' || ownerToken.length < 1 || ownerToken.length > 64) {
      throw new TypeError();
    }
    if (typeof expiresAt !== 'string' || !/^[0-9]{1,13}$/.test(expiresAt)) throw new TypeError();
    if (typeof versionNonce !== 'string' || versionNonce.length < 1 || versionNonce.length > 64) {
      throw new TypeError();
    }
    const expiry = Number(expiresAt);
    if (!Number.isSafeInteger(expiry) || String(expiry) !== expiresAt) throw new TypeError();
    return {
      etag: object.etag, state, ownerToken, expiresAt: expiry, versionNonce,
    };
  } catch { throw codedError('media_backup_failed'); }
}

function leaseRecord(state, ownerToken, expiresAt) {
  const metadata = {
    state, ownerToken, expiresAt: String(expiresAt), versionNonce: crypto.randomUUID(),
  };
  const body = new TextEncoder().encode(JSON.stringify(metadata));
  return { metadata, body };
}

async function putLease(bucket, onlyIf, record) {
  let result;
  try {
    result = await bucket.put(ADMISSION_KEY, record.body, {
      onlyIf, customMetadata: record.metadata,
    });
  } catch (error) {
    if (isConditionalPutError(error)) return null;
    throw codedError('media_backup_failed');
  }
  if (result === null) return null;
  if (result === undefined) throw codedError('media_backup_failed');
  const parsed = parseLease(result);
  const { metadata } = record;
  if (parsed.state !== metadata.state || parsed.ownerToken !== metadata.ownerToken
    || parsed.expiresAt !== Number(metadata.expiresAt)
    || parsed.versionNonce !== metadata.versionNonce) throw codedError('media_backup_failed');
  return parsed;
}

async function acquireAdmission(bucket) {
  const ownerToken = crypto.randomUUID();
  const expiresAt = Date.now() + ADMISSION_LEASE_MS;
  const record = leaseRecord('active', ownerToken, expiresAt);
  const initial = await putLease(bucket, { etagDoesNotMatch: '*' }, record);
  if (initial) return initial;

  let observed;
  try { observed = await bucket.head(ADMISSION_KEY); }
  catch { throw codedError('media_backup_failed'); }
  const current = parseLease(observed);
  if (current.state === 'active' && current.expiresAt > Date.now()) {
    throw codedError('media_upload_busy');
  }
  const takeover = await putLease(bucket, { etagMatches: current.etag }, record);
  if (!takeover) throw codedError('media_upload_busy');
  return takeover;
}

async function releaseAdmission(bucket, lease) {
  let observed;
  try { observed = await bucket.head(ADMISSION_KEY); }
  catch { throw codedError('media_backup_failed'); }
  const current = parseLease(observed);
  if (current.ownerToken !== lease.ownerToken || current.state !== 'active') {
    throw codedError('media_backup_failed');
  }
  const released = leaseRecord('released', lease.ownerToken, Date.now());
  const result = await putLease(bucket, { etagMatches: current.etag }, released);
  if (!result) throw codedError('media_backup_failed');
}

async function readAllBytes(body, expectedLength) {
  if (body instanceof Uint8Array) {
    if (body.byteLength !== expectedLength) throw codedError('media_backup_failed');
    return body;
  }
  if (!body || typeof body.getReader !== 'function') throw codedError('media_backup_failed');
  const reader = body.getReader();
  const aggregate = new Uint8Array(expectedLength);
  let offset = 0;
  try {
    while (true) {
      const read = await reader.read();
      if (read.done) break;
      const chunk = binaryView(read.value);
      if (offset + chunk.byteLength > expectedLength) throw codedError('media_backup_failed');
      aggregate.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  if (offset !== expectedLength) throw codedError('media_backup_failed');
  return aggregate;
}

async function verifyStored(bucket, expected) {
  let stored;
  try { stored = await bucket.get(expected.reference); }
  catch { throw codedError('media_backup_failed'); }
  if (!stored) throw codedError('media_backup_failed');
  let key;
  let size;
  let storedContentType;
  let body;
  try {
    ({ key, body } = stored);
    size = Number(stored.size);
    storedContentType = stored.httpMetadata?.contentType;
  } catch { throw codedError('media_backup_failed'); }
  if (key !== expected.reference || size !== expected.byteLength
    || storedContentType !== expected.contentType) {
    throw codedError('media_backup_failed');
  }
  const bytes = await readAllBytes(body, expected.byteLength);
  const sha256 = await sha256Hex(bytes);
  if (sha256 !== expected.sha256) throw codedError('media_backup_failed');
}

function rowShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    keeperPieceId: row.keeper_piece_id ?? null,
    artworkId: row.artwork_id ?? null,
    kind: row.kind,
    storageReference: row.storage_reference,
    sha256: row.sha256,
    byteLength: Number(row.byte_length),
    contentType: row.content_type,
    createdAt: row.created_at,
    removedAt: row.removed_at ?? null,
    removedReason: row.removed_reason ?? null,
  };
}

function findById(db, id) {
  return db.prepare(`SELECT ${PIECE_MEDIA_COLUMNS} FROM piece_media WHERE id = ?1`).bind(id).first();
}

function findBySha256(db, sha256) {
  return db.prepare(`SELECT ${PIECE_MEDIA_COLUMNS} FROM piece_media WHERE sha256 = ?1`).bind(sha256).first();
}

/** Relative link for the self-contained Piece Record: ../media/{sha256}.{ext}. */
export function mediaRelativePath(row) {
  const sha256 = row?.sha256;
  const contentType = row?.contentType ?? row?.content_type;
  const extension = CONTENT_TYPE_EXTENSIONS.get(contentType);
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256) || !extension) {
    throw codedError('invalid_piece_media_row');
  }
  return `../media/${sha256}.${extension}`;
}

/**
 * Admit one media file: validate, hash, write-once to R2, byte-verify, then
 * insert (or, for a duplicate, return) its D1 row. Idempotent by content:
 * the row id and the R2 key are both derived from the sha256 of the bytes,
 * so admitting the same bytes twice, for the same parent, returns the same
 * row without a second write.
 */
export async function admitPieceMedia(env, db, {
  keeperPieceId, artworkId, kind, contentType, bytes,
} = {}) {
  if (!db) throw codedError('db_not_configured');
  const hasKeeper = keeperPieceId !== undefined && keeperPieceId !== null;
  const hasArtwork = artworkId !== undefined && artworkId !== null;
  if (hasKeeper === hasArtwork) throw codedError('invalid_piece_media_parent');
  if (hasKeeper && (typeof keeperPieceId !== 'string' || !keeperPieceId.trim())) {
    throw codedError('invalid_piece_media_parent');
  }
  if (hasArtwork && (typeof artworkId !== 'string' || !ARTWORK_ID_PATTERN.test(artworkId))) {
    throw codedError('invalid_piece_media_parent');
  }
  const allowedTypes = KIND_CONTENT_TYPES.get(kind);
  if (!allowedTypes) throw codedError('invalid_piece_media_kind');
  if (!allowedTypes.has(contentType)) throw codedError('invalid_piece_media_content_type');

  const view = binaryView(bytes);
  const cap = KIND_BYTE_CAPS.get(kind);
  if (view.byteLength < 1 || view.byteLength > cap) throw codedError('invalid_piece_media_size');

  if (!env?.ARTWORK_REGISTRY_BACKUP) throw codedError('media_backup_not_configured');
  const bucket = env.ARTWORK_REGISTRY_BACKUP;

  const sha256 = await sha256Hex(view);
  const extension = CONTENT_TYPE_EXTENSIONS.get(contentType);
  const reference = `media/${sha256}.${extension}`;
  const id = `pm-${sha256}`;
  const expected = {
    reference, sha256, contentType, byteLength: view.byteLength,
  };

  const lease = await acquireAdmission(bucket);
  let operationError;
  try {
    try {
      const putResult = await bucket.put(reference, view, {
        onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType },
      });
      if (putResult === undefined) throw codedError('media_backup_failed');
      // putResult === null means the conditional failed: an object already
      // sits at this content-addressed key, so it already carries these
      // exact bytes. Either outcome is verified identically below.
    } catch (error) {
      if (error?.code === 'media_backup_failed') throw error;
      if (!isConditionalPutError(error)) throw codedError('media_backup_failed');
    }
    await verifyStored(bucket, expected);
  } catch (error) {
    operationError = error?.code ? error : codedError('media_backup_failed');
  }
  try { await releaseAdmission(bucket, lease); }
  catch { throw codedError('media_backup_failed'); }
  if (operationError) throw operationError;

  const existingById = await findById(db, id);
  if (existingById) return rowShape(existingById);

  const createdAt = new Date().toISOString();
  try {
    const result = await db.prepare(`
      INSERT INTO piece_media
        (id, keeper_piece_id, artwork_id, kind, storage_reference, sha256,
         byte_length, content_type, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `).bind(
      id,
      hasKeeper ? keeperPieceId : null,
      hasArtwork ? artworkId : null,
      kind, reference, sha256, view.byteLength, contentType, createdAt,
    ).run();
    if (Number(result?.meta?.changes ?? 0) !== 1) throw codedError('piece_media_insert_failed');
  } catch (error) {
    const existing = (await findById(db, id)) ?? (await findBySha256(db, sha256));
    if (existing) return rowShape(existing);
    throw (error?.code ? error : codedError('piece_media_insert_failed'));
  }

  const inserted = await findById(db, id);
  if (!inserted) throw codedError('piece_media_insert_failed');
  return rowShape(inserted);
}

/**
 * Soft-remove one row (abuse management). Succeeds exactly once per row: the
 * underlying UPDATE trigger (migration 039) accepts only a first transition
 * from removed_at IS NULL, so a second call finds zero rows changed.
 */
export async function removePieceMedia(db, { id, reason, removedAt } = {}) {
  if (!db) throw codedError('db_not_configured');
  if (typeof id !== 'string' || !id.trim()) throw codedError('invalid_piece_media_id');
  if (typeof reason !== 'string' || !reason.trim()) {
    throw codedError('invalid_piece_media_removal_reason');
  }
  if (typeof removedAt !== 'string' || Number.isNaN(Date.parse(removedAt))) {
    throw codedError('invalid_piece_media_removal_time');
  }
  const result = await db.prepare(`
    UPDATE piece_media SET removed_at = ?2, removed_reason = ?3
     WHERE id = ?1 AND removed_at IS NULL
  `).bind(id, removedAt, reason.trim()).run();
  if (Number(result?.meta?.changes ?? 0) !== 1) throw codedError('piece_media_removal_failed');
  const row = await findById(db, id);
  if (!row) throw codedError('piece_media_removal_failed');
  return rowShape(row);
}

/** Active (non-removed) media rows for one piece or one artwork, oldest first. */
export async function listPieceMedia(db, { keeperPieceId, artworkId } = {}) {
  if (!db) throw codedError('db_not_configured');
  const hasKeeper = keeperPieceId !== undefined && keeperPieceId !== null;
  const hasArtwork = artworkId !== undefined && artworkId !== null;
  if (hasKeeper === hasArtwork) throw codedError('invalid_piece_media_parent');
  const column = hasKeeper ? 'keeper_piece_id' : 'artwork_id';
  const value = hasKeeper ? keeperPieceId : artworkId;
  const result = await db.prepare(`
    SELECT ${PIECE_MEDIA_COLUMNS} FROM piece_media
     WHERE ${column} = ?1 AND removed_at IS NULL
     ORDER BY created_at, id
  `).bind(value).all();
  return (result?.results ?? []).map(rowShape);
}
