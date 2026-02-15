
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Artwork } from '../types';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { 
  ChevronRight, ChevronLeft, ArrowLeft, X, Grid, Search, 
  List, ChevronDown, Sparkles, Scan, Share2, 
  Bookmark, SlidersHorizontal, LayoutGrid, Layers,
  Check, Trash2, Send, FileText, ArrowUpRight,
  ShoppingCart, Lock
} from 'lucide-react';

// --- UTILS ---

const SacredGeometryLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ size = 'md' }) => {
    const dimClasses = {
        sm: 'w-12 h-12', 
        md: 'w-48 h-48', 
        lg: 'w-64 h-64', 
        xl: 'w-96 h-96'  
    };

    return (
        <div className={`relative flex items-center justify-center ${dimClasses[size]}`}>
            <div className="absolute inset-0 border border-wood-900/20 rounded-full animate-[spin_12s_linear_infinite]"></div>
            <div className="absolute inset-2 md:inset-4 border border-dashed border-wood-900/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
            <div className="absolute w-1.5 h-1.5 bg-bronze-500 rounded-full animate-pulse shadow-[0_0_20px_rgba(180,141,85,0.8)]"></div>
        </div>
    );
};

export const ArtifactSpecs: React.FC<{ art: Artwork; onAcquire?: () => void }> = ({ art, onAcquire }) => (
    <div className="space-y-8 animate-fade-in pb-12">
        <div className="mb-8">
            <span className="font-mono text-xs text-wood-600 uppercase tracking-widest block mb-3 flex items-center gap-2 font-bold">
                <Sparkles size={12} className="text-bronze-600" /> Series Piece
            </span>
            <h2 className="text-3xl font-sans text-wood-900 uppercase tracking-wide leading-tight font-medium">{art.title}</h2>
        </div>

        <div className="p-6 border border-wood-200 bg-white/60 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-bronze-500"></div>
            <p className="font-serif text-lg text-wood-800 leading-relaxed font-normal">
                "{art.description}"
            </p>
        </div>

        <div>
            <span className="font-mono text-xs text-bronze-700 uppercase tracking-widest block mb-4 border-b border-wood-200 pb-2 font-bold">Details</span>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                    <span className="block text-xs text-wood-500 uppercase tracking-widest mb-1 font-bold">Material</span>
                    <span className="font-serif text-wood-900 text-lg">{art.material}</span>
                </div>
                <div>
                    <span className="block text-xs text-wood-500 uppercase tracking-widest mb-1 font-bold">Year</span>
                    <span className="font-mono text-wood-700 text-sm">{art.year}</span>
                </div>
                <div>
                    <span className="block text-xs text-wood-500 uppercase tracking-widest mb-1 font-bold">Dimensions</span>
                    <span className="font-mono text-wood-700 text-sm">{art.dimensions}</span>
                </div>
                <div>
                    <span className="block text-xs text-wood-500 uppercase tracking-widest mb-1 font-bold">Reference</span>
                    <span className="font-mono text-bronze-700 text-sm font-bold">{art.id.split('-').pop()}</span>
                </div>
            </div>
        </div>

        <div className="pt-8 mt-8 border-t border-wood-200">
             <div className="flex flex-col gap-4">
                {art.available ? (
                    <button 
                        onClick={onAcquire}
                        className="w-full py-5 bg-wood-900 border border-wood-900 hover:bg-bronze-600 hover:border-bronze-600 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl font-bold"
                    >
                        <ShoppingCart size={18} /> Add to Selection — ${art.price}
                    </button>
                ) : (
                    <div className="w-full py-5 border border-wood-200 text-wood-400 font-mono text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 font-bold">
                        <Lock size={18} /> Private Collection
                    </div>
                )}
                <button className="w-full py-4 border border-wood-200 hover:border-wood-500 text-wood-600 hover:text-wood-900 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all font-bold">
                    <Share2 size={14} /> Share Piece
                </button>
             </div>
        </div>
    </div>
);

const ArchiveNode: React.FC<{ art: Artwork; viewMode: 'GRID' | 'LIST'; isFavorite: boolean; onClick: () => void; index: number }> = ({ art, viewMode, isFavorite, onClick, index }) => {
    if (viewMode === 'LIST') {
        return (
            <div onClick={onClick} className="group flex items-center gap-4 p-3 border-b border-wood-200 hover:bg-wood-100/50 cursor-pointer transition-colors backdrop-blur-sm">
                <div className="w-12 h-12 bg-wood-200 overflow-hidden relative border border-wood-300 shrink-0">
                    <img src={art.coverImage} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="hidden sm:block w-24 font-mono text-xs text-bronze-700 truncate font-bold">{art.id}</div>
                <div className="flex-1 font-sans font-bold text-wood-900 truncate text-sm md:text-base leading-tight">{art.title}</div>
                <div className="w-24 font-mono text-xs text-wood-700 uppercase truncate text-right font-medium">{art.category}</div>
                {isFavorite && <Bookmark size={14} className="text-bronze-500 fill-bronze-500 ml-2 shrink-0" />}
            </div>
        );
    }

    return (
        <div onClick={onClick} className="group cursor-pointer break-inside-avoid mb-4 relative">
            <div className="relative overflow-hidden bg-white border border-wood-200 transition-all duration-500 group-hover:border-bronze-400">
                <div className="relative w-full h-auto bg-wood-100 aspect-square">
                    <img 
                        src={art.coverImage} 
                        alt={art.title}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-all duration-700 filter grayscale contrast-125 group-hover:grayscale-0 group-hover:contrast-100 group-hover:scale-105`}
                    />
                    {isFavorite && (
                        <div className="absolute top-2 right-2 z-20">
                            <Bookmark size={14} className="text-bronze-500 fill-bronze-500 drop-shadow-md" />
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-2">
                 <h4 className="font-sans font-bold text-sm text-wood-900 leading-tight">{art.title}</h4>
                 <span className="text-xs font-mono text-wood-600 uppercase tracking-wide font-semibold">{art.series || art.category}</span>
            </div>
        </div>
    );
};

const Gallery: React.FC<{ initialViewMode?: any; onAcquireArt: (art: Artwork) => void }> = ({ initialViewMode = 'FEATURED', onAcquireArt }) => {
    const [viewState, setViewState] = useState(initialViewMode);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [selectedArt, setSelectedArt] = useState<Artwork | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);

    const filteredData = useMemo(() => {
        let data = FULL_ARCHIVE;
        if (viewState === 'FEATURED') data = data.filter(a => a.featured);
        if (viewState === 'COLLECTED') data = data.filter(a => favorites.includes(a.id));
        return data;
    }, [viewState, favorites]);

    const handleViewChange = (v: any) => {
        setViewState(v);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <section className="min-h-screen w-full bg-paper-50 text-wood-900 relative font-sans pt-12">
            <div className="pt-32 pb-12 px-6 max-w-[1800px] mx-auto animate-fade-in border-b border-wood-200">
                <h1 className="text-4xl md:text-6xl font-serif text-wood-900 mb-6 font-medium">Art Gallery</h1>
                <div className="flex gap-4">
                    <button onClick={() => handleViewChange('FEATURED')} className={`font-mono text-xs uppercase tracking-widest ${viewState === 'FEATURED' ? 'text-bronze-600 border-b border-bronze-600' : 'text-wood-400'}`}>Featured</button>
                    <button onClick={() => handleViewChange('ALL')} className={`font-mono text-xs uppercase tracking-widest ${viewState === 'ALL' ? 'text-bronze-600 border-b border-bronze-600' : 'text-wood-400'}`}>All Works</button>
                    <button onClick={() => handleViewChange('COLLECTED')} className={`font-mono text-xs uppercase tracking-widest ${viewState === 'COLLECTED' ? 'text-bronze-600 border-b border-bronze-600' : 'text-wood-400'}`}>Favorites ({favorites.length})</button>
                </div>
            </div>
            
            <div className="px-4 md:px-6 py-12 max-w-[1800px] mx-auto">
                <div className={viewMode === 'GRID' ? 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4' : 'flex flex-col'}>
                    {filteredData.slice(0, 24).map((art, idx) => (
                        <ArchiveNode key={art.id} art={art} index={idx} viewMode={viewMode} isFavorite={favorites.includes(art.id)} onClick={() => setSelectedArt(art)} />
                    ))}
                </div>
            </div>

            {selectedArt && (
                <div className="fixed inset-0 z-[2000] bg-paper-50 flex animate-fade-in">
                    <div className="flex-1 p-12 overflow-y-auto">
                        <button onClick={() => setSelectedArt(null)} className="mb-8 flex items-center gap-2 font-mono text-xs uppercase tracking-widest"><ArrowLeft size={16}/> Back</button>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                            <img src={selectedArt.coverImage} className="w-full h-auto border border-wood-200" />
                            <ArtifactSpecs art={selectedArt} onAcquire={() => onAcquireArt(selectedArt)} />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default Gallery;
