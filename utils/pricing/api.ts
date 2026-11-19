/** Client bridge to the pricing backend. Studio writes only report success
 * after the server confirms them. The public calculator may use its cache. */
import type { PricingConfig, SavedQuote, InternalInputs } from './types';
import type { PaymentTermMode } from '../../components/invoices/invoiceTypes';
import {
  cloneDefaultConfig,
  loadConfig as loadCachedConfig,
  saveConfig as cacheConfig,
} from './config';

const CONFIG_URL = '/api/pricing/config';
const QUOTES_URL = '/api/pricing/quotes';

export interface NewQuote {
  name: string;
  inputs: InternalInputs;
  suggestedRetail: number;
  quote: number;
  actualPrice?: number | null;
  configuration?: string;
  artworkId?: string;
}

export interface QuoteAcceptance {
  clientName: string;
  clientEmail: string;
  artworkTitle: string;
  configuration: string;
  amountCents: number;
  termMode: PaymentTermMode;
  conversation: string;
}

export class PricingRequestError extends Error {
  constructor(message: string, public invoiceId?: number) { super(message); }
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method, cache: 'no-store',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok !== true) throw new PricingRequestError(data?.error || 'studio_unavailable', data?.invoiceId);
  return data as T;
}

export async function readServerConfig(): Promise<PricingConfig> {
  const data = await request<{ config: Partial<PricingConfig> | null; available?: boolean }>(CONFIG_URL);
  if (data.available === false) throw new PricingRequestError('studio_unavailable');
  return { ...cloneDefaultConfig(), ...data.config };
}

/** Fetch the tuned model for the public calculator, falling back to its cache. */
export async function fetchConfig(): Promise<PricingConfig> {
  try {
    const config = await readServerConfig();
    cacheConfig(config);
    return config;
  } catch { return loadCachedConfig(); }
}

export async function pushConfig(config: PricingConfig): Promise<void> {
  await request(CONFIG_URL, 'PUT', { config });
  cacheConfig(config);
}

export async function fetchQuotes(): Promise<SavedQuote[]> {
  const data = await request<{ quotes: SavedQuote[] }>(QUOTES_URL);
  if (!Array.isArray(data.quotes)) throw new PricingRequestError('invalid_quotes_response');
  return data.quotes;
}

function confirmedQuote(data: { quote: SavedQuote }): SavedQuote {
  if (!data.quote || typeof data.quote.id !== 'string' || !data.quote.id || typeof data.quote.name !== 'string') {
    throw new PricingRequestError('invalid_quote_response');
  }
  return data.quote;
}

export async function createQuote(input: NewQuote): Promise<SavedQuote> {
  return confirmedQuote(await request<{ quote: SavedQuote }>(QUOTES_URL, 'POST', input));
}

export async function updateQuote(id: string, patch: { name?: string; actualPrice?: number | null }): Promise<SavedQuote> {
  return confirmedQuote(await request<{ quote: SavedQuote }>(`${QUOTES_URL}/${encodeURIComponent(id)}`, 'PATCH', patch));
}

export async function deleteQuote(id: string): Promise<void> {
  await request(`${QUOTES_URL}/${encodeURIComponent(id)}`, 'DELETE');
}

export async function acceptQuote(id: string, agreement: QuoteAcceptance): Promise<number> {
  return (await request<{ invoiceId: number }>(`${QUOTES_URL}/${encodeURIComponent(id)}/accept`, 'POST', agreement)).invoiceId;
}
