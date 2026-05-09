import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { ChapterKey } from './ChapterWordmark';

export interface ReadingStageHandle {
  scrollTo: (key: ChapterKey, opts?: { instant?: boolean }) => void;
}

/**
 * Horizontal scroll-snap reading stage.
 *
 * Holds 5 panels (one per system) side by side. Each panel is the full width
 * of the stage, with a 20px peek of the next panel showing on the right edge
 * to telegraph the swipe affordance.
 *
 * Built on native CSS scroll-snap so wheel, trackpad, touch, and keyboard all
 * navigate identically. An IntersectionObserver tracks which panel is most
 * visible and reports it via onActiveChange.
 *
 * `touch-action: pan-y` on inner content (set by the panel children themselves)
 * + `overscroll-behavior-x: contain` on the container ensures vertical reading
 * doesn't accidentally trigger horizontal snap, and horizontal swipe doesn't
 * leak to the browser back gesture.
 */
export const ReadingStage = React.forwardRef<ReadingStageHandle, {
  chapters: ChapterKey[];
  active: ChapterKey;
  onActiveChange: (key: ChapterKey) => void;
  children: React.ReactNode; // expects exactly chapters.length children, in order
  className?: string;
}>(({ chapters, active, onActiveChange, children, className = '' }, ref) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Map<ChapterKey, HTMLElement | null>>(new Map());
  const isProgrammaticScroll = useRef(false);
  const programmaticScrollTimeout = useRef<number | null>(null);

  const childrenArray = useMemo(() => React.Children.toArray(children), [children]);

  useImperativeHandle(ref, () => ({
    scrollTo: (key, opts) => {
      const stage = stageRef.current;
      const panel = panelRefs.current.get(key);
      if (!stage || !panel) return;
      isProgrammaticScroll.current = true;
      const targetLeft = panel.offsetLeft;
      stage.scrollTo({
        left: targetLeft,
        behavior: opts?.instant ? 'auto' : 'smooth',
      });
      // Release the lock after the smooth scroll has had time to settle so
      // the IntersectionObserver doesn't fire intermediate active chapters.
      if (programmaticScrollTimeout.current) window.clearTimeout(programmaticScrollTimeout.current);
      programmaticScrollTimeout.current = window.setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, opts?.instant ? 50 : 600);
    },
  }), []);

  // Track the most-visible panel via IntersectionObserver. We use a single
  // observer with thresholds so we know which panel crosses the 50% mark.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let visibility = new Map<ChapterKey, number>();
    chapters.forEach(k => visibility.set(k, 0));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const key = (entry.target as HTMLElement).dataset.chapter as ChapterKey | undefined;
        if (!key) return;
        visibility.set(key, entry.intersectionRatio);
      });
      // Pick the chapter with the highest ratio — that's the one currently in view.
      let best: ChapterKey | null = null;
      let bestRatio = 0;
      visibility.forEach((ratio, key) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = key;
        }
      });
      if (best && bestRatio > 0.5 && !isProgrammaticScroll.current) {
        onActiveChange(best);
      }
    }, {
      root: stage,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    panelRefs.current.forEach(panel => {
      if (panel) observer.observe(panel);
    });
    return () => observer.disconnect();
  }, [chapters, onActiveChange]);

  // Keyboard nav: ← / → move between panels when the stage has focus.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const idx = chapters.indexOf(active);
    if (idx === -1) return;
    const nextIdx = e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : Math.min(chapters.length - 1, idx + 1);
    if (nextIdx === idx) return;
    e.preventDefault();
    const nextKey = chapters[nextIdx];
    const stage = stageRef.current;
    const panel = panelRefs.current.get(nextKey);
    if (!stage || !panel) return;
    isProgrammaticScroll.current = true;
    stage.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' });
    onActiveChange(nextKey);
    if (programmaticScrollTimeout.current) window.clearTimeout(programmaticScrollTimeout.current);
    programmaticScrollTimeout.current = window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 600);
  }, [active, chapters, onActiveChange]);

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      role="region"
      aria-label="Reading by system. Swipe or arrow keys to navigate."
      onKeyDown={handleKeyDown}
      className={`reading-stage flex w-full overflow-x-auto overflow-y-visible snap-x snap-mandatory overscroll-x-contain focus-visible:outline-none ${className}`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {chapters.map((key, idx) => (
        <section
          key={key}
          data-chapter={key}
          ref={el => { panelRefs.current.set(key, el); }}
          aria-hidden={key !== active}
          className="reading-stage__panel snap-start shrink-0 w-full"
          style={{
            // The panel itself is 100% of the stage width. The peek effect lives
            // in the stage's right padding so the next panel's edge slides in.
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          {childrenArray[idx]}
        </section>
      ))}
      {/* Hide WebKit scrollbar without affecting layout. */}
      <style>{`
        .reading-stage::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
});

ReadingStage.displayName = 'ReadingStage';

export default ReadingStage;
