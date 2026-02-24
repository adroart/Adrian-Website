
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

/**
 * Shared gallery tile card — image at natural aspect ratio + label band.
 * Image + title link to the piece page.
 * Category label links to that category's browse page.
 */
const GalleryTileCard: React.FC<{ art: Artwork }> = ({ art }) => (
    <div className="group break-inside-avoid mb-3 sm:mb-4 lg:mb-5 border border-wood-200 bg-white transition-all duration-500 hover:shadow-lg hover:border-wood-300">
        {/* Image — links to the piece */}
        <Link to={`/creations/${art.id}`} className="block overflow-hidden">
            <img
                src={art.coverImage}
                alt={`${art.title} by Adrian Rasmussen`}
                className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
            />
        </Link>
        {/* Label band */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-paper-100 border-t border-wood-100">
            <Link to={`/creations/${art.id}`}>
                <h3 className="font-serif text-base sm:text-lg text-wood-900 hover:text-bronze-700 transition-colors font-medium leading-snug">
                    {art.title}
                </h3>
            </Link>
            <Link to={CATEGORY_URL_MAP[art.category] || '/creations'} className="mt-1 block">
                <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 hover:text-bronze-500 transition-colors font-semibold leading-none">
                    {art.category}
                </span>
            </Link>
            <p className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold mt-1 leading-none">
                {art.availability === 'SOLD' && <span className="text-avail-sold">Sold</span>}
                {art.availability === 'READY_TO_SHIP' && <span className="text-avail-ready">Ready to ship</span>}
                {art.availability === 'MADE_TO_ORDER' && <span className="text-avail-order">Made to order</span>}
            </p>
        </div>
    </div>
);

export default GalleryTileCard;
