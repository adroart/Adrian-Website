
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ArrowRight, X } from 'lucide-react';
import { img } from '../utils/media';
import BackToTop from './shared/BackToTop';
import { Artwork, Collection } from '../types';
import { FULL_ARCHIVE, CREATION_CATEGORIES, COLLECTIONS, JEWELRY_GALLERY } from '../data/mockData';
import GalleryTileCard from './GalleryTileCard';
import ArtImage from './ArtImage';
import { formatPrice } from '../utils/formatPrice';
import { LAUNCH_FLAGS } from '../launchFlags';
import { piecePath } from '../utils/pieceSlug';

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

/**
 * How many pieces the grid renders before asking.
 *
 * The full archive is 173 pieces. Rendered in one go the page measured 22,590px —
 * twenty-five screens — with 183 lazily-loaded images. Scrolling at any speed
 * outran the loader, so what a visitor actually saw was a wall of empty tiles
 * catching up behind them. A page of 48 fills three to four screens, which is
 * enough to feel abundant without asking anyone to scroll a kilometre.
 */
const PAGE_SIZE = 48;

/**
 * Match a piece against a free-text query.
 *
 * 173 pieces and no way to search them: someone who remembered "the frog one" or came
 * looking for "Communion" had to scroll the archive until they found it. Everything
 * needed is already in the browser, so this needs no index and no request.
 *
 * Every term must match somewhere (AND, not OR), which is what makes narrowing feel
 * like it is working: "wood 2024" gets pieces that are both, not everything that is
 * either. Fields are joined once per piece and cached by the caller's useMemo.
 */
function pieceHaystack(a: Artwork): string {
    return [a.title, a.series, a.category, a.material, a.year, a.dimensions, a.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function matchesQuery(haystack: string, query: string): boolean {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    return terms.every(t => haystack.includes(t));
}

function sortArchive(data: Artwork[], sort: SortOption): Artwork[] {
    if (sort === 'price-asc') return [...data].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === 'price-desc') return [...data].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    if (sort === 'newest') return [...data].sort((a, b) => Number(b.year) - Number(a.year));
    return data; // 'default' - keep original order
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
            <div className="overflow-hidden aspect-square bg-wood-100">
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

            {/* Title - snug under the photo */}
            <div className="text-center pt-2.5 sm:pt-3 pb-2 px-2">
                <h2 className="font-serif text-xl md:text-2xl text-wood-900 font-medium tracking-wide">
                    {label}
                </h2>
                {/* Two lines, and the room for both reserved so the four tiles stay
                    level. Clamped to one, "Wearable pieces and talismans" lost half
                    of itself on a phone: it needs 46px and was given 23. */}
                <p className="font-sans text-sm text-wood-700 font-light mt-1 leading-relaxed line-clamp-2 min-h-[2.9em]
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
 * A collection card - uses <button> for proper semantics and keyboard access.
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
                <span className="font-label text-[12px] uppercase tracking-[0.12em] text-paper-50 font-bold mt-1 block">
                    {pieces.length} {pieces.length === 1 ? 'Piece' : 'Pieces'}
                    {isActive && <span className="text-bronze-600 ml-2">· Active filter</span>}
                </span>
                {collection.description && (
                    <p className="hidden sm:block font-sans text-sm text-paper-50 font-light mt-1
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
        <ArrowUpDown size={12} className="text-wood-700 flex-shrink-0" aria-hidden="true" />
        <label htmlFor="sort-select" className="sr-only">Sort pieces</label>
        <select
            id="sort-select"
            value={value}
            onChange={e => onChange(e.target.value as SortOption)}
            className="font-label text-xs uppercase tracking-[0.2em] text-wood-700 hover:text-wood-900 bg-transparent border-none outline-none cursor-pointer appearance-none pr-1 transition-colors font-semibold"
        >
            {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
            ))}
        </select>
    </div>
);

// ─── Available Now Section ────────────────────────────────────────────────────

const AvailableNowSection: React.FC = () => {
    const readyToShip = useMemo(
        () => FULL_ARCHIVE.filter(a => a.availability === 'READY_TO_SHIP').slice(0, 6),
        []
    );

    if (readyToShip.length === 0) return null;

    return (
        <div className="max-w-[1800px] mx-auto px-6 mb-20 animate-fade-in">
            <div className="border-t border-wood-200 pt-14">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold block mb-3">Ready to Ship</span>
                        <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium">Available Now</h2>
                        <p className="font-sans text-base text-wood-700 font-light mt-2">These pieces are complete and ready to be shipped to their new home.</p>
                    </div>
                    {LAUNCH_FLAGS.shopEnabled && (
                        <Link
                            to="/shop"
                            className="hidden md:flex font-label text-xs uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 font-semibold items-center gap-2"
                        >
                            See all in the shop <ArrowRight size={14} />
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {readyToShip.map(piece => (
                        <Link key={piece.id} to={piecePath(piece)} className="group">
                            <div className="overflow-hidden aspect-square mb-3">
                                <ArtImage
                                    publicId={piece.coverImage}
                                    alt={piece.title}
                                    variant="tile"
                                    loading="lazy"
                                />
                            </div>
                            <p className="font-sans text-sm text-wood-800 font-medium group-hover:text-bronze-600 transition-colors leading-snug">{piece.title}</p>
                            <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 mt-1">{piece.series || piece.category}</p>
                            {/* These six are the finished pieces a visitor can have now.
                                Showing everything except the price made the most
                                purchase-ready row on the site the least informative. */}
                            {piece.price != null && (
                                <p className="font-sans text-sm text-wood-900 font-medium mt-1">{formatPrice(piece.price)}</p>
                            )}
                        </Link>
                    ))}
                </div>

                {LAUNCH_FLAGS.shopEnabled && (
                    <div className="mt-8 text-center md:hidden">
                        <Link
                            to="/shop"
                            className="font-label text-xs uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 font-semibold"
                        >
                            See all in the shop →
                        </Link>
                    </div>
                )}
            </div>
        </div>
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
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [query, setQuery] = useState('');

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

    // Built once for the whole archive, not per keystroke.
    const haystacks = useMemo(() => {
        const map = new Map<string, string>();
        for (const a of FULL_ARCHIVE) map.set(a.id, pieceHaystack(a));
        return map;
    }, []);

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

        if (query.trim()) {
            data = data.filter(a => matchesQuery(haystacks.get(a.id) ?? '', query));
        }

        return sortArchive(data, sort);
    }, [filter, activeCollection, showAvailableOnly, sort, query, haystacks, categoryCollections, collectionPiecesMap]);

    // Any change to the filters starts the window again — otherwise switching
    // category while deep into "show more" would silently reveal a different
    // number of pieces than the count says.
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [filter, activeCollection, showAvailableOnly, sort, query]);

    const displayedPieces = useMemo(
        () => filteredArchive.slice(0, visibleCount),
        [filteredArchive, visibleCount],
    );
    const remaining = filteredArchive.length - displayedPieces.length;
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
                        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-wood-900 mb-8 font-medium tracking-tight">
                            Creations
                        </h1>
                        <p className="font-serif text-2xl md:text-3xl text-wood-800 max-w-4xl font-medium leading-snug mb-4">
                            I create across many forms.
                        </p>
                        <p className="font-sans text-lg md:text-xl text-wood-600 max-w-4xl font-light leading-[1.7]">
                            Some you hang on the wall. Some you wear. Some you sit with. Some you walk into.
                        </p>
                        <p className="font-sans text-base text-wood-700 max-w-[68ch] font-light leading-[1.7] mt-3">
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

            {/* ── Available Now ─────────────────────────────────────────── */}
            {!filter && <AvailableNowSection />}

            {/* ── Sticky Filter / Breadcrumb Bar ────────────────────────── */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[var(--nav-height)] z-30 bg-paper-50 backdrop-blur-md py-4 border-b border-wood-200 mb-10">
                <div className="flex flex-wrap items-center justify-between gap-3">

                    {/* Left: title / breadcrumb */}
                    <div className="flex items-center gap-2 min-w-0">
                        {filter ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleCategoryChange(null)}
                                    className="font-label text-xs uppercase tracking-[0.2em] font-semibold text-wood-600 hover:text-wood-900 transition-colors underline-offset-2 hover:underline flex-shrink-0 focus-visible:outline-none focus-visible:underline"
                                    aria-label="Back to all creations"
                                >
                                    All
                                </button>
                                <span className="text-wood-700 flex-shrink-0" aria-hidden="true">/</span>
                                <span className="font-label text-xs uppercase tracking-[0.2em] font-semibold text-wood-900 truncate">
                                    {filter}
                                </span>
                                {activeCollection && (
                                    <>
                                        <span className="text-wood-700 flex-shrink-0" aria-hidden="true">/</span>
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
                        {/* Search. Filtering by eye across 173 pieces was the only
                            option before this. */}
                        <div className="relative flex items-center">
                            <label htmlFor="piece-search" className="sr-only">Search pieces</label>
                            <input
                                id="piece-search"
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search"
                                className="font-label text-xs uppercase tracking-[0.15em] text-wood-900 placeholder:text-wood-700 bg-transparent border-b border-wood-300 focus:border-bronze-600 outline-none py-1.5 w-28 focus:w-44 transition-all duration-300"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    aria-label="Clear search"
                                    className="ml-2 font-label text-xs text-wood-700 hover:text-wood-900"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        <span className="text-wood-300" aria-hidden="true">|</span>

                        {/* Sort. This used to render only when a ?category= param was
                            present, so the bare /creations page — the way nearly everyone
                            arrives — offered no way to sort 173 pieces at all. */}
                        <SortDropdown value={sort} onChange={setSort} />

                        <span className="text-wood-300" aria-hidden="true">|</span>

                        {/* Available-only toggle */}
                        <button
                            type="button"
                            onClick={() => setShowAvailableOnly(v => !v)}
                            aria-pressed={showAvailableOnly}
                            className={`font-label text-xs uppercase tracking-[0.2em] font-semibold px-3 py-1.5 border transition-colors ${
                                showAvailableOnly
                                    ? 'text-paper-50 bg-wood-900 border-wood-900'
                                    : 'text-wood-700 border-wood-300 hover:border-wood-700 hover:text-wood-900'
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
                            className="mt-5 font-label text-xs uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 font-semibold transition-colors focus-visible:outline-none focus-visible:underline"
                        >
                            ← Show all in {filter}
                        </button>
                    )}
                </div>
            )}

            {/* Single collection label (when exactly 1 collection exists) */}
            {filter && categoryCollections.length === 1 && (
                <div className="max-w-[1800px] mx-auto px-6 mb-8">
                    <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-600 font-semibold">
                        {categoryCollections[0].name}
                        {categoryCollections[0].description && (
                            <span className="text-wood-700 font-normal normal-case tracking-normal ml-2 font-sans text-sm">
                                · {categoryCollections[0].description}
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
                                <p className="font-sans text-lg text-wood-700 font-light">Necklaces, pendants, and wearable pieces</p>
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
                                <p className="font-sans text-lg text-wood-700 font-light">Ye Ming Zhu rings, each unique</p>
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
                    <>
                        <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-5 lg:gap-8 card-stagger">
                            {displayedPieces.map(art => (
                                <GalleryTileCard key={art.id} art={art} />
                            ))}
                        </div>

                        {remaining > 0 && (
                            <div className="flex flex-col items-center gap-3 pt-14">
                                <p
                                    className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold"
                                    aria-live="polite"
                                >
                                    Showing {displayedPieces.length} of {filteredArchive.length}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                    className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border border-wood-700 hover:border-bronze-600 px-8 py-3 transition-colors"
                                >
                                    Show {Math.min(PAGE_SIZE, remaining)} more
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    /* ── Empty State ─────────────────────────────────────── */
                    <div className="text-center py-24 px-6">
                        <p className="font-serif text-2xl text-wood-600 mb-3">
                            {query.trim()
                                ? `Nothing matches "${query.trim()}".`
                                : showAvailableOnly
                                    ? 'No available pieces in this selection.'
                                    : 'No pieces found.'}
                        </p>
                        <p className="font-sans text-base text-wood-600 font-light mb-8">
                            {showAvailableOnly
                                ? 'More pieces are made to order. Remove the filter to see the full archive.'
                                : 'Try a different category or remove active filters.'}
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            {query.trim() && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-600 font-semibold border border-bronze-400 px-4 py-2 hover:bg-bronze-400/10 transition-colors"
                                >
                                    Clear search
                                </button>
                            )}
                            {activeCollection && (
                                <button
                                    type="button"
                                    onClick={() => setActiveCollection(null)}
                                    className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-600 font-semibold border border-bronze-400 px-4 py-2 hover:bg-bronze-400/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                                >
                                    Clear collection filter
                                </button>
                            )}
                            {showAvailableOnly && (
                                <button
                                    type="button"
                                    onClick={() => setShowAvailableOnly(false)}
                                    className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-600 font-semibold border border-bronze-400 px-4 py-2 hover:bg-bronze-400/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                                >
                                    Show all availability
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => handleCategoryChange(null)}
                                className="font-label text-xs uppercase tracking-[0.2em] text-wood-700 hover:text-wood-900 font-semibold border border-wood-300 px-4 py-2 hover:bg-wood-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
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
