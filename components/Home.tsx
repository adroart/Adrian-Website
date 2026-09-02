
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { STORIES } from '../data/generatedStories';
import { CREATION_CATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import ArtImage from './ArtImage';
import { img } from '../utils/cloudinary';

/**
 * The picture each offering shows on the home page.
 *
 * Three of the four differ from the category's own image, and each for a reason
 * that only applies here — where the four sit side by side and have to read as one
 * set. On /creations they are shown one per large tile, where the category images
 * work, so those are deliberately left alone.
 *
 *   MULTI    Path of the Ordinary, chosen by Adrian for being the tallest piece
 *            in the set — the anchor slot is a tall one, and a squarer picture
 *            left it looking cropped. Same image as /creations, so this entry
 *            only pins it against a later category change.
 *   ILLUM    The category points at a placeholder that is an unrelated face
 *            painting. This is a frame from the category's own video, three
 *            seconds in — the only picture of the work that exists.
 *   ORACLE   The category uses a full card mock-up: white mat, border, and the
 *            deck's typography. That is the right image for the oracle, and the
 *            wrong one next to three bare artworks. This is the same piece
 *            (card two, Beyond the Shell) as artwork alone.
 *   JEWELRY  Unchanged — the category image is already a plain studio shot.
 */
const HOME_IMAGE: Record<string, string> = {
    MULTI: 'adrian-website/creations/signature-pieces/path-of-the-ordinary',
    ORACLE: '2_kvndyq',
};

/** Illuminated Works has no still of its own, only a clip. */
const ILLUMINATED_STILL =
    'https://res.cloudinary.com/dobbosnda/video/upload/f_jpg,q_auto,so_3,w_700,h_612,c_fill,g_auto/v1774442528/technicianofthesacred_-_Bc27Krhn7j__kwimjc';

/**
 * Phone ordering for the offerings.
 *
 * The section's containers go `display: contents` below md, so every frame and
 * every name becomes a direct child of one grid and `order` can interleave them:
 * introduction, then piece, name, piece, name — so words never run for more than a
 * few lines before artwork interrupts them. Written out literally rather than
 * computed, because Tailwind only generates classes it can see in the source.
 */
const IMAGE_ORDER = ['order-2', 'order-4', 'order-6', 'order-8'];
const NAME_ORDER  = ['order-3', 'order-5', 'order-7', 'order-9'];

const ORDER = ['MULTI', 'ILLUM', 'JEWELRY', 'ORACLE'];

/**
 * The four things Adrian makes, in the order they are introduced.
 *
 * Names, one-line descriptions and links come from CREATION_CATEGORIES rather than
 * being restated, so editing a category reaches the front page too. The remaining
 * visible category (Objects) is left out: four reads as a considered set, and five
 * wraps to a second row at every breakpoint.
 */
const OFFERINGS = CREATION_CATEGORIES
    .filter(c => !c.hidden && ORDER.includes(c.id))
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
    .map(c => ({
        label: c.label,
        desc: c.desc,
        image: HOME_IMAGE[c.id] ?? c.image,
        link: c.link ?? '/creations',
        src: c.id === 'ILLUM' ? ILLUMINATED_STILL : undefined,
    }));

/* ─── Home Component ──────────────────────────────────────────────────────── */

const Home: React.FC = () => {
    return (
        <div className="bg-paper-50 min-h-screen animate-fade-in">

            {/* ── Who I am ────────────────────────────────────────────────
                Adrian on this section: "this is where they actually learn about me
                as an artist and what I value. This is my one opportunity for
                sharing who I am and what moves me."

                So not a word of it is cut, moved or hidden. What changed is that it
                is now composed rather than run together. It was two paragraphs of
                centred prose on the same ground as everything else, reading as one
                undifferentiated block — on a phone, a full screen of words between
                the hero and the first artwork.

                Now: the statement, then a photograph of Adrian, then what the
                statement means, then his name. The picture sits BETWEEN the two
                paragraphs — his own note about the layout elsewhere on this page,
                applied here — so the words are met halfway rather than stacked. The
                photograph is him on a ridge at dawn, which is the register the
                words are in: presence and place, not another artwork and not
                another workshop shot, both of which appear further down.

                Given more room than before, not less. A statement that is given
                space reads as intentional; a compressed one reads as an obstacle. */}
            <section className="py-14 md:py-24 px-6">
                <div className="max-w-3xl mx-auto">

                    <blockquote className="font-serif text-[26px] md:text-3xl lg:text-4xl text-wood-800 leading-[1.35] font-light border-none pl-0 text-center text-balance">
                        <span className="ml-[-0.5em]">"</span>Art is the experience of listening, bringing what is felt from the whispers into form. Creating the artifacts of the future in reverence of this moment."
                    </blockquote>

                    {/* Full bleed on a phone, inset on a desk — the negative margins
                        undo the section's own padding. */}
                    <div className="relative -mx-6 sm:mx-0 mt-10 md:mt-14 h-[220px] sm:h-[300px] md:h-[360px] overflow-hidden">
                        <ArtImage
                            publicId="path_x92l78"
                            alt="Adrian Rasmussen above a valley at first light"
                            variant="cover"
                            loading="lazy"
                        />
                    </div>

                    <p className="mt-10 md:mt-14 font-sans text-[17px] md:text-xl text-wood-700 leading-[1.75] font-light text-center text-pretty">
                        My creations bring people together. They have a way of speaking directly through the heart. There is no need to understand what you are looking at. Art is the reminder. Something to feel without reading a word.
                    </p>

                    {/* An artist statement should be signed. */}
                    <p className="mt-8 md:mt-10 font-label text-[11px] uppercase tracking-[0.26em] text-bronze-600 font-semibold text-center">
                        Adrian Rasmussen
                    </p>

                </div>
            </section>

            {/* ── The Work ─────────────────────────────────────────────────
                An introduction, not a product listing.

                This was a twelve-piece masonry grid with a price, a READY TO SHIP
                line and a SAVE button on every tile — a shop shelf on the front page
                of an artist's site, and ragged besides, because twelve photographs
                shot in twelve different settings never line up. It also answered the
                wrong question: a first-time visitor does not know what Adrian makes,
                and twelve variations on one form does not tell them.

                LAYOUT. One set of elements, arranged two ways, with no duplicated
                markup — the containers go `display: contents` on a phone so their
                children become direct children of this grid and can be interleaved
                by `order`.

                  Phone   image, name, image, name, … Each piece is full width and
                          large. Measured before this: 945px of unbroken text after
                          the hero — 1.1 screens — and then four 136px thumbnails.
                          A column of prose is the wrong shape for an art site.
                  md+     the arrangement Adrian chose: one piece anchoring the
                          section, three stating the range beside it, names listed
                          down the left.

                No prices, no buttons, and nothing laid over the artwork. */}
            <section className="py-16 md:py-24 px-6 border-t border-wood-100">
                <div className="max-w-[1500px] mx-auto grid grid-cols-1 gap-y-8 md:grid-cols-[92fr_108fr] md:gap-x-14 md:gap-y-12 lg:gap-x-20 xl:gap-x-24 items-start md:items-stretch">

                    {/* The heading, across the full width, with the way in beside it. */}
                    <div className="md:col-span-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
                        <div>
                            <span className="font-label text-[11px] uppercase tracking-[0.26em] text-bronze-600 font-semibold block mb-6 md:mb-7">The Work</span>
                            <h2 className="font-display font-light text-4xl md:text-5xl lg:text-[3.4rem] leading-[1.1] tracking-[-0.012em] text-wood-900 text-balance">
                                I create across many forms.
                            </h2>
                        </div>
                        <Link
                            to="/creations"
                            className="inline-flex items-center gap-2.5 pb-1.5 font-label text-[11px] uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold transition-colors"
                        >
                            Explore all creations <ArrowRight size={13} aria-hidden="true" />
                        </Link>
                    </div>

                    {/* The introduction */}
                    <div className="order-1 md:order-none md:col-start-1 md:row-start-2">
                        <p className="font-sans text-[15px] leading-[1.85] text-wood-700 max-w-[46ch] text-pretty">
                            Some you hang on the wall. Some you wear. Some you sit with. Some you walk into.
                            These are not decoration. They are portals.
                        </p>
                    </div>

                    {/* The work. `contents` on a phone so each frame becomes a direct
                        child of the section grid and can sit next to its own name. */}
                    <div className="contents md:grid md:grid-cols-[1.48fr_1fr] md:grid-rows-3 md:gap-3 md:col-start-2 md:row-start-2 md:row-span-2 md:h-full">
                        {OFFERINGS.map((o, i) => (
                            <Link
                                key={o.label}
                                to={o.link}
                                aria-label={o.label}
                                className={`relative block overflow-hidden border border-wood-200 hover:border-bronze-400 transition-colors aspect-[4/3] md:aspect-auto md:order-none ${IMAGE_ORDER[i]} ${i === 0 ? 'md:row-span-3' : ''}`}
                            >
                                {o.src
                                    ? <ArtImage src={o.src} alt={o.label} variant="cover" loading="lazy" />
                                    : <ArtImage publicId={o.image} alt={o.label} variant="cover" loading="lazy" />}
                            </Link>
                        ))}
                    </div>

                    {/* The four, named. Each sits under its own piece on a phone, and
                        gathers into a list down the left from md up. */}
                    <div className="contents md:block md:col-start-1 md:row-start-3 md:border-t md:border-wood-200">
                        {OFFERINGS.map((o, i) => (
                            <Link
                                key={o.label}
                                to={o.link}
                                className={`group flex items-baseline justify-between gap-6 pb-5 md:py-4 border-b border-wood-200 transition-colors md:order-none ${NAME_ORDER[i]}`}
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
