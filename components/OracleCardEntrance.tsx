/**
 * OracleCardEntrance
 *
 * A brief auto-playing transition shown when navigating from the oracle index
 * to an individual card. Draws the hexagram silently then dissolves — no text,
 * no button, no instruction. The ritual is the transition itself.
 *
 * Triggered by: location.state?.ritual === true (set in UniversalLanguageIndex)
 * Dismissed: automatically after AUTO_DISMISS ms, or immediately on tap/click.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { OracleCard } from '../data/oracleData';

/* ─── Trigram → line pattern ─────────────────────────────────────────────── */

const TRIGRAM_LINES: Record<string, [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],
  '☷': [false, false, false],
  '☳': [true,  false, false],
  '☴': [false, true,  true ],
  '☵': [false, true,  false],
  '☲': [true,  false, true ],
  '☶': [false, false, true ],
  '☱': [true,  true,  false],
};

function getLines(upper: string, lower: string): boolean[] {
  const u = TRIGRAM_LINES[upper] ?? [true, true, true];
  const l = TRIGRAM_LINES[lower] ?? [true, true, true];
  return [u[2], u[1], u[0], l[2], l[1], l[0]];
}

function lineY(i: number): number {
  const step = 14;
  const trigramGap = 8;
  return i < 3 ? i * step : i * step + trigramGap;
}

/* ─── Timing ─────────────────────────────────────────────────────────────── */

const LINE_DURATION  = 260;
const LINE_STAGGER   = 110;
const LAST_LINE_END  = 5 * LINE_STAGGER + LINE_DURATION; // ~830ms
const AUTO_DISMISS   = LAST_LINE_END + 500;              // ~1330ms — just enough to see it complete
const EXIT_DURATION  = 600;

/* ─── Component ──────────────────────────────────────────────────────────── */

interface Props {
  card: OracleCard;
  onDone: () => void;
}

export const OracleCardEntrance: React.FC<Props> = ({ card, onDone }) => {
  const [exiting, setExiting] = useState(false);

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDone, EXIT_DURATION);
  };

  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(
    () => getLines(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol),
    [card],
  );

  return (
    <>
      <style>{`
        @keyframes ce-draw-ltr {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0%   0 0); }
        }
        @keyframes ce-draw-rtl {
          from { clip-path: inset(0 0 0 100%); }
          to   { clip-path: inset(0 0 0 0%  ); }
        }
      `}</style>

      <div
        onClick={dismiss}
        style={{
          position:         'fixed',
          inset:            0,
          zIndex:           9999,
          display:          'flex',
          alignItems:       'center',
          justifyContent:   'center',
          background:       '#eae4d8',
          opacity:          exiting ? 0 : 1,
          transition:       `opacity ${EXIT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          cursor:           'pointer',
          userSelect:       'none',
          WebkitUserSelect: 'none',
        }}
        aria-label="Opening. Tap to skip."
        role="dialog"
        aria-modal="true"
      >
        <svg
          width="64"
          height="88"
          viewBox="0 0 80 88"
          aria-hidden="true"
        >
          {lines.map((isYang, i) => {
            const y     = lineY(i);
            const delay = `${i * LINE_STAGGER}ms`;
            const dur   = `${LINE_DURATION}ms`;
            const base  = {
              animationDuration:       dur,
              animationDelay:          delay,
              animationFillMode:       'both' as const,
              animationTimingFunction: 'ease-out',
            };

            if (isYang) {
              return (
                <rect key={i}
                  x="4" y={y} width="72" height="10"
                  fill="#3d3226"
                  style={{ animationName: 'ce-draw-ltr', ...base }}
                />
              );
            }

            return (
              <g key={i}>
                <rect x="4"  y={y} width="32" height="10" fill="#3d3226"
                  style={{ animationName: 'ce-draw-ltr', ...base }} />
                <rect x="44" y={y} width="32" height="10" fill="#3d3226"
                  style={{ animationName: 'ce-draw-rtl', ...base }} />
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
};
