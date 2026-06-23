import React, { useEffect, useState } from 'react';
import { Artwork } from '../../types';
import { LAUNCH_FLAGS } from '../../launchFlags';

/**
 * PieceConstellation — the PIECE-LENS scaffold (Decision A + D).
 *
 * One Atlas, two lenses, one shared source:
 *   - mandalacodes renders the MANDALA / codon lens (the 64 codons as rings on a
 *     globe) over the canonical public atlas state.
 *   - Adrian-Website renders the PIECE lens: a single physical artwork as one
 *     star in that same constellation, with a quiet link out to the full map.
 *
 * This is a deliberate SCAFFOLD, not the globe. It does not rebuild the Atlas.
 * It reads the shared public source through /api/atlas/mirror (which fetches
 * mandalacodes' /api/atlas and projects just this piece) and shows the piece as
 * one star. No lorem ipsum: every word here is the real piece's data. The full
 * constellation lives on the canonical lens and is linked, not duplicated.
 *
 * Gated behind the `livingLegacy` flag — renders nothing when off.
 */

interface MirrorResponse {
  ok: boolean;
  onMap: boolean;
  star: Record<string, unknown> | null;
  constellationUrl: string;
}

export const PieceConstellation: React.FC<{ artwork: Artwork; editionNumber?: number }> = ({
  artwork,
  editionNumber = 0,
}) => {
  const [mirror, setMirror] = useState<MirrorResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!LAUNCH_FLAGS.livingLegacy) return;
    let active = true;
    const params = new URLSearchParams({
      pieceId: artwork.id,
      editionNumber: String(editionNumber),
    });
    fetch(`/api/atlas/mirror?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) {
          setMirror(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [artwork.id, editionNumber]);

  if (!LAUNCH_FLAGS.livingLegacy) return null;

  const constellationUrl = mirror?.constellationUrl || 'https://mandalacodes.com/atlas';
  const onMap = Boolean(mirror?.onMap);

  return (
    <section className="max-w-xl mx-auto mb-16 text-center">
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="h-px w-12 bg-bronze-300" />
        <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold">
          The Constellation
        </p>
        <div className="h-px w-12 bg-bronze-300" />
      </div>

      {/* The single star — a quiet point of light, the piece itself. */}
      <div className="flex justify-center mb-8" aria-hidden="true">
        <span
          className={`block w-2 h-2 rounded-full bg-bronze-500 ${
            onMap ? 'animate-pulse-slow' : ''
          }`}
        />
      </div>

      <p className="font-serif text-[17px] md:text-lg text-wood-700 leading-[1.9] mb-3">
        {artwork.title} is one light among many.
      </p>

      <p className="font-sans text-[14px] text-wood-500 leading-[1.8] mb-8">
        {loaded
          ? onMap
            ? 'It already shines on the shared constellation, beside every other piece that has woken up.'
            : 'When its keeper sets it on the map, it will join the constellation beside every other piece.'
          : 'Finding this piece on the shared constellation.'}
      </p>

      <a
        href={constellationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-label text-[11px] uppercase tracking-[0.15em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold border-b border-bronze-300 pb-1"
      >
        See the whole constellation
      </a>
    </section>
  );
};

export default PieceConstellation;
