import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireAdmin: async (request: Request) => {
      if (request.headers.get('Cookie') !== 'admin-session') {
        return new Response('{"error":"unauthorized"}', { status: 401 });
      }
      if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) {
        return new Response('{"error":"origin_forbidden"}', { status: 403 });
      }
      return { userId: 'synthetic-admin' };
    },
  },
});

const { onRequest } = await import('../functions/api/admin/viewings/recommendation.js');
const { fetchChart } = await import('../components/viewing/curationEngine.ts');
const origin = 'https://adrianrasmussen.com';
const chart = { profile: { lifesWork: { gate: 1, line: 1 } } };
const key = 'synthetic-service-key';
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; });

function request(options: { cookie?: string; origin?: string; body?: string; method?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.cookie !== undefined) headers.set('Cookie', options.cookie);
  if (options.origin !== undefined) headers.set('Origin', options.origin);
  return new Request(`${origin}/api/admin/viewings/recommendation`, {
    method: options.method || 'POST',
    headers,
    body: options.method === 'GET' ? undefined : options.body ?? JSON.stringify(chart),
  });
}

function invoke(options: Parameters<typeof request>[0] = {}, env: Record<string, unknown> = { ORACLE_API_TOKEN: key }) {
  return onRequest({ request: request({ cookie: 'admin-session', origin, ...options }), env });
}

describe('admin viewing recommendation relay', () => {
  it('blocks unauthenticated and cross-origin requests before forwarding', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('should not fetch'); };
    assert.equal((await invoke({ cookie: '' })).status, 401);
    assert.equal((await invoke({ origin: 'https://other.example' })).status, 403);
    assert.equal(calls, 0);
  });

  it('fails closed without a configured server key', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('should not fetch'); };
    for (const env of [{}, { ORACLE_API_TOKEN: '' }, { ORACLE_API_TOKEN: ' ' }]) {
      const response = await invoke({}, env);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { error: 'recommendation_unavailable' });
    }
    assert.equal(calls, 0);
  });

  it('forwards the approved chart to the fixed upstream with a server-only bearer', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const upstreamData = { clientName: 'Synthetic', pieces: [{ gate: 1, sphere: "Life's Work", cardName: 'Earth\'s Breath' }] };
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify(upstreamData), { status: 200 });
    };
    const body = { clientName: 'Synthetic', ...chart, upstreamUrl: 'https://attacker.example' };
    const response = await invoke({ body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), upstreamData);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://mandalacodes.com/api/oracle/recommendation');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.redirect, 'error');
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${key}`);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { clientName: 'Synthetic', ...chart });
    assert.doesNotMatch(JSON.stringify(upstreamData), /synthetic-service-key/);
  });

  it('rejects invalid input and sanitizes upstream failures', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{"error":"upstream secret detail"}', { status: 401 }); };
    assert.equal((await invoke({ body: '{' })).status, 400);
    assert.equal((await invoke({ body: '{}' })).status, 400);
    assert.equal((await invoke({ body: '{"profile":[]}' })).status, 400);
    assert.equal(calls, 0);
    const response = await invoke();
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'recommendation_unavailable' });
    globalThis.fetch = async () => { throw new Error('redirect or network detail'); };
    const thrown = await invoke();
    assert.equal(thrown.status, 502);
    assert.deepEqual(await thrown.json(), { error: 'recommendation_unavailable' });
  });

  it('keeps the browser on the same-origin relay without sending a key', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify({ clientName: 'Synthetic', pieces: [
        { gate: 1, sphere: "Life's Work", cardName: 'Earth\'s Breath', keywords: ['start'] },
      ] }), { status: 200 });
    };
    const result = await fetchChart({ clientName: 'Synthetic', ...chart });
    assert.equal(calls[0].url, '/api/admin/viewings/recommendation');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, undefined);
    assert.equal(result.spheres[0].gate, 1);
  });
});
