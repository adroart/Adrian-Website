
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ArtImage from './ArtImage';
import { img } from '../utils/cloudinary';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { Product, Collection } from '../types';
import { INVENTORY, STORE_CATEGORIES, COLLECTIONS, FULL_ARCHIVE } from '../data/mockData';
import {
    X, Search, SlidersHorizontal, ArrowRight, ShieldCheck,
    Maximize2, Package, ShoppingBag, Check, ChevronUp, BookOpen
} from 'lucide-react';
import { useCart } from '../CartContext';
import { formatPrice } from '../utils/formatPrice';
import VisualLightbox from './VisualLightbox';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCollectionProductIds(collection: Collection): Set<string> {
    if (collection.pieceIds) return new Set(collection.pieceIds);
    if (collection.matchSeries) {
        return new Set(FULL_ARCHIVE.filter(a => a.series === collection.matchSeries).map(a => a.id));
    }
    return new Set();
}

function getCollectionCoverImage(collection: Collection): string {
    if (collection.coverImage) return collection.coverImage;
    const ids = getCollectionProductIds(collection);
    const piece = FULL_ARCHIVE.find(a => ids.has(a.id) && a.featured)
        ?? FULL_ARCHIVE.find(a => ids.has(a.id));
    return piece?.coverImage ?? 'adrian-website/placeholders/artwork-square-1';
}

// ─── BackToTop ────────────────────────────────────────────────────────────────

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

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
    <div className="break-inside-avoid mb-8 animate-pulse">
        <div className="w-full bg-wood-200 aspect-[3/4]" />
        <div className="mt-4 space-y-2 px-1">
            <div className="h-5 bg-wood-200 rounded w-3/4" />
            <div className="h-3 bg-wood-100 rounded w-1/2" />
        </div>
    </div>
);

// ─── Interstitial Blocks ──────────────────────────────────────────────────────

const PhilosophyBlock: React.FC = () => (
    <div className="break-inside-avoid mb-6 sm:mb-8 lg:mb-10">
        <div className="bg-wood-900 text-paper-50 p-8 md:p-10 text-center dark-preserve">
            <span className="font-label text-xs uppercase tracking-[0.1em] text-bronze-400 mb-4 block font-semibold">Philosophy</span>
            <p className="font-serif text-xl md:text-2xl leading-[1.4]">
                <span className="ml-[-0.4em]">"</span>We do not own these objects. We are merely their custodians for a brief moment in time."
            </p>
            <div className="w-10 h-px bg-bronze-500 mt-6 mx-auto" />
        </div>
    </div>
);

const ProcessBlock: React.FC = () => (
    <div className="break-inside-avoid mb-6 sm:mb-8 lg:mb-10">
        <div className="bg-wood-100 border border-wood-200 p-7">
            <span className="font-label text-xs uppercase tracking-[0.1em] text-bronze-600 mb-3 block font-semibold">The Studio</span>
            <p className="font-sans text-base text-wood-700 leading-[1.7]">
                I start with silence. Before the laser is turned on, there is the intention. Often the design arrives in a flash during meditation or tea ceremony. The execution is a dance between digital precision and analog chaos.
            </p>
            <Link
                to="/writings/the-practice-creation"
                className="mt-4 inline-flex items-center gap-1.5 font-label text-[11px] uppercase tracking-[0.1em] text-bronze-600 hover:text-bronze-700 font-semibold transition-colors"
            >
                How I create <ArrowRight size={11} />
            </Link>
        </div>
    </div>
);

const MaterialBlock: React.FC = () => (
    <div className="break-inside-avoid mb-6 sm:mb-8 lg:mb-10">
        <div className="border border-wood-200 p-7">
            <span className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-3 block font-semibold">On Materials</span>
            <p className="font-sans text-base text-wood-700 leading-[1.7]">
                Birch, basswood, walnut. Indonesian hardwoods selected by hand. The grain itself is part of the composition. Beneath every layer of paint and gold leaf, the wood breathes.
            </p>
        </div>
    </div>
);

// ─── Shop Category Tiles ──────────────────────────────────────────────────────

// Only categories that have purchasable products in INVENTORY
const SHOP_CATEGORY_DATA = [
    { cat: 'Multidimensional Art', desc: 'Windows into the infinite',             image: 'adrian-website/creations/signature-pieces/path-of-the-ordinary' },
    { cat: 'Objects',              desc: 'Objects for the altar and the everyday', image: 'adrian-website/placeholders/artwork-square-7' },
] as const;

const ShopCategoryTile: React.FC<{
    cat: (typeof SHOP_CATEGORY_DATA)[number];
    isActive: boolean;
    onSelect: () => void;
}> = ({ cat, isActive, onSelect }) => (
    <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        className={`group block text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 transition-all duration-300 touch-active ${isActive ? 'ring-2 ring-bronze-500 ring-offset-2' : ''}`}
        aria-label={`Browse ${cat.cat}: ${cat.desc}`}
    >
        <div className="overflow-hidden">
            <ArtImage
                publicId={cat.image}
                variant="tile"
                alt=""
                aria-hidden="true"
                loading="lazy"
            />
        </div>
        <div className="text-center pt-2.5 pb-2 px-2">
            <h3 className="font-sans text-lg md:text-xl text-wood-900 font-medium tracking-wide">
                {cat.cat}
            </h3>
            <p className="font-sans text-base text-wood-700 mt-1 leading-relaxed sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500 ease-out">
                {cat.desc}
            </p>
        </div>
    </button>
);

// ─── Shop Hero Featured ───────────────────────────────────────────────────────

const ShopHero: React.FC<{
    products: Product[];
    onSelect: (p: Product) => void;
}> = ({ products, onSelect }) => {
    if (products.length < 1) return null;
    const [main, second] = products;

    return (
        <div className="max-w-[1800px] mx-auto px-6 mb-16 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">

                {/* Primary featured piece */}
                <button
                    type="button"
                    onClick={() => onSelect(main)}
                    className="group md:col-span-2 text-left overflow-hidden bg-wood-100 border border-wood-200 hover:border-wood-400 transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                >
                    <div className="relative overflow-hidden aspect-[4/3]">
                        <ArtImage publicId={main.image} alt={main.title} variant="product" />
                        <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/10 transition-all duration-500" />
                    </div>
                    <div className="p-6 md:p-8">
                        <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold">{main.category}</span>
                        <h2 className="font-serif text-2xl md:text-3xl text-wood-900 font-medium mt-1.5 mb-3 leading-snug group-hover:text-bronze-700 transition-colors">
                            {main.title}
                        </h2>
                        {main.material && (
                            <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold mb-3">{main.material}</p>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="font-sans text-lg text-wood-700 font-medium">
                                {main.highPrice
                                    ? `${formatPrice(main.price)} to ${formatPrice(main.highPrice)}`
                                    : formatPrice(main.price)}
                            </span>
                            <span className="font-label text-xs uppercase tracking-[0.1em] text-bronze-600 font-semibold flex items-center gap-1.5 group-hover:gap-3 transition-all duration-300">
                                View <ArrowRight size={12} />
                            </span>
                        </div>
                    </div>
                </button>

                {/* Secondary featured piece */}
                {second && (
                    <button
                        type="button"
                        onClick={() => onSelect(second)}
                        className="group text-left overflow-hidden bg-wood-100 border border-wood-200 hover:border-wood-400 transition-all duration-500 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                    >
                        <div className="relative overflow-hidden flex-1" style={{ minHeight: '220px' }}>
                            <ArtImage publicId={second.image} alt={second.title} variant="product" />
                            <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/10 transition-all duration-500" />
                        </div>
                        <div className="p-5 md:p-6 shrink-0">
                            <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold">{second.category}</span>
                            <h3 className="font-serif text-xl text-wood-900 font-medium mt-1 mb-2 leading-snug group-hover:text-bronze-700 transition-colors">
                                {second.title}
                            </h3>
                            <span className="font-sans text-base text-wood-700 font-medium">
                                {second.highPrice
                                    ? `${formatPrice(second.price)} to ${formatPrice(second.highPrice)}`
                                    : formatPrice(second.price)}
                            </span>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Shop Collection Card ─────────────────────────────────────────────────────

const ShopCollectionCard: React.FC<{
    collection: Collection;
    count: number;
    isActive: boolean;
    onClick: () => void;
}> = ({ collection, count, isActive, onClick }) => {
    const coverImage = getCollectionCoverImage(collection);

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isActive}
            className={`group relative aspect-[3/2] overflow-hidden w-full text-left transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 dark-preserve ${
                isActive
                    ? 'ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper-50'
                    : 'border border-wood-200 hover:border-wood-400'
            }`}
        >
            <div className="absolute inset-0 bg-wood-100" />
            <ArtImage
                publicId={coverImage}
                variant="cover"
                alt=""
                aria-hidden="true"
                inactive={!isActive}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/10 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 px-5 pb-4">
                <h4 className="font-serif text-xl text-paper-50 font-medium leading-tight">{collection.name}</h4>
                <span className="font-label text-[11px] uppercase tracking-[0.1em] text-paper-300 font-bold mt-1 block">
                    {count} {count === 1 ? 'Piece' : 'Pieces'}
                    {isActive && <span className="text-bronze-400 ml-2">· Active</span>}
                </span>
                {collection.description && (
                    <p className="hidden sm:block font-sans text-base text-paper-50 mt-1 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-500 delay-75">
                        {collection.description}
                    </p>
                )}
            </div>
        </button>
    );
};

// ─── Product Card ─────────────────────────────────────────────────────────────

const ProductCard: React.FC<{
    product: Product;
    onClick: () => void;
}> = ({ product, onClick }) => {
    const isAvailable = product.available;
    const isSquare = Boolean(product.dimensions?.toLowerCase().includes('square'));

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col cursor-pointer break-inside-avoid mb-6 sm:mb-8 lg:mb-10 transition-all duration-500"
        >
            <div className={`relative w-full bg-wood-100 overflow-hidden transition-shadow duration-500 group-hover:shadow-lg ${isSquare ? 'aspect-square' : ''}`}>
                <ArtImage
                    publicId={product.image}
                    alt={`${product.title} by Adrian Rasmussen${product.material ? `, ${product.material}` : ''}`}
                    variant={isSquare ? 'tile' : 'gallery'}
                    className={[isSquare ? '!object-contain' : '', !isAvailable ? 'opacity-60' : ''].filter(Boolean).join(' ')}
                />


                {/* Hover detail reveal — material + excerpt + View */}
                {isAvailable && (
                    <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/70 transition-all duration-500 flex flex-col justify-end p-4 pointer-events-none">
                        <div className="translate-y-3 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500 space-y-1.5">
                            {product.material && (
                                <p className="font-label text-[11px] uppercase tracking-[0.1em] text-bronze-300 font-semibold">
                                    {product.material}
                                </p>
                            )}
                            {product.description && (
                                <p className="font-sans text-base text-paper-50 leading-relaxed line-clamp-2">
                                    {product.description}
                                </p>
                            )}
                            <span className="font-label text-[11px] uppercase tracking-[0.1em] text-paper-50 font-semibold inline-block mt-0.5">
                                View
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Label band — matching GalleryTileCard style */}
            <div className="px-1 pt-3 pb-1">
                <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold">
                    {product.category}
                </span>
                <h3 className="font-serif text-xl md:text-2xl text-wood-900 leading-snug group-hover:text-bronze-700 transition-colors font-medium mt-1">
                    {product.title}
                </h3>

                {/* Material · Dimensions dots line */}
                {(product.material || product.dimensions) && (
                    <p className="mt-1 font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold leading-relaxed">
                        {[product.material, product.dimensions].filter(Boolean).join(' · ')}
                    </p>
                )}

                {/* Edition info */}
                {product.edition && (
                    <p className="mt-0.5 font-label text-[11px] uppercase tracking-[0.1em] text-bronze-600 font-semibold">
                        {product.edition}
                    </p>
                )}

                {isAvailable ? (
                    <div className="mt-1.5 flex items-baseline justify-between gap-3">
                        <span className="font-sans text-base text-wood-600 font-medium">
                            {product.highPrice
                                ? `${formatPrice(product.price)} to ${formatPrice(product.highPrice)}`
                                : formatPrice(product.price)}
                        </span>
                        <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold">
                            {product.hasVariants ? 'Multiple sizes' : product.isReadyToShip ? 'Ready to ship' : 'Made to order'}
                        </span>
                    </div>
                ) : (
                    <span className="block mt-1.5 font-sans text-base text-wood-700">Private Collection</span>
                )}
            </div>
        </div>
    );
};

// ─── Inspection Drawer ────────────────────────────────────────────────────────

const InspectionDrawer: React.FC<{
    product: Product | null;
    allProducts: Product[];
    onClose: () => void;
    onViewImage: (img: string) => void;
    onSelectProduct: (p: Product) => void;
}> = ({ product, allProducts, onClose, onViewImage, onSelectProduct }) => {
    const [animClass, setAnimClass] = useState('translate-x-full');
    const [loaded, setLoaded] = useState(false);
    const { addToCart, items } = useCart();
    const inCart = product ? items.some(i => i.product.id === product.id) : false;

    useEffect(() => {
        if (product) {
            setLoaded(false);
            requestAnimationFrame(() => setAnimClass('translate-x-0'));
            if (typeof document !== 'undefined' && document.body) {
                document.body.style.overflow = 'hidden';
            }
        } else {
            setAnimClass('translate-x-full');
            if (typeof document !== 'undefined' && document.body) {
                document.body.style.overflow = '';
            }
        }
        return () => {
            if (typeof document !== 'undefined' && document.body) {
                document.body.style.overflow = '';
            }
        };
    }, [product]);

    useEffect(() => {
        if (!product) return;
        const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [product, onClose]);

    // Related story slug — look up from FULL_ARCHIVE
    const relatedStorySlug = useMemo(() => {
        if (!product) return null;
        return FULL_ARCHIVE.find(a => a.id === product.id)?.relatedStorySlug ?? null;
    }, [product]);

    // You Might Also Like — same category, different product, available
    const related = useMemo(() => {
        if (!product) return [];
        return allProducts
            .filter(p => p.id !== product.id && p.category === product.category && p.available)
            .slice(0, 3);
    }, [product, allProducts]);

    if (!product || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[2000] flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label={`${product.title} details`}
        >
            <div
                className="absolute inset-0 bg-wood-900/30 backdrop-blur-sm transition-opacity duration-500"
                onClick={onClose}
            />

            <div
                className={`relative w-full max-w-[600px] h-full bg-paper-50 border-l border-wood-200 shadow-2xl flex flex-col transition-transform duration-500 ${animClass}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
                {/* Header */}
                <div className="h-16 border-b border-wood-200 flex items-center justify-between px-6 bg-paper-50 z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                            product.available
                                ? (product.isReadyToShip || product.hasVariants ? 'bg-green-500' : 'bg-bronze-500')
                                : 'bg-wood-400'
                        }`} />
                        <span className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold">
                            Ref: {product.id}
                        </span>
                        {product.available && product.hasVariants && (
                            <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 bg-wood-100 border border-wood-200 px-2 py-0.5 font-semibold">
                                Multiple Sizes
                            </span>
                        )}
                        {product.available && !product.isReadyToShip && !product.hasVariants && (
                            <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 bg-bronze-50 border border-bronze-200 px-2 py-0.5 font-semibold">
                                Crafted for You
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 -mr-4 hover:bg-wood-100 rounded-full transition-colors group flex items-center gap-2"
                    >
                        <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold hidden sm:inline">Close</span>
                        <X size={28} className="text-wood-900 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-paper-50/50">

                    {/* Product image with zoom trigger */}
                    <div
                        className="w-full bg-wood-50 border border-wood-200 mb-4 overflow-hidden relative group cursor-zoom-in"
                        onClick={() => onViewImage(img(product.image, { w: 1600 }))}
                    >
                        <img
                            src={img(product.image, { w: 1200 })}
                            alt={product.title}
                            onLoad={() => setLoaded(true)}
                            className={`w-full h-auto object-cover transition-all duration-1000 ${loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-lg'}`}
                        />
                        <div className="absolute top-4 right-4 bg-wood-900/10 backdrop-blur-md p-2 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Maximize2 size={16} className="text-wood-900" />
                        </div>
                    </div>

                    {/* View in Gallery link */}
                    <Link
                        to={`/creations/${product.id}`}
                        onClick={onClose}
                        className="flex items-center gap-1.5 mb-8 font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 hover:text-bronze-600 font-semibold transition-colors"
                    >
                        <ArrowRight size={10} />
                        View in full gallery
                    </Link>

                    {/* Title + Description */}
                    <div className="mb-8">
                        <h1 className="text-3xl md:text-4xl font-serif text-wood-900 mb-4 leading-[1.1] font-medium">
                            {product.title}
                        </h1>
                        <p className="font-sans text-lg text-wood-700 leading-[1.7] font-normal">
                            {product.longDescription || product.description}
                        </p>

                        {/* Story link */}
                        {relatedStorySlug && (
                            <Link
                                to={`/writings/${relatedStorySlug}`}
                                onClick={onClose}
                                className="mt-4 inline-flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.1em] text-bronze-600 hover:text-bronze-700 font-semibold transition-colors"
                            >
                                <BookOpen size={12} />
                                Read the story behind this piece
                            </Link>
                        )}
                    </div>

                    {/* Metadata grid */}
                    <div className="border-t border-b border-wood-200 py-8 mb-8 grid grid-cols-2 gap-y-8 gap-x-4">
                        <div>
                            <span className="block font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-1 font-semibold">Origin</span>
                            <span className="font-sans text-lg text-wood-900">{product.origin || 'Studio'}</span>
                        </div>
                        <div>
                            <span className="block font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-1 font-semibold">Material</span>
                            <span className="font-sans text-lg text-wood-900">{product.material || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-1 font-semibold">Weight</span>
                            <span className="font-sans text-lg text-wood-900">{product.weight || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-1 font-semibold">Dimensions</span>
                            <span className="font-sans text-lg text-wood-900">{product.dimensions || 'N/A'}</span>
                        </div>
                        {product.edition && (
                            <div className="col-span-2">
                                <span className="block font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-1 font-semibold">Edition</span>
                                <span className="font-sans text-lg text-wood-900">{product.edition}</span>
                            </div>
                        )}
                    </div>

                    {/* Authentic Artifact badge */}
                    <div className="flex items-center gap-4 p-4 bg-wood-100/50 border border-wood-200">
                        <ShieldCheck size={20} className="text-bronze-600 shrink-0" />
                        <div className="flex flex-col">
                            <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">Authentic Artifact</span>
                            <span className="text-xs text-wood-600 font-serif">Verified and cataloged by the studio.</span>
                        </div>
                    </div>

                    {/* Multiple sizes */}
                    {product.available && product.hasVariants && (
                        <div className="flex items-center gap-4 p-4 bg-wood-50 border border-wood-200 mt-4">
                            <Package size={20} className="text-wood-600 shrink-0" />
                            <div className="flex flex-col">
                                <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">Available in multiple sizes</span>
                                <span className="text-xs text-wood-600 font-serif">Configure your piece on the detail page. Some sizes may ship sooner.</span>
                            </div>
                        </div>
                    )}

                    {/* Made to Order — reframed as invitation */}
                    {product.available && !product.isReadyToShip && !product.hasVariants && (
                        <div className="flex items-center gap-4 p-4 bg-bronze-50 border border-bronze-200 mt-4">
                            <Package size={20} className="text-bronze-600 shrink-0" />
                            <div className="flex flex-col">
                                <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">Crafted for You</span>
                                <span className="text-xs text-wood-600 font-serif">
                                    This piece is created upon your request. Every detail is attended to with care. Allow 1 to 3 weeks for your piece to arrive.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* You Might Also Like */}
                    {related.length > 0 && (
                        <div className="mt-10 pt-8 border-t border-wood-200">
                            <span className="block font-label text-xs uppercase tracking-[0.1em] text-wood-700 mb-5 font-semibold">
                                You Might Also Like
                            </span>
                            <div className="space-y-3">
                                {related.map(rp => (
                                    <button
                                        key={rp.id}
                                        onClick={() => onSelectProduct(rp)}
                                        className="group w-full flex gap-4 text-left hover:bg-wood-50 transition-colors p-2 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500"
                                    >
                                        <div className="w-20 h-20 bg-wood-100 overflow-hidden shrink-0">
                                            <ArtImage publicId={rp.image} alt={rp.title} variant="product" />
                                        </div>
                                        <div className="flex-1 min-w-0 py-1">
                                            <h4 className="font-sans text-base text-wood-900 font-medium leading-snug group-hover:text-bronze-700 transition-colors truncate">
                                                {rp.title}
                                            </h4>
                                            <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold mt-0.5 truncate">
                                                {rp.category}
                                            </p>
                                            <span className="font-sans text-sm text-wood-600 font-medium mt-1 block">
                                                {rp.highPrice
                                                    ? `${formatPrice(rp.price)} to ${formatPrice(rp.highPrice)}`
                                                    : formatPrice(rp.price)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pb-24" />
                </div>

                {/* Sticky footer CTA */}
                <div className="border-t border-wood-200 p-6 bg-paper-50 sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold">Valuation</span>
                        <span className="font-label text-xl text-wood-900 font-semibold">
                            {product.highPrice
                                ? `${formatPrice(product.price)} to ${formatPrice(product.highPrice)}`
                                : formatPrice(product.price)}
                        </span>
                    </div>
                    {product.available ? (
                        product.hasVariants ? (
                            <Link
                                to={`/creations/${product.id}`}
                                onClick={onClose}
                                className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl"
                            >
                                Configure <ArrowRight size={16} />
                            </Link>
                        ) : product.isReadyToShip ? (
                            <button
                                onClick={() => addToCart(product)}
                                className={`w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg ${
                                    inCart
                                        ? 'bg-bronze-700 text-paper-50'
                                        : 'bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl'
                                }`}
                            >
                                {inCart
                                    ? <><Check size={16} /> Added to Cart</>
                                    : <><ShoppingBag size={16} /> Add to Cart</>}
                            </button>
                        ) : (
                            <Link
                                to={`/creations/${product.id}`}
                                onClick={onClose}
                                className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl"
                            >
                                Configure <ArrowRight size={16} />
                            </Link>
                        )
                    ) : (
                        <div className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] font-semibold bg-wood-200 text-wood-400 cursor-not-allowed">
                            Private Collection
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// ─── Control Deck (softened) ──────────────────────────────────────────────────

const ControlDeck: React.FC<{
    count: number;
    sort: string;
    setSort: (s: 'NEW' | 'PRICE_ASC' | 'PRICE_DESC') => void;
    filters: string[];
    setFilters: (f: string[]) => void;
    search: string;
    setSearch: (s: string) => void;
}> = ({ count, sort, setSort, filters, setFilters, search, setSearch }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleCat = (cat: string) => {
        const next = filters.includes(cat)
            ? filters.filter(c => c !== cat)
            : [...filters, cat];
        setFilters(next);
    };

    return (
        <div className="sticky top-[var(--nav-height)] z-40 bg-paper-50 backdrop-blur-md border-b border-wood-100 shadow-sm">
            <div className="max-w-[1800px] mx-auto px-6 h-14 flex items-center gap-5">

                {/* Filter toggle — minimal text style */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-1.5 font-label text-xs uppercase tracking-[0.1em] font-semibold transition-colors shrink-0 focus-visible:outline-none focus-visible:underline ${
                        isOpen || filters.length > 0 ? 'text-wood-900' : 'text-wood-700 hover:text-wood-900'
                    }`}
                >
                    <SlidersHorizontal size={12} aria-hidden="true" />
                    Filter
                    {filters.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-bronze-500 ml-0.5" />
                    )}
                </button>

                <span className="text-wood-200 text-xs" aria-hidden="true">|</span>

                {/* Search — underline style */}
                <div className="flex items-center gap-2 flex-1 max-w-sm border-b border-wood-200 focus-within:border-wood-600 transition-colors">
                    <Search size={12} className="text-wood-300 shrink-0" aria-hidden="true" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        aria-label="Search products"
                        className="bg-transparent font-label text-xs text-wood-900 outline-none placeholder:text-wood-300 w-full py-1 tracking-wide"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="text-wood-300 hover:text-wood-900 transition-colors shrink-0"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>

                {/* Sort — right side */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <span className="hidden sm:inline font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold">Sort</span>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as 'NEW' | 'PRICE_ASC' | 'PRICE_DESC')}
                        aria-label="Sort products"
                        className="bg-transparent font-label text-xs uppercase tracking-[0.1em] text-wood-700 outline-none cursor-pointer border-b border-transparent hover:border-wood-600 transition-colors font-semibold max-w-[90px]"
                    >
                        <option value="NEW">Newest</option>
                        <option value="PRICE_ASC">Low $</option>
                        <option value="PRICE_DESC">High $</option>
                    </select>
                </div>

                {/* Results count */}
                <span
                    className="hidden lg:inline font-label text-[10px] uppercase tracking-[0.15em] text-wood-300 font-semibold shrink-0"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {count} results
                </span>
            </div>

            {/* Expandable filter panel */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out bg-wood-50/80 border-b border-wood-100 ${isOpen ? 'max-h-[180px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="max-w-[1800px] mx-auto px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                        {STORE_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => toggleCat(cat)}
                                className={`px-4 py-2 text-xs font-label uppercase tracking-[0.2em] font-semibold border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 ${
                                    filters.includes(cat)
                                        ? 'bg-wood-900 text-paper-50 border-wood-900'
                                        : 'bg-paper-50 text-wood-600 border-wood-200 hover:border-wood-500'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                        {filters.length > 0 && (
                            <button
                                onClick={() => setFilters([])}
                                className="px-3 py-2 text-xs font-label uppercase tracking-[0.1em] font-semibold text-wood-700 hover:text-wood-900 transition-colors flex items-center gap-1"
                            >
                                <X size={10} /> Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Commission Cross-Sell ────────────────────────────────────────────────────

const CommissionSection: React.FC = () => (
    <div className="border-t border-wood-100 mt-16">
        <div className="max-w-[1800px] mx-auto px-6 py-20">
            <div className="max-w-xl mx-auto text-center">
                <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 block mb-4 font-semibold">Commission</span>
                <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-5 leading-snug">
                    Don't see exactly what you're looking for?
                </h2>
                <p className="font-sans text-lg text-wood-700 leading-[1.7] mb-8">
                    Every piece here can be a starting point for something uniquely yours. A different size, a different material, or a completely new vision.
                </p>
                <Link
                    to="/inquire"
                    className="inline-flex items-center gap-3 px-10 py-4 border border-wood-900 text-wood-900 font-label text-xs uppercase tracking-[0.2em] hover:bg-wood-900 hover:text-paper-50 transition-all duration-300 font-semibold"
                >
                    Begin a conversation <ArrowRight size={14} />
                </Link>
            </div>
        </div>
    </div>
);

// ─── Store (Main) ─────────────────────────────────────────────────────────────

const Store: React.FC = () => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filters, setFilters] = useState<string[]>([]);
    const [sort, setSort] = useState<'NEW' | 'PRICE_ASC' | 'PRICE_DESC'>('NEW');
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(12);
    const [activeCollection, setActiveCollection] = useState<string | null>(null);
    const [checkoutBanner, setCheckoutBanner] = useState<'success' | 'cancelled' | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const { clearCart, closeCart } = useCart();
    const sentinelRef = useRef<HTMLDivElement>(null);

    const isUnfiltered = filters.length === 0 && !search.trim();

    // Canonical tag: filtered URLs canonicalize to /shop so search engines don't index them
    useEffect(() => {
        const hasFilters = filters.length > 0 || search.trim().length > 0 || sort !== 'NEW' || activeCollection !== null;
        let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = hasFilters
            ? 'https://adrianrasmussen.com/shop'
            : `https://adrianrasmussen.com${window.location.pathname}`;

        return () => {
            // Reset canonical on unmount
            if (link) link.href = 'https://adrianrasmussen.com/shop';
        };
    }, [filters, search, sort, activeCollection]);

    // Handle Stripe redirect
    useEffect(() => {
        const status = searchParams.get('checkout');
        if (status === 'success') {
            clearCart();
            closeCart();
            setCheckoutBanner('success');
            setSearchParams({}, { replace: true });
        } else if (status === 'cancelled') {
            setCheckoutBanner('cancelled');
            setSearchParams({}, { replace: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Animation state on filter/search/sort change
    useEffect(() => {
        setIsFiltering(true);
        setVisibleCount(12);
        setActiveCollection(null);
        const timer = setTimeout(() => setIsFiltering(false), 500);
        return () => clearTimeout(timer);
    }, [filters, sort, search]);

    // Filtered + sorted products
    const filteredProducts = useMemo(() => {
        let result = INVENTORY;
        if (filters.length > 0) result = result.filter(p => filters.includes(p.category));
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                (p.material?.toLowerCase().includes(q) ?? false) ||
                (p.description?.toLowerCase().includes(q) ?? false)
            );
        }
        if (activeCollection) {
            const col = COLLECTIONS.find(c => c.id === activeCollection);
            if (col) {
                const ids = getCollectionProductIds(col);
                result = result.filter(p => ids.has(p.id));
            }
        }
        if (sort === 'PRICE_ASC') result = [...result].sort((a, b) => a.price - b.price);
        if (sort === 'PRICE_DESC') result = [...result].sort((a, b) => b.price - a.price);
        return result;
    }, [filters, sort, search, activeCollection]);

    // Hero: first 2 available products
    const heroProducts = useMemo(() => INVENTORY.filter(p => p.available).slice(0, 2), []);

    // Collections for the currently filtered category
    const shopCollections = useMemo(() => {
        if (filters.length !== 1) return [];
        return COLLECTIONS.filter(c => c.category === filters[0]);
    }, [filters]);

    // Infinite scroll via IntersectionObserver
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && filteredProducts.length > visibleCount) {
                    setVisibleCount(v => v + 12);
                }
            },
            { rootMargin: '400px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [filteredProducts.length, visibleCount]);

    // Grid items with interstitials woven in at natural positions
    const gridItems = useMemo(() => {
        const items: React.ReactNode[] = [];
        const sliced = filteredProducts.slice(0, visibleCount);
        sliced.forEach((p, idx) => {
            if (idx === 3)  items.push(<PhilosophyBlock key="__phil" />);
            if (idx === 9)  items.push(<ProcessBlock key="__proc" />);
            if (idx === 15) items.push(<MaterialBlock key="__mat" />);
            items.push(
                <ProductCard key={p.id} product={p} onClick={() => setSelectedProduct(p)} />
            );
        });
        return items;
    }, [filteredProducts, visibleCount]);

    return (
        <section className="pt-24 min-h-screen bg-paper-50 animate-fade-in">

            {/* Checkout banners */}
            {checkoutBanner === 'success' && (
                <div className="bg-green-50 border-b border-green-200 px-6 py-4 flex items-center justify-between">
                    <p className="font-label text-xs uppercase tracking-[0.2em] text-green-800 font-semibold">
                        Your order was placed successfully. Thank you.
                    </p>
                    <button onClick={() => setCheckoutBanner(null)} className="text-green-600 hover:text-green-900 transition-colors">
                        <X size={16} />
                    </button>
                </div>
            )}
            {checkoutBanner === 'cancelled' && (
                <div className="bg-wood-50 border-b border-wood-200 px-6 py-4 flex items-center justify-between">
                    <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-600 font-semibold">
                        Checkout was cancelled. Your cart has been preserved.
                    </p>
                    <button onClick={() => setCheckoutBanner(null)} className="text-wood-400 hover:text-wood-900 transition-colors">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Page header */}
            <div className="pt-16 pb-12 px-6 text-center max-w-4xl mx-auto border-b border-wood-100 mb-10">
                <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 block mb-4 font-semibold">Shop</span>
                <h1 className="font-display text-5xl md:text-7xl text-wood-900 mb-6 font-normal tracking-tight leading-[1.05]">
                    Available Pieces
                </h1>
                <p className="font-serif text-xl text-wood-700 max-w-2xl mx-auto leading-[1.7]">
                    A curated selection of works ready for your home, alongside pieces made to your commission.
                </p>
            </div>

            {/* Hero featured — only when no filters/search */}
            {isUnfiltered && (
                <ShopHero products={heroProducts} onSelect={setSelectedProduct} />
            )}

            {/* Category tiles — visible unless searching; active tile acts as a toggle */}
            {!search.trim() && (
                <div className="max-w-[1800px] mx-auto px-6 mb-14">
                    <div className="mb-8 flex items-center gap-4">
                        <span className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold shrink-0">Browse by Category</span>
                        <div className="flex-1 h-px bg-wood-100" />
                    </div>
                    <div
                        className="grid grid-cols-2 gap-4 sm:gap-6 lg:gap-8 card-stagger"
                        role="list"
                        aria-label="Shop categories"
                    >
                        {SHOP_CATEGORY_DATA.map(cat => (
                            <div key={cat.cat} role="listitem">
                                <ShopCategoryTile
                                    cat={cat}
                                    isActive={filters.includes(cat.cat)}
                                    onSelect={() => {
                                        const next = filters.includes(cat.cat) ? [] : [cat.cat];
                                        setFilters(next);
                                        if (next.length > 0) {
                                            setTimeout(() => {
                                                document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }, 50);
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Control deck — sticky */}
            <ControlDeck
                count={filteredProducts.length}
                sort={sort}
                setSort={setSort}
                filters={filters}
                setFilters={setFilters}
                search={search}
                setSearch={setSearch}
            />

            {/* Collection cards — shown when a single category with collections is filtered */}
            {shopCollections.length > 0 && !isFiltering && (
                <div className="max-w-[1800px] mx-auto px-6 mt-8 mb-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shopCollections.map(col => {
                            const ids = getCollectionProductIds(col);
                            const count = INVENTORY.filter(p => ids.has(p.id)).length;
                            if (count === 0) return null;
                            return (
                                <ShopCollectionCard
                                    key={col.id}
                                    collection={col}
                                    count={count}
                                    isActive={activeCollection === col.id}
                                    onClick={() => setActiveCollection(prev => prev === col.id ? null : col.id)}
                                />
                            );
                        })}
                    </div>
                    {activeCollection && (
                        <button
                            type="button"
                            onClick={() => setActiveCollection(null)}
                            className="mt-5 font-label text-xs uppercase tracking-[0.1em] text-wood-700 hover:text-wood-900 font-semibold transition-colors focus-visible:outline-none focus-visible:underline"
                        >
                            ← Show all in {filters[0]}
                        </button>
                    )}
                </div>
            )}

            {/* Main masonry grid */}
            <main id="shop-grid" className="max-w-[1800px] mx-auto px-6 py-10 min-h-[60vh]">
                {isFiltering ? (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 sm:gap-6 lg:gap-8">
                        {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <Search size={40} className="text-wood-200 mb-6" />
                        <p className="font-serif text-2xl text-wood-700 mb-3">No pieces found.</p>
                        <p className="font-label text-xs uppercase tracking-[0.1em] text-wood-700 font-semibold">
                            Try adjusting your search or filters.
                        </p>
                    </div>
                ) : (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 sm:gap-6 lg:gap-8 card-stagger">
                        {gridItems}
                    </div>
                )}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-px mt-4" aria-hidden="true" />
            </main>

            {/* Commission cross-sell */}
            <CommissionSection />

            {/* Back to top */}
            <BackToTop />

            {/* Inspection drawer */}
            <InspectionDrawer
                product={selectedProduct}
                allProducts={INVENTORY}
                onClose={() => setSelectedProduct(null)}
                onViewImage={setViewingImage}
                onSelectProduct={setSelectedProduct}
            />

            {/* Full-screen lightbox */}
            {viewingImage && (
                <VisualLightbox
                    images={[viewingImage]}
                    onClose={() => setViewingImage(null)}
                />
            )}
        </section>
    );
};

export default Store;
