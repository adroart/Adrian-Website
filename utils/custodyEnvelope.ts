/**
 * The custody envelope: one small JSON file a successor can open with ONE
 * passphrase, containing the internal key material needed to use the private
 * registry archive (docs/registry-custodian-guide.md).
 *
 * The envelope wraps the two-secret model of utils/registryRecoveryArchive.ts
 * (REGISTRY_RECOVERY_EXPORT_KEY + its KEY_ID) plus any Ownership Code key
 * versions, so succession needs exactly one remembered secret: the passphrase.
 *
 * Crypto is Web Crypto only, so the same code runs in Node and the browser:
 * PBKDF2-SHA-256 (>= 600000 iterations, random 16-byte salt) derives an
 * AES-GCM-256 key from the passphrase; the payload is encrypted with a random
 * 12-byte nonce and the envelope header bound as additional authenticated
 * data. The envelope itself carries nothing identifying the key values.
 *
 * Failure on open is deliberately generic: a wrong passphrase and a tampered
 * envelope produce the identical 'custody_envelope_cannot_open' error, with
 * no oracle detail about which check failed.
 */

export const CUSTODY_ENVELOPE_SCHEMA = 'adrian-custody-envelope' as const;
export const CUSTODY_ENVELOPE_SCHEMA_VERSION = 1 as const;
export const CUSTODY_ENVELOPE_KDF_NAME = 'PBKDF2-SHA-256' as const;
export const CUSTODY_ENVELOPE_MIN_ITERATIONS = 600000;
export const CUSTODY_ENVELOPE_SALT_BYTES = 16;
export const CUSTODY_ENVELOPE_NONCE_BYTES = 12;
export const CUSTODY_ENVELOPE_MIN_PASSPHRASE_LENGTH = 12;

const CUSTODY_PAYLOAD_KIND = 'adrian-custody-envelope-payload' as const;
const CANNOT_OPEN = 'custody_envelope_cannot_open';

export type OwnershipCodeKeyEntry = { version: number; keyB64: string };

export type CustodyKeys = {
  registryRecoveryExportKeyB64: string;
  registryRecoveryExportKeyId: string;
  ownershipCodeKeys?: OwnershipCodeKeyEntry[];
  notes?: string;
};

export type CustodyEnvelope = {
  schema: typeof CUSTODY_ENVELOPE_SCHEMA;
  schemaVersion: typeof CUSTODY_ENVELOPE_SCHEMA_VERSION;
  kdf: {
    name: typeof CUSTODY_ENVELOPE_KDF_NAME;
    iterations: number;
    saltB64: string;
  };
  nonceB64: string;
  ciphertextB64: string;
  createdAt: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

/** Deterministic JSON, sorted keys at every depth, for payload bytes and AAD. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  if (value === undefined) throw new Error('custody_value_undefined');
  return JSON.stringify(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof value !== 'string' || !value) throw new Error('custody_base64_invalid');
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('custody_base64_invalid');
  }
}

function assertAesKeyB64(value: unknown, code: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(value);
  } catch {
    throw new Error(code);
  }
  if (bytes.byteLength !== 32) throw new Error(code);
}

export function validateCustodyKeys(keys: unknown): asserts keys is CustodyKeys {
  if (!isPlainObject(keys)) throw new Error('custody_keys_shape');
  const allowed = ['registryRecoveryExportKeyB64', 'registryRecoveryExportKeyId',
    'ownershipCodeKeys', 'notes'];
  if (!Object.keys(keys).every((key) => allowed.includes(key))
    || !('registryRecoveryExportKeyB64' in keys)
    || !('registryRecoveryExportKeyId' in keys)) {
    throw new Error('custody_keys_shape');
  }
  assertAesKeyB64(keys.registryRecoveryExportKeyB64, 'custody_recovery_key_invalid');
  if (typeof keys.registryRecoveryExportKeyId !== 'string'
    || !keys.registryRecoveryExportKeyId.trim()) {
    throw new Error('custody_recovery_key_id_invalid');
  }
  if ('ownershipCodeKeys' in keys && keys.ownershipCodeKeys !== undefined) {
    if (!Array.isArray(keys.ownershipCodeKeys)) throw new Error('custody_ownership_keys_shape');
    const versions = new Set<number>();
    for (const entry of keys.ownershipCodeKeys) {
      if (!isPlainObject(entry) || !hasExactKeys(entry, ['version', 'keyB64'])) {
        throw new Error('custody_ownership_keys_shape');
      }
      if (!Number.isSafeInteger(entry.version) || Number(entry.version) < 1
        || versions.has(Number(entry.version))) {
        throw new Error('custody_ownership_key_version_invalid');
      }
      versions.add(Number(entry.version));
      assertAesKeyB64(entry.keyB64, 'custody_ownership_key_invalid');
    }
  }
  if ('notes' in keys && keys.notes !== undefined && typeof keys.notes !== 'string') {
    throw new Error('custody_notes_invalid');
  }
}

function normalizeKeys(keys: CustodyKeys): CustodyKeys {
  const normalized: CustodyKeys = {
    registryRecoveryExportKeyB64: keys.registryRecoveryExportKeyB64,
    registryRecoveryExportKeyId: keys.registryRecoveryExportKeyId,
    ownershipCodeKeys: [...(keys.ownershipCodeKeys ?? [])]
      .map((entry) => ({ version: entry.version, keyB64: entry.keyB64 }))
      .sort((left, right) => left.version - right.version),
  };
  if (typeof keys.notes === 'string') normalized.notes = keys.notes;
  return normalized;
}

function envelopeAad(envelope: Omit<CustodyEnvelope, 'ciphertextB64'>): Uint8Array {
  return new TextEncoder().encode(canonicalJson({
    schema: envelope.schema,
    schemaVersion: envelope.schemaVersion,
    kdf: envelope.kdf,
    nonceB64: envelope.nonceB64,
    createdAt: envelope.createdAt,
  }));
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as unknown as BufferSource,
      iterations,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

export async function buildCustodyEnvelope(options: {
  passphrase: string;
  keys: CustodyKeys;
  iterations?: number;
  createdAt?: string;
}): Promise<CustodyEnvelope> {
  const { passphrase, keys } = options;
  if (typeof passphrase !== 'string'
    || passphrase.trim().length < CUSTODY_ENVELOPE_MIN_PASSPHRASE_LENGTH) {
    throw new Error('custody_passphrase_too_short');
  }
  const iterations = options.iterations ?? CUSTODY_ENVELOPE_MIN_ITERATIONS;
  if (!Number.isSafeInteger(iterations) || iterations < CUSTODY_ENVELOPE_MIN_ITERATIONS) {
    throw new Error('custody_iterations_too_low');
  }
  validateCustodyKeys(keys);
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new Error('custody_created_at_invalid');
  }

  const salt = crypto.getRandomValues(new Uint8Array(CUSTODY_ENVELOPE_SALT_BYTES));
  const nonce = crypto.getRandomValues(new Uint8Array(CUSTODY_ENVELOPE_NONCE_BYTES));
  const header: Omit<CustodyEnvelope, 'ciphertextB64'> = {
    schema: CUSTODY_ENVELOPE_SCHEMA,
    schemaVersion: CUSTODY_ENVELOPE_SCHEMA_VERSION,
    kdf: {
      name: CUSTODY_ENVELOPE_KDF_NAME,
      iterations,
      saltB64: bytesToBase64(salt),
    },
    nonceB64: bytesToBase64(nonce),
    createdAt,
  };

  const payload = { kind: CUSTODY_PAYLOAD_KIND, keys: normalizeKeys(keys) };
  const plaintext = new TextEncoder().encode(canonicalJson(payload));
  const key = await deriveAesKey(passphrase, salt, iterations, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as unknown as BufferSource,
      additionalData: envelopeAad(header) as unknown as BufferSource,
      tagLength: 128,
    },
    key,
    plaintext as unknown as BufferSource,
  );
  return { ...header, ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)) };
}

export function validateCustodyEnvelopeShape(value: unknown): asserts value is CustodyEnvelope {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'schema', 'schemaVersion', 'kdf', 'nonceB64', 'ciphertextB64', 'createdAt',
  ])) throw new Error('custody_envelope_shape');
  if (value.schema !== CUSTODY_ENVELOPE_SCHEMA
    || value.schemaVersion !== CUSTODY_ENVELOPE_SCHEMA_VERSION) {
    throw new Error('custody_envelope_unsupported');
  }
  if (!isPlainObject(value.kdf)
    || !hasExactKeys(value.kdf, ['name', 'iterations', 'saltB64'])
    || value.kdf.name !== CUSTODY_ENVELOPE_KDF_NAME
    || typeof value.kdf.saltB64 !== 'string' || !value.kdf.saltB64
    || typeof value.nonceB64 !== 'string' || !value.nonceB64
    || typeof value.ciphertextB64 !== 'string' || !value.ciphertextB64
    || typeof value.createdAt !== 'string' || !value.createdAt) {
    throw new Error('custody_envelope_shape');
  }
  // The iterations floor is a policy check, enforced on open as well as build,
  // so a downgraded envelope is refused before any key derivation happens.
  const iterations = value.kdf.iterations;
  if (typeof iterations !== 'number' || !Number.isSafeInteger(iterations)
    || iterations < CUSTODY_ENVELOPE_MIN_ITERATIONS) {
    throw new Error('custody_iterations_too_low');
  }
}

export async function openCustodyEnvelope(options: {
  passphrase: string;
  envelope: unknown;
}): Promise<CustodyKeys> {
  const { passphrase, envelope } = options;
  if (typeof passphrase !== 'string' || !passphrase) throw new Error(CANNOT_OPEN);
  validateCustodyEnvelopeShape(envelope);

  let salt: Uint8Array;
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = base64ToBytes(envelope.kdf.saltB64);
    nonce = base64ToBytes(envelope.nonceB64);
    ciphertext = base64ToBytes(envelope.ciphertextB64);
  } catch {
    throw new Error('custody_envelope_shape');
  }
  if (salt.byteLength !== CUSTODY_ENVELOPE_SALT_BYTES
    || nonce.byteLength !== CUSTODY_ENVELOPE_NONCE_BYTES) {
    throw new Error('custody_envelope_shape');
  }

  // From here on every failure is the same generic error: no oracle detail
  // distinguishing a wrong passphrase from a tampered envelope.
  let plaintext: ArrayBuffer;
  try {
    const key = await deriveAesKey(passphrase, salt, envelope.kdf.iterations, 'decrypt');
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce as unknown as BufferSource,
        additionalData: envelopeAad(envelope) as unknown as BufferSource,
        tagLength: 128,
      },
      key,
      ciphertext as unknown as BufferSource,
    );
  } catch {
    throw new Error(CANNOT_OPEN);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
  } catch {
    throw new Error(CANNOT_OPEN);
  }
  try {
    if (!isPlainObject(payload) || !hasExactKeys(payload, ['kind', 'keys'])
      || payload.kind !== CUSTODY_PAYLOAD_KIND) {
      throw new Error(CANNOT_OPEN);
    }
    validateCustodyKeys(payload.keys);
    return normalizeKeys(payload.keys);
  } catch {
    throw new Error(CANNOT_OPEN);
  }
}
