import assert from 'node:assert/strict';
import { after, it } from 'node:test';
import { onRequestPost } from '../functions/api/checkout.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

it('rejects a direct checkout before Stripe while the shop launch flag is off', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new Error('provider must not be called');
  }) as typeof fetch;
  const prior = LAUNCH_FLAGS.shopEnabled;
  LAUNCH_FLAGS.shopEnabled = false;
  try {
    const response = await onRequestPost({
      request: new Request('https://adrianrasmussen.com/api/checkout', {
        method: 'POST', headers: { origin: 'https://adrianrasmussen.com' },
        body: JSON.stringify({ items: [{ stripePriceId: 'price_valid', quantity: 1 }] }),
      }),
      env: { STRIPE_SECRET_KEY: 'sk_test_synthetic' },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'shop_closed' });
    assert.deepEqual(calls, []);
  } finally { LAUNCH_FLAGS.shopEnabled = prior; }
});
