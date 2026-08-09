import { eclipticLongitudes } from './ephemeris';
import { findDesignTime, longitudeToGateLine } from './gates';
import type { GateLine, HologeneticProfile } from './types';

export interface ProfileInputs {
  utcBirth: Date;
}

/** Ported from the verified Mandala implementation. */
export function buildHologeneticProfile({ utcBirth }: ProfileInputs): HologeneticProfile {
  const natal = eclipticLongitudes(utcBirth);
  const designSunTarget = (((natal.sun - 88) % 360) + 360) % 360;
  const design = eclipticLongitudes(findDesignTime(utcBirth, designSunTarget));
  const toGateLine = (longitude: number): GateLine => longitudeToGateLine(longitude);

  return {
    lifesWork: toGateLine(natal.sun),
    evolution: toGateLine(natal.earth),
    radiance: toGateLine(design.sun),
    purpose: toGateLine(design.earth),
    attraction: toGateLine(design.moon),
    iq: toGateLine(natal.venus),
    eq: toGateLine(natal.mars),
    sq: toGateLine(design.venus),
    core: toGateLine(design.mars),
    culture: toGateLine(design.jupiter),
    pearl: toGateLine(natal.jupiter),
  };
}
