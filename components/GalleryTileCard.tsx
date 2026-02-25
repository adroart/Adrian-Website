
import React from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../types';
import { CREATION_CATEGORIES } from '../data/mockData';
import ArtImage from './ArtImage';

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
 * Shared gallery tile card — image at natural aspect ratio + label band.
 * Image + title link to the piece page.
 * Category label links to that category's browse page.
 */
const GalleryTileCard: React.FC<GalleryTileCardProps> = ({ art, showDetails, subtitleOverride }) => (
    <div className="group break-inside-avoid mb-5 sm:mb-6 lg:mb-8 bg-paper-100 border border-wood-200 transition-all duration-500 hover:shadow-lg hover:border-wood-300">
        {/* Image — links to the piece */}
        <Link to={`/creations/${art.id}`} className="block overflow-hidden relative">
            <ArtImage
                src={art.coverImage}
                alt={`${art.title} by Adrian Rasmussen`}
                variant="gallery"
                loading="lazy"
            />
            {/* Availability badge */}
            {showDetails && art.availability === 'READY_TO_SHIP' && (
                <div className="absolute top-3 right-3 bg-paper-50/90 backdrop-blur px-2 py-1 text-[11px] font-label uppercase tracking-[0.15em] border border-wood-200 text-avail-ready font-medium">
                    Ready to ship
                </div>
            )}
            {showDetails && art.availability === 'SOLD' && (
                <div className="absolute top-3 right-3 bg-wood-900/80 backdrop-blur px-2 py-1 text-[11px] font-label uppercase tracking-[0.15em] text-paper-50 font-semibold dark-preserve">
                    Sold
                </div>
            )}
        </Link>
        {/* Label — tight under the photo */}
        <div className="px-2 pt-2 pb-2 sm:px-3 sm:pt-2.5 sm:pb-3">
            <div className="flex justify-between items-start gap-2">
                <Link to={`/creations/${art.id}`} className="min-w-0">
                    <h3 className="font-serif text-base sm:text-lg text-wood-900 hover:text-bronze-700 transition-colors font-medium leading-snug">
                        {art.title}
                    </h3>
                </Link>
                {showDetails && art.price != null && art.availability !== 'SOLD' && (() => {
                    const variants = art.sizeVariants ?? art.madeToOrderSizes;
                    const highPrice = variants && variants.length > 0 ? Math.max(...variants.map(v => v.price)) : null;
                    const showRange = highPrice != null && highPrice !== art.price;
                    return (
                        <span className="font-label text-xs text-wood-900 font-semibold flex-shrink-0 pt-0.5">
                            ${art.price.toLocaleString('en-US')}{showRange && ` to $${highPrice.toLocaleString('en-US')}`}
                        </span>
                    );
                })()}
            </div>
            <div className="flex items-center gap-2 mt-1">
                <Link to={CATEGORY_URL_MAP[art.category] || '/creations'}>
                    <span className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-wood-400 hover:text-bronze-500 transition-colors font-semibold leading-none">
                        {subtitleOverride || art.category}
                    </span>
                </Link>
                {showDetails && art.availability === 'MADE_TO_ORDER' && !art.sizeVariants?.some(v => v.availability === 'IN_STOCK') && (
                    <span className="font-serif text-[11px] text-wood-400 italic leading-none">
                        · Made to order
                    </span>
                )}
                {showDetails && (art.sizeVariants ?? art.madeToOrderSizes) && (art.sizeVariants ?? art.madeToOrderSizes)!.length > 1 && (
                    <span className="font-serif text-[11px] text-wood-400 italic leading-none">
                        · Multiple sizes
                    </span>
                )}
            </div>
        </div>
    </div>
);

export default GalleryTileCard;
