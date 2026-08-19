/**
 * pendingBind — the code-then-account seam, held exactly.
 *
 * The sixteen typed characters are held in MEMORY (a React context backed by a
 * ref, never React state, so the code cannot leak into devtools state dumps)
 * from the moment the code page completes. They cross exactly one document
 * boundary: the account bridge (sign-up, sign-in, and any email-verification
 * round trip that can reload the document). For that one passage the code is
 * mirrored to sessionStorage under PENDING_BIND_KEY, and nowhere else:
 *
 *   - NEVER localStorage, NEVER document.cookie, NEVER a URL or query string,
 *     NEVER a log line, NEVER any server call except the final bind body.
 *   - The mirror is written only by bridge(), which the account state screen
 *     calls immediately before handing the person to the auth machinery.
 *   - On return, restore() reads the mirror back into memory and DELETES the
 *     key immediately — before the bind fires, before anything else.
 *   - settle() clears both memory and the mirror. It is called on EVERY
 *     terminal outcome: bound, mismatch, contested 202, any 4xx/5xx error
 *     state, and explicit abandonment.
 *   - A mirrored entry older than 24 hours is discarded on read, unread.
 *
 * The pure functions take a storage argument so the lifecycle is unit-testable
 * against a mocked sessionStorage without a browser.
 */

import React, { createContext, useContext, useRef } from 'react';

export const PENDING_BIND_KEY = 'pendingBind:v1';
export const PENDING_BIND_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingBind = {
  publicCode: string;
  normalizedCode: string;
  ts: number;
};

/** The subset of Storage the bridge needs; lets tests pass a plain mock. */
export interface BindStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Normalize a typed Ownership Code exactly the way api.ts normalizes it before
 * the bind body: strip whitespace and hyphens, uppercase.
 */
export function normalizeTypedCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

/** The document's own sessionStorage, or null where none exists (SSR, tests). */
function documentStorage(): BindStorage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * Write the mirror for the account bridge. This is the ONLY function that
 * writes the key, and the account bridge is the only moment that calls it.
 */
export function mirrorPendingBind(
  entry: { publicCode: string; normalizedCode: string },
  storage: BindStorage | null = documentStorage(),
  now: number = Date.now(),
): void {
  if (!storage) return;
  const record: PendingBind = {
    publicCode: entry.publicCode,
    normalizedCode: entry.normalizedCode,
    ts: now,
  };
  try {
    storage.setItem(PENDING_BIND_KEY, JSON.stringify(record));
  } catch {
    /* a full or blocked store means the reload path simply starts over */
  }
}

/**
 * Read the mirror and DELETE the key in the same motion — the key never
 * outlives its one read. Entries older than PENDING_BIND_TTL_MS are discarded
 * (returned as null) after the same deletion.
 */
export function takePendingBind(
  storage: BindStorage | null = documentStorage(),
  now: number = Date.now(),
): PendingBind | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_BIND_KEY);
  } catch {
    return null;
  }
  clearPendingBind(storage);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.publicCode !== 'string'
    || typeof record.normalizedCode !== 'string'
    || typeof record.ts !== 'number'
    || !Number.isFinite(record.ts)
  ) {
    return null;
  }
  if (now - record.ts > PENDING_BIND_TTL_MS) return null;
  return {
    publicCode: record.publicCode,
    normalizedCode: record.normalizedCode,
    ts: record.ts,
  };
}

/** Remove the mirror without reading it. */
export function clearPendingBind(
  storage: BindStorage | null = documentStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(PENDING_BIND_KEY);
  } catch {
    /* nothing to clear is the same outcome */
  }
}

/* ------------------------------------------------------------------ *
 * The React context: memory first, the mirror only for the bridge.
 * ------------------------------------------------------------------ */

export type PendingBindApi = {
  /** the code currently held in memory, if any */
  peek(): PendingBind | null;
  /** hold the completed code in memory. Never touches any storage. */
  hold(publicCode: string, normalizedCode: string): void;
  /**
   * Mirror the held code for the account bridge — the one passage that can
   * reload the document. Call immediately before opening sign-up/sign-in or
   * leaving for an email-verification round trip.
   */
  bridge(): void;
  /**
   * Recover the held code: memory if it survived, otherwise the mirror
   * (which is deleted in the same motion). Returns null when nothing is
   * pending or the mirrored entry was stale.
   */
  restore(): PendingBind | null;
  /** Terminal outcome or explicit abandonment: clear memory AND the mirror. */
  settle(): void;
};

export function createPendingBindApi(storage: () => BindStorage | null): PendingBindApi {
  let held: PendingBind | null = null;
  return {
    peek: () => held,
    hold(publicCode, normalizedCode) {
      held = { publicCode, normalizedCode, ts: Date.now() };
    },
    bridge() {
      if (held) mirrorPendingBind(held, storage());
    },
    restore() {
      if (held) {
        /* memory survived; the mirror, if any, must not outlive this read */
        clearPendingBind(storage());
        return held;
      }
      held = takePendingBind(storage());
      return held;
    },
    settle() {
      held = null;
      clearPendingBind(storage());
    },
  };
}

/** A shared instance so the hook works without a provider (one journey per document). */
const sharedApi = createPendingBindApi(documentStorage);

const PendingBindContext = createContext<PendingBindApi>(sharedApi);

export const PendingBindProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useRef<PendingBindApi | null>(null);
  if (!api.current) api.current = createPendingBindApi(documentStorage);
  return React.createElement(
    PendingBindContext.Provider,
    { value: api.current },
    children,
  );
};

export function usePendingBind(): PendingBindApi {
  return useContext(PendingBindContext);
}
