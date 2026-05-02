/**
 * OracleCardEntrance
 *
 * Everything plays immediately on mount - ring blooms out, card name rises,
 * hexagram draws line by line, keywords cascade in. Tap, press Escape, or
 * press Enter/Space at any point to exit early. Card image preloads in the
 * background; the reveal waits (up to a short budget) for it.
 *
 * Triggered by: location.state?.ritual === true
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ALL_CARDS, type OracleCard } from '../data/oracleData';
import { getSynthesis } from '../data/synthesisData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import { TRIGRAM_LINES, getHexagramLines } from '../data/trigrams';

// viewBox 1100×1100 so R can grow without the 64 hexagrams colliding.
// Arc-length between neighbors at R=460 is ≈ 45 units (2π·R/64), so HEX_W
// up to ~36 still leaves breathing room. The SVG is then sized down on
// screen so the whole ring hugs the centered content.
const CX = 550; const CY = 550; const R = 460;
const LINE_H = 5; const LINE_GAP = 2.5;
const HEX_W = 36; const BROKEN_GAP = 8;
const HALF_W = (HEX_W - BROKEN_GAP) / 2;
const HEX_H = 5 * (LINE_H + LINE_GAP) + LINE_H;

function getCardImagePublicId(number: number): string | null {
  const piece = FULL_ARCHIVE.find(a => {
    if (a.series !== 'Universal Language') return false;
    return parseInt(a.coverImage.split('_')[0], 10) === number;
  });
  return piece ? piece.coverImage : null;
}

function getCardImageUrl(number: number, size = 900): string | null {
  const publicId = getCardImagePublicId(number);
  if (!publicId) return null;
  return img(publicId, { w: size, h: size, crop: 'fill', gravity: 'center', format: 'webp' });
}

const RING_DUR    = 1400;
const NAME_DELAY  = 300;
const LINE_DELAY  = 550;
const LINE_STAGGER = 110;
const LINE_DUR    = 260;
const LAST_LINE   = LINE_DELAY + 5 * LINE_STAGGER + LINE_DUR;
const KEYS_DELAY  = LAST_LINE + 200;
const EXIT_DUR    = 800;

interface Props {
  card: OracleCard;
  onDone: () => void;
}

export const OracleCardEntrance: React.FC<Props> = ({ card, onDone }) => {
  const [exiting, setExiting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const exitedRef = useRef(false);

  const keywords = useMemo(() => getSynthesis(card.number)?.keywords ?? [], [card.number]);

  const dismiss = () => {
    if (exitedRef.current) return;
    exitedRef.current = true;
    setExiting(true);
    setTimeout(onDone, 1120);
  };

  // Preload card imagery while the visitor reads the entrance. Load the hero
  // (900px) first; only once it has fully resolved do we warm the 1200px
  // lightbox variant. We don't preload other cards — the visitor may never
  // navigate to them, and warming speculatively wastes their bandwidth.
  useEffect(() => {
    const hero = new window.Image();
    let lightbox: HTMLImageElement | null = null;
    let cancelled = false;

    const warmLightbox = () => {
      if (cancelled) return;
      const url = getCardImageUrl(card.number, 1200);
      if (!url) return;
      lightbox = new window.Image();
      lightbox.src = url;
    };

    const heroUrl = getCardImageUrl(card.number, 900);
    if (heroUrl) {
      hero.onload  = warmLightbox;
      hero.onerror = warmLightbox;
      hero.src = heroUrl;
    }

    return () => {
      cancelled = true;
      hero.onload = null;
      hero.onerror = null;
      if (lightbox) { lightbox.onload = null; lightbox.onerror = null; }
    };
  }, [card.number]);

  // Focus management - trap focus on the dialog; restore on unmount.
  // Also lock body scroll so the page underneath can't peek through.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, []);

  // Escape / Enter / Space dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const centerLines = useMemo(
    () => getHexagramLines(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol),
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
        number: c.number,
        x, y, rotationDeg,
        lines: [...uLines, ...lLines] as readonly boolean[],
        isCurrent: c.number === card.number,
      };
    }),
  [card.number]);

  return createPortal(
    <>
      <style>{`
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
          to   { opacity: 0; }
        }
        @keyframes ce-bg-exit {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>

      <div
        ref={dialogRef}
        onClick={dismiss}
        tabIndex={-1}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-paper-100)',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          overflow: 'hidden',
          outline: 'none',
          ...(exiting && {
            animationName: 'ce-bg-exit',
            animationDuration: `${EXIT_DUR}ms`,
            animationDelay: '320ms',
            animationFillMode: 'both',
            animationTimingFunction: 'ease-in',
          }),
        }}
        aria-label="Card entrance. Press Escape or tap to skip."
        role="dialog"
        aria-modal="true"
      >
        {/* Ring + content share a square box so everything sits on a common
             coordinate grid. The ring fills the box; the name pins to the
             top arc; the hexagram + keywords center within. */}
        <div style={{
          position: 'relative',
          width: 'min(70vh, 612px)',
          height: 'min(70vh, 612px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <svg
          viewBox="0 0 1100 1100"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            animation: exiting
              ? `ce-ring-exit 480ms cubic-bezier(0.4, 0, 1, 1) both`
              : `oracle-ring-bloom ${RING_DUR}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          }}
        >
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="color-mix(in oklab, var(--color-wood-700) 10%, transparent)"
            strokeWidth="1" />
          <g style={{
            transformOrigin: `${CX}px ${CY}px`,
            animation: 'oracle-ring-spin 96s linear infinite',
          }}>
            {ringHexagrams.map(({ number, x, y, rotationDeg, lines, isCurrent }) => (
              <g key={number}
                transform={`translate(${x},${y}) rotate(${rotationDeg}) translate(${-HEX_W / 2},${-HEX_H / 2})`}>
                {lines.map((solid, li) => {
                  const ly = li * (LINE_H + LINE_GAP);
                  const fill = isCurrent ? 'var(--color-bronze-400)' : 'var(--color-wood-500)';
                  const op = isCurrent ? 1 : 0.4;
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

        {/* Inner cluster - hexagram + keywords centered inside the ring */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '22px',
          textAlign: 'center',
          padding: '0 clamp(16px, 5vw, 32px)',
        }}>

          <svg width="64" height="80" viewBox="0 0 80 80" aria-hidden="true"
            style={exiting ? {
              animationName: 'ce-hex-exit',
              animationDuration: '380ms',
              animationDelay: '60ms',
              animationFillMode: 'both',
              animationTimingFunction: 'ease-in',
            } : undefined}
          >
            {centerLines.map((isYang, i) => {
              const y    = i * 14;
              const base = {
                animationDuration: `${LINE_DUR}ms`,
                animationDelay: `${LINE_DELAY + i * LINE_STAGGER}ms`,
                animationFillMode: 'both' as const,
                animationTimingFunction: 'ease-out',
              };
              const fill = 'var(--color-wood-800)';
              return isYang ? (
                <rect key={i} x="4" y={y} width="72" height="10" fill={fill}
                  style={{ animationName: 'oracle-draw-ltr', ...base }} />
              ) : (
                <g key={i}>
                  <rect x="4"  y={y} width="32" height="10" fill={fill}
                    style={{ animationName: 'oracle-draw-ltr', ...base }} />
                  <rect x="44" y={y} width="32" height="10" fill={fill}
                    style={{ animationName: 'oracle-draw-rtl', ...base }} />
                </g>
              );
            })}
          </svg>

          {keywords.length > 0 && (
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}>
              {keywords.map((kw, i) => (
                <li
                  key={kw}
                  style={{
                    fontFamily: "'Cormorant Garamond', Garamond, Georgia, serif",
                    fontSize: '17px',
                    fontStyle: 'italic',
                    color: 'var(--color-wood-700)',
                    lineHeight: 1.3,
                    letterSpacing: '0.03em',
                    animation: exiting
                      ? `ce-keys-exit 260ms ease-in ${i * 40}ms both`
                      : `oracle-rise 700ms cubic-bezier(0.16, 1, 0.3, 1) ${KEYS_DELAY + i * 140}ms both`,
                  }}
                >
                  {kw}
                </li>
              ))}
            </ul>
          )}

        </div>
        </div>

        {/* Card name pinned to the top of the screen, symmetric with the
             bottom hint so the ring sits in balanced negative space. */}
        <p style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 'max(36px, env(safe-area-inset-top))',
          textAlign: 'center',
          padding: '0 clamp(16px, 5vw, 32px)',
          fontFamily: "'Cormorant Garamond', Garamond, Georgia, serif",
          fontSize: 'clamp(38px, 8.5vw, 64px)',
          fontWeight: 600,
          color: 'var(--color-wood-900)',
          letterSpacing: '-0.005em',
          lineHeight: 1.05,
          margin: 0,
          pointerEvents: 'none',
          animation: exiting
            ? `ce-name-exit 300ms ease-in both`
            : `oracle-rise 900ms cubic-bezier(0.16, 1, 0.3, 1) ${NAME_DELAY}ms both`,
        }}>
          {card.card_name}
        </p>

        {/* Nonchalant hint pinned to the bottom of the screen */}
        <p style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 'max(24px, env(safe-area-inset-bottom))',
          textAlign: 'center',
          fontFamily: "'Lato', Helvetica, sans-serif",
          fontSize: '10px',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'var(--color-wood-500)',
          margin: 0,
          pointerEvents: 'none',
          animation: exiting
            ? `ce-hint-exit 200ms ease-in both`
            : `oracle-pulse 3.2s ease-in-out 2s infinite`,
        }}>
          tap to begin
        </p>
      </div>
    </>,
    document.body,
  );
};
