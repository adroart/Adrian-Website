/**
 * Session-scoped persistence for I Ching casts.
 *
 * A cast belongs to the card it was thrown on. Holding it in component state
 * alone means it is lost the moment the reader follows the "becoming" link to
 * the changed hexagram and hits browser back — the card component unmounts.
 *
 * This wrapper mirrors each cast to `sessionStorage`, keyed by card number,
 * so back-navigation restores the exact same reading. It clears when the tab
 * closes, which is the right lifetime for a divination: durable across a
 * session of exploring, gone when you leave.
 *
 * Every call is wrapped in try/catch. Private browsing and storage-disabled
 * environments throw on access; in those cases the functions degrade to
 * no-ops and the feature simply runs in-memory only. It must never break the
 * page.
 */

import type { CastResult, CastLine } from './ichingCasting';

const KEY_PREFIX = 'ul-iching-cast-';

function keyFor(cardNumber: number): string {
  return `${KEY_PREFIX}${cardNumber}`;
}

/** True when `sessionStorage` is reachable. */
function storageAvailable(): boolean {
  try {
    const probe = '__ul_probe__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Narrow an unknown parsed value to a trustworthy CastResult. */
function isCastResult(value: unknown): value is CastResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.lines) || v.lines.length !== 6) return false;
  const linesOk = v.lines.every((l) => {
    if (typeof l !== 'object' || l === null) return false;
    const line = l as Record<string, unknown>;
    return (
      typeof line.position === 'number' &&
      typeof line.value === 'number' &&
      typeof line.yang === 'boolean' &&
      typeof line.moving === 'boolean'
    );
  });
  if (!linesOk) return false;
  if (typeof v.primaryNumber !== 'number') return false;
  if (v.changedNumber !== null && typeof v.changedNumber !== 'number') return false;
  if (!Array.isArray(v.movingPositions)) return false;
  return true;
}

/** Persist a cast for a card. Silently no-ops if storage is unavailable. */
export function saveCast(cardNumber: number, cast: CastResult): void {
  if (!storageAvailable()) return;
  try {
    window.sessionStorage.setItem(keyFor(cardNumber), JSON.stringify(cast));
  } catch {
    /* quota or serialization failure — in-memory state still holds the cast */
  }
}

/** Restore a previously saved cast for a card, or null if none / invalid. */
export function loadCast(cardNumber: number): CastResult | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.sessionStorage.getItem(keyFor(cardNumber));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCastResult(parsed)) {
      window.sessionStorage.removeItem(keyFor(cardNumber));
      return null;
    }
    // Re-narrow lines to the typed shape now that the structure is trusted.
    return {
      ...parsed,
      lines: parsed.lines as CastLine[],
    };
  } catch {
    return null;
  }
}

/** Drop a saved cast for a card. */
export function clearCast(cardNumber: number): void {
  if (!storageAvailable()) return;
  try {
    window.sessionStorage.removeItem(keyFor(cardNumber));
  } catch {
    /* nothing to do */
  }
}
