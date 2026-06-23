/**
 * Shared helpers for the Living Legacy keeper endpoints
 * (functions/api/keeper/*).
 *
 * Centralizes:
 *   - the `livingLegacy` flag guard (endpoints answer 404 when off, so the
 *     surface is invisible in production until the feature ships),
 *   - the D1 binding guard,
 *   - isomorphic Web Crypto hashing that matches utils/recoveryCode.ts and
 *     utils/intentions.ts byte-for-byte (so a hash computed in the browser, a
 *     test, or here all agree),
 *   - the internal-user lookup (Better Auth userId → users row), reused so a
 *     keeper row keys off the same opaque id everywhere.
 *
 * No personal data ever leaves these helpers toward a ledger hash. The chain is
 * written on the mandalacodes side via the shared inscription path; this site
 * holds the mutable, erasable bodies in D1 (keeper_pieces, keeper_intentions).
 */

import { LAUNCH_FLAGS } from '../../../launchFlags.ts';

/** 404 used to keep the whole keeper surface invisible while the flag is off. */
export function notFound() {
  return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** True when the Living Legacy front door is switched on. */
export function legacyEnabled() {
  return Boolean(LAUNCH_FLAGS.livingLegacy);
}

/** Graceful 503 when the shared D1 migration 008 has not been applied yet. */
export function migrationNotApplied() {
  return json(
    {
      ok: false,
      error:
        'The keeper record is not available yet — D1 migration 008_living_legacy has not been applied to the shared database.',
    },
    503,
  );
}

/** True when a D1 error means the 008 tables don't exist yet. */
export function isMissingTableError(err) {
  return err instanceof Error && /no such table/i.test(err.message);
}

/** Normalize a typed recovery code the same way utils/recoveryCode.ts does. */
export function normalizeRecoveryCode(code) {
  return String(code).replace(/[\s-]+/g, '').toUpperCase();
}

/** SHA-256 hex of the normalized recovery code — matches hashRecoveryCode(). */
export async function hashRecoveryCode(code) {
  const data = new TextEncoder().encode(normalizeRecoveryCode(code));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Random 16-byte salt hex — matches utils/intentions.generateSaltHex(). */
export function generateSaltHex() {
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  return [...rnd].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256(saltHex + body) hex — matches utils/intentions.computeContentHash(). */
export async function computeContentHash(saltHex, body) {
  const data = new TextEncoder().encode(saltHex + body);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Opaque keeper-piece binding id. */
export function genKeeperPieceId() {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...rnd].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `kp-${Date.now().toString(36)}-${hex}`;
}

/** Opaque intention id (also the chain inscriptionId). Matches genIntentionId(). */
export function genIntentionId() {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  const hex = [...rnd].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `int-${Date.now().toString(36)}-${hex}`;
}
