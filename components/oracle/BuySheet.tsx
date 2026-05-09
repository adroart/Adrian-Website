import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Bottom sheet for purchase / commission inquiry. Mobile-first: slides up
 * from the bottom edge. Desktop falls back to a centered modal.
 *
 * Dismissed by:
 * - Tap outside the sheet (scrim)
 * - ESC key
 * - Browser back button (history entry pushed on open)
 *
 * Reading position underneath is preserved.
 */
export const BuySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  pieceHref: string | null;     // /creations/<id> if a physical piece exists
  pieceAvailability?: 'SOLD' | 'READY_TO_SHIP' | string;
  cardName: string;
  cardNumber: number;
}> = ({ open, onClose, pieceHref, pieceAvailability, cardName, cardNumber }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Browser-back-button dismiss: push a history entry on open, listen for popstate.
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const stateMarker = { __buySheet: true, t: Date.now() };
    try { window.history.pushState(stateMarker, ''); } catch {}
    const onPop = () => {
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // If the sheet is closing for a non-back reason and our marker is still on
      // top of the stack, undo it so the history isn't polluted.
      if ((window.history.state as any)?.__buySheet) {
        try { window.history.back(); } catch {}
      }
    };
  }, [open, onClose]);

  // ESC key + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    // Move focus into the sheet
    setTimeout(() => dialogRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sold = pieceAvailability === 'SOLD';
  const available = pieceAvailability === 'READY_TO_SHIP';

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Acquire ${cardName}`}
    >
      {/* Translucent backdrop — palette-tinted so the page is still felt */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/65 dark:bg-stone-950/75 backdrop-blur-[2px] motion-safe:animate-[buysheet-fade_180ms_ease-out]"
      />
      {/* Sheet body */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-md mx-auto bg-paper-50 dark:bg-stone-100 border-t sm:border border-wood-200/70 sm:rounded-md shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:shadow-[0_18px_60px_rgba(0,0,0,0.45)] motion-safe:animate-[buysheet-rise_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Drag handle (visual only — closes via scrim/back/ESC) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="block w-10 h-1 rounded-full bg-wood-300/70" aria-hidden="true" />
        </div>
        <div className="px-6 pt-5 pb-7">
          <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500">Code {cardNumber}</p>
          <h2 className="font-serif text-[26px] leading-[1.15] text-wood-900 mt-1">{cardName}</h2>
          <p className="font-serif text-[14px] text-wood-600 italic leading-[1.5] mt-3">
            One original multi-dimensional wooden sculpture. Unique piece.
          </p>

          <div className="mt-6 space-y-2">
            {pieceHref && (
              <Link
                to={pieceHref}
                onClick={onClose}
                className="group flex items-center justify-between gap-4 px-5 py-4 bg-paper-100 hover:bg-bronze-50/80 border border-wood-200/70 hover:border-bronze-300/70 transition-colors"
              >
                <div>
                  <p className="font-serif text-[16px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                    {sold ? 'View the piece' : 'Acquire the original'}
                  </p>
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1">
                    {sold ? 'Sold · view archive' : available ? 'Available · ready to ship' : 'Physical piece'}
                  </p>
                </div>
                <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
              </Link>
            )}
            <Link
              to="/inquire"
              onClick={onClose}
              className="group flex items-center justify-between gap-4 px-5 py-4 bg-paper-100 hover:bg-bronze-50/80 border border-wood-200/70 hover:border-bronze-300/70 transition-colors"
            >
              <div>
                <p className="font-serif text-[16px] text-wood-900 group-hover:text-bronze-700 leading-tight">Commission a related piece</p>
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1">Inquire with Adrian</p>
              </div>
              <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes buysheet-rise {
          from { transform: translateY(24%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes buysheet-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default BuySheet;
