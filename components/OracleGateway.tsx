/**
 * OracleGateway
 *
 * Full-screen entrance for visitors arriving via QR scan from a physical plaque.
 * All 64 hexagrams orbit slowly in a circle. Three center links offer immediate
 * paths: get a reading, purchase the artwork, or contact the artist.
 *
 * Suggested QR target: /oracle
 */

import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ALL_CARDS } from '../data/oracleData';

/* ─── Trigram → line pattern ─────────────────────────────────────────────── */

const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],  // Qian / Heaven
  '☷': [false, false, false],  // Kun  / Earth
  '☳': [false, false, true ],  // Zhen / Thunder
  '☵': [false, true,  false],  // Kan  / Water
  '☶': [true,  false, false],  // Gen  / Mountain
  '☴': [true,  true,  false],  // Xun  / Wind
  '☲': [true,  false, true ],  // Li   / Fire
  '☱': [false, true,  true ],  // Dui  / Lake
};

/* ─── Ring geometry ──────────────────────────────────────────────────────── */

// SVG coordinate space: 800×800, center at (400, 400)
const CX = 400;
const CY = 400;
const R  = 315; // orbit radius

// Each mini-hexagram — wider and near-square
// 6 lines × 3px high, 1.5px gaps → height ≈ 25.5; width 22 → ratio ~0.86
const LINE_H     = 3;
const LINE_GAP   = 1.5;
const HEX_W      = 22;
const BROKEN_GAP = 5;
const HALF_W     = (HEX_W - BROKEN_GAP) / 2; // 8.5
const HEX_H      = 5 * (LINE_H + LINE_GAP) + LINE_H; // 25.5

/* ─── Component ──────────────────────────────────────────────────────────── */

const OracleGateway: React.FC = () => {
  const navigate = useNavigate();

  // Pre-compute each hexagram's position, rotation, and line pattern once.
  // rotationDeg: top of each hexagram points toward circle center.
  // Derivation: rotate by (angleDeg + 270°) where angleDeg = (i/64)*360 - 90
  //             simplifies to (i/64)*360 + 180.
  const hexagrams = useMemo(() =>
    ALL_CARDS.map((card, i) => {
      const angle       = (i / 64) * 2 * Math.PI - Math.PI / 2; // start from 12 o'clock
      const x           = CX + Math.cos(angle) * R;
      const y           = CY + Math.sin(angle) * R;
      const rotationDeg = (i / 64) * 360 + 180; // top faces center
      const uLines = TRIGRAM_LINES[card.iching.upper_trigram.symbol] ?? [true, true, true];
      const lLines = TRIGRAM_LINES[card.iching.lower_trigram.symbol] ?? [false, false, false];
      const lines: readonly boolean[] = [...uLines, ...lLines];
      return { number: card.number, x, y, rotationDeg, lines };
    }),
  []);

  return (
    <>
      <style>{`
        @keyframes og-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes og-center-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes og-ring-in {
          0%   { transform: scale(0.04); opacity: 0; }
          18%  { opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .og-link {
          display: block;
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #3d3226;
          text-decoration: none;
          padding: 11px 0;
          width: 200px;
          text-align: center;
          border-bottom: 1px solid rgba(139, 103, 69, 0.25);
          transition: color 0.25s, border-color 0.25s;
        }
        .og-link:first-of-type {
          border-top: 1px solid rgba(139, 103, 69, 0.25);
        }
        .og-link:hover {
          color: #8b6914;
          border-bottom-color: rgba(139, 105, 20, 0.5);
        }
        .og-link:first-of-type:hover {
          border-top-color: rgba(139, 105, 20, 0.5);
        }
      `}</style>

      <div
        style={{
          position:   'fixed',
          inset:      0,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f0e8',
          overflow:   'hidden',
        }}
      >
        {/* ── Spinning ring of hexagrams ─────────────────────────────────── */}
        <svg
          viewBox="0 0 800 800"
          style={{
            position: 'absolute',
            width:    'min(160vmin, 1200px)',
            height:   'min(160vmin, 1200px)',
            animation: 'og-ring-in 2.8s cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
          aria-label="Ring of 64 hexagrams — tap one to enter"
        >
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(139,103,69,0.12)" strokeWidth="1" />

          <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'og-spin 96s linear infinite' }}>
            {hexagrams.map(({ number, x, y, rotationDeg, lines }) => (
              <g
                key={number}
                transform={`translate(${x}, ${y}) rotate(${rotationDeg}) translate(${-HEX_W / 2}, ${-HEX_H / 2})`}
                onClick={() => navigate(`/oracle/universal-language/${number}`, { state: { ritual: true } })}
                style={{ cursor: 'pointer' }}
              >
                {/* Enlarged invisible hit area */}
                <rect x={-14} y={-14} width={HEX_W + 28} height={HEX_H + 28} fill="transparent" />
                {lines.map((solid, li) => {
                  const ly = li * (LINE_H + LINE_GAP);
                  return solid ? (
                    <rect key={li} x={0} y={ly} width={HEX_W} height={LINE_H} fill="#9b8467" opacity="0.6" />
                  ) : (
                    <g key={li}>
                      <rect x={0}                   y={ly} width={HALF_W} height={LINE_H} fill="#9b8467" opacity="0.6" />
                      <rect x={HALF_W + BROKEN_GAP} y={ly} width={HALF_W} height={LINE_H} fill="#9b8467" opacity="0.6" />
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>

        {/* ── Center content ─────────────────────────────────────────────── */}
        <div
          style={{
            position:       'relative',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            zIndex:         10,
            animation:      'og-center-in 1.4s ease 0.6s both',
            pointerEvents:  'auto',
          }}
        >
          {/* Eyebrow label */}
          <p style={{
            fontFamily:    'Cinzel, Palatino, serif',
            fontSize:      '9px',
            letterSpacing: '0.32em',
            color:         '#8b6914',
            textTransform: 'uppercase',
            marginBottom:  '28px',
          }}>
            Universal Language
          </p>

          {/* Three action links */}
          <Link to="/oracle/universal-language" className="og-link">
            Get a Reading
          </Link>
          <Link to="/shop" className="og-link">
            Purchase the Artwork
          </Link>
          <Link to="/inquire" className="og-link">
            Contact the Artist
          </Link>

          {/* Hint */}
          <p style={{
            fontFamily:    "'Lato', Helvetica, sans-serif",
            fontSize:      '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         '#c4b49a',
            marginTop:     '32px',
          }}>
            or tap the circle to enter
          </p>
        </div>
      </div>
    </>
  );
};

export default OracleGateway;
