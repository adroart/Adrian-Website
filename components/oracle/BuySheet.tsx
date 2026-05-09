import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Artwork } from '../../types';
import PieceConfigurator from '../PieceConfigurator';

/**
 * Acquire pane for an oracle card's physical piece.
 *
 * Variant pieces (size + options) acquire inline: the full configurator
 * wizard renders right inside the sheet so the reader never leaves their
 * reading. A "View full piece" link sits below the wizard for readers who
 * want the deep dive (more images, the story, related works).
 *
 * Sold pieces show a link to the archived piece. Pieces without size
 * variants fall back to the piece page where the existing acquire flow
 * handles RTS / MTO. Commission stays a link to /inquire.
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
  const variants = piece?.sizeVariants ?? piece?.madeToOrderSizes ?? [];
  const hasVariants = variants.length > 0;

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
      {/* Sheet body — wider than the original to give the inline configurator
          room to breathe. Color tokens auto-invert in dark mode via CSS vars. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto bg-paper-100 border-t sm:border border-wood-300/60 sm:rounded-md shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:shadow-[0_18px_60px_rgba(0,0,0,0.45)] motion-safe:animate-[buysheet-rise_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="block w-10 h-1 rounded-full bg-wood-300/70" aria-hidden="true" />
        </div>

        <div className="px-6 sm:px-8 pt-4 pb-6">
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

          {/* Inline acquire — wizard for variant pieces, archive link for sold,
              piece-page link for pieces without variants. The configurator's
              own buy CTA, total, and shipping copy all live inline here so
              the reader never has to leave the sheet to complete the order. */}
          {piece && hasVariants && !sold && (
            <div className="mt-7 pt-6 border-t border-wood-300/50">
              <PieceConfigurator art={piece} />
            </div>
          )}

          {piece && sold && pieceHref && (
            <div className="mt-6">
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
            </div>
          )}

          {piece && !hasVariants && !sold && pieceHref && (
            <div className="mt-6">
              <Link
                to={pieceHref}
                state={{ oracleOrigin, openConfigurator: true }}
                className="group block bg-paper-50 hover:bg-bronze-50/60 border border-bronze-400/50 hover:border-bronze-500/70 transition-colors"
              >
                <div className="h-[2px] w-full bg-bronze-500 group-hover:bg-bronze-400 motion-safe:transition-colors" aria-hidden="true" />
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-serif text-[17px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                      Acquire this piece
                    </p>
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1.5">
                      Continue to the piece page
                    </p>
                  </div>
                  <span className="font-serif text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">→</span>
                </div>
              </Link>
            </div>
          )}

          {/* Footer links: deep dive into the full piece page (more images,
              the story, related works) and a path to commission. The
              configurator's own "Or commission a similar piece" link
              already covers the variant case — this commission link is for
              the sold / fallback flows. */}
          <div className="mt-6 pt-5 border-t border-wood-300/40 flex flex-wrap items-center justify-between gap-3">
            {pieceHref && hasVariants && !sold && (
              <Link
                to={pieceHref}
                state={{ oracleOrigin }}
                className="font-label text-[11px] uppercase tracking-[0.22em] text-bronze-600 hover:text-bronze-500 font-semibold transition-colors"
              >
                View the full piece →
              </Link>
            )}
            {!(hasVariants && !sold) && (
              <Link
                to="/inquire"
                state={piece
                  ? { oracleOrigin, piece: piece.title, pieceId: piece.id }
                  : { oracleOrigin, piece: cardName }}
                className="font-label text-[11px] uppercase tracking-[0.22em] text-bronze-600 hover:text-bronze-500 font-semibold transition-colors"
              >
                Commission a custom piece →
              </Link>
            )}
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
