/**
 * Client bridge to the pricing backend (functions/api/pricing/*).
 *
 * The server is authoritative; localStorage is a fast cache and an offline
 * fallback. Every read returns immediately useful data even with no network
 * (cache, then bundled defaults), and every write updates the cache
 * optimistically so the UI never blocks on the round-trip.
 */

import { PricingConfig, SavedQuote, InternalInputs } from './types';
import {
  cloneDefaultConfig,
  loadConfig as loadCachedConfig,
  saveConfig as cacheConfig,
  loadQuotes as loadCachedQuotes,
  saveQuotes as cacheQuotes,
} from './config';

const CONFIG_URL = '/api/pricing/config';
const QUOTES_URL = '/api/pricing/quotes';

export interface NewQuote {
  name: string;
  inputs: InternalInputs;
  suggestedRetail: number;
  quote: number;
  actualPrice?: number | null;
}

/** Fetch the tuned model from the server, falling back to cache, then defaults. */
export async function fetchConfig(): Promise<PricingConfig> {
  try {
    const res = await fetch(CONFIG_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.config) {
        const merged = { ...cloneDefaultConfig(), ...data.config };
        cacheConfig(merged);
        return merged;
      }
    }
  } catch {
    /* offline — use the cache */
  }
  return loadCachedConfig();
}

/** Persist the model. Always caches locally; returns whether the server took it. */
export async function pushConfig(config: PricingConfig): Promise<boolean> {
  cacheConfig(config);
  try {
    const res = await fetch(CONFIG_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchQuotes(): Promise<SavedQuote[]> {
  try {
    const res = await fetch(QUOTES_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && Array.isArray(data.quotes)) {
        cacheQuotes(data.quotes);
        return data.quotes;
      }
    }
  } catch {
    /* offline */
  }
  return loadCachedQuotes();
}

export async function createQuote(input: NewQuote): Promise<SavedQuote> {
  try {
    const res = await fetch(QUOTES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ok && data.quote) return data.quote as SavedQuote;
    }
  } catch {
    /* offline */
  }
  // Local-only fallback so saving still works without a backend.
  return {
    id: `local-${Date.now()}`,
    name: input.name,
    savedAt: new Date().toISOString(),
    inputs: input.inputs,
    suggestedRetail: input.suggestedRetail,
    quote: input.quote,
    actualPrice: input.actualPrice ?? null,
  };
}

export async function updateQuote(
  id: string,
  patch: { name?: string; actualPrice?: number | null }
): Promise<void> {
  if (id.startsWith('local-')) return; // never round-tripped to the server
  try {
    await fetch(`${QUOTES_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch {
    /* offline — the cached copy still reflects the change */
  }
}

export async function deleteQuote(id: string): Promise<void> {
  if (id.startsWith('local-')) return;
  try {
    await fetch(`${QUOTES_URL}/${id}`, { method: 'DELETE' });
  } catch {
    /* offline */
  }
}
