import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Artwork } from '../../types';

const formatPrice = (n?: number) => (typeof n === 'number' ? `$${n.toLocaleString()}` : '');

/**
 * Acquire pane for an oracle card's physical piece.
 *
 * Two paths, no quick-buys:
 *   1. Configure & acquire — opens the piece page where the reader picks
 *      size, finish, illumination, gemstones, and any other add-ons before
 *      committing. We don't surface size variants in the sheet itself
 *      because acquiring a piece without picking the rest of the
 *      configuration would never be a complete order.
 *   2. Commission a custom piece — routes to /inquire so Adrian can work
 *      with the buyer on a unique work.
 *
 * Both navigations carry oracleOrigin in router state so the destination
 * page can offer a one-tap return to the reading.
 */
export const BuySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  piece: Artwork | null;
  imageUrl: string;
  imageAlt: string;
  cardName: string;
  cardNumber: number;
}> = ({ open, onClose, piece, imageUrl, imageAlt, cardName, cardNumber }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Auto-close once the URL actually changes (the reader tapped a Link).
  // This runs strictly *after* React Router commits the navigation, so
  // there's no race between setBuyOpen(false) and the click handler.
  const lastPathRef = useRef(location.pathname);
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      if (open) onClose();
    }
  }, [location.pathname, open, onClose]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    setTimeout(() => dialogRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const oracleOrigin = location.pathname + (location.search || '');
  const pieceHref = piece ? `/creations/${piece.id}` : null;
  const sold = piece?.availability === 'SOLD';

  // Compose the configure-CTA's secondary line: "from $X · sizes & add-ons"
  // when there are variants, otherwise just price + availability.
  const variantCount = (piece?.sizeVariants?.length ?? piece?.madeToOrderSizes?.length ?? 0);
  const lowestPrice = (() => {
    if (typeof piece?.price === 'number') return piece.price;
    const variants = piece?.sizeVariants ?? piece?.madeToOrderSizes ?? [];
    const prices = variants.map(v => v.price).filter((n): n is number => typeof n === 'number');
    return prices.length > 0 ? Math.min(...prices) : undefined;
  })();
  const configureSubtitle = sold
    ? 'Sold · view archive'
    : variantCount > 0
      ? `From ${formatPrice(lowestPrice)} · pick size, finish, illumination`
      : (typeof lowestPrice === 'number' ? `${formatPrice(lowestPrice)} · pick finish & options` : 'Pick finish & options');

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Acquire ${cardName}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/65 backdrop-blur-[2px] motion-safe:animate-[buysheet-fade_180ms_ease-out]"
      />
      {/* Sheet body — explicit z-10 so the scrim never wins hit-testing
          for the Links inside. Color tokens auto-invert in dark mode via
          CSS vars; no `dark:` overrides needed. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-paper-100 border-t sm:border border-wood-300/60 sm:rounded-md shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:shadow-[0_18px_60px_rgba(0,0,0,0.45)] motion-safe:animate-[buysheet-rise_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="block w-10 h-1 rounded-full bg-wood-300/70" aria-hidden="true" />
        </div>

        <div className="px-6 pt-4 pb-6">
          <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500">Code {cardNumber}</p>
          <h2 className="font-serif text-[26px] leading-[1.15] text-wood-900 mt-1">{cardName}</h2>

          {/* Specs row */}
          <div className="mt-5 flex gap-4">
            <img
              src={imageUrl}
              alt={imageAlt}
              className="w-24 h-24 object-cover border border-wood-300/40 flex-shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              {piece?.dimensions && (
                <p className="font-sans text-[13px] text-wood-700 leading-[1.4]">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Dimensions</span>
                  <br />{piece.dimensions}
                </p>
              )}
              {piece?.material && (
                <p className="font-sans text-[13px] text-wood-700 leading-[1.4]">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Material</span>
                  <br />{piece.material}
                </p>
              )}
            </div>
          </div>

          {piece?.description && (
            <p className="font-serif text-[14px] text-wood-700 italic leading-[1.55] mt-4">
              {piece.description}
            </p>
          )}

          {/* Two paths: configure & acquire, or commission. Plain <Link>s
              with no onClick — the location-change effect above closes the
              sheet once React Router has committed the navigation. */}
          <div className="mt-6 space-y-3">
            {pieceHref && !sold && (
              <Link
                to={pieceHref}
                state={{ oracleOrigin, openConfigurator: true }}
                className="group block bg-paper-50 hover:bg-bronze-50/60 border border-bronze-400/50 hover:border-bronze-500/70 transition-colors"
              >
                <div className="h-[2px] w-full bg-bronze-500 group-hover:bg-bronze-400 motion-safe:transition-colors" aria-hidden="true" />
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-serif text-[17px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                      Configure &amp; acquire this piece
                    </p>
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1.5">
                      {configureSubtitle}
                    </p>
                  </div>
                  <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
                </div>
              </Link>
            )}

            {pieceHref && sold && (
              <Link
                to={pieceHref}
                state={{ oracleOrigin }}
                className="group block bg-paper-50 hover:bg-paper-200 border border-wood-300/60 transition-colors"
              >
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-serif text-[17px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                      View the archived piece
                    </p>
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1.5">
                      Sold · or commission a related piece below
                    </p>
                  </div>
                  <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
                </div>
              </Link>
            )}

            <Link
              to="/inquire"
              state={piece
                ? { oracleOrigin, piece: piece.title, pieceId: piece.id }
                : { oracleOrigin, piece: cardName }}
              className="group block bg-paper-50 hover:bg-bronze-50/60 border border-wood-300/60 hover:border-bronze-400/60 transition-colors"
            >
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-serif text-[17px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                    Commission a custom piece
                  </p>
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1.5">
                    Work with Adrian on a unique work for your space
                  </p>
                </div>
                <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
              </div>
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
