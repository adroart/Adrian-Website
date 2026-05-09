import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { ChapterKey } from './ChapterWordmark';

export interface ReadingStageHandle {
  scrollTo: (key: ChapterKey, opts?: { instant?: boolean }) => void;
}

/**
 * Horizontal scroll-snap reading stage.
 *
 * Holds 5 panels (one per system) side by side. Each panel is the full width
 * of the stage. Built on native CSS scroll-snap so wheel, trackpad, touch, and
 * keyboard all navigate identically. An IntersectionObserver tracks which
 * panel is most visible and reports it via onActiveChange.
 */
export const ReadingStage = React.forwardRef<ReadingStageHandle, {
  chapters: ChapterKey[];
  active: ChapterKey;
  onActiveChange: (key: ChapterKey) => void;
  children: React.ReactNode;
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
      stage.scrollTo({
        left: panel.offsetLeft,
        behavior: opts?.instant ? 'auto' : 'smooth',
      });
      if (programmaticScrollTimeout.current) window.clearTimeout(programmaticScrollTimeout.current);
      programmaticScrollTimeout.current = window.setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, opts?.instant ? 50 : 600);
    },
  }), []);

  // Track the most-visible panel via IntersectionObserver.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const visibility = new Map<ChapterKey, number>();
    chapters.forEach(k => visibility.set(k, 0));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const key = (entry.target as HTMLElement).dataset.chapter as ChapterKey | undefined;
        if (!key) return;
        visibility.set(key, entry.intersectionRatio);
      });
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
      className={`reading-stage focus-visible:outline-none ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        width: '100%',
        overflowX: 'auto',
        overflowY: 'visible',
        scrollSnapType: 'x mandatory',
        overscrollBehaviorX: 'contain',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {chapters.map((key, idx) => (
        <section
          key={key}
          data-chapter={key}
          ref={el => { panelRefs.current.set(key, el); }}
          aria-hidden={key !== active}
          className="reading-stage__panel"
          style={{
            flex: '0 0 100%',
            width: '100%',
            minWidth: '100%',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          {childrenArray[idx]}
        </section>
      ))}
    </div>
  );
});

ReadingStage.displayName = 'ReadingStage';

export default ReadingStage;
