
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import GalleryTileCard from './GalleryTileCard';
import { img } from '../utils/cloudinary';

// --- Main component ---

const IlluminatedWorks: React.FC = () => {
    const illuminatedPieces = useMemo(
        () => FULL_ARCHIVE.filter(a => a.illuminated).slice(0, 5),
        []
    );

    return (
        <article className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">

            {/* Hero — full-width image placeholder */}
            <div className="relative w-full h-[60vh] min-h-[400px] max-h-[700px] overflow-hidden mb-0 dark-preserve">
                {/* TODO: Replace with a real video or hero image of a piece transitioning from daylight to dark */}
                <img
                    src="https://picsum.photos/1800/900?random=illum-hero"
                    alt="An illuminated piece transitioning from daylight to dark"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/10 to-transparent" />
                {/* Breadcrumb */}
                <div className="absolute top-6 left-6 md:left-12 flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-paper-300 font-semibold">
                    <Link to="/creations" className="hover:text-paper-50 transition-colors">Creations</Link>
                    <span className="text-paper-300/50">/</span>
                    <span className="text-paper-50">Illuminated Works</span>
                </div>
            </div>

            {/* Section 1: What illumination is */}
            <div className="max-w-4xl mx-auto px-6 py-24">
                <p className="font-serif text-2xl md:text-3xl text-wood-800 font-light leading-[1.4] mb-8">
                    There is a version of every piece that you only discover after dark.
                </p>
                <div className="space-y-6 font-serif text-lg text-wood-600 font-light leading-[1.7] max-w-2xl">
                    <p>
                        Light does something to layered wood that no other medium quite achieves. It travels through the depths. It finds the edges. It makes visible what was always there, waiting for the right conditions to reveal itself.
                    </p>
                    <p>
                        This is not decoration. It is a second life within the same form.
                    </p>
                </div>
                {/* TODO: Add 2-3 sentences in your own voice about what illuminated work means to you,
                    or what you have witnessed it do in a space. This is where the page gets human. */}
            </div>

            {/* Section 2: Two expressions of light */}
            <div className="max-w-[1800px] mx-auto px-6 pb-24">
                <div className="border-t border-wood-200 pt-16 mb-12">
                    <h2 className="font-serif text-3xl text-wood-900 font-medium mb-2">Two expressions of light</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 dark-preserve">
                    {/* Basic Illumination */}
                    <div className="bg-wood-900 p-10 md:p-16">
                        <span className="font-label text-[11px] uppercase tracking-[0.2em] text-paper-300 font-semibold block mb-6">Basic Illumination</span>
                        <h3 className="font-serif text-3xl text-paper-50 font-medium mb-6">Light, included.</h3>
                        <p className="font-serif text-lg text-paper-300 font-light leading-[1.7] mb-6">
                            Standard LED strips with preset modes. The piece glows. It shifts between colors. It does what LEDs do out of the box.
                        </p>
                        <p className="font-serif text-base text-paper-400 font-light leading-[1.7] italic">
                            Included with any illuminated piece. Functional, beautiful, ready to go.
                        </p>
                    </div>
                    {/* Curated Light */}
                    <div className="bg-stone-900 p-10 md:p-16">
                        <span className="font-label text-[11px] uppercase tracking-[0.2em] text-paper-300 font-semibold block mb-6">Curated Light</span>
                        <h3 className="font-serif text-3xl text-paper-50 font-medium mb-6">Programmed by hand. Felt in the room.</h3>
                        <p className="font-serif text-lg text-paper-300 font-light leading-[1.7] mb-6">
                            I personally program every transition, every color palette, every mood. Smooth fades. Ambient rhythms. Light that breathes with the piece instead of competing with it.
                        </p>
                        <p className="font-serif text-base text-paper-400 font-light leading-[1.7] italic">
                            An upgrade for those who want the light to feel as intentional as the art itself.
                        </p>
                    </div>
                </div>
            </div>

            {/* Section 3: What living with it is like */}
            <div className="max-w-4xl mx-auto px-6 pb-24">
                <div className="border-t border-wood-200 pt-16">
                    <p className="font-serif text-xl text-wood-600 font-light leading-loose italic max-w-2xl">
                        Pause for a moment. Imagine your space after dark, with one illuminated piece on the wall. Consider what changes in the room — not just visually, but in atmosphere. This is the question worth sitting with before choosing.
                    </p>
                </div>
            </div>

            {/* Section 4: Gallery entry point */}
            {illuminatedPieces.length > 0 && (
                <div className="max-w-[1800px] mx-auto px-6 pb-24">
                    <div className="border-t border-wood-200 pt-16 mb-12">
                        <h2 className="font-serif text-3xl text-wood-900 font-medium">From the collection</h2>
                    </div>
                    <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-4 lg:gap-5 mb-12">
                        {illuminatedPieces.map(art => (
                            <GalleryTileCard key={art.id} art={art} />
                        ))}
                    </div>
                    <div className="text-center">
                        <Link
                            to="/creations/multidimensional-art"
                            className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                        >
                            Browse all multidimensional works <ArrowRight size={14} />
                        </Link>
                        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold mt-3">
                            Filter by Illuminated to see the full collection
                        </p>
                    </div>
                </div>
            )}

            {/* Section 5: Commission pathway */}
            <div className="bg-wood-100 border-t border-wood-200">
                <div className="max-w-4xl mx-auto px-6 py-24 text-center">
                    <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-8">
                        Begin with a conversation
                    </h2>
                    <div className="space-y-4 font-serif text-lg text-wood-600 font-light leading-[1.7] max-w-xl mx-auto mb-12">
                        <p>
                            Illumination can be added to most multidimensional pieces. Whether you have a piece in mind or are beginning from conversation, this is where we start.
                        </p>
                        <p>
                            Whether through an in-person viewing or a virtual conversation, I am here to guide you toward the right piece for your space.
                        </p>
                    </div>
                    <Link
                        to="/inquire"
                        className="inline-flex items-center gap-3 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold px-8 py-4 hover:bg-bronze-600 transition-colors"
                    >
                        Begin the conversation <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </article>
    );
};

export default IlluminatedWorks;
