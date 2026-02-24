
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE, CREATION_CATEGORIES } from '../data/mockData';
import { Artwork } from '../types';
import { ArrowRight } from 'lucide-react';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/* Map category label → URL. Categories with a dedicated page use their `link`,
   others fall back to the creations page with a category filter.              */
const CATEGORY_URL_MAP: Record<string, string> = {};
for (const cat of CREATION_CATEGORIES) {
    CATEGORY_URL_MAP[cat.label] = (cat as { link?: string }).link
        ?? `/creations?category=${encodeURIComponent(cat.label)}`;
}

/* ─── Gallery Tile Card ───────────────────────────────────────────────────── */
/* Image + title link to the piece. Category label links to the category.     */

const GalleryTileCard: React.FC<{ art: Artwork }> = ({ art }) => (
    <div className="group break-inside-avoid mb-3 sm:mb-4 lg:mb-5 border border-wood-200 bg-white transition-all duration-500 hover:shadow-lg hover:border-wood-300">
        {/* Image — links to the piece */}
        <Link to={`/creations/${art.id}`} className="block overflow-hidden">
            <img
                src={art.coverImage}
                alt={`${art.title} by Adrian Rasmussen`}
                className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
            />
        </Link>
        {/* Label band */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-paper-100 border-t border-wood-100">
            <Link to={`/creations/${art.id}`}>
                <h3 className="font-serif text-base sm:text-lg text-wood-900 hover:text-bronze-700 transition-colors font-medium leading-snug">
                    {art.title}
                </h3>
            </Link>
            <Link to={CATEGORY_URL_MAP[art.category] || '/creations'} className="mt-1 block">
                <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-wood-400 hover:text-bronze-500 transition-colors font-semibold leading-none">
                    {art.category}
                </span>
            </Link>
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

const Home: React.FC = () => {
    /* Show only pieces you've marked as featured in mockData */
    const featuredPieces = useMemo(() => FULL_ARCHIVE.filter(a => a.featured), []);

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
                        <p className="font-serif text-base sm:text-lg text-wood-500 italic">Selected works.</p>
                    </div>
                    <Link
                        to="/creations"
                        className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-wood-900 hover:text-bronze-600 font-semibold whitespace-nowrap"
                    >
                        Full Archive <ArrowRight size={14} />
                    </Link>
                </div>

                {/* Tile card grid — featured pieces only */}
                {featuredPieces.length > 0 ? (
                    <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-4 lg:gap-5 px-4 sm:px-6">
                        {featuredPieces.map(art => (
                            <GalleryTileCard key={art.id} art={art} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 px-6">
                        <p className="font-serif text-xl text-wood-500 italic">
                            Pieces coming soon.
                        </p>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <Link
                            to="/writings#living-knowledge"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-xs uppercase tracking-[0.1em] text-bronze-600 block mb-3 font-semibold">Living Knowledge</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                Deep explorations earned through direct experience
                            </h3>
                        </Link>
                        <Link
                            to="/writings#beneath-the-surface"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-xs uppercase tracking-[0.1em] text-bronze-600 block mb-3 font-semibold">Beneath the Surface</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                The meaning and origins within the work
                            </h3>
                        </Link>
                        <Link
                            to="/writings#the-practice"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-xs uppercase tracking-[0.1em] text-bronze-600 block mb-3 font-semibold">The Practice</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                How creation happens
                            </h3>
                        </Link>
                        <Link
                            to="/writings#the-path"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-xs uppercase tracking-[0.1em] text-bronze-600 block mb-3 font-semibold">The Path</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                The personal journey behind the art
                            </h3>
                        </Link>
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
