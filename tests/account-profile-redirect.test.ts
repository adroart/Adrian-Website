import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Cloudflare legacy profile redirect reaches the named profile destination', () => {
  const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
  const rule = redirects.split('\n').find(line => line.startsWith('/oracle/profile '));
  assert.deepEqual(rule?.trim().split(/\s+/), ['/oracle/profile', 'https://mandalacodes.com/profile', '301']);
});
