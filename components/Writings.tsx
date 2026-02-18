import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Story, StoryType, Artwork, Product } from '../types';
import { STORIES, FULL_ARCHIVE, INVENTORY } from '../data/mockData';
import { 
    Clock, ArrowLeft, ArrowRight, Image as ImageIcon, Sparkles, 
    MoveRight, Search, Square, Diamond, Hexagon, PenTool, X, Share2,
    ChevronDown, ChevronUp, BookOpen, LayoutGrid
} from 'lucide-react';

// --- ICONS & TYPES MAP ---
const TYPE_ICONS: Record<StoryType, React.ElementType> = {
    art: ImageIcon, // 🖼 Art
    symbols: Square, // ◻ Symbols
    jewelry: Diamond, // ◆ Jewelry
    places: Hexagon, // ⬡ Places
    practice: Sparkles, // ✶ Practice
    poetry: PenTool, // ✒ Poetry
};

const TYPE_LABELS: Record<StoryType, string> = {
    art: 'Art',
    symbols: 'Symbols',
    jewelry: 'Jewelry',
    places: 'Places',
    practice: 'Practice',
    poetry: 'Poetry'
};

const ALL_TYPES: StoryType[] = ['art', 'symbols', 'jewelry', 'places', 'practice', 'poetry'];

// --- SUB-COMPONENTS ---

const GeometricDivider = () => (
    <div className="flex items-center justify-center py-12 opacity-40">
        <div className="h-px w-12 bg-wood-400"></div>
        <div className="mx-4 text-bronze-500 text-sm">◆</div>
        <div className="h-px w-12 bg-wood-400"></div>
    </div>
);

// ICON FILTER COMPONENT (Replaces FilterTab)
const IconFilter: React.FC<{ 
    label: string; 
    active: boolean; 
    onClick: () => void;
    Icon: React.ElementType; 
}> = ({ label, active, onClick, Icon }) => {
    return (
        <button 
            onClick={onClick}
            className="group flex flex-col items-center gap-1.5 shrink-0"
        >
            <div className={`
                w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border transition-all duration-300
                ${active 
                    ? 'bg-wood-900 border-wood-900 text-paper-50 shadow-md transform scale-105' 
                    : 'bg-paper-50 border-wood-300 text-wood-400 hover:border-bronze-400 hover:text-bronze-600'}
            `}>
                <Icon size={16} className="md:w-5 md:h-5" strokeWidth={1.5} />
            </div>
            <span className={`
                text-[9px] md:text-[10px] font-mono uppercase tracking-widest font-bold transition-all
                ${active ? 'text-wood-900' : 'text-wood-400'}
            `}>
                {label}
            </span>
        </button>
    );
};

// "Start Here" Card - Standard Card Layout
const StartHereCard: React.FC<{ story: Story, onClick: () => void }> = ({ story, onClick }) => {
    const Icon = TYPE_ICONS[story.type];
    return (
        <div 
            onClick={onClick}
            className="group w-full bg-white border border-wood-200 p-6 flex flex-col justify-between cursor-pointer hover:border-bronze-400 hover:shadow-md transition-all duration-500"
        >
            <div className="mb-4">
                 <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2 text-bronze-700 opacity-90">
                        <Icon size={14} />
                        <span className="font-mono text-xs uppercase tracking-widest font-bold">{TYPE_LABELS[story.type]}</span>
                     </div>
                     {/* Decoration */}
                     <div className="w-1.5 h-1.5 rounded-full bg-wood-300 group-hover:bg-bronze-500 transition-colors"></div>
                 </div>
                 
                 <h3 className="font-serif text-xl md:text-2xl text-wood-900 leading-tight group-hover:text-bronze-700 transition-colors mb-3 font-medium">
                     {story.title}
                 </h3>
                 <p className="font-serif text-base text-wood-700 line-clamp-3 leading-relaxed transition-opacity">
                     {story.excerpt}
                 </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-wood-600 group-hover:text-bronze-700 transition-colors border-t border-wood-200 pt-4 font-bold">
                Begin Reading <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
        </div>
    );
};

// Expanding Story Row (The Accordion Behavior)
const StoryAccordionItem: React.FC<{ story: Story, onClick: () => void }> = ({ story, onClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const Icon = TYPE_ICONS[story.type];
    
    // Desktop Hover Logic with "Intent" Delay
    const handleMouseEnter = () => {
        if (window.innerWidth >= 768) {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => {
                setIsOpen(true);
            }, 100); // 100ms delay to prevent accidental triggers
        }
    };

    const handleMouseLeave = () => {
        if (window.innerWidth >= 768) {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setIsOpen(false);
        }
    };

    // Mobile Toggle Logic
    const handleClick = (e: React.MouseEvent) => {
        if (window.innerWidth < 768) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
        } else {
            onClick(); // On desktop click opens full story immediately
        }
    };

    return (
        <div 
            className={`
                border-b border-wood-200 transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
                ${isOpen ? 'bg-wood-100/40 border-wood-300 pb-2' : 'bg-transparent pb-0'}
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            {/* Header Row (Always Visible) */}
            <div className="py-6 flex items-start md:items-center gap-4 md:gap-8 cursor-pointer group px-4 md:px-6">
                <div className={`shrink-0 mt-1 md:mt-0 w-8 flex justify-center transition-colors duration-500 ${isOpen ? 'text-bronze-600' : 'text-wood-400 group-hover:text-wood-600'}`}>
                    <Icon size={20} strokeWidth={1.5} />
                </div>
                
                <div className="flex-1 min-w-0">
                    <h3 className={`font-serif text-xl md:text-2xl leading-tight transition-colors duration-300 font-medium ${isOpen ? 'text-wood-900' : 'text-wood-800 group-hover:text-wood-600'}`}>
                        {story.title}
                    </h3>
                    <div className={`
                        font-serif text-base text-wood-600 line-clamp-1 transition-all duration-500
                        ${isOpen ? 'opacity-0 h-0 overflow-hidden mt-0' : 'opacity-100 mt-1'}
                    `}>
                         {story.subtitle || story.excerpt}
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-4">
                     <span className={`hidden md:block font-mono text-xs uppercase tracking-widest transition-colors duration-300 font-bold ${isOpen ? 'text-bronze-600' : 'text-wood-500 group-hover:text-wood-600'}`}>
                        {story.date}
                     </span>
                     {/* Mobile Indicator */}
                     <div className={`md:hidden text-wood-400 transition-transform duration-500 ${isOpen ? 'rotate-180 text-bronze-500' : ''}`}>
                        <ChevronDown size={18} />
                     </div>
                </div>
            </div>

            {/* Expanded Content - USING GRID ANIMATION FOR SMOOTH HEIGHT */}
            <div className={`
                grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
                ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-50'}
            `}>
                <div className="overflow-hidden min-h-0">
                    <div className="px-4 md:px-6 pb-8 md:pl-20 md:pr-12 pt-0">
                        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
                            {/* Image */}
                            {story.image && (
                                <div className="w-full md:w-72 aspect-video bg-wood-200 shrink-0 overflow-hidden rounded-sm border border-wood-200 shadow-sm">
                                    <img 
                                        src={story.image} 
                                        className="w-full h-full object-cover transition-transform duration-[2s]" 
                                        style={{ transform: isOpen ? 'scale(1)' : 'scale(1.1)' }}
                                        alt="" 
                                    />
                                </div>
                            )}
                            
                            {/* Excerpt & Action */}
                            <div className="flex-1 flex flex-col justify-between gap-6">
                                <p className="font-serif text-lg md:text-xl text-wood-800 leading-relaxed font-normal">
                                    {story.excerpt}
                                </p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                                    className="group inline-flex items-center gap-3 px-6 py-3 bg-white border border-wood-200 hover:border-bronze-400 hover:shadow-md transition-all duration-300 self-start rounded-sm"
                                >
                                    <span className="font-mono text-xs uppercase tracking-widest text-wood-900 group-hover:text-bronze-700 font-bold">Read Full Entry</span>
                                    <ArrowRight size={14} className="text-wood-400 group-hover:text-bronze-600 group-hover:translate-x-1 transition-all" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- CONNECTED OBJECT COMPONENT ---
const ConnectedObject: React.FC<{ story: Story }> = ({ story }) => {
    const relatedArt: Artwork | undefined = story.relatedArtifactId 
        ? FULL_ARCHIVE.find(a => a.id === story.relatedArtifactId) 
        : undefined;

    const relatedProduct: Product | undefined = story.relatedProductId
        ? INVENTORY.find(p => p.id === story.relatedProductId)
        : undefined;

    if (!relatedArt && !relatedProduct) return null;

    const item = relatedArt || relatedProduct!;
    const isArt = !!relatedArt;
    
    let label = "Connected Object";
    if (story.type === 'art') label = "The piece in this story";
    if (story.type === 'jewelry') label = "Resonant pieces";
    if (story.type === 'symbols') label = "Related system";

    return (
        <div className="my-12 border-l-2 border-bronze-500 pl-6 py-2">
            <span className="font-mono text-xs uppercase tracking-widest text-bronze-600 block mb-3 font-bold">
                {label}
            </span>
            <div className="flex gap-4 items-center group cursor-pointer hover:bg-wood-100/30 transition-colors p-3 -ml-3 rounded-sm">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-wood-200 shrink-0 overflow-hidden border border-wood-200">
                     <img 
                        src={isArt ? (item as Artwork).coverImage : (item as Product).image} 
                        className="w-full h-full object-cover" 
                        alt={item.title}
                     />
                </div>
                <div>
                    <h4 className="font-serif text-lg text-wood-900 mb-1 leading-tight line-clamp-1 font-medium">
                        {item.title}
                    </h4>
                    <p className="font-mono text-xs uppercase tracking-widest text-wood-600 mb-2 font-bold">
                        {isArt ? (item as Artwork).category : (item as Product).available ? 'Available' : 'Archived'}
                    </p>
                    <button className="text-xs font-mono uppercase tracking-widest text-wood-900 border-b border-wood-300 pb-0.5 group-hover:border-bronze-500 group-hover:text-bronze-600 transition-colors font-bold">
                        View {isArt ? 'Artwork' : 'Item'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const Writings: React.FC = () => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  
  // Index State
  const [activeFilter, setActiveFilter] = useState<StoryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Reader State
  const [readingProgress, setReadingProgress] = useState(0);

  // --- FILTER LOGIC ---
  const filteredStories = useMemo(() => {
      let data = STORIES;

      if (activeFilter !== 'all') {
          data = data.filter(s => s.type === activeFilter);
      }

      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          data = data.filter(s => 
              s.title.toLowerCase().includes(q) || 
              (s.subtitle && s.subtitle.toLowerCase().includes(q))
          );
      }

      return data;
  }, [activeFilter, searchQuery]);

  // --- SUGGESTIONS LOGIC ---
  const suggestions = useMemo(() => {
      if (!searchQuery.trim()) return [];
      const q = searchQuery.toLowerCase();
      // Simple match: Title includes query
      return STORIES.filter(s => s.title.toLowerCase().includes(q)).slice(0, 5);
  }, [searchQuery]);

  const startHereStories = useMemo(() => {
      return STORIES.filter(s => s.isStartHere).slice(0, 3);
  }, []);

  // --- SCROLL PROGRESS ---
  useEffect(() => {
    const handleScroll = () => {
        if (!selectedStory) return;
        const totalHeight = document.body.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / totalHeight) * 100;
        setReadingProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedStory]);

  const handleSuggestionClick = (story: Story) => {
      setSelectedStory(story);
      setSearchQuery('');
      setIsSearchFocused(false);
      window.scrollTo(0,0);
  };

  // --- VIEW: DETAIL PAGE ---
  if (selectedStory) {
      const Icon = TYPE_ICONS[selectedStory.type];
      
      const relatedSame = STORIES.find(s => s.type === selectedStory.type && s.id !== selectedStory.id);
      const relatedDiff = STORIES.find(s => s.type !== selectedStory.type && s.id !== selectedStory.id);
      const related = [relatedSame, relatedDiff].filter(Boolean) as Story[];

      return (
          <article className="min-h-screen bg-paper-50 text-wood-900 animate-fade-in relative selection:bg-bronze-200 selection:text-wood-900 pb-32">
              
              {/* Sticky Navigation Bar */}
              <div className="sticky top-[56px] md:top-[70px] z-[90] bg-paper-50/95 backdrop-blur-md border-b border-wood-200 px-6 py-3 flex items-center justify-between transition-all shadow-sm">
                  <button 
                      onClick={() => setSelectedStory(null)}
                      className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-wood-600 hover:text-wood-900 transition-colors group font-bold"
                  >
                      <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                      <span>Back to Index</span>
                  </button>

                  <div className="hidden md:flex items-center gap-2 opacity-80">
                     <BookOpen size={14} className="text-wood-500" />
                     <span className="font-mono text-xs uppercase tracking-widest text-wood-600 font-bold">Reading Mode</span>
                  </div>

                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-wood-200">
                       <div className="h-full bg-bronze-500 transition-all duration-100 ease-out" style={{ width: `${readingProgress}%` }}></div>
                  </div>
              </div>

              {/* Header Block */}
              <div className="pt-16 pb-12 px-6 max-w-[800px] mx-auto text-center">
                  <div className="inline-flex items-center gap-2 mb-6 text-bronze-700 border border-bronze-200 px-4 py-2 rounded-full bg-bronze-50/50">
                      <Icon size={14} />
                      <span className="font-mono text-xs uppercase tracking-widest font-bold">{TYPE_LABELS[selectedStory.type]}</span>
                  </div>
                  
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif text-wood-900 leading-[1.1] tracking-tight mb-4 font-medium">
                      {selectedStory.title}
                  </h1>
                  
                  {selectedStory.subtitle && (
                      <p className="text-lg md:text-2xl font-serif text-wood-700 font-normal leading-relaxed mb-6">
                          {selectedStory.subtitle}
                      </p>
                  )}

                  <div className="flex items-center justify-center gap-6 text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">
                      <span>{selectedStory.date}</span>
                  </div>
              </div>

              {/* Main Content */}
              <div className="px-6">
                  <div className="max-w-[740px] mx-auto">
                      {selectedStory.image && (
                          <div className="mb-12 rounded-sm overflow-hidden shadow-sm border border-wood-100">
                              <img src={selectedStory.image} alt={selectedStory.title} className="w-full h-auto max-h-[500px] object-cover" />
                          </div>
                      )}

                      <div className="prose prose-lg md:prose-xl prose-stone max-w-none font-serif text-wood-900 leading-loose">
                          {selectedStory.content.map((paragraph, idx) => (
                              <React.Fragment key={idx}>
                                  <p className="mb-6 text-wood-800">{paragraph}</p>
                                  {idx === 1 && <ConnectedObject story={selectedStory} />}
                                  {idx < selectedStory.content.length - 1 && idx % 2 === 1 && <GeometricDivider />}
                              </React.Fragment>
                          ))}
                      </div>

                      {/* Related Stories */}
                      <div className="mt-24 pt-12 border-t border-wood-200">
                          <div className="flex items-center gap-3 mb-6 opacity-80">
                               <div className="h-px w-8 bg-wood-400"></div>
                               <span className="font-mono text-xs text-wood-600 uppercase tracking-[0.2em] font-bold">More to explore</span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {related.map(s => {
                                  const RelIcon = TYPE_ICONS[s.type];
                                  return (
                                      <div 
                                        key={s.id} 
                                        onClick={() => { setSelectedStory(s); window.scrollTo(0,0); }}
                                        className="group cursor-pointer bg-white border border-wood-200 p-6 hover:border-bronze-400 transition-all hover:shadow-sm"
                                      >
                                          <div className="flex items-center gap-2 text-wood-500 mb-3">
                                              <RelIcon size={14} />
                                              <span className="font-mono text-xs uppercase tracking-widest font-bold">{TYPE_LABELS[s.type]}</span>
                                          </div>
                                          <h4 className="font-serif text-xl text-wood-900 group-hover:text-bronze-700 transition-colors mb-2 line-clamp-1 font-medium">
                                              {s.title}
                                          </h4>
                                          <p className="font-serif text-base text-wood-600 line-clamp-2">
                                            {s.excerpt}
                                          </p>
                                      </div>
                                  )
                              })}
                          </div>
                          <div className="mt-16 text-center">
                              <button 
                                onClick={() => setSelectedStory(null)}
                                className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-wood-600 hover:text-wood-900 transition-colors border-b border-wood-200 pb-1 hover:border-wood-900 font-bold"
                              >
                                  <ArrowLeft size={14} /> Return to Index
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </article>
      );
  }

  // --- VIEW: INDEX PAGE ---
  return (
      <section className="min-h-screen bg-paper-50 pt-24 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
              
              {/* Header */}
              <header className="mb-8 md:mb-16">
                  <h1 className="text-4xl md:text-6xl font-serif text-wood-900 mb-3 tracking-tight font-medium">Stories</h1>
                  <p className="font-serif text-lg md:text-xl text-wood-700 font-normal max-w-lg">
                      Reflections on process, materials, and the silence between things.
                  </p>
              </header>

              {/* Start Here Strip - Fixed Layout */}
              {startHereStories.length > 0 && activeFilter === 'all' && !searchQuery && (
                  <div className="mb-16">
                      <div className="flex items-center gap-3 mb-6 opacity-80">
                           <div className="w-1.5 h-1.5 bg-bronze-500 rounded-full"></div>
                           <span className="font-mono text-xs text-wood-600 uppercase tracking-[0.2em] font-bold">Start Here</span>
                      </div>
                      
                      {/* Vertical Stack on Mobile, Grid on Desktop */}
                      <div className="flex flex-col md:grid md:grid-cols-3 gap-6">
                          {startHereStories.map(story => (
                              <StartHereCard 
                                key={story.id} 
                                story={story} 
                                onClick={() => { setSelectedStory(story); window.scrollTo(0,0); }} 
                              />
                          ))}
                      </div>
                  </div>
              )}

              {/* Type Filters & Search - Wrapped properly */}
              <div className="sticky top-[60px] z-30 bg-paper-50/95 backdrop-blur-md -mx-6 px-6 border-b border-wood-200 mb-0 transition-all shadow-sm">
                  <div className="flex flex-col gap-4 py-4 max-w-4xl mx-auto relative">
                      
                      {/* Top: Search & Suggestions */}
                      <div className="relative w-full z-50">
                            <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-wood-400" />
                            <input 
                                type="text" 
                                placeholder="Search the archive..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                className="w-full bg-transparent border-b border-wood-200 pl-7 pr-8 py-2 font-serif text-base text-wood-900 placeholder-wood-400 focus:outline-none focus:border-bronze-500 transition-colors"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-wood-400 hover:text-wood-900 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}

                            {/* Suggestions Dropdown */}
                            {isSearchFocused && searchQuery && (
                                <div className="absolute top-full left-0 w-full bg-paper-50 border border-wood-200 shadow-xl mt-1 animate-fade-in rounded-sm overflow-hidden z-50">
                                    {suggestions.length > 0 ? (
                                        suggestions.map(s => {
                                            const SuggIcon = TYPE_ICONS[s.type];
                                            return (
                                                <div 
                                                    key={s.id}
                                                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                                                    className="flex items-center gap-3 p-3 hover:bg-wood-100/50 cursor-pointer border-b border-wood-100 last:border-0 transition-colors"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-wood-100 flex items-center justify-center text-wood-500 shrink-0">
                                                        <SuggIcon size={14} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-serif text-base text-wood-900 truncate font-medium">{s.title}</span>
                                                        <span className="font-mono text-[9px] uppercase tracking-widest text-wood-500">{s.date}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-4 text-center">
                                            <span className="font-mono text-xs uppercase tracking-widest text-wood-400">No matches found</span>
                                        </div>
                                    )}
                                </div>
                            )}
                      </div>

                      {/* Bottom: Icons Row (Fit on screen) */}
                      <div className="flex items-center justify-between md:justify-start md:gap-3 overflow-visible pb-4 pt-2 px-0 md:px-0">
                            <IconFilter 
                                label="All" 
                                active={activeFilter === 'all'} 
                                onClick={() => setActiveFilter('all')} 
                                Icon={LayoutGrid}
                            />
                            {ALL_TYPES.map(type => (
                                <IconFilter 
                                    key={type} 
                                    label={TYPE_LABELS[type]} 
                                    active={activeFilter === type} 
                                    onClick={() => setActiveFilter(type)} 
                                    Icon={TYPE_ICONS[type]}
                                />
                            ))}
                      </div>
                  </div>
              </div>

              {/* Stories List - Accordion Style */}
              <div className="flex flex-col min-h-[40vh] border-t border-wood-200 md:border-t-0 mt-4">
                  {filteredStories.length > 0 ? (
                      filteredStories.map(story => (
                          <StoryAccordionItem 
                              key={story.id} 
                              story={story} 
                              onClick={() => { setSelectedStory(story); window.scrollTo(0,0); }} 
                          />
                      ))
                  ) : (
                      <div className="py-20 text-center opacity-60">
                          <p className="font-serif text-lg text-wood-500">No stories found.</p>
                          <button 
                              onClick={() => { setActiveFilter('all'); setSearchQuery(''); }}
                              className="mt-4 font-mono text-xs uppercase tracking-widest text-wood-900 border-b border-wood-900 font-bold"
                          >
                              Clear Filters
                          </button>
                      </div>
                  )}
              </div>

          </div>
      </section>
  );
};

export default Writings;