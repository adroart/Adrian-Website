import { eclipticLongitudes, sunLongitude } from './ephemeris';
import { findSunCrossing, longitudeToGateLine, WHEEL_START_DEG } from './gates';
import type { GateLine } from './types';

/**
 * The gate/line that today's Sun is currently transiting. By default uses "now"
 * (the user's machine clock interpreted as UTC by the Date constructor;
 * the gate boundary resolution is ~6.5 days so timezone differences are
 * never material).
 */
export function todaysEnergy(now: Date = new Date()): GateLine {
  return longitudeToGateLine(eclipticLongitudes(now).sun);
}

/**
 * The year's keynote — Gate 41 line 1, the Human Design new year. The Sun
 * crosses into Gate 41 (302 tropical) around Jan 21 to 22 each year; the
 * exact moment shifts a few hours year to year. We find that exact moment
 * and return its gate/line (always 41.1 by definition) along with the
 * year of the current solar cycle.
 *
 * For dates before this year's Gate 41 transit, returns the previous
 * year's cycle, since the new cycle hasn't started yet.
 */
export function yearsEnergy(now: Date = new Date()): GateLine & {
  year: number;
  transitAt: Date;
} {
  const findTransit = (yr: number): Date => {
    const winLo = new Date(Date.UTC(yr, 0, 19, 0, 0, 0));
    const winHi = new Date(Date.UTC(yr, 0, 25, 0, 0, 0));
    return findSunCrossing(WHEEL_START_DEG, winLo, winHi);
  };

  const candidateYear = now.getUTCFullYear();
  const candidateTransit = findTransit(candidateYear);
  const cycleYear = now.getTime() >= candidateTransit.getTime()
    ? candidateYear
    : candidateYear - 1;
  const transitAt = cycleYear === candidateYear
    ? candidateTransit
    : findTransit(cycleYear);

  const sun = sunLongitude(transitAt);
  return { ...longitudeToGateLine(sun), year: cycleYear, transitAt };
}
