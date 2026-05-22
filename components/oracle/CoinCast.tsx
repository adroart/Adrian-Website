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

/* ─── Three coins ────────────────────────────────────────────────────────────
   The traditional I Ching coin: round, with a square hole at the centre.
   Three of them, overlapped, shown on the invitation so a reader who has
   never met the practice sees what the gesture is. Pure vector, bronze, no
   text — it teaches by image. */

const ThreeCoins: React.FC<{ size?: number; color?: string }> = ({
  size = 76,
  color = 'rgba(200,169,106,0.9)',
}) => {
  // One coin: outer circle, inner square hole. Drawn at unit scale, then
  // three are placed in an overlapped triangular cluster.
  const Coin: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => {
    const sq = r * 0.42; // half-side of the square hole
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={r * 0.13} />
        <circle cx={cx} cy={cy} r={r * 0.66} fill="none" stroke={color} strokeWidth={r * 0.07} opacity={0.55} />
        <rect
          x={cx - sq}
          y={cy - sq}
          width={sq * 2}
          height={sq * 2}
          fill="none"
          stroke={color}
          strokeWidth={r * 0.1}
        />
      </g>
    );
  };
  const r = size * 0.27;
  return (
    <svg width={size} height={size * 0.84} viewBox={`0 0 ${size} ${size * 0.84}`} fill="none" aria-hidden="true">
      <Coin cx={size * 0.32} cy={size * 0.30} r={r} />
      <Coin cx={size * 0.68} cy={size * 0.30} r={r} />
      <Coin cx={size * 0.50} cy={size * 0.54} r={r} />
    </svg>
  );
};

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
    /* TEMPLATE: the still invitation. Shows the three coins as a vector — a
       reader who has never met the I Ching sees what the gesture IS. The
       language avoids the jargon "cast": this is the oracle changing. The
       whole block is the trigger, so the coins themselves begin the ritual. */
    return (
      <div className="py-9 sm:py-11 px-4 sm:px-7 border-b border-stone-700/60 flex justify-center">
        <button
          type="button"
          onClick={onCast}
          className="group flex flex-col items-center text-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-8 focus-visible:ring-offset-stone-900"
          aria-label="Throw the coins. Begin the changing and see how this hexagram is moving."
        >
          <span className="transition-transform duration-300 group-hover:-translate-y-0.5">
            <ThreeCoins size={84} />
          </span>
          <span className="font-serif text-[17px] sm:text-[18px] text-stone-200 leading-[1.5] mt-5 max-w-[26rem]">
            Every hexagram is also in motion. Throw the three coins to see how
            this one is changing, and the hexagram it is turning into.
          </span>
          <span className="font-label text-[12px] uppercase tracking-[0.22em] font-semibold text-bronze-400 group-hover:text-bronze-300 transition-colors mt-5 pb-1 border-b border-bronze-500/40 group-hover:border-bronze-400/70">
            Throw the coins
          </span>
        </button>
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
    {/* TEMPLATE REDESIGN: the "The cast" label and the 88px side-indent are
        gone. The parent panel already frames this as "The Changing", so a
        second label was redundant, and the indent cramped the whole block.
        The present/becoming pair now reads as one centered composition; the
        hexagram names sit on a full-width row below the glyphs, with real
        room, so a long name no longer stacks onto three cramped lines. */}
    <div className="py-6 sm:py-8 px-4 sm:px-7 border-b border-stone-700/60">
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

      <div className="min-w-0">
        {/* ── The changing — two matched stages ──────────────────────────
            TEMPLATE: both stages share one structure — hexagram glyph on
            the LEFT, and on the RIGHT a block: the label, the hexagram
            title beneath it, then the detail (moving lines / the becoming
            reading). The eye travels straight down a consistent column. */}

        {/* ── Stage one — the present and its moving lines ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          {/* Glyph, with its label + hexagram number tucked beneath it */}
          <div className="flex flex-col items-center flex-shrink-0">
            <Hexagram
              bits={presentBits}
              moving={movingBits}
              flipProgress={becomingIn ? 0 : flipProgress}
              revealCount={revealCount}
              width={88}
            />
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-500 mt-3.5">
              Now
            </span>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-500 mt-1">
              Hexagram {primaryNumber}
            </span>
          </div>

          {/* Text block — the title at the top, aligned with the glyph's
              top edge, then the moving lines below. */}
          <div className="flex-1 min-w-0 w-full text-center sm:text-left">
            <p className="font-serif text-[17px] sm:text-[19px] text-stone-100 leading-[1.3]">
              {primaryCard?.iching.hexagram_name ?? `Code ${primaryNumber}`}
            </p>

            {/* The moving lines — TEMPLATE: a close-set list. No divider,
                just a small gap, so the lines read together as one group. */}
            {settled && movingCount > 0 && (
              <div
                className="mt-4 text-left space-y-1.5"
                style={{ animation: reduceMotion ? undefined : 'ul-cast-soft-in 420ms ease-out both' }}
              >
                {movingPositions.map((pos) => {
                  const text = getLineText(primaryNumber, pos);
                  return (
                    <p key={pos} className="font-sans text-[16px] text-stone-200 leading-[1.7]">
                      <span className="font-label text-[11px] uppercase tracking-[0.14em] font-semibold text-bronze-400/80 mr-2">
                        Line {pos}
                      </span>
                      {text ? (
                        text
                      ) : (
                        <span className="text-stone-500">
                          Line text to be added.
                        </span>
                      )}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Stage two — what it is becoming ────────────────────────────
            TEMPLATE: same structure as stage one — glyph on the LEFT, the
            label / title / reading block on the RIGHT. The two stages are
            a consistent column down the panel. */}
        {changedNumber && changedCard && settled && (
          <div
            className="mt-9 pt-7 border-t border-stone-700/50 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8"
            style={{ opacity: becomingIn ? 1 : 0, transition: 'opacity 400ms ease-out' }}
          >
            {/* The becoming glyph — on the left, with its label + number
                tucked beneath it, matching stage one. */}
            <div className="flex flex-col items-center flex-shrink-0">
              <Hexagram
                bits={changedBits}
                moving={new Array(6).fill(false)}
                flipProgress={0}
                revealCount={6}
                width={88}
              />
              <span className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-400/70 mt-3.5">
                Becoming
              </span>
              <span className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-400/70 mt-1">
                Hexagram {changedNumber}
              </span>
            </div>

            {/* Text block — title at the top, aligned with the glyph's top
                edge, then the becoming reading and the link. */}
            <div className="flex-1 min-w-0 w-full text-center sm:text-left">
              <p className="font-serif text-[17px] sm:text-[19px] text-stone-100 leading-[1.3]">
                {changedCard.iching.hexagram_name}
              </p>
              {/* TEMPLATE: the becoming reading describes the quality of the
                  change, it does not name the hexagram (the title above
                  already names it). One sentence on what the present is
                  moving toward. NOTE: this is a generic placeholder — the
                  real per-becoming description is synthesis content, wired
                  when the becoming card's reading is reachable here. */}
              <p className="font-sans text-[15px] sm:text-[16px] text-stone-300 leading-[1.7] mt-3 text-left">
                As the moving line settles, the present begins to give way to
                a different shape, a new configuration the moment is travelling
                into. Follow the changing line to see what it asks of you.
              </p>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group mt-4 font-label text-[12px] uppercase tracking-[0.2em] font-semibold text-bronze-400 hover:text-bronze-300 transition-colors pb-1 border-b border-bronze-500/40 hover:border-bronze-400/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-4 focus-visible:ring-offset-stone-900 rounded-sm"
              >
                Read Code {changedNumber}
              </button>
            </div>
          </div>
        )}

        {/* TEMPLATE: no "throw again" — once the coins are thrown, the cast
            stands. The reading is what it is; it is not re-rolled. */}
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
