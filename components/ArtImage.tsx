
import React, { useState } from 'react';
import { img, srcset } from '../utils/cloudinary';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DESIGN TOKENS — the single source of truth for all art image styling.
// Change a value here and every gallery/card image on the site updates.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** How much images scale on card hover */
const HOVER_SCALE = 'group-hover:scale-[1.03]';

/** Shared transition — governs both hover zoom and load fade */
const TRANSITION  = 'transition-all duration-700 ease-out';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VARIANTS — how the image sizes within its container
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ArtVariant = 'gallery' | 'tile' | 'product' | 'cover';

const VARIANT_CLASSES: Record<ArtVariant, string> = {
    /** Natural aspect ratio — masonry / waterfall grids (GalleryTileCard) */
    gallery: 'w-full h-auto block',
    /** Forced square — category tiles, subcategory tiles */
    tile:    'w-full aspect-square object-cover',
    /** Fills a fixed-height or aspect-ratio parent — product cards, story cards */
    product: 'w-full h-full object-cover',
    /** Absolutely fills parent — CollectionCard overlays, hero backgrounds */
    cover:   'absolute inset-0 w-full h-full object-cover',
};

// Only fade in on variants whose container already reserves its dimensions.
// 'gallery' is excluded to avoid masonry column height jumping before load.
const FADE_ON_LOAD: Set<ArtVariant> = new Set(['tile', 'product', 'cover']);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ArtImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'className'> {
    /** Visual context — controls sizing classes. Default: 'gallery' */
    variant?: ArtVariant;
    /** Renders grayscale on large screens; color reveals on hover.
     *  Used for inactive collection filter cards. */
    inactive?: boolean;
    /** Extra Tailwind classes to merge in (e.g. 'grayscale' for unavailable products) */
    className?: string;
    /** Cloudinary Public ID. If provided, generates optimized src + srcSet automatically. */
    publicId?: string;
}

/**
 * ArtImage — unified image component for all gallery and card contexts.
 *
 * Use this instead of a raw <img> in any artwork/product card.
 * Changing the DESIGN TOKENS at the top of this file updates the entire site.
 */
/** Responsive widths per variant — smaller variants get fewer/smaller breakpoints */
const VARIANT_WIDTHS: Record<ArtVariant, number[]> = {
    gallery: [400, 800, 1200],
    tile:    [300, 600],
    product: [400, 800],
    cover:   [800, 1200, 1800],
};

const VARIANT_SIZES: Record<ArtVariant, string> = {
    gallery: '(max-width: 768px) 100vw, 50vw',
    tile:    '(max-width: 768px) 50vw, 25vw',
    product: '(max-width: 768px) 100vw, 50vw',
    cover:   '100vw',
};

const ArtImage: React.FC<ArtImageProps> = ({
    variant = 'gallery',
    inactive = false,
    className = '',
    publicId,
    onLoad: externalOnLoad,
    ...rest
}) => {
    const hasFade = FADE_ON_LOAD.has(variant);
    // Gallery starts fully visible (no fade); fixed-container variants start hidden
    const [loaded, setLoaded] = useState(!hasFade);

    // If publicId is provided, generate Cloudinary URLs with responsive srcSet
    const resolvedSrc = publicId
        ? img(publicId, { w: VARIANT_WIDTHS[variant][1] ?? 800 })
        : rest.src;
    const resolvedSrcSet = publicId
        ? srcset(publicId, VARIANT_WIDTHS[variant])
        : rest.srcSet;
    const resolvedSizes = publicId
        ? (rest.sizes ?? VARIANT_SIZES[variant])
        : rest.sizes;

    return (
        <img
            {...rest}
            src={resolvedSrc}
            srcSet={resolvedSrcSet}
            sizes={resolvedSizes}
            onLoad={(e) => {
                setLoaded(true);
                externalOnLoad?.(e);
            }}
            className={[
                VARIANT_CLASSES[variant],
                TRANSITION,
                HOVER_SCALE,
                hasFade ? (loaded ? 'opacity-100' : 'opacity-0') : '',
                inactive ? 'sm:grayscale sm:group-hover:grayscale-0' : '',
                className,
            ].filter(Boolean).join(' ')}
        />
    );
};

export default ArtImage;
