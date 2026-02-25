
import React from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../types';
import { CREATION_CATEGORIES } from '../data/mockData';

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

    return (
        <div className="group break-inside-avoid mb-6 sm:mb-8 lg:mb-10 transition-all duration-500">
            {/* Image — links to the piece */}
            <Link to={`/creations/${art.id}`} className="block overflow-hidden relative bg-wood-100">
                <img
                    src={art.coverImage}
                    alt={`${art.title} by Adrian Rasmussen`}
                    className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.04]"
                    loading="lazy"
                />

                {/* Hover overlay with "View" prompt */}
                <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/15 transition-all duration-500 flex items-center justify-center">
                    <span className="font-label text-[11px] uppercase tracking-[0.25em] text-paper-50 font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 bg-wood-900/50 backdrop-blur-sm px-5 py-2.5">
                        View
                    </span>
                </div>

                {/* Availability badge — top right */}
                {showDetails && art.availability === 'READY_TO_SHIP' && (
                    <div className="absolute top-3 left-3 bg-paper-50/95 backdrop-blur-sm px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.15em] text-avail-ready font-semibold">
                        Ready to ship
                    </div>
                )}
                {showDetails && art.availability === 'SOLD' && (
                    <div className="absolute top-3 left-3 bg-wood-900/85 backdrop-blur-sm px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.15em] text-paper-50 font-semibold dark-preserve">
                        Sold
                    </div>
                )}
            </Link>

            {/* Label band — clean stacked layout */}
            <div className="pt-3 pb-1 sm:pt-4 sm:pb-2">
                {/* Category / Series label */}
                <Link to={CATEGORY_URL_MAP[art.category] || '/creations'}>
                    <span className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-bronze-500 transition-colors font-semibold leading-none">
                        {subtitleOverride || art.category}
                    </span>
                </Link>

                {/* Title */}
                <Link to={`/creations/${art.id}`} className="block mt-1.5">
                    <h3 className="font-serif text-lg sm:text-xl text-wood-900 hover:text-bronze-700 transition-colors font-medium leading-snug">
                        {art.title}
                    </h3>
                </Link>

                {/* Price + metadata row */}
                {showDetails && (
                    <div className="mt-2 flex items-baseline justify-between gap-3">
                        {/* Price */}
                        {art.price != null && art.availability !== 'SOLD' && (
                            <span className="font-serif text-base text-wood-700 font-medium">
                                ${art.price.toLocaleString('en-US')}
                                {showRange && (
                                    <span className="text-wood-400 font-light"> to ${highPrice!.toLocaleString('en-US')}</span>
                                )}
                            </span>
                        )}
                        {art.availability === 'SOLD' && (
                            <span className="font-serif text-sm text-wood-400 italic">Sold</span>
                        )}

                        {/* Status indicators */}
                        <div className="flex items-center gap-2">
                            {art.availability === 'MADE_TO_ORDER' && !variants?.some(v => v.availability === 'IN_STOCK') && (
                                <span className="font-label text-[10px] uppercase tracking-[0.12em] text-wood-400 font-semibold">
                                    Made to order
                                </span>
                            )}
                            {variants && variants.length > 1 && (
                                <span className="font-label text-[10px] uppercase tracking-[0.12em] text-wood-400 font-semibold">
                                    {variants.length} sizes
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Minimal price for non-detail mode */}
                {!showDetails && art.price != null && art.availability !== 'SOLD' && (
                    <span className="block mt-1.5 font-serif text-sm text-wood-500">
                        ${art.price.toLocaleString('en-US')}
                    </span>
                )}
            </div>
        </div>
    );
};

export default GalleryTileCard;
