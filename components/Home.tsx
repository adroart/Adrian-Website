
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Artwork, Product, Story } from '../types';
import { FULL_ARCHIVE, INVENTORY, STORIES } from '../data/mockData';
import { ArrowRight, Sparkles, Diamond, Layers, ArrowUpRight } from 'lucide-react';

interface HomeProps {
    setView: (view: View) => void;
    showToast: (msg: string) => void;
}

// --- HELPER COMPONENTS ---

const SectionHeader: React.FC<{ 
    title: string; 
    subtitle?: string; 
    actionLabel?: string; 
    onAction?: () => void;
    lightMode?: boolean; 
}> = ({ title, subtitle, actionLabel, onAction, lightMode = false }) => (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
        <div>
            <h2 className={`font-serif text-3xl md:text-5xl leading-tight mb-2 tracking-tight font-medium ${lightMode ? 'text-paper-50' : 'text-wood-900'}`}>{title}</h2>
            {subtitle && <p className={`font-serif text-lg md:text-xl max-w-xl ${lightMode ? 'text-wood-300' : 'text-wood-600'}`}>{subtitle}</p>}
        </div>
        {actionLabel && onAction && (
            <button 
                onClick={onAction}
                className={`self-start md:self-end flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b pb-1 transition-all group font-bold ${lightMode ? 'text-wood-400 border-wood-600 hover:text-bronze-400 hover:border-bronze-400' : 'text-wood-800 border-wood-300 hover:text-bronze-600 hover:border-bronze-600'}`}
            >
                {actionLabel} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
        )}
    </div>
);

const PortalColumn: React.FC<{
    title: string;
    subtitle: string;
    description: string;
    image: string;
    icon: React.ElementType;
    index: string;
    isHovered: boolean;
    isAnyHovered: boolean;
    onHover: (state: boolean) => void;
    onClick: () => void;
}> = ({ title, subtitle, description, image, icon: Icon, index, isHovered, isAnyHovered, onHover, onClick }) => {
    
    // Desktop: Accordion Logic (Flex basis)
    const flexClass = isHovered ? 'lg:flex-[2.5]' : 'lg:flex-[1]';
    
    // Visual State
    const isActive = !isAnyHovered || isHovered;
    const opacityClass = isActive ? 'opacity-100 grayscale-0' : 'opacity-40 grayscale blur-[2px]';
    const textTranslate = isHovered ? 'translate-y-0' : 'translate-y-0 lg:translate-y-4';

    return (
        <div 
            onClick={onClick}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            className={`
                group relative min-h-[400px] lg:h-[65vh] border-b lg:border-b-0 lg:border-r border-white/10 last:border-0 cursor-pointer overflow-hidden bg-stone-950 
                transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${flexClass} ${opacityClass}
            `}
        >
            <div className="absolute inset-0 z-0">
                <img 
                    src={image} 
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-[2s] ease-out scale-105 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-stone-950/40 group-hover:bg-stone-950/20 transition-colors duration-700"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/60 opacity-90"></div>
            </div>

            <div className={`absolute top-0 left-8 w-px bg-white/20 z-10 transition-all duration-700 ${isHovered ? 'h-full opacity-100' : 'h-16 opacity-30'}`}></div>

            <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 lg:p-12">
                <div className={`transform transition-all duration-700 ease-out ${textTranslate}`}>
                    <div className="overflow-hidden">
                        <span className="block font-mono text-xs text-bronze-400 uppercase tracking-[0.3em] mb-4 font-bold translate-y-0 transition-transform duration-500 delay-100">
                            {subtitle}
                        </span>
                    </div>
                    
                    <h3 className="font-serif text-4xl lg:text-6xl text-paper-50 mb-6 leading-none tracking-tight font-medium drop-shadow-lg">
                        {title}
                    </h3>
                    
                    <div className={`
                        transition-all duration-700 ease-out overflow-hidden
                        ${isHovered ? 'max-h-40 opacity-100 mb-8' : 'max-h-0 lg:max-h-0 opacity-100 lg:opacity-0 mb-4 lg:mb-0'}
                    `}>
                        <p className="font-serif text-lg text-paper-100 font-normal leading-relaxed max-w-md border-l border-bronze-500/50 pl-4">
                            {description}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 group/btn">
                        <div className="h-px w-8 bg-white/30 group-hover/btn:w-16 transition-all duration-500"></div>
                        <span className="font-mono text-xs uppercase tracking-widest text-paper-50 font-bold group-hover/btn:text-bronze-300 transition-colors">
                            Enter Portal
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StudioCard: React.FC<{
    image: string;
    title: string;
    type: string;
    status?: string;
    onClick: () => void;
}> = ({ image, title, type, status, onClick }) => (
    <div 
        onClick={onClick}
        className="group min-w-[300px] w-[300px] md:w-[24%] flex flex-col gap-4 cursor-pointer snap-start shrink-0"
    >
        <div className="relative aspect-[3/4] bg-wood-100 overflow-hidden border border-wood-200">
            <img 
                src={image} 
                alt={title} 
                className="w-full h-full object-cover transition-transform duration-[1s] group-hover:scale-105 filter grayscale-[20%] group-hover:grayscale-0"
            />
            {status && (
                <div className="absolute top-3 right-3 bg-paper-50/95 backdrop-blur-sm px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-wood-900 border border-wood-300 font-bold shadow-sm">
                    {status}
                </div>
            )}
        </div>
        <div>
            <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-wood-600 font-semibold">{type}</span>
                <div className="h-px flex-1 bg-wood-200"></div>
            </div>
            <h4 className="font-serif text-2xl text-wood-900 leading-none group-hover:text-bronze-700 transition-colors font-medium">
                {title}
            </h4>
        </div>
    </div>
);

const CinematicProductCard: React.FC<{ product: Product; onClick: () => void }> = ({ product, onClick }) => (
    <div 
        onClick={onClick}
        className="group relative min-w-[280px] w-[280px] md:w-[24%] aspect-[3/4] cursor-pointer snap-start shrink-0 overflow-hidden border border-wood-200 bg-wood-100"
    >
        <img 
            src={product.image} 
            alt={product.title} 
            className="w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-110"
        />
        
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-6">
            <div className="bg-stone-900/80 backdrop-blur-md border border-stone-700/50 p-4 md:p-5 transition-all duration-500 group-hover:bg-stone-900/90 shadow-lg">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-serif text-xl md:text-2xl text-paper-50 leading-tight drop-shadow-md font-medium">{product.title}</h4>
                    <span className="font-mono text-sm text-paper-50 bg-black/40 px-2 py-1 rounded-sm font-bold shadow-sm">${product.price}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-paper-50 font-bold drop-shadow-sm">
                    <span>Details</span>
                    <ArrowUpRight size={12} />
                </div>
            </div>
        </div>
    </div>
);

const StoryListItem: React.FC<{ story: Story; onClick: () => void }> = ({ story, onClick }) => (
    <div 
        onClick={onClick}
        className="group cursor-pointer border-t border-wood-200 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white transition-colors"
    >
        <div className="flex items-center gap-4 md:w-1/4">
             <span className="font-mono text-xs uppercase tracking-widest text-wood-400 group-hover:text-wood-900 font-bold">{story.type}</span>
             <span className="font-mono text-xs uppercase tracking-widest text-wood-300 hidden md:inline">/</span>
             <span className="font-mono text-xs uppercase tracking-widest text-wood-400 hidden md:inline">{story.date}</span>
        </div>

        <div className="md:w-1/2">
            <h4 className="font-serif text-2xl md:text-3xl text-wood-900 leading-tight group-hover:text-bronze-700 transition-colors font-medium">
                {story.title}
            </h4>
            <p className="font-serif text-wood-500 text-lg line-clamp-1 mt-1 font-light group-hover:text-wood-600">
                {story.excerpt}
            </p>
        </div>

        <div className="md:w-1/4 flex justify-end">
             <div className="w-10 h-10 rounded-full border border-wood-200 flex items-center justify-center text-wood-400 group-hover:border-bronze-500 group-hover:text-bronze-600 transition-all">
                 <ArrowUpRight size={18} />
             </div>
        </div>
    </div>
);


const Home: React.FC<HomeProps> = ({ setView }) => {
    
    // --- STATE ---
    const [hoveredPortalIndex, setHoveredPortalIndex] = useState<number | null>(null);
    const latestScrollRef = useRef<HTMLDivElement>(null);
    const [latestProgress, setLatestProgress] = useState(0);

    // --- DATA PREPARATION ---
    
    const latestMixed = useMemo(() => {
        const arts = FULL_ARCHIVE.slice(0, 3).map(a => ({
            id: a.id,
            title: a.title,
            image: a.coverImage,
            type: 'Art',
            status: a.featured ? 'Featured' : undefined,
            view: View.ART
        }));
        
        const stories = STORIES.slice(0, 2).map(s => ({
            id: s.id,
            title: s.title,
            image: s.image || 'https://picsum.photos/600/800',
            type: 'Story',
            status: 'Journal',
            view: View.STORIES
        }));

        const items = INVENTORY.slice(0, 2).map(i => ({
            id: i.id,
            title: i.title,
            image: i.image,
            type: i.category,
            status: 'Available',
            view: View.SHOP
        }));

        return [arts[0], items[0], stories[0], arts[1], stories[1], items[1], arts[2]].filter(Boolean);
    }, []);

    const readyToShip = useMemo(() => INVENTORY.filter(p => p.available).slice(0, 4), []);
    const featuredStories = useMemo(() => STORIES.slice(0, 4), []);

    const handleScroll = () => {
        if (latestScrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = latestScrollRef.current;
            const maxScroll = scrollWidth - clientWidth;
            setLatestProgress(scrollLeft / maxScroll);
        }
    };

    const handleNav = (view: View, hash?: string) => {
        setView(view);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (hash) {
            setTimeout(() => {
                const el = document.getElementById(hash);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    return (
        <div className="bg-paper-50 min-h-screen">
            
            {/* --- 2. CHOOSE YOUR WORLD (KINETIC ACCORDION) --- */}
            <section className="w-full relative z-10 -mt-24 md:-mt-[15vh] shadow-2xl">
                <div className="h-px w-full bg-white/20 relative z-20"></div>
                
                <div className="flex flex-col lg:flex-row w-full bg-stone-950/90 backdrop-blur-3xl">
                    <PortalColumn 
                        title="Explore Art" 
                        subtitle="The Archive"
                        description="All works, light sculptures, projection mapping, and the complete series archive."
                        image="https://picsum.photos/800/1200?random=101"
                        icon={Sparkles}
                        index="01"
                        isHovered={hoveredPortalIndex === 0}
                        isAnyHovered={hoveredPortalIndex !== null}
                        onHover={(state) => setHoveredPortalIndex(state ? 0 : null)}
                        onClick={() => handleNav(View.ART)}
                    />
                    <PortalColumn 
                        title="Jewelry" 
                        subtitle="Resonant Adornment"
                        description="Brass, silver, and copper pieces designed to conduct energy and anchor intention."
                        image="https://picsum.photos/800/1200?random=102"
                        icon={Diamond}
                        index="02"
                        isHovered={hoveredPortalIndex === 1}
                        isAnyHovered={hoveredPortalIndex !== null}
                        onHover={(state) => setHoveredPortalIndex(state ? 1 : null)}
                        onClick={() => handleNav(View.JEWELRY)}
                    />
                    <PortalColumn 
                        title="Oracle" 
                        subtitle="Systema Naturae"
                        description="Card decks, paper goods, and digital tools that weave with the art."
                        image="https://picsum.photos/800/1200?random=103"
                        icon={Layers}
                        index="03"
                        isHovered={hoveredPortalIndex === 2}
                        isAnyHovered={hoveredPortalIndex !== null}
                        onHover={(state) => setHoveredPortalIndex(state ? 2 : null)}
                        onClick={() => handleNav(View.ORACLE)}
                    />
                </div>
            </section>

            {/* --- 3. LATEST FROM THE STUDIO (PRECISION SCROLL) --- */}
            <section className="py-24 px-6 border-b border-wood-100 bg-paper-50 relative z-0">
                <div className="max-w-[1800px] mx-auto">
                    <SectionHeader title="Latest from the studio" />
                    
                    <div 
                        ref={latestScrollRef}
                        onScroll={handleScroll}
                        className="flex overflow-x-auto gap-6 pb-12 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory scrollbar-hide"
                    >
                        {latestMixed.map((item, idx) => (
                            <StudioCard 
                                key={idx}
                                image={item.image}
                                title={item.title}
                                type={item.type}
                                status={item.status}
                                onClick={() => handleNav(item.view)}
                            />
                        ))}
                    </div>

                    <div className="w-full h-px bg-wood-200 mt-4 relative overflow-hidden">
                        <div 
                            className="absolute top-0 left-0 h-full bg-wood-900 transition-all duration-100 ease-out"
                            style={{ width: '100px', transform: `translateX(${latestProgress * (latestScrollRef.current ? latestScrollRef.current.clientWidth - 100 : 0)}px)` }}
                        ></div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-wood-50/50">
                <div className="max-w-[1800px] mx-auto">
                    <SectionHeader 
                        title="Ready to live with" 
                        subtitle="Pieces currently available to bring into your home or space."
                        actionLabel="View All Available"
                        onAction={() => handleNav(View.SHOP)}
                    />

                    <div className="flex overflow-x-auto gap-6 pb-8 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory scrollbar-hide">
                        {readyToShip.map(product => (
                            <CinematicProductCard 
                                key={product.id}
                                product={product}
                                onClick={() => handleNav(View.SHOP)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <div className="bg-paper-50 border-t border-wood-200">
                <section className="border-b border-wood-200">
                    <div className="flex flex-col lg:flex-row min-h-[600px]">
                        <div className="flex-1 p-12 lg:p-24 flex flex-col justify-center border-r border-wood-200">
                            <span className="font-mono text-xs uppercase tracking-[0.3em] text-wood-500 block mb-8 font-bold">The Workshop</span>
                            <h2 className="font-serif text-5xl lg:text-7xl text-wood-900 mb-10 tracking-tight font-medium leading-[0.9]">
                                Form.<br/>Light.<br/>Silence.
                            </h2>
                            <p className="font-serif text-xl text-wood-700 leading-relaxed mb-12 max-w-lg font-light">
                                We create custom artworks, immersive projection mapping installations, and holistic space design for private and public environments.
                            </p>
                            <div className="flex flex-wrap gap-8">
                                <button 
                                    onClick={() => handleNav(View.STUDIO, 'studio-projects')}
                                    className="text-wood-900 border-b border-wood-900 pb-1 font-mono text-xs uppercase tracking-[0.2em] hover:text-bronze-600 hover:border-bronze-600 transition-colors font-bold flex items-center gap-2"
                                >
                                    Project Inquiry <ArrowRight size={14} />
                                </button>
                                <button 
                                    onClick={() => handleNav(View.STUDIO, 'studio-about')}
                                    className="text-wood-500 border-b border-wood-300 pb-1 font-mono text-xs uppercase tracking-[0.2em] hover:text-wood-900 hover:border-wood-900 transition-colors font-bold"
                                >
                                    Studio Philosophy
                                </button>
                            </div>
                        </div>

                         <div className="flex-1 bg-wood-100/50 relative overflow-hidden min-h-[400px] lg:min-h-auto">
                            <img src="https://picsum.photos/1200/1200?grayscale" className="absolute inset-0 w-full h-full object-cover grayscale opacity-80 mix-blend-multiply" alt="Studio Detail" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="border border-wood-900/10 w-[80%] h-[80%]"></div>
                            </div>
                         </div>
                    </div>
                </section>

                <section className="py-24 px-6 lg:px-24">
                    <div className="max-w-[1800px] mx-auto">
                        <div className="flex justify-between items-end mb-16">
                            <h2 className="font-serif text-4xl text-wood-900">Journal</h2>
                            <button 
                                onClick={() => handleNav(View.STORIES)}
                                className="hidden md:flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 hover:text-wood-900 font-bold"
                            >
                                Full Archive <ArrowRight size={14} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col">
                            {featuredStories.map(story => (
                                <StoryListItem 
                                    key={story.id}
                                    story={story}
                                    onClick={() => handleNav(View.STORIES)}
                                />
                            ))}
                        </div>

                         <div className="mt-12 md:hidden text-center">
                            <button 
                                onClick={() => handleNav(View.STORIES)}
                                className="font-mono text-xs uppercase tracking-widest text-wood-900 border-b border-wood-900 pb-1 font-bold"
                            >
                                View All Stories
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Home;
