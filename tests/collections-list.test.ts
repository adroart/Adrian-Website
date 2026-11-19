import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

mock.module('../functions/api/_lib/auth.js', { namedExports: {
  requireUser: async () => ({ userId: 'collector', email: 'fixture@example.test' }),
  jsonResponse: (body: unknown, init: ResponseInit = {}) => Response.json(body, init),
} });
let synced = true;
mock.module('../functions/api/_lib/db.js', { namedExports: {
  ensureUser: async () => synced ? { id: 1 } : null,
} });
const { onRequest } = await import('../functions/api/collections/list.js');
after(() => mock.reset());
const request = new Request('https://example.test/api/collections/list');

test('collection list reports unavailable database instead of an empty collection list', async () => {
  const response = await onRequest({ request, env: {} });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'db_not_configured' });
});

test('collection list reports an unsynced user instead of an empty collection list', async () => {
  synced = false;
  try {
    const response = await onRequest({ request, env: { DB: {} } });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'user_not_synced' });
  } finally { synced = true; }
});
