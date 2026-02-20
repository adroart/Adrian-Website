
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../types';
import { FULL_ARCHIVE, CREATION_CATEGORIES } from '../data/mockData';

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
            loading="lazy"
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

const PieceCard: React.FC<{ art: Artwork }> = ({ art }) => (
    <Link to={`/creations/${art.id}`} className="group cursor-pointer break-inside-avoid mb-8 block">
        <div className="relative overflow-hidden bg-wood-50 border border-wood-200">
            <img
                src={art.coverImage}
                alt={art.title}
                loading="lazy"
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
    </Link>
);

const Creations: React.FC = () => {
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
                            I create across many forms. Some you hang on the wall. Some you wear. Some you sit with. Some you walk into.
                        </p>
                        <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-relaxed mt-4">
                            These are not decoration. They are portals. A place to sit with. To find your center. To feel an opening.
                        </p>
                        <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-relaxed mt-4">
                            Find what calls to you.
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
                        />
                    ))}
                </div>
                
                {!filter && (
                    <div className="mt-24 text-center border-t border-wood-200 pt-12">
                         <p className="font-serif text-wood-500 italic mb-6">Viewing selected works. Explore categories to see full archive.</p>
                    </div>
                )}
            </div>

        </section>
    );
};

export default Creations;
