/**
 * OracleQREntrance
 *
 * A brief full-screen entrance shown when a visitor arrives via a QR code scan
 * from a physical plaque. The hexagram for that card draws itself line by line
 * before dissolving into the reading page.
 *
 * Triggered by: ?ref=qr in the URL (set by the physical QR codes).
 * Dismissed: automatically after AUTO_DISMISS ms, or immediately on tap/click/Escape.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { OracleCard } from '../data/oracleData';
import { getHexagramLines } from '../data/trigrams';

function lineY(i: number): number {
  const step = 11;
  return i * step;
}

const LINE_DURATION  = 280;
const LINE_STAGGER   = 120;
const LAST_LINE_END  = 5 * LINE_STAGGER + LINE_DURATION;
const TEXT_DELAY     = LAST_LINE_END + 180;
const AUTO_DISMISS   = 3600;
const EXIT_DURATION  = 700;

interface Props {
  card: OracleCard;
  onDone: () => void;
}

export const OracleQREntrance: React.FC<Props> = ({ card, onDone }) => {
  const [exiting, setExiting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDone, EXIT_DURATION);
  };

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

  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const lines = useMemo(
    () => getHexagramLines(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol),
    [card],
  );

  return createPortal(
    <>
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
          background: 'var(--color-paper-50)',
          opacity: exiting ? 0 : 1,
          transition: `opacity ${EXIT_DURATION}ms ease`,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          outline: 'none',
        }}
        aria-label="Entrance animation. Press Escape or tap to skip."
        role="dialog"
        aria-modal="true"
      >
        <svg
          viewBox="0 0 80 65"
          aria-hidden="true"
          style={{
            display: 'block',
            width: 'clamp(96px, 18vw, 140px)',
            height: 'auto',
            marginBottom: '32px',
          }}
        >
          {lines.map((isYang, i) => {
            const y = lineY(i);
            const base = {
              animationDuration: `${LINE_DURATION}ms`,
              animationDelay: `${i * LINE_STAGGER}ms`,
              animationFillMode: 'both' as const,
              animationTimingFunction: 'ease-out',
            };
            const fill = 'var(--color-wood-900)';

            if (isYang) {
              return (
                <rect key={i} x="4" y={y} width="72" height="10" fill={fill}
                  style={{ animationName: 'oracle-draw-ltr', ...base }} />
              );
            }
            return (
              <g key={i}>
                <rect x="4" y={y} width="32" height="10" fill={fill}
                  style={{ animationName: 'oracle-draw-ltr', ...base }} />
                <rect x="44" y={y} width="32" height="10" fill={fill}
                  style={{ animationName: 'oracle-draw-rtl', ...base }} />
              </g>
            );
          })}
        </svg>

        <div
          style={{
            textAlign: 'center',
            padding: '0 clamp(16px, 5vw, 32px)',
            animationName: 'oracle-rise',
            animationDuration: '500ms',
            animationDelay: `${TEXT_DELAY}ms`,
            animationFillMode: 'both',
          }}
        >
          <p style={{
            fontFamily: "'Cormorant Garamond', Garamond, Georgia, serif",
            fontSize: 'clamp(22px, 4.5vw, 28px)',
            fontStyle: 'italic',
            color: 'var(--color-wood-900)',
            lineHeight: 1.2,
            marginBottom: '8px',
          }}>
            {card.card_name}
          </p>
          <p style={{
            fontFamily: 'Cinzel, Palatino, serif',
            fontSize: '11px',
            letterSpacing: '0.22em',
            color: 'var(--color-bronze-600)',
          }}>
            {card.iching.hexagram_name.toUpperCase()}
          </p>
        </div>

        <p style={{
          position: 'absolute',
          bottom: '36px',
          fontFamily: 'Lato, Helvetica, sans-serif',
          fontSize: '11px',
          letterSpacing: '0.14em',
          color: 'var(--color-wood-600)',
          animationName: 'oracle-pulse',
          animationDuration: '2.6s',
          animationDelay: `${TEXT_DELAY + 500}ms`,
          animationFillMode: 'both',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        }}>
          tap to continue
        </p>
      </div>
    </>,
    document.body,
  );
};
