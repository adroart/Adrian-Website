
import React from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../types';
import ArtImage from './ArtImage';
import { formatPrice } from '../utils/formatPrice';
import { ulAltText, ulCardNumber } from '../utils/universalLanguage';
import SaveToCollectionButton from './account/SaveToCollectionButton';
import { piecePath } from '../utils/pieceSlug';

interface GalleryTileCardProps {
    art: Artwork;
    /** Show availability badge, price, and richer metadata. Used on subcategory pages. */
    showDetails?: boolean;
    /** Override the subtitle line (defaults to art.category). */
    subtitleOverride?: string;
}

/**
 * Shared gallery tile card - refined design with:
 * - No hard borders (shadow-based depth on hover)
 * - Hover overlay with visual cue
 * - Stacked price below title for readability
 * - Structured metadata layout
 * - Consistent availability indicators
 */
const GalleryTileCard: React.FC<GalleryTileCardProps> = ({ art, showDetails, subtitleOverride }) => {
    const variants = art.sizeVariants ?? art.madeToOrderSizes;
    const highPrice = variants && variants.length > 0 ? Math.max(...variants.map(v => v.price)) : null;
    const showRange = highPrice != null && art.price != null && highPrice !== art.price;

    const isSquare = art.series === 'Universal Language' || Boolean(art.dimensions?.toLowerCase().includes('square'));

    // Split number suffix from title (e.g., "Art of Living - 32" → "Art of Living" + "32")
    const titleMatch = art.title.match(/^(.+?)\s*-\s*(\d+)$/);
    const displayTitle = titleMatch ? titleMatch[1] : art.title;
    const pieceNumber = titleMatch ? titleMatch[2] : null;

    return (
        <div className="group break-inside-avoid mb-6 sm:mb-8 lg:mb-10 transition-all duration-500 touch-active">
            {/* Image - links to the piece */}
            <Link to={piecePath(art)} className={`block overflow-hidden relative bg-wood-100 border border-wood-200 group-hover:border-bronze-400 group-focus-within:border-bronze-400 transition-colors duration-500 ${isSquare ? 'aspect-square' : ''}`}>
                <ArtImage
                    publicId={art.coverImage}
                    alt={art.series === 'Universal Language' ? ulAltText(art, ulCardNumber(art.coverImage)) : `${art.title} by Adrian Rasmussen`}
                    variant={isSquare ? 'tile' : 'gallery'}
                    className={isSquare ? '!object-contain' : ''}
                    loading="lazy"
                />

                {/* No overlay, no pill, nothing laid over the artwork — the house rule
                    is that the work is never covered. Hover is signalled by the frame
                    warming instead, on the border and the label band below. */}
            </Link>

            {/* Title plaque - sits between image and detail box like a gallery label */}
            {/* Title plaque - sits between image and detail box like a gallery label */}
            <Link to={piecePath(art)} className="block py-2 text-center">
                <h3 className="font-sans text-base sm:text-lg text-wood-900 hover:text-bronze-700 transition-colors font-medium leading-snug line-clamp-2 min-h-[2.75rem] sm:min-h-[3.1rem] flex items-center justify-center">
                    {displayTitle}
                </h3>
            </Link>

            {/* Detail band - entire tag links to piece, centered like a gallery label */}
            <div className="relative">
            <Link to={piecePath(art)} className="block bg-paper-100 border border-wood-200 pt-2 pb-2 px-3 sm:pb-3 sm:px-4 text-center hover:border-bronze-300 transition-colors">
                {/* Category / Series label + piece number */}
                <p className="font-label text-[11px] sm:text-[12px] uppercase tracking-[0.1em] text-wood-700 font-semibold leading-[1.45] text-balance">
                    {subtitleOverride || art.category}
                    {pieceNumber && <span className="text-wood-600"> &middot; {pieceNumber}</span>}
                </p>

                {/* Detail mode: price + status */}
                {showDetails && (
                    <div className="mt-1.5">
                        {art.price != null && art.availability !== 'SOLD' && (
                            <span className="font-sans text-base text-wood-700 font-medium">
                                {formatPrice(art.price)}
                                {showRange && (
                                    <span className="text-wood-600 font-light"> to {formatPrice(highPrice!)}</span>
                                )}
                            </span>
                        )}
                        {art.availability === 'SOLD' && (
                            <span className="font-sans text-sm text-wood-700 font-medium">Sold</span>
                        )}
                        {/* Status line */}
                        {(art.availability === 'READY_TO_SHIP' || art.availability === 'MADE_TO_ORDER' || (variants && variants.length > 1)) && (
                            <p className="mt-1 font-label text-[10px] uppercase tracking-[0.12em] text-wood-600 font-semibold">
                                {art.availability === 'READY_TO_SHIP' && 'Ready to ship'}
                                {art.availability === 'MADE_TO_ORDER' && !variants?.some(v => v.availability === 'IN_STOCK') && 'Made to order'}
                                {variants && variants.length > 1 && (
                                    <span>
                                        {(art.availability === 'READY_TO_SHIP' || (art.availability === 'MADE_TO_ORDER' && !variants?.some(v => v.availability === 'IN_STOCK'))) && ' · '}
                                        {variants.length} sizes
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                )}

                {/* Minimal price for non-detail mode */}
                {!showDetails && art.price != null && art.availability !== 'SOLD' && (
                    <span className="block mt-1.5 font-sans text-sm text-wood-700">
                        {formatPrice(art.price)}
                        {showRange && (
                            <span className="text-wood-600 font-light"> to {formatPrice(highPrice!)}</span>
                        )}
                    </span>
                )}
            </Link>

            {/* Save sits inside the detail band, top right — in the gutter under the
                artwork, never over it, and outside the card's Link so the two
                controls do not nest. It used to be an outlined text button in its
                own box below every tile, which made a column of cards read as a
                row of forms and put the save affordance in competition with the
                work. */}
            {showDetails && (
                <SaveToCollectionButton kind="artwork" itemRef={art.id} label="Save to collection" variant="icon" />
            )}
            </div>
        </div>
    );
};

export default GalleryTileCard;
