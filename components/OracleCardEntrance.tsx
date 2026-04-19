/**
 * OracleCardEntrance
 *
 * Everything plays immediately on mount — ring blooms out, card name rises,
 * hexagram draws line by line, keywords cascade in. Tap at any point to
 * exit early. Card image preloads in the background while the animation plays.
 *
 * Triggered by: location.state?.ritual === true
 */

import React, { useEffect, useState, useMemo } from 'react';
import { ALL_CARDS, type OracleCard } from '../data/oracleData';
import { getSynthesis } from '../data/synthesisData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';

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

/* ─── Ring geometry ──────────────────────────────────────────────────────── */

const CX = 400; const CY = 400; const R = 315;
const LINE_H = 3; const LINE_GAP = 1.5;
const HEX_W = 22; const BROKEN_GAP = 5;
const HALF_W = (HEX_W - BROKEN_GAP) / 2;
const HEX_H = 5 * (LINE_H + LINE_GAP) + LINE_H;

/* ─── Image preload ──────────────────────────────────────────────────────── */

function getCardImageUrl(number: number): string | null {
  const piece = FULL_ARCHIVE.find(a => {
    if (a.series !== 'Universal Language') return false;
    return parseInt(a.coverImage.split('_')[0], 10) === number;
  });
  if (!piece) return null;
  return img(piece.coverImage, { w: 900, h: 900, crop: 'fill', gravity: 'center', format: 'webp' });
}

/* ─── Timing (from mount) ────────────────────────────────────────────────── */

const RING_DUR    = 1400; // ring blooms out
const NAME_DELAY  = 300;  // card name rises
const LINE_DELAY  = 550;  // hexagram starts drawing
const LINE_STAGGER = 110;
const LINE_DUR    = 260;
const LAST_LINE   = LINE_DELAY + 5 * LINE_STAGGER + LINE_DUR;   // ~1360ms
const KEYS_DELAY  = LAST_LINE + 200;                             // ~1560ms
const KEY_STAGGER = 90;
const EXIT_DUR    = 800;

/* ─── Component ──────────────────────────────────────────────────────────── */

interface Props {
  card: OracleCard;
  onDone: () => void;
}

export const OracleCardEntrance: React.FC<Props> = ({ card, onDone }) => {
  const [exiting, setExiting] = useState(false);

  const keywords = useMemo(() => getSynthesis(card.number)?.keywords ?? [], [card.number]);

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDone, EXIT_DUR);
  };

  // Preload card image while animation plays
  useEffect(() => {
    const url = getCardImageUrl(card.number);
    if (url) { new Image().src = url; }
  }, [card.number]);

  const centerLines = useMemo(
    () => getLines(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol),
    [card],
  );

  const ringHexagrams = useMemo(() =>
    ALL_CARDS.map((c, i) => {
      const angle       = (i / 64) * 2 * Math.PI - Math.PI / 2;
      const x           = CX + Math.cos(angle) * R;
      const y           = CY + Math.sin(angle) * R;
      const rotationDeg = (i / 64) * 360 + 180;
      const uLines = TRIGRAM_LINES[c.iching.upper_trigram.symbol] ?? [true, true, true];
      const lLines = TRIGRAM_LINES[c.iching.lower_trigram.symbol] ?? [false, false, false];
      return {
        number:    c.number,
        x, y, rotationDeg,
        lines:     [...uLines, ...lLines] as readonly boolean[],
        isCurrent: c.number === card.number,
      };
    }),
  [card.number]);

  return (
    <>
      <style>{`
        @keyframes ce-ring-bloom {
          0%   { transform: scale(0.04); opacity: 0; }
          16%  { opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ce-ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ce-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ce-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ce-draw-ltr {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0% 0 0); }
        }
        @keyframes ce-draw-rtl {
          from { clip-path: inset(0 0 0 100%); }
          to   { clip-path: inset(0 0 0 0%); }
        }
        @keyframes ce-pulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.85; }
        }
        @keyframes ce-ring-exit {
          from { transform: scale(1);   opacity: 1; }
          to   { transform: scale(3.8); opacity: 0; }
        }
        @keyframes ce-name-exit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-22px); }
        }
        @keyframes ce-hex-exit {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(1.6); }
        }
        @keyframes ce-keys-exit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(16px); }
        }
        @keyframes ce-hint-exit {
          from { opacity: 0.3; }
          to   { opacity: 0;   }
        }
        @keyframes ce-bg-exit {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>

      <div
        onClick={dismiss}
        style={{
          position:         'fixed',
          inset:            0,
          zIndex:           9999,
          display:          'flex',
          flexDirection:    'column',
          alignItems:       'center',
          justifyContent:   'center',
          background:       '#eae4d8',
          cursor:           'pointer',
          userSelect:       'none',
          WebkitUserSelect: 'none',
          overflow:         'hidden',
          ...(exiting && {
            animationName:           'ce-bg-exit',
            animationDuration:       `${EXIT_DUR}ms`,
            animationDelay:          '320ms',
            animationFillMode:       'both',
            animationTimingFunction: 'ease-in',
          }),
        }}
        aria-label="Tap to skip."
        role="dialog"
        aria-modal="true"
      >

        {/* ── Ring of 64 blooms outward ──────────────────────────────────── */}
        <svg
          viewBox="0 0 800 800"
          aria-hidden="true"
          style={{
            position:  'absolute',
            width:     'min(90vmin, 580px)',
            height:    'min(90vmin, 580px)',
            animation: exiting
              ? `ce-ring-exit 480ms cubic-bezier(0.4, 0, 1, 1) both`
              : `ce-ring-bloom ${RING_DUR}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        >
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(100,80,55,0.1)" strokeWidth="1" />
          <g style={{
            transformOrigin: `${CX}px ${CY}px`,
            animation: 'ce-ring-spin 96s linear infinite',
          }}>
            {ringHexagrams.map(({ number, x, y, rotationDeg, lines, isCurrent }) => (
              <g
                key={number}
                transform={`translate(${x},${y}) rotate(${rotationDeg}) translate(${-HEX_W / 2},${-HEX_H / 2})`}
              >
                {lines.map((solid, li) => {
                  const ly   = li * (LINE_H + LINE_GAP);
                  const fill = isCurrent ? '#c9a05a' : '#9b8467';
                  const op   = isCurrent ? 1 : 0.4;
                  return solid ? (
                    <rect key={li} x={0} y={ly} width={HEX_W} height={LINE_H} fill={fill} opacity={op} />
                  ) : (
                    <g key={li}>
                      <rect x={0}                   y={ly} width={HALF_W} height={LINE_H} fill={fill} opacity={op} />
                      <rect x={HALF_W + BROKEN_GAP} y={ly} width={HALF_W} height={LINE_H} fill={fill} opacity={op} />
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>

        {/* ── Center content ─────────────────────────────────────────────── */}
        <div style={{
          position:      'relative',
          zIndex:        1,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '22px',
          textAlign:     'center',
          padding:       '0 32px',
        }}>

          {/* Card name */}
          <p style={{
            fontFamily:    "'Cormorant Garamond', Garamond, Georgia, serif",
            fontSize:      '26px',
            fontStyle:     'italic',
            color:         '#2c2416',
            letterSpacing: '0.02em',
            lineHeight:    1,
            margin:        0,
            animation:     exiting
              ? `ce-name-exit 300ms ease-in both`
              : `ce-rise 900ms cubic-bezier(0.16, 1, 0.3, 1) ${NAME_DELAY}ms both`,
          }}>
            {card.card_name}
          </p>

          {/* Hexagram — lines draw one by one */}
          <svg width="64" height="80" viewBox="0 0 80 80" aria-hidden="true"
            style={exiting ? {
              animationName:           'ce-hex-exit',
              animationDuration:       '380ms',
              animationDelay:          '60ms',
              animationFillMode:       'both',
              animationTimingFunction: 'ease-in',
            } : undefined}
          >
            {centerLines.map((isYang, i) => {
              const y    = i * 14;
              const base = {
                animationDuration:       `${LINE_DUR}ms`,
                animationDelay:          `${LINE_DELAY + i * LINE_STAGGER}ms`,
                animationFillMode:       'both' as const,
                animationTimingFunction: 'ease-out',
              };
              return isYang ? (
                <rect key={i} x="4" y={y} width="72" height="10" fill="#3d3226"
                  style={{ animationName: 'ce-draw-ltr', ...base }} />
              ) : (
                <g key={i}>
                  <rect x="4"  y={y} width="32" height="10" fill="#3d3226"
                    style={{ animationName: 'ce-draw-ltr', ...base }} />
                  <rect x="44" y={y} width="32" height="10" fill="#3d3226"
                    style={{ animationName: 'ce-draw-rtl', ...base }} />
                </g>
              );
            })}
          </svg>

          {/* Keywords — all appear together after hexagram finishes */}
          {keywords.length > 0 && (
            <p style={{
              fontFamily:    "'Cormorant Garamond', Garamond, Georgia, serif",
              fontSize:      '16px',
              color:         '#5c4a32',
              lineHeight:    1.9,
              margin:        0,
              maxWidth:      '280px',
              letterSpacing: '0.01em',
              animation:     exiting
                ? `ce-keys-exit 260ms ease-in 120ms both`
                : `ce-rise 700ms cubic-bezier(0.16, 1, 0.3, 1) ${KEYS_DELAY}ms both`,
            }}>
              {keywords.map((kw, i) => (
                <React.Fragment key={kw}>
                  {kw}
                  {i < keywords.length - 1 && (
                    <span style={{ color: 'rgba(139,96,64,0.4)', padding: '0 8px' }}>·</span>
                  )}
                </React.Fragment>
              ))}
            </p>
          )}

          {/* Tap to begin */}
          <p style={{
            fontFamily:    "'Lato', Helvetica, sans-serif",
            fontSize:      '10px',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color:         '#8b7355',
            margin:        0,
            animation:     exiting
              ? `ce-hint-exit 200ms ease-in both`
              : `ce-pulse 2.6s ease-in-out 1.6s infinite`,
          }}>
            tap to begin
          </p>

        </div>
      </div>
    </>
  );
};
