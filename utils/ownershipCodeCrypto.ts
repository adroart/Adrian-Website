export interface OwnershipCodeContext {
  publicCode: string;
  pieceId: string;
  editionNumber: string | number;
}

export interface OwnershipCodeEnvelope {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
}

export type OwnershipCodeKeyEnvironment = Record<string, string | undefined>;

const NONCE_BYTES = 12;
const KEY_BYTES = 32;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const VERSION_PATTERN = /^\d+$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string, label: string): Uint8Array {
  if (!value || !BASE64_PATTERN.test(value)) {
    throw new Error(`${label} must be valid base64`);
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error(`${label} must be valid base64`);
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytesToBase64(bytes) !== value) {
    throw new Error(`${label} must be valid base64`);
  }
  return bytes;
}

function assertKeyVersion(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  if (!VERSION_PATTERN.test(value)) throw new Error(`${label} must be a numeric version`);
  return value;
}

async function importKey(
  env: OwnershipCodeKeyEnvironment,
  keyVersion: string,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const encodedKey = env[`OWNERSHIP_CODE_KEY_V${keyVersion}`];
  if (!encodedKey) throw new Error(`Ownership code key version ${keyVersion} is not configured`);

  const keyBytes = base64ToBytes(encodedKey, `Ownership code key version ${keyVersion}`);
  if (keyBytes.byteLength !== KEY_BYTES) {
    throw new Error(`Ownership code key version ${keyVersion} must decode to 32 bytes`);
  }

  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [usage]);
}

function authenticatedContext(context: OwnershipCodeContext, keyVersion: string): Uint8Array {
  return encoder.encode(
    `${context.publicCode}|${context.pieceId}|${context.editionNumber}|${keyVersion}`,
  );
}

export async function encryptOwnershipCode(
  plaintext: string,
  context: OwnershipCodeContext,
  env: OwnershipCodeKeyEnvironment,
  activeKeyVersion?: string,
): Promise<OwnershipCodeEnvelope> {
  const keyVersion = assertKeyVersion(
    activeKeyVersion ?? env.OWNERSHIP_CODE_ACTIVE_KEY_VERSION,
    'Active ownership code key version',
  );
  const key = await importKey(env, keyVersion, 'encrypt');
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: authenticatedContext(context, keyVersion),
    },
    key,
    encoder.encode(plaintext),
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    nonce: bytesToBase64(nonce),
    keyVersion,
  };
}

export async function decryptOwnershipCode(
  envelope: OwnershipCodeEnvelope,
  context: OwnershipCodeContext,
  env: OwnershipCodeKeyEnvironment,
): Promise<string> {
  const keyVersion = assertKeyVersion(envelope.keyVersion, 'Ownership code key version');
  const key = await importKey(env, keyVersion, 'decrypt');
  const nonce = base64ToBytes(envelope.nonce, 'Ownership code nonce');
  if (nonce.byteLength !== NONCE_BYTES) {
    throw new Error(`Ownership code nonce must decode to ${NONCE_BYTES} bytes`);
  }
  const ciphertext = base64ToBytes(envelope.ciphertext, 'Ownership code ciphertext');

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: authenticatedContext(context, keyVersion),
    },
    key,
    ciphertext,
  );
  return decoder.decode(plaintext);
}
