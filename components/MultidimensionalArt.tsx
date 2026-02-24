
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
            className="group cursor-pointer dark-preserve"
        >
            {/* Gallery mat frame */}
            <div className="bg-paper-100 border border-wood-200 p-3 sm:p-4">
                <div className="overflow-hidden">
                    <img
                        src={`https://picsum.photos/800/600?random=${200 + idx}`}
                        className="w-full aspect-[4/3] object-cover sm:grayscale sm:group-hover:grayscale-0 transition-all duration-[1.5s] ease-out group-hover:scale-105"
                        alt={label}
                    />
                </div>
            </div>

            {/* Museum plaque */}
            <div className="text-center pt-4 pb-2 px-2">
                <h3 className="font-serif text-xl md:text-2xl text-wood-900 font-medium tracking-wide">{label}</h3>
                <p className="font-serif text-sm text-wood-500 font-light mt-1 leading-relaxed
                              sm:opacity-0 sm:max-h-0 sm:group-hover:opacity-100 sm:group-hover:max-h-20
                              transition-all duration-500 ease-out">
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
            <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">
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
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-6 lg:gap-8">
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
                    className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                >
                    View all multidimensional art
                    <ArrowRight size={14} />
                </Link>
            </div>
        </section>
    );
};

export default MultidimensionalArt;
