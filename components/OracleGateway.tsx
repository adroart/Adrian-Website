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
import { LAUNCH_FLAGS } from '../launchFlags';
import TodayEnergyPanel from './oracle/TodayEnergyPanel';
import YearEnergyPanel from './oracle/YearEnergyPanel';
import ProfileSummary from './oracle/ProfileSummary';
import { useProfile } from '../lib/profile/context';

/* ─── Trigram → line pattern ─────────────────────────────────────────────── */

const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],
  '☷': [false, false, false],
  '☳': [false, false, true ],
  '☵': [false, true,  false],
  '☶': [true,  false, false],
  '☴': [true,  true,  false],
  '☲': [true,  false, true ],
  '☱': [false, true,  true ],
};

/* ─── Ring geometry ──────────────────────────────────────────────────────── */

const CX = 400;
const CY = 400;
const R  = 315;

const LINE_H     = 3;
const LINE_GAP   = 1.5;
const HEX_W      = 22;
const BROKEN_GAP = 5;
const HALF_W     = (HEX_W - BROKEN_GAP) / 2;
const HEX_H      = 5 * (LINE_H + LINE_GAP) + LINE_H;

const OracleGateway: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const hexagrams = useMemo(() =>
    ALL_CARDS.map((card, i) => {
      const angle       = (i / 64) * 2 * Math.PI - Math.PI / 2;
      const x           = CX + Math.cos(angle) * R;
      const y           = CY + Math.sin(angle) * R;
      const rotationDeg = (i / 64) * 360 + 180;
      const uLines = TRIGRAM_LINES[card.iching.upper_trigram.symbol] ?? [true, true, true];
      const lLines = TRIGRAM_LINES[card.iching.lower_trigram.symbol] ?? [false, false, false];
      const lines: readonly boolean[] = [...uLines, ...lLines];
      return { number: card.number, name: card.card_name, x, y, rotationDeg, lines };
    }),
  []);

  const go = (number: number) => {
    navigate(`/oracle/universal-language/${number}`, { state: { ritual: true } });
  };

  return (
    <>
      <style>{`
        .og-link {
          display: block;
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-wood-800);
          text-decoration: none;
          padding: 11px 0;
          width: 200px;
          text-align: center;
          border-bottom: 1px solid color-mix(in oklab, var(--color-wood-600) 25%, transparent);
          transition: color 0.25s, border-color 0.25s, outline-color 0.15s;
          outline: 2px solid transparent;
          outline-offset: 4px;
        }
        .og-link:first-of-type {
          border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 25%, transparent);
        }
        .og-link:hover {
          color: var(--color-bronze-600);
          border-bottom-color: color-mix(in oklab, var(--color-bronze-600) 50%, transparent);
        }
        .og-link:first-of-type:hover {
          border-top-color: color-mix(in oklab, var(--color-bronze-600) 50%, transparent);
        }
        .og-link:focus-visible {
          outline-color: var(--color-bronze-500);
        }
        .og-hex {
          cursor: pointer;
          outline: none;
          transition: transform 0.2s ease;
          transform-box: fill-box;
          transform-origin: center;
        }
        .og-hex:focus-visible rect.og-hex-hit {
          stroke: var(--color-bronze-500);
          stroke-width: 1.5;
          fill: color-mix(in oklab, var(--color-bronze-400) 10%, transparent);
        }
        .og-hex:hover rect.og-hex-hit {
          fill: color-mix(in oklab, var(--color-bronze-400) 8%, transparent);
        }

        .ul-energy-row {
          display: flex;
          gap: 12px;
          margin: 18px 0 24px;
          width: 100%;
          max-width: 440px;
          justify-content: center;
        }
        @media (max-width: 480px) {
          .ul-energy-row { flex-direction: column; gap: 10px; }
        }
        .ul-energy-panel {
          display: grid;
          grid-template-columns: 44px 1fr;
          grid-template-areas: "label label" "thumb body";
          column-gap: 12px;
          row-gap: 4px;
          align-items: center;
          flex: 1 1 0;
          min-width: 0;
          padding: 12px 14px;
          background: color-mix(in oklab, var(--color-paper-100) 80%, transparent);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 18%, transparent);
          border-radius: 4px;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.25s, background 0.25s;
          outline: 2px solid transparent;
          outline-offset: 4px;
        }
        .ul-energy-panel:hover {
          border-color: color-mix(in oklab, var(--color-bronze-600) 45%, transparent);
          background: color-mix(in oklab, var(--color-paper-100) 95%, transparent);
        }
        .ul-energy-panel:focus-visible { outline-color: var(--color-bronze-500); }
        .ul-energy-panel__label {
          grid-area: label;
          font-family: Cinzel, Palatino, serif;
          font-size: 9px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
        }
        .ul-energy-panel__thumb {
          grid-area: thumb;
          width: 44px;
          height: 44px;
          border-radius: 2px;
          object-fit: cover;
          display: block;
        }
        .ul-energy-panel__body { grid-area: body; min-width: 0; }
        .ul-energy-panel__title {
          font-family: 'Cormorant Garamond', Cormorant, Palatino, serif;
          font-size: 16px;
          line-height: 1.2;
          color: var(--color-wood-900);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ul-energy-panel__meta {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--color-wood-600);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-top: 2px;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-paper-50)',
          overflow: 'hidden',
        }}
      >
        {/* Spinning ring of hexagrams */}
        <svg
          viewBox="0 0 800 800"
          style={{
            position: 'absolute',
            width: 'min(220vmin, 1800px)',
            height: 'min(220vmin, 1800px)',
            animation: 'oracle-ring-bloom 2.8s cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
          aria-label="Sixty-four hexagrams. Activate one to enter its reading."
          role="group"
        >
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="color-mix(in oklab, var(--color-wood-600) 12%, transparent)"
            strokeWidth="1" />

          <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: 'oracle-ring-spin 96s linear infinite' }}>
            {hexagrams.map(({ number, name, x, y, rotationDeg, lines }) => (
              <g
                key={number}
                className="og-hex"
                transform={`translate(${x}, ${y}) rotate(${rotationDeg}) translate(${-HEX_W / 2}, ${-HEX_H / 2})`}
                role="link"
                tabIndex={0}
                aria-label={`Hexagram ${number}: ${name}`}
                onClick={() => go(number)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    go(number);
                  }
                }}
              >
                <g aria-hidden="true">
                  {/* Enlarged hit area - 72×72 for comfortable touch target */}
                  <rect className="og-hex-hit"
                    x={-25} y={-23} width={HEX_W + 50} height={HEX_H + 46}
                    fill="transparent" rx="2" />
                  {lines.map((solid, li) => {
                    const ly = li * (LINE_H + LINE_GAP);
                    const fill = 'var(--color-wood-500)';
                    return solid ? (
                      <rect key={li} x={0} y={ly} width={HEX_W} height={LINE_H} fill={fill} opacity="0.6" />
                    ) : (
                      <g key={li}>
                        <rect x={0}                   y={ly} width={HALF_W} height={LINE_H} fill={fill} opacity="0.6" />
                        <rect x={HALF_W + BROKEN_GAP} y={ly} width={HALF_W} height={LINE_H} fill={fill} opacity="0.6" />
                      </g>
                    );
                  })}
                </g>
              </g>
            ))}
          </g>
        </svg>

        {/* Center content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10,
            animation: 'oracle-rise 1.4s ease 0.6s both',
            pointerEvents: 'auto',
          }}
        >
          <p style={{
            fontFamily: 'Cinzel, Palatino, serif',
            fontSize: '11px',
            letterSpacing: '0.32em',
            color: 'var(--color-bronze-600)',
            textTransform: 'uppercase',
            marginBottom: '28px',
          }}>
            Universal Language
          </p>

          {LAUNCH_FLAGS.hologeneticProfile && (
            <div className="ul-energy-row">
              <TodayEnergyPanel />
              <YearEnergyPanel />
            </div>
          )}

          {LAUNCH_FLAGS.hologeneticProfile && (
            profile ? (
              <div style={{ width: '100%', maxWidth: 360, marginBottom: 18, display: 'flex', justifyContent: 'center' }}>
                <ProfileSummary />
              </div>
            ) : (
              <Link to="/oracle/profile" className="og-link" style={{ borderTop: '1px solid color-mix(in oklab, var(--color-wood-600) 25%, transparent)' }}>
                Enter your birth chart
              </Link>
            )
          )}

          <Link to="/oracle/universal-language" className="og-link">Get a Reading</Link>
          <Link to="/creations/multidimensional-art/universal-language" className="og-link">View the Artwork</Link>
          <Link to="/inquire" className="og-link">Contact the Artist</Link>

          <p style={{
            fontFamily: "'Lato', Helvetica, sans-serif",
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-wood-500)',
            marginTop: '32px',
          }}>
            or tap the circle to enter
          </p>
        </div>
      </div>
    </>
  );
};

export default OracleGateway;
