import type { ReactNode } from 'react';
import type { Artwork } from '../../types';
import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import ArrivalScreen from '../collector/ArrivalScreen';

export default function ArrivalGate({
  artwork,
  identity,
  children,
  headingLevel = 1,
}: {
  artwork: Artwork;
  identity?: PublicPlateIdentity | null;
  children: ReactNode;
  headingLevel?: 1 | 2;
}) {
  return (
    <>
      <ArrivalScreen artwork={artwork} identity={identity} headingLevel={headingLevel} />
      <div data-testid="arrival-record">{children}</div>
    </>
  );
}
