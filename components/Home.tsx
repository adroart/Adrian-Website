
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE, CREATION_CATEGORIES, STORIES } from '../data/mockData';
import { Artwork } from '../types';
import { ArrowRight } from 'lucide-react';

/* ─── Gallery Tile Card ───────────────────────────────────────────────────── */
/* Self-contained card: image at natural aspect ratio + label band inside
   the same border. The tinted band visually bonds name to image.            */

const GalleryTileCard: React.FC<{ art: Artwork }> = ({ art }) => (
    <div className="group cursor-pointer break-inside-avoid mb-3 sm:mb-4 lg:mb-5 border border-wood-200 bg-white transition-all duration-500 hover:shadow-lg hover:border-wood-300">
        {/* Image — natural aspect ratio, no overlay */}
        <div className="overflow-hidden">
            <img
                src={art.coverImage}
                alt={`${art.title} by Adrian Rasmussen`}
                className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
            />
        </div>
        {/* Label band — tinted background, inside the card border */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-paper-100 border-t border-wood-100">
            <h3 className="font-serif text-sm sm:text-base text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                {art.title}
            </h3>
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-wood-400 font-semibold mt-1 block leading-none">
                {art.category}
            </span>
        </div>
    </div>
);

/* ─── Pathway Block ───────────────────────────────────────────────────────── */

const PathwayBlock: React.FC<{
    title: string;
    subtitle: string;
    to: string;
}> = ({ title, subtitle, to }) => (
    <Link
        to={to}
        className="group w-full text-left py-8 md:py-12 border-t border-wood-200 hover:bg-white transition-colors relative overflow-hidden block"
    >
        <div className="flex justify-between items-end relative z-10 px-4">
            <div>
                <h3 className="font-serif text-3xl md:text-5xl text-wood-900 mb-2 group-hover:translate-x-2 active:translate-x-1 transition-transform duration-500 font-medium">
                    {title}
                </h3>
                <p className="font-serif text-xl text-wood-500 group-hover:translate-x-2 active:translate-x-1 transition-transform duration-500 delay-75 italic font-light">
                    {subtitle}
                </p>
            </div>
            <div className="w-12 h-12 rounded-full border border-wood-200 flex items-center justify-center text-wood-400 group-hover:border-bronze-500 group-hover:text-bronze-600 transition-all group-hover:scale-110">
                <ArrowRight size={20} />
            </div>
        </div>
    </Link>
);

/* ─── Home Component ──────────────────────────────────────────────────────── */

const GALLERY_LIMIT = 12;

const Home: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    /* Piece counts per category — for chip labels */
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const art of FULL_ARCHIVE) {
            counts[art.category] = (counts[art.category] || 0) + 1;
        }
        return counts;
    }, []);

    /* Filtered + limited pieces for the grid */
    const displayedPieces = useMemo(() => {
        if (!activeCategory) {
            return FULL_ARCHIVE.filter(a => a.featured).slice(0, GALLERY_LIMIT);
        }
        return FULL_ARCHIVE.filter(a => a.category === activeCategory).slice(0, GALLERY_LIMIT);
    }, [activeCategory]);

    /* Total count for "See all" link */
    const totalInCategory = useMemo(() => {
        if (!activeCategory) return FULL_ARCHIVE.filter(a => a.featured).length;
        return FULL_ARCHIVE.filter(a => a.category === activeCategory).length;
    }, [activeCategory]);

    /* Build the "See all" destination — uses dedicated page when one exists */
    const seeAllLink = useMemo(() => {
        if (!activeCategory) return '/creations';
        const cat = CREATION_CATEGORIES.find(c => c.label === activeCategory);
        if (cat && (cat as { link?: string }).link) return (cat as { link?: string }).link!;
        return `/creations?category=${encodeURIComponent(activeCategory)}`;
    }, [activeCategory]);

    return (
        <div className="bg-paper-50 min-h-screen animate-fade-in">

            {/* 3.2 Introduction */}
            <section className="py-16 md:py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl text-wood-800 leading-snug font-light border-none pl-0">
                        <span className="ml-[-0.5em]">"</span>Art is the experience of listening, bringing what is felt from the whispers into form. Creating the artifacts of the future in reverence of this moment."
                    </blockquote>
                    <div className="mt-12 space-y-6 text-center">
                        <p className="font-serif text-lg md:text-xl text-wood-600 leading-[1.7] font-light">
                            My creations bring people together. They have a way of speaking directly through the heart. There is no need to understand what you are looking at. Art is the reminder. Something to feel without reading a word.
                        </p>
                    </div>
                </div>
            </section>

            {/* 3.3 Browse Creations — Tile Cards + Category Chips */}
            <section className="py-16 sm:py-20">
                {/* Section header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-6 sm:mb-8 px-4 sm:px-6">
                    <div>
                        <h2 className="font-serif text-3xl sm:text-4xl text-wood-900 mb-1 font-medium">Creations</h2>
                        <p className="font-serif text-base sm:text-lg text-wood-500 italic">Browse by category.</p>
                    </div>
                    <Link
                        to="/creations"
                        className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-wood-900 hover:text-bronze-600 font-semibold whitespace-nowrap"
                    >
                        Full Archive <ArrowRight size={14} />
                    </Link>
                </div>

                {/* Category chip bar — horizontally scrollable on mobile */}
                <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 pb-2 mb-8 sm:mb-10 scrollbar-hide">
                    {/* "All" chip */}
                    <button
                        type="button"
                        onClick={() => setActiveCategory(null)}
                        className={`flex-shrink-0 font-mono text-xs uppercase tracking-[0.15em] font-semibold px-4 py-2 border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 ${
                            !activeCategory
                                ? 'border-bronze-500 text-bronze-700 bg-bronze-50'
                                : 'border-wood-200 text-wood-500 hover:border-wood-400 hover:text-wood-700'
                        }`}
                    >
                        All
                    </button>
                    {CREATION_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.label)}
                            className={`flex-shrink-0 font-mono text-xs uppercase tracking-[0.15em] font-semibold px-4 py-2 border transition-all duration-300 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 ${
                                activeCategory === cat.label
                                    ? 'border-bronze-500 text-bronze-700 bg-bronze-50'
                                    : 'border-wood-200 text-wood-500 hover:border-wood-400 hover:text-wood-700'
                            }`}
                        >
                            {cat.label}
                            <span className={`ml-1.5 ${activeCategory === cat.label ? 'text-bronze-400' : 'text-wood-300'}`}>
                                {categoryCounts[cat.label] || 0}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tile card grid — 2 cols mobile, 3 cols desktop, 4 cols xl */}
                {displayedPieces.length > 0 ? (
                    <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-4 lg:gap-5 px-4 sm:px-6">
                        {displayedPieces.map(art => (
                            <Link key={art.id} to={`/creations/${art.id}`}>
                                <GalleryTileCard art={art} />
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 px-6">
                        <p className="font-serif text-xl text-wood-500 italic">
                            Pieces coming soon.
                        </p>
                    </div>
                )}

                {/* "See all" link — shown when the category has more pieces than the grid limit */}
                {totalInCategory > GALLERY_LIMIT && (
                    <div className="text-center mt-10 px-4">
                        <Link
                            to={seeAllLink}
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold border border-wood-200 px-6 py-3 hover:border-bronze-400 transition-all"
                        >
                            See all {totalInCategory} pieces <ArrowRight size={14} />
                        </Link>
                    </div>
                )}
            </section>

            {/* 3.4 The Differentiator */}
            <section className="py-16 md:py-32 px-6 bg-wood-900 text-paper-50 relative overflow-hidden dark-preserve">
                <div className="absolute top-0 right-0 w-[50%] h-full bg-[url('https://picsum.photos/1200/1200?random=99')] opacity-10 bg-cover mix-blend-overlay"></div>
                <div className="max-w-4xl mx-auto relative z-10">
                    <h2 className="font-serif text-3xl md:text-5xl leading-[1.15] mb-10 font-medium">
                        The geometry is exact. The laser is precise.{' '}
                        <span className="hidden md:inline"><br/></span>
                        <span className="text-bronze-300">But we humans embrace the splatter, the imperfect symmetry, the crystal that feels perfect but sits just slightly off.</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 text-lg font-serif font-light text-paper-200 leading-[1.7]">
                        <p>
                            Not everything here is painted. Some leave the wood as it is. Others come to life with light. Most are original paintings on multidimensional forms.
                        </p>
                        <p>
                            Between the endless ceremony, art is our prayer. Every piece touched by the Technician of the Sacred, yet it is not any one of us but a way. A family, different origins, one mother, earth.
                        </p>
                    </div>
                </div>
            </section>

            {/* 3.5 Pathways */}
            <section className="max-w-4xl mx-auto px-6 py-16 md:py-24">
                <PathwayBlock
                    title="Creations"
                    subtitle="See what exists"
                    to="/creations"
                />
                <PathwayBlock
                    title="Writings"
                    subtitle="The philosophy behind the work"
                    to="/writings"
                />
                <PathwayBlock
                    title="Inquire"
                    subtitle="Begin a conversation"
                    to="/inquire"
                />
            </section>

            {/* 3.6 From the Writings */}
            <section className="bg-wood-50 py-16 md:py-24 px-6 border-t border-wood-200">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <h2 className="font-serif text-4xl text-wood-900 font-medium">From the Writings</h2>
                        <Link to="/writings" className="hidden md:flex font-mono text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 font-semibold items-center gap-2">
                            Explore All <ArrowRight size={14}/>
                        </Link>
                    </div>

                    {/* Hero + supporting layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        {/* Featured story — large card */}
                        {STORIES.filter(s => s.isFeatured).slice(0, 1).map(story => (
                            <Link
                                key={story.id}
                                to={`/writings/${story.slug}`}
                                className="group bg-white border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-md overflow-hidden"
                            >
                                <div className="aspect-[16/10] overflow-hidden">
                                    <img
                                        src={story.image}
                                        alt={story.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="p-6 md:p-8">
                                    <h3 className="font-serif text-2xl md:text-3xl text-wood-900 mb-4 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                        {story.title}
                                    </h3>
                                    <p className="font-serif text-base text-wood-600 leading-[1.7] font-light line-clamp-3">
                                        {story.excerpt}
                                    </p>
                                    <span className="inline-flex items-center gap-2 mt-5 font-mono text-xs uppercase tracking-[0.15em] text-wood-500 group-hover:text-bronze-600 font-semibold transition-colors">
                                        Read <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                                    </span>
                                </div>
                            </Link>
                        ))}

                        {/* Supporting stories — stacked column */}
                        <div className="flex flex-col gap-6 lg:gap-8">
                            {STORIES.filter(s => !s.isFeatured).slice(0, 3).map(story => (
                                <Link
                                    key={story.id}
                                    to={`/writings/${story.slug}`}
                                    className="group bg-white border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-md flex overflow-hidden"
                                >
                                    <div className="w-28 sm:w-36 md:w-44 flex-shrink-0 overflow-hidden">
                                        <img
                                            src={story.image}
                                            alt={story.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-4 sm:p-5 md:p-6 flex flex-col justify-center min-w-0">
                                        <h3 className="font-serif text-lg sm:text-xl text-wood-900 mb-2 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                            {story.title}
                                        </h3>
                                        <p className="font-serif text-sm text-wood-500 leading-relaxed font-light line-clamp-2 hidden sm:block">
                                            {story.excerpt}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 md:hidden text-center">
                        <Link to="/writings" className="font-mono text-xs uppercase tracking-[0.2em] text-wood-900 border-b border-wood-900 pb-1 font-semibold">
                            Explore All Writings
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
