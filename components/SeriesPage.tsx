
import React, { useMemo, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { ArrowRight } from 'lucide-react';

type AvailabilityFilter = 'All' | 'Ready to ship' | 'Made to order';
type FinishFilter = 'All' | 'Natural' | 'Painted';
type SizeFilter = 'All' | 'Small' | 'Medium' | 'Large';
type LightCodesCategoryFilter = 'All' | 'Frequency Foundations' | 'Embodied Vibrations' | 'Resonant Formations';

const FilterButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`font-mono text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 border transition-colors ${
            active
                ? 'bg-wood-900 text-paper-50 border-wood-900'
                : 'bg-transparent text-wood-500 border-wood-200 hover:text-wood-900 hover:border-wood-400'
        }`}
    >
        {label}
    </button>
);

const SeriesPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();

    const [availFilter, setAvailFilter] = useState<AvailabilityFilter>('All');
    const [finishFilter, setFinishFilter] = useState<FinishFilter>('All');
    const [sizeFilter, setSizeFilter] = useState<SizeFilter>('All');
    const [lcCategoryFilter, setLcCategoryFilter] = useState<LightCodesCategoryFilter>('All');

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

    const isLightCodes = seriesName === 'Light Codes';
    const hasFinishFilter = seriesName === 'Universal Language' || seriesName === 'Mandala';

    const seriesPieces = useMemo(() => {
        if (!seriesName) return [];
        let pieces = FULL_ARCHIVE.filter(a => a.series === seriesName);
        if (availFilter === 'Ready to ship') {
            pieces = pieces.filter(a => a.availability === 'READY_TO_SHIP');
        } else if (availFilter === 'Made to order') {
            pieces = pieces.filter(a => a.availability === 'MADE_TO_ORDER');
        }
        return pieces;
    }, [seriesName, availFilter]);

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
        <section className="bg-paper-50 min-h-screen pt-32 pb-32 animate-fade-in">

            {/* Title + Count + Hook */}
            <div className="max-w-[1800px] mx-auto px-6 mb-12">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-400 font-bold mb-6">
                    <Link to="/creations" className="hover:text-wood-700 transition-colors">Creations</Link>
                    <span>/</span>
                    <span className="text-wood-700">Series</span>
                </div>

                <div className="max-w-4xl">
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-3 font-medium">
                        {seriesInfo.name}
                    </h1>
                    {seriesInfo.pieceCount && (
                        <p className="font-mono text-xs uppercase tracking-widest text-wood-400 font-bold mb-8">
                            {seriesInfo.pieceCount}
                        </p>
                    )}

                    {seriesInfo.hook && (
                        <div className="mt-6 mb-3">
                            <p className="font-serif text-xl md:text-2xl text-wood-700 leading-relaxed font-light max-w-3xl">
                                {seriesInfo.hook}
                            </p>
                        </div>
                    )}

                    {seriesInfo.essaySlug && (
                        <Link
                            to={`/writings/${seriesInfo.essaySlug}`}
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-800 transition-colors font-bold border-b border-bronze-300 pb-0.5 mt-4"
                        >
                            Read the full story <ArrowRight size={12} />
                        </Link>
                    )}
                </div>
            </div>

            {/* Sticky Filter Bar */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-5 border-b border-wood-200 mb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mr-2">
                        Availability
                    </span>
                    {(['All', 'Ready to ship', 'Made to order'] as AvailabilityFilter[]).map(f => (
                        <FilterButton key={f} label={f} active={availFilter === f} onClick={() => setAvailFilter(f)} />
                    ))}

                    {hasFinishFilter && (
                        <>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-wood-300 font-bold mx-2">|</span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mr-2">Finish</span>
                            {(['All', 'Natural', 'Painted'] as FinishFilter[]).map(f => (
                                <FilterButton key={f} label={f} active={finishFilter === f} onClick={() => setFinishFilter(f)} />
                            ))}
                        </>
                    )}

                    {isLightCodes && (
                        <>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-wood-300 font-bold mx-2">|</span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mr-2">Category</span>
                            {(['All', 'Frequency Foundations', 'Embodied Vibrations', 'Resonant Formations'] as LightCodesCategoryFilter[]).map(f => (
                                <FilterButton key={f} label={f} active={lcCategoryFilter === f} onClick={() => setLcCategoryFilter(f)} />
                            ))}
                        </>
                    )}

                    <span className="font-mono text-[10px] uppercase tracking-widest text-wood-300 font-bold mx-2">|</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mr-2">Size</span>
                    {(['All', 'Small', 'Medium', 'Large'] as SizeFilter[]).map(f => (
                        <FilterButton key={f} label={f} active={sizeFilter === f} onClick={() => setSizeFilter(f)} />
                    ))}

                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">
                        {seriesPieces.length} {seriesPieces.length === 1 ? 'Piece' : 'Pieces'}
                    </span>
                </div>
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
                                    {art.availability === 'SOLD' && (
                                        <div className="absolute top-3 right-3 bg-wood-900/80 backdrop-blur px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-paper-50 font-bold">
                                            Sold
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 px-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-serif text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-tight max-w-[75%]">
                                            {art.title}
                                        </h4>
                                        {art.price && art.availability !== 'SOLD' && (
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
                            No pieces match the current filters.
                        </p>
                        <button
                            onClick={() => { setAvailFilter('All'); setFinishFilter('All'); setSizeFilter('All'); setLcCategoryFilter('All'); }}
                            className="mt-4 font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {/* Light Codes Custom Option */}
            {isLightCodes && (
                <div className="max-w-[1800px] mx-auto px-6 mt-24">
                    <div className="bg-wood-900 text-paper-50 p-10 md:p-16 max-w-3xl mx-auto text-center">
                        <h3 className="font-serif text-3xl md:text-4xl mb-6 font-medium">
                            A Light Code can also be created for you.
                        </h3>
                        <p className="font-serif text-lg text-paper-200 leading-relaxed font-light mb-8">
                            Through conversation, I receive the energy and intentions of your life, then anchor what wants to come through.
                        </p>
                        <Link
                            to="/inquire"
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper-50 border border-paper-50/40 hover:border-paper-50 px-8 py-4 transition-colors font-bold"
                        >
                            Begin the conversation <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Close */}
            <div className="max-w-[1800px] mx-auto px-6 mt-24">
                <div className="border-t border-wood-200 pt-12 text-center">
                    <p className="font-serif text-xl text-wood-600 italic mb-6">
                        Questions about this series?
                    </p>
                    <Link
                        to="/inquire"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 transition-colors font-bold border-b border-wood-900 hover:border-bronze-600 pb-1"
                    >
                        Reach out <ArrowRight size={14} />
                    </Link>
                </div>
            </div>

            {/* Other Series */}
            {otherSeries.length > 0 && (
                <div className="max-w-[1800px] mx-auto px-6 mt-24">
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
                                            {series.hook ? series.hook.substring(0, 80) + '…' : series.description}
                                        </p>
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-paper-300 font-bold mt-2">
                                            {series.pieceCount || `${pieceCount} ${pieceCount === 1 ? 'Piece' : 'Pieces'}`}
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
