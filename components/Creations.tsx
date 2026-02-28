
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronUp, ArrowUpDown, ArrowRight } from 'lucide-react';
import { Artwork, Collection } from '../types';
import { FULL_ARCHIVE, CREATION_CATEGORIES, COLLECTIONS } from '../data/mockData';
import GalleryTileCard from './GalleryTileCard';
import ArtImage from './ArtImage';

// ─── Category tile Cloudinary public IDs ─────────────────────────────────────

const CATEGORY_TILE_IDS: Record<string, string> = {
    'Multidimensional Art': 'adrian-website/creations/tiles/multidimensional-art',
    'Illuminated Works':    'adrian-website/creations/tiles/illuminated-works',
    'Jewelry':              'adrian-website/creations/tiles/jewelry',
    'Oracle Cards':         'adrian-website/creations/tiles/oracle-cards',
    'Tables':               'adrian-website/creations/tiles/tables',
    'Installations':        'adrian-website/creations/tiles/installations',
    'Objects':              'adrian-website/creations/tiles/objects',
    'Spaces':               'adrian-website/creations/tiles/spaces',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'newest';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
    return n.toLocaleString('en-US');
}

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
    idx: number;
}> = ({ label, desc, onClick, link, idx }) => {
    const inner = (
        <>
            {/* Image */}
            <div className="overflow-hidden">
                <ArtImage
                    publicId={CATEGORY_TILE_IDS[label]}
                    variant="tile"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width={800}
                    height={800}
                />
            </div>

            {/* Title — snug under the photo */}
            <div className="text-center pt-2.5 sm:pt-3 pb-2 px-2">
                <h3 className="font-serif text-xl md:text-2xl text-wood-900 font-medium tracking-wide">
                    {label}
                </h3>
                <p className="font-serif text-sm text-wood-500 font-light mt-1 leading-relaxed
                              sm:opacity-0 sm:group-hover:opacity-100
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
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 dark-preserve"
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
            className="group cursor-pointer text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 dark-preserve"
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
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/5 to-transparent pointer-events-none" />
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

// ─── Back-to-Top Button ────────────────────────────────────────────────────────

const BackToTop: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handler = () => setVisible(window.scrollY > 600);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    if (!visible) return null;

    return (
        <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="fixed bottom-8 right-6 z-50 bg-paper-50 border border-wood-200 shadow-md p-3 hover:border-wood-400 hover:shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
        >
            <ChevronUp size={18} className="text-wood-700" aria-hidden="true" />
        </button>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Creations: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Category is stored in the URL as ?category=Jewelry so it's shareable + bookmarkable
    const filter = searchParams.get('category');
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [activeCollection, setActiveCollection] = useState<string | null>(null);
    const [sort, setSort] = useState<SortOption>('default');

    const gridRef = useRef<HTMLDivElement>(null);

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

    // Selected works: first 12 featured items
    const selectedWorks = useMemo(() => FULL_ARCHIVE.filter(a => a.featured).slice(0, 12), []);

    // Available now: ready-to-ship pieces for the dedicated section
    const availableNow = useMemo(() => FULL_ARCHIVE.filter(a => a.availability === 'READY_TO_SHIP').slice(0, 8), []);

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

    const displayedPieces = filter ? filteredArchive : selectedWorks;
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
                        {CREATION_CATEGORIES.map((cat, idx) => (
                            <div key={cat.id} role="listitem">
                                <CreationCategoryCard
                                    label={cat.label}
                                    desc={cat.desc}
                                    idx={idx}
                                    link={(cat as { link?: string }).link}
                                    onClick={() => handleCategoryChange(cat.label)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Available Now Section ───────────────────────────────── */}
            {!filter && availableNow.length > 0 && (
                <div className="max-w-[1800px] mx-auto px-6 mb-20 animate-fade-in">
                    <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                        <div>
                            <h2 className="font-serif text-3xl sm:text-4xl text-wood-900 font-medium">Available Now</h2>
                            <p className="font-serif text-base sm:text-lg text-wood-500 italic leading-relaxed mt-1">Ready to ship from the studio.</p>
                        </div>
                        <Link
                            to="/shop"
                            className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold whitespace-nowrap"
                        >
                            Visit the Shop <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-4 lg:gap-5">
                        {availableNow.map(art => (
                            <GalleryTileCard key={art.id} art={art} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Sticky Filter / Breadcrumb Bar ────────────────────────── */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-4 border-b border-wood-200 mb-10">
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
                            <h2 className="font-serif text-2xl text-wood-900 font-medium">Selected Works</h2>
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

                {displayedPieces.length > 0 ? (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 sm:gap-6 lg:gap-8 card-stagger">
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

                {/* Footer note for Selected Works view */}
                {!filter && displayedPieces.length > 0 && (
                    <div className="mt-20 pt-10 border-t border-wood-200 text-center">
                        <p className="font-serif text-wood-500 italic mb-5 text-base">
                            Viewing selected works. Choose a category above to explore the full archive.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 hover:text-wood-900 font-semibold transition-colors underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                            Back to categories
                        </button>
                    </div>
                )}
            </div>

            {/* Floating back-to-top button */}
            <BackToTop />

        </section>
    );
};

export default Creations;
