
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ArrowRight, X } from 'lucide-react';
import { img } from '../utils/cloudinary';
import BackToTop from './shared/BackToTop';
import { Artwork, Collection } from '../types';
import { FULL_ARCHIVE, CREATION_CATEGORIES, COLLECTIONS, JEWELRY_GALLERY } from '../data/mockData';
import GalleryTileCard from './GalleryTileCard';
import ArtImage from './ArtImage';
import { formatPrice } from '../utils/formatPrice';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'newest';

/** Resolve which pieces belong to a collection */
function getCollectionPieces(collection: Collection, archive: Artwork[]): Artwork[] {
    if (collection.pieceIds) {
        return collection.pieceIds
            .map(id => archive.find(a => a.id === id))
            .filter((a): a is Artwork => !!a);
    }
    if (collection.matchSeries) {
        return archive.filter(a => a.series === collection.matchSeries);
    }
    return [];
}

/** Resolve cover image for a collection: explicit → first featured piece → first piece */
function getCollectionCover(collection: Collection, pieces: Artwork[]): string | undefined {
    if (collection.coverImage) return collection.coverImage;
    const featured = pieces.find(p => p.featured);
    if (featured) return featured.coverImage;
    return pieces[0]?.coverImage;
}

function sortArchive(data: Artwork[], sort: SortOption): Artwork[] {
    if (sort === 'price-asc') return [...data].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === 'price-desc') return [...data].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    if (sort === 'newest') return [...data].sort((a, b) => Number(b.year) - Number(a.year));
    return data; // 'default' — keep original order
}

const SORT_LABELS: Record<SortOption, string> = {
    default: 'Default',
    'price-asc': 'Price: Low to High',
    'price-desc': 'Price: High to Low',
    newest: 'Newest First',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * One tile in the hero category grid.
 * Renders as <Link> when a route exists, or as <button> for inline filters.
 * Fully keyboard-accessible in both cases.
 */
const CreationCategoryCard: React.FC<{
    label: string;
    desc: string;
    onClick: () => void;
    link?: string;
    image: string;
    video?: string;
}> = ({ label, desc, onClick, link, image, video }) => {
    const inner = (
        <>
            {/* Image or video */}
            <div className="overflow-hidden aspect-square bg-stone-950">
                {video ? (
                    <video
                        src={video}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-[1.15]"
                    />
                ) : (
                    <ArtImage
                        publicId={image}
                        variant="tile"
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        width={800}
                        height={800}
                    />
                )}
            </div>

            {/* Title — snug under the photo */}
            <div className="text-center pt-2.5 sm:pt-3 pb-2 px-2">
                <h3 className="font-serif text-xl md:text-2xl text-wood-900 font-medium tracking-wide">
                    {label}
                </h3>
                <p className="font-serif text-sm text-wood-500 font-light mt-1 leading-relaxed line-clamp-1
                              sm:opacity-70 sm:group-hover:opacity-100
                              transition-opacity duration-500 ease-out">
                    {desc}
                </p>
            </div>
        </>
    );

    if (link) {
        return (
            <Link
                to={link}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 touch-active"
                aria-label={`Explore ${label}: ${desc}`}
            >
                {inner}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="group cursor-pointer text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 touch-active"
            aria-label={`Browse ${label}: ${desc}`}
        >
            {inner}
        </button>
    );
};

/**
 * A collection card — uses <button> for proper semantics and keyboard access.
 */
const CollectionCard: React.FC<{
    collection: Collection;
    pieces: Artwork[];
    isActive: boolean;
    onClick: () => void;
}> = ({ collection, pieces, isActive, onClick }) => {
    const cover = getCollectionCover(collection, pieces);

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={`group relative aspect-[3/2] overflow-hidden cursor-pointer transition-all duration-500 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 dark-preserve ${
                isActive
                    ? 'ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper-50'
                    : 'border border-wood-200 hover:border-wood-400'
            }`}
            aria-label={`${isActive ? 'Deselect' : 'Filter by'} collection: ${collection.name}`}
        >
            {/* Placeholder background */}
            <div className="absolute inset-0 bg-wood-100" />
            {cover && (
                <ArtImage
                    src={cover}
                    variant="cover"
                    inactive={!isActive}
                    alt=""
                    aria-hidden="true"
                    width={800}
                    height={533}
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/10 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 px-5 pb-4">
                <h4 className="font-serif text-xl md:text-2xl text-paper-50 font-medium leading-tight">
                    {collection.name}
                </h4>
                <span className="font-label text-[11px] uppercase tracking-[0.2em] text-paper-300 font-bold mt-1 block">
                    {pieces.length} {pieces.length === 1 ? 'Piece' : 'Pieces'}
                    {isActive && <span className="text-bronze-400 ml-2">· Active filter</span>}
                </span>
                {collection.description && (
                    <p className="hidden sm:block font-serif text-sm text-paper-200 font-light mt-1
                                  sm:opacity-0 sm:translate-y-2
                                  sm:group-hover:opacity-100 sm:group-hover:translate-y-0
                                  transition-all duration-500 delay-75">
                        {collection.description}
                    </p>
                )}
            </div>
        </button>
    );
};

// ─── Sort Dropdown ─────────────────────────────────────────────────────────────

const SortDropdown: React.FC<{
    value: SortOption;
    onChange: (v: SortOption) => void;
}> = ({ value, onChange }) => (
    <div className="relative flex items-center gap-1.5">
        <ArrowUpDown size={12} className="text-wood-400 flex-shrink-0" aria-hidden="true" />
        <label htmlFor="sort-select" className="sr-only">Sort pieces</label>
        <select
            id="sort-select"
            value={value}
            onChange={e => onChange(e.target.value as SortOption)}
            className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 bg-transparent border-none outline-none cursor-pointer appearance-none pr-1 transition-colors font-semibold"
        >
            {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
            ))}
        </select>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Creations: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Category is stored in the URL as ?category=Jewelry so it's shareable + bookmarkable
    const filter = searchParams.get('category');
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [activeCollection, setActiveCollection] = useState<string | null>(null);
    const [sort, setSort] = useState<SortOption>('default');

    // Jewelry gallery lightbox
    const [jewelryLightbox, setJewelryLightbox] = useState<{ images: string[]; index: number } | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);

    // Scroll to results grid when a collection filter is applied
    useEffect(() => {
        if (activeCollection) {
            gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [activeCollection]);

    const handleCategoryChange = useCallback((category: string | null) => {
        setActiveCollection(null);
        setSort('default');
        if (category) {
            setSearchParams({ category });
        } else {
            setSearchParams({});
        }
        // Scroll back to top of page when changing category
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [setSearchParams]);


    // Collections for the current category
    const categoryCollections = useMemo(() => {
        if (!filter) return [];
        return COLLECTIONS.filter(c => c.category === filter);
    }, [filter]);

    // Pre-compute pieces for each collection (counts + covers)
    const collectionPiecesMap = useMemo(() => {
        const map = new Map<string, Artwork[]>();
        for (const col of categoryCollections) {
            map.set(col.id, getCollectionPieces(col, FULL_ARCHIVE));
        }
        return map;
    }, [categoryCollections]);

    // Build filtered + sorted list for the grid
    const filteredArchive = useMemo(() => {
        let data = FULL_ARCHIVE;

        if (filter) data = data.filter(a => a.category === filter);

        if (activeCollection) {
            const col = categoryCollections.find(c => c.id === activeCollection);
            if (col) {
                const pieceIds = new Set((collectionPiecesMap.get(col.id) ?? []).map(p => p.id));
                data = data.filter(a => pieceIds.has(a.id));
            }
        }

        if (showAvailableOnly) data = data.filter(a => a.availability === 'READY_TO_SHIP');

        return sortArchive(data, sort);
    }, [filter, activeCollection, showAvailableOnly, sort, categoryCollections, collectionPiecesMap]);

    const displayedPieces = filteredArchive;
    const showCollectionCards = !!filter && categoryCollections.length >= 2;

    // Count available pieces for the toggle label
    const availableCount = useMemo(() => {
        let data = FULL_ARCHIVE;
        if (filter) data = data.filter(a => a.category === filter);
        if (activeCollection) {
            const col = categoryCollections.find(c => c.id === activeCollection);
            if (col) {
                const pieceIds = new Set((collectionPiecesMap.get(col.id) ?? []).map(p => p.id));
                data = data.filter(a => pieceIds.has(a.id));
            }
        }
        return data.filter(a => a.availability === 'READY_TO_SHIP').length;
    }, [filter, activeCollection, categoryCollections, collectionPiecesMap]);

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32">

            {/* ── 5.1 Hero Category Grid ─────────────────────────────────── */}
            {!filter && (
                <div className="max-w-[1800px] mx-auto px-6 mb-20 animate-fade-in">
                    {/* Hero header */}
                    <div className="mb-12 border-b border-wood-200 pb-10">
                        <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-8 font-medium tracking-tight">
                            Creations
                        </h1>
                        <p className="font-serif text-2xl md:text-3xl text-wood-800 max-w-4xl font-medium leading-snug mb-4">
                            I create across many forms.
                        </p>
                        <p className="font-serif text-lg md:text-xl text-wood-600 max-w-4xl font-light leading-[1.7]">
                            Some you hang on the wall. Some you wear. Some you sit with. Some you walk into.
                        </p>
                        <p className="font-serif text-base text-wood-500 max-w-4xl font-light leading-[1.7] mt-3 italic">
                            These are not decoration. They are portals. A place to sit with. To find your center.
                            To feel an opening. Find what calls to you.
                        </p>
                    </div>

                    {/* Category grid */}
                    <div
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 card-stagger"
                        role="list"
                        aria-label="Art categories"
                    >
                        {CREATION_CATEGORIES.filter(cat => !(cat as { hidden?: boolean }).hidden).map((cat, idx) => (
                            <div key={cat.id} role="listitem">
                                <CreationCategoryCard
                                    label={cat.label}
                                    desc={cat.desc}
                                    image={(cat as { image: string }).image}
                                    video={(cat as { video?: string }).video}
                                    link={(cat as { link?: string }).link}
                                    onClick={() => handleCategoryChange(cat.label)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Sticky Filter / Breadcrumb Bar ────────────────────────── */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50 backdrop-blur-md py-4 border-b border-wood-200 mb-10">
                <div className="flex flex-wrap items-center justify-between gap-3">

                    {/* Left: title / breadcrumb */}
                    <div className="flex items-center gap-2 min-w-0">
                        {filter ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleCategoryChange(null)}
                                    className="font-label text-xs uppercase tracking-[0.2em] font-semibold text-wood-400 hover:text-wood-900 transition-colors underline-offset-2 hover:underline flex-shrink-0 focus-visible:outline-none focus-visible:underline"
                                    aria-label="Back to all creations"
                                >
                                    All
                                </button>
                                <span className="text-wood-300 flex-shrink-0" aria-hidden="true">/</span>
                                <span className="font-label text-xs uppercase tracking-[0.2em] font-semibold text-wood-900 truncate">
                                    {filter}
                                </span>
                                {activeCollection && (
                                    <>
                                        <span className="text-wood-300 flex-shrink-0" aria-hidden="true">/</span>
                                        <span className="font-label text-xs uppercase tracking-[0.2em] font-semibold text-bronze-600 truncate">
                                            {categoryCollections.find(c => c.id === activeCollection)?.name}
                                        </span>
                                    </>
                                )}
                            </>
                        ) : (
                            <h2 className="font-serif text-2xl text-wood-900 font-medium">Creations</h2>
                        )}
                    </div>

                    {/* Right: controls */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Sort — only shown in filtered views */}
                        {filter && (
                            <SortDropdown value={sort} onChange={setSort} />
                        )}

                        {/* Divider */}
                        {filter && <span className="text-wood-200" aria-hidden="true">|</span>}

                        {/* Available-only toggle */}
                        <button
                            type="button"
                            onClick={() => setShowAvailableOnly(v => !v)}
                            aria-pressed={showAvailableOnly}
                            className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors focus-visible:outline-none focus-visible:underline ${
                                showAvailableOnly
                                    ? 'text-bronze-600'
                                    : 'text-wood-400 hover:text-wood-900'
                            }`}
                        >
                            {showAvailableOnly
                                ? `Available (${availableCount})`
                                : `Available Only`}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Collection Cards ───────────────────────────────────────── */}
            {showCollectionCards && (
                <div className="max-w-[1800px] mx-auto px-6 mb-14 animate-fade-in">
                    <div
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                        role="group"
                        aria-label="Filter by collection"
                    >
                        {categoryCollections.map(col => {
                            const pieces = collectionPiecesMap.get(col.id) ?? [];
                            if (pieces.length === 0) return null;
                            return (
                                <CollectionCard
                                    key={col.id}
                                    collection={col}
                                    pieces={pieces}
                                    isActive={activeCollection === col.id}
                                    onClick={() =>
                                        setActiveCollection(p => p === col.id ? null : col.id)
                                    }
                                />
                            );
                        })}
                    </div>

                    {activeCollection && (
                        <button
                            type="button"
                            onClick={() => setActiveCollection(null)}
                            className="mt-5 font-label text-xs uppercase tracking-[0.2em] text-wood-400 hover:text-wood-900 font-semibold transition-colors focus-visible:outline-none focus-visible:underline"
                        >
                            ← Show all in {filter}
                        </button>
                    )}
                </div>
            )}

            {/* Single collection label (when exactly 1 collection exists) */}
            {filter && categoryCollections.length === 1 && (
                <div className="max-w-[1800px] mx-auto px-6 mb-8">
                    <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold">
                        {categoryCollections[0].name}
                        {categoryCollections[0].description && (
                            <span className="text-wood-300 font-normal normal-case tracking-normal ml-2 font-serif text-sm italic">
                                — {categoryCollections[0].description}
                            </span>
                        )}
                    </p>
                </div>
            )}

            {/* ── Main Masonry Grid ──────────────────────────────────────── */}
            <div className="max-w-[1800px] mx-auto px-6" ref={gridRef}>

                {/* Jewelry: photo gallery instead of piece cards */}
                {filter === 'Jewelry' ? (
                    <>
                        {/* Inquire intro */}
                        <div className="max-w-3xl mb-14">
                            <p className="font-serif text-xl text-wood-600 font-light leading-[1.7]">
                                Each piece is one of a kind, crafted with Ye Ming Zhu and precious materials. Browse the gallery and <Link to="/inquire" className="text-bronze-600 hover:text-bronze-800 underline underline-offset-2 transition-colors">reach out</Link> to learn more about what is available or to commission something personal.
                            </p>
                        </div>

                        {/* Pendants & Jewelry */}
                        <div className="mb-16">
                            <div className="border-t border-wood-200 pt-10 mb-8">
                                <h2 className="font-serif text-3xl text-wood-900 font-medium mb-2">Pendants and Jewelry</h2>
                                <p className="font-serif text-lg text-wood-500 font-light">Necklaces, pendants, and wearable pieces</p>
                            </div>
                            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4">
                                {JEWELRY_GALLERY.jewelry.map((id, i) => (
                                    <button
                                        key={id}
                                        onClick={() => setJewelryLightbox({ images: JEWELRY_GALLERY.jewelry, index: i })}
                                        className="block w-full mb-3 md:mb-4 overflow-hidden group cursor-pointer break-inside-avoid"
                                    >
                                        <img src={img(id, { w: 600 })} alt="" className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rings */}
                        <div className="mb-16">
                            <div className="border-t border-wood-200 pt-10 mb-8">
                                <h2 className="font-serif text-3xl text-wood-900 font-medium mb-2">Rings</h2>
                                <p className="font-serif text-lg text-wood-500 font-light">Ye Ming Zhu rings, each unique</p>
                            </div>
                            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4">
                                {JEWELRY_GALLERY.rings.map((id, i) => (
                                    <button
                                        key={id}
                                        onClick={() => setJewelryLightbox({ images: JEWELRY_GALLERY.rings, index: i })}
                                        className="block w-full mb-3 md:mb-4 overflow-hidden group cursor-pointer break-inside-avoid"
                                    >
                                        <img src={img(id, { w: 600 })} alt="" className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Inquire CTA */}
                        <div className="max-w-3xl mx-auto text-center pt-4 pb-8">
                            <div className="border-t border-wood-200 pt-14">
                                <p className="font-serif text-2xl text-wood-800 font-light leading-[1.5] mb-8">
                                    Interested in a piece you see here?
                                </p>
                                <Link
                                    to="/inquire"
                                    className="inline-flex items-center gap-3 px-10 py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-all duration-300"
                                >
                                    Inquire <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    </>
                ) : displayedPieces.length > 0 ? (
                    <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-5 lg:gap-8 card-stagger">
                        {displayedPieces.map(art => (
                            <GalleryTileCard key={art.id} art={art} />
                        ))}
                    </div>
                ) : (
                    /* ── Empty State ─────────────────────────────────────── */
                    <div className="text-center py-24 px-6">
                        <p className="font-serif text-2xl text-wood-600 italic mb-3">
                            {showAvailableOnly
                                ? 'No available pieces in this selection.'
                                : 'No pieces found.'}
                        </p>
                        <p className="font-serif text-base text-wood-400 font-light mb-8">
                            {showAvailableOnly
                                ? 'More pieces are made to order. Remove the filter to see the full archive.'
                                : 'Try a different category or remove active filters.'}
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            {activeCollection && (
                                <button
                                    type="button"
                                    onClick={() => setActiveCollection(null)}
                                    className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold border border-bronze-400 px-4 py-2 hover:bg-bronze-400/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                                >
                                    Clear collection filter
                                </button>
                            )}
                            {showAvailableOnly && (
                                <button
                                    type="button"
                                    onClick={() => setShowAvailableOnly(false)}
                                    className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold border border-bronze-400 px-4 py-2 hover:bg-bronze-400/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                                >
                                    Show all availability
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => handleCategoryChange(null)}
                                className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 font-semibold border border-wood-300 px-4 py-2 hover:bg-wood-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                            >
                                Back to all categories
                            </button>
                        </div>
                    </div>
                )}

            </div>

            {/* Floating back-to-top button */}
            <BackToTop />

            {/* Jewelry lightbox */}
            {jewelryLightbox && (
                <div className="fixed inset-0 z-[100] bg-stone-950/95 flex items-center justify-center" onClick={() => setJewelryLightbox(null)}>
                    <button onClick={() => setJewelryLightbox(null)} className="absolute top-6 right-6 text-paper-300 hover:text-paper-50 transition-colors z-10">
                        <X size={28} />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); setJewelryLightbox(prev => prev && ({ ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length })); }}
                        className="absolute left-4 md:left-8 text-paper-300 hover:text-paper-50 transition-colors text-4xl font-light z-10"
                    >
                        ‹
                    </button>
                    <img
                        src={img(jewelryLightbox.images[jewelryLightbox.index], { w: 1400 })}
                        alt=""
                        className="max-h-[85vh] max-w-[90vw] object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        onClick={e => { e.stopPropagation(); setJewelryLightbox(prev => prev && ({ ...prev, index: (prev.index + 1) % prev.images.length })); }}
                        className="absolute right-4 md:right-8 text-paper-300 hover:text-paper-50 transition-colors text-4xl font-light z-10"
                    >
                        ›
                    </button>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-label text-xs text-paper-400 tracking-[0.2em] uppercase">
                        {jewelryLightbox.index + 1} / {jewelryLightbox.images.length}
                    </div>
                </div>
            )}

        </section>
    );
};

export default Creations;
