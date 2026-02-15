
import React, { useState, useMemo, useEffect } from 'react';
import { View, Artwork } from '../types';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { 
    ArrowRight, ArrowUpRight, ArrowLeft, 
    Compass, Database, Maximize2,
    Minus, ShoppingCart, CheckCircle2
} from 'lucide-react';

const MarginSpecs: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-1 border-l border-wood-200 pl-4 py-1">
        <span className="font-mono text-[9px] text-wood-400 uppercase tracking-widest font-bold">{label}</span>
        <span className="font-mono text-[11px] text-wood-700 font-medium">{value}</span>
    </div>
);

const SeriesPortal: React.FC<{
    series: typeof SERIES_DATA[0];
    index: number;
    onClick: () => void;
}> = ({ series, index, onClick }) => {
    const ratios = ['aspect-square', 'aspect-[4/5]', 'aspect-[16/9]'];
    const ratio = ratios[index % ratios.length];

    return (
        <div 
            onClick={onClick}
            className="group cursor-pointer mb-16 md:mb-24"
        >
            <div className={`w-full ${ratio} bg-wood-100 overflow-hidden border border-wood-200 relative`}>
                <img 
                    src={series.image} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s] ease-out"
                    alt={series.name}
                />
                <div className="absolute inset-0 bg-wood-900/5 group-hover:bg-transparent transition-colors duration-700"></div>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="bg-paper-50/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-wood-200">
                        <ArrowUpRight size={18} className="text-wood-900" />
                    </div>
                </div>
            </div>
            
            <div className="mt-8 flex flex-col md:flex-row justify-between items-start border-t border-wood-100 pt-8 gap-6">
                <div className="max-w-xl">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="font-mono text-[10px] text-bronze-600 uppercase tracking-[0.4em] font-bold">Series {String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="font-serif text-4xl md:text-5xl text-wood-900 tracking-tighter leading-none font-medium mb-4">
                        {series.name}
                    </h3>
                    <p className="font-serif text-lg text-wood-500 leading-relaxed font-light italic">
                        {series.description}
                    </p>
                </div>
                <div className="shrink-0 pt-2">
                     <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">View Works</span>
                </div>
            </div>
        </div>
    );
};

const NarrativeModule: React.FC<{
    title: string;
    content: string;
    image: string;
    aspectRatio?: 'SQUARE' | 'VERTICAL' | 'HORIZONTAL';
    reverse?: boolean;
    specs?: { label: string; value: string }[];
}> = ({ title, content, image, aspectRatio = 'SQUARE', reverse, specs }) => {
    
    const ratioClass = {
        SQUARE: 'aspect-square',
        VERTICAL: 'aspect-[3/4]',
        HORIZONTAL: 'aspect-[16/9]'
    }[aspectRatio];

    return (
        <section className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-12 lg:gap-32 items-start mb-48 px-6 md:px-12`}>
            <div className="w-full lg:w-[380px] lg:sticky lg:top-48 space-y-12 shrink-0">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Minus className="text-bronze-500" size={24} />
                        <span className="font-mono text-[10px] text-bronze-600 uppercase tracking-[0.3em] font-bold">Studio Note</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-serif text-wood-900 leading-tight font-medium">{title}</h3>
                    <p className="text-lg font-serif text-wood-700 leading-relaxed font-light italic border-l-2 border-wood-100 pl-6">
                        {content}
                    </p>
                </div>

                {specs && (
                    <div className="grid grid-cols-1 gap-4 pt-8">
                        {specs.map((s, i) => <MarginSpecs key={i} {...s} />)}
                    </div>
                )}
            </div>

            <div className="flex-1 w-full bg-white border border-wood-100 p-4 md:p-8 shadow-sm">
                <div className={`relative w-full ${ratioClass} bg-wood-50 overflow-hidden`}>
                    <img 
                        src={image} 
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-[2s] ease-out cursor-crosshair"
                        alt={title}
                    />
                </div>
                <div className="mt-4 flex justify-between items-center text-wood-400">
                    <span className="font-mono text-[9px] uppercase tracking-widest">Reference: {title.slice(0, 3).toUpperCase()}</span>
                    <button className="flex items-center gap-2 hover:text-wood-900 transition-colors">
                        <Maximize2 size={12} />
                        <span className="font-mono text-[9px] uppercase tracking-widest font-bold">View Full Size</span>
                    </button>
                </div>
            </div>
        </section>
    );
};

const SeriesStudy: React.FC<{
    series: typeof SERIES_DATA[0];
    onClose: () => void;
    onViewArchive: (seriesName: string) => void;
    onAcquire: (art: Artwork) => void;
}> = ({ series, onClose, onViewArchive, onAcquire }) => {
    const seriesArt = useMemo(() => FULL_ARCHIVE.filter(a => a.series === series.name).slice(0, 16), [series]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as any });
    }, [series]);

    return (
        <div className="min-h-screen bg-paper-50 animate-fade-in relative z-[100] selection:bg-bronze-200">
            
            <nav className="fixed top-0 left-0 w-full h-24 px-6 md:px-12 flex items-center justify-between z-[200] pointer-events-none">
                <button 
                    onClick={onClose}
                    className="pointer-events-auto group flex items-center gap-3 bg-paper-50/90 backdrop-blur-md px-6 py-2.5 border border-wood-200 rounded-full font-mono text-[10px] uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 transition-all font-bold shadow-xl"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
                </button>
                <button 
                    onClick={() => onViewArchive(series.name)}
                    className="pointer-events-auto bg-wood-900 text-paper-50 px-8 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors shadow-2xl"
                >
                    View Gallery Grid
                </button>
            </nav>

            <header className="pt-48 pb-32 px-6 md:px-12 max-w-[1400px] mx-auto text-center border-b border-wood-100 mb-32">
                <div className="inline-block border border-bronze-200 px-4 py-1.5 mb-8 bg-bronze-50/30">
                     <span className="font-mono text-[10px] text-bronze-600 uppercase tracking-[0.4em] font-bold">Visual Study</span>
                </div>
                <h1 className="text-6xl md:text-9xl font-serif text-wood-900 tracking-tighter leading-none mb-12 font-medium">
                    {series.name}
                </h1>
                
                <div className="max-w-6xl mx-auto bg-white p-4 md:p-12 shadow-2xl border border-wood-100">
                    <div className="aspect-video w-full bg-wood-50 overflow-hidden relative">
                         <img src={series.image} className="w-full h-full object-cover" alt="Series Piece" />
                    </div>
                    <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-left">
                            <span className="font-mono text-[10px] text-wood-400 uppercase tracking-widest block font-bold">Primary Work</span>
                            <span className="font-serif text-xl text-wood-900">Featured Piece No. 01</span>
                        </div>
                        <div className="flex gap-6">
                            <MarginSpecs label="Material" value="12mm Baltic Birch" />
                            <MarginSpecs label="System" value="Euclidean" />
                        </div>
                    </div>
                </div>
                
                <div className="mt-16 animate-bounce">
                    <ArrowDown className="mx-auto text-wood-300" size={24} />
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto pb-48">
                
                <NarrativeModule 
                    title="Structure"
                    content="A study in fractal depth. We use recursive geometry to create a sense of scale that feels larger than the physical object."
                    image="https://picsum.photos/1200/1500?random=111"
                    aspectRatio="VERTICAL"
                    specs={[
                        { label: 'Layering', value: '4 Levels' },
                        { label: 'Detail', value: 'High Density' }
                    ]}
                />

                <NarrativeModule 
                    title="Light"
                    content="The interaction between the light source and the wood grid. The piece creates its own atmosphere in the room."
                    image="https://picsum.photos/1500/1000?random=112"
                    aspectRatio="HORIZONTAL"
                    reverse={true}
                    specs={[
                        { label: 'Interaction', value: 'Active' },
                        { label: 'Mounting', value: '45mm Depth' }
                    ]}
                />

                <section className="px-6 md:px-12 mt-48">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-24 border-b border-wood-200 pb-8 gap-6">
                        <div>
                             <span className="font-mono text-[10px] text-bronze-600 uppercase tracking-[0.3em] font-bold block mb-4">Gallery</span>
                             <h2 className="text-5xl md:text-7xl font-serif text-wood-900 font-medium">Available Works</h2>
                        </div>
                        <div className="max-w-md text-right">
                            <p className="font-serif text-xl text-wood-500 italic font-light">
                                Selected pieces from the {series.name} series ready for purchase.
                            </p>
                        </div>
                    </div>

                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
                        {seriesArt.map((art, i) => {
                            const ratios = ['aspect-square', 'aspect-[3/4]', 'aspect-[4/3]'];
                            const ratio = ratios[i % ratios.length];

                            return (
                                <div key={art.id} className="group cursor-pointer mb-12 break-inside-avoid">
                                    <div className={`w-full ${ratio} bg-white border border-wood-200 p-3 shadow-sm hover:shadow-xl transition-all duration-700 relative`}>
                                        <div className="w-full h-full overflow-hidden bg-wood-50 relative">
                                            <img 
                                                src={art.coverImage} 
                                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-[1s]"
                                                alt={art.title} 
                                            />
                                            {art.available && (
                                                <div className="absolute top-4 right-4 z-10">
                                                    <div className="bg-paper-50/95 backdrop-blur-md px-3 py-1 border border-bronze-200 text-bronze-700 font-mono text-[9px] uppercase tracking-widest font-bold shadow-lg">
                                                        In Stock
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-6 flex flex-col items-center text-center px-4">
                                        <h4 className="font-serif text-xl text-wood-900 group-hover:text-bronze-700 transition-colors font-medium">{art.title}</h4>
                                        <span className="font-mono text-[9px] text-wood-400 uppercase tracking-widest font-bold mt-1 mb-4">{art.material} // No. {art.id.split('-').pop()}</span>
                                        
                                        {art.available ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onAcquire(art); }}
                                                className="w-full py-3 bg-wood-900 text-paper-50 font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ShoppingCart size={14} /> Add to Bag — ${art.price}
                                            </button>
                                        ) : (
                                            <div className="w-full py-3 border border-wood-200 text-wood-400 font-mono text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                                                <CheckCircle2 size={14} /> Sold
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            <footer className="bg-wood-900 text-paper-50 py-32 md:py-48 px-6 text-center">
                 <div className="max-w-4xl mx-auto space-y-12">
                     <Compass className="mx-auto text-bronze-500 mb-8 animate-spin-slow" size={64} strokeWidth={0.5} />
                     <h3 className="font-serif text-5xl md:text-8xl font-medium tracking-tight">Custom Work</h3>
                     <p className="text-xl md:text-2xl text-wood-300 font-serif leading-relaxed font-light italic max-w-2xl mx-auto">
                         The {series.name} series can be customized to fit your specific space.
                     </p>
                     <div className="pt-12 flex flex-col sm:flex-row items-center justify-center gap-8">
                        <button className="px-12 py-5 bg-bronze-600 text-paper-50 font-mono text-xs uppercase tracking-[0.3em] hover:bg-bronze-500 transition-colors font-bold shadow-2xl">
                            Send Inquiry
                        </button>
                        <button onClick={onClose} className="px-12 py-5 border border-wood-700 text-wood-400 font-mono text-xs uppercase tracking-[0.3em] hover:text-paper-50 hover:border-paper-50 transition-all font-bold">
                            Return to Gallery
                        </button>
                     </div>
                 </div>
            </footer>
        </div>
    );
};

// MAIN HUB VIEW
const ArtHub: React.FC<{
    setView: (view: View) => void;
    onAcquireArt: (art: Artwork) => void;
}> = ({ setView, onAcquireArt }) => {
    const [selectedSeries, setSelectedSeries] = useState<typeof SERIES_DATA[0] | null>(null);

    if (selectedSeries) {
        return (
            <SeriesStudy 
                series={selectedSeries} 
                onClose={() => setSelectedSeries(null)} 
                onViewArchive={() => setView(View.ART)}
                onAcquire={onAcquireArt}
            />
        );
    }

    return (
        <section className="pt-32 pb-48 min-h-screen bg-paper-50">
            <div className="max-w-[1400px] mx-auto px-6 mb-32">
                <div className="max-w-4xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-px bg-bronze-500"></div>
                        <span className="font-mono text-xs text-bronze-600 uppercase tracking-[0.5em] font-bold">
                            The Archive
                        </span>
                    </div>
                    <h1 className="text-6xl md:text-[140px] font-serif text-wood-900 leading-[0.8] tracking-tighter mb-12 font-medium">
                        Art & <br/> Objects
                    </h1>
                    <p className="text-xl md:text-3xl font-serif text-wood-600 leading-relaxed font-light max-w-3xl">
                        Explore the various series created in our studio. Each focuses on the intersection of light, shadow, and natural materials.
                    </p>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
                    {SERIES_DATA.map((series, idx) => (
                        <SeriesPortal 
                            key={series.id} 
                            series={series} 
                            index={idx}
                            onClick={() => setSelectedSeries(series)}
                        />
                    ))}
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12 border-t border-wood-200 pt-32 mt-32">
                 <div className="max-w-md">
                     <h3 className="font-serif text-3xl text-wood-900 mb-6 font-medium">Gallery Grid</h3>
                     <p className="text-lg text-wood-600 font-serif leading-relaxed">
                         Search every piece in the archive by material, year, and category.
                     </p>
                 </div>
                 <button 
                    onClick={() => setView(View.ART)}
                    className="group flex items-center gap-12 px-12 py-8 bg-white border border-wood-200 hover:border-wood-900 transition-all shadow-sm hover:shadow-xl"
                 >
                     <div className="text-left">
                         <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 block mb-1 font-bold">Archives</span>
                         <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">Open Full Grid</span>
                     </div>
                     <div className="w-14 h-14 rounded-full bg-wood-900 text-paper-50 flex items-center justify-center group-hover:bg-bronze-600 transition-colors">
                        <ArrowRight size={20} />
                     </div>
                 </button>
            </div>
        </section>
    );
};

const ArrowDown: React.FC<{ className?: string; size?: number }> = ({ className, size = 24 }) => (
    <svg 
        width={size} height={size} 
        viewBox="0 0 24 24" fill="none" 
        stroke="currentColor" strokeWidth="1" 
        strokeLinecap="round" strokeLinejoin="round" 
        className={className}
    >
        <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
    </svg>
);

export default ArtHub;
