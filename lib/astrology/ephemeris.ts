import * as AstronomyNS from 'astronomy-engine';
import type { PlanetKey } from './types';

const Astronomy: typeof AstronomyNS =
  (AstronomyNS as unknown as { default?: typeof AstronomyNS }).default ?? AstronomyNS;
const { Body, GeoVector, Ecliptic, MakeTime } = Astronomy;

export type EclipticLongitudes = Record<PlanetKey, number>;

const BODIES: Array<{ key: Exclude<PlanetKey, 'earth'>; body: AstronomyNS.Body }> = [
  { key: 'sun', body: Body.Sun },
  { key: 'moon', body: Body.Moon },
  { key: 'mercury', body: Body.Mercury },
  { key: 'venus', body: Body.Venus },
  { key: 'mars', body: Body.Mars },
  { key: 'jupiter', body: Body.Jupiter },
];

export function eclipticLongitudes(utc: Date): EclipticLongitudes {
  const time = MakeTime(utc);
  const out: Partial<EclipticLongitudes> = {};
  for (const { key, body } of BODIES) {
    const vec = GeoVector(body, time, true);
    const ecl = Ecliptic(vec);
    out[key] = ((ecl.elon % 360) + 360) % 360;
  }
  out.earth = ((out.sun! + 180) % 360 + 360) % 360;
  return out as EclipticLongitudes;
}

export function sunLongitude(utc: Date): number {
  const time = MakeTime(utc);
  const vec = GeoVector(Body.Sun, time, true);
  const ecl = Ecliptic(vec);
  return ((ecl.elon % 360) + 360) % 360;
}
