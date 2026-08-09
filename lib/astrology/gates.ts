import { sunLongitude } from './ephemeris';
import type { GateLine } from './types';

export const DEG_PER_GATE = 5.625;
export const DEG_PER_LINE = 0.9375;
export const WHEEL_START_DEG = 302;

export const GATE_SEQUENCE: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];

export function longitudeToGateLine(lon: number): GateLine {
  const rotated = (((lon - WHEEL_START_DEG) % 360) + 360) % 360;
  const gateIndex = Math.floor(rotated / DEG_PER_GATE);
  const remainder = rotated - gateIndex * DEG_PER_GATE;
  const line = Math.min(6, Math.floor(remainder / DEG_PER_LINE) + 1);
  return { gate: GATE_SEQUENCE[gateIndex], line };
}

export function findDesignTime(natalUtc: Date, targetSunDeg: number): Date {
  return findSunCrossing(
    targetSunDeg,
    new Date(natalUtc.getTime() - 95 * 86_400_000),
    new Date(natalUtc.getTime() - 83 * 86_400_000),
  );
}

export function findSunCrossing(targetSunDeg: number, loTime: Date, hiTime: Date): Date {
  const unwrap = (deg: number, ref: number) => {
    let value = deg;
    while (value < ref - 180) value += 360;
    while (value > ref + 180) value -= 360;
    return value;
  };

  let lo = loTime.getTime();
  let hi = hiTime.getTime();
  const loDeg = sunLongitude(new Date(lo));
  const target = unwrap(targetSunDeg, loDeg);
  for (let index = 0; index < 50; index += 1) {
    const mid = (lo + hi) / 2;
    const midDeg = unwrap(sunLongitude(new Date(mid)), loDeg);
    if (Math.abs(midDeg - target) < 0.0001) return new Date(mid);
    if (midDeg < target) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
}
