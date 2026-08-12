import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildHologeneticProfile } from '../lib/astrology/profile.ts';
import { placeToUtc } from '../lib/astrology/places.ts';

describe('verified Hologenetic Profile adapter', () => {
  it('matches every position in the official Santa Cruz chart fixture', () => {
    const utcBirth = placeToUtc('1982-01-15', '23:39', 'America/Los_Angeles');
    assert.equal(utcBirth.toISOString(), '1982-01-16T07:39:00.000Z');

    assert.deepEqual(buildHologeneticProfile({ utcBirth }), {
      lifesWork: { gate: 61, line: 6 },
      evolution: { gate: 62, line: 6 },
      radiance: { gate: 50, line: 2 },
      purpose: { gate: 3, line: 2 },
      attraction: { gate: 33, line: 6 },
      iq: { gate: 41, line: 3 },
      eq: { gate: 48, line: 4 },
      sq: { gate: 5, line: 3 },
      core: { gate: 59, line: 1 },
      culture: { gate: 32, line: 2 },
      pearl: { gate: 44, line: 1 },
    });
  });

  it('converts local times across daylight-saving and date boundaries', () => {
    assert.equal(
      placeToUtc('2024-03-10', '01:30', 'America/Los_Angeles').toISOString(),
      '2024-03-10T09:30:00.000Z',
    );
    assert.equal(
      placeToUtc('2024-03-10', '03:30', 'America/Los_Angeles').toISOString(),
      '2024-03-10T10:30:00.000Z',
    );
    assert.equal(
      placeToUtc('2024-01-01', '00:15', 'Asia/Tokyo').toISOString(),
      '2023-12-31T15:15:00.000Z',
    );
    assert.throws(
      () => placeToUtc('2024-03-10', '02:30', 'America/Los_Angeles'),
      /nonexistent_local_time/,
    );
    assert.equal(
      placeToUtc('2024-11-03', '01:30', 'America/Los_Angeles').toISOString(),
      '2024-11-03T08:30:00.000Z',
    );
  });
});
