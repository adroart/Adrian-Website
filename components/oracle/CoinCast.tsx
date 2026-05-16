/**
 * CoinCast — the I Ching coin-casting ritual for a Universal Language card.
 *
 * The I Ching is a changing oracle. The card carries a fixed hexagram; the
 * cast resolves which of its lines are moving. Moving lines, flipped, produce
 * the hexagram the present moment is becoming.
 *
 * The block is a single museum-plate row, matching the rest of the I Ching
 * plate (88px label column, hairline borders). It holds two hexagrams on one
 * row: the present on the left, the becoming on the right.
 *
 * Casting is the transition between them. The present hexagram is shown
 * alone; on cast, its six lines settle, the moving lines brighten, those
 * lines flip in place, and a copy of the changed hexagram slides into the
 * becoming slot on the right. Moving lines are read by brightness, not by
 * labels. The becoming hexagram's number is the link onward to that card.
 *
 * Motion is opacity + transform only, ease-out. Reduced motion resolves the
 * cast as one quiet fade.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CastResult } from '../../utils/ichingCasting';
import { CARD_BY_NUMBER, type OracleCard } from '../../data/oracleData';
import { getLineText } from '../../data/ichingLines';
import { ulCardImageUrl } from '../../utils/universalLanguage';

/* ─── Hexagram glyph ─────────────────────────────────────────────────────── */

const LINE_DIM = 'rgba(176,128,72,0.5)';
const LINE_BRIGHT = 'rgba(208,168,98,0.95)';

/**
 * A six-line hexagram. `bits` and `moving` are bottom-up (index 0 = line 1).
 * Lines render top-to-bottom. Moving lines draw in bright bronze, stable
 * lines in muted bronze — the only mark, no dots, no labels.
 *
 * `flipProgress` 0..1 morphs each moving line from its `bits` value toward
 * its flipped value, driving the in-place flip animation.
 */
const Hexagram: React.FC<{
  bits: boolean[];
  moving: boolean[];
  width?: number;
  /** 0 = lines as cast, 1 = moving lines fully flipped. */
  flipProgress?: number;
  /** Per-line reveal count for the build sequence, 0..6. */
  revealCount?: number;
}> = ({ bits, moving, width = 80, flipProgress = 0, revealCount = 6 }) => {
  const lh = Math.max(3, Math.round(width * 0.085));
  const step = Math.round(width * 0.165);
  const gap = Math.round(width * 0.16);
  const hw = (width - gap) / 2;
  const totalH = lh + step * 5;

  // Render top (line 6, index 5) first.
  const rows = [5, 4, 3, 2, 1, 0];

  return (
    <svg
      width={width}
      height={totalH}
      viewBox={`0 0 ${width} ${totalH}`}
      fill="none"
      aria-hidden="true"
    >
      {rows.map((idx, rowI) => {
        const y = rowI * step;
        const isMoving = moving[idx];
        // A moving line is "yang at progress 0, flipped at progress 1".
        // We render it solid when its current interpolated yang-ness > 0.5.
        const baseYang = bits[idx];
        const flippedYang = isMoving ? !baseYang : baseYang;
        const showFlipped = isMoving && flipProgress >= 0.5;
        const yang = showFlipped ? flippedYang : baseYang;
        const color = isMoving ? LINE_BRIGHT : LINE_DIM;
        const lineNumber = idx + 1; // position 1..6
        const revealed = lineNumber <= revealCount;

        // The flip reads as a brief vertical squash at the midpoint.
        const flipScale =
          isMoving && flipProgress > 0 && flipProgress < 1
            ? 1 - Math.sin(flipProgress * Math.PI) * 0.55
            : 1;

        return (
          <g
            key={idx}
            style={{
              opacity: revealed ? 1 : 0,
              transform: `translateY(${revealed ? 0 : 5}px) scaleY(${flipScale})`,
              transformOrigin: `center ${y + lh / 2}px`,
              transition:
                'opacity 280ms cubic-bezier(0.22,1,0.36,1), transform 280ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {yang ? (
              <rect x={0} y={y} width={width} height={lh} rx={1.5} fill={color} />
            ) : (
              <>
                <rect x={0} y={y} width={hw} height={lh} rx={1.5} fill={color} />
                <rect x={hw + gap} y={y} width={hw} height={lh} rx={1.5} fill={color} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};

/* ─── Adaptive reading guidance ──────────────────────────────────────────── */

function guidanceFor(movingCount: number): string {
  if (movingCount === 0) {
    return 'Nothing moves. The moment is steady. Read the hexagram as it stands.';
  }
  if (movingCount === 1) {
    return 'One line stirs. Read that line, then the hexagram it is becoming.';
  }
  if (movingCount >= 5) {
    return 'Almost everything moves. Read the lines in order, then rest in the hexagram you are becoming.';
  }
  return 'Several lines stir. Read them in order, then the hexagram you are becoming.';
}

/* ─── Becoming preview modal ─────────────────────────────────────────────── */

/**
 * A quiet centered modal that previews the hexagram a reading is becoming —
 * a small square of its artwork, a couple of highlights, and a short excerpt.
 * It stands between the cast and the full card so the becoming hexagram is a
 * *peek*, not a trapdoor: the only navigation is the explicit "Read the full
 * code" link inside the modal.
 *
 * Pattern matches ImageViewer — role=dialog, Esc, body scroll-lock, translucent
 * stone backdrop, cubic-bezier(0.22,1,0.36,1) easing.
 */
const BecomingPreview: React.FC<{
  open: boolean;
  card: OracleCard | null;
  reduceMotion: boolean;
  onClose: () => void;
  onRead: () => void;
}> = ({ open, card, reduceMotion, onClose, onRead }) => {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  // Drive the open/close transition off `open` alone. Mount at `opening`, then
  // flip to `open` on the next frame so the entrance transition runs; on close,
  // hold `closing` long enough for the exit transition, then unmount.
  useEffect(() => {
    if (open) {
      setPhase('opening');
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('open'));
      });
      return () => cancelAnimationFrame(raf);
    }
    setPhase((prev) => (prev === 'closed' ? 'closed' : 'closing'));
    const t = window.setTimeout(() => setPhase('closed'), 220);
    return () => window.clearTimeout(t);
  }, [open]);

  // Esc to dismiss + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (phase === 'closed' || !card) return null;

  const shown = phase === 'open';
  const ease = 'cubic-bezier(0.22,1,0.36,1)';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of Code ${card.number}, ${card.iching.hexagram_name}`}
      onClick={onClose}
    >
      {/* Translucent stone backdrop — the page is still felt beneath */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-stone-900/85 backdrop-blur-[2px] motion-safe:transition-opacity motion-safe:duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />

      {/* The plate */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[380px] bg-stone-900 border border-stone-700/70 rounded-sm overflow-hidden"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown || reduceMotion ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          transition: reduceMotion
            ? 'opacity 200ms ease-out'
            : `opacity 220ms ${ease}, transform 220ms ${ease}`,
        }}
      >
        {/* Artwork square + the becoming label overlaid */}
        <div className="relative aspect-square bg-stone-800">
          <img
            src={ulCardImageUrl(card.number, 480)}
            alt={`${card.card_name}, Universal Language ${card.number}`}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-stone-900 to-transparent"
          />
          <span className="absolute bottom-3 left-4 font-label text-[10px] uppercase tracking-[0.22em] text-bronze-400/90">
            Becoming · Code {card.number}
          </span>
        </div>

        {/* Text */}
        <div className="px-6 pt-5 pb-6">
          <h2 className="font-serif text-[22px] text-stone-100 leading-tight">
            {card.iching.hexagram_name}
          </h2>

          {/* A couple of little highlights */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              ['Gift', card.gene_keys.gift],
              ['Keyword', card.human_design.keyword],
            ].map(([label, value]) => (
              <span
                key={label}
                className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-sm bg-stone-800 border border-stone-700/60"
              >
                <span className="font-label text-[9px] uppercase tracking-[0.18em] text-bronze-400/70">
                  {label}
                </span>
                <span className="font-serif text-[13px] text-stone-200">{value}</span>
              </span>
            ))}
          </div>

          {/* Short excerpt — the readable `nature` field, gently truncated */}
          <p className="font-sans text-[14px] text-stone-300 leading-[1.7] mt-4">
            {truncate(card.nature, 220)}
          </p>

          {/* The only navigation — explicit, after the peek */}
          <div className="flex items-center gap-5 mt-5 pt-4 border-t border-stone-700/50">
            <button
              type="button"
              onClick={onRead}
              className="font-label text-[12px] uppercase tracking-[0.22em] font-semibold text-bronze-400 hover:text-bronze-300 transition-colors pb-1 border-b border-bronze-500/40 hover:border-bronze-400/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900 rounded-sm"
            >
              Read the full code
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-label text-[12px] uppercase tracking-[0.18em] text-stone-500 hover:text-stone-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-600 rounded-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Trim to a whole word at most `max` chars, adding an ellipsis when cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

const CoinCast: React.FC<{
  primaryNumber: number;
  cast: CastResult | null;
  casting: boolean;
  onCast: () => void;
  onCastingDone: () => void;
}> = ({ primaryNumber, cast, casting, onCast, onCastingDone }) => {
  const navigate = useNavigate();

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Animation phases for a cast:
  //   build   — six lines settle on the present hexagram
  //   flip    — moving lines flip in place (flipProgress 0 -> 1)
  //   reveal  — the becoming hexagram slides into the right slot
  const [revealCount, setRevealCount] = useState(6);
  const [flipProgress, setFlipProgress] = useState(0);
  const [becomingIn, setBecomingIn] = useState(false);
  // Whether the becoming-hexagram preview modal is open.
  const [previewOpen, setPreviewOpen] = useState(false);
  const timers = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  const primaryCard = CARD_BY_NUMBER.get(primaryNumber);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!cast) {
      setRevealCount(6);
      setFlipProgress(0);
      setBecomingIn(false);
      return;
    }

    if (!casting) {
      // A restored (already-cast) reading — show the final state at once.
      setRevealCount(6);
      setFlipProgress(1);
      setBecomingIn(true);
      return;
    }

    // A fresh cast — run the build / flip / reveal sequence.
    setRevealCount(reduceMotion ? 6 : 0);
    setFlipProgress(0);
    setBecomingIn(false);

    if (reduceMotion) {
      const t = window.setTimeout(() => {
        setFlipProgress(1);
        setBecomingIn(true);
        onCastingDone();
      }, 460);
      timers.current.push(t);
      return;
    }

    // 1. Build: reveal six lines, bottom-to-top.
    const buildStep = 240;
    for (let i = 1; i <= 6; i++) {
      timers.current.push(
        window.setTimeout(() => setRevealCount(i), buildStep * i),
      );
    }
    const buildEnd = buildStep * 6 + 260;

    // 2. Flip: animate flipProgress 0 -> 1 over ~520ms.
    timers.current.push(
      window.setTimeout(() => {
        const flipDur = 520;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / flipDur);
          setFlipProgress(p);
          if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }, buildEnd),
    );

    // 3. Reveal: the becoming hexagram slides in once the flip is underway.
    timers.current.push(
      window.setTimeout(() => setBecomingIn(true), buildEnd + 300),
    );
    timers.current.push(
      window.setTimeout(onCastingDone, buildEnd + 760),
    );

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cast, casting, reduceMotion, onCastingDone]);

  /* ── Idle — the invitation ─────────────────────────────────────────────── */
  if (!cast) {
    return (
      <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 py-6 sm:py-7 px-4 sm:px-7 border-b border-stone-700/60">
        <p className="font-label text-[12px] sm:text-[13px] uppercase tracking-[0.18em] font-semibold text-bronze-400/80 sm:self-start sm:pt-1 mb-3 sm:mb-0">
          The cast
        </p>
        <div className="min-w-0">
          <p className="font-sans text-[16px] text-stone-200 leading-[1.75] sm:leading-[1.8] max-w-prose">
            The I Ching reads two hexagrams at once: the shape of the present
            moment, and the shape it is turning into. Cast the three coins, six
            times, to find the moving lines and the hexagram this one becomes.
          </p>
          <button
            type="button"
            onClick={onCast}
            className="mt-5 font-label text-[12px] uppercase tracking-[0.22em] font-semibold text-bronze-400 hover:text-bronze-300 transition-colors pb-1 border-b border-bronze-500/40 hover:border-bronze-400/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900 rounded-sm"
          >
            Cast the coins
          </button>
        </div>
      </div>
    );
  }

  const { lines, changedNumber, movingPositions } = cast;
  const movingCount = movingPositions.length;
  const presentBits = lines.map((l) => l.yang);
  const movingBits = lines.map((l) => l.moving);
  const changedBits = lines.map((l) => (l.moving ? !l.yang : l.yang));

  const changedCard = changedNumber ? CARD_BY_NUMBER.get(changedNumber) : undefined;
  const settled = !casting;

  return (
    <>
    <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 py-6 sm:py-7 px-4 sm:px-7 border-b border-stone-700/60">
      <style>{`
        @keyframes ul-cast-slide-in {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ul-cast-soft-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <p className="font-label text-[12px] sm:text-[13px] uppercase tracking-[0.18em] font-semibold text-bronze-400/80 sm:self-start sm:pt-1 mb-4 sm:mb-0">
        The cast
      </p>

      <div className="min-w-0">
        {/* ── The pairing: present and becoming, one row ─────────────────── */}
        <div className="flex items-start justify-center sm:justify-start gap-3.5 sm:gap-8">
          {/* Present — its moving lines flip during the cast, then settle
              back to the original once the becoming hexagram has slid in. */}
          <div className="flex flex-col items-center flex-shrink-0">
            <Hexagram
              bits={presentBits}
              moving={movingBits}
              flipProgress={becomingIn ? 0 : flipProgress}
              revealCount={revealCount}
              width={78}
            />
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-500 mt-3">
              Now
            </span>
            <span className="font-serif text-[14px] sm:text-[15px] text-stone-300 leading-[1.25] text-center mt-1 max-w-[96px] sm:max-w-[120px]">
              {primaryCard?.iching.hexagram_name ?? `Code ${primaryNumber}`}
            </span>
          </div>

          {/* Transition mark */}
          {changedNumber && (
            <div
              className="flex-shrink-0 self-start pt-[26px] font-serif text-[14px] italic text-bronze-500/60"
              aria-hidden="true"
            >
              becoming
            </div>
          )}

          {/* Becoming — slides in after the flip. Clicking it opens a quiet
              preview modal, not a navigation; it is only interactive once the
              cast has settled (becomingIn), so the click target never moves. */}
          {changedNumber && changedCard && (
            <button
              type="button"
              onClick={() => becomingIn && setPreviewOpen(true)}
              disabled={!becomingIn}
              aria-label={`Preview Code ${changedNumber}, ${changedCard.iching.hexagram_name}, the hexagram this reading is becoming`}
              className="group flex flex-col items-center flex-shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900 disabled:cursor-default cursor-pointer"
              style={{
                opacity: becomingIn ? 1 : 0,
                pointerEvents: becomingIn ? 'auto' : 'none',
                animation:
                  becomingIn && !reduceMotion
                    ? 'ul-cast-slide-in 460ms cubic-bezier(0.22,1,0.36,1) both'
                    : undefined,
              }}
            >
              <Hexagram
                bits={changedBits}
                moving={new Array(6).fill(false)}
                flipProgress={0}
                revealCount={6}
                width={78}
              />
              <span className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-400/70 group-hover:text-bronze-300 transition-colors mt-3">
                Code {changedNumber}
              </span>
              <span className="font-serif text-[14px] sm:text-[15px] text-stone-200 group-hover:text-white leading-[1.25] text-center mt-1 max-w-[96px] sm:max-w-[120px] transition-colors underline decoration-bronze-500/40 decoration-[1.5px] underline-offset-[3px] group-hover:decoration-bronze-400">
                {changedCard.iching.hexagram_name}
              </span>
            </button>
          )}
        </div>

        {/* ── Reading detail — only once the cast has settled ────────────── */}
        {settled && (
          <div
            style={{
              animation: reduceMotion ? undefined : 'ul-cast-soft-in 420ms ease-out both',
            }}
          >
            <p className="font-sans text-[15px] sm:text-[16px] text-stone-300 leading-[1.7] mt-7 max-w-prose">
              {guidanceFor(movingCount)}
            </p>

            {movingCount > 0 && (
              <div className="mt-6 pt-5 border-t border-stone-700/50">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-400/80 mb-4">
                  {movingCount === 1 ? 'The moving line' : 'The moving lines'}
                </p>
                <div className="space-y-4">
                  {movingPositions.map((pos) => {
                    const text = getLineText(primaryNumber, pos);
                    return (
                      <div
                        key={pos}
                        className="block sm:grid sm:grid-cols-[58px_1fr] sm:gap-x-4"
                      >
                        <p className="font-label text-[11px] uppercase tracking-[0.14em] font-semibold text-stone-400 sm:self-start sm:pt-0.5 mb-1 sm:mb-0">
                          Line {pos}
                        </p>
                        {text ? (
                          <p className="font-sans text-[15px] text-stone-200 leading-[1.7]">
                            {text}
                          </p>
                        ) : (
                          <p className="font-serif text-[14px] italic text-stone-500 leading-[1.6]">
                            Line text to be added.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onCast}
              className="mt-7 font-label text-[12px] uppercase tracking-[0.22em] font-semibold text-stone-400 hover:text-bronze-300 transition-colors pb-1 border-b border-stone-600/60 hover:border-bronze-400/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900 rounded-sm"
            >
              Cast again
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Preview of the becoming hexagram — the only path onward is its
        "Read the full code" link, so navigation is always deliberate. */}
    <BecomingPreview
      open={previewOpen}
      card={changedCard ?? null}
      reduceMotion={!!reduceMotion}
      onClose={() => setPreviewOpen(false)}
      onRead={() => {
        setPreviewOpen(false);
        if (changedNumber != null) {
          navigate(`/oracle/universal-language/${changedNumber}`, {
            state: { ritual: true },
          });
        }
      }}
    />
    </>
  );
};

export default CoinCast;
