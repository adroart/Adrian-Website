/**
 * Pure, I/O-free utilities for the Atlas append-only ledger.
 *
 * Every function here is deterministic and isomorphic — it runs identically
 * in Cloudflare Functions and the browser. No fetch, no env, no R2. The
 * backend handler in functions/api/atlas/* will use these to read a chain
 * from R2, append a new event, and write it back atomically.
 *
 * Chain model:
 *   Events are grouped per `(pieceId, editionNumber)` pair. The first event
 *   in a chain has `prevHash: null`; every subsequent event references the
 *   previous event's hash. This makes tampering detectable: changing any
 *   historical event invalidates every later hash in that chain.
 *
 * Hashing:
 *   SHA-256 of the canonical (sorted-keys) JSON of the event, EXCLUDING the
 *   `hash` field itself. We include `prevHash` in the hashed payload so the
 *   chain link is bound into the hash.
 */
import type { LedgerEvent } from '../types';

/**
 * Serialize an object deterministically: keys sorted recursively, no
 * whitespace, undefined values dropped. Two semantically equal objects
 * produce identical strings; identical strings imply identical hashes.
 *
 * Used as the hash input. Exported because downstream tooling (e.g. the
 * GitHub mirror script) may want to recompute hashes for verification.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) continue;
    out[key] = sortKeys(v);
  }
  return out;
}

/**
 * SHA-256 of canonicalize(event), returned as lowercase hex. Uses the Web
 * Crypto API (crypto.subtle.digest), which is available in modern browsers
 * and Cloudflare Workers without any imports.
 */
export async function computeHash(
  event: Omit<LedgerEvent, 'hash'>,
): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(event));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(buf);
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Given the existing per-piece chain (in append order) and an incomplete
 * new event, return a fully-formed event with `prevHash` and `hash` set.
 *
 * The chain MUST already be in append order (oldest first). The caller is
 * responsible for filtering global events down to a single (pieceId,
 * editionNumber) chain before calling.
 */
export async function appendEvent(
  chain: LedgerEvent[],
  newEvent: Omit<LedgerEvent, 'hash' | 'prevHash'>,
): Promise<LedgerEvent> {
  const prevHash = chain.length === 0 ? null : chain[chain.length - 1].hash;
  const withPrev: Omit<LedgerEvent, 'hash'> = { ...newEvent, prevHash };
  const hash = await computeHash(withPrev);
  return { ...withPrev, hash };
}

export interface VerifyResult {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

/**
 * Verify the integrity of a per-piece chain. Returns `{ ok: true }` if
 * every link recomputes correctly. On failure, returns the index of the
 * first broken event and a short reason.
 *
 * Verification rules:
 *   - The genesis event must have `prevHash: null`.
 *   - Each subsequent event must have `prevHash` equal to the previous
 *     event's `hash`.
 *   - Each event's `hash` must equal `computeHash` of the rest of the event.
 */
export async function verifyChain(chain: LedgerEvent[]): Promise<VerifyResult> {
  for (let i = 0; i < chain.length; i++) {
    const event = chain[i];
    const expectedPrev = i === 0 ? null : chain[i - 1].hash;
    if (event.prevHash !== expectedPrev) {
      return {
        ok: false,
        brokenAt: i,
        reason:
          i === 0
            ? 'genesis event prevHash must be null'
            : `prevHash at index ${i} does not match previous event's hash`,
      };
    }
    const { hash, ...rest } = event;
    const recomputed = await computeHash(rest);
    if (recomputed !== hash) {
      return {
        ok: false,
        brokenAt: i,
        reason: `event hash at index ${i} does not match canonical payload`,
      };
    }
  }
  return { ok: true };
}

/**
 * Group a flat list of events by `(pieceId, editionNumber)`. Returned map
 * uses the same key format as ledgerProjection's projectAll: pieces with
 * no editionNumber use `0` in the key. Each value is sorted by `date`
 * ascending so callers can feed it straight to appendEvent / verifyChain.
 */
export function groupChains(events: LedgerEvent[]): Map<string, LedgerEvent[]> {
  const groups = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    const key = `${e.pieceId}:${e.editionNumber ?? 0}`;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return groups;
}
