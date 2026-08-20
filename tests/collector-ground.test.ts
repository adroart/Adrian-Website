import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  birthdayMonthBoost,
  composeGround,
  groundWarmth,
  heldSinceYears,
  seasonTint,
} from '../utils/collectorGround.ts';

const SOURCE_PATH = fileURLToPath(new URL('../utils/collectorGround.ts', import.meta.url));

describe('collectorGround: never reads the clock', () => {
  it('contains no Date.now() and no bare `new Date()`', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');
    assert.equal(source.includes('Date.now'), false, 'must not call Date.now()');
    assert.equal(/new Date\(\s*\)/.test(source), false, 'must not call bare new Date()');
  });
});

describe('heldSinceYears', () => {
  it('is deterministic for fixed inputs', () => {
    const a = heldSinceYears('2016-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z');
    const b = heldSinceYears('2016-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z');
    assert.equal(a, b);
    assert.ok(Math.abs(a - 10) < 0.01, `expected ~10 years, got ${a}`);
  });

  it('clamps to zero when now is before firstBoundAt', () => {
    assert.equal(heldSinceYears('2026-08-20T00:00:00.000Z', '2016-08-20T00:00:00.000Z'), 0);
  });

  it('is zero when now equals firstBoundAt', () => {
    assert.equal(heldSinceYears('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'), 0);
  });
});

describe('groundWarmth', () => {
  it('is deterministic for a fixed input', () => {
    assert.equal(groundWarmth(7.3), groundWarmth(7.3));
  });

  it('is zero at zero years', () => {
    assert.equal(groundWarmth(0), 0);
  });

  it('treats negative years as zero (defensive clamp)', () => {
    assert.equal(groundWarmth(-5), 0);
  });

  it('reads approximately 0.6 at ten years, per the documented calibration', () => {
    assert.ok(Math.abs(groundWarmth(10) - 0.6) < 0.001, `groundWarmth(10) = ${groundWarmth(10)}`);
  });

  it('is monotonic non-decreasing with no jump larger than numerical smoothness allows', () => {
    const STEP = 0.01; // years
    let previous = groundWarmth(0);
    let maxStep = 0;
    for (let years = STEP; years <= 100; years += STEP) {
      const current = groundWarmth(years);
      assert.ok(current >= previous, `warmth decreased at ${years} years`);
      maxStep = Math.max(maxStep, current - previous);
      previous = current;
    }
    // Steepest slope is at years=0: derivative = 1/k ≈ 0.0917 per year,
    // so a 0.01-year step should move warmth by well under 0.01.
    assert.ok(maxStep < 0.01, `max step was ${maxStep}, expected a smooth continuous curve`);
  });

  it('never reaches or exceeds 1', () => {
    // 1000 years underflows to exactly 1.0 in double precision (the
    // exponential term is far below epsilon); 200 years stays just under.
    assert.ok(groundWarmth(200) < 1);
    assert.ok(groundWarmth(1000) <= 1);
  });
});

describe('seasonTint', () => {
  it('is deterministic for fixed inputs', () => {
    const a = seasonTint('2026-10-15T12:00:00.000Z', 40);
    const b = seasonTint('2026-10-15T12:00:00.000Z', 40);
    assert.deepEqual(a, b);
  });

  it('is fully neutral when latitude is null', () => {
    assert.deepEqual(seasonTint('2026-10-15T12:00:00.000Z', null), {
      hueShiftDeg: 0,
      warmthDelta: 0,
    });
    assert.deepEqual(seasonTint('2026-01-01T00:00:00.000Z', null), {
      hueShiftDeg: 0,
      warmthDelta: 0,
    });
  });

  it('flips hemisphere-for-hemisphere at the diurnal null point (06:00 UTC)', () => {
    // At 06:00 UTC the diurnal component is exactly zero (cos(-pi/2) = 0),
    // isolating the seasonal component so north/south should be exact
    // negations of one another for any given date.
    const dates = [
      '2026-01-15T06:00:00.000Z',
      '2026-04-20T06:00:00.000Z',
      '2026-07-04T06:00:00.000Z',
      '2026-10-31T06:00:00.000Z',
    ];
    for (const now of dates) {
      const north = seasonTint(now, 45);
      const south = seasonTint(now, -45);
      assert.ok(
        Math.abs(north.hueShiftDeg + south.hueShiftDeg) < 1e-9,
        `hueShiftDeg not antisymmetric at ${now}: ${north.hueShiftDeg} vs ${south.hueShiftDeg}`,
      );
      assert.ok(
        Math.abs(north.warmthDelta + south.warmthDelta) < 1e-9,
        `warmthDelta not antisymmetric at ${now}: ${north.warmthDelta} vs ${south.warmthDelta}`,
      );
    }
  });

  it('keeps amplitudes small (a tint, never a takeover)', () => {
    for (let day = 0; day < 365; day += 5) {
      const now = new Date(Date.UTC(2026, 0, 1)).getTime() + day * 24 * 60 * 60 * 1000;
      const iso = new Date(now).toISOString();
      const tint = seasonTint(iso, 40);
      assert.ok(Math.abs(tint.hueShiftDeg) <= 8, `hueShiftDeg too large at ${iso}: ${tint.hueShiftDeg}`);
      assert.ok(Math.abs(tint.warmthDelta) <= 0.06, `warmthDelta too large at ${iso}: ${tint.warmthDelta}`);
    }
  });
});

describe('birthdayMonthBoost', () => {
  it('is deterministic for fixed inputs', () => {
    assert.equal(
      birthdayMonthBoost('2026-03-15T00:00:00.000Z', 2),
      birthdayMonthBoost('2026-03-15T00:00:00.000Z', 2),
    );
  });

  it('is zero when birthMonthIndex is null', () => {
    for (const now of ['2026-01-01T00:00:00.000Z', '2026-06-15T12:00:00.000Z']) {
      assert.equal(birthdayMonthBoost(now, null), 0);
    }
  });

  it('peaks at the center of the birth month and falls to zero well outside it', () => {
    // Birth month = March (index 2). Sweep the month densely and confirm
    // the maximum sits close to 1 and near the calendar mid-point.
    let bestBoost = -Infinity;
    let bestDay = -1;
    for (let day = 1; day <= 31; day++) {
      const iso = new Date(Date.UTC(2026, 2, day, 12)).toISOString();
      const boost = birthdayMonthBoost(iso, 2);
      if (boost > bestBoost) {
        bestBoost = boost;
        bestDay = day;
      }
    }
    assert.ok(bestBoost > 0.999, `expected the in-month peak to reach ~1, got ${bestBoost}`);
    assert.ok(bestDay >= 15 && bestDay <= 21, `expected the peak near mid-March, got day ${bestDay}`);

    const farAway = birthdayMonthBoost('2026-09-16T12:00:00.000Z', 2);
    assert.equal(farAway, 0);
  });

  it('stays within [0, 1]', () => {
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 28; day += 3) {
        const iso = new Date(Date.UTC(2026, month, day, 12)).toISOString();
        const boost = birthdayMonthBoost(iso, 7);
        assert.ok(boost >= 0 && boost <= 1, `boost out of range at ${iso}: ${boost}`);
      }
    }
  });
});

describe('composeGround', () => {
  const base = {
    firstBoundAt: '1990-01-01T00:00:00.000Z', // decades old: base warmth is
    // near-flat across any single year, isolating the seasonal/birthday
    // effects for the "annual maximum" test below.
    latitude: 40,
    birthMonthIndex: 6, // July
  };

  it('is deterministic for fixed inputs', () => {
    const input = { ...base, now: '2026-05-04T09:30:00.000Z' };
    assert.deepEqual(composeGround(input), composeGround(input));
  });

  it('keeps warmth in [0, 1] and hueShiftDeg in [-8, 8]', () => {
    for (let day = 0; day < 365; day += 7) {
      const iso = new Date(Date.UTC(2026, 0, 1)).toISOString();
      const now = new Date(new Date(iso).getTime() + day * 24 * 60 * 60 * 1000).toISOString();
      const { warmth, hueShiftDeg } = composeGround({ ...base, now });
      assert.ok(warmth >= 0 && warmth <= 1, `warmth out of range at ${now}: ${warmth}`);
      assert.ok(hueShiftDeg >= -8 && hueShiftDeg <= 8, `hueShiftDeg out of range at ${now}: ${hueShiftDeg}`);
    }
  });

  it('is neutral on both latitude and birth month when both are null (on top of a flat base)', () => {
    const result = composeGround({
      firstBoundAt: base.firstBoundAt,
      now: '2026-05-04T09:30:00.000Z',
      latitude: null,
      birthMonthIndex: null,
    });
    const expectedBase = groundWarmth(heldSinceYears(base.firstBoundAt, '2026-05-04T09:30:00.000Z'));
    assert.equal(result.warmth, expectedBase);
    assert.equal(result.hueShiftDeg, 0);
  });

  it('makes the birthday month the annual maximum of composed warmth', () => {
    let bestDay = -1;
    let bestWarmth = -Infinity;
    const startMs = Date.UTC(2026, 0, 1, 12, 0, 0); // noon UTC every day: fixed
    // hour so only the date (season + birthday proximity) varies.
    for (let day = 0; day < 365; day++) {
      const now = new Date(startMs + day * 24 * 60 * 60 * 1000).toISOString();
      const { warmth } = composeGround({ ...base, now });
      if (warmth > bestWarmth) {
        bestWarmth = warmth;
        bestDay = day;
      }
    }
    const peakDate = new Date(startMs + bestDay * 24 * 60 * 60 * 1000);
    assert.equal(
      peakDate.getUTCMonth(),
      base.birthMonthIndex,
      `expected the peak to fall in month ${base.birthMonthIndex}, but it fell on ${peakDate.toISOString()}`,
    );
  });

  it('still makes the birthday month the annual maximum even when it lands on the seasonal trough', () => {
    // Seasonal trough is ~6 months from the autumn peak (day 288), i.e.
    // mid-April. Set the birth month to April so the birthday boost has
    // to overcome the worst-case alignment against it.
    let bestDay = -1;
    let bestWarmth = -Infinity;
    const startMs = Date.UTC(2026, 0, 1, 12, 0, 0);
    const input = { ...base, birthMonthIndex: 3 }; // April
    for (let day = 0; day < 365; day++) {
      const now = new Date(startMs + day * 24 * 60 * 60 * 1000).toISOString();
      const { warmth } = composeGround({ ...input, now });
      if (warmth > bestWarmth) {
        bestWarmth = warmth;
        bestDay = day;
      }
    }
    const peakDate = new Date(startMs + bestDay * 24 * 60 * 60 * 1000);
    assert.equal(peakDate.getUTCMonth(), 3, `expected April peak, got ${peakDate.toISOString()}`);
  });
});
