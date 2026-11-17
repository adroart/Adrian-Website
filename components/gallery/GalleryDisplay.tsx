import React from 'react';
import { Link } from 'react-router-dom';
import ArtImage from '../ArtImage';
import { Artwork } from '../../types';
import { ulAltText, ulCardNumber } from '../../utils/universalLanguage';
import { artworkById, artworkSeries, hasWhitePhotoBackdrop } from './galleryContent';
import './publicGallery.css';

export function GalleryPhoto({ art, alt, eager = false }: {
    art: Artwork;
    alt?: string;
    eager?: boolean;
}) {
    const description = art.series === 'Universal Language'
        ? ulAltText(art, ulCardNumber(art.coverImage))
        : `${art.title} by Adrian Rasmussen`;
    return (
        <div className={`gallery-mat${hasWhitePhotoBackdrop(art.coverImage) ? ' gallery-mat-white-backdrop' : ''}`}>
            <ArtImage
                publicId={art.coverImage}
                alt={alt ?? description}
                variant="gallery"
                sizes={eager ? "(max-width: 767px) 100vw, 55vw" : "(max-width: 767px) 50vw, 25vw"}
                loading={eager ? 'eager' : 'lazy'}
            />
        </div>
    );
}

export function SeriesEntrances({ omitUniversal = false }: { omitUniversal?: boolean }) {
    return (
        <div className={`gallery-series-entrances${omitUniversal ? ' gallery-series-entrances-secondary' : ''}`}>
            {artworkSeries.slice(omitUniversal ? 1 : 0).map(series => {
                const lead = artworkById(series.leadId);
                return (
                    <Link key={series.path} to={series.path} className="gallery-series-link">
                        {lead && <GalleryPhoto art={lead} alt="" />}
                        <h3>{series.title}</h3>
                        <p>{series.description}</p>
                    </Link>
                );
            })}
        </div>
    );
}
