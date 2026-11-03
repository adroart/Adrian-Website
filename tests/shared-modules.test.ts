import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findEditedCopies } from './shared/check-shared-copies.ts';

/* Files under tests/shared/ are copies of modules another project owns
   (shared-modules.lock.json says which). Edit the owner, then run modules-sync. */
describe('shared modules', () => {
  it('every shared copy matches what modules-sync wrote', () => {
    assert.deepEqual(findEditedCopies(fileURLToPath(new URL('../', import.meta.url))), []);
  });
});
