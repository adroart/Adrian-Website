import React, { useEffect, useState } from 'react';

import { LAUNCH_FLAGS } from '../../launchFlags';
import type { Artwork } from '../../types';
import { fetchCollectorField, type CollectorFieldIdentity } from '../../utils/collectorField';

type PieceFieldState =
  | { status: 'loading'; identity: null }
  | { status: 'ready'; identity: CollectorFieldIdentity }
  | { status: 'unavailable'; identity: null };

function fieldCopy(identity: CollectorFieldIdentity | null, title: string) {
  if (!identity) return `Finding ${title} in the collector field.`;
  if (identity.status === 'registered' && identity.city) {
    return `It rests in the field at ${identity.city.label}, with the same light as every registered work.`;
  }
  if (identity.status === 'private') {
    return 'It is lit in the field. Its place remains private or unrecorded.';
  }
  return 'Its catalog record is present, waiting for its permanent registration.';
}

export const PieceConstellation: React.FC<{
  artwork: Artwork;
  publicCode: string;
}> = ({ artwork, publicCode }) => {
  const [state, setState] = useState<PieceFieldState>({ status: 'loading', identity: null });

  useEffect(() => {
    if (!LAUNCH_FLAGS.livingLegacy) return;
    let current = true;
    setState({ status: 'loading', identity: null });
    void fetchCollectorField()
      .then((field) => {
        if (!current) return;
        const entry = field.lights.find((candidate) => candidate.artworkId === artwork.id);
        const identity = entry?.identity.find((candidate) => candidate.publicCode === publicCode);
        setState(identity
          ? { status: 'ready', identity }
          : { status: 'unavailable', identity: null });
      })
      .catch(() => {
        if (current) setState({ status: 'unavailable', identity: null });
      });
    return () => { current = false; };
  }, [artwork.id, publicCode]);

  if (!LAUNCH_FLAGS.livingLegacy) return null;

  return (
    <section className="mx-auto mb-16 max-w-xl text-center" aria-labelledby="piece-field-title">
      <div className="mb-8 flex items-center justify-center gap-4" aria-hidden="true">
        <div className="h-px w-12 bg-bronze-300" />
        <div className="h-2 w-2 rounded-full bg-bronze-500" />
        <div className="h-px w-12 bg-bronze-300" />
      </div>
      <p className="font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-bronze-600">
        The collector field
      </p>
      <h3 id="piece-field-title" className="mt-3 font-serif text-2xl text-wood-900">
        {artwork.title} is one light among the whole body of work.
      </h3>
      <p className="mb-8 mt-4 font-sans text-base leading-[1.8] text-wood-600" role="status">
        {state.status === 'unavailable'
          ? 'The field could not be reached right now. This artwork record remains available here.'
          : fieldCopy(state.identity, artwork.title)}
      </p>
      <a
        href="/atlas"
        className="inline-flex min-h-11 items-center border-b border-bronze-300 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-bronze-700 transition-colors hover:text-bronze-900"
      >
        Browse the whole field
      </a>
    </section>
  );
};

export default PieceConstellation;
