
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { STORIES } from '../data/generatedStories';
import { CREATION_CATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import ArtImage from './ArtImage';
import { img } from '../utils/cloudinary';

/** A frame from the Illuminated Works clip, three seconds in. */
const ILLUMINATED_STILL =
    'https://res.cloudinary.com/dobbosnda/video/upload/f_jpg,q_auto,so_3,w_700,h_612,c_fill,g_auto/v1774442528/technicianofthesacred_-_Bc27Krhn7j__kwimjc';

/**
 * The four things Adrian makes, in the order they are introduced on the home page.
 *
 * Drawn from CREATION_CATEGORIES rather than restated, so a change to a category's
 * name or one-line description reaches the front page too. The remaining visible
 * category (Objects) is deliberately left out: four reads as a considered set and
 * five wraps to a second row at every breakpoint.
 */
const OFFERINGS = CREATION_CATEGORIES
    .filter(c => !c.hidden && ['MULTI', 'ILLUM', 'JEWELRY', 'ORACLE'].includes(c.id))
    .sort((a, b) => ['MULTI', 'ILLUM', 'JEWELRY', 'ORACLE'].indexOf(a.id) - ['MULTI', 'ILLUM', 'JEWELRY', 'ORACLE'].indexOf(b.id))
    .map(c => ({
        label: c.label,
        desc: c.desc,
        image: c.image,
        link: c.link ?? '/creations',
        // Illuminated Works carries a video and only a placeholder still, so the
        // category's own image is an unrelated face painting. A frame pulled from
        // that video shows what the category actually is.
        src: c.id === 'ILLUM' ? ILLUMINATED_STILL : undefined,
    }));


/**
 * The anchor image is set here rather than taken from the category, on purpose.
 *
 * The Multidimensional Art category is represented on /creations by Path of the
 * Ordinary, photographed against a garden wall — which reads well at full tile
 * size there, and badly at anchor size here beside three studio shots. This is a
 * carved piece filling its frame with no background, so the four cohere.
 */
const LEAD_IMAGE = 'adrian-website/creations/signature-pieces/communion-gold-blue-red';

/* ─── Home Component ──────────────────────────────────────────────────────── */

const Home: React.FC = () => {
    return (
        <div className="bg-paper-50 min-h-screen animate-fade-in">

            {/* 3.2 Introduction */}
            <section className="py-16 md:py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl text-wood-800 leading-snug font-light border-none pl-0">
                        <span className="ml-[-0.5em]">"</span>Art is the experience of listening, bringing what is felt from the whispers into form. Creating the artifacts of the future in reverence of this moment."
                    </blockquote>
                    <div className="mt-12 space-y-6 text-center">
                        <p className="font-sans text-lg md:text-xl text-wood-600 leading-[1.7] font-light">
                            My creations bring people together. They have a way of speaking directly through the heart. There is no need to understand what you are looking at. Art is the reminder. Something to feel without reading a word.
                        </p>
                    </div>
                </div>
            </section>

            {/* Explore Creations link */}
            <section className="py-12 sm:py-16 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-3 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold transition-colors py-3 px-2 -my-3 -mx-2"
                    >
                        Explore Creations <ArrowRight size={14} />
                    </Link>
                </div>
            </section>

            {/* ── The Work ─────────────────────────────────────────────────
                An introduction, not a product listing.

                This was a twelve-piece masonry grid with a price, a READY TO
                SHIP line and a SAVE button on every tile — a shop shelf on the
                front page of an artist's site, and ragged besides, because
                twelve photographs shot in twelve different settings never line
                up. It also answered the wrong question: a first-time visitor
                does not know what Adrian makes, and twelve variations on one
                form does not tell them.

                It now shows the four things he actually makes, named, with the
                sentence that introduces them. One piece anchors the section and
                three state the range beside it — hierarchy is what the flat grid
                was missing. No prices, no buttons, and nothing laid over the
                artwork. */}
            <section className="py-16 md:py-24 px-6 border-t border-wood-100">
                <div className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-[92fr_108fr] gap-12 lg:gap-20 xl:gap-24 items-start">

                    {/* The words */}
                    <div>
                        <span className="font-label text-[11px] uppercase tracking-[0.26em] text-bronze-600 font-semibold block mb-6 md:mb-7">The Work</span>
                        <h2 className="font-display font-light text-4xl md:text-5xl leading-[1.12] tracking-[-0.012em] text-wood-900 text-balance mb-5">
                            I create across many forms.
                        </h2>
                        <p className="font-sans text-[15px] leading-[1.85] text-wood-700 max-w-[42ch] text-pretty mb-10 md:mb-12">
                            Some you hang on the wall. Some you wear. Some you sit with. Some you walk into.
                            These are not decoration. They are portals.
                        </p>

                        <nav aria-label="What Adrian makes" className="border-t border-wood-200">
                            {OFFERINGS.map(o => (
                                <Link
                                    key={o.label}
                                    to={o.link}
                                    className="group flex items-baseline justify-between gap-6 py-4 border-b border-wood-200 transition-colors"
                                >
                                    <span>
                                        <span className="block font-display text-xl md:text-[22px] leading-[1.25] text-wood-900 group-hover:text-bronze-600 transition-colors">
                                            {o.label}
                                        </span>
                                        <span className="block mt-1 font-sans text-[12.5px] leading-[1.5] text-wood-700">
                                            {o.desc}
                                        </span>
                                    </span>
                                    <ArrowRight
                                        size={14}
                                        aria-hidden="true"
                                        className="shrink-0 translate-y-1 text-wood-700 group-hover:text-bronze-600 transition-colors"
                                    />
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* The work. The lead spans all three rows, so its bottom edge
                        always meets the last small frame's — the alignment is
                        structural rather than a pair of guessed heights. */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.48fr_1fr] lg:grid-rows-3">
                        <Link
                            to={OFFERINGS[0].link}
                            aria-label={OFFERINGS[0].label}
                            className="relative block overflow-hidden aspect-[8/7] border border-wood-200 hover:border-bronze-400 transition-colors lg:row-span-3 lg:aspect-auto"
                        >
                            <ArtImage publicId={LEAD_IMAGE} alt={OFFERINGS[0].label} variant="cover" loading="lazy" />
                        </Link>
                        {OFFERINGS.slice(1).map(o => (
                            <Link
                                key={o.label}
                                to={o.link}
                                aria-label={o.label}
                                className="relative block overflow-hidden aspect-[8/7] border border-wood-200 hover:border-bronze-400 transition-colors"
                            >
                                {o.src
                                    ? <ArtImage src={o.src} alt={o.label} variant="cover" loading="lazy" />
                                    : <ArtImage publicId={o.image} alt={o.label} variant="cover" loading="lazy" />}
                            </Link>
                        ))}
                    </div>

                </div>
            </section>

            {/* 3.5 Commission Invitation */}
            <section className="relative overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Image side */}
                    <div className="relative h-72 sm:h-96 md:h-auto md:min-h-[520px]">
                        <img
                            src={img('comission_qhcdmn', { w: 900, h: 1100 })}
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
                            <p className="font-sans text-lg text-wood-600 leading-[1.7] font-light mb-4">
                                The geometry is exact. The laser is precise. But we humans embrace the splatter, the imperfect symmetry, the crystal that feels perfect but sits just slightly off.
                            </p>
                            <p className="font-sans text-lg text-wood-600 leading-[1.7] font-light mb-10">
                                Whether you're drawn to a specific form or simply feel a resonance with the work, the process starts the same way. Tell me what you're feeling. We'll find the piece together.
                            </p>
                            <Link
                                to="/inquire"
                                className="inline-block font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold border-b-2 border-bronze-400 pb-1 hover:text-bronze-700 hover:border-bronze-600 transition-colors"
                            >
                                Begin a conversation
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
                            <p className="font-sans text-base sm:text-lg text-wood-600 leading-relaxed mt-1">Between the endless ceremony, art is our prayer.</p>
                        </div>
                        <Link to="/writings" className="hidden md:flex font-label text-xs uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 font-semibold items-center gap-2">
                            Explore All <ArrowRight size={14}/>
                        </Link>
                    </div>

                    {/* Hero + supporting layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        {/* Featured story - large card */}
                        {STORIES.filter(s => s.isFeatured).slice(0, 1).map(story => (
                            <Link
                                key={story.id}
                                to={`/writings/${story.slug}`}
                                className="group bg-white border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-md overflow-hidden"
                            >
                                <div className="aspect-[16/10] overflow-hidden">
                                    <ArtImage
                                        publicId={story.image}
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
                                    <p className="font-sans text-base text-wood-600 leading-[1.7] font-light line-clamp-3">
                                        {story.excerpt}
                                    </p>
                                    <span className="inline-flex items-center gap-2 mt-5 font-label text-xs uppercase tracking-[0.2em] text-wood-600 group-hover:text-bronze-600 font-semibold transition-colors">
                                        Read <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                                    </span>
                                </div>
                            </Link>
                        ))}

                        {/* Supporting stories - stacked column */}
                        <div className="flex flex-col gap-6 lg:gap-8">
                            {STORIES.filter(s => !s.isFeatured).slice(0, 3).map(story => (
                                <Link
                                    key={story.id}
                                    to={`/writings/${story.slug}`}
                                    className="group bg-white border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-md flex overflow-hidden"
                                >
                                    <div className="w-28 sm:w-36 md:w-44 flex-shrink-0 overflow-hidden">
                                        <ArtImage
                                            publicId={story.image}
                                            alt={story.title}
                                            variant="product"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-4 sm:p-5 md:p-6 flex flex-col justify-center min-w-0">
                                        <h3 className="font-sans text-lg sm:text-xl text-wood-900 mb-1 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                            {story.title}
                                        </h3>
                                        <p className="font-sans text-base text-bronze-600 mb-2 leading-snug">
                                            {story.subtitle}
                                        </p>
                                        <p className="font-sans text-base text-wood-600 leading-relaxed font-light line-clamp-2">
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
