import { eclipticLongitudes } from './ephemeris';
import { findDesignTime, longitudeToGateLine } from './gates';
import type { GateLine, HologeneticProfile } from './types';

export interface ProfileInputs {
  /** UTC birth moment derived from local birth date + time + IANA tz id. */
  utcBirth: Date;
}

/**
 * Build the 11-position Hologenetic Profile for a given UTC birth moment.
 *
 * Positions follow the Gene Keys synthesis (Richard Rudd) of Activation,
 * Venus and Pearl Sequences over the Human Design wheel:
 *
 *   Activation
 *     - Life's Work   (Persona Sun)
 *     - Evolution     (Persona Earth = Sun + 180)
 *     - Radiance      (Design Sun, ~88 degrees back along the ecliptic)
 *     - Purpose       (Design Earth)
 *
 *   Venus
 *     - Attraction    (Persona Venus)
 *     - IQ            (Design Mars)
 *     - EQ            (Persona Mars)
 *     - SQ            (Design Venus)
 *
 *   Pearl
 *     - Core          (Persona Jupiter)
 *     - Culture       (Design Jupiter)
 *     - Pearl         (Persona Mercury, the synthesis)
 */
export function buildHologeneticProfile({ utcBirth }: ProfileInputs): HologeneticProfile {
  const natal = eclipticLongitudes(utcBirth);
  const designSunTarget = (((natal.sun - 88) % 360) + 360) % 360;
  const utcDesign = findDesignTime(utcBirth, designSunTarget);
  const design = eclipticLongitudes(utcDesign);

  const toGL = (lon: number): GateLine => longitudeToGateLine(lon);

  return {
    lifesWork:  toGL(natal.sun),
    evolution:  toGL(natal.earth),
    radiance:   toGL(design.sun),
    purpose:    toGL(design.earth),

    attraction: toGL(natal.venus),
    iq:         toGL(design.mars),
    eq:         toGL(natal.mars),
    sq:         toGL(design.venus),

    core:       toGL(natal.jupiter),
    culture:    toGL(design.jupiter),
    pearl:      toGL(natal.mercury),
  };
}
