import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '../types';
import { INVENTORY, STORE_CATEGORIES } from '../data/mockData';
import { 
    X, Search, SlidersHorizontal, ArrowRight, Eye, ShieldCheck, 
    Maximize2, ArrowLeft
} from 'lucide-react';

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
    // Safety check for SSR or weird load states
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
                     <span className="font-mono text-xs uppercase tracking-widest font-bold">Close</span>
                </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-0 md:p-8 overflow-hidden bg-wood-100/50">
                <ZoomableImage src={src} alt="Detail" />
            </div>
        </div>,
        document.body
    );
};

const SacredGeometryLoader: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
    const border = dark ? 'border-wood-300' : 'border-stone-700';
    const dashed = dark ? 'border-wood-400/50' : 'border-bronze-500/50';
    const inner = dark ? 'border-wood-500' : 'border-bronze-500';
    const core = dark ? 'bg-wood-900' : 'bg-bronze-500';

    return (
        <div className="relative flex items-center justify-center w-16 h-16">
            <div className={`absolute inset-0 border ${border} opacity-50 rounded-full animate-[spin_12s_linear_infinite]`}></div>
            <div className={`absolute inset-2 border border-dashed ${dashed} rounded-full animate-[spin_15s_linear_infinite_reverse]`}></div>
            <div className={`absolute w-[60%] h-[60%] border ${inner} opacity-40 animate-[spin_6s_linear_infinite]`}></div>
            <div className={`absolute w-[60%] h-[60%] border ${inner} opacity-40 animate-[spin_6s_linear_infinite] rotate-45`}></div>
            <div className={`w-1.5 h-1.5 ${core} rounded-full animate-pulse shadow-sm`}></div>
        </div>
    );
};

const CuratorialBlock: React.FC = () => (
    <div className="col-span-1 md:col-span-2 lg:col-span-2 aspect-square md:aspect-auto flex flex-col justify-center items-center bg-wood-900 text-paper-50 p-8 md:p-12 text-center border border-wood-900">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-bronze-400 mb-6 block font-bold">Philosophy</span>
        <p className="font-serif text-xl md:text-3xl leading-relaxed max-w-lg font-light">
            "We do not own these objects. We are merely their custodians for a brief moment in time."
        </p>
        <div className="w-12 h-px bg-bronze-500 mt-8"></div>
    </div>
);

const ProductCard: React.FC<{ 
    product: Product; 
    index: number;
    onClick: () => void; 
}> = ({ product, index, onClick }) => {
    const [loaded, setLoaded] = useState(false);
    const isWide = (index + 1) % 3 === 0; 
    const spanClass = isWide ? 'md:col-span-2' : 'col-span-1';
    const opacityClass = !product.available ? 'opacity-70 grayscale sepia-[0.3]' : '';

    return (
        <div 
            onClick={onClick}
            className={`group relative flex flex-col cursor-pointer ${spanClass} mb-12 md:mb-0`}
        >
            <div className="relative w-full bg-wood-100 overflow-hidden border border-wood-200 mb-4 aspect-[4/5] md:aspect-auto md:h-[500px]">
                <img 
                    src={product.image} 
                    alt={product.title}
                    onLoad={() => setLoaded(true)}
                    className={`
                        w-full h-full object-cover transition-all duration-[1.5s] ease-out transform
                        group-hover:scale-105
                        ${opacityClass}
                        ${loaded ? 'blur-0 opacity-100' : 'blur-xl opacity-0'}
                    `}
                />
                
                {!product.available && (
                    <div className="absolute top-4 right-4 bg-wood-900/90 text-paper-50 px-3 py-1.5 text-xs font-mono uppercase tracking-widest border border-wood-700 shadow-xl font-bold">
                        Archived
                    </div>
                )}

                {product.available && (
                    <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-500">
                        <div className="bg-paper-50/90 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-3 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-xl border border-wood-200">
                            <Eye size={16} className="text-wood-900" />
                            <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">View Piece</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-start px-1">
                <div className="max-w-[80%]">
                    <h3 className="font-serif text-2xl text-wood-900 leading-none mb-2 group-hover:text-bronze-700 transition-colors font-medium">
                        {product.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                         <span className="text-xs font-mono text-wood-500 uppercase tracking-widest font-bold">
                            {product.category}
                        </span>
                        <span className="text-xs text-wood-300">•</span>
                         <span className="text-xs font-mono text-wood-500 uppercase tracking-widest font-bold">
                            {product.material}
                        </span>
                    </div>
                </div>
                <div className="font-mono text-sm text-wood-900 border-b border-transparent group-hover:border-wood-900 transition-all font-bold">
                    ${product.price}
                </div>
            </div>
        </div>
    );
};

const InspectionDrawer: React.FC<{ 
    product: Product | null; 
    onClose: () => void; 
    onAddToCart: (p: Product) => void;
    onViewImage: (img: string) => void;
}> = ({ product, onClose, onAddToCart, onViewImage }) => {
    const [animClass, setAnimClass] = useState('translate-x-full');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (product) {
            setLoaded(false);
            requestAnimationFrame(() => setAnimClass('translate-x-0'));
            // Safety: Only set style if body exists (SSR safe)
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
                         <div className={`w-2 h-2 rounded-full ${product.available ? 'bg-green-500' : 'bg-wood-400'} animate-pulse`}></div>
                         <span className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">
                             Ref: {product.id}
                         </span>
                    </div>
                    <button onClick={onClose} className="p-4 -mr-4 hover:bg-wood-100 rounded-full transition-colors group flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-500 font-bold hidden sm:inline">Close</span>
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
                        <h1 className="text-3xl md:text-5xl font-serif text-wood-900 mb-6 leading-none font-medium">{product.title}</h1>
                        <p className="font-serif text-lg text-wood-700 leading-relaxed font-normal">
                            {product.longDescription || product.description}
                        </p>
                    </div>

                    <div className="border-t border-b border-wood-200 py-8 mb-8 grid grid-cols-2 gap-y-8 gap-x-4">
                        <div>
                             <span className="block font-mono text-xs uppercase tracking-widest text-wood-400 mb-1 font-bold">Origin</span>
                             <span className="font-serif text-lg text-wood-900">{product.origin || 'Studio'}</span>
                        </div>
                        <div>
                             <span className="block font-mono text-xs uppercase tracking-widest text-wood-400 mb-1 font-bold">Material</span>
                             <span className="font-serif text-lg text-wood-900">{product.material}</span>
                        </div>
                        <div>
                             <span className="block font-mono text-xs uppercase tracking-widest text-wood-400 mb-1 font-bold">Weight</span>
                             <span className="font-serif text-lg text-wood-900">{product.weight || 'N/A'}</span>
                        </div>
                        <div>
                             <span className="block font-mono text-xs uppercase tracking-widest text-wood-400 mb-1 font-bold">Dimensions</span>
                             <span className="font-serif text-lg text-wood-900">{product.dimensions || 'N/A'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-wood-100/50 border border-wood-200">
                        <ShieldCheck size={20} className="text-bronze-600 shrink-0" />
                        <div className="flex flex-col">
                             <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">Authentic Artifact</span>
                             <span className="text-xs text-wood-600 font-serif">Verified and cataloged by the studio.</span>
                        </div>
                    </div>
                    
                    <div className="pb-24"></div>
                </div>

                <div className="border-t border-wood-200 p-6 bg-paper-50 sticky bottom-0 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">Valuation</span>
                        <span className="font-mono text-xl text-wood-900 font-bold">${product.price}</span>
                    </div>
                    <button 
                        onClick={() => onAddToCart(product)}
                        disabled={!product.available}
                        className={`w-full py-5 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-[0.2em] transition-all duration-300 font-bold shadow-lg ${
                            product.available 
                            ? 'bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl' 
                            : 'bg-wood-200 text-wood-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        {product.available ? (
                            <>
                                Add to Selection <ArrowRight size={16} />
                            </>
                        ) : 'Private Collection'}
                    </button>
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
}> = ({ count, sort, setSort, filters, setFilters }) => {
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
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Filter</span>
                    {filters.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-bronze-500 ml-1"></span>
                    )}
                </button>
                <span className="hidden sm:inline font-mono text-xs uppercase tracking-[0.2em] text-wood-400 font-bold truncate">
                    {count} Results
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline font-mono text-xs uppercase tracking-widest text-wood-400 font-bold">Sort</span>
                    <select 
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        className="bg-transparent font-mono text-xs uppercase tracking-widest text-wood-900 outline-none cursor-pointer border-b border-transparent hover:border-wood-900 transition-colors font-bold max-w-[100px]"
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
                        <span className="font-mono text-xs uppercase tracking-widest text-wood-400 block mb-4 font-bold">Category</span>
                        <div className="flex flex-wrap gap-2">
                            {STORE_CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => toggleCat(cat)}
                                    className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-all ${filters.includes(cat) ? 'bg-wood-900 text-paper-50 border-wood-900' : 'bg-white text-wood-600 border-wood-200 hover:border-wood-400'}`}
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

const Store: React.FC<{ setView: (v: any) => void; showToast: (m: string) => void; onAddToCart: (p: Product) => void }> = ({ setView, showToast, onAddToCart }) => {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filters, setFilters] = useState<string[]>([]);
    const [sort, setSort] = useState<'NEW' | 'PRICE_ASC' | 'PRICE_DESC'>('NEW');
    const [visibleCount, setVisibleCount] = useState(12);

    useEffect(() => {
        setIsFiltering(true);
        const timer = setTimeout(() => setIsFiltering(false), 800);
        return () => clearTimeout(timer);
    }, [filters, sort]);

    const filteredProducts = useMemo(() => {
        let result = INVENTORY;
        if (filters.length > 0) result = result.filter(p => filters.includes(p.category));
        if (sort === 'PRICE_ASC') result = [...result].sort((a, b) => a.price - b.price);
        if (sort === 'PRICE_DESC') result = [...result].sort((a, b) => b.price - a.price);
        return result;
    }, [filters, sort]);

    return (
        <section className="pt-24 min-h-screen bg-paper-50">
            <div className="pt-16 pb-12 px-6 text-center max-w-4xl mx-auto border-b border-wood-100 mb-8">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-bronze-600 block mb-4 font-bold">Shop</span>
                <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium tracking-tight">Available Pieces</h1>
                <p className="font-serif text-xl text-wood-600 max-w-2xl mx-auto leading-relaxed font-light">
                    A curated selection of works ready for your home.
                </p>
            </div>
            <ControlDeck 
                count={filteredProducts.length} 
                sort={sort} 
                setSort={setSort} 
                filters={filters} 
                setFilters={setFilters} 
            />
            <main className="max-w-[1800px] mx-auto px-6 py-12 min-h-[60vh] relative">
                {isFiltering ? (
                    <div className="flex flex-col items-center justify-center py-32">
                         <SacredGeometryLoader dark />
                         <span className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-wood-400 animate-pulse font-bold">Loading...</span>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
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
                    </>
                )}
            </main>
            <InspectionDrawer 
                product={selectedProduct} 
                onClose={() => setSelectedProduct(null)} 
                onAddToCart={(p) => { onAddToCart(p); setSelectedProduct(null); }}
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