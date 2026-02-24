
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MULTIDIMENSIONAL_CATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';

// --- Sub-components ---

const SubcategoryTile: React.FC<{
    label: string;
    desc: string;
    slug?: string;
    link?: string;
    idx: number;
}> = ({ label, desc, slug, link, idx }) => {
    const navigate = useNavigate();
    const to = link ?? `/creations/multidimensional-art/${slug}`;

    return (
        <div
            onClick={() => navigate(to)}
            className="group relative aspect-[4/3] bg-wood-100 border border-wood-200 overflow-hidden cursor-pointer dark-preserve"
        >
            <img
                src={`https://picsum.photos/800/600?random=${200 + idx}`}
                className="w-full h-full object-cover sm:grayscale sm:group-hover:grayscale-0 transition-all duration-[1.5s] ease-out group-hover:scale-105"
                alt={label}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/5 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 p-6">
                <h3 className="font-serif text-2xl md:text-3xl text-paper-50 font-medium">{label}</h3>
                <p className="hidden sm:block font-serif text-sm text-paper-200 font-light mt-1
                              sm:opacity-0 sm:translate-y-2
                              sm:group-hover:opacity-100 sm:group-hover:translate-y-0
                              transition-all duration-500 delay-100">
                    {desc}
                </p>
            </div>
        </div>
    );
};

// --- Main component ---

const MultidimensionalArt: React.FC = () => {
    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">

            {/* Breadcrumb */}
            <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">
                <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                <span className="text-wood-300">/</span>
                <span className="text-wood-900">Multidimensional Art</span>
            </div>

            {/* Hero header */}
            <div className="max-w-[1800px] mx-auto px-6 mb-16 border-b border-wood-200 pb-12">
                <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">Multidimensional Art</h1>
                <p className="font-serif text-xl text-wood-600 max-w-2xl font-light leading-[1.7]">
                    Layered sculpture in wood, crystal, and light. Works that hold geometry, symbol, and presence in the same form.
                </p>
            </div>

            {/* Subcategory tiles — 2-col mobile, 3-col (6-grid) desktop with centered bottom row */}
            <div className="max-w-[1800px] mx-auto px-6 mb-16">
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-1">
                    {MULTIDIMENSIONAL_CATEGORIES.map((cat, idx) => (
                        <div key={cat.id} className={`lg:col-span-2${idx === 3 ? ' lg:col-start-2' : ''}`}>
                            <SubcategoryTile
                                label={cat.label}
                                desc={cat.desc}
                                slug={(cat as { slug?: string }).slug}
                                link={(cat as { link?: string }).link}
                                idx={idx}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* View all — navigates to Creations page filtered to Multidimensional Art */}
            <div className="max-w-[1800px] mx-auto px-6 mb-8 text-center">
                <Link
                    to="/creations?category=Multidimensional+Art"
                    className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                >
                    View all multidimensional art
                    <ArrowRight size={14} />
                </Link>
            </div>
        </section>
    );
};

export default MultidimensionalArt;
