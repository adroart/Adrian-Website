/**
 * Recovery codes for Living Legacy keeper binding (Decision C: "long code on
 * the back of the art").
 *
 * Two distinct identifiers live on a physical piece:
 *   - the PUBLIC QR number (data/qrRegistry.ts) — look-only. Scanning it wakes
 *     the piece up and shows the certificate. It binds nobody and can be read by
 *     anyone holding (or photographing) the piece.
 *   - the RECOVERY CODE (this file) — a long code under a scratch panel on the
 *     back of the art. It is the secret that BINDS a signed-in user as the
 *     keeper. Possession of the physical object (and therefore the code) is the
 *     proof of ownership.
 *
 * Everything here is pure and isomorphic — Web Crypto only (crypto.subtle,
 * crypto.getRandomValues), available identically in the browser and in
 * Cloudflare Functions. No imports, no env. Mirrors the hashing discipline of
 * mandalacodes' utils/ledger.ts computeHash and utils/inscriptions.ts.
 *
 * INVARIANT: the plaintext recovery code is NEVER stored — not in the repo, not
 * in D1, not in any log. Only its SHA-256 hash (hashRecoveryCode) is persisted
 * (keeper_pieces.recovery_code_hash) and compared against. The repo's QR
 * registry stores at most the hash, as a worked example.
 */

/**
 * The recovery-code alphabet. Same family as QR_RULES.charset (A-Z, 0-9,
 * hyphen) but with the hyphen reserved as the group SEPARATOR, not a code
 * character, and with the visually ambiguous glyphs removed so a human reading
 * a small print can transcribe it without error:
 *   - O and 0, I and 1, and the letters that collide when laser-etched small.
 * Kept uppercase only, matching the QR registry's "no lowercase" rule.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 glyphs, no O/0/I/1
const GROUP_SIZE = 4;
const GROUP_COUNT = 4; // 16 code characters total, hyphen-grouped: XXXX-XXXX-XXXX-XXXX

/**
 * Generate a fresh recovery code: 16 characters from CODE_ALPHABET, drawn from
 * crypto.getRandomValues with rejection sampling (no modulo bias), grouped in
 * fours by hyphens for legibility on the printed panel. Example:
 *   "K7QM-9XTR-2PHV-N4WB"
 *
 * 32^16 ≈ 1.2e24 possibilities — vastly more than the number of physical
 * pieces, so guessing is not a threat model; the code's job is to prove the
 * holder physically has the piece.
 */
export function generateRecoveryCode(): string {
  const chars: string[] = [];
  const total = GROUP_SIZE * GROUP_COUNT;
  // Rejection sampling: 256 % 32 === 0, so a plain byte read is already
  // unbiased here, but keep the guard explicit in case the alphabet changes.
  const max = 256 - (256 % CODE_ALPHABET.length);
  while (chars.length < total) {
    const buf = crypto.getRandomValues(new Uint8Array(total));
    for (let i = 0; i < buf.length && chars.length < total; i++) {
      if (buf[i] >= max) continue; // reject to keep the distribution flat
      chars.push(CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]);
    }
  }
  const groups: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    groups.push(chars.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE).join(''));
  }
  return groups.join('-');
}

/**
 * Normalize a code the way a human might type it: strip whitespace, uppercase,
 * and drop the grouping hyphens so "k7qm 9xtr2phv-n4wb" and "K7QM-9XTR-2PHV-N4WB"
 * hash identically. The hash is taken over the normalized form so the printed
 * grouping is purely cosmetic.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * SHA-256 of the normalized recovery code, lowercase hex. Same construction as
 * mandalacodes' computeHash (Web Crypto, TextEncoder, lowercase hex) so the two
 * sites hash identically. This is the ONLY representation of a recovery code
 * that is ever persisted.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
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
 * Shape-validate a code before doing any work: after normalization it must be
 * exactly GROUP_SIZE * GROUP_COUNT characters, all from CODE_ALPHABET. Cheap
 * client+server guard so an obviously malformed code never reaches a hash or a
 * D1 lookup.
 */
export function isWellFormedRecoveryCode(code: string): boolean {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== GROUP_SIZE * GROUP_COUNT) return false;
  for (const ch of normalized) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
