import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { LAUNCH_FLAGS } from '../launchFlags.ts';
import { registryAdminEnabled } from '../functions/api/_lib/keeper.js';

describe('artwork registry staged rollout', () => {
  it('allows only an explicit runtime admin gate while the public surface is off', () => {
    const prior = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      assert.equal(registryAdminEnabled({}), false);
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'false' }), false);
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'TRUE' }), false);
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'true' }), true);
    } finally {
      LAUNCH_FLAGS.livingLegacy = prior;
    }
  });

  it('keeps private registry administration available after public launch', () => {
    const prior = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      assert.equal(registryAdminEnabled({}), true);
    } finally {
      LAUNCH_FLAGS.livingLegacy = prior;
    }
  });

  it('keeps the production canary override and migration 015 storage contract compatible', () => {
    const prior = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      assert.equal(
        registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'true' }),
        true,
      );
    } finally {
      LAUNCH_FLAGS.livingLegacy = prior;
    }

    const migration = readFileSync(
      new URL('../migrations/015_registry_artworks.sql', import.meta.url),
      'utf8',
    );
    assert.match(migration, /edition_size INTEGER/);
    assert.doesNotMatch(migration, /edition_kind/);
  });
});
