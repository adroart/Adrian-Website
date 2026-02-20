
import React, { useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Artwork } from '../types';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { ArrowRight, ArrowUpRight, Share2 } from 'lucide-react';

const PiecePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const art = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);

    // Related pieces: same series first, then same category, excluding current
    const relatedPieces = useMemo(() => {
        if (!art) return [];
        const related: Artwork[] = [];
        // Same series
        if (art.series) {
            related.push(...FULL_ARCHIVE.filter(a => a.id !== art.id && a.series === art.series));
        }
        // Same category (if not enough from series)
        if (related.length < 4) {
            const fromCategory = FULL_ARCHIVE.filter(
                a => a.id !== art.id && a.category === art.category && !related.find(r => r.id === a.id)
            );
            related.push(...fromCategory);
        }
        return related.slice(0, 4);
    }, [art]);

    const seriesData = useMemo(() => {
        if (!art?.series) return null;
        return SERIES_DATA.find(s => s.name === art.series) || null;
    }, [art]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    if (!art) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Piece Not Found</h1>
                    <p className="font-serif text-lg text-wood-600 mb-8">The piece you're looking for doesn't exist or has been moved.</p>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 pb-1"
                    >
                        <ArrowRight size={14} className="rotate-180" /> Back to Creations
                    </Link>
                </div>
            </section>
        );
    }

    const seriesSlug = art.series ? art.series.toLowerCase().replace(/\s+/g, '-') : null;

    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: art.title,
        description: art.description,
        image: art.coverImage,
        brand: { '@type': 'Brand', name: 'Adrian Rasmussen' },
        ...(art.material && { material: art.material }),
        ...(art.price && {
            offers: {
                '@type': 'Offer',
                price: art.price,
                priceCurrency: 'USD',
                availability: art.availability === 'SOLD'
                    ? 'https://schema.org/SoldOut'
                    : 'https://schema.org/InStock',
            },
        }),
    };

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">
                <Link to="/creations" className="hover:text-wood-900 transition-colors">
                    Creations
                </Link>
                <span className="text-wood-300">/</span>
                {art.series && seriesSlug && (
                    <>
                        <Link to={`/series/${seriesSlug}`} className="hover:text-wood-900 transition-colors">
                            {art.series}
                        </Link>
                        <span className="text-wood-300">/</span>
                    </>
                )}
                <span className="text-wood-900">{art.title}</span>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Images */}
                <div className="space-y-6">
                    <div className="w-full bg-wood-100 border border-wood-200">
                        <img src={art.coverImage} className="w-full h-auto object-cover" alt={art.title} loading="lazy" />
                    </div>
                    {art.images.length > 0 && (
                        <div className="grid grid-cols-3 gap-4">
                            {art.images.map((img, i) => (
                                <img key={i} src={img} className="w-full h-24 object-cover border border-wood-200" alt={`${art.title} detail ${i + 1}`} loading="lazy" />
                            ))}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="lg:pt-8">
                    <div className="mb-8">
                        {art.series && seriesSlug && (
                            <Link
                                to={`/series/${seriesSlug}`}
                                className="flex items-center gap-2 text-bronze-600 font-mono text-xs uppercase tracking-widest font-bold mb-4 hover:underline"
                            >
                                {art.series} Series <ArrowUpRight size={12} />
                            </Link>
                        )}
                        <h1 className="font-serif text-4xl md:text-5xl text-wood-900 leading-tight mb-6 font-medium">
                            {art.title}
                        </h1>
                        <div className="grid grid-cols-2 gap-y-2 font-serif text-lg text-wood-700">
                            {art.dimensions && <p>{art.dimensions}</p>}
                            {art.material && <p>{art.material}</p>}
                            <p>{art.year}</p>
                            {art.edition && <p className="text-bronze-600">{art.edition}</p>}
                        </div>
                    </div>

                    <div className="prose prose-stone font-serif text-wood-600 font-light mb-12 max-w-lg leading-relaxed">
                        <p>{art.description}</p>
                        {art.longDescription && <p className="mt-4">{art.longDescription}</p>}
                    </div>

                    <div className="border-t border-wood-200 pt-8 space-y-4">
                        {art.availability === 'READY_TO_SHIP' ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">Ready to Ship</span>
                                    <span className="font-serif text-2xl text-wood-900 font-medium">${art.price}</span>
                                </div>
                                <a
                                    href="https://buy.stripe.com/PLACEHOLDER"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3"
                                >
                                    Buy Now <ArrowRight size={16} />
                                </a>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    Ships from Bali &bull; Arrives in 2-3 weeks
                                </p>
                            </>
                        ) : art.availability === 'MADE_TO_ORDER' ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">Made to Order</span>
                                    <span className="font-serif text-2xl text-wood-900 font-medium">From ${art.price}</span>
                                </div>
                                <button
                                    className="w-full py-4 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors"
                                >
                                    Configure Design
                                </button>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    4-6 Weeks Production Time
                                </p>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="w-full py-4 border border-wood-200 text-wood-400 font-mono text-xs uppercase tracking-[0.2em] font-bold flex items-center justify-center">
                                    Sold
                                </div>
                                <Link
                                    to="/inquire"
                                    className="w-full py-4 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors flex items-center justify-center gap-3"
                                >
                                    Commission a new original on this form <ArrowRight size={14} />
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Share + Category */}
                    <div className="mt-8 pt-8 border-t border-wood-200 flex justify-between items-start">
                        <div>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">Category</span>
                            <p className="font-serif text-lg text-wood-700 mt-1">{art.category}</p>
                        </div>
                        {typeof navigator !== 'undefined' && 'share' in navigator && (
                            <button
                                onClick={() => navigator.share({ title: art.title, url: window.location.href })}
                                className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-wood-400 hover:text-wood-900 transition-colors font-bold p-2"
                                aria-label="Share this piece"
                            >
                                <Share2 size={14} /> Share
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Bar (Mobile) */}
            {art.availability !== 'SOLD' && (
                <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-paper-50 border-t border-wood-200 px-6 py-3 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    <span className="font-serif text-xl text-wood-900 font-medium">
                        {art.availability === 'MADE_TO_ORDER' ? `From $${art.price}` : `$${art.price}`}
                    </span>
                    {art.availability === 'READY_TO_SHIP' ? (
                        <a
                            href="https://buy.stripe.com/PLACEHOLDER"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-3 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center gap-2"
                        >
                            Buy Now <ArrowRight size={14} />
                        </a>
                    ) : (
                        <button className="px-8 py-3 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors">
                            Configure
                        </button>
                    )}
                </div>
            )}

            {/* Related Pieces */}
            {relatedPieces.length > 0 && (
                <div className="max-w-7xl mx-auto px-6 md:px-12 mt-32">
                    <div className="border-t border-wood-200 pt-12 mb-12">
                        <h2 className="font-serif text-3xl text-wood-900 font-medium">
                            {art.series ? `More from ${art.series}` : 'Related Works'}
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {relatedPieces.map((related) => (
                            <Link
                                key={related.id}
                                to={`/creations/${related.id}`}
                                className="group"
                            >
                                <div className="relative overflow-hidden bg-wood-50 border border-wood-200">
                                    <img
                                        src={related.coverImage}
                                        alt={related.title}
                                        loading="lazy"
                                        className="w-full aspect-square object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                                    />
                                    {related.availability === 'READY_TO_SHIP' && (
                                        <div className="absolute top-3 right-3 bg-paper-50/90 backdrop-blur px-2 py-1 text-[9px] font-mono uppercase tracking-widest border border-wood-200 font-bold">
                                            Ready to Ship
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <h4 className="font-serif text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-tight">
                                        {related.title}
                                    </h4>
                                    <p className="font-mono text-[10px] text-wood-500 uppercase tracking-widest mt-1 font-bold">
                                        {related.category} {related.availability === 'SOLD' && '• Sold'}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

export default PiecePage;
