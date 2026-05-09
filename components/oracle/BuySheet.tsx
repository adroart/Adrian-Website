import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Artwork, SizeVariant } from '../../types';

const formatPrice = (n?: number) => (typeof n === 'number' ? `$${n.toLocaleString()}` : '');

const variantAvailabilityLabel = (a: SizeVariant['availability']) =>
  a === 'IN_STOCK' ? 'Ready to ship' : 'Made to order';

/**
 * Acquire pane for an oracle card's physical piece.
 *
 * Bottom sheet on mobile, centred panel on desktop. Shows the piece
 * thumbnail, brief specs, and every available size variant inline so the
 * reader can pick a size before navigating out. The actual checkout still
 * lives on the piece page (/creations/<id>) — committing to buy means
 * leaving the reading flow, but each navigation passes oracleOrigin in
 * router state so the piece page can offer a one-tap return.
 *
 * Dismissal: scrim tap, ESC, browser back (history entry pushed on open).
 * Reading position underneath is preserved.
 */
export const BuySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  piece: Artwork | null;
  /** Cloudinary URL for the artwork thumbnail shown inside the sheet. */
  imageUrl: string;
  imageAlt: string;
  cardName: string;
  cardNumber: number;
}> = ({ open, onClose, piece, imageUrl, imageAlt, cardName, cardNumber }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // ESC + body scroll lock. Browser-back dismiss removed because the
  // pushState marker raced with React Router's navigate() when the
  // reader tapped a variant link, swallowing the navigation. Scrim and
  // ESC dismiss are sufficient.
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

  // Origin URL passed via router state so the piece page can render a
  // "back to your oracle reading" link.
  const oracleOrigin = location.pathname + (location.search || '');

  const variants: SizeVariant[] = piece?.sizeVariants ?? piece?.madeToOrderSizes ?? [];
  const sold = piece?.availability === 'SOLD';
  const ready = piece?.availability === 'READY_TO_SHIP';
  const pieceHref = piece ? `/creations/${piece.id}` : null;

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
      {/* Sheet body — color tokens auto-invert via CSS vars in dark mode. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-paper-100 border-t sm:border border-wood-300/60 sm:rounded-md shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:shadow-[0_18px_60px_rgba(0,0,0,0.45)] motion-safe:animate-[buysheet-rise_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="block w-10 h-1 rounded-full bg-wood-300/70" aria-hidden="true" />
        </div>

        <div className="px-6 pt-4 pb-6">
          {/* Header */}
          <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500">Code {cardNumber}</p>
          <h2 className="font-serif text-[26px] leading-[1.15] text-wood-900 mt-1">{cardName}</h2>

          {/* Thumbnail + specs */}
          <div className="mt-5 flex gap-4">
            <img
              src={imageUrl}
              alt={imageAlt}
              className="w-24 h-24 object-cover border border-wood-300/40 flex-shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              {piece?.dimensions && (
                <p className="font-sans text-[13px] text-wood-700 leading-[1.45]">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Dimensions</span>
                  <br />{piece.dimensions}
                </p>
              )}
              {piece?.material && (
                <p className="font-sans text-[13px] text-wood-700 leading-[1.45] mt-2">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Material</span>
                  <br />{piece.material}
                </p>
              )}
              {piece?.edition && (
                <p className="font-sans text-[13px] text-wood-700 leading-[1.45] mt-2">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Edition</span>
                  <br />{piece.edition}
                </p>
              )}
            </div>
          </div>

          {piece?.description && (
            <p className="font-serif text-[14px] text-wood-700 italic leading-[1.55] mt-4">
              {piece.description}
            </p>
          )}

          {/* Acquisition options. Programmatic navigate (not <Link>) so the
              navigation runs regardless of any onClose-driven re-render of
              this dialog — the previous Link/onClick combo was racing the
              setBuyOpen update and silently dropping the click. */}
          <div className="mt-6">
            {piece && variants.length > 0 && (
              <>
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mb-2">
                  Available sizes
                </p>
                <div className="space-y-2">
                  {variants.map((v) => (
                    <button
                      key={v.size}
                      type="button"
                      onClick={() => {
                        navigate(pieceHref!, { state: { oracleOrigin, preferredSize: v.size } });
                        onClose();
                      }}
                      className="group flex items-center justify-between gap-4 px-4 py-3 w-full text-left bg-paper-50 hover:bg-bronze-50/60 border border-wood-300/60 hover:border-bronze-300/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-serif text-[15px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                          {v.size}
                          {typeof v.price === 'number' && (
                            <span className="text-wood-500"> · {formatPrice(v.price)}</span>
                          )}
                        </p>
                        <p className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 mt-1">
                          {variantAvailabilityLabel(v.availability)}
                        </p>
                      </div>
                      <span className="font-serif text-[18px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {piece && variants.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  navigate(pieceHref!, { state: { oracleOrigin } });
                  onClose();
                }}
                className="group flex items-center justify-between gap-4 px-5 py-4 w-full text-left bg-paper-50 hover:bg-bronze-50/60 border border-wood-300/60 hover:border-bronze-300/70 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-serif text-[16px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                    {sold ? 'View the piece' : 'Acquire the original'}
                  </p>
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1">
                    {sold
                      ? 'Sold · view archive'
                      : ready
                        ? `Ready to ship${typeof piece.price === 'number' ? ` · ${formatPrice(piece.price)}` : ''}`
                        : `Made to order${typeof piece.price === 'number' ? ` · from ${formatPrice(piece.price)}` : ''}`}
                  </p>
                </div>
                <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
              </button>
            )}

            {/* Commission — quieter secondary option */}
            <button
              type="button"
              onClick={() => {
                navigate('/inquire', { state: { oracleOrigin } });
                onClose();
              }}
              className="group block w-full mt-3 px-4 py-3 text-center font-serif text-[14px] text-wood-700 hover:text-bronze-700 border-t border-wood-300/40 transition-colors"
            >
              Or commission a related piece <span className="text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
            </button>
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
