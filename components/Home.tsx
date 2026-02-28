
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE, CREATION_CATEGORIES, STORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import GalleryTileCard from './GalleryTileCard';
import ArtImage from './ArtImage';

/* ─── Commission Invitation ────────────────────────────────────────────── */

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
                        <p className="font-serif text-base sm:text-lg text-wood-600 italic leading-relaxed">Not everything here is painted. Some leave the wood as it is. Others come to life with light.</p>
                    </div>
                    <Link
                        to="/creations"
                        className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold whitespace-nowrap"
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

            {/* 3.5 Commission Invitation */}
            <section className="relative overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Image side */}
                    <div className="relative h-72 sm:h-96 md:h-auto md:min-h-[520px]">
                        <img
                            src="https://picsum.photos/900/1100?random=commission"
                            alt="Detail of a commissioned piece"
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                    {/* Text side */}
                    <div className="bg-paper-100 flex items-center px-8 md:px-16 py-16 md:py-24">
                        <div className="max-w-lg">
                            <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold block mb-6">
                                Commission
                            </span>
                            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-wood-900 leading-[1.15] mb-6 font-medium">
                                Every piece begins with a conversation
                            </h2>
                            <p className="font-serif text-lg text-wood-600 leading-[1.7] font-light mb-4">
                                The geometry is exact. The laser is precise. But we humans embrace the splatter, the imperfect symmetry, the crystal that feels perfect but sits just slightly off.
                            </p>
                            <p className="font-serif text-lg text-wood-600 leading-[1.7] font-light mb-10">
                                Whether you're drawn to a specific form or simply feel a resonance with the work, the process starts the same way. Tell me what you're feeling. We'll find the piece together.
                            </p>
                            <Link
                                to="/inquire"
                                className="inline-block font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold border-b-2 border-bronze-400 pb-1 hover:text-bronze-700 hover:border-bronze-600 transition-colors"
                            >
                                Begin an Inquiry
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3.6 From the Writings */}
            <section className="bg-wood-50 py-16 md:py-24 px-6 border-t border-wood-200">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="font-serif text-4xl text-wood-900 font-medium">From the Writings</h2>
                            <p className="font-serif text-base sm:text-lg text-wood-600 italic leading-relaxed mt-1">Between the endless ceremony, art is our prayer.</p>
                        </div>
                        <Link to="/writings" className="hidden md:flex font-label text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 font-semibold items-center gap-2">
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
                                    <ArtImage
                                        src={story.image}
                                        alt={story.title}
                                        variant="product"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="p-6 md:p-8">
                                    <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold block mb-3">
                                        {story.category}
                                    </span>
                                    <h3 className="font-serif text-2xl md:text-3xl text-wood-900 mb-4 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                        {story.title}
                                    </h3>
                                    <p className="font-serif text-base text-wood-600 leading-[1.7] font-light line-clamp-3">
                                        {story.excerpt}
                                    </p>
                                    <span className="inline-flex items-center gap-2 mt-5 font-label text-xs uppercase tracking-[0.2em] text-wood-500 group-hover:text-bronze-600 font-semibold transition-colors">
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
                                        <ArtImage
                                            src={story.image}
                                            alt={story.title}
                                            variant="product"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-4 sm:p-5 md:p-6 flex flex-col justify-center min-w-0">
                                        <h3 className="font-serif text-lg sm:text-xl text-wood-900 mb-1 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                            {story.title}
                                        </h3>
                                        <p className="font-serif text-sm italic text-bronze-600/80 mb-2 leading-snug">
                                            {story.subtitle}
                                        </p>
                                        <p className="font-serif text-sm text-wood-500 leading-relaxed font-light line-clamp-2">
                                            {story.excerpt}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 md:hidden text-center">
                        <Link to="/writings" className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 border-b border-wood-900 pb-1 font-semibold">
                            Explore All Writings
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
