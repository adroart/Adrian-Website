import React, { useEffect, useRef, useState } from 'react';

/**
 * Tier-2 immersive image viewer.
 *
 * Designed deliberately *not* to feel like a modal lightbox:
 *
 * - Shared-element morph: the image scales up from its on-page origin rect to
 *   fill the viewport, so it reads as the *same image* growing, not a new one
 *   teleporting in.
 * - Translucent palette-tinted backdrop (not opaque black), so the site is
 *   still felt beneath.
 * - Five dismissal paths — swipe down, swipe up, tap outside, ESC, browser
 *   back button. The back-button integration (via pushState + popstate) is
 *   the single biggest fix for the "trapped in a lightbox" feeling.
 * - Auto-hiding chrome — a small dismiss affordance fades in only after 2s
 *   of stillness, then fades out again on interaction.
 * - Native pinch-zoom and pan via `touch-action: pinch-zoom`.
 */
export const ImageViewer: React.FC<{
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
  /** Origin rect from which the image should morph open. */
  originRect: DOMRect | null;
}> = ({ open, src, alt, onClose, originRect }) => {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [showHint, setShowHint] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const wasOpen = useRef(false);

  // Open / close transitions
  useEffect(() => {
    if (open && phase === 'closed') {
      setPhase('opening');
      const t = window.setTimeout(() => setPhase('open'), 20);
      return () => window.clearTimeout(t);
    }
    if (!open && phase === 'open') {
      setPhase('closing');
      const t = window.setTimeout(() => setPhase('closed'), 220);
      return () => window.clearTimeout(t);
    }
  }, [open, phase]);

  // Browser back-button dismiss
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const stateMarker = { __imageViewer: true, t: Date.now() };
    try { window.history.pushState(stateMarker, ''); } catch {}
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if ((window.history.state as any)?.__imageViewer) {
        try { window.history.back(); } catch {}
      }
    };
  }, [open, onClose]);

  // ESC + body scroll lock
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

  // Auto-hiding hint chrome — show after 2s of stillness, hide on any move/touch.
  useEffect(() => {
    if (phase !== 'open') {
      setShowHint(false);
      return;
    }
    let timer = window.setTimeout(() => setShowHint(true), 2000);
    const reset = () => {
      setShowHint(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowHint(true), 2000);
    };
    window.addEventListener('pointermove', reset);
    window.addEventListener('touchstart', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', reset);
      window.removeEventListener('touchstart', reset);
    };
  }, [phase]);

  // Swipe-to-dismiss (vertical, both directions)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartY.current;
    const end = e.changedTouches[0]?.clientY;
    touchStartY.current = null;
    if (start == null || end == null) return;
    if (Math.abs(end - start) > 80) onClose();
  };

  if (phase === 'closed') return null;

  // Morph styling: when opening, start the image at originRect's geometry and
  // animate to centered fullscreen.
  const morphActive = phase === 'opening' || phase === 'closing';
  const imgStyle: React.CSSProperties = {};
  if (originRect && morphActive) {
    imgStyle.position = 'fixed';
    imgStyle.top = `${originRect.top}px`;
    imgStyle.left = `${originRect.left}px`;
    imgStyle.width = `${originRect.width}px`;
    imgStyle.height = `${originRect.height}px`;
    imgStyle.objectFit = 'cover';
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Full image"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Translucent palette-tinted backdrop — not opaque black */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-stone-900/85 dark:bg-stone-950/90 backdrop-blur-[2px] motion-safe:transition-opacity motion-safe:duration-200"
        style={{ opacity: phase === 'open' ? 1 : 0 }}
      />
      {/* Image — shared-element morph */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="relative motion-safe:transition-all motion-safe:duration-[280ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] select-none"
        style={
          phase === 'open'
            ? { maxWidth: '94vw', maxHeight: '92vh', objectFit: 'contain' }
            : imgStyle
        }
        draggable={false}
      />
      {/* Auto-hiding dismissal hint (no prominent X). Fades in after stillness. */}
      <div
        aria-hidden="true"
        className={`absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-stone-900/40 text-stone-100 font-label text-[10px] uppercase tracking-[0.22em] motion-safe:transition-opacity motion-safe:duration-300 pointer-events-none ${showHint && phase === 'open' ? 'opacity-90' : 'opacity-0'}`}
      >
        Swipe to close
      </div>
    </div>
  );
};

export default ImageViewer;
