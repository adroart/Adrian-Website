
import React, { useState, useMemo } from 'react';
import { View, Artwork } from '../types';
import { FULL_ARCHIVE, CREATION_CATEGORIES } from '../data/mockData';
import { ArrowRight, ShoppingCart, Lock, ArrowUpRight } from 'lucide-react';

const CreationCategoryCard: React.FC<{ 
    label: string; 
    desc: string; 
    onClick: () => void;
    idx: number;
}> = ({ label, desc, onClick, idx }) => (
    <div 
        onClick={onClick} 
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

const PieceCard: React.FC<{ art: Artwork; onClick: () => void }> = ({ art, onClick }) => (
    <div onClick={onClick} className="group cursor-pointer break-inside-avoid mb-8">
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
    </div>
);

// Detail Modal for Individual Piece
const PieceDetail: React.FC<{ art: Artwork; onClose: () => void; onAcquire: (art: Artwork) => void }> = ({ art, onClose, onAcquire }) => (
    <div className="fixed inset-0 z-[200] bg-paper-50/95 backdrop-blur-xl flex flex-col animate-fade-in overflow-y-auto">
        <div className="w-full p-6 flex justify-between items-center border-b border-wood-200 sticky top-0 bg-paper-50 z-10">
            <button onClick={onClose} className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-600 hover:text-wood-900 font-bold">
                <ArrowRight size={16} className="rotate-180"/> Back to Gallery
            </button>
            <span className="font-mono text-xs uppercase tracking-widest text-wood-400 font-bold hidden md:inline">
                {art.id}
            </span>
        </div>

        <div className="max-w-7xl mx-auto w-full p-6 md:p-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-6">
                <div className="w-full bg-wood-100 border border-wood-200">
                    <img src={art.coverImage} className="w-full h-auto object-cover" alt={art.title} />
                </div>
                {art.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                        {art.images.map((img, i) => (
                            <img key={i} src={img} className="w-full h-24 object-cover border border-wood-200" />
                        ))}
                    </div>
                )}
            </div>

            <div className="lg:pt-12">
                <div className="mb-8">
                     {art.series && (
                         <button className="flex items-center gap-2 text-bronze-600 font-mono text-xs uppercase tracking-widest font-bold mb-4 hover:underline">
                            {art.series} Series <ArrowUpRight size={12} />
                         </button>
                     )}
                     <h1 className="font-serif text-4xl md:text-5xl text-wood-900 leading-tight mb-6 font-medium">
                         {art.title}
                     </h1>
                     <div className="grid grid-cols-2 gap-y-2 font-serif text-lg text-wood-700">
                         {art.dimensions && <p>{art.dimensions}</p>}
                         {art.material && <p>{art.material}</p>}
                         {art.edition && <p className="text-bronze-600">{art.edition}</p>}
                     </div>
                </div>

                <div className="prose prose-stone font-serif text-wood-600 font-light mb-12 max-w-lg leading-relaxed">
                    <p>{art.description}</p>
                    {art.longDescription && <p>{art.longDescription}</p>}
                </div>

                <div className="border-t border-wood-200 pt-8 space-y-4">
                    {art.availability === 'READY_TO_SHIP' ? (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">Ready to Ship</span>
                                <span className="font-serif text-2xl text-wood-900 font-medium">${art.price}</span>
                            </div>
                            <button 
                                onClick={() => onAcquire(art)}
                                className="w-full py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3"
                            >
                                <ShoppingCart size={16} /> Add to Selection
                            </button>
                            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                Ships from Bali • Arrives in 2-3 weeks
                            </p>
                        </>
                    ) : art.availability === 'MADE_TO_ORDER' ? (
                        <>
                             <div className="flex justify-between items-center mb-4">
                                <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">Made to Order</span>
                                <span className="font-serif text-2xl text-wood-900 font-medium">From ${art.price}</span>
                            </div>
                            <button 
                                className="w-full py-4 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors"
                            >
                                Configure Design
                            </button>
                            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                4-6 Weeks Production Time
                            </p>
                        </>
                    ) : (
                        <div className="w-full py-4 border border-wood-200 text-wood-400 font-mono text-xs uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                             <Lock size={14} /> Sold Out
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

const Creations: React.FC<{ setView: (view: View) => void; onAcquireArt: (art: Artwork) => void }> = ({ setView, onAcquireArt }) => {
    const [selectedPiece, setSelectedPiece] = useState<Artwork | null>(null);
    const [filter, setFilter] = useState<string | null>(null);
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);

    // 5.3 Selected Works (First 12 featured items)
    const selectedWorks = useMemo(() => FULL_ARCHIVE.filter(a => a.featured).slice(0, 12), []);

    // Filtered list for "All Creations"
    const filteredArchive = useMemo(() => {
        let data = FULL_ARCHIVE;
        if (filter) {
            data = data.filter(a => a.category === filter);
        }
        if (showAvailableOnly) {
            data = data.filter(a => a.availability === 'READY_TO_SHIP');
        }
        return data;
    }, [filter, showAvailableOnly]);

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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                        {CREATION_CATEGORIES.map((cat, idx) => (
                            <CreationCategoryCard 
                                key={cat.id} 
                                label={cat.label} 
                                desc={cat.desc} 
                                idx={idx}
                                onClick={() => setFilter(cat.label)}
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
                             <button onClick={() => setFilter(null)} className="text-wood-500 hover:text-wood-900 font-mono text-xs uppercase tracking-widest font-bold">
                                 All Creations
                             </button>
                             <span className="text-wood-300">/</span>
                             <span className="text-wood-900 font-mono text-xs uppercase tracking-widest font-bold">{filter}</span>
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

            {/* Main Grid */}
            <div className="max-w-[1800px] mx-auto px-6">
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                    {(filter ? filteredArchive : selectedWorks).map((art) => (
                        <PieceCard 
                            key={art.id} 
                            art={art} 
                            onClick={() => setSelectedPiece(art)} 
                        />
                    ))}
                </div>
                
                {!filter && (
                    <div className="mt-24 text-center border-t border-wood-200 pt-12">
                         <p className="font-serif text-wood-500 italic mb-6">Viewing selected works. Explore categories to see full archive.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedPiece && (
                <PieceDetail 
                    art={selectedPiece} 
                    onClose={() => setSelectedPiece(null)} 
                    onAcquire={onAcquireArt}
                />
            )}
        </section>
    );
};

export default Creations;
