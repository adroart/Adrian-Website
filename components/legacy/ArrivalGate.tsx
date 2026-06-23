import React, { useEffect, useState } from 'react';
import { Artwork } from '../../types';
import { img as cldImg } from '../../utils/cloudinary';

/**
 * ArrivalGate — the "the piece wakes up" moment (spec 1.2).
 *
 * Temple pacing, not an app. When a piece is scanned, it does not snap into a
 * form. It arrives: the image settles in, then where it was made, its wood, its
 * crystals, its year surface one calm line at a time, then the page opens into
 * the full certificate beneath.
 *
 * This is deliberately quiet — staged opacity reveals on the existing
 * fade-in/slide-up tokens, no loud animation, nothing over the artwork. It
 * respects prefers-reduced-motion (everything appears at once) and never blocks:
 * the certificate is always reachable, the arrival just precedes it.
 *
 * Design system only: paper/wood/stone/bronze, Cormorant/Cinzel, middle-dot
 * separators, no em dashes, no icons, no badges.
 */

interface Line {
  label: string;
  value: string;
}

function arrivalLines(artwork: Artwork): Line[] {
  const lines: Line[] = [];
  if (artwork.createdLocation) lines.push({ label: 'Made in', value: artwork.createdLocation });
  if (artwork.material) lines.push({ label: 'Of', value: artwork.material });
  if (artwork.year) lines.push({ label: 'In the year', value: artwork.year });
  return lines;
}

export const ArrivalGate: React.FC<{
  artwork: Artwork;
  children: React.ReactNode;
}> = ({ artwork, children }) => {
  const lines = arrivalLines(artwork);
  // Stages: 0 image, then one per line, then the page opens.
  const [stage, setStage] = useState(0);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) {
      setStage(lines.length + 1);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Temple pacing: ~900ms between each surfacing line.
    const total = lines.length + 1;
    for (let s = 1; s <= total; s++) {
      timers.push(setTimeout(() => setStage(s), 700 + s * 900));
    }
    return () => timers.forEach(clearTimeout);
  }, [lines.length, reduced]);

  const opened = stage > lines.length;
  const imageUrl = artwork.coverImage ? cldImg(artwork.coverImage, { w: 900 }) : null;

  return (
    <>
      {/* The arrival itself — a held, centered moment. */}
      <section
        className={`px-6 transition-all duration-1000 ease-out ${
          opened ? 'pt-20 pb-10' : 'min-h-[80vh] pt-28 pb-12 flex items-center'
        }`}
      >
        <div className="max-w-2xl mx-auto w-full text-center">
          <p className="font-label text-[11px] uppercase tracking-[0.3em] text-wood-400 mb-10 font-semibold animate-fade-in">
            Adrian Rasmussen
          </p>

          {imageUrl && (
            <div className="mb-12 flex justify-center">
              <img
                src={imageUrl}
                alt={artwork.title}
                className="max-w-md w-full shadow-sm animate-fade-in"
                style={{ animationDuration: '1400ms' }}
                loading="eager"
              />
            </div>
          )}

          <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-8 leading-tight animate-fade-in">
            {artwork.title}
          </h1>

          {/* The waking lines, one at a time. */}
          <div className="space-y-3 mb-4 min-h-[1px]">
            {lines.map((line, i) => (
              <p
                key={line.label}
                className="font-serif text-[17px] md:text-lg text-wood-600 leading-[1.7] transition-opacity duration-1000 ease-out"
                style={{ opacity: stage > i ? 1 : 0 }}
              >
                <span className="text-wood-400">{line.label}</span>
                {' · '}
                <span className="text-wood-700">{line.value}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* The page opens beneath the arrival once it has settled. */}
      <div
        className="transition-opacity duration-1000 ease-out"
        style={{ opacity: opened ? 1 : 0, pointerEvents: opened ? 'auto' : 'none' }}
        aria-hidden={!opened}
      >
        {children}
      </div>
    </>
  );
};

export default ArrivalGate;
