
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { ArrowRight } from 'lucide-react';

const SelectedWorkCard: React.FC<{ art: any }> = ({ art }) => (
    <div className="group cursor-pointer break-inside-avoid mb-8">
        <div className="relative overflow-hidden bg-wood-100 border border-wood-200">
            <img
                src={art.coverImage}
                alt={art.title}
                className="w-full h-auto object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                loading="lazy"
            />
            {art.availability === 'READY_TO_SHIP' && (
                <div className="absolute top-4 right-4 bg-paper-50/90 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-wood-900 shadow-sm border border-wood-200">
                    Ready to Ship
                </div>
            )}
            <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/5 transition-colors duration-500"></div>
        </div>
        <div className="mt-4">
            <h3 className="font-serif text-xl text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-tight">
                {art.title}
            </h3>
            <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-wood-500 font-bold">{art.category}</span>
                {art.price && (
                    <>
                        <span className="text-wood-300 text-[10px]">•</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-900 font-bold">
                            {art.availability === 'SOLD' ? 'Sold' : `From $${art.price}`}
                        </span>
                    </>
                )}
            </div>
        </div>
    </div>
);

const PathwayBlock: React.FC<{
    title: string;
    subtitle: string;
    to: string;
}> = ({ title, subtitle, to }) => (
    <Link
        to={to}
        className="group w-full text-left py-12 border-t border-wood-200 hover:bg-white transition-colors relative overflow-hidden block"
    >
        <div className="flex justify-between items-end relative z-10 px-4">
            <div>
                <h3 className="font-serif text-4xl md:text-5xl text-wood-900 mb-2 group-hover:translate-x-2 transition-transform duration-500 font-medium">
                    {title}
                </h3>
                <p className="font-serif text-xl text-wood-500 group-hover:translate-x-2 transition-transform duration-500 delay-75 italic font-light">
                    {subtitle}
                </p>
            </div>
            <div className="w-12 h-12 rounded-full border border-wood-200 flex items-center justify-center text-wood-400 group-hover:border-bronze-500 group-hover:text-bronze-600 transition-all group-hover:scale-110">
                <ArrowRight size={20} />
            </div>
        </div>
    </Link>
);

const Home: React.FC = () => {

    const selectedWorks = useMemo(() => FULL_ARCHIVE.filter(a => a.featured).slice(0, 8), []);

    return (
        <div className="bg-paper-50 min-h-screen">

            {/* 3.2 Introduction */}
            <section className="py-24 md:py-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <p className="font-serif text-2xl md:text-3xl lg:text-4xl text-wood-800 leading-relaxed font-light">
                        "Art is the experience of listening, bringing what is felt from the whispers into form. Creating the artifacts of the future in reverence of this moment."
                    </p>
                    <div className="mt-12 space-y-6 text-left md:text-center">
                        <p className="font-serif text-lg md:text-xl text-wood-600 leading-relaxed font-light">
                            My pieces bring people together. They find a way of speaking directly through the heart. If someone does not already understand what they are looking at, the art is reminding them. Something they can feel without reading a word.
                        </p>
                    </div>
                    <div className="mt-12 flex flex-col items-center gap-4">
                        <div className="w-px h-16 bg-wood-300"></div>
                        <span className="font-mono text-xs uppercase tracking-[0.3em] text-wood-500 font-bold">Welcome</span>
                    </div>
                </div>
            </section>

            {/* 3.3 Selected Works */}
            <section className="py-20 px-6 max-w-[1800px] mx-auto">
                <div className="flex justify-between items-end mb-16 border-b border-wood-200 pb-6">
                    <div>
                        <h2 className="font-serif text-4xl text-wood-900 mb-2 font-medium">Selected Works</h2>
                        <p className="font-serif text-lg text-wood-500 italic">Pieces I return to.</p>
                    </div>
                    <Link
                        to="/creations"
                        className="hidden md:flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold"
                    >
                        See All Creations <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-8 space-y-8">
                    {selectedWorks.map((art) => (
                        <Link key={art.id} to={`/creations/${art.id}`}>
                            <SelectedWorkCard art={art} />
                        </Link>
                    ))}
                </div>

                <div className="mt-12 md:hidden text-center">
                    <Link
                        to="/creations"
                        className="font-mono text-xs uppercase tracking-widest text-wood-900 border-b border-wood-900 pb-1 font-bold"
                    >
                        See All Creations
                    </Link>
                </div>
            </section>

            {/* 3.4 The Differentiator */}
            <section className="py-32 px-6 bg-wood-900 text-paper-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[50%] h-full bg-[url('https://picsum.photos/1200/1200?random=99')] opacity-10 bg-cover mix-blend-overlay"></div>
                <div className="max-w-4xl mx-auto relative z-10">
                    <h2 className="font-serif text-3xl md:text-5xl leading-tight mb-8 font-medium">
                        The geometry is exact. The laser is precise. <br/>
                        <span className="text-bronze-300">But we humans embrace the splatter, the imperfect symmetry, the crystal that feels perfect but sits just slightly off.</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-lg font-serif font-light text-paper-200 leading-relaxed">
                        <p>
                            Not everything here is painted. Some pieces honor the wood as it is. Others come to life with light. Most are original paintings on multidimensional forms.
                        </p>
                        <p>
                            Between the endless ceremony, art is our prayer. Every piece touched by the Technician of the Sacred, yet it is not any one of us but a way. A family, different origins, one mother, earth.
                        </p>
                    </div>
                </div>
            </section>

            {/* 3.5 Pathways */}
            <section className="max-w-4xl mx-auto px-6 py-32">
                <PathwayBlock
                    title="Creations"
                    subtitle="See what exists"
                    to="/creations"
                />
                <PathwayBlock
                    title="Writings"
                    subtitle="Go deeper"
                    to="/writings"
                />
                <PathwayBlock
                    title="Inquire"
                    subtitle="Begin a conversation"
                    to="/inquire"
                />
            </section>

            {/* 3.6 From the Writings */}
            <section className="bg-wood-50 py-24 px-6 border-t border-wood-200">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <h2 className="font-serif text-4xl text-wood-900 font-medium">From the Writings</h2>
                        <Link to="/writings" className="hidden md:flex font-mono text-xs uppercase tracking-widest text-wood-500 hover:text-wood-900 font-bold items-center gap-2">
                            Explore All <ArrowRight size={14}/>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <Link
                            to="/writings"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 block mb-3 font-bold">Living Knowledge</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                Deep explorations of subjects earned through experience
                            </h3>
                        </Link>
                        <Link
                            to="/writings"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 block mb-3 font-bold">Beneath the Surface</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                Meaning and origins within the work
                            </h3>
                        </Link>
                        <Link
                            to="/writings"
                            className="group cursor-pointer bg-white p-8 border border-wood-100 hover:border-bronze-300 transition-all hover:shadow-sm"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 block mb-3 font-bold">The Practice</span>
                            <h3 className="font-serif text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium">
                                How I create
                            </h3>
                        </Link>
                    </div>

                    <div className="mt-8 md:hidden text-center">
                        <Link to="/writings" className="font-mono text-xs uppercase tracking-widest text-wood-900 border-b border-wood-900 pb-1 font-bold">
                            Explore All Writings
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
