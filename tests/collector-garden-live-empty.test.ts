import assert from 'node:assert/strict';
import test from 'node:test';
import { gardenPlaced } from '../components/collector/garden';
import type { GardenLive } from '../components/collector/live';

const SAMPLE_ONE = 'I saw it in the hallway of a house I was leaving…';

function live(dreams: GardenLive['dreams']): GardenLive {
  return {
    dreams,
    editWindowOpen: false,
    place: async () => 'held',
    publishHistorical: async () => true,
  };
}

test('only the deliberate standalone preview receives sample garden answers', () => {
  assert.equal(gardenPlaced(undefined)[0], SAMPLE_ONE);
  assert.ok(gardenPlaced(undefined, true).every(answer => answer === null));
});

test('live empty, loading, and failed garden states never receive preview answers', () => {
  const states: GardenLive['dreams'][] = [
    { status: 'ready', data: { keeperPieceId: 'kp-1', current: null, history: [], markers: [] } },
    { status: 'loading' },
    { status: 'failed', retry: () => undefined },
  ];
  for (const state of states) {
    const placed = gardenPlaced(live(state));
    assert.ok(placed.every(answer => answer === null));
    assert.ok(!placed.includes(SAMPLE_ONE));
  }
});

test('publication refetch, reload, and account-switch live-empty projections stay empty', () => {
  const beforePublication = live({
    status: 'ready',
    data: {
      keeperPieceId: 'kp-1', current: null,
      history: [{
        id: 'sealed-1', keeperPieceId: 'kp-1', body: 'Private historical words',
        scope: 'self', visibility: 'private', tier: 'seal', version: 1,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        sharedAt: null, revokedAt: null, fulfilledAt: null, archivedAt: '2026-02-01T00:00:00.000Z',
      }],
      markers: [],
    },
  });
  assert.equal(gardenPlaced(beforePublication)[0], null);

  const afterPublication = gardenPlaced(undefined, true);
  const afterReload = gardenPlaced(undefined, true);
  const afterAccountSwitch = gardenPlaced(undefined, true);
  for (const placed of [afterPublication, afterReload, afterAccountSwitch]) {
    assert.ok(placed.every(answer => answer === null));
    assert.ok(!placed.includes(SAMPLE_ONE));
  }
});
