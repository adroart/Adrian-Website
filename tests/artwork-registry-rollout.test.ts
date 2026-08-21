import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { LAUNCH_FLAGS } from '../launchFlags.ts';
import { registryAdminEnabled } from '../functions/api/_lib/keeper.js';

describe('artwork registry staged rollout', () => {
  it('keeps private admin repair available when the hardened registry infrastructure is provisioned', () => {
    const prior = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = false;
    try {
      assert.equal(registryAdminEnabled({}), false);
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'false' }), false);
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'TRUE' }), false);
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'true' }), true);
      // ARTWORK_REGISTRY_ADMIN_ENABLED='false' is the explicit kill switch:
      // it must win even when the hardened registry infrastructure is fully
      // provisioned, which used to make this expression true regardless of
      // the variable and left the switch with no effect at all.
      assert.equal(registryAdminEnabled({
        ARTWORK_REGISTRY_ADMIN_ENABLED: 'false',
        DB: {},
        ARTWORK_REGISTRY_BACKUP: {},
        REGISTRY_STEP_UP_SECRET: 'configured',
      }), false);
      // Unset (no opinion either way) with full infrastructure still falls
      // through to the infrastructure-ready clause, unaffected by the new
      // kill-switch checks above it.
      assert.equal(registryAdminEnabled({
        DB: {},
        ARTWORK_REGISTRY_BACKUP: {},
        REGISTRY_STEP_UP_SECRET: 'configured',
      }), true);
      assert.equal(registryAdminEnabled({
        DB: {},
        ARTWORK_REGISTRY_BACKUP: {},
      }), false);
    } finally {
      LAUNCH_FLAGS.livingLegacy = prior;
    }
  });

  it('keeps private registry administration available after public launch', () => {
    const prior = LAUNCH_FLAGS.livingLegacy;
    LAUNCH_FLAGS.livingLegacy = true;
    try {
      assert.equal(registryAdminEnabled({}), true);
      // The kill switch wins even over the public launch flag: a canary or
      // an incident response must be able to shut private admin repair off
      // without needing to also flip livingLegacy.
      assert.equal(registryAdminEnabled({ ARTWORK_REGISTRY_ADMIN_ENABLED: 'false' }), false);
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
