import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const REGISTRY_RUNTIME_SOURCES = [
  'components/AdminPieces.tsx',
  'components/AdminPlateWizard.tsx',
  'components/AdminDashboard.tsx',
  'functions/api/admin/overview.js',
  'functions/api/keeper/bind.js',
  'utils/plateWizard.ts',
  'vite.config.ts',
] as const;

describe('commerce-neutral artwork registry', () => {
  it('keeps Stripe orders and the retired fulfillment endpoint out of registry runtime sources', () => {
    for (const path of REGISTRY_RUNTIME_SOURCES) {
      const runtimeSource = source(path);
      for (const forbidden of [
        'stripe_order',
        'order_items',
        'piece_fulfillments',
        '/api/admin/piece-fulfillments',
      ]) {
        assert.equal(
          runtimeSource.includes(forbidden),
          false,
          `${path} must not reference ${forbidden}`,
        );
      }
    }
  });

  it('removes the retired fulfillment endpoint implementation', () => {
    assert.equal(
      existsSync(new URL('../functions/api/admin/piece-fulfillments.js', import.meta.url)),
      false,
    );
  });
});
