
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ArtImage from './ArtImage';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Product } from '../types';
import { INVENTORY, STORE_CATEGORIES } from '../data/mockData';
import {
    X, Search, SlidersHorizontal, ArrowRight, Eye, ShieldCheck,
    Maximize2, ArrowLeft, Package, ShoppingBag, Check
} from 'lucide-react';
import { useCart } from '../CartContext';

// --- HELPERS ---

const formatPrice = (price: number) => `$${price.toLocaleString('en-US')}`;

// --- SUB-COMPONENTS ---

interface ZoomableImageProps {
    src: string;
    alt: string;
    onDoubleTap?: () => void;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt, onDoubleTap }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const lastPos = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const handleStart = (clientX: number, clientY: number) => {
        startPos.current = { x: clientX, y: clientY };
        lastPos.current = { x: clientX, y: clientY };
        setDragging(true);
    };

    const handleMove = (clientX: number, clientY: number, e: React.TouchEvent | React.MouseEvent) => {
        if (!dragging) return;
        if (scale > 1) {
            const dx = clientX - lastPos.current.x;
            const dy = clientY - lastPos.current.y;
            setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPos.current = { x: clientX, y: clientY };
        }
    };

    const handleEnd = () => {
        setDragging(false);
    };

    const toggleZoom = () => {
        if (scale > 1) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        } else {
            setScale(2.5);
        }
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full flex items-center justify-center overflow-hidden touch-none ${scale > 1 ? 'cursor-move' : 'cursor-zoom-in'}`}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY, e)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => e.touches.length === 1 && handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => e.touches.length === 1 && handleMove(e.touches[0].clientX, e.touches[0].clientY, e)}
            onTouchEnd={handleEnd}
            onClick={(e) => {
                if (Math.abs(e.clientX - startPos.current.x) < 5 && Math.abs(e.clientY - startPos.current.y) < 5) {
                    toggleZoom();
                }
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                if (onDoubleTap) onDoubleTap();
            }}
        >
            <img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out select-none pointer-events-none"
                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                draggable={false}
            />
        </div>
    );
};

const VisualLightbox: React.FC<{ src: string; onClose: () => void; }> = ({ src, onClose }) => {
    if (typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] bg-paper-50 flex flex-col animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full h-16 flex items-center justify-between px-6 bg-paper-50 border-b border-wood-200 z-50 shrink-0">
                <button onClick={onClose} className="group flex items-center gap-2 text-wood-600 hover:text-wood-900 px-4 py-2 rounded-full transition-colors">
                     <ArrowLeft size={16} />
                     <span className="font-label text-xs uppercase tracking-[0.2em] font-semibold">Close</span>
                </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-0 md:p-8 overflow-hidden bg-wood-100/50">
                <ZoomableImage src={src} alt="Detail" />
            </div>
        </div>,
        document.body
    );
};

const SkeletonCard: React.FC = () => (
    <div className="flex flex-col animate-pulse">
        <div className="w-full bg-wood-200 aspect-[4/5] md:h-[500px]"></div>
        <div className="mt-4 space-y-2 px-1">
            <div className="h-6 bg-wood-200 rounded w-3/4"></div>
            <div className="h-4 bg-wood-100 rounded w-1/2"></div>
        </div>
    </div>
);

const CuratorialBlock: React.FC = () => (
    <div className="col-span-1 md:col-span-2 lg:col-span-2 aspect-square md:aspect-auto flex flex-col justify-center items-center bg-wood-900 text-paper-50 p-8 md:p-12 text-center border border-wood-900 dark-preserve">
        <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-400 mb-4 block font-semibold">Philosophy</span>
        <p className="font-serif text-xl md:text-3xl leading-[1.4] max-w-lg font-light">
            <span className="ml-[-0.4em]">"</span>We do not own these objects. We are merely their custodians for a brief moment in time."
        </p>
        <div className="w-12 h-px bg-bronze-500 mt-8"></div>
    </div>
);

const ProductCard: React.FC<{
    product: Product;
    index: number;
    onClick: () => void;
}> = ({ product, index, onClick }) => {
    const isWide = (index + 1) % 3 === 0;
    const spanClass = isWide ? 'md:col-span-2' : 'col-span-1';

    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col cursor-pointer ${spanClass} mb-12 md:mb-0`}
        >
            <div className="relative w-full bg-wood-100 overflow-hidden mb-4 aspect-[4/5] md:aspect-auto md:h-[500px] transition-shadow duration-500 group-hover:shadow-lg">
                <ArtImage
                    src={product.image}
                    alt={`${product.title} by Adrian Rasmussen, ${product.material || 'mixed media'}`}
                    variant="product"
                    style={!product.available ? { opacity: 0.7 } : undefined}
                    className={!product.available ? 'grayscale sepia-[0.3]' : ''}
                />

                {/* Availability badge — top left, consistent style */}
                {!product.available && (
                    <div className="absolute top-3 left-3 bg-wood-900/85 backdrop-blur-sm text-paper-50 px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.15em] font-semibold dark-preserve">
                        Archived
                    </div>
                )}
                {product.available && !product.isReadyToShip && !product.hasVariants && (
                    <div className="absolute top-3 left-3 bg-paper-50/95 backdrop-blur-sm px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.15em] text-avail-order font-semibold">
                        Made to order
                    </div>
                )}
                {product.available && product.hasVariants && (
                    <div className="absolute top-3 left-3 bg-paper-50/95 backdrop-blur-sm px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.15em] text-wood-600 font-semibold">
                        Multiple sizes
                    </div>
                )}

                {/* Hover overlay — unified with gallery cards */}
                {product.available && (
                    <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/15 transition-all duration-500 flex items-center justify-center">
                        <span className="font-label text-[11px] uppercase tracking-[0.25em] text-paper-50 font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 bg-wood-900/50 backdrop-blur-sm px-5 py-2.5">
                            View
                        </span>
                    </div>
                )}
            </div>

            {/* Label band — stacked layout matching GalleryTileCard */}
            <div className="px-1">
                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 font-semibold">
                    {product.category}
                </span>
                <h3 className="font-serif text-xl md:text-2xl text-wood-900 leading-snug group-hover:text-bronze-700 transition-colors font-medium mt-1">
                    {product.title}
                </h3>
                <span className="block mt-1.5 font-serif text-base text-wood-600 font-medium">
                    {product.highPrice
                        ? `${formatPrice(product.price)} to ${formatPrice(product.highPrice)}`
                        : formatPrice(product.price)}
                </span>
            </div>
        </div>
    );
};

const InspectionDrawer: React.FC<{
    product: Product | null;
    onClose: () => void;
    onViewImage: (img: string) => void;
}> = ({ product, onClose, onViewImage }) => {
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
        }
    }, [product]);

    // #25 Close drawer on Escape key
    useEffect(() => {
        if (!product) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [product, onClose]);

    if (!product || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex justify-end">
            <div
                className="absolute inset-0 bg-wood-900/30 backdrop-blur-sm transition-opacity duration-500"
                onClick={onClose}
            ></div>

            <div className={`relative w-full max-w-[600px] h-full bg-paper-50 border-l border-wood-200 shadow-2xl flex flex-col transition-transform duration-500 cubic-bezier(0.22, 1, 0.36, 1) ${animClass}`}>

                <div className="h-16 border-b border-wood-200 flex items-center justify-between px-6 bg-paper-50 z-10 shrink-0">
                    <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${product.available ? (product.isReadyToShip ? 'bg-green-500' : product.hasVariants ? 'bg-green-500' : 'bg-bronze-500') : 'bg-wood-400'} animate-pulse`}></div>
                         <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">
                             Ref: {product.id}
                         </span>
                         {product.available && product.hasVariants && (
                             <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 bg-wood-100 border border-wood-200 px-2 py-0.5 font-semibold">
                                 Multiple Sizes
                             </span>
                         )}
                         {product.available && !product.isReadyToShip && !product.hasVariants && (
                             <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 bg-bronze-50 border border-bronze-200 px-2 py-0.5 font-semibold">
                                 Made to Order
                             </span>
                         )}
                    </div>
                    <button onClick={onClose} className="p-4 -mr-4 hover:bg-wood-100 rounded-full transition-colors group flex items-center gap-2">
                        <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold hidden sm:inline">Close</span>
                        <X size={28} className="text-wood-900 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar bg-paper-50/50">
                    <div
                        className="w-full bg-wood-50 border border-wood-200 mb-10 overflow-hidden relative group cursor-zoom-in"
                        onClick={() => onViewImage(product.image)}
                    >
                        <img
                            src={product.image}
                            onLoad={() => setLoaded(true)}
                            className={`w-full h-auto object-cover transition-all duration-1000 ${loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-lg'}`}
                        />
                        <div className="absolute top-4 right-4 bg-wood-900/10 backdrop-blur-md p-2 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Maximize2 size={16} className="text-wood-900" />
                        </div>
                    </div>

                    <div className="mb-10">
                        <h1 className="text-4xl md:text-5xl font-serif text-wood-900 mb-6 leading-[1.1] font-medium">{product.title}</h1>
                        <p className="font-serif text-lg text-wood-700 leading-[1.7] font-normal">
                            {product.longDescription || product.description}
                        </p>
                    </div>

                    <div className="border-t border-b border-wood-200 py-8 mb-8 grid grid-cols-2 gap-y-8 gap-x-4">
                        <div>
                             <span className="block font-label text-xs uppercase tracking-[0.2em] text-wood-400 mb-1 font-semibold">Origin</span>
                             <span className="font-serif text-lg text-wood-900">{product.origin || 'Studio'}</span>
                        </div>
                        <div>
                             <span className="block font-label text-xs uppercase tracking-[0.2em] text-wood-400 mb-1 font-semibold">Material</span>
                             <span className="font-serif text-lg text-wood-900">{product.material}</span>
                        </div>
                        <div>
                             <span className="block font-label text-xs uppercase tracking-[0.2em] text-wood-400 mb-1 font-semibold">Weight</span>
                             <span className="font-serif text-lg text-wood-900">{product.weight || 'N/A'}</span>
                        </div>
                        <div>
                             <span className="block font-label text-xs uppercase tracking-[0.2em] text-wood-400 mb-1 font-semibold">Dimensions</span>
                             <span className="font-serif text-lg text-wood-900">{product.dimensions || 'N/A'}</span>
                        </div>
                        {product.edition && (
                            <div className="col-span-2">
                                 <span className="block font-label text-xs uppercase tracking-[0.2em] text-wood-400 mb-1 font-semibold">Edition</span>
                                 <span className="font-serif text-lg text-wood-900">{product.edition}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-wood-100/50 border border-wood-200">
                        <ShieldCheck size={20} className="text-bronze-600 shrink-0" />
                        <div className="flex flex-col">
                             <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">Authentic Artifact</span>
                             <span className="text-xs text-wood-600 font-serif">Verified and cataloged by the studio.</span>
                        </div>
                    </div>

                    {product.available && product.hasVariants && (
                        <div className="flex items-center gap-4 p-4 bg-wood-50 border border-wood-200 mt-4">
                            <Package size={20} className="text-wood-600 shrink-0" />
                            <div className="flex flex-col">
                                 <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">Available in multiple sizes</span>
                                 <span className="text-xs text-wood-600 font-serif">Configure your piece on the detail page. Some sizes may ship sooner.</span>
                            </div>
                        </div>
                    )}
                    {product.available && !product.isReadyToShip && !product.hasVariants && (
                        <div className="flex items-center gap-4 p-4 bg-bronze-50 border border-bronze-200 mt-4">
                            <Package size={20} className="text-bronze-600 shrink-0" />
                            <div className="flex flex-col">
                                 <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">Made to Order</span>
                                 <span className="text-xs text-wood-600 font-serif">This piece is crafted upon commission. Lead time is 4 to 6 weeks.</span>
                            </div>
                        </div>
                    )}

                    <div className="pb-24"></div>
                </div>

                <div className="border-t border-wood-200 p-6 bg-paper-50 sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">Valuation</span>
                        <span className="font-label text-xl text-wood-900 font-semibold">
                            {product.highPrice
                                ? `${formatPrice(product.price)} to ${formatPrice(product.highPrice)}`
                                : formatPrice(product.price)}
                        </span>
                    </div>
                    {product.available ? (
                        product.hasVariants ? (
                            <a
                                href={`/creations/${product.id}`}
                                className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl"
                            >
                                Configure <ArrowRight size={16} />
                            </a>
                        ) : product.isReadyToShip ? (
                            <button
                                onClick={() => addToCart(product)}
                                className={`w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg ${inCart ? 'bg-bronze-700 text-paper-50' : 'bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl'}`}
                            >
                                {inCart ? <><Check size={16} /> Added to Cart</> : <><ShoppingBag size={16} /> Add to Cart</>}
                            </button>
                        ) : (
                            <a
                                href={`/creations/${product.id}`}
                                className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl"
                            >
                                Configure <ArrowRight size={16} />
                            </a>
                        )
                    ) : (
                        <div className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] font-semibold bg-wood-200 text-wood-400 cursor-not-allowed shadow-none">
                            Private Collection
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const ControlDeck: React.FC<{
    count: number;
    sort: string;
    setSort: (s: any) => void;
    filters: string[];
    setFilters: (f: any) => void;
    search: string;
    setSearch: (s: string) => void;
}> = ({ count, sort, setSort, filters, setFilters, search, setSearch }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleCat = (cat: string) => {
        const newCats = filters.includes(cat)
            ? filters.filter(c => c !== cat)
            : [...filters, cat];
        setFilters(newCats);
    };

    return (
        <div className="sticky top-[72px] z-40 bg-paper-50/95 backdrop-blur-md border-b border-wood-200 transition-all shadow-sm">
            <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all shrink-0 ${isOpen ? 'bg-wood-900 text-paper-50 border-wood-900' : 'bg-white text-wood-600 border-wood-300 hover:border-wood-500'}`}
                >
                    <SlidersHorizontal size={14} />
                    <span className="font-label text-xs uppercase tracking-[0.2em] font-semibold">Filter</span>
                    {filters.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-bronze-500 ml-1"></span>
                    )}
                </button>

                {/* #13 Search visible on all screen sizes (was hidden sm:flex) */}
                <div className="flex items-center gap-2 flex-1 max-w-xs border-b border-wood-200 focus-within:border-wood-900 transition-colors px-1">
                    <Search size={13} className="text-wood-400 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search pieces..."
                        className="bg-transparent font-label text-xs text-wood-900 outline-none placeholder:text-wood-300 placeholder:capitalize w-full py-1 tracking-wide"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-wood-400 hover:text-wood-900 transition-colors shrink-0">
                            <X size={12} />
                        </button>
                    )}
                </div>

                <span className="hidden sm:inline font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold truncate">
                    {count} Results
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold">Sort</span>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        className="bg-transparent font-label text-xs uppercase tracking-[0.2em] text-wood-900 outline-none cursor-pointer border-b border-transparent hover:border-wood-900 transition-colors font-semibold max-w-[100px]"
                    >
                        <option value="NEW">Newest</option>
                        <option value="PRICE_ASC">Low $</option>
                        <option value="PRICE_DESC">High $</option>
                    </select>
                </div>
            </div>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out bg-wood-50 border-b border-wood-200 ${isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="max-w-[1800px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 block mb-4 font-semibold">Category</span>
                        <div className="flex flex-wrap gap-2">
                            {STORE_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => toggleCat(cat)}
                                    className={`px-4 py-2 text-xs font-label uppercase tracking-[0.2em] font-semibold border transition-all ${filters.includes(cat) ? 'bg-wood-900 text-paper-50 border-wood-900' : 'bg-white text-wood-600 border-wood-200 hover:border-wood-400'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Store: React.FC = () => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filters, setFilters] = useState<string[]>([]);
    const [sort, setSort] = useState<'NEW' | 'PRICE_ASC' | 'PRICE_DESC'>('NEW');
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(12);
    const [checkoutBanner, setCheckoutBanner] = useState<'success' | 'cancelled' | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const { clearCart, closeCart } = useCart();

    // Handle Stripe redirect back with ?checkout=success|cancelled
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

    useEffect(() => {
        setIsFiltering(true);
        setVisibleCount(12);
        const timer = setTimeout(() => setIsFiltering(false), 600);
        return () => clearTimeout(timer);
    }, [filters, sort, search]);

    const filteredProducts = useMemo(() => {
        let result = INVENTORY;
        if (filters.length > 0) result = result.filter(p => filters.includes(p.category));
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.material?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
            );
        }
        if (sort === 'PRICE_ASC') result = [...result].sort((a, b) => a.price - b.price);
        if (sort === 'PRICE_DESC') result = [...result].sort((a, b) => b.price - a.price);
        return result;
    }, [filters, sort, search]);

    return (
        <section className="pt-24 min-h-screen bg-paper-50 animate-fade-in">
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
            <div className="pt-16 pb-12 px-6 text-center max-w-4xl mx-auto border-b border-wood-100 mb-8">
                <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 block mb-4 font-semibold">Shop</span>
                <h1 className="font-display text-5xl md:text-7xl text-wood-900 mb-6 font-normal tracking-tight leading-[1.05]">Available Pieces</h1>
                <p className="font-serif text-xl text-wood-600 max-w-2xl mx-auto leading-[1.7] font-light">
                    A curated selection of works ready for your home, alongside pieces made to your commission.
                </p>
            </div>
            <ControlDeck
                count={filteredProducts.length}
                sort={sort}
                setSort={setSort}
                filters={filters}
                setFilters={setFilters}
                search={search}
                setSearch={setSearch}
            />
            <main className="max-w-[1800px] mx-auto px-6 py-12 min-h-[60vh] relative">
                {isFiltering ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                         <SkeletonCard /><SkeletonCard /><SkeletonCard />
                         <SkeletonCard /><SkeletonCard /><SkeletonCard />
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <Search size={40} className="text-wood-200 mb-6" />
                        <p className="font-serif text-2xl text-wood-400 mb-3">No pieces found.</p>
                        <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-300 font-semibold">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14 card-stagger">
                            {filteredProducts.slice(0, visibleCount).map((p, idx) => {
                                if (idx === 4) {
                                    return (
                                        <React.Fragment key="interstitial">
                                            <CuratorialBlock />
                                            <ProductCard
                                                product={p}
                                                index={idx}
                                                onClick={() => setSelectedProduct(p)}
                                            />
                                        </React.Fragment>
                                    );
                                }
                                return (
                                    <ProductCard
                                        key={p.id}
                                        product={p}
                                        index={idx}
                                        onClick={() => setSelectedProduct(p)}
                                    />
                                );
                            })}
                        </div>

                        {filteredProducts.length > visibleCount && (
                            <div className="flex justify-center mt-20 pb-8">
                                <button
                                    onClick={() => setVisibleCount(v => v + 12)}
                                    className="px-12 py-4 border border-wood-900 text-wood-900 font-label text-xs uppercase tracking-[0.2em] hover:bg-wood-900 hover:text-paper-50 transition-all duration-300 font-semibold"
                                >
                                    Load More
                                    <span className="text-wood-400 ml-3">({filteredProducts.length - visibleCount} remaining)</span>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
            <InspectionDrawer
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onViewImage={setViewingImage}
            />
            {viewingImage && (
                <VisualLightbox
                    src={viewingImage}
                    onClose={() => setViewingImage(null)}
                />
            )}
        </section>
    );
};

export default Store;
