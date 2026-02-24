
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Artwork } from '../types';
import { FULL_ARCHIVE, SERIES_DATA, LIGHT_CODE_SUBCATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import GalleryTileCard from './GalleryTileCard';

// --- Subcategory config ---

interface SubcategoryConfig {
    title: string;
    description: string;
    image?: string;
    getPieces: (archive: Artwork[]) => Artwork[];
    filters: ('availability' | 'finish' | 'hasStory' | 'subcategory')[];
    showCommissionInvite: boolean;
    tileDesc?: string;
}

const SLUG_MAP: Record<string, SubcategoryConfig> = {
    'universal-language': {
        title: 'Universal Language',
        description: 'Sixty-four works. Each connected to a hexagram from the I Ching and a corresponding Gene Key. A complete symbolic language encoded in layered wood.',
        image: SERIES_DATA.find(s => s.name === 'Universal Language')?.image,
        getPieces: (a) => a.filter(p => p.series === 'Universal Language'),
        filters: ['availability', 'finish', 'hasStory'],
        showCommissionInvite: false,
    },
    'mandala': {
        title: 'Mandala',
        description: 'Sacred geometry forms. Maps of the inner and outer cosmos. Each layer a ring of the palace, moving inward toward the bindu.',
        image: SERIES_DATA.find(s => s.name === 'Mandala')?.image,
        getPieces: (a) => a.filter(p => p.series === 'Mandala'),
        filters: ['availability', 'finish', 'hasStory'],
        showCommissionInvite: false,
    },
    'light-codes': {
        title: 'Light Codes',
        description: 'Frequencies anchored in matter. Approximately forty works across three subcategories, each encoding a different dimension of resonance.',
        image: SERIES_DATA.find(s => s.name === 'Light Codes')?.image,
        getPieces: (a) => a.filter(p => p.series === 'Light Codes'),
        filters: ['availability', 'subcategory'],
        showCommissionInvite: false,
    },
    'signature-pieces': {
        title: 'Signature Pieces',
        description: 'Works outside any series. An animal. A scene. A world compressed into layers of wood and light. Each arrives with its own reason for existing.',
        getPieces: (a) => a.filter(p => p.category === 'Multidimensional Art' && p.isSignaturePiece),
        filters: ['availability', 'finish', 'hasStory'],
        showCommissionInvite: true,
    },
};

// --- Main component ---

const SubcategoryPage: React.FC = () => {
    const { subcategory } = useParams<{ subcategory: string }>();
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [finishFilter, setFinishFilter] = useState<string | null>(null);
    const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null);
    const [hasStoryFilter, setHasStoryFilter] = useState(false);

    const config = useMemo(() => SLUG_MAP[subcategory ?? ''] ?? null, [subcategory]);

    const basePieces = useMemo(
        () => (config ? config.getPieces(FULL_ARCHIVE) : []),
        [config]
    );

    const filteredPieces = useMemo(() => {
        let data = basePieces;
        if (showAvailableOnly) data = data.filter(a => a.availability === 'READY_TO_SHIP');
        if (finishFilter) data = data.filter(a => a.finish === finishFilter);
        if (subcategoryFilter) data = data.filter(a => a.subcategory === subcategoryFilter);
        if (hasStoryFilter) data = data.filter(a => !!a.relatedStorySlug);
        return data;
    }, [basePieces, showAvailableOnly, finishFilter, subcategoryFilter, hasStoryFilter]);

    const finishOptions = useMemo(
        () => [...new Set(basePieces.map(p => p.finish).filter(Boolean) as string[])],
        [basePieces]
    );

    const hasFiltersActive = showAvailableOnly || finishFilter || subcategoryFilter || hasStoryFilter;

    useEffect(() => {
        window.scrollTo(0, 0);
        // Reset filters when subcategory changes
        setShowAvailableOnly(false);
        setFinishFilter(null);
        setSubcategoryFilter(null);
        setHasStoryFilter(false);
    }, [subcategory]);

    if (!config) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Not Found</h1>
                    <p className="font-serif text-lg text-wood-600 mb-8">This section does not exist.</p>
                    <Link
                        to="/creations/multidimensional-art"
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
                    >
                        <ArrowRight size={14} className="rotate-180" /> Back to Multidimensional Art
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">

            {/* Hero */}
            {config.image ? (
                <div className="relative w-full h-[45vh] min-h-[360px] max-h-[560px] overflow-hidden mb-0 dark-preserve">
                    <img src={config.image} alt={config.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 max-w-[1800px] mx-auto">
                        {/* Breadcrumb on hero */}
                        <div className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-paper-300 font-semibold mb-4">
                            <Link to="/creations" className="hover:text-paper-50 transition-colors">Creations</Link>
                            <span className="text-paper-300/50">/</span>
                            <Link to="/creations/multidimensional-art" className="hover:text-paper-50 transition-colors">Multidimensional Art</Link>
                            <span className="text-paper-300/50">/</span>
                            <span className="text-paper-50">{config.title}</span>
                        </div>
                        <h1 className="font-serif text-5xl md:text-7xl text-paper-50 mb-4 font-medium">{config.title}</h1>
                        <p className="font-serif text-lg md:text-xl text-paper-200 max-w-2xl font-light leading-[1.6]">
                            {config.description}
                        </p>
                    </div>
                </div>
            ) : (
                /* No hero image — text header */
                <div className="max-w-[1800px] mx-auto px-6 pb-12 border-b border-wood-200">
                    <div className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold mb-6">
                        <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                        <span className="text-wood-300">/</span>
                        <Link to="/creations/multidimensional-art" className="hover:text-wood-900 transition-colors">Multidimensional Art</Link>
                        <span className="text-wood-300">/</span>
                        <span className="text-wood-900">{config.title}</span>
                    </div>
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">{config.title}</h1>
                    <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-[1.7]">{config.description}</p>
                </div>
            )}

            {/* Filter bar */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-5 border-b border-wood-200 flex flex-wrap justify-between items-center gap-4 mb-12">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">
                        {filteredPieces.length} {filteredPieces.length === 1 ? 'piece' : 'pieces'}
                    </span>

                    {/* Subcategory filter (Light Codes only) */}
                    {config.filters.includes('subcategory') && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSubcategoryFilter(null)}
                                className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${!subcategoryFilter ? 'text-wood-900' : 'text-wood-400 hover:text-wood-700'}`}
                            >
                                All
                            </button>
                            {LIGHT_CODE_SUBCATEGORIES.map(sc => (
                                <button
                                    key={sc}
                                    onClick={() => setSubcategoryFilter(sc === subcategoryFilter ? null : sc)}
                                    className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${subcategoryFilter === sc ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
                                >
                                    {sc}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Finish filter */}
                    {config.filters.includes('finish') && finishOptions.length > 0 && (
                        <div className="flex items-center gap-2">
                            {finishOptions.map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFinishFilter(f === finishFilter ? null : f)}
                                    className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${finishFilter === f ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Has Story filter */}
                    {config.filters.includes('hasStory') && basePieces.some(p => p.relatedStorySlug) && (
                        <button
                            onClick={() => setHasStoryFilter(v => !v)}
                            className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${hasStoryFilter ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
                        >
                            Has Story
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {hasFiltersActive && (
                        <button
                            onClick={() => { setShowAvailableOnly(false); setFinishFilter(null); setSubcategoryFilter(null); setHasStoryFilter(false); }}
                            className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 hover:text-wood-700 font-semibold transition-colors"
                        >
                            Clear filters
                        </button>
                    )}
                    <button
                        onClick={() => setShowAvailableOnly(v => !v)}
                        className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${showAvailableOnly ? 'text-bronze-600' : 'text-wood-500 hover:text-wood-900'}`}
                    >
                        {showAvailableOnly ? 'Showing Available' : 'Show Available Only'}
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="max-w-[1800px] mx-auto px-6">
                {filteredPieces.length > 0 ? (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                        {filteredPieces.map(art => (
                            <GalleryTileCard key={art.id} art={art} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24">
                        <p className="font-serif text-xl text-wood-500 italic">
                            {showAvailableOnly
                                ? 'No available pieces match the current filters.'
                                : 'No pieces found.'}
                        </p>
                        {hasFiltersActive && (
                            <button
                                onClick={() => { setShowAvailableOnly(false); setFinishFilter(null); setSubcategoryFilter(null); setHasStoryFilter(false); }}
                                className="mt-4 font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Commission invitation (Signature Pieces only) */}
            {config.showCommissionInvite && (
                <div className="max-w-[1800px] mx-auto px-6 mt-32">
                    <div className="border-t border-wood-200 pt-16 text-center">
                        <p className="font-serif text-2xl md:text-3xl text-wood-700 font-light italic mb-8 max-w-xl mx-auto leading-[1.4]">
                            Something calling to you that does not exist yet?
                        </p>
                        <Link
                            to="/inquire"
                            className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                        >
                            Begin a conversation <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Other subcategories */}
            <div className="max-w-[1800px] mx-auto px-6 mt-32">
                <div className="border-t border-wood-200 pt-12 mb-8">
                    <h2 className="font-serif text-2xl text-wood-900 font-medium">Other series</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                    {Object.entries(SLUG_MAP)
                        .filter(([slug]) => slug !== subcategory)
                        .map(([slug, cfg]) => (
                            <Link
                                key={slug}
                                to={`/creations/multidimensional-art/${slug}`}
                                className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 font-semibold border-b border-transparent hover:border-wood-900 pb-1 transition-all"
                            >
                                {cfg.title}
                            </Link>
                        ))}
                </div>
            </div>
        </section>
    );
};

export default SubcategoryPage;
