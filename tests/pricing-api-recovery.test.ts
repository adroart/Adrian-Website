import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { createQuote, deleteQuote, fetchQuotes, pushConfig, readServerConfig, updateQuote } from '../utils/pricing/api';
import { onRequest as pricingConfig } from '../functions/api/pricing/config.js';
import { cloneDefaultConfig } from '../utils/pricing/config';
import type { NewQuote } from '../utils/pricing/api';

afterEach(() => mock.restoreAll());
const quote = { name: 'Cabinet', inputs: {}, suggestedRetail: 3000, quote: 3000 } as NewQuote;

test('an unavailable pricing database cannot appear as a confirmed default model', async () => {
  for (const env of [{}, { DB: { prepare() { throw new Error('database unavailable'); } } }]) {
    mock.method(globalThis, 'fetch', async () => pricingConfig({
      request: new Request('http://localhost/api/pricing/config'), env,
    }));
    await assert.rejects(readServerConfig(), /studio_unavailable/);
    mock.restoreAll();
  }
});

test('failed Studio writes reject instead of synthesizing saved references', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ ok: false, error: 'unavailable' }, { status: 503 }));
  await assert.rejects(createQuote(quote));
  await assert.rejects(updateQuote('1', { actualPrice: 2999 }));
  await assert.rejects(deleteQuote('1'));
  await assert.rejects(pushConfig(cloneDefaultConfig()));
});

test('successful HTTP responses still require Studio confirmation and expected data', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ ok: false }));
  await assert.rejects(pushConfig(cloneDefaultConfig()));
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }));
  await assert.rejects(createQuote(quote));
  await assert.rejects(updateQuote('1', { actualPrice: 2999 }));
  await assert.rejects(fetchQuotes());
});
