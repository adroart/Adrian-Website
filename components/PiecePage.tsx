
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Artwork, AvailabilityStatus } from '../types';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { ArrowRight, ArrowUpRight, Share2, BookOpen, Loader2 } from 'lucide-react';

async function checkoutPiece(art: Artwork): Promise<void> {
    if (art.stripePriceId && art.stripePriceId.startsWith('price_')) {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ stripePriceId: art.stripePriceId, quantity: 1 }] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Checkout failed');
        window.location.href = data.url;
    }
    // If no price ID, button won't be rendered (piece needs wiring in Stripe dashboard first)
}

// Progressive scarcity edition display per tech spec
function getEditionDisplay(art: Artwork): string | null {
    if (art.editionSize) {
        const sold = art.editionSold || 0;
        const percentSold = (sold / art.editionSize) * 100;

        if (percentSold >= 100) return 'Edition closed';

        // Ready-to-ship: show specific piece number
        if (art.availability === 'READY_TO_SHIP' && art.editionNumber) {
            return `Edition of ${art.editionSize} · #${art.editionNumber} · Signed and numbered`;
        }

        // Progressive scarcity rules
        if (percentSold >= 90) return `Edition of ${art.editionSize} · Final one available`;
        if (percentSold >= 70) return `Edition of ${art.editionSize} · Few remaining`;
        if (percentSold >= 40) {
            const remaining = art.editionSize - sold;
            return `Edition of ${art.editionSize} · ${remaining} remaining`;
        }
        return `Limited edition of ${art.editionSize}`;
    }
    return art.edition || null;
}

// Check if edition is fully closed
function isEditionClosed(art: Artwork): boolean {
    if (!art.editionSize || !art.editionSold) return false;
    return art.editionSold >= art.editionSize;
}

const PiecePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const touchStartX = useRef(0);
    const [buyLoading, setBuyLoading] = useState(false);
    const [buyError, setBuyError] = useState<string | null>(null);

    const handleBuy = async (artPiece: typeof art) => {
        if (!artPiece) return;
        setBuyLoading(true);
        setBuyError(null);
        try {
            await checkoutPiece(artPiece);
        } catch (err) {
            setBuyError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setBuyLoading(false);
        }
    };

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

    // All images: cover first, then additional (de-duped)
    const allImages = useMemo(() => {
        if (!art) return [];
        const extras = art.images.filter(img => img !== art.coverImage);
        return [art.coverImage, ...extras];
    }, [art]);

    useEffect(() => {
        window.scrollTo(0, 0);
        setActiveImageIndex(0);
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
    const isMultidimensional = art.category === 'Multidimensional Art';
    // For Multidimensional Art pieces, link into the new subcategory routes
    const seriesLink = isMultidimensional && seriesSlug
        ? `/creations/multidimensional-art/${seriesSlug}`
        : null;
    const signaturePiecesLink = isMultidimensional && art.isSignaturePiece
        ? '/creations/multidimensional-art/signature-pieces'
        : null;
    const editionText = getEditionDisplay(art);
    const editionClosed = isEditionClosed(art);

    // Availability text color per spec
    const availabilityColor = art.availability === 'READY_TO_SHIP'
        ? 'text-avail-ready font-medium'
        : art.availability === 'MADE_TO_ORDER'
        ? 'text-avail-order'
        : 'text-avail-sold';

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

    // BreadcrumbList schema
    const breadcrumbItems = [
        { '@type': 'ListItem', position: 1, name: 'Creations', item: 'https://adrianrasmussen.com/creations' },
    ];
    if (art.series && seriesSlug) {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 2, name: art.series, item: `https://adrianrasmussen.com/series/${seriesSlug}`,
        });
        breadcrumbItems.push({
            '@type': 'ListItem', position: 3, name: art.title, item: `https://adrianrasmussen.com/creations/${art.id}`,
        });
    } else {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 2, name: art.title, item: `https://adrianrasmussen.com/creations/${art.id}`,
        });
    }
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
    };

    // Middle dot separator for inline details
    const detailParts = [art.dimensions, art.material, art.year].filter(Boolean);
    const detailString = detailParts.join(' · ');

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">
                <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                <span className="text-wood-300">/</span>

                {/* Multidimensional Art hierarchy */}
                {isMultidimensional && (
                    <>
                        <Link to="/creations/multidimensional-art" className="hover:text-wood-900 transition-colors">
                            Multidimensional Art
                        </Link>
                        <span className="text-wood-300">/</span>
                        {seriesLink && (
                            <>
                                <Link to={seriesLink} className="hover:text-wood-900 transition-colors">
                                    {art.series}
                                </Link>
                                <span className="text-wood-300">/</span>
                            </>
                        )}
                        {signaturePiecesLink && (
                            <>
                                <Link to={signaturePiecesLink} className="hover:text-wood-900 transition-colors">
                                    Signature Pieces
                                </Link>
                                <span className="text-wood-300">/</span>
                            </>
                        )}
                    </>
                )}

                <span className="text-wood-900">{art.title}</span>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Images */}
                <div className="space-y-4">
                    {/* Main image — swipeable on mobile */}
                    <div
                        className="w-full bg-wood-100 border border-wood-200 overflow-hidden"
                        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                        onTouchEnd={(e) => {
                            const diff = touchStartX.current - e.changedTouches[0].clientX;
                            if (Math.abs(diff) > 40) {
                                if (diff > 0 && activeImageIndex < allImages.length - 1) {
                                    setActiveImageIndex(i => i + 1);
                                } else if (diff < 0 && activeImageIndex > 0) {
                                    setActiveImageIndex(i => i - 1);
                                }
                            }
                        }}
                    >
                        <img
                            src={allImages[activeImageIndex]}
                            className="w-full h-auto object-cover transition-opacity duration-300"
                            alt={art.title}
                        />
                    </div>

                    {/* Mobile dot indicators */}
                    {allImages.length > 1 && (
                        <div className="flex justify-center gap-2 lg:hidden">
                            {allImages.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveImageIndex(i)}
                                    aria-label={`View image ${i + 1}`}
                                    className={`rounded-full transition-all duration-300 ${
                                        i === activeImageIndex
                                            ? 'w-4 h-2 bg-bronze-500'
                                            : 'w-2 h-2 bg-wood-300 hover:bg-wood-500'
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Desktop thumbnails */}
                    {allImages.length > 1 && (
                        <div className="hidden lg:grid grid-cols-4 gap-3">
                            {allImages.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveImageIndex(i)}
                                    aria-label={`View image ${i + 1}`}
                                    className={`relative overflow-hidden border transition-all duration-200 ${
                                        i === activeImageIndex
                                            ? 'border-bronze-500 ring-1 ring-bronze-500'
                                            : 'border-wood-200 opacity-60 hover:opacity-100 hover:border-wood-400'
                                    }`}
                                >
                                    <img
                                        src={img}
                                        className="w-full h-20 object-cover"
                                        alt={`${art.title} view ${i + 1}`}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="lg:pt-8">
                    <div className="mb-8">
                        {art.series && (seriesLink || seriesSlug) && (
                            <Link
                                to={seriesLink ?? `/creations/multidimensional-art/${seriesSlug}`}
                                className="flex items-center gap-2 text-bronze-600 font-mono text-xs uppercase tracking-widest font-bold mb-4 hover:underline"
                            >
                                {art.series} Series <ArrowUpRight size={12} />
                            </Link>
                        )}
                        <h1 className="font-serif text-4xl md:text-5xl text-wood-900 leading-tight mb-6 font-medium">
                            {art.title}
                        </h1>
                        <div className="font-serif text-lg text-wood-700 space-y-2">
                            <p>{detailString}</p>
                            {editionText && <p className="text-bronze-600">{editionText}</p>}
                        </div>
                    </div>

                    <div className="prose prose-stone font-serif text-wood-600 font-light mb-8 max-w-lg leading-relaxed">
                        <p>{art.description}</p>
                        {art.longDescription && <p className="mt-4">{art.longDescription}</p>}
                    </div>

                    {/* Story link — only shown when a companion essay exists */}
                    {art.relatedStorySlug && (
                        <Link
                            to={`/writings`}
                            state={{ openStory: art.relatedStorySlug }}
                            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold mb-10"
                        >
                            <BookOpen size={14} />
                            Read the story behind this piece
                        </Link>
                    )}

                    <div className="border-t border-wood-200 pt-8 space-y-4">
                        {editionClosed ? (
                            <div className="space-y-4">
                                <div className="w-full py-4 border border-wood-200 text-avail-sold font-mono text-xs uppercase tracking-[0.2em] flex items-center justify-center">
                                    Edition closed
                                </div>
                                <Link
                                    to="/inquire"
                                    className="w-full py-4 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors flex items-center justify-center gap-3"
                                >
                                    Commission a new original on this form <ArrowRight size={14} />
                                </Link>
                            </div>
                        ) : art.availability === 'READY_TO_SHIP' ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`font-mono text-xs uppercase tracking-widest ${availabilityColor}`}>Ready to ship</span>
                                    <span className="font-serif text-2xl text-wood-900 font-medium">${art.price}</span>
                                </div>
                                {buyError && (
                                    <p className="font-mono text-[10px] text-red-600 uppercase tracking-widest font-bold mb-3">{buyError}</p>
                                )}
                                <button
                                    onClick={() => handleBuy(art)}
                                    disabled={buyLoading || !art.stripePriceId}
                                    className="w-full py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {buyLoading ? <><Loader2 size={16} className="animate-spin" /> Redirecting...</> : <>Buy Now <ArrowRight size={16} /></>}
                                </button>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    Ships from Bali · Arrives in 2 to 3 weeks
                                </p>
                            </>
                        ) : art.availability === 'MADE_TO_ORDER' ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`font-mono text-xs uppercase tracking-widest ${availabilityColor}`}>Made to order</span>
                                    <span className="font-serif text-2xl text-wood-900 font-medium">From ${art.price}</span>
                                </div>
                                <button
                                    className="w-full py-4 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors"
                                >
                                    Configure Design
                                </button>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    4 to 6 weeks production time
                                </p>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className={`w-full py-4 border border-wood-200 ${availabilityColor} font-mono text-xs uppercase tracking-[0.2em] flex items-center justify-center`}>
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
            {art.availability !== 'SOLD' && !editionClosed && (
                <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-paper-50 border-t border-wood-200 px-6 py-3 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    <span className="font-serif text-xl text-wood-900 font-medium">
                        {art.availability === 'MADE_TO_ORDER' ? `From $${art.price}` : `$${art.price}`}
                    </span>
                    {art.availability === 'READY_TO_SHIP' ? (
                        <button
                            onClick={() => handleBuy(art)}
                            disabled={buyLoading || !art.stripePriceId}
                            className="px-8 py-3 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {buyLoading ? <Loader2 size={14} className="animate-spin" /> : <>Buy Now <ArrowRight size={14} /></>}
                        </button>
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
                                <div className="relative overflow-hidden bg-wood-50 border border-wood-200 transition-shadow duration-500 group-hover:shadow-lg">
                                    <img
                                        src={related.coverImage}
                                        alt={`${related.title} by Adrian Rasmussen`}
                                        loading="lazy"
                                        className="w-full aspect-square object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                                    />
                                </div>
                                <div className="mt-4">
                                    <h4 className="font-serif text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-tight">
                                        {related.title}
                                    </h4>
                                    <p className="font-mono text-[10px] uppercase tracking-widest mt-1">
                                        <span className="text-wood-500 font-bold">{related.category}</span>
                                        {related.availability === 'SOLD' && <span className="text-avail-sold font-bold"> · Sold</span>}
                                        {related.availability === 'READY_TO_SHIP' && <span className="text-avail-ready font-bold"> · Ready to ship</span>}
                                        {related.availability === 'MADE_TO_ORDER' && <span className="text-avail-order font-bold"> · Made to order</span>}
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
