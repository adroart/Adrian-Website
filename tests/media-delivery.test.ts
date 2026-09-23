import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/media/[[path]].js';

test('Pages sends cold media requests directly to the media Worker', async () => {
  const response = await onRequest({
    request: new Request('https://preview.adrianrasmussen.com/media/image/18_kznsph?w=600'),
  });

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('Location'),
    'https://adrian-website-media.lightcodes.workers.dev/media/image/18_kznsph?w=600',
  );
});
