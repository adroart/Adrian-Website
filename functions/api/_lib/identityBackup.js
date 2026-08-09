export const IDENTITY_BACKUP_SCHEMA_VERSION = 1;

function exactKeys(value, keys) {
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
  throw new TypeError('identity backup document must be bytes or text');
}

async function storedBytes(stored) {
  if (typeof stored?.arrayBuffer === 'function') {
    return new Uint8Array(await stored.arrayBuffer());
  }
  if (typeof stored?.text === 'function') {
    return new TextEncoder().encode(await stored.text());
  }
  throw new TypeError('identity backup object body unavailable');
}

function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function buildIdentityBackupDocument(candidate) {
  return {
    schemaVersion: IDENTITY_BACKUP_SCHEMA_VERSION,
    publicCode: candidate.publicCode,
    artworkId: candidate.artworkId,
    edition: candidate.edition,
    registeredAt: candidate.registeredAt,
    ownershipCodeVerifier: candidate.verifier,
    envelope: {
      ciphertext: candidate.envelope.ciphertext,
      nonce: candidate.envelope.nonce,
      keyVersion: String(candidate.envelope.keyVersion),
    },
  };
}

export function parseIdentityBackupDocument(value) {
  const document = JSON.parse(new TextDecoder().decode(toBytes(value)));
  if (
    !exactKeys(document, [
      'schemaVersion', 'publicCode', 'artworkId', 'edition', 'registeredAt',
      'ownershipCodeVerifier', 'envelope',
    ])
    || document.schemaVersion !== IDENTITY_BACKUP_SCHEMA_VERSION
    || typeof document.publicCode !== 'string'
    || !/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(document.publicCode)
    || typeof document.artworkId !== 'string'
    || !/^[A-Z]{2,3}-[0-9]{3}$/.test(document.artworkId)
    || !exactKeys(document.edition, ['kind', 'number', 'size'])
    || !['unique', 'numbered'].includes(document.edition.kind)
    || (document.edition.kind === 'unique'
      ? document.edition.number !== null || document.edition.size !== null
      : !Number.isSafeInteger(document.edition.number)
        || document.edition.number < 1
        || (document.edition.size !== null
          && (!Number.isSafeInteger(document.edition.size)
            || document.edition.size < document.edition.number)))
    || typeof document.registeredAt !== 'string'
    || !document.registeredAt
    || typeof document.ownershipCodeVerifier !== 'string'
    || !/^[0-9a-f]{64}$/.test(document.ownershipCodeVerifier)
    || !exactKeys(document.envelope, ['ciphertext', 'nonce', 'keyVersion'])
    || typeof document.envelope.ciphertext !== 'string'
    || !document.envelope.ciphertext
    || typeof document.envelope.nonce !== 'string'
    || !document.envelope.nonce
    || typeof document.envelope.keyVersion !== 'string'
    || !/^[1-9][0-9]*$/.test(document.envelope.keyVersion)
  ) throw new Error('invalid identity backup document');
  return document;
}

export async function identityBackupSha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', toBytes(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function backupArtworkIdentity(bucket, candidate) {
  const bytes = new TextEncoder().encode(JSON.stringify(buildIdentityBackupDocument(candidate)));
  const sha256 = await identityBackupSha256(bytes);
  const reference = `identities/${candidate.publicCode}/${sha256}.json`;
  if (!bucket) return { status: 'failed', reference, sha256 };
  try {
    await bucket.put(reference, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    const stored = await bucket.get(reference);
    if (!stored || !bytesEqual(await storedBytes(stored), bytes)) {
      return { status: 'failed', reference, sha256 };
    }
    return { status: 'verified', reference, sha256 };
  } catch {
    return { status: 'failed', reference, sha256 };
  }
}

export async function readIdentityBackupBytes(stored) {
  return storedBytes(stored);
}
