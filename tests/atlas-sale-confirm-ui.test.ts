import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(
  new URL('../components/admin/AtlasPendingSales.tsx', import.meta.url),
  'utf8',
);

describe('atlas sale confirmation UI', () => {
  it('keeps the server confirmation visible after removing and reloading the queue row', () => {
    assert.match(source, /setConfirmations\(\(current\) => \[/);
    assert.match(source, /setPending\(\(current\).*filter/);
    assert.match(source, /No identity was created/);
    assert.match(source, /Complete canonical registration/);
    assert.doesNotMatch(source, /recoveryCode|one-time recovery code/);
  });
});
