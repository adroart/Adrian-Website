const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

const MEDIA_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function inputBytes(value) {
  try {
    let bytes;
    if (value instanceof Uint8Array) {
      bytes = value;
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    } else {
      throw codedError('invalid_media_bytes');
    }
    return bytes.slice();
  } catch {
    throw codedError('invalid_media_bytes');
  }
}

function readBackBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError('unreadable media body');
}

function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isConditionalPutError(error) {
  return error?.status === 412
    || error?.statusCode === 412
    || error?.code === 10031
    || error?.code === '10031'
    || error?.code === 'PreconditionFailed'
    || error?.name === 'PreconditionFailed';
}

async function verifyStoredObject(bucket, expected, conflict) {
  let stored;
  try {
    stored = await bucket.get(expected.reference);
  } catch {
    throw codedError('media_backup_failed');
  }
  if (!stored || typeof stored.arrayBuffer !== 'function') {
    throw codedError('media_backup_failed');
  }

  try {
    if (typeof stored.key === 'string' && stored.key !== expected.reference) {
      throw codedError(conflict ? 'media_backup_conflict' : 'media_backup_failed');
    }
    if (typeof stored.size === 'number' && stored.size !== expected.byteLength) {
      throw codedError(conflict ? 'media_backup_conflict' : 'media_backup_failed');
    }
    const storedContentType = stored.httpMetadata?.contentType;
    if (storedContentType !== undefined && storedContentType !== expected.contentType) {
      throw codedError(conflict ? 'media_backup_conflict' : 'media_backup_failed');
    }
    const actual = readBackBytes(await stored.arrayBuffer());
    if (actual.byteLength !== expected.byteLength
      || !bytesEqual(actual, expected.bytes)
      || await sha256Hex(actual) !== expected.sha256) {
      throw codedError(conflict ? 'media_backup_conflict' : 'media_backup_failed');
    }
  } catch (error) {
    if (error?.code === 'media_backup_conflict' || error?.code === 'media_backup_failed') throw error;
    throw codedError('media_backup_failed');
  }
}

export async function storeArtworkLedgerMedia(bucket, {
  artworkRecordId, bytes: rawBytes, contentType,
}) {
  if (typeof artworkRecordId !== 'string'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(artworkRecordId)) {
    throw codedError('invalid_artwork_record_id');
  }
  const extension = MEDIA_EXTENSIONS.get(contentType);
  if (!extension) throw codedError('unsupported_media_type');

  const bytes = inputBytes(rawBytes);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_MEDIA_BYTES) {
    throw codedError('invalid_media_size');
  }

  const sha256 = await sha256Hex(bytes);
  const reference = `artwork-ledger/${artworkRecordId}/${sha256}.${extension}`;
  const result = { reference, sha256, contentType, byteLength: bytes.byteLength };
  const expected = { ...result, bytes };

  let putResult;
  let conditionalReplay = false;
  try {
    putResult = await bucket.put(reference, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType },
    });
    conditionalReplay = putResult === null;
    if (putResult === undefined) throw codedError('media_backup_failed');
  } catch (error) {
    if (error?.code === 'media_backup_failed') throw error;
    if (!isConditionalPutError(error)) throw codedError('media_backup_failed');
    conditionalReplay = true;
  }

  await verifyStoredObject(bucket, expected, conditionalReplay);
  return result;
}
