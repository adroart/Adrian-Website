import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type SystemKey = 'iching' | 'genekeys' | 'humandesign';

type SystemConfig = {
  label: string;
  description: string;
  attributionLabel: string;
  attributionName: string;
  attributionLine: string;
};

const SYSTEM_CONFIG: Record<SystemKey, SystemConfig> = {
  iching: {
    label: 'I Ching',
    description:
      'The oldest of the three systems. Reads the energetic pattern of this moment through 64 hexagrams, combinations of heaven and earth.',
    attributionLabel: 'Translated by',
    attributionName: 'Richard Wilhelm',
    attributionLine: 'Rendered into English by Cary F. Baynes, 1950.',
  },
  genekeys: {
    label: 'Gene Keys',
    description:
      'A contemplative path. Each of the 64 keys names a Shadow you move through, a Gift that opens, and a Siddhi that lives at the highest expression.',
    attributionLabel: 'Transmitted by',
    attributionName: 'Richard Rudd',
    attributionLine: 'Synthesised from the I Ching, Human Design, and the wisdom traditions.',
  },
  humandesign: {
    label: 'Human Design',
    description:
      'A map of how energy moves through you. The Gate is the quality, the Channel is how it connects, the Circuit is the larger pattern it belongs to.',
    attributionLabel: 'Received by',
    attributionName: 'Ra Uru Hu',
    attributionLine: 'Transmitted in Ibiza in 1987 across eight days and nights.',
  },
};

interface Props {
  open: boolean;
  systemKey: SystemKey;
  glyph: React.ReactNode;
  onClose: () => void;
}

const SystemOverlay: React.FC<Props> = ({ open, systemKey, glyph, onClose }) => {
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'entering' | 'open' | 'dismissing' | 'sinking'>('entering');

  const config = SYSTEM_CONFIG[systemKey];

  useEffect(() => {
    if (!open) return;
    setPhase('entering');
    const t = window.setTimeout(() => setPhase('open'), 1600);
    return () => window.clearTimeout(t);
  }, [open, systemKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const triggerDismiss = useCallback(() => {
    setPhase((p) => (p === 'dismissing' || p === 'sinking' ? p : 'dismissing'));
    window.setTimeout(onClose, 420);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') triggerDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, triggerDismiss]);

  const triggerSink = useCallback(
    (x: number, y: number) => {
      const root = overlayRef.current;
      if (!root) return;
      const targets = root.querySelectorAll<HTMLElement>('.sink-target');
      targets.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        el.style.setProperty('--dx', `${x - cx}px`);
        el.style.setProperty('--dy', `${y - cy}px`);
        el.style.setProperty('--sink-i', String(i));
      });
      setPhase('sinking');
      window.setTimeout(() => {
        navigate(`/oracle/the-systems#${systemKey}`);
      }, 700);
    },
    [navigate, systemKey],
  );

  if (!open) return null;

  const phaseClass =
    phase === 'dismissing' ? 'is-dismissing' : phase === 'sinking' ? 'is-sinking' : '';

  const words = config.description.split(' ');

  return (
    <div
      ref={overlayRef}
      className={`system-overlay fixed inset-0 z-[100] flex flex-col ${phaseClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={`About ${config.label}`}
      onClick={triggerDismiss}
    >
      <div className="system-overlay-scrim absolute inset-0 bg-paper-100/97" aria-hidden="true" />

      <div className="relative flex flex-col h-full w-full max-w-md mx-auto px-6 pt-14 pb-8 sm:pt-20 sm:pb-12">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="system-overlay-glyph sink-target mb-7 sm:mb-8 text-bronze-600">
            {glyph}
          </div>

          <p className="system-overlay-label sink-target font-label text-[11px] uppercase tracking-[0.32em] text-bronze-700 mb-7 sm:mb-9">
            {config.label}
          </p>

          <p className="system-overlay-body font-serif text-[17px] sm:text-[19px] text-stone-900 leading-[1.55] sm:leading-[1.5] max-w-[22rem]">
            {words.map((word, i) => (
              <React.Fragment key={i}>
                <span className="sink-target inline-block">{word}</span>
                {i < words.length - 1 ? ' ' : ''}
              </React.Fragment>
            ))}
          </p>
        </div>

        <button
          type="button"
          className="system-overlay-attribution group relative w-full text-center pt-7 sm:pt-8 pb-1 border-t border-bronze-500/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-600/50 focus-visible:ring-offset-0"
          onClick={(e) => {
            e.stopPropagation();
            triggerSink(e.clientX, e.clientY);
          }}
          aria-label={`Read the deeper story of ${config.label}`}
        >
          <p className="sink-target font-label text-[10px] uppercase tracking-[0.28em] text-bronze-700/80 mb-3">
            {config.attributionLabel}
          </p>
          <p className="sink-target font-serif text-[18px] text-stone-900 leading-[1.45]">
            {config.attributionName}
          </p>
          <p className="sink-target font-serif text-[14px] text-stone-600 leading-[1.5] mt-1.5 max-w-[22rem] mx-auto">
            {config.attributionLine}
          </p>
          <p className="sink-target font-label text-[10px] uppercase tracking-[0.28em] text-bronze-700 group-hover:text-bronze-600 mt-5 transition-colors">
            The deeper story <span aria-hidden="true">→</span>
          </p>
        </button>
      </div>
    </div>
  );
};

export default SystemOverlay;
