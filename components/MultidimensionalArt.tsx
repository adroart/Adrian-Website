
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Artwork } from '../types';
import { FULL_ARCHIVE, MULTIDIMENSIONAL_CATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';

// --- Sub-components ---

const SubcategoryTile: React.FC<{
    label: string;
    desc: string;
    slug?: string;
    link?: string;
    idx: number;
}> = ({ label, desc, slug, link, idx }) => {
    const navigate = useNavigate();
    const to = link ?? `/creations/multidimensional-art/${slug}`;

    return (
        <div
            onClick={() => navigate(to)}
            className="group relative aspect-[4/3] bg-wood-100 border border-wood-200 overflow-hidden cursor-pointer"
        >
            <img
                src={`https://picsum.photos/800/600?random=${200 + idx}`}
                className="w-full h-full object-cover sm:grayscale sm:group-hover:grayscale-0 transition-all duration-[1.5s] ease-out group-hover:scale-105"
                alt={label}
            />
            <div className="absolute bottom-0 inset-x-0 p-6 bg-stone-950/60 backdrop-blur-md">
                <h3 className="font-serif text-2xl md:text-3xl text-paper-50 mb-1 font-medium">{label}</h3>
                <p className="font-serif text-sm text-paper-200 font-light
                              opacity-100 sm:opacity-0 sm:translate-y-3
                              sm:group-hover:opacity-100 sm:group-hover:translate-y-0
                              transition-all duration-500 delay-100">
                    {desc}
                </p>
            </div>
        </div>
    );
};

const PieceCard: React.FC<{ art: Artwork }> = ({ art }) => (
    <Link to={`/creations/${art.id}`} className="group cursor-pointer break-inside-avoid mb-8 block">
        <div className="relative overflow-hidden bg-wood-50 border border-wood-200">
            <img
                src={art.coverImage}
                alt={art.title}
                className="w-full h-auto object-cover transition-transform duration-[1.5s] group-hover:scale-105"
            />
            {art.availability === 'READY_TO_SHIP' && (
                <div className="absolute top-3 right-3 bg-paper-50/90 backdrop-blur px-2 py-1 text-[11px] font-mono uppercase tracking-widest border border-wood-200 font-bold">
                    Ready to Ship
                </div>
            )}
            {art.relatedStorySlug && (
                <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-bronze-500" title="Companion story available" />
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
            <p className="font-mono text-[11px] text-wood-500 uppercase tracking-widest mt-1 font-bold">
                {art.series ?? 'Signature'} {art.availability === 'SOLD' && '• Sold'}
            </p>
        </div>
    </Link>
);

// --- Main component ---

const MultidimensionalArt: React.FC = () => {
    const [showAll, setShowAll] = useState(false);
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [seriesFilter, setSeriesFilter] = useState<string | null>(null);

    const allMultiPieces = useMemo(
        () => FULL_ARCHIVE.filter(a => a.category === 'Multidimensional Art'),
        []
    );

    const filteredPieces = useMemo(() => {
        let data = allMultiPieces;
        if (seriesFilter) {
            if (seriesFilter === 'Signature Pieces') {
                data = data.filter(a => a.isSignaturePiece);
            } else {
                data = data.filter(a => a.series === seriesFilter);
            }
        }
        if (showAvailableOnly) {
            data = data.filter(a => a.availability === 'READY_TO_SHIP');
        }
        return data;
    }, [allMultiPieces, seriesFilter, showAvailableOnly]);

    const seriesOptions = ['Universal Language', 'Mandala', 'Light Codes', 'Signature Pieces'];

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">

            {/* Breadcrumb */}
            <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">
                <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                <span className="text-wood-300">/</span>
                <span className="text-wood-900">Multidimensional Art</span>
            </div>

            {/* Hero header */}
            <div className="max-w-[1800px] mx-auto px-6 mb-16 border-b border-wood-200 pb-12">
                <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">Multidimensional Art</h1>
                <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-[1.65]">
                    Layered sculpture in wood, crystal, and light. Works that hold geometry, symbol, and presence in the same form.
                </p>
            </div>

            {/* Subcategory tiles — 2×2 on mobile, 3+2 on desktop */}
            <div className="max-w-[1800px] mx-auto px-6 mb-16">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-1 mb-1">
                    {MULTIDIMENSIONAL_CATEGORIES.slice(0, 3).map((cat, idx) => (
                        <SubcategoryTile
                            key={cat.id}
                            label={cat.label}
                            desc={cat.desc}
                            slug={(cat as { slug?: string }).slug}
                            link={(cat as { link?: string }).link}
                            idx={idx}
                        />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                    {MULTIDIMENSIONAL_CATEGORIES.slice(3).map((cat, idx) => (
                        <SubcategoryTile
                            key={cat.id}
                            label={cat.label}
                            desc={cat.desc}
                            slug={(cat as { slug?: string }).slug}
                            link={(cat as { link?: string }).link}
                            idx={idx + 3}
                        />
                    ))}
                </div>
            </div>

            {/* View all toggle */}
            <div className="max-w-[1800px] mx-auto px-6 mb-8 text-center">
                <button
                    onClick={() => setShowAll(v => !v)}
                    className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                >
                    {showAll ? 'Collapse' : 'View all multidimensional works'}
                    <ArrowRight size={14} className={`transition-transform ${showAll ? 'rotate-90' : ''}`} />
                </button>
            </div>

            {/* View all — inline grid with filters */}
            {showAll && (
                <div className="animate-fade-in">
                    {/* Filter bar */}
                    <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-5 border-b border-wood-200 flex flex-wrap justify-between items-center gap-4 mb-12">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">Series</span>
                            <button
                                onClick={() => setSeriesFilter(null)}
                                className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${!seriesFilter ? 'text-wood-900' : 'text-wood-400 hover:text-wood-700'}`}
                            >
                                All
                            </button>
                            {seriesOptions.map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSeriesFilter(s === seriesFilter ? null : s)}
                                    className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${seriesFilter === s ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowAvailableOnly(v => !v)}
                            className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${showAvailableOnly ? 'text-bronze-600' : 'text-wood-500 hover:text-wood-900'}`}
                        >
                            {showAvailableOnly ? 'Showing Available' : 'Show Available Only'}
                        </button>
                    </div>

                    <div className="max-w-[1800px] mx-auto px-6">
                        {filteredPieces.length > 0 ? (
                            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                                {filteredPieces.map(art => (
                                    <PieceCard key={art.id} art={art} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-24">
                                <p className="font-serif text-xl text-wood-500 italic">No pieces match the current filters.</p>
                                <button
                                    onClick={() => { setSeriesFilter(null); setShowAvailableOnly(false); }}
                                    className="mt-4 font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold"
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default MultidimensionalArt;
