import { createHash, randomUUID } from 'node:crypto';

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const STREAM_CHUNK_BYTES = 64 * 1024;
const UPLOAD_DEADLINE_MS = 30_000;
const RELEASE_DEADLINE_MS = 5_000;
const ADMISSION_LEASE_MS = 60_000;
const ADMISSION_KEY = 'artwork-ledger/_private/upload-admission';
const MEDIA_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
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
function abortSignalState(signal) { return Reflect.apply(abortSignalAborted, signal, []); }
function validateAbortSignal(signal) {
  try {
    if (!signal || typeof signal.addEventListener !== 'function'
      || typeof signal.removeEventListener !== 'function'
      || typeof abortSignalState(signal) !== 'boolean') throw new TypeError();
    return abortSignalState(signal);
  } catch { throw codedError('invalid_abort_signal'); }
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
    const details = viewDetails(value);
    return new Uint8Array(details.buffer, details.byteOffset, details.byteLength);
  }
  throw new TypeError();
}
function sourceReader(source) {
  try { return Reflect.apply(readableStreamGetReader, source, []); }
  catch { throw codedError('invalid_media_source'); }
}

function waitFor(operation, signal, deadline) {
  const pending = Promise.resolve(operation);
  pending.catch(() => undefined);
  if (signal && abortSignalState(signal)) return Promise.reject(codedError('media_upload_cancelled'));
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(codedError('media_upload_timeout'));
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) {
        try { Reflect.apply(removeEventListener, signal, ['abort', onAbort]); } catch { /* noop */ }
      }
      callback(value);
    };
    const onAbort = () => finish(reject, codedError('media_upload_cancelled'));
    if (signal) Reflect.apply(addEventListener, signal, ['abort', onAbort, { once: true }]);
    timer = setTimeout(() => finish(reject, codedError('media_upload_timeout')), remaining);
    pending.then(
      (value) => {
        if (Date.now() >= deadline) finish(reject, codedError('media_upload_timeout'));
        else finish(resolve, value);
      },
      (error) => finish(reject, error),
    );
  });
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
    if (Object.keys(metadata).sort().join(',') !== 'expiresAt,ownerToken,state') throw new TypeError();
    const { state, ownerToken, expiresAt } = metadata;
    if (state !== 'active' && state !== 'released') throw new TypeError();
    if (typeof ownerToken !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ownerToken)) {
      throw new TypeError();
    }
    if (typeof expiresAt !== 'string' || !/^[0-9]{13}$/.test(expiresAt)) throw new TypeError();
    const expiry = Number(expiresAt);
    if (!Number.isSafeInteger(expiry) || String(expiry) !== expiresAt) throw new TypeError();
    return { etag: object.etag, state, ownerToken, expiresAt: expiry };
  } catch { throw codedError('media_backup_failed'); }
}
function leaseMetadata(state, ownerToken, expiresAt) {
  return { state, ownerToken, expiresAt: String(expiresAt) };
}
async function putLease(bucket, onlyIf, metadata, signal, deadline) {
  let result;
  try {
    result = await waitFor(bucket.put(ADMISSION_KEY, new Uint8Array(), {
      onlyIf, customMetadata: metadata,
    }), signal, deadline);
  } catch (error) {
    if (isLocalCodedError(error)) throw error;
    if (isConditionalPutError(error)) return null;
    throw codedError('media_backup_failed');
  }
  if (result === null) return null;
  const parsed = parseLease(result);
  if (parsed.state !== metadata.state || parsed.ownerToken !== metadata.ownerToken
    || parsed.expiresAt !== Number(metadata.expiresAt)) throw codedError('media_backup_failed');
  return parsed;
}
async function acquireAdmission(bucket, signal, deadline) {
  const ownerToken = randomUUID();
  const expiresAt = Date.now() + ADMISSION_LEASE_MS;
  const metadata = leaseMetadata('active', ownerToken, expiresAt);
  const initial = await putLease(bucket, { etagDoesNotMatch: '*' }, metadata, signal, deadline);
  if (initial) return initial;
  let observed;
  try { observed = await waitFor(bucket.head(ADMISSION_KEY), signal, deadline); }
  catch (error) {
    if (isLocalCodedError(error)) throw error;
    throw codedError('media_backup_failed');
  }
  const current = parseLease(observed);
  if (current.state === 'active' && current.expiresAt > Date.now()) {
    throw codedError('media_upload_busy');
  }
  const takeover = await putLease(bucket, { etagMatches: current.etag }, metadata, signal, deadline);
  if (!takeover) throw codedError('media_upload_busy');
  return takeover;
}
async function releaseAdmission(bucket, lease) {
  const deadline = Date.now() + RELEASE_DEADLINE_MS;
  let observed;
  try { observed = await waitFor(bucket.head(ADMISSION_KEY), null, deadline); }
  catch { throw codedError('media_backup_failed'); }
  const current = parseLease(observed);
  if (current.ownerToken !== lease.ownerToken || current.state !== 'active') {
    throw codedError('media_backup_failed');
  }
  const released = leaseMetadata('released', lease.ownerToken, Date.now());
  const result = await putLease(bucket, { etagMatches: current.etag }, released, null, deadline);
  if (!result) throw codedError('media_backup_failed');
}

async function finishReader(reader, completed, signal, deadline, failureCode) {
  let failed = false;
  if (!completed) {
    try { await waitFor(reader.cancel(), signal, deadline); }
    catch (error) {
      if (!(isLocalCodedError(error) && (error.code === 'media_upload_cancelled'
        || error.code === 'media_upload_timeout'))) failed = true;
    }
  }
  try { reader.releaseLock(); } catch { failed = true; }
  if (failed) throw codedError(failureCode);
}
async function consumeSource(reader, contentLength, signal, deadline) {
  const aggregate = new Uint8Array(contentLength);
  let offset = 0;
  let completed = false;
  let failure;
  try {
    while (true) {
      const read = await waitFor(reader.read(), signal, deadline);
      if (!read || typeof read !== 'object') throw codedError('invalid_media_bytes');
      if (read.done === true) {
        completed = true;
        if (offset !== contentLength) throw codedError('invalid_media_size');
        break;
      }
      let chunk;
      try { chunk = binaryView(read.value); } catch { throw codedError('invalid_media_bytes'); }
      if (chunk.byteLength === 0) throw codedError('invalid_media_bytes');
      if (offset + chunk.byteLength > contentLength) throw codedError('invalid_media_size');
      Reflect.apply(Uint8Array.prototype.set, aggregate, [chunk, offset]);
      offset += chunk.byteLength;
    }
  } catch (error) { failure = isLocalCodedError(error) ? error : codedError('invalid_media_bytes'); }
  try { await finishReader(reader, completed, signal, deadline, 'invalid_media_bytes'); }
  catch (error) {
    if (!failure || !isLocalCodedError(failure)
      || !['media_upload_cancelled', 'media_upload_timeout'].includes(failure.code)) failure = error;
  }
  if (failure) throw failure;
  return aggregate;
}
function aggregateStream(aggregate) {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset === aggregate.byteLength) { controller.close(); return; }
      const end = Math.min(offset + STREAM_CHUNK_BYTES, aggregate.byteLength);
      controller.enqueue(aggregate.subarray(offset, end));
      offset = end;
    },
  }, { highWaterMark: 0 });
}
async function verifyBody(body, aggregate, mismatchCode, signal, deadline) {
  let reader;
  let ended = false;
  let offset = 0;
  let failure;
  try {
    if (!body || typeof body.getReader !== 'function') throw codedError('media_backup_failed');
    reader = body.getReader();
    while (true) {
      const read = await waitFor(reader.read(), signal, deadline);
      if (!read || typeof read !== 'object') throw codedError('media_backup_failed');
      if (read.done === true) {
        ended = true;
        if (offset !== aggregate.byteLength) throw codedError(mismatchCode);
        break;
      }
      let chunk;
      try { chunk = binaryView(read.value); } catch { throw codedError('media_backup_failed'); }
      if (offset + chunk.byteLength > aggregate.byteLength) throw codedError(mismatchCode);
      for (let index = 0; index < chunk.byteLength; index += 1) {
        if (chunk[index] !== aggregate[offset + index]) throw codedError(mismatchCode);
      }
      offset += chunk.byteLength;
    }
  } catch (error) { failure = isLocalCodedError(error) ? error : codedError('media_backup_failed'); }
  if (reader) {
    try { await finishReader(reader, ended, signal, deadline, 'media_backup_failed'); }
    catch (error) {
      if (!failure || !isLocalCodedError(failure)
        || !['media_upload_cancelled', 'media_upload_timeout'].includes(failure.code)) failure = error;
    }
  }
  if (failure) throw failure;
}
async function verifyStored(bucket, expected, conflict, signal, deadline) {
  const mismatchCode = conflict ? 'media_backup_conflict' : 'media_backup_failed';
  let stored;
  try { stored = await waitFor(bucket.get(expected.reference), signal, deadline); }
  catch (error) {
    if (isLocalCodedError(error)) throw error;
    throw codedError('media_backup_failed');
  }
  if (!stored || (typeof stored !== 'object' && typeof stored !== 'function')) {
    throw codedError('media_backup_failed');
  }
  let key; let size; let storedContentType; let body;
  try {
    key = stored.key; size = stored.size;
    storedContentType = stored.httpMetadata?.contentType; body = stored.body;
  } catch { throw codedError('media_backup_failed'); }
  if (key !== expected.reference || size !== expected.byteLength
    || storedContentType !== expected.contentType) throw codedError(mismatchCode);
  if (!body) throw codedError('media_backup_failed');
  await verifyBody(body, expected.aggregate, mismatchCode, signal, deadline);
}

export async function storeArtworkLedgerMedia(bucket, {
  artworkRecordId, source, contentLength, contentType, signal,
}) {
  const initiallyAborted = validateAbortSignal(signal);
  if (initiallyAborted) throw codedError('media_upload_cancelled');
  if (typeof artworkRecordId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(artworkRecordId)) {
    throw codedError('invalid_artwork_record_id');
  }
  const extension = MEDIA_EXTENSIONS.get(contentType);
  if (!extension) throw codedError('unsupported_media_type');
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_MEDIA_BYTES) {
    throw codedError('invalid_media_size');
  }
  try { if (!source || typeof source.getReader !== 'function') throw new TypeError(); }
  catch { throw codedError('invalid_media_source'); }

  const deadline = Date.now() + UPLOAD_DEADLINE_MS;
  const lease = await acquireAdmission(bucket, signal, deadline);
  let result;
  let operationError;
  try {
    const reader = sourceReader(source);
    const aggregate = await consumeSource(reader, contentLength, signal, deadline);
    const sha256 = createHash('sha256').update(aggregate).digest('hex');
    const reference = `artwork-ledger/${artworkRecordId}/${sha256}.${extension}`;
    result = { reference, sha256, contentType, byteLength: aggregate.byteLength };
    const expected = { ...result, aggregate };
    let putResult;
    let replay = false;
    try {
      putResult = await waitFor(bucket.put(reference, aggregateStream(aggregate), {
        onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType },
      }), signal, deadline);
      replay = putResult === null;
      if (putResult === undefined) throw codedError('media_backup_failed');
    } catch (error) {
      if (isLocalCodedError(error)) throw error;
      if (!isConditionalPutError(error)) throw codedError('media_backup_failed');
      replay = true;
    }
    await verifyStored(bucket, expected, replay, signal, deadline);
  } catch (error) { operationError = isLocalCodedError(error) ? error : codedError('media_backup_failed'); }

  try { await releaseAdmission(bucket, lease); }
  catch { throw codedError('media_backup_failed'); }
  if (operationError) throw operationError;
  return result;
}
