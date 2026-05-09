import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ChapterKey = 'iching' | 'genekeys' | 'humandesign' | 'tarot' | 'body';

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
  const inactiveCls = paper ? 'text-wood-500 hover:text-wood-800' : 'text-stone-500 hover:text-stone-800';
  const activeCls = 'text-bronze-700';

  return (
    <div
      ref={containerRef}
      className={`relative w-full border-t border-b ${ruleCls} bg-paper-100 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${className}`}
      role="tablist"
      aria-label="Reading chapters"
    >
      <div className="flex items-stretch h-10 max-w-2xl mx-auto">
        {chapters.map((chapter, idx) => {
          const isActive = chapter.key === active;
          const isLast = idx === chapters.length - 1;
          return (
            <button
              key={chapter.key}
              ref={el => { itemsRef.current.set(chapter.key, el); }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(chapter.key)}
              className={`relative flex-1 min-w-0 flex items-center justify-center px-1.5 sm:px-3 ${!isLast ? `border-r ${ruleCls}` : ''} font-label uppercase tracking-[0.18em] text-[10px] sm:text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:bg-bronze-500/[0.05] ${isActive ? activeCls : inactiveCls}`}
            >
              {/* Show shortLabel on very narrow screens via the label-mobile/label-desktop pair */}
              {chapter.shortLabel ? (
                <>
                  <span className="sm:hidden">{chapter.shortLabel}</span>
                  <span className="hidden sm:inline">{chapter.label}</span>
                </>
              ) : (
                <span>{chapter.label}</span>
              )}
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
