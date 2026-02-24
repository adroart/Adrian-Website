
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Artwork } from '../types';
import { CREATION_CATEGORIES } from '../data/mockData';

/** Resolve a category label to its browse URL */
function getCategoryLink(category: string): string {
    const cat = CREATION_CATEGORIES.find(c => c.label === category);
    if (cat && 'link' in cat && (cat as { link?: string }).link) {
        return (cat as { link?: string }).link!;
    }
    return `/creations?category=${encodeURIComponent(category)}`;
}

/**
 * Shared gallery tile card — image at natural aspect ratio + label band.
 * Clicking the card navigates to the piece page.
 * Clicking the category label navigates to that category's browse page.
 */
const GalleryTileCard: React.FC<{ art: Artwork }> = ({ art }) => {
    const navigate = useNavigate();
    const categoryLink = getCategoryLink(art.category);

    return (
        <Link
            to={`/creations/${art.id}`}
            className="group cursor-pointer break-inside-avoid mb-3 sm:mb-4 lg:mb-5 block border border-wood-200 bg-white transition-all duration-500 hover:shadow-lg hover:border-wood-300"
        >
            {/* Image — natural aspect ratio, no overlay */}
            <div className="overflow-hidden">
                <img
                    src={art.coverImage}
                    alt={`${art.title} by Adrian Rasmussen`}
                    className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.03]"
                    loading="lazy"
                />
            </div>
            {/* Label band — tinted background, inside the card border */}
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-paper-100 border-t border-wood-100">
                <h3 className="font-serif text-sm sm:text-base text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                    {art.title}
                </h3>
                <span
                    className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-wood-400 font-semibold mt-1 block leading-none hover:text-bronze-600 transition-colors"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(categoryLink);
                    }}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(categoryLink);
                        }
                    }}
                >
                    {art.category}
                </span>
            </div>
        </Link>
    );
};

export default GalleryTileCard;
