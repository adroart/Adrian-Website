
import React, { useMemo, useCallback, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Artwork } from '../types';
import { FULL_ARCHIVE, SERIES_DATA, LIGHT_CODE_SUBCATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import GalleryTileCard from './GalleryTileCard';
import Breadcrumb from './Breadcrumb';
import { img } from '../utils/media';
import { ulCardNumber } from '../utils/universalLanguage';
import { artworkById } from './gallery/galleryContent';
import { useMetaTags } from '../hooks/useMetaTags';

// --- Subcategory config ---

interface SubcategoryConfig {
    title: string;
    description: string;
    image?: string;
    getPieces: (archive: Artwork[]) => Artwork[];
    filters: ('availability' | 'finish' | 'hasStory' | 'subcategory' | 'size')[];
    showCommissionInvite: boolean;
    seriesName?: string;
    tileDesc?: string;
}

const SLUG_MAP: Record<string, SubcategoryConfig> = {
    'universal-language': {
        title: 'Universal Language',
        description: 'Sixty-four works. Each connected to a hexagram from the I Ching and a corresponding Gene Key. A complete symbolic language encoded in layered wood.',
        image: SERIES_DATA.find(s => s.name === 'Universal Language')?.image,
        getPieces: (a) => a.filter(p => p.series === 'Universal Language').sort((left, right) =>
            (ulCardNumber(left.coverImage) ?? Infinity) - (ulCardNumber(right.coverImage) ?? Infinity)
        ),
        filters: ['size', 'finish'],
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
        description: 'Frequencies anchored in matter. Three groups of works engraved in wood, each encoding a different dimension of resonance.',
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

const mandalaFamilies = [
    { title: 'Sol Urchin', titlePrefix: 'Sol Urchin - ' },
    { title: 'Metatron Flower', titlePrefix: 'Metatron Flower - ' },
    { title: 'Circle of Existance', titlePrefix: 'Circle Of Existance - ' },
];
const selectedMandalaIds = ['MAN-004', 'MAN-017', 'MAN-021', 'MAN-029'];

function mandalaGroups(works: Artwork[]) {
    return [
        {
            title: 'Selected works',
            works: selectedMandalaIds.flatMap(id => works.filter(art => art.id === id)),
        },
        ...mandalaFamilies.map(family => ({
            title: family.title,
            works: works.filter(art => art.title.startsWith(family.titlePrefix)),
        })),
        {
            title: 'More Mandalas',
            works: works.filter(art => !selectedMandalaIds.includes(art.id)
                && !mandalaFamilies.some(family => art.title.startsWith(family.titlePrefix))),
        },
    ].filter(group => group.works.length);
}

// --- Main component ---

const SubcategoryPage: React.FC = () => {
    const { subcategory } = useParams<{ subcategory: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Read filter state from URL
    const showAvailableOnly = searchParams.get('available') === '1';
    const finishFilter = searchParams.get('finish');
    const subcategoryFilter = searchParams.get('sub');
    const hasStoryFilter = searchParams.get('story') === '1';
    const sizeFilter = searchParams.get('size');

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
    const setSizeFilter = useCallback((v: string | null) => setParam('size', v), [setParam]);

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
        if (showAvailableOnly) data = data.filter(a => a.availability === 'READY_TO_SHIP' || a.availability === 'MADE_TO_ORDER');
        if (finishFilter) data = data.filter(a => a.finish === finishFilter);
        if (subcategoryFilter) data = data.filter(a => a.subcategory === subcategoryFilter);
        if (hasStoryFilter) data = data.filter(a => !!a.relatedStorySlug);
        if (sizeFilter) data = data.filter(a => {
            const match = a.dimensions?.match(/(\d+)"/);
            return match && match[1] + '"' === sizeFilter;
        });
        return data;
    }, [basePieces, showAvailableOnly, finishFilter, subcategoryFilter, hasStoryFilter, sizeFilter]);

    const finishOptions = useMemo(
        () => [...new Set(basePieces.map(p => p.finish).filter(Boolean) as string[])],
        [basePieces]
    );

    const sizeOptions = useMemo(() => {
        const sizes = basePieces
            .map(p => { const m = p.dimensions?.match(/(\d+)"/); return m ? parseInt(m[1], 10) : null; })
            .filter((v): v is number => v !== null);
        return [...new Set(sizes)].sort((a, b) => a - b).map(s => s + '"');
    }, [basePieces]);

    const hasFiltersActive = showAvailableOnly || !!finishFilter || !!subcategoryFilter || hasStoryFilter || !!sizeFilter;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [subcategory]);

    const ogImage = config?.image
        ? `https://adrianrasmussen.com${img(config.image, { w: 1200, h: 630, format: 'jpg' })}`
        : undefined;
    useMetaTags({ title: config?.title, description: config?.description, image: ogImage });

    if (!config) {
        return (
            <section className="bg-surface-page min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Not Found</h1>
                    <p className="font-sans text-lg text-wood-600 mb-8">This section does not exist.</p>
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

    const renderGrid = (works: Artwork[]) => (
        <div className="gallery-grid">
            {works.map(art => (
                <GalleryTileCard
                    key={art.id}
                    art={art}
                    showDetails
                    subtitleOverride={art.series ?? art.category}
                />
            ))}
        </div>
    );

    /* Pill button helper for filter chips */
    const pillClass = (active: boolean) =>
        `font-label text-xs uppercase tracking-[0.18em] font-semibold transition-all whitespace-nowrap px-3 py-2 border ${
            active
                ? 'bg-wood-900 text-paper-50 border-wood-900'
                : 'bg-transparent text-wood-600 border-wood-200 hover:border-wood-400 hover:text-wood-800'
        }`;

    return (
        <section className="public-gallery min-h-screen">
            <div className="gallery-width">
                <Breadcrumb
                    crumbs={[
                        { label: 'Creations', to: '/creations' },
                        { label: 'Multidimensional Art', to: '/creations/multidimensional-art' },
                        { label: config.title },
                    ]}
                    className="gallery-crumb"
                />
                <h1 className="gallery-title">{config.title}</h1>
                <p className="gallery-intro">{config.description}</p>
            </div>

            {subcategory === 'universal-language' && !hasFiltersActive && (
                <section className="gallery-width gallery-band gallery-selected" aria-labelledby="selected-works">
                    <div className="gallery-band-heading">
                        <h2 id="selected-works" className="gallery-subtitle">Selected works</h2>
                        <a href="#series-collection" className="gallery-action">Browse all {basePieces.length} in order</a>
                    </div>
                    <div className="gallery-grid">
                        {['UL-122', 'UL-100', 'UL-102', 'UL-163'].map(id => {
                            const art = artworkById(id);
                            return art ? <GalleryTileCard key={id} art={art} selected /> : null;
                        })}
                    </div>
                </section>
            )}

            {/* Filter bar - pill-style with visual grouping */}
            <div id="series-collection" className="gallery-width gallery-band mb-5">
                <div className={`gallery-filters justify-between${subcategory === "light-codes" ? " gallery-light-code-filters" : ""}`}>
                    <div className="gallery-filters gallery-filter-main">
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-600 font-semibold flex-shrink-0 tabular-nums">
                            {filteredPieces.length} {filteredPieces.length === 1 ? 'piece' : 'pieces'}
                        </span>

                        {/* Divider */}
                        <span className="hidden sm:block w-px h-5 bg-wood-200 flex-shrink-0" />

                        {/* Subcategory filter (Light Codes only) */}
                        {config.filters.includes('subcategory') && (
                            <div className="gallery-filters gallery-light-code-groups">
                                <button
                                    onClick={() => setSubcategoryFilter(null)}
                                    aria-pressed={!subcategoryFilter}
                                    className={pillClass(!subcategoryFilter)}
                                >
                                    All
                                </button>
                                {LIGHT_CODE_SUBCATEGORIES.map(sc => (
                                    <button
                                        key={sc}
                                        onClick={() => setSubcategoryFilter(sc === subcategoryFilter ? null : sc)}
                                        aria-pressed={subcategoryFilter === sc}
                                        className={pillClass(subcategoryFilter === sc)}
                                    >
                                        {sc}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Size filter */}
                        {config.filters.includes('size') && sizeOptions.length > 1 && (
                            <div className="gallery-filters">
                                <span className="font-label text-label-lg uppercase tracking-[0.12em] text-wood-600 font-semibold mr-1">Size</span>
                                {sizeOptions.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSizeFilter(s === sizeFilter ? null : s)}
                                        aria-pressed={sizeFilter === s}
                                        className={pillClass(sizeFilter === s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Finish filter */}
                        {config.filters.includes('finish') && finishOptions.length > 1 && (
                            <div className="gallery-filters">
                                <span className="font-label text-label-lg uppercase tracking-[0.12em] text-wood-600 font-semibold mr-1">Finish</span>
                                {finishOptions.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFinishFilter(f === finishFilter ? null : f)}
                                        aria-pressed={finishFilter === f}
                                        className={pillClass(finishFilter === f)}
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
                                aria-pressed={hasStoryFilter}
                                className={pillClass(hasStoryFilter)}
                            >
                                Has Story
                            </button>
                        )}
                    </div>

                    <div className="gallery-filters gallery-filter-end">
                        {hasFiltersActive && (
                            <button
                                onClick={clearAllFilters}
                                className="font-label text-label-lg uppercase tracking-[0.12em] text-wood-600 hover:text-wood-700 font-semibold transition-colors whitespace-nowrap underline underline-offset-2"
                            >
                                Clear all
                            </button>
                        )}
                        {config.filters.includes('availability') && (
                            <button
                                onClick={() => setShowAvailableOnly(v => !v)}
                                aria-pressed={showAvailableOnly}
                                className={pillClass(showAvailableOnly)}
                            >
                                {showAvailableOnly ? 'Available' : 'Available Only'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="gallery-width">
                {filteredPieces.length > 0 ? (
                    config.seriesName === 'Light Codes' && !subcategoryFilter ? (
                        LIGHT_CODE_SUBCATEGORIES.map(name => {
                            const works = filteredPieces.filter(art => art.subcategory === name);
                            return works.length ? (
                                <section key={name} className="gallery-series-group">
                                    <h2 className="gallery-subtitle">{name}</h2>
                                    {renderGrid(works)}
                                </section>
                            ) : null;
                        })
                    ) : subcategory === 'mandala' && !hasFiltersActive ? (
                        mandalaGroups(filteredPieces).map(group => (
                            <section key={group.title} className="gallery-series-group">
                                <h2 className="gallery-subtitle">{group.title}</h2>
                                {renderGrid(group.works)}
                            </section>
                        ))
                    ) : subcategory === 'signature-pieces' ? (
                        [
                            { title: 'Individual works', works: filteredPieces.filter(art => !art.title.startsWith('Communion')) },
                            { title: 'Communion finishes', works: filteredPieces.filter(art => art.title.startsWith('Communion')) },
                        ].filter(group => group.works.length).map(group => (
                            <section key={group.title} className="gallery-series-group">
                                <h2 className="gallery-subtitle">{group.title}</h2>
                                {renderGrid(group.works)}
                            </section>
                        ))
                    ) : (
                        <>
                            <h2 className="sr-only">
                                {subcategoryFilter ?? (hasFiltersActive ? 'Filtered works' : `All ${basePieces.length} works`)}
                            </h2>
                            {renderGrid(filteredPieces)}
                        </>
                    )
                ) : (
                    <div className="text-center py-14">
                        <p className="font-serif text-xl text-wood-700">
                            {showAvailableOnly ? 'No available pieces match the current filters.' : 'No pieces found.'}
                        </p>
                        {hasFiltersActive && <button onClick={clearAllFilters} className="gallery-action">Clear filters</button>}
                    </div>
                )}

                {seriesInfo?.hook && (
                    <section className="gallery-band">
                        <h2 className="gallery-subtitle">About the series</h2>
                        <p className="gallery-intro">{seriesInfo.hook}</p>
                        {seriesInfo.essaySlug && (
                            <Link to={`/writings/${seriesInfo.essaySlug}`} className="gallery-action">
                                Read the full story
                            </Link>
                        )}
                    </section>
                )}
            </div>

            {/* Commission invitation */}
            {config.showCommissionInvite && config.seriesName === 'Light Codes' && (
                <div className="max-w-[1800px] mx-auto px-6 md:px-10 mt-24">
                    <div className="bg-wood-900 text-paper-50 p-10 md:p-16 max-w-3xl mx-auto text-center dark-preserve">
                        <h3 className="font-serif text-3xl md:text-4xl mb-6 font-medium">
                            A Light Code can also be created for you.
                        </h3>
                        <p className="font-sans text-lg text-paper-200 leading-prose font-light mb-8">
                            Through conversation, I receive the energy and intentions of your life, then anchor what wants to come through.
                        </p>
                        <Link
                            to="/inquire"
                            className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-paper-50 border border-paper-50/40 hover:border-paper-50 px-8 py-4 transition-colors font-semibold"
                        >
                            Begin a conversation <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}
            {config.showCommissionInvite && config.seriesName !== 'Light Codes' && (
                <div className="max-w-[1800px] mx-auto px-6 md:px-10 mt-32">
                    <div className="border-t border-wood-200 pt-16 text-center">
                        <p className="font-serif text-2xl md:text-3xl text-wood-700 font-light mb-8 max-w-xl mx-auto leading-[1.4]">
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
            <div className="max-w-[1800px] mx-auto px-6 md:px-10 mt-32">
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
                                className="font-label text-xs uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 font-semibold border-b border-transparent hover:border-wood-900 pb-1 transition-all"
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
