import assert from 'node:assert/strict';
import { after, before, it, mock } from 'node:test';
import { LAUNCH_FLAGS } from '../launchFlags.ts';
import { livingFixture, code, now, keeper, author } from './shared/living-record-fixture';
import { writeLivingRecord } from '../functions/api/_lib/collectorLivingRecord.js';

let userId = keeper;
const originalFlag = LAUNCH_FLAGS.livingLegacy;
let endpoint: (context: any) => Promise<Response>;
before(async () => {
  mock.module('../functions/api/_lib/auth.js', { namedExports: {
    requireUser: async () => ({ userId }),
    isSameOrigin: (request: Request) => request.headers.get('Origin') === new URL(request.url).origin,
  } });
  LAUNCH_FLAGS.livingLegacy = true;
  endpoint = (await import('../functions/api/collector/record.js')).onRequest;
});
after(() => { LAUNCH_FLAGS.livingLegacy = originalFlag; mock.reset(); });

function bucket() {
  const objects = new Map<string, Uint8Array>();
  let fail = false;
  return {
    objects,
    breakStorage(value: boolean) { fail = value; },
    async put(key: string, bytes: Uint8Array) {
      if (fail) throw new Error('R2 unavailable');
      if (!objects.has(key)) objects.set(key, new Uint8Array(bytes));
    },
    async get(key: string) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return { text: async () => new TextDecoder().decode(bytes), arrayBuffer: async () => bytes.buffer };
    },
  };
}
async function post(env: unknown, input: Record<string, unknown>, actor = keeper) {
  userId = actor;
  const response = await endpoint({ env, request: new Request(`https://example.test/api/collector/record?publicCode=${code}`, {
    method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }) });
  return { response, body: await response.json() };
}

it('commits publication despite R2 failure, retries export, and avoids duplicate exports on replay', async t => {
  const { env: fixture, DB, sqlite, grant } = await livingFixture();
  t.after(() => sqlite.close());
  const storage = bucket();
  const env = { ...fixture, ARTWORK_REGISTRY_BACKUP: storage };
  await grant(author);
  const id = crypto.randomUUID();
  await writeLivingRecord(DB, code, author, { action: 'reflect', id, body: 'Enduring published words.' }, now);
  await writeLivingRecord(DB, code, author, { action: 'offer', id }, now);
  storage.breakStorage(true);
  const failed = await post(env, { action: 'publish', id });
  assert.equal(failed.response.status, 200);
  assert.equal(failed.body.ok, true);
  assert.deepEqual(failed.body.recordRefresh, { publicCode: code, status: 'failed', error: 'record_storage_failed' });
  assert.ok(sqlite.prepare('SELECT published_at FROM collector_reflections WHERE id = ?').get(id)?.published_at);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM piece_records').get()?.n, 0);

  storage.breakStorage(false);
  const retry = await post(env, { action: 'publish', id });
  assert.equal(retry.body.ok, true);
  assert.equal(retry.body.recordRefresh.status, 'generated');
  const recordHash = retry.body.recordRefresh.recordHash;
  const exported = JSON.parse(await (await storage.get(`records/${code}/${recordHash}.json`))!.text());
  assert.equal(exported.trigger, 'contribution');
  assert.equal(exported.schemaVersion, 2);
  assert.equal(exported.livingHistory.reflections[0].words, 'Enduring published words.');
  const replay = await post(env, { action: 'publish', id });
  assert.equal(replay.body.recordRefresh.status, 'unchanged');
  assert.equal(replay.body.recordRefresh.recordHash, recordHash);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM piece_records').get()?.n, 1);
  assert.equal(storage.objects.size, 2);
});

it('refreshes deliberate public place milestones and keeps private actions out of portable exports', async t => {
  const { env: fixture, sqlite, grant } = await livingFixture();
  t.after(() => sqlite.close());
  const storage = bucket();
  const env = { ...fixture, ARTWORK_REGISTRY_BACKUP: storage };
  await grant(author);
  const reflectionId = crypto.randomUUID();
  const privatePlaceId = crypto.randomUUID();
  const privateActions = [
    { action: 'reflect', id: reflectionId, body: 'Private reflection stays private.' },
    { action: 'offer', id: reflectionId },
    { action: 'withdraw', id: reflectionId },
    { action: 'successor-access', kind: 'reflection', id: reflectionId, allow: true },
  ];
  for (const action of privateActions) assert.deepEqual((await post(env, action, author)).body, { ok: true });
  const milestone = { action: 'milestone', placeId: 'atlas-city-1', grain: 'region', year: 2025 };
  assert.deepEqual((await post(env, { ...milestone, id: privatePlaceId, visibility: 'private' })).body, { ok: true });
  assert.deepEqual((await post(env, { action: 'successor-access', kind: 'milestone', id: privatePlaceId, allow: true })).body, { ok: true });
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM piece_records').get()?.n, 0);
  assert.equal(storage.objects.size, 0);

  sqlite.prepare("UPDATE profiles SET birth_date = '1990-01-01' WHERE user_id = 4").run();
  const publicInput = { ...milestone, id: crypto.randomUUID(), visibility: 'public' };
  const result = await post(env, publicInput);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.recordRefresh.status, 'generated');
  const recordHash = result.body.recordRefresh.recordHash;
  const exported = JSON.parse(await (await storage.get(`records/${code}/${recordHash}.json`))!.text());
  assert.deepEqual(exported.livingHistory.milestones, [{ year: 2025, grain: 'region', place: 'Bali', country: 'Indonesia' }]);
  assert.deepEqual(exported.livingHistory.reflections, []);
  assert.equal((await post(env, publicInput)).body.recordRefresh.status, 'unchanged');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM piece_records').get()?.n, 1);
  assert.equal(storage.objects.size, 2);
});
