
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Artwork, Collection } from '../types';
import { FULL_ARCHIVE, CREATION_CATEGORIES, COLLECTIONS } from '../data/mockData';

const CreationCategoryCard: React.FC<{
    label: string;
    desc: string;
    onClick: () => void;
    link?: string;
    idx: number;
}> = ({ label, desc, onClick, link, idx }) => {
    const navigate = useNavigate();
    const handleClick = () => link ? navigate(link) : onClick();

    return (
        <div
            onClick={handleClick}
            className="group relative aspect-square bg-wood-100 border border-wood-200 overflow-hidden cursor-pointer"
        >
            <img
                src={`https://picsum.photos/800/800?random=${100 + idx}`}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[1.5s] ease-out group-hover:scale-105"
                alt={label}
            />
            <div className="absolute inset-0 bg-wood-900/10 group-hover:bg-transparent transition-colors duration-500"></div>
            <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-stone-950/80 via-transparent to-transparent opacity-100 group-hover:opacity-90 transition-opacity">
                <h3 className="font-serif text-2xl md:text-3xl text-paper-50 mb-1 font-medium">{label}</h3>
                <p className="font-serif text-sm md:text-base text-paper-200 font-light opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-100">
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
                <div className="absolute top-3 right-3 bg-paper-50/90 backdrop-blur px-2 py-1 text-[9px] font-mono uppercase tracking-widest border border-wood-200 font-bold">
                    Ready to Ship
                </div>
            )}
            {/* Story indicator — subtle bronze dot when a companion essay exists */}
            {art.relatedStorySlug && (
                <div
                    className="absolute top-3 left-3 w-2 h-2 rounded-full bg-bronze-500"
                    title="Companion story available"
                />
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
                {art.category} {art.availability === 'SOLD' && '• Sold'}
            </p>
        </div>
    </Link>
);

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

const CollectionCard: React.FC<{
    collection: Collection;
    pieces: Artwork[];
    isActive: boolean;
    onClick: () => void;
}> = ({ collection, pieces, isActive, onClick }) => {
    const cover = getCollectionCover(collection, pieces);

    return (
        <div
            onClick={onClick}
            className={`group relative aspect-[3/2] overflow-hidden cursor-pointer transition-all duration-500 ${
                isActive
                    ? 'ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper-50'
                    : 'border border-wood-200 hover:border-wood-400'
            }`}
        >
            {cover && (
                <img
                    src={cover}
                    alt={collection.name}
                    className={`w-full h-full object-cover transition-all duration-[1.5s] ease-out group-hover:scale-105 ${
                        isActive ? 'grayscale-0' : 'grayscale group-hover:grayscale-0'
                    }`}
                />
            )}
            {!cover && (
                <div className="w-full h-full bg-wood-100" />
            )}
            <div className="absolute inset-0 bg-wood-900/10 group-hover:bg-transparent transition-colors duration-500"></div>
            <div className="absolute inset-0 p-5 flex flex-col justify-end bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent">
                <h4 className="font-serif text-xl md:text-2xl text-paper-50 mb-1 font-medium leading-tight">
                    {collection.name}
                </h4>
                {collection.description && (
                    <p className="font-serif text-sm text-paper-200 font-light opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500 delay-100 line-clamp-2">
                        {collection.description}
                    </p>
                )}
                <span className="font-mono text-[10px] uppercase tracking-widest text-paper-300 font-bold mt-2">
                    {pieces.length} {pieces.length === 1 ? 'Piece' : 'Pieces'}
                </span>
            </div>
        </div>
    );
};

const Creations: React.FC = () => {
    const [filter, setFilter] = useState<string | null>(null);
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [activeCollection, setActiveCollection] = useState<string | null>(null);

    // Reset active collection when category changes
    const handleCategoryChange = (category: string | null) => {
        setFilter(category);
        setActiveCollection(null);
    };

    // 5.3 Selected Works (First 12 featured items)
    const selectedWorks = useMemo(() => FULL_ARCHIVE.filter(a => a.featured).slice(0, 12), []);

    // Collections for the current category
    const categoryCollections = useMemo(() => {
        if (!filter) return [];
        return COLLECTIONS.filter(c => c.category === filter);
    }, [filter]);

    // Pre-compute pieces for each collection (for counts and cover images)
    const collectionPiecesMap = useMemo(() => {
        const map = new Map<string, Artwork[]>();
        for (const col of categoryCollections) {
            const pieces = getCollectionPieces(col, FULL_ARCHIVE);
            map.set(col.id, pieces);
        }
        return map;
    }, [categoryCollections]);

    // Filtered list for the grid
    const filteredArchive = useMemo(() => {
        let data = FULL_ARCHIVE;

        if (filter) {
            data = data.filter(a => a.category === filter);
        }

        // Apply collection filter
        if (activeCollection) {
            const col = categoryCollections.find(c => c.id === activeCollection);
            if (col) {
                const collectionPieces = collectionPiecesMap.get(col.id) || [];
                const pieceIds = new Set(collectionPieces.map(p => p.id));
                data = data.filter(a => pieceIds.has(a.id));
            }
        }

        if (showAvailableOnly) {
            data = data.filter(a => a.availability === 'READY_TO_SHIP');
        }

        return data;
    }, [filter, activeCollection, showAvailableOnly, categoryCollections, collectionPiecesMap]);

    const showCollectionCards = filter && categoryCollections.length >= 2;

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32">

            {/* 5.1 Hero Grid (Categories) */}
            {!filter && (
                <div className="max-w-[1800px] mx-auto px-6 mb-32 animate-fade-in">
                    <div className="mb-12 border-b border-wood-200 pb-8">
                        <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">Creations</h1>
                        <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-relaxed">
                            I create across many forms. Some you hang on the wall. Some you wear. Some you sit with. Some you walk into. Find what calls to you.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
                        {CREATION_CATEGORIES.map((cat, idx) => (
                            <CreationCategoryCard
                                key={cat.id}
                                label={cat.label}
                                desc={cat.desc}
                                idx={idx}
                                link={(cat as { link?: string }).link}
                                onClick={() => handleCategoryChange(cat.label)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Filter / Header for Grid */}
            <div className="max-w-[1800px] mx-auto px-6 sticky top-[70px] z-30 bg-paper-50/95 backdrop-blur-md py-6 border-b border-wood-200 flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    {filter ? (
                        <div className="flex items-center gap-2">
                             <button onClick={() => handleCategoryChange(null)} className="text-wood-500 hover:text-wood-900 font-mono text-xs uppercase tracking-widest font-bold">
                                 All Creations
                             </button>
                             <span className="text-wood-300">/</span>
                             <span className="text-wood-900 font-mono text-xs uppercase tracking-widest font-bold">{filter}</span>
                             {activeCollection && (
                                 <>
                                     <span className="text-wood-300">/</span>
                                     <span className="text-bronze-600 font-mono text-xs uppercase tracking-widest font-bold">
                                         {categoryCollections.find(c => c.id === activeCollection)?.name}
                                     </span>
                                 </>
                             )}
                        </div>
                    ) : (
                        <h2 className="font-serif text-3xl text-wood-900 font-medium">Selected Works</h2>
                    )}
                </div>

                <button
                    onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                    className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${showAvailableOnly ? 'text-bronze-600' : 'text-wood-500 hover:text-wood-900'}`}
                >
                    {showAvailableOnly ? 'Showing Available' : 'Show Available Only'}
                </button>
            </div>

            {/* Collection Cards (when 2+ collections exist for category) */}
            {showCollectionCards && (
                <div className="max-w-[1800px] mx-auto px-6 mb-16 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryCollections.map((col) => {
                            const pieces = collectionPiecesMap.get(col.id) || [];
                            if (pieces.length === 0) return null;
                            return (
                                <CollectionCard
                                    key={col.id}
                                    collection={col}
                                    pieces={pieces}
                                    isActive={activeCollection === col.id}
                                    onClick={() => setActiveCollection(
                                        activeCollection === col.id ? null : col.id
                                    )}
                                />
                            );
                        })}
                    </div>
                    {activeCollection && (
                        <button
                            onClick={() => setActiveCollection(null)}
                            className="mt-6 font-mono text-xs uppercase tracking-widest text-wood-500 hover:text-wood-900 font-bold transition-colors"
                        >
                            Show all in {filter}
                        </button>
                    )}
                </div>
            )}

            {/* Single collection subtitle (when exactly 1 collection exists) */}
            {filter && categoryCollections.length === 1 && (
                <div className="max-w-[1800px] mx-auto px-6 mb-8">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">
                        {categoryCollections[0].name} {categoryCollections[0].description && `— ${categoryCollections[0].description}`}
                    </p>
                </div>
            )}

            {/* Main Grid */}
            <div className="max-w-[1800px] mx-auto px-6">
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                    {(filter ? filteredArchive : selectedWorks).map((art) => (
                        <PieceCard
                            key={art.id}
                            art={art}
                        />
                    ))}
                </div>

                {!filter && (
                    <div className="mt-24 text-center border-t border-wood-200 pt-12">
                         <p className="font-serif text-wood-500 italic mb-6">Viewing selected works. Explore categories to see full archive.</p>
                    </div>
                )}

                {filter && filteredArchive.length === 0 && (
                    <div className="text-center py-24">
                        <p className="font-serif text-xl text-wood-500 italic">
                            {showAvailableOnly
                                ? 'No available pieces in this selection.'
                                : 'No pieces found.'}
                        </p>
                        {(showAvailableOnly || activeCollection) && (
                            <div className="flex justify-center gap-4 mt-4">
                                {activeCollection && (
                                    <button
                                        onClick={() => setActiveCollection(null)}
                                        className="font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold"
                                    >
                                        Show all in {filter}
                                    </button>
                                )}
                                {showAvailableOnly && (
                                    <button
                                        onClick={() => setShowAvailableOnly(false)}
                                        className="font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold"
                                    >
                                        Show all availability
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

        </section>
    );
};

export default Creations;
