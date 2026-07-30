const BACKUP_SCHEMA_VERSION = 1;

function hasExactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function toBytes(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError('backup document must be bytes or text');
}

function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function storedObjectBytes(stored) {
  if (typeof stored?.arrayBuffer === 'function') {
    return new Uint8Array(await stored.arrayBuffer());
  }
  if (typeof stored?.text === 'function') {
    return new TextEncoder().encode(await stored.text());
  }
  throw new TypeError('backup object body unavailable');
}

export function buildBackupDocument(row) {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    publicCode: row.public_code,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    plateGeneratedAt: row.plate_generated_at,
    envelope: {
      ciphertext: row.ownership_code_ciphertext,
      nonce: row.ownership_code_nonce,
      keyVersion: String(row.ownership_code_key_version),
    },
  };
}

export function parseBackupDocument(value) {
  const document = JSON.parse(new TextDecoder().decode(toBytes(value)));
  if (
    !hasExactKeys(document, [
      'schemaVersion', 'publicCode', 'pieceId', 'editionNumber',
      'plateGeneratedAt', 'envelope',
    ])
    || document.schemaVersion !== BACKUP_SCHEMA_VERSION
    || typeof document.publicCode !== 'string'
    || !document.publicCode
    || typeof document.pieceId !== 'string'
    || !document.pieceId
    || !Number.isSafeInteger(document.editionNumber)
    || typeof document.plateGeneratedAt !== 'string'
    || !document.plateGeneratedAt
    || !hasExactKeys(document.envelope, ['ciphertext', 'nonce', 'keyVersion'])
    || typeof document.envelope.ciphertext !== 'string'
    || !document.envelope.ciphertext
    || typeof document.envelope.nonce !== 'string'
    || !document.envelope.nonce
    || typeof document.envelope.keyVersion !== 'string'
    || !/^[1-9][0-9]*$/.test(document.envelope.keyVersion)
  ) {
    throw new Error('invalid backup document');
  }
  return document;
}

export async function backupDocumentSha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', toBytes(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Mirrors an already-encrypted row. This module never receives encryption keys. */
export async function backupPlateEnvelope(bucket, row) {
  const expected = new TextEncoder().encode(JSON.stringify(buildBackupDocument(row)));
  const sha256 = await backupDocumentSha256(expected);
  const reference = `plates/${row.public_code}/${sha256}.json`;
  if (!bucket) return { status: 'failed', reference, sha256 };

  try {
    await bucket.put(reference, expected, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    const stored = await bucket.get(reference);
    if (!stored) return { status: 'failed', reference, sha256 };
    const actual = await storedObjectBytes(stored);
    if (!bytesEqual(actual, expected)) return { status: 'failed', reference, sha256 };
    return { status: 'verified', reference, sha256 };
  } catch {
    return { status: 'failed', reference, sha256 };
  }
}

export async function recordPlateBackupResult(db, keeperPieceId, result) {
  const at = result.status === 'verified' ? new Date().toISOString() : null;
  await db.prepare(
    `UPDATE keeper_pieces
        SET backup_status = ?1,
            backup_reference = CASE WHEN ?1 = 'verified' THEN ?2 ELSE backup_reference END,
            backup_sha256 = CASE WHEN ?1 = 'verified' THEN ?3 ELSE backup_sha256 END,
            backup_at = CASE WHEN ?1 = 'verified' THEN ?4 ELSE backup_at END
      WHERE id = ?5`,
  ).bind(result.status, result.reference, result.sha256, at, keeperPieceId).run();
  return at;
}

export async function readBackupObjectBytes(stored) {
  return storedObjectBytes(stored);
}
