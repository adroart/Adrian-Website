/**
 * One arrival-study station for the guided walkthrough: mounts one of the
 * three vault arrivals (`components/collector/vaultArrival.tsx`) built for
 * Adrian's ruling that the unlock must arrive somewhere and stay (wording
 * record §7, item 2, 2026-08-20). Each variant is a self-contained study
 * that draws its own 390 x 844 espresso frame, plays its arrival on mount,
 * and replays from its own quiet control — so this station, like its
 * sibling CeremonyStation's plate sequence, needs no router, no demo stub,
 * and no framing of its own.
 */

import React from 'react';
import { ArrivalVariantA, ArrivalVariantB, ArrivalVariantC } from '../collector/vaultArrival';

export type ArrivalVariant = 'a' | 'b' | 'c';

const ArrivalStation: React.FC<{ variant: ArrivalVariant }> = ({ variant }) => {
  if (variant === 'a') return <ArrivalVariantA />;
  if (variant === 'b') return <ArrivalVariantB />;
  return <ArrivalVariantC />;
};

export default ArrivalStation;
