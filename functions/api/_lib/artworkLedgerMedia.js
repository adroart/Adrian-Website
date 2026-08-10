import { createHash } from 'node:crypto';

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

const MEDIA_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const LOCAL_CODED_ERRORS = new WeakSet();
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayBuffer = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'buffer').get;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteOffset').get;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteLength').get;
const dataViewBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, 'buffer').get;
const dataViewByteOffset = Object.getOwnPropertyDescriptor(DataView.prototype, 'byteOffset').get;
const dataViewByteLength = Object.getOwnPropertyDescriptor(DataView.prototype, 'byteLength').get;
const abortSignalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
const addEventListener = EventTarget.prototype.addEventListener;
const removeEventListener = EventTarget.prototype.removeEventListener;
const readableStreamGetReader = ReadableStream.prototype.getReader;

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  LOCAL_CODED_ERRORS.add(error);
  return error;
}

function isLocalCodedError(error) {
  return (typeof error === 'object' && error !== null) && LOCAL_CODED_ERRORS.has(error);
}

function viewDetails(value) {
  try {
    return {
      buffer: Reflect.apply(typedArrayBuffer, value, []),
      byteOffset: Reflect.apply(typedArrayByteOffset, value, []),
      byteLength: Reflect.apply(typedArrayByteLength, value, []),
    };
  } catch {
    return {
      buffer: Reflect.apply(dataViewBuffer, value, []),
      byteOffset: Reflect.apply(dataViewByteOffset, value, []),
      byteLength: Reflect.apply(dataViewByteLength, value, []),
    };
  }
}

function binaryView(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const { buffer, byteOffset, byteLength } = viewDetails(value);
    return new Uint8Array(buffer, byteOffset, byteLength);
  }
  throw new TypeError('invalid binary stream chunk');
}

function ownedChunk(value) {
  const source = binaryView(value);
  const copy = new Uint8Array(source.byteLength);
  Reflect.apply(Uint8Array.prototype.set, copy, [source]);
  return copy;
}

function abortSignalState(signal) {
  return Reflect.apply(abortSignalAborted, signal, []);
}

function validateAbortSignal(signal) {
  try {
    if (!signal
      || typeof signal.addEventListener !== 'function'
      || typeof signal.removeEventListener !== 'function'
      || typeof abortSignalState(signal) !== 'boolean') {
      throw new TypeError('invalid abort signal');
    }
    return abortSignalState(signal);
  } catch {
    throw codedError('invalid_abort_signal');
  }
}

function createAbortState(signal) {
  let cancelled = false;
  let cancellationError;
  let rejectAbort;
  let resolveAbort;
  const promise = new Promise((resolve, reject) => {
    resolveAbort = resolve;
    rejectAbort = reject;
  });
  promise.catch(() => undefined);
  const onAbort = () => {
    if (cancelled) return;
    cancelled = true;
    cancellationError = codedError('media_upload_cancelled');
    rejectAbort(cancellationError);
  };
  try {
    Reflect.apply(addEventListener, signal, ['abort', onAbort, { once: true }]);
  } catch {
    throw codedError('invalid_abort_signal');
  }
  if (abortSignalState(signal)) onAbort();
  return {
    promise,
    throwIfCancelled() {
      if (cancelled) throw cancellationError;
    },
    async wait(operation) {
      const result = await Promise.race([Promise.resolve(operation), promise]);
      if (cancelled) throw cancellationError;
      return result;
    },
    finish() {
      try {
        Reflect.apply(removeEventListener, signal, ['abort', onAbort]);
      } catch {
        // Signal was branded before registration. Cleanup details remain private.
      }
      resolveAbort();
    },
  };
}

function sourceReader(source) {
  try {
    return Reflect.apply(readableStreamGetReader, source, []);
  } catch {
    throw codedError('invalid_media_source');
  }
}

async function finishReader(reader, completed, abortState, failureCode) {
  let cleanupFailed = false;
  if (!completed) {
    try {
      await abortState.wait(reader.cancel());
    } catch (error) {
      if (isLocalCodedError(error) && error.code === 'media_upload_cancelled') {
        // Cancellation is already the stable public result.
      } else {
        cleanupFailed = true;
      }
    }
  }
  try {
    reader.releaseLock();
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) throw codedError(failureCode);
}

async function consumeSource(reader, contentLength, abortState) {
  const chunks = [];
  const hash = createHash('sha256');
  let byteLength = 0;
  let completed = false;
  let failure;
  try {
    while (true) {
      const read = await abortState.wait(reader.read());
      if (!read || typeof read !== 'object') throw codedError('invalid_media_bytes');
      if (read.done === true) {
        completed = true;
        if (byteLength !== contentLength) throw codedError('invalid_media_size');
        break;
      }
      let chunk;
      try {
        chunk = ownedChunk(read.value);
      } catch {
        throw codedError('invalid_media_bytes');
      }
      if (chunk.byteLength === 0) throw codedError('invalid_media_bytes');
      if (byteLength + chunk.byteLength > contentLength
        || byteLength + chunk.byteLength > MAX_MEDIA_BYTES) {
        throw codedError('invalid_media_size');
      }
      chunks.push(chunk);
      byteLength += chunk.byteLength;
      hash.update(chunk);
    }
  } catch (error) {
    failure = isLocalCodedError(error) ? error : codedError('invalid_media_bytes');
  }
  try {
    await finishReader(reader, completed, abortState, 'invalid_media_bytes');
  } catch (error) {
    if (!failure || !isLocalCodedError(failure)
      || failure.code !== 'media_upload_cancelled') failure = error;
  }
  if (failure) throw failure;
  return { chunks, sha256: hash.digest('hex'), byteLength };
}

function uploadBody(chunks) {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]);
      index += 1;
    },
  }, { highWaterMark: 0 });
}

function isConditionalPutError(error) {
  const property = (key) => {
    try {
      return error?.[key];
    } catch {
      return undefined;
    }
  };
  return property('status') === 412
    || property('statusCode') === 412
    || property('code') === 10031
    || property('code') === '10031'
    || property('code') === 'PreconditionFailed'
    || property('name') === 'PreconditionFailed';
}

function expectedCursor(chunks) {
  let chunkIndex = 0;
  let chunkOffset = 0;
  let total = 0;
  return {
    compare(value) {
      const actual = binaryView(value);
      for (let index = 0; index < actual.byteLength; index += 1) {
        while (chunkIndex < chunks.length && chunkOffset === chunks[chunkIndex].byteLength) {
          chunkIndex += 1;
          chunkOffset = 0;
        }
        if (chunkIndex >= chunks.length || actual[index] !== chunks[chunkIndex][chunkOffset]) {
          return false;
        }
        chunkOffset += 1;
        total += 1;
      }
      return true;
    },
    get complete() {
      while (chunkIndex < chunks.length && chunkOffset === chunks[chunkIndex].byteLength) {
        chunkIndex += 1;
        chunkOffset = 0;
      }
      return chunkIndex === chunks.length;
    },
    get total() { return total; },
  };
}

async function verifyStreamBody(body, expected, mismatchCode, abortState) {
  let reader;
  let streamEnded = false;
  let verificationError;
  try {
    if (!body || typeof body.getReader !== 'function') {
      throw codedError('media_backup_failed');
    }
    reader = body.getReader();
    const cursor = expectedCursor(expected.chunks);
    while (true) {
      const read = await abortState.wait(reader.read());
      if (!read || typeof read !== 'object') throw codedError('media_backup_failed');
      if (read.done === true) {
        streamEnded = true;
        if (cursor.total !== expected.byteLength || !cursor.complete) {
          throw codedError(mismatchCode);
        }
        break;
      }
      let matches;
      try {
        matches = cursor.compare(read.value);
      } catch {
        throw codedError('media_backup_failed');
      }
      if (!matches) throw codedError(mismatchCode);
    }
  } catch (error) {
    verificationError = isLocalCodedError(error)
      ? error : codedError('media_backup_failed');
  }

  let cleanupError;
  if (reader) {
    try {
      await finishReader(reader, streamEnded, abortState, 'media_backup_failed');
    } catch (error) {
      cleanupError = error;
    }
  }
  if (isLocalCodedError(verificationError)
    && verificationError.code === 'media_upload_cancelled') throw verificationError;
  if (isLocalCodedError(cleanupError)
    && cleanupError.code === 'media_upload_cancelled') throw cleanupError;
  if (cleanupError) throw codedError('media_backup_failed');
  if (verificationError) throw verificationError;
}

async function verifyStoredObject(bucket, expected, conflict, abortState) {
  const mismatchCode = conflict ? 'media_backup_conflict' : 'media_backup_failed';
  let stored;
  try {
    stored = await abortState.wait(bucket.get(expected.reference));
  } catch (error) {
    if (isLocalCodedError(error) && error.code === 'media_upload_cancelled') throw error;
    throw codedError('media_backup_failed');
  }
  if (!stored || (typeof stored !== 'object' && typeof stored !== 'function')) {
    throw codedError('media_backup_failed');
  }

  let key;
  let size;
  let storedContentType;
  let body;
  try {
    key = stored.key;
    size = stored.size;
    storedContentType = stored.httpMetadata?.contentType;
    body = stored.body;
  } catch {
    throw codedError('media_backup_failed');
  }
  if (key !== expected.reference) throw codedError(mismatchCode);
  if (size !== expected.byteLength) throw codedError(mismatchCode);
  if (storedContentType !== expected.contentType) throw codedError(mismatchCode);
  if (body === undefined || body === null) throw codedError('media_backup_failed');
  await verifyStreamBody(body, expected, mismatchCode, abortState);
}

export async function storeArtworkLedgerMedia(bucket, {
  artworkRecordId, source, contentLength, contentType, signal,
}) {
  const initiallyAborted = validateAbortSignal(signal);
  if (initiallyAborted) throw codedError('media_upload_cancelled');
  if (typeof artworkRecordId !== 'string'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(artworkRecordId)) {
    throw codedError('invalid_artwork_record_id');
  }
  const extension = MEDIA_EXTENSIONS.get(contentType);
  if (!extension) throw codedError('unsupported_media_type');
  if (!Number.isSafeInteger(contentLength)
    || contentLength < 1 || contentLength > MAX_MEDIA_BYTES) {
    throw codedError('invalid_media_size');
  }
  const abortState = createAbortState(signal);
  try {
    abortState.throwIfCancelled();
    const reader = sourceReader(source);
    const media = await consumeSource(reader, contentLength, abortState);
    const reference = `artwork-ledger/${artworkRecordId}/${media.sha256}.${extension}`;
    const result = {
      reference,
      sha256: media.sha256,
      contentType,
      byteLength: media.byteLength,
    };
    const expected = { ...result, chunks: media.chunks };

    let putResult;
    let conditionalReplay = false;
    try {
      putResult = await abortState.wait(bucket.put(reference, uploadBody(media.chunks), {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType },
      }));
      conditionalReplay = putResult === null;
      if (putResult === undefined) throw codedError('media_backup_failed');
    } catch (error) {
      if (isLocalCodedError(error)) throw error;
      if (!isConditionalPutError(error)) throw codedError('media_backup_failed');
      conditionalReplay = true;
    }

    await verifyStoredObject(bucket, expected, conditionalReplay, abortState);
    return result;
  } finally {
    abortState.finish();
  }
}
