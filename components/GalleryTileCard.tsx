
import React from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../types';
import { CREATION_CATEGORIES } from '../data/mockData';
import ArtImage from './ArtImage';
import { formatPrice } from '../utils/formatPrice';

/** Pre-computed category → URL map */
const CATEGORY_URL_MAP: Record<string, string> = {};
for (const cat of CREATION_CATEGORIES) {
    CATEGORY_URL_MAP[cat.label] = (cat as { link?: string }).link
        ?? `/creations?category=${encodeURIComponent(cat.label)}`;
}

interface GalleryTileCardProps {
    art: Artwork;
    /** Show availability badge, price, and richer metadata. Used on subcategory pages. */
    showDetails?: boolean;
    /** Override the subtitle line (defaults to art.category). */
    subtitleOverride?: string;
}

/**
 * Shared gallery tile card — refined design with:
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

    // Split number suffix from title (e.g., "Art of Living - 32" → "Art of Living" + "32")
    const titleMatch = art.title.match(/^(.+?)\s*-\s*(\d+)$/);
    const displayTitle = titleMatch ? titleMatch[1] : art.title;
    const pieceNumber = titleMatch ? titleMatch[2] : null;

    return (
        <div className="group break-inside-avoid mb-6 sm:mb-8 lg:mb-10 transition-all duration-500 touch-active">
            {/* Image — links to the piece */}
            <Link to={`/creations/${art.id}`} className="block overflow-hidden relative bg-wood-100 border border-wood-200">
                <ArtImage
                    publicId={art.coverImage}
                    alt={`${art.title} by Adrian Rasmussen`}
                    variant="gallery"
                    loading="lazy"
                />

                {/* Hover overlay with "View" prompt */}
                <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/15 group-focus-within:bg-wood-900/15 transition-all duration-500 flex items-center justify-center">
                    <span className="font-label text-[11px] uppercase tracking-[0.25em] text-paper-50 font-semibold opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 translate-y-2 group-hover:translate-y-0 group-focus-within:translate-y-0 transition-all duration-500 bg-wood-900/50 backdrop-blur-sm px-5 py-2.5">
                        View
                    </span>
                </div>
            </Link>

            {/* Title plaque — sits between image and detail box like a gallery label */}
            {/* Title plaque — sits between image and detail box like a gallery label */}
            <Link to={`/creations/${art.id}`} className="block py-2 text-center">
                <h3 className="font-serif text-base sm:text-lg text-wood-900 hover:text-bronze-700 transition-colors font-medium leading-snug">
                    {displayTitle}
                </h3>
            </Link>

            {/* Detail band */}
            <div className="bg-paper-100 border border-wood-200 pt-2 pb-2 px-3 sm:pb-3 sm:px-4">
                {/* Category / Series label + piece number */}
                <div className="flex items-center justify-between">
                    <Link to={CATEGORY_URL_MAP[art.category] || '/creations'}>
                        <span className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-bronze-500 transition-colors font-semibold leading-none">
                            {subtitleOverride || art.category}
                        </span>
                    </Link>
                    {pieceNumber && (
                        <span className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-wood-300 font-semibold leading-none">
                            {pieceNumber}
                        </span>
                    )}
                </div>

                {/* Detail mode: price + status */}
                {showDetails && (
                    <div className="mt-1.5">
                        {art.price != null && art.availability !== 'SOLD' && (
                            <span className="font-serif text-base text-wood-700 font-medium">
                                {formatPrice(art.price)}
                                {showRange && (
                                    <span className="text-wood-400 font-light"> to {formatPrice(highPrice!)}</span>
                                )}
                            </span>
                        )}
                        {art.availability === 'SOLD' && (
                            <span className="font-serif text-sm text-wood-400 italic">Sold</span>
                        )}
                        {/* Status line */}
                        {(art.availability === 'READY_TO_SHIP' || art.availability === 'MADE_TO_ORDER' || (variants && variants.length > 1)) && (
                            <p className="mt-1 font-label text-[10px] uppercase tracking-[0.12em] text-wood-400 font-semibold">
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
                    <span className="block mt-1.5 font-serif text-sm text-wood-500">
                        {formatPrice(art.price)}
                        {showRange && (
                            <span className="text-wood-400 font-light"> to {formatPrice(highPrice!)}</span>
                        )}
                    </span>
                )}
            </div>
        </div>
    );
};

export default GalleryTileCard;
