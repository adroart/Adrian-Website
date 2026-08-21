import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { onRequest as recordsRequest } from '../functions/api/records/[publicCode].js';

const PUBLIC_CODE = 'AR-ABCDEFGH';
const RECORD_HASH = 'e'.repeat(64);

/** A D1 stand-in that returns a fixed row (or null) regardless of the bound
 *  value, since these tests only need to control presence/absence. */
function fakeDb(row: Record<string, unknown> | null) {
  return {
    prepare(_sql: string) {
      return {
        bind() { return this; },
        async first() { return row; },
      };
    },
  };
}

/** An R2 stand-in whose get() fails the test if it is ever called. HEAD
 *  must never read storage, only the D1 index row. */
function untouchableStorage() {
  return {
    get: mock.fn(async () => {
      throw new Error('storage.get must not be called by a HEAD request');
    }),
  };
}

describe('HEAD /api/records/:publicCode', () => {
  it('returns 200 with the record hash as an ETag and an empty body, without touching storage', async () => {
    const storage = untouchableStorage();
    const env = {
      DB: fakeDb({ record_hash: RECORD_HASH, r2_key: `records/${PUBLIC_CODE}/${RECORD_HASH}.html` }),
      ARTWORK_REGISTRY_BACKUP: storage,
    };

    const response = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`, { method: 'HEAD' }),
      env,
      params: { publicCode: PUBLIC_CODE },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('ETag'), `"${RECORD_HASH}"`);
    assert.equal(await response.text(), '');
    assert.equal(storage.get.mock.callCount(), 0);
  });

  it('returns 404 with an empty body when no record row exists', async () => {
    const storage = untouchableStorage();
    const env = { DB: fakeDb(null), ARTWORK_REGISTRY_BACKUP: storage };

    const response = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`, { method: 'HEAD' }),
      env,
      params: { publicCode: PUBLIC_CODE },
    });

    assert.equal(response.status, 404);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('ETag'), null);
    assert.equal(storage.get.mock.callCount(), 0);
  });

  it('returns 404 for a malformed public code without ever reaching the database', async () => {
    const storage = untouchableStorage();
    let dbTouched = false;
    const env = {
      DB: { prepare() { dbTouched = true; return fakeDb(null).prepare(''); } },
      ARTWORK_REGISTRY_BACKUP: storage,
    };

    const response = await recordsRequest({
      request: new Request('https://example.com/api/records/AR-lowercase', { method: 'HEAD' }),
      env,
      params: { publicCode: 'AR-lowercase' },
    });

    assert.equal(response.status, 404);
    assert.equal(dbTouched, false);
    assert.equal(storage.get.mock.callCount(), 0);
  });

  it('rejects a POST with 405 naming both GET and HEAD in Allow', async () => {
    const storage = untouchableStorage();
    const env = {
      DB: fakeDb({ record_hash: RECORD_HASH, r2_key: `records/${PUBLIC_CODE}/${RECORD_HASH}.html` }),
      ARTWORK_REGISTRY_BACKUP: storage,
    };

    const response = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`, { method: 'POST' }),
      env,
      params: { publicCode: PUBLIC_CODE },
    });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal(storage.get.mock.callCount(), 0);
  });
});
