
import React, { useMemo, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import { Artwork } from '../types';

const SeriesPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);

    // Convert slug back to series name
    const seriesName = useMemo(() => {
        if (!slug) return null;
        const series = SERIES_DATA.find(
            s => s.name.toLowerCase().replace(/\s+/g, '-') === slug
        );
        return series?.name || null;
    }, [slug]);

    const seriesInfo = useMemo(() => {
        if (!seriesName) return null;
        return SERIES_DATA.find(s => s.name === seriesName) || null;
    }, [seriesName]);

    const seriesPieces = useMemo(() => {
        if (!seriesName) return [];
        let pieces = FULL_ARCHIVE.filter(a => a.series === seriesName);
        if (showAvailableOnly) {
            pieces = pieces.filter(a => a.availability === 'READY_TO_SHIP');
        }
        return pieces;
    }, [seriesName, showAvailableOnly]);

    // All series for the "other series" section
    const otherSeries = useMemo(() => {
        return SERIES_DATA.filter(s => s.name !== seriesName);
    }, [seriesName]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    if (!seriesInfo) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Series Not Found</h1>
                    <p className="font-serif text-lg text-wood-600 mb-8">The series you're looking for doesn't exist.</p>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 pb-1"
                    >
                        <ArrowRight size={14} className="rotate-180" /> Back to Creations
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">
            {/* Hero */}
            <div className="relative w-full h-[50vh] min-h-[400px] max-h-[600px] overflow-hidden">
                <img
                    src={seriesInfo.image}
                    alt={`${seriesInfo.name} series by Adrian Rasmussen`}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/30 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 max-w-7xl mx-auto">
                    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper-200 font-bold mb-4">
                        <Link to="/creations" className="hover:text-paper-50 transition-colors">
                            Creations
                        </Link>
                        <span className="text-paper-300/50">/</span>
                        <span className="text-paper-50">Series</span>
                    </div>
                    <h1 className="font-serif text-5xl md:text-7xl text-paper-50 mb-4 font-medium">
                        {seriesInfo.name}
                    </h1>
                    <p className="font-serif text-xl md:text-2xl text-paper-200 max-w-2xl font-light leading-relaxed">
                        {seriesInfo.description}
                    </p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-6 border-b border-wood-200 flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">
                        {seriesPieces.length} {seriesPieces.length === 1 ? 'Piece' : 'Pieces'}
                    </span>
                </div>
                <button
                    onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                    className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${showAvailableOnly ? 'text-bronze-600' : 'text-wood-500 hover:text-wood-900'}`}
                >
                    {showAvailableOnly ? 'Showing Available' : 'Show Available Only'}
                </button>
            </div>

            {/* Pieces Grid */}
            <div className="max-w-[1800px] mx-auto px-6">
                {seriesPieces.length > 0 ? (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                        {seriesPieces.map((art) => (
                            <Link
                                key={art.id}
                                to={`/creations/${art.id}`}
                                className="group break-inside-avoid mb-8 block"
                            >
                                <div className="relative overflow-hidden bg-wood-50 border border-wood-200 transition-shadow duration-500 group-hover:shadow-lg">
                                    <img
                                        src={art.coverImage}
                                        alt={`${art.title} by Adrian Rasmussen`}
                                        loading="lazy"
                                        className="w-full h-auto object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                                    />
                                    {art.availability === 'READY_TO_SHIP' && (
                                        <div className="absolute top-3 right-3 bg-paper-50/90 backdrop-blur px-2 py-1 text-[9px] font-mono uppercase tracking-widest border border-wood-200 text-avail-ready font-medium">
                                            Ready to ship
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 px-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-serif text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-tight max-w-[75%]">
                                            {art.title}
                                        </h4>
                                        {art.price && (
                                            <span className="font-mono text-xs text-wood-900 font-bold">
                                                {art.availability === 'MADE_TO_ORDER' && 'From '}${art.price}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-mono text-[10px] text-wood-500 uppercase tracking-widest mt-1 font-bold">
                                        {art.category}{art.availability === 'SOLD' && <span className="text-avail-sold"> · Sold</span>}{art.availability === 'MADE_TO_ORDER' && <span className="text-avail-order"> · Made to order</span>}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24">
                        <p className="font-serif text-xl text-wood-500 italic">
                            {showAvailableOnly
                                ? 'No available pieces in this series at the moment.'
                                : 'No pieces in this series yet.'}
                        </p>
                        {showAvailableOnly && (
                            <button
                                onClick={() => setShowAvailableOnly(false)}
                                className="mt-4 font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold"
                            >
                                Show all pieces
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Other Series */}
            {otherSeries.length > 0 && (
                <div className="max-w-[1800px] mx-auto px-6 mt-32">
                    <div className="border-t border-wood-200 pt-12 mb-12">
                        <h2 className="font-serif text-3xl text-wood-900 font-medium">Other Series</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {otherSeries.map((series) => {
                            const seriesSlug = series.name.toLowerCase().replace(/\s+/g, '-');
                            const pieceCount = FULL_ARCHIVE.filter(a => a.series === series.name).length;
                            return (
                                <Link
                                    key={series.id}
                                    to={`/series/${seriesSlug}`}
                                    className="group relative aspect-[2/1] bg-wood-100 overflow-hidden"
                                >
                                    <img
                                        src={series.image}
                                        alt={`${series.name} series by Adrian Rasmussen`}
                                        loading="lazy"
                                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[1.5s] ease-out group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent opacity-100 group-hover:opacity-90 transition-opacity" />
                                    <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                                        <h3 className="font-serif text-2xl md:text-3xl text-paper-50 mb-1 font-medium">
                                            {series.name}
                                        </h3>
                                        <p className="font-serif text-sm text-paper-200 font-light">
                                            {series.description}
                                        </p>
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-paper-300 font-bold mt-2">
                                            {pieceCount} {pieceCount === 1 ? 'Piece' : 'Pieces'}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
};

export default SeriesPage;
