
import React from 'react';
import { Link } from 'react-router-dom';
import { MULTIDIMENSIONAL_CATEGORIES } from '../data/mockData';
import { ArrowRight } from 'lucide-react';
import ArtImage from './ArtImage';

// --- Sub-components ---

const SubcategoryTile: React.FC<{
    label: string;
    desc: string;
    slug?: string;
    link?: string;
    idx: number;
}> = ({ label, desc, slug, link, idx }) => {
    const to = link ?? `/creations/multidimensional-art/${slug}`;

    return (
        <Link
            to={to}
            className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 dark-preserve"
            aria-label={`Explore ${label}: ${desc}`}
        >
            {/* Image */}
            <div className="overflow-hidden">
                <ArtImage
                    publicId={`adrian-website/placeholders/artwork-square-${(idx % 8) + 1}`}
                    variant="tile"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    width={800}
                    height={800}
                />
            </div>

            {/* Title — snug under the photo */}
            <div className="text-center pt-2.5 sm:pt-3 pb-2 px-2">
                <h3 className="font-serif text-xl md:text-2xl text-wood-900 font-medium tracking-wide">
                    {label}
                </h3>
                <p className="font-serif text-sm text-wood-500 font-light mt-1 leading-relaxed
                              sm:opacity-70 sm:group-hover:opacity-100
                              transition-opacity duration-500 ease-out">
                    {desc}
                </p>
            </div>
        </Link>
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                    {MULTIDIMENSIONAL_CATEGORIES.map((cat, idx) => (
                        <div key={cat.id}>
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
