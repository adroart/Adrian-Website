/**
 * Steward keys are capability tokens — a single string a collector types in
 * (or scans a QR for) to prove they hold a particular piece. We treat them
 * more like high-entropy API keys than passwords:
 *
 *   - Generated server-side at issue time with crypto.getRandomValues.
 *   - Shown to Adrian ONCE so he can print them on the certificate of
 *     authenticity / send via email. Never persisted in raw form.
 *   - Stored only as SHA-256 hex on the server in StewardRecord.keyHash.
 *   - Verified by hashing the submitted key and comparing strings.
 *
 * Format choice: 4 groups of 4 alphanumeric characters separated by
 * hyphens, e.g. `A3kf-9zPq-WxLm-7nQr`. 16 chars from a 62-symbol alphabet
 * is ~95 bits of entropy, which is overkill for a capability token but
 * well below "annoying to type" while remaining visually distinctive
 * against a printed certificate.
 */

// URL-safe alphabet, no look-alike characters (no 0/O/1/l/I) to make
// hand-transcription from a printed certificate less error-prone.
const ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ' + // no I, O
  'abcdefghijkmnopqrstuvwxyz' + // no l
  '23456789'; // no 0, 1

const GROUP_LEN = 4;
const GROUP_COUNT = 4;

/**
 * Generate a fresh steward key. Returns the raw key as a hyphenated string.
 * Caller is responsible for hashing it (hashStewardKey) before persistence
 * and surfacing the raw value exactly once.
 */
export function generateStewardKey(): string {
  const total = GROUP_LEN * GROUP_COUNT;
  const bytes = new Uint8Array(total);
  crypto.getRandomValues(bytes);

  let out = '';
  for (let i = 0; i < total; i++) {
    if (i > 0 && i % GROUP_LEN === 0) out += '-';
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * SHA-256 of the raw key, hex-encoded. Same hashing primitive as the
 * ledger uses, available isomorphically in the browser and in Cloudflare
 * Functions via the Web Crypto API.
 */
export async function hashStewardKey(rawKey: string): Promise<string> {
  const normalized = normalizeKey(rawKey);
  const data = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Compare a submitted raw key against the stored hash.
 *
 * String equality on a hash is fine here — these aren't password hashes,
 * they're 95-bit capability tokens. A timing oracle on the comparison
 * would buy an attacker nothing useful: they'd still have to brute-force
 * the underlying token space. We still hash-then-compare so the raw
 * never appears in memory longer than necessary.
 */
export async function verifyStewardKey(
  rawKey: string,
  storedHash: string,
): Promise<boolean> {
  const candidate = await hashStewardKey(rawKey);
  return candidate === storedHash;
}

/**
 * Normalize a user-typed key: strip whitespace, drop hyphens, lowercase-
 * sensitive comparison is intentional (the alphabet includes both cases).
 * Exported for tests; production callers should let hashStewardKey handle
 * it internally.
 */
export function normalizeKey(rawKey: string): string {
  return rawKey.replace(/\s+/g, '').replace(/-/g, '');
}
