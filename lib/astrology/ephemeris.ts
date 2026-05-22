import * as AstronomyNS from 'astronomy-engine';
import type { PlanetKey } from './types';

// `astronomy-engine` ships both ESM and CJS builds. In a Vite/browser bundle
// the named exports are direct; in Node-via-tsx (the verification script)
// the CJS module is wrapped under `.default`. Normalise either shape into
// a single namespace object.
const Astronomy: typeof AstronomyNS =
  (AstronomyNS as unknown as { default?: typeof AstronomyNS }).default ?? AstronomyNS;
const { Body, GeoVector, Ecliptic, MakeTime } = Astronomy;

export type EclipticLongitudes = Record<PlanetKey, number>;

const BODIES: Array<{ key: Exclude<PlanetKey, 'earth'>; body: AstronomyNS.Body }> = [
  { key: 'sun',     body: Body.Sun },
  { key: 'moon',    body: Body.Moon },
  { key: 'mercury', body: Body.Mercury },
  { key: 'venus',   body: Body.Venus },
  { key: 'mars',    body: Body.Mars },
  { key: 'jupiter', body: Body.Jupiter },
];

/**
 * Geocentric apparent ecliptic longitudes (tropical, degrees in [0, 360))
 * for the moment `utc`. Earth is computed as Sun + 180 (mod 360), which is
 * the convention used in the Human Design / Gene Keys wheel.
 */
export function eclipticLongitudes(utc: Date): EclipticLongitudes {
  const time = MakeTime(utc);
  const out: Partial<EclipticLongitudes> = {};
  for (const { key, body } of BODIES) {
    const vec = GeoVector(body, time, /* aberration */ true);
    const ecl = Ecliptic(vec);
    out[key] = ((ecl.elon % 360) + 360) % 360;
  }
  out.earth = ((out.sun! + 180) % 360 + 360) % 360;
  return out as EclipticLongitudes;
}

/**
 * Sun longitude only, used by the design-time binary search.
 */
export function sunLongitude(utc: Date): number {
  const time = MakeTime(utc);
  const vec = GeoVector(Body.Sun, time, true);
  const ecl = Ecliptic(vec);
  return ((ecl.elon % 360) + 360) % 360;
}
