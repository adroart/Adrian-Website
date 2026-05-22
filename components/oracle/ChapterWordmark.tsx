import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ChapterKey = 'ul' | 'iching' | 'genekeys' | 'humandesign' | 'tarot' | 'body';

export interface Chapter {
  key: ChapterKey;
  label: string;       // displayed text, e.g. "I CHING"
  shortLabel?: string; // optional narrow-screen replacement, e.g. "DESIGN" for "HUMAN DESIGN"
}

/**
 * Sticky typeset chapter wordmark.
 *
 * Five letterspaced labels in a row with a sliding 1px bronze underline that
 * tracks the active chapter. Hairline rules above and below echo the museum
 * plate aesthetic. No pills, no rounded backgrounds — type doing the work
 * that shapes were doing.
 *
 * Tap a label → onSelect(key). Active chapter is driven by parent (which
 * watches the reading stage via IntersectionObserver).
 */
export const ChapterWordmark: React.FC<{
  chapters: Chapter[];
  active: ChapterKey;
  onSelect: (key: ChapterKey) => void;
  /**
   * If `dark` is true the wordmark renders for dark sections (stone-900);
   * otherwise it adapts to paper backgrounds. The active label is always
   * bronze.
   */
  variant: 'paper' | 'mixed';
  className?: string;
}> = ({ chapters, active, onSelect, variant, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<ChapterKey, HTMLButtonElement | null>>(new Map());
  const [underline, setUnderline] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  // Position the bronze underline beneath the active label whenever it changes
  // or the layout shifts (resize, font load).
  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef.current;
      const item = itemsRef.current.get(active);
      if (!container || !item) return;
      const cRect = container.getBoundingClientRect();
      const iRect = item.getBoundingClientRect();
      setUnderline({
        left: iRect.left - cRect.left,
        width: iRect.width,
        ready: true,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', update);
    // Cormorant/Lato may load late; recompute when the document font set settles.
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(update).catch(() => {});
    }
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [active, chapters]);

  // Variant tokens. Paper variant is for sections on light paper backgrounds;
  // mixed variant works on the chrome strip that floats over either section.
  // Note: this site's color tokens AUTO-INVERT in dark mode via CSS variables
  // (src/index.css). Do NOT use `dark:bg-*` overrides here — they would
  // double-invert and produce light backgrounds in dark mode. Just use the
  // base token; it flips correctly on its own.
  const paper = variant === 'paper';
  const ruleCls = paper ? 'border-wood-300/60' : 'border-stone-300/60';
  const inactiveCls = paper ? 'text-wood-700 hover:text-wood-900' : 'text-stone-400 hover:text-stone-100';
  const activeCls = 'text-bronze-700';

  return (
    <div
      ref={containerRef}
      className={`relative w-full border-t border-b ${ruleCls} bg-paper-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${className}`}
      role="tablist"
      aria-label="Reading chapters"
    >
      {/* Content-based column widths instead of equal flex-1 buckets.
          Each chapter takes the width its label needs; remaining space
          distributes proportionally via flex-auto. Multi-word labels
          (GENE KEYS, HUMAN DESIGN) can wrap to two lines on narrow
          viewports, so the strip's vertical footprint grows by one
          line of text-height when any chapter is wrapping. The
          sliding underline adapts automatically to each chapter's
          measured width. */}
      <div className="flex items-stretch min-h-[40px] max-w-2xl mx-auto">
        {chapters.map((chapter, idx) => {
          const isActive = chapter.key === active;
          const isLast = idx === chapters.length - 1;
          const label = chapter.shortLabel ?? chapter.label;
          return (
            <button
              key={chapter.key}
              ref={el => { itemsRef.current.set(chapter.key, el); }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(chapter.key)}
              className={`relative flex-auto min-w-0 flex items-center justify-center text-center px-2 sm:px-3 py-1.5 ${!isLast ? `border-r ${ruleCls}` : ''} font-label uppercase tracking-[0.16em] text-[12px] sm:text-[13px] leading-[1.15] font-semibold transition-colors focus-visible:outline-none focus-visible:bg-bronze-500/[0.05] ${isActive ? activeCls : inactiveCls}`}
            >
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {/* Sliding bronze underline. Pure CSS transition — no animation library. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 h-px bg-bronze-500 motion-safe:transition-all motion-safe:duration-[280ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateX(${underline.left}px)`,
          width: underline.width,
          opacity: underline.ready ? 1 : 0,
        }}
      />
    </div>
  );
};

export default ChapterWordmark;
