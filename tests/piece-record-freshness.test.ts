import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequest as recordsRequest } from '../functions/api/records/[publicCode].js';

const PUBLIC_CODE = 'AR-ABCDEFGH';
const INITIAL_HASH = 'a'.repeat(64);
const REBUILT_HASH = 'b'.repeat(64);

function latestRow(rows: Array<Record<string, string>>) {
  let current = 0;
  return {
    rebuild() { current = 1; },
    db: {
      prepare() {
        return {
          bind() { return this; },
          async first() { return rows[current]; },
        };
      },
    },
  };
}

describe('GET /api/records/:publicCode freshness', () => {
  it('revalidates the stable URL and serves a rebuilt privacy projection instead of stale content', async () => {
    const rows = [
      { record_hash: INITIAL_HASH, r2_key: `records/${PUBLIC_CODE}/${INITIAL_HASH}.html` },
      { record_hash: REBUILT_HASH, r2_key: `records/${PUBLIC_CODE}/${REBUILT_HASH}.html` },
    ];
    const latest = latestRow(rows);
    const objects = new Map([
      [rows[0].r2_key, '<article>Visible city: Denpasar</article>'],
      [rows[1].r2_key, '<article>Privacy projection removed</article>'],
    ]);
    const env = {
      DB: latest.db,
      ARTWORK_REGISTRY_BACKUP: {
        async get(key: string) {
          const body = objects.get(key);
          return body == null ? null : { body };
        },
      },
    };

    const initial = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`),
      env,
      params: { publicCode: PUBLIC_CODE },
    });
    assert.equal(initial.status, 200);
    assert.equal(initial.headers.get('ETag'), `"${INITIAL_HASH}"`);
    assert.equal(initial.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
    assert.match(await initial.text(), /Visible city/);

    // A privacy change triggers a rebuild. The stable public-code URL now
    // points at a different, immutable R2 object, so an old validator must
    // produce the new content rather than a 304 for the retired projection.
    latest.rebuild();
    const rebuilt = await recordsRequest({
      request: new Request(`https://example.com/api/records/${PUBLIC_CODE}`, {
        headers: { 'If-None-Match': `"${INITIAL_HASH}"` },
      }),
      env,
      params: { publicCode: PUBLIC_CODE },
    });

    assert.equal(rebuilt.status, 200);
    assert.equal(rebuilt.headers.get('ETag'), `"${REBUILT_HASH}"`);
    assert.equal(rebuilt.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
    assert.doesNotMatch(await rebuilt.text(), /Visible city/);
  });
});
