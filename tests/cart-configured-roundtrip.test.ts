import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, describe, it, mock } from 'node:test';
import type { CartItem } from '../types';
import { LAUNCH_FLAGS } from '../launchFlags';

const catalog = [{
  id: 'fixture', title: 'Synthetic piece', price: 100, category: 'Synthetic', coverImage: '',
  availability: 'MADE_TO_ORDER', material: 'Synthetic wood', dimensions: '58 cm', edition: 'Open Edition', finish: 'Natural',
  sizeVariants: [
    { size: '29 cm', price: 100, stripePriceId: 'price_synthetic_29', availability: 'MADE_TO_ORDER' },
    { size: '58 cm', price: 200, stripePriceId: 'price_synthetic_58', availability: 'IN_STOCK' },
  ],
}, {
  id: 'restricted', title: 'No options', price: 50, category: 'Synthetic', coverImage: '',
  availability: 'MADE_TO_ORDER', availableAddOns: [],
  madeToOrderSizes: [{ size: '58 cm', price: 50, stripePriceId: 'price_synthetic_restricted', availability: 'MADE_TO_ORDER' }],
}];
const tier = (price: number, name: string) => ({ price, stripePriceId: `price_synthetic_${name}` });
before(() => mock.module('../data/mockData', { namedExports: {
  FULL_ARCHIVE: catalog,
  MADE_TO_ORDER_ADD_ONS: {
    crystals: { small: tier(10, 'crystals_small'), medium: tier(20, 'crystals_medium'), large: tier(30, 'crystals_large') },
    woodFrame: { small: tier(10, 'frame_small'), medium: tier(20, 'frame_medium'), large: tier(30, 'frame_large') },
    illumination: { medium: tier(20, 'light_medium'), large: tier(30, 'light_large'), major: tier(40, 'light_major') },
  },
} }));
after(() => mock.reset());
const config = { version: 1, artworkId: 'fixture', size: '58 cm', addOns: ['crystals', 'woodFrame', 'illumination'] };
const configuredId = 'fixture-58cm-xls-xwf-xil';
const local: CartItem[] = [{ quantity: 2, product: {
  id: configuredId, title: 'Synthetic piece, 58 cm, with crystals, with wood frame, illuminated',
  price: 260, category: 'Synthetic', image: '', available: true, isReadyToShip: true,
  stripePriceId: 'price_synthetic_58', addOnPriceIds: ['price_synthetic_crystals_medium', 'price_synthetic_frame_medium', 'price_synthetic_light_medium'],
} }];

describe('configured cart sync', () => {
  it('roundtrips configured size, options, current catalog price/IDs, metadata and quantity', async () => {
    const { serializeCart, hydrateCart } = await import('../lib/cart/sync');
    const rows = serializeCart(local);
    assert.deepEqual(rows, [{ productId: configuredId, quantity: 2, configurator: config }]);
    const restored = hydrateCart(JSON.parse(JSON.stringify(rows)));
    assert.equal(restored.length, 1);
    assert.deepEqual(restored[0].product, { ...local[0].product, edition: 'Open Edition', material: 'Synthetic wood', dimensions: '58 cm' });
    assert.equal(restored[0].quantity, 2);
  });
  it('recovers legacy generated-ID rows without trusting cached prices or payment IDs', async () => {
    const { hydrateCart } = await import('../lib/cart/sync');
    const [restored] = hydrateCart([{ productId: configuredId, quantity: 2, price: 1, stripePriceId: 'price_attacker' } as any]);
    assert.equal(restored.product.price, 260);
    assert.equal(restored.product.stripePriceId, 'price_synthetic_58');
    assert.equal(restored.product.title, local[0].product.title);
  });
  it('preserves plain rows and different configurations through merge', async () => {
    const { serializeCart, hydrateCart, mergeCarts } = await import('../lib/cart/sync');
    const plain = hydrateCart([{ productId: 'fixture', quantity: 1 }]);
    assert.deepEqual(serializeCart(plain), [{ productId: 'fixture', quantity: 1 }]);
    const noExtras = hydrateCart([{ productId: 'fixture-29cm---', quantity: 3 }]);
    assert.equal(noExtras[0].product.price, 100);
    assert.equal(noExtras[0].product.addOnPriceIds, undefined);
    const merged = mergeCarts(local, [...hydrateCart(serializeCart(local)), ...noExtras]);
    assert.equal(merged.length, 2);
    assert.deepEqual(merged.map(i => i.quantity), [4, 3]);
  });
  it('drops unknown/removed artwork, variants and unavailable options', async () => {
    const { hydrateCart } = await import('../lib/cart/sync');
    assert.deepEqual(hydrateCart([
      { productId: 'removed', quantity: 1 },
      { productId: 'fixture-99cm---', quantity: 1 },
      { productId: 'restricted-58cm-xls--', quantity: 1 },
      { productId: 'fixture-29cm---xil', quantity: 1 },
    ]), []);
  });
  it('rejects malformed or conflicting configuration descriptors', async () => {
    const { hydrateCart } = await import('../lib/cart/sync');
    for (const configurator of [null, [], 'bad', {}, { ...config, version: 2 },
      { ...config, size: 'missing' }, { ...config, artworkId: 'removed' },
      { ...config, addOns: ['crystals', 'crystals'] }, { ...config, addOns: ['unknown'] },
      { ...config, price: 1, stripePriceId: 'price_attacker' }, { ...config, addOns: [] }]) {
      assert.deepEqual(hydrateCart([{ productId: configuredId, quantity: 1, configurator }]), [], JSON.stringify(configurator));
    }
  });
  it('normalizes malformed quantities and ignores malformed rows', async () => {
    const { hydrateCart } = await import('../lib/cart/sync');
    assert.deepEqual(hydrateCart([null, {}, { productId: null }] as any), []);
    assert.deepEqual(hydrateCart([NaN, Infinity, -2, 2.6, 100].map(quantity => ({ productId: configuredId, quantity }))).map(i => i.quantity), [1, 1, 1, 3, 10]);
  });
});

it('checkout sends canonical Stripe price references, never a browser-supplied amount', async () => {
  const { hydrateCart } = await import('../lib/cart/sync');
  const [item] = hydrateCart([{ productId: configuredId, quantity: 2 }]);
  const { onRequestPost } = await import('../functions/api/checkout.js');
  const prior = LAUNCH_FLAGS.shopEnabled;
  const originalFetch = globalThis.fetch;
  const calls: URLSearchParams[] = [];
  LAUNCH_FLAGS.shopEnabled = true;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.stripe.com/v1/checkout/sessions');
    calls.push(new URLSearchParams(String(init?.body)));
    return Response.json({ url: 'https://checkout.stripe.com/synthetic' });
  }) as typeof fetch;
  try {
    const refs = [item.product.stripePriceId, ...(item.product.addOnPriceIds ?? [])];
    const response = await onRequestPost({ request: new Request('https://adrianrasmussen.com/api/checkout', {
      method: 'POST', headers: { Origin: 'https://adrianrasmussen.com' },
      body: JSON.stringify({ items: refs.map(stripePriceId => ({ stripePriceId, quantity: 2, price: 0, amount: 0 })) }),
    }), env: { STRIPE_SECRET_KEY: 'sk_test_synthetic' } });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    refs.forEach((ref, i) => {
      assert.equal(calls[0].get(`line_items[${i}][price]`), ref);
      assert.equal(calls[0].get(`line_items[${i}][quantity]`), '2');
    });
    assert.equal([...calls[0].keys()].some(key => /unit_amount|price_data|amount/.test(key)), false);
  } finally { LAUNCH_FLAGS.shopEnabled = prior; globalThis.fetch = originalFetch; }
});


it('roundtrips the descriptor through unchanged cart put/get routes and existing SQLite schema', async () => {
  const authMock = mock.module('../functions/api/_lib/auth.js', { namedExports: {
    requireUser: async () => ({ userId: 'synthetic-account', email: 'synthetic@example.com' }),
    jsonResponse: (body: unknown, init: ResponseInit = {}) => Response.json(body, init),
  } });
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8'));
  db.exec('ALTER TABLE users ADD COLUMN auth_user_id TEXT; CREATE UNIQUE INDEX fixture_auth_id ON users(auth_user_id);');
  const env = { DB: { prepare(sql: string) {
    let args: SQLInputValue[] = [];
    const statement = {
      bind(...values: SQLInputValue[]) { args = values; return statement; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { db.prepare(sql).run(...args); return { success: true }; },
    }; return statement;
  }, async batch(statements: any[]) { return Promise.all(statements.map(s => s.run())); } } };
  try {
    const { serializeCart, hydrateCart } = await import('../lib/cart/sync');
    const { onRequest: put } = await import('../functions/api/cart/put.js');
    const { onRequest: get } = await import('../functions/api/cart/get.js');
    const rows = serializeCart(local);
    const written = await put({ request: new Request('https://example.test/api/cart/put', { method: 'PUT', body: JSON.stringify(rows) }), env });
    assert.equal(written.status, 200);
    assert.deepEqual(JSON.parse(String(db.prepare('SELECT configurator_json FROM cart_items').get()?.configurator_json)), config);
    const response = await get({ request: new Request('https://example.test/api/cart/get'), env });
    assert.equal(response.status, 200);
    assert.deepEqual(hydrateCart(await response.json()), hydrateCart(rows));
  } finally { db.close(); authMock.restore(); }
});
