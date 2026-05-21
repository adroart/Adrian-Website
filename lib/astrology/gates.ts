import { sunLongitude } from './ephemeris';
import type { GateLine } from './types';

export const DEG_PER_GATE = 5.625;
export const DEG_PER_LINE = 0.9375;

/**
 * The Human Design / Gene Keys wheel anchor: Gate 41, line 1 begins at
 * 02°00'00" Aquarius. Tropical zodiac counts Aries 0° = 0°, so Aquarius 2°
 * = 300° + 2° = 302°.
 */
export const WHEEL_START_DEG = 302;

/**
 * The 64 gates in their zodiacal order, starting at WHEEL_START_DEG.
 * This is NOT numerical order — it is the canonical HD wheel sequence.
 */
export const GATE_SEQUENCE: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];

/**
 * Map an ecliptic longitude (tropical degrees) to a {gate, line} pair.
 */
export function longitudeToGateLine(lon: number): GateLine {
  const rotated = (((lon - WHEEL_START_DEG) % 360) + 360) % 360;
  const gateIndex = Math.floor(rotated / DEG_PER_GATE);                 // 0..63
  const remainder = rotated - gateIndex * DEG_PER_GATE;
  const line = Math.min(6, Math.floor(remainder / DEG_PER_LINE) + 1);   // 1..6
  return { gate: GATE_SEQUENCE[gateIndex], line };
}

/**
 * Find the UTC moment when the Sun's ecliptic longitude was exactly the
 * given target degrees, looking backwards from `natalUtc`.
 *
 * The Sun moves ~0.985°/day, so 88° of solar arc takes ~89.3 days. We
 * search a generous ±6 day window around that estimate to guarantee
 * bracketing for any natal position.
 *
 * Binary search to a tolerance of ~0.0001° (≈ 8 seconds of solar motion),
 * well below line resolution (0.9375°).
 */
export function findDesignTime(natalUtc: Date, targetSunDeg: number): Date {
  return findSunCrossing(targetSunDeg, new Date(natalUtc.getTime() - 95 * 86_400_000), new Date(natalUtc.getTime() - 83 * 86_400_000));
}

/**
 * Find the UTC moment when the Sun crosses a given longitude, given a
 * search window `[loTime, hiTime]` that brackets the crossing. Throws
 * (returns the midpoint as a best-effort fallback) if the bracket is wrong.
 */
export function findSunCrossing(targetSunDeg: number, loTime: Date, hiTime: Date): Date {
  const unwrap = (deg: number, ref: number) => {
    let d = deg;
    while (d < ref - 180) d += 360;
    while (d > ref + 180) d -= 360;
    return d;
  };

  let lo = loTime.getTime();
  let hi = hiTime.getTime();
  const loDeg = sunLongitude(new Date(lo));
  const target = unwrap(targetSunDeg, loDeg);

  // 50 iterations is overkill but cheap.
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const midDeg = unwrap(sunLongitude(new Date(mid)), loDeg);
    if (Math.abs(midDeg - target) < 0.0001) return new Date(mid);
    if (midDeg < target) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
}
