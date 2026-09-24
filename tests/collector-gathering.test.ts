import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { persistCollectorGathering } from '../components/collector/gathering';

const originalFetch = globalThis.fetch;
const birth = { date: '1990-06-12', time: '09:30', place: { label: 'Denpasar', lat: -8.65, lng: 115.22, tzId: 'Asia/Makassar' } };
const person = { shareIntention: true, shareName: false, shareFace: false, shareDerivedChart: false, shareBusiness: false, shareMission: false };
const privacy = { ring1: { privateRecord: true }, ring2: { shareCity: false, cityId: null }, ring3: { shareDerivedChart: false }, ring4: { ...person }, policyVersion: 'collector-privacy-v1' };
let calls: { path: string; method: string; body: any }[];
let profile: any;
let handler: (path: string, method: string, body: any) => Promise<Response>;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const input = () => ({ keeperPieceId: 'kp-test', birth, privacy: { person }, isCurrent: () => true });
beforeEach(() => {
  calls = []; profile = { status: 'missing' };
  handler = async (path, method, body) => {
    if (path === '/api/collector/onboarding') {
      if (method === 'POST') profile = { status: 'current', inputs: body.inputs, updatedAt: '2026-09-22T00:00:00.000Z' };
      return response(profile);
    }
    return response(privacy);
  };
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    const path = String(url); const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path, method, body });
    return handler(path, method, body);
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('reads real state, waits for the birth save, then saves the complete privacy request once', async () => {
  const normal = handler;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let birthStarted!: () => void;
  const started = new Promise<void>(resolve => { birthStarted = resolve; });
  handler = async (path, method, body) => {
    if (method === 'POST') { birthStarted(); await held; }
    return normal(path, method, body);
  };
  const writing = persistCollectorGathering(input());
  await started;
  assert.equal(calls.some(call => call.method === 'PUT'), false);
  release();
  assert.deepEqual(await writing, { kind: 'saved' });
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'POST', 'PUT']);
  assert.deepEqual(calls.at(-1)?.body, { person });
});

test('a refused privacy write stays rejected and retry does not rewrite the accepted birth profile', async () => {
  const normal = handler;
  let reject = true;
  handler = async (path, method, body) => method === 'PUT' && reject
    ? response({ error: 'adult_profile_required' }, 403) : normal(path, method, body);
  assert.deepEqual(await persistCollectorGathering(input()), { kind: 'rejected', stage: 'privacy', error: 'adult_profile_required' });
  reject = false;
  assert.deepEqual(await persistCollectorGathering(input()), { kind: 'saved' });
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.deepEqual(calls.filter(call => call.method === 'PUT').map(call => call.body), [{ person }, { person }]);
});

for (const path of ['/api/collector/onboarding', '/api/collector/privacy?piece=kp-test']) {
  test(`failed read ${path} cannot authorize any overwrite`, async () => {
    const normal = handler;
    handler = async (url, method, body) => url === path ? response({ error: 'unavailable' }, 503) : normal(url, method, body);
    assert.deepEqual(await persistCollectorGathering(input()), { kind: 'rejected', stage: 'read', error: 'unavailable' });
    assert.ok(calls.every(call => call.method === 'GET'));
  });
}

test('birth HTTP rejection and accepted-but-pending outcome both prevent dependent privacy writes', async () => {
  const normal = handler;
  for (const status of [400, 202]) {
    calls = [];
    handler = async (path, method, body) => method === 'POST'
      ? response({ error: 'invalid_inputs' }, status) : normal(path, method, body);
    const outcome = await persistCollectorGathering(input());
    assert.equal(outcome.kind, status === 400 ? 'rejected' : 'pending');
    assert.equal('stage' in outcome ? outcome.stage : null, 'birth');
    assert.equal(calls.some(call => call.method === 'PUT'), false);
  }
});

test('network failure differs from refusal and never starts a dependent write', async () => {
  const normal = handler;
  handler = async (path, method, body) => { if (method === 'POST') throw new TypeError('offline'); return normal(path, method, body); };
  assert.deepEqual(await persistCollectorGathering(input()), { kind: 'network', stage: 'birth' });
  assert.equal(calls.some(call => call.method === 'PUT'), false);
});

test('an account change during birth completion cannot issue another account privacy write', async () => {
  const normal = handler;
  let current = true;
  handler = async (path, method, body) => { const result = await normal(path, method, body); if (method === 'POST') current = false; return result; };
  assert.deepEqual(await persistCollectorGathering({ ...input(), isCurrent: () => current }), { kind: 'cancelled' });
  assert.equal(calls.some(call => call.method === 'PUT'), false);
});

for (const status of ['missing', 'skipped']) {
  test(`optional birth ${status} completes privately without opening requested public choices`, async () => {
    profile = { status };
    assert.deepEqual(await persistCollectorGathering({ ...input(), birth: null,
      privacy: { person, piece: { keeperPieceId: 'kp-test', shareCity: true, cityId: 'denpasar' } },
    }), { kind: 'saved', sharingPending: true });
    assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'PUT']);
    assert.deepEqual(calls.at(-1)?.body, {
      person: { shareIntention: false, shareName: false, shareFace: false,
        shareDerivedChart: false, shareBusiness: false, shareMission: false },
      piece: { keeperPieceId: 'kp-test', shareCity: false, cityId: null },
    });
  });
}

test('private completion still requires an accepted save and permits an explicit retry', async () => {
  const normal = handler;
  handler = async (path, method, body) => method === 'PUT'
    ? response({ error: 'unavailable' }, 503) : normal(path, method, body);
  assert.deepEqual(await persistCollectorGathering({ ...input(), birth: null }),
    { kind: 'rejected', stage: 'privacy', error: 'unavailable' });
  handler = normal;
  assert.deepEqual(await persistCollectorGathering({ ...input(), birth: null }), { kind: 'saved', sharingPending: true });
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('empty optional birth never erases an existing profile and closed choices can save without one', async () => {
  profile = { status: 'current', inputs: birth };
  assert.deepEqual(await persistCollectorGathering({ ...input(), birth: null }), { kind: 'saved' });
  assert.equal(calls.some(call => call.method === 'POST'), false);
  profile = { status: 'missing' }; calls = [];
  const closed = Object.fromEntries(Object.keys(person).map(key => [key, false])) as typeof person;
  assert.deepEqual(await persistCollectorGathering({ ...input(), birth: null, privacy: { person: closed } }), { kind: 'saved', sharingPending: true });
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('retry compares birth values independently of JSON property order', async () => {
  profile = { status: 'current', inputs: { place: { tzId: birth.place.tzId, lng: birth.place.lng, lat: birth.place.lat, label: birth.place.label }, time: birth.time, date: birth.date } };
  assert.deepEqual(await persistCollectorGathering(input()), { kind: 'saved' });
  assert.equal(calls.some(call => call.method === 'POST'), false);
});
