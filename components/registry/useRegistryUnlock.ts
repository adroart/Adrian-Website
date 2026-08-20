/**
 * The registry unlock, held for the length of a ceremony.
 *
 * On mount it asks whether the step-up unlock is already open. While the
 * unlock is open it heartbeats POST /api/admin/registry-unlock/refresh every
 * five minutes, so the sliding ten-minute cookie never lapses mid ceremony.
 * When the server answers registry_locked or unlock_absolute_cap, the unlock
 * is reported lost so the ceremony can re-prompt without losing any form
 * state. Network hiccups are ignored; the next beat tries again.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const HEARTBEAT_MS = 5 * 60 * 1000;

export type UnlockState = 'checking' | 'locked' | 'unlocked';

export function useRegistryUnlock(onLost: () => void) {
  const [state, setState] = useState<UnlockState>('checking');
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/registry-unlock', { cache: 'no-store', signal: controller.signal })
      .then(response => response.json())
      .then(data => {
        if (controller.signal.aborted) return;
        setState(data?.unlocked === true ? 'unlocked' : 'locked');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('locked');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state !== 'unlocked') return;
    const beat = async () => {
      try {
        const response = await fetch('/api/admin/registry-unlock/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.ok) return;
        if (data?.error === 'registry_locked' || data?.error === 'unlock_absolute_cap') {
          setState('locked');
          onLostRef.current();
        }
      } catch {
        // A dropped beat is not a lost unlock; the next one tries again.
      }
    };
    const interval = window.setInterval(() => { void beat(); }, HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [state]);

  const unlock = useCallback(async (secret: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/registry-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) return false;
      setState('unlocked');
      return true;
    } catch {
      return false;
    }
  }, []);

  /** The server said the unlock is gone; reflect it without a round trip. */
  const markLost = useCallback(() => setState('locked'), []);

  return { state, unlock, markLost };
}
