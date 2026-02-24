
import React, { useMemo, useCallback, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
    seriesName?: string;
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
        seriesName: 'Universal Language',
    },
    'mandala': {
        title: 'Mandala',
        description: 'Sacred geometry forms. Maps of the inner and outer cosmos. Each layer a ring of the palace, moving inward toward the bindu.',
        image: SERIES_DATA.find(s => s.name === 'Mandala')?.image,
        getPieces: (a) => a.filter(p => p.series === 'Mandala'),
        filters: ['availability', 'finish', 'hasStory'],
        showCommissionInvite: false,
        seriesName: 'Mandala',
    },
    'light-codes': {
        title: 'Light Codes',
        description: 'Frequencies anchored in matter. Approximately forty works across three subcategories, each encoding a different dimension of resonance.',
        image: SERIES_DATA.find(s => s.name === 'Light Codes')?.image,
        getPieces: (a) => a.filter(p => p.series === 'Light Codes'),
        filters: ['availability', 'subcategory'],
        showCommissionInvite: true,
        seriesName: 'Light Codes',
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
    const [searchParams, setSearchParams] = useSearchParams();

    // Read filter state from URL
    const showAvailableOnly = searchParams.get('available') === '1';
    const finishFilter = searchParams.get('finish');
    const subcategoryFilter = searchParams.get('sub');
    const hasStoryFilter = searchParams.get('story') === '1';

    const setParam = useCallback((key: string, value: string | null) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set(key, value);
            else next.delete(key);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setShowAvailableOnly = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
        const next = typeof v === 'function' ? v(showAvailableOnly) : v;
        setParam('available', next ? '1' : null);
    }, [setParam, showAvailableOnly]);

    const setFinishFilter = useCallback((v: string | null) => setParam('finish', v), [setParam]);
    const setSubcategoryFilter = useCallback((v: string | null) => setParam('sub', v), [setParam]);
    const setHasStoryFilter = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
        const next = typeof v === 'function' ? v(hasStoryFilter) : v;
        setParam('story', next ? '1' : null);
    }, [setParam, hasStoryFilter]);

    const clearAllFilters = useCallback(() => {
        setSearchParams({}, { replace: true });
    }, [setSearchParams]);

    const config = useMemo(() => SLUG_MAP[subcategory ?? ''] ?? null, [subcategory]);

    const seriesInfo = useMemo(
        () => config?.seriesName ? SERIES_DATA.find(s => s.name === config.seriesName) ?? null : null,
        [config]
    );

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

    const hasFiltersActive = showAvailableOnly || !!finishFilter || !!subcategoryFilter || hasStoryFilter;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [subcategory]);

    if (!config) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Not Found</h1>
                    <p className="font-serif text-lg text-wood-600 mb-8">This section does not exist.</p>
                    <Link
                        to="/creations/multidimensional-art"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
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
            {config.image && (
                <div className="w-full h-[35vh] min-h-[280px] max-h-[460px] overflow-hidden">
                    <img src={config.image} alt={config.title} className="w-full h-full object-cover" />
                </div>
            )}

            {/* Header */}
            <div className="max-w-[1800px] mx-auto px-6 pt-10 pb-12 border-b border-wood-200">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold mb-6">
                    <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                    <span className="text-wood-300">/</span>
                    <Link to="/creations/multidimensional-art" className="hover:text-wood-900 transition-colors">Multidimensional Art</Link>
                    <span className="text-wood-300">/</span>
                    <span className="text-wood-900">{config.title}</span>
                </div>
                <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">{config.title}</h1>
                <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-[1.7]">{config.description}</p>
            </div>

            {/* Series hook + essay link */}
            {seriesInfo?.hook && (
                <div className="max-w-[1800px] mx-auto px-6 py-12">
                    <p className="font-serif text-xl md:text-2xl text-wood-700 leading-[1.55] font-light max-w-3xl">
                        {seriesInfo.hook}
                    </p>
                    {seriesInfo.essaySlug && (
                        <Link
                            to={`/writings/${seriesInfo.essaySlug}`}
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold border-b border-bronze-300 pb-0.5 mt-6"
                        >
                            Read the full story <ArrowRight size={12} />
                        </Link>
                    )}
                </div>
            )}

            {/* Filter bar */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-5 border-b border-wood-200 mb-12">
                <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide min-w-0">
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold flex-shrink-0">
                        {filteredPieces.length} {filteredPieces.length === 1 ? 'piece' : 'pieces'}
                    </span>

                    {/* Subcategory filter (Light Codes only) */}
                    {config.filters.includes('subcategory') && (
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => setSubcategoryFilter(null)}
                                className={`font-mono text-xs uppercase tracking-[0.2em] font-semibold transition-colors whitespace-nowrap ${!subcategoryFilter ? 'text-wood-900' : 'text-wood-400 hover:text-wood-700'}`}
                            >
                                All
                            </button>
                            {LIGHT_CODE_SUBCATEGORIES.map(sc => (
                                <button
                                    key={sc}
                                    onClick={() => setSubcategoryFilter(sc === subcategoryFilter ? null : sc)}
                                    className={`font-mono text-xs uppercase tracking-[0.2em] font-semibold transition-colors whitespace-nowrap ${subcategoryFilter === sc ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
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
                                    className={`font-mono text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${finishFilter === f ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
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
                            className={`font-mono text-xs uppercase tracking-[0.2em] font-semibold transition-colors whitespace-nowrap ${hasStoryFilter ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}
                        >
                            Has Story
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                    {hasFiltersActive && (
                        <button
                            onClick={clearAllFilters}
                            className="font-mono text-xs uppercase tracking-[0.2em] text-wood-400 hover:text-wood-700 font-semibold transition-colors whitespace-nowrap"
                        >
                            Clear filters
                        </button>
                    )}
                    <button
                        onClick={() => setShowAvailableOnly(v => !v)}
                        className={`font-mono text-xs uppercase tracking-[0.2em] font-semibold transition-colors whitespace-nowrap ${showAvailableOnly ? 'text-bronze-600' : 'text-wood-500 hover:text-wood-900'}`}
                    >
                        {showAvailableOnly ? 'Showing Available' : 'Show Available Only'}
                    </button>
                </div>
                </div>
            </div>

            {/* Grid */}
            <div className="max-w-[1800px] mx-auto px-6">
                {filteredPieces.length > 0 ? (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                        {filteredPieces.map(art => (
                            <GalleryTileCard
                                key={art.id}
                                art={art}
                                showDetails
                                subtitleOverride={art.subcategory || art.series}
                            />
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
                                onClick={clearAllFilters}
                                className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Commission invitation */}
            {config.showCommissionInvite && config.seriesName === 'Light Codes' && (
                <div className="max-w-[1800px] mx-auto px-6 mt-24">
                    <div className="bg-wood-900 text-paper-50 p-10 md:p-16 max-w-3xl mx-auto text-center dark-preserve">
                        <h3 className="font-serif text-3xl md:text-4xl mb-6 font-medium">
                            A Light Code can also be created for you.
                        </h3>
                        <p className="font-serif text-lg text-paper-200 leading-[1.7] font-light mb-8">
                            Through conversation, I receive the energy and intentions of your life, then anchor what wants to come through.
                        </p>
                        <Link
                            to="/inquire"
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-paper-50 border border-paper-50/40 hover:border-paper-50 px-8 py-4 transition-colors font-semibold"
                        >
                            Begin the conversation <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}
            {config.showCommissionInvite && config.seriesName !== 'Light Codes' && (
                <div className="max-w-[1800px] mx-auto px-6 mt-32">
                    <div className="border-t border-wood-200 pt-16 text-center">
                        <p className="font-serif text-2xl md:text-3xl text-wood-700 font-light italic mb-8 max-w-xl mx-auto leading-[1.4]">
                            Something calling to you that does not exist yet?
                        </p>
                        <Link
                            to="/inquire"
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                        >
                            Begin a conversation <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Other subcategories */}
            <div className="max-w-[1800px] mx-auto px-6 mt-32">
                <div className="border-t border-wood-200 pt-12 mb-8">
                    <h2 className="font-serif text-2xl text-wood-900 font-medium">Explore more</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                    {Object.entries(SLUG_MAP)
                        .filter(([slug]) => slug !== subcategory)
                        .map(([slug, cfg]) => (
                            <Link
                                key={slug}
                                to={`/creations/multidimensional-art/${slug}`}
                                className="font-mono text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 font-semibold border-b border-transparent hover:border-wood-900 pb-1 transition-all"
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
