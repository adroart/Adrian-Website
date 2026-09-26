import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import worker from '../workers/media.js';
import { img } from '../utils/media';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function imageOptionsFor(query: string) {
  let options: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_url: unknown, init?: { cf?: { image?: Record<string, unknown> } }) => {
    options = init?.cf?.image;
    return new Response('img', { headers: { 'Content-Type': 'image/jpeg' } });
  }) as typeof fetch;
  const response = await worker.fetch(
    new Request(`https://adrianrasmussen.com/media/image/18_kznsph?${query}`),
    {},
  );
  assert.equal(response.status, 200);
  return options;
}

test('a width alone scales down instead of asking for a cover crop', async () => {
  const options = await imageOptionsFor('w=600');
  assert.equal(options?.width, 600);
  assert.equal(options?.height, undefined);
  assert.equal(options?.fit, 'scale-down');
});

test('social card sizes keep their 630 and 540 heights', async () => {
  assert.deepEqual(
    [await imageOptionsFor('w=1200&h=630'), await imageOptionsFor('w=960&h=540')].map((o) => [o?.width, o?.height, o?.fit]),
    [[1200, 630, 'cover'], [960, 540, 'cover']],
  );
});

test('a height outside the allowed pairs is dropped', async () => {
  const options = await imageOptionsFor('w=1200&h=631');
  assert.equal(options?.height, undefined);
  assert.equal(options?.fit, 'scale-down');
});

test('the format comes from the URL, never from Accept', async () => {
  let options: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_url: unknown, init?: { cf?: { image?: Record<string, unknown> } }) => {
    options = init?.cf?.image;
    return new Response('img');
  }) as typeof fetch;
  const formatFor = async (query: string, accept: string) => {
    await worker.fetch(
      new Request(`https://adrianrasmussen.com/media/image/18_kznsph?${query}`, { headers: { Accept: accept } }),
      {},
    );
    return options?.format;
  };
  assert.equal(await formatFor('w=600', 'image/avif,image/webp,*/*'), 'webp');
  assert.equal(await formatFor('w=600', '*/*'), 'webp');
  assert.equal(await formatFor('w=1200&h=630&format=jpg', 'image/avif'), 'jpeg');
});

test('every sized URL names its format so the cache key says what it holds', () => {
  assert.equal(img('18_kznsph', { w: 600 }), '/media/image/18_kznsph?w=600&format=webp');
  assert.equal(
    img('18_kznsph', { w: 1200, h: 630, format: 'jpg' }),
    '/media/image/18_kznsph?w=1200&h=630&format=jpg',
  );
  assert.equal(img('18_kznsph'), '/media/image/18_kznsph');
});
