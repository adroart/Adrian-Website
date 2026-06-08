
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { img as cldImg } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';

const WorksPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const artwork = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);

    useMetaTags(
        artwork
            ? { title: `${artwork.title} — Adrian Rasmussen`, description: artwork.description }
            : { title: 'Work Not Found — Adrian Rasmussen' }
    );

    if (!artwork) {
        return (
            <section className="min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
                <div className="max-w-xl text-center">
                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 block mb-6 font-semibold">
                        Works Registry
                    </span>
                    <h1 className="font-serif text-4xl md:text-5xl text-wood-900 mb-6 font-medium">
                        Work Not Found
                    </h1>
                    <p className="font-sans text-base text-wood-600 mb-12 leading-[1.7]">
                        No record exists for this identifier. If you scanned a QR code and reached
                        this page, the piece may not yet be registered.
                    </p>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
                    >
                        Browse Creations
                    </Link>
                </div>
            </section>
        );
    }

    const editionDisplay = getEditionLine(artwork);
    const imageUrl = artwork.coverImage
        ? cldImg(artwork.coverImage, { w: 800 })
        : null;

    return (
        <section className="min-h-screen pt-28 pb-32 px-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 block mb-4 font-semibold">
                        Certificate of Authenticity
                    </span>
                    <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-2">
                        {artwork.title}
                    </h1>
                    {artwork.series && (
                        <p className="font-sans text-sm text-wood-500">
                            {artwork.series} Series{' · '}{artwork.id}
                        </p>
                    )}
                    {!artwork.series && (
                        <p className="font-sans text-sm text-wood-500">{artwork.id}</p>
                    )}
                </div>

                {/* Divider */}
                <div className="w-16 h-px bg-bronze-300 mx-auto mb-12" />

                {/* Image */}
                {imageUrl && (
                    <div className="mb-12">
                        <img
                            src={imageUrl}
                            alt={artwork.title}
                            className="w-full max-w-lg mx-auto"
                            loading="eager"
                        />
                    </div>
                )}

                {/* Details */}
                <div className="space-y-6 mb-12">
                    <DetailRow label="Artist" value="Adrian Rasmussen" />
                    <DetailRow label="Year" value={artwork.year} />
                    {artwork.material && <DetailRow label="Materials" value={artwork.material} />}
                    {artwork.dimensions && <DetailRow label="Dimensions" value={artwork.dimensions} />}
                    {editionDisplay && <DetailRow label="Edition" value={editionDisplay} />}
                    {artwork.category && <DetailRow label="Category" value={artwork.category} />}
                </div>

                {/* Divider */}
                <div className="w-16 h-px bg-bronze-300 mx-auto mb-12" />

                {/* Description */}
                {artwork.description && (
                    <div className="mb-12">
                        <p className="font-sans text-base text-wood-700 leading-[1.8] text-center max-w-lg mx-auto">
                            {artwork.longDescription || artwork.description}
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center pt-8 border-t border-wood-100">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-6 font-semibold">
                        adrianrasmussen.com
                    </p>
                    <Link
                        to={`/creations/${artwork.id}`}
                        className="font-sans text-sm text-bronze-600 hover:text-bronze-800 transition-colors underline underline-offset-4"
                    >
                        View full details
                    </Link>
                </div>
            </div>
        </section>
    );
};

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-baseline border-b border-wood-100 pb-3">
            <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold">
                {label}
            </span>
            <span className="font-sans text-sm text-wood-800 text-right max-w-[60%]">
                {value}
            </span>
        </div>
    );
}

function getEditionLine(art: { edition?: string; editionSize?: number; editionNumber?: number; editionSold?: number }): string | null {
    if (art.editionSize) {
        if (art.editionNumber) {
            return `${art.editionNumber} of ${art.editionSize}`;
        }
        return `Edition of ${art.editionSize}`;
    }
    return art.edition || null;
}

export default WorksPage;
