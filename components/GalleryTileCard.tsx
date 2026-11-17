import React from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { piecePath } from '../utils/pieceSlug';
import { GalleryPhoto } from './gallery/GalleryDisplay';
import SaveToCollectionButton from './account/SaveToCollectionButton';

interface GalleryTileCardProps {
    art: Artwork;
    showDetails?: boolean;
    subtitleOverride?: string;
    /** Selected works only carry the name and number. */
    selected?: boolean;
}

const GalleryTileCard: React.FC<GalleryTileCardProps> = ({ art, showDetails, subtitleOverride, selected }) => {
    const variants = art.sizeVariants ?? art.madeToOrderSizes;
    const highPrice = variants?.length ? Math.max(...variants.map(variant => variant.price)) : null;
    const titleMatch = art.title.match(/^(.+?)\s*-\s*(\d+)$/);
    const displayTitle = titleMatch?.[1] ?? art.title;
    const pieceNumber = titleMatch?.[2];
    const subtitle = subtitleOverride ?? art.series ?? art.category;
    const status = art.availability === 'READY_TO_SHIP' ? 'Ready to ship'
        : art.availability === 'MADE_TO_ORDER' && !variants?.some(variant => variant.availability === 'IN_STOCK') ? 'Made to order'
        : null;
    const sizes = variants && variants.length > 1 ? `${variants.length} sizes` : null;

    return (
        <div className="gallery-tile">
            <Link to={piecePath(art)} className="gallery-tile-link">
                <GalleryPhoto art={art} />
                <h3 className="gallery-tile-title">{displayTitle}</h3>
            </Link>
            <div className={`gallery-tile-meta relative${showDetails ? ' gallery-tile-meta-save' : ''}`}>
                <p className="gallery-tile-label">
                    {selected && pieceNumber ? `No. ${pieceNumber}` : <>{subtitle}{pieceNumber && ` · ${pieceNumber}`}</>}
                </p>
                {!selected && (
                    <p className="gallery-tile-price">
                        {art.availability === 'SOLD' ? 'Sold'
                            : art.price != null ? (
                                <>
                                    {formatPrice(art.price)}
                                    {highPrice != null && highPrice !== art.price && ` to ${formatPrice(highPrice)}`}
                                </>
                            ) : null}
                    </p>
                )}
                {showDetails && (status || sizes) && (
                    <p className="gallery-tile-label">{[status, sizes].filter(Boolean).join(' · ')}</p>
                )}
                {showDetails && <SaveToCollectionButton kind="artwork" itemRef={art.id} label="Save to collection" variant="icon" />}
            </div>
        </div>
    );
};

export default GalleryTileCard;
