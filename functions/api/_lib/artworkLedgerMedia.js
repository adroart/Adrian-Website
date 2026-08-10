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
let nextMediaUploadGeneration = 0n;
let activeMediaUploadGeneration = 0n;

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

function binarySource(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const { buffer, byteOffset, byteLength } = viewDetails(value);
    return new Uint8Array(buffer, byteOffset, byteLength);
  }
  throw new TypeError('media input is not binary');
}

function binaryByteLength(value) {
  try {
    return binarySource(value).byteLength;
  } catch {
    throw codedError('invalid_media_bytes');
  }
}

function inputBytes(value) {
  try {
    const source = binarySource(value);
    const snapshot = new Uint8Array(source.byteLength);
    Reflect.apply(Uint8Array.prototype.set, snapshot, [source]);
    return snapshot;
  } catch {
    throw codedError('invalid_media_bytes');
  }
}

function readBackBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const { buffer, byteOffset, byteLength } = viewDetails(value);
    return new Uint8Array(buffer, byteOffset, byteLength);
  }
  throw new TypeError('unreadable media body');
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

function validateExecutionContext(value) {
  try {
    if (typeof value === 'function') {
      return (promise) => Reflect.apply(value, undefined, [promise]);
    }
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      throw new TypeError('invalid execution context');
    }
    const waitUntil = value.waitUntil;
    if (typeof waitUntil !== 'function') throw new TypeError('invalid execution context');
    return (promise) => Reflect.apply(waitUntil, value, [promise]);
  } catch {
    throw codedError('invalid_execution_context');
  }
}

function acquireMediaAdmission() {
  if (activeMediaUploadGeneration !== 0n) throw codedError('media_upload_busy');
  nextMediaUploadGeneration += 1n;
  activeMediaUploadGeneration = nextMediaUploadGeneration;
  return activeMediaUploadGeneration;
}

function releaseMediaAdmission(generation) {
  if (activeMediaUploadGeneration === generation) activeMediaUploadGeneration = 0n;
}

function createAbortState(signal, generation, registerWaitUntil) {
  let cancelled = false;
  let cancellationError;
  let cleanupDelegated = false;
  let fallbackCleanup;
  let currentNativePromise = null;
  let rejectAbort;
  let resolveAbort;
  let resolveRequestPathSettled;
  const abortPromise = new Promise((resolve, reject) => {
    resolveAbort = resolve;
    rejectAbort = reject;
  });
  abortPromise.catch(() => undefined);
  const requestPathSettled = new Promise((resolve) => {
    resolveRequestPathSettled = resolve;
  });
  const inFlightSettlements = new Set();

  const trackNative = (operation) => {
    const nativePromise = Promise.resolve(operation);
    currentNativePromise = nativePromise;
    const settlement = nativePromise.then(
      (value) => ({ fulfilled: true, value }),
      (error) => ({ fulfilled: false, error }),
    );
    inFlightSettlements.add(settlement);
    settlement.then(() => {
      inFlightSettlements.delete(settlement);
      if (currentNativePromise === nativePromise) currentNativePromise = null;
    });
    return settlement;
  };

  const startCleanup = () => {
    const cleanup = (async () => {
      try {
        await requestPathSettled;
        while (inFlightSettlements.size > 0) {
          await Promise.all([...inFlightSettlements]);
        }
      } finally {
        if (cleanupDelegated) releaseMediaAdmission(generation);
      }
    })();
    const handledCleanup = cleanup.catch(() => undefined);
    try {
      registerWaitUntil(handledCleanup);
      cleanupDelegated = true;
    } catch {
      fallbackCleanup = handledCleanup;
    }
  };

  const onAbort = () => {
    if (cancelled) return;
    cancelled = true;
    cancellationError = codedError('media_upload_cancelled');
    startCleanup();
    rejectAbort(cancellationError);
  };
  try {
    Reflect.apply(addEventListener, signal, ['abort', onAbort, { once: true }]);
  } catch {
    releaseMediaAdmission(generation);
    throw codedError('invalid_abort_signal');
  }
  if (abortSignalState(signal)) onAbort();
  return {
    get cleanupOwnsRelease() { return cleanupDelegated; },
    throwIfCancelled() {
      if (cancelled) throw cancellationError;
    },
    async wait(operation) {
      const settlement = trackNative(operation);
      const outcome = await Promise.race([settlement, abortPromise]);
      if (cancelled) throw cancellationError;
      if (outcome.fulfilled) return outcome.value;
      throw outcome.error;
    },
    async finishRequest() {
      try {
        Reflect.apply(removeEventListener, signal, ['abort', onAbort]);
      } catch {
        // The signal was branded before registration; never expose cleanup internals.
      }
      resolveAbort();
      resolveRequestPathSettled();
      if (fallbackCleanup) await fallbackCleanup;
    },
  };
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

async function verifyStreamBody(body, expectedBytes, mismatchCode, abortState) {
  let reader;
  let streamEnded = false;
  let verificationError;
  try {
    if (!body || typeof body.getReader !== 'function') {
      throw codedError('media_backup_failed');
    }
    reader = body.getReader();
    let offset = 0;
    while (true) {
      const read = await abortState.wait(reader.read());
      if (!read || typeof read !== 'object') throw codedError('media_backup_failed');
      if (read.done === true) {
        streamEnded = true;
        if (offset !== expectedBytes.byteLength) throw codedError(mismatchCode);
        break;
      }
      let chunk;
      try {
        chunk = readBackBytes(read.value);
      } catch {
        throw codedError('media_backup_failed');
      }
      if (chunk.byteLength === 0) throw codedError('media_backup_failed');
      if (offset + chunk.byteLength > expectedBytes.byteLength) {
        throw codedError(mismatchCode);
      }
      for (let index = 0; index < chunk.byteLength; index += 1) {
        if (chunk[index] !== expectedBytes[offset + index]) throw codedError(mismatchCode);
      }
      offset += chunk.byteLength;
    }
  } catch (error) {
    verificationError = isLocalCodedError(error)
      ? error : codedError('media_backup_failed');
  }

  let cleanupFailed = false;
  let cleanupCancellation;
  if (reader) {
    if (!streamEnded) {
      try {
        await abortState.wait(reader.cancel());
      } catch (error) {
        if (isLocalCodedError(error) && error.code === 'media_upload_cancelled') {
          cleanupCancellation = error;
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
  }
  if (isLocalCodedError(verificationError)
    && verificationError.code === 'media_upload_cancelled') throw verificationError;
  if (cleanupCancellation) throw cleanupCancellation;
  if (cleanupFailed) throw codedError('media_backup_failed');
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
  await verifyStreamBody(body, expected.bytes, mismatchCode, abortState);
}

export async function storeArtworkLedgerMedia(bucket, {
  artworkRecordId, bytes: rawBytes, contentType, signal, waitUntil: executionContext,
}) {
  const registerWaitUntil = validateExecutionContext(executionContext);
  const initiallyAborted = validateAbortSignal(signal);
  if (initiallyAborted) throw codedError('media_upload_cancelled');
  if (typeof artworkRecordId !== 'string'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(artworkRecordId)) {
    throw codedError('invalid_artwork_record_id');
  }
  const extension = MEDIA_EXTENSIONS.get(contentType);
  if (!extension) throw codedError('unsupported_media_type');
  const byteLength = binaryByteLength(rawBytes);
  if (byteLength < 1 || byteLength > MAX_MEDIA_BYTES) {
    throw codedError('invalid_media_size');
  }

  const generation = acquireMediaAdmission();
  let abortState;
  try {
    abortState = createAbortState(signal, generation, registerWaitUntil);
  } catch (error) {
    releaseMediaAdmission(generation);
    if (isLocalCodedError(error)) throw error;
    throw codedError('invalid_abort_signal');
  }
  try {
    abortState.throwIfCancelled();
    const bytes = inputBytes(rawBytes);
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_MEDIA_BYTES) {
      throw codedError('invalid_media_size');
    }
    let sha256;
    try {
      sha256 = await abortState.wait(sha256Hex(bytes));
    } catch (error) {
      if (isLocalCodedError(error) && error.code === 'media_upload_cancelled') throw error;
      throw codedError('media_backup_failed');
    }
    const reference = `artwork-ledger/${artworkRecordId}/${sha256}.${extension}`;
    const result = { reference, sha256, contentType, byteLength: bytes.byteLength };
    const expected = { ...result, bytes };

    let putResult;
    let conditionalReplay = false;
    try {
      putResult = await abortState.wait(bucket.put(reference, bytes, {
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
    await abortState.finishRequest();
    if (!abortState.cleanupOwnsRelease) releaseMediaAdmission(generation);
  }
}
