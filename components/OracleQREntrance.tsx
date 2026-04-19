/**
 * OracleQREntrance
 *
 * A brief full-screen entrance shown when a visitor arrives via a QR code scan
 * from a physical plaque. The hexagram for that card draws itself line by line
 * before dissolving into the reading page.
 *
 * Triggered by: ?ref=qr in the URL (set by the physical QR codes).
 * Dismissed: automatically after AUTO_DISMISS ms, or immediately on tap/click.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { OracleCard } from '../data/oracleData';

/* ─── Trigram → line pattern ─────────────────────────────────────────────── */

const TRIGRAM_LINES: Record<string, [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],   // Qian — Heaven
  '☷': [false, false, false],   // Kun  — Earth
  '☳': [true,  false, false],   // Zhen — Thunder
  '☴': [false, true,  true ],   // Xun  — Wind
  '☵': [false, true,  false],   // Kan  — Water
  '☲': [true,  false, true ],   // Li   — Fire
  '☶': [false, false, true ],   // Ken  — Mountain
  '☱': [true,  true,  false],   // Dui  — Lake
};

// Returns 6 booleans top-to-bottom: true = yang (solid), false = yin (broken)
function getLines(upper: string, lower: string): boolean[] {
  const u = TRIGRAM_LINES[upper] ?? [true, true, true];
  const l = TRIGRAM_LINES[lower] ?? [true, true, true];
  return [u[2], u[1], u[0], l[2], l[1], l[0]];
}

// Top-of-rect y for each line index (within a 65-unit SVG viewBox)
function lineY(i: number): number {
  const step = 11;  // line height 10 + gap 1
  return i * step;
}

/* ─── Timing constants ───────────────────────────────────────────────────── */

const LINE_DURATION  = 280;  // ms each line takes to draw
const LINE_STAGGER   = 120;  // ms between successive lines
const LAST_LINE_END  = 5 * LINE_STAGGER + LINE_DURATION;  // ~880ms
const TEXT_DELAY     = LAST_LINE_END + 180;               // ~1060ms
const AUTO_DISMISS   = 3600;                              // ms before auto-exit begins
const EXIT_DURATION  = 700;                               // ms for fade-out

/* ─── Component ──────────────────────────────────────────────────────────── */

interface Props {
  card: OracleCard;
  onDone: () => void;
}

export const OracleQREntrance: React.FC<Props> = ({ card, onDone }) => {
  const [exiting, setExiting] = useState(false);

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDone, EXIT_DURATION);
  };

  // Auto-dismiss
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
        @keyframes qr-draw-ltr {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0%   0 0); }
        }
        @keyframes qr-draw-rtl {
          from { clip-path: inset(0 0 0 100%); }
          to   { clip-path: inset(0 0 0 0%  ); }
        }
        @keyframes qr-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes qr-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.7; }
        }
      `}</style>

      <div
        onClick={dismiss}
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         9999,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          background:     '#f5f0e8',
          opacity:        exiting ? 0 : 1,
          transition:     `opacity ${EXIT_DURATION}ms ease`,
          cursor:         'pointer',
          userSelect:     'none',
          WebkitUserSelect: 'none',
        }}
        aria-label="Entrance animation. Tap to skip."
        role="dialog"
      >
        {/* ── Hexagram SVG ─────────────────────────────────────────────── */}
        <svg
          width="80"
          height="65"
          viewBox="0 0 80 65"
          aria-hidden="true"
          style={{ display: 'block', marginBottom: '32px' }}
        >
          {lines.map((isYang, i) => {
            const y    = lineY(i);
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
                  fill="#2c2c2c"
                  style={{ animationName: 'qr-draw-ltr', ...base }}
                />
              );
            }

            return (
              <g key={i}>
                <rect
                  x="4" y={y} width="32" height="10"
                  fill="#2c2c2c"
                  style={{ animationName: 'qr-draw-ltr', ...base }}
                />
                <rect
                  x="44" y={y} width="32" height="10"
                  fill="#2c2c2c"
                  style={{ animationName: 'qr-draw-rtl', ...base }}
                />
              </g>
            );
          })}
        </svg>

        {/* ── Card name + number ───────────────────────────────────────── */}
        <div
          style={{
            textAlign:           'center',
            animationName:       'qr-fade-up',
            animationDuration:   '500ms',
            animationDelay:      `${TEXT_DELAY}ms`,
            animationFillMode:   'both',
          }}
        >
          <p style={{
            fontFamily: "'Cormorant Garamond', Garamond, Georgia, serif",
            fontSize:   '26px',
            fontStyle:  'italic',
            color:      '#2c2c2c',
            lineHeight: 1.2,
            marginBottom: '8px',
          }}>
            {card.card_name}
          </p>
          <p style={{
            fontFamily:    'Cinzel, Palatino, serif',
            fontSize:      '11px',
            letterSpacing: '0.22em',
            color:         '#8b6914',
          }}>
            {card.iching.hexagram_name.toUpperCase()}
          </p>
        </div>

        {/* ── "Tap to continue" hint ───────────────────────────────────── */}
        <p style={{
          position:       'absolute',
          bottom:         '36px',
          fontFamily:     'Lato, Helvetica, sans-serif',
          fontSize:       '11px',
          letterSpacing:  '0.14em',
          color:          '#8b7355',
          animationName:  'qr-pulse',
          animationDuration: '2s',
          animationDelay: `${TEXT_DELAY + 500}ms`,
          animationFillMode: 'both',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        }}>
          tap to continue
        </p>
      </div>
    </>
  );
};
