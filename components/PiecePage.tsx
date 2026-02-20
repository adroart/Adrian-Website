
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Artwork, AvailabilityStatus, Product } from '../types';
import { FULL_ARCHIVE, SERIES_DATA, MADE_TO_ORDER_ADD_ONS } from '../data/mockData';
import { ArrowRight, ArrowUpRight, Share2, BookOpen, ShoppingBag, Check } from 'lucide-react';
import { useCart } from '../CartContext';

// --- Helpers ---

// Safely serialize data for embedding in <script type="application/ld+json"> tags.
// JSON.stringify does NOT escape </script>, so a malicious value could break out of
// the script element. This escapes <, >, and & to their unicode equivalents.
function safeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

// Determine illumination tier from a size string like '24"', '36"', '16"'
function getIlluminationTier(sizeStr: string): 'none' | 'medium' | 'large' | 'major' {
    const match = sizeStr.match(/(\d+)/);
    if (!match) return 'medium';
    const inches = parseInt(match[1], 10);
    if (inches < 12) return 'none';
    if (inches <= 24) return 'medium';  // 12–24"
    if (inches <= 36) return 'large';   // 24–36"
    return 'major';                     // 36"+
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

// Inline SVG checkmark for custom checkbox
const Checkmark: React.FC = () => (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
        <path d="M1 4.5L4 7.5L10 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PiecePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();

    // Image gallery state
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const touchStartX = useRef(0);

    // Ready-to-ship cart state
    const [rtsAdded, setRtsAdded] = useState(false);

    // Made-to-order configuration state
    const [selectedSize, setSelectedSize] = useState('');
    const [addCrystals, setAddCrystals] = useState(false);
    const [addWoodFrame, setAddWoodFrame] = useState(false);
    const [addIllumination, setAddIllumination] = useState(false);
    const [addCustomFrame, setAddCustomFrame] = useState(false);

    const art = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);

    // Reset state when navigating to a different piece
    useEffect(() => {
        window.scrollTo(0, 0);
        setActiveImageIndex(0);
        setRtsAdded(false);
        setAddCrystals(false);
        setAddWoodFrame(false);
        setAddIllumination(false);
        setAddCustomFrame(false);
    }, [id]);

    // Set default selected size when piece loads or changes
    useEffect(() => {
        if (art?.madeToOrderSizes && art.madeToOrderSizes.length > 0) {
            setSelectedSize(art.madeToOrderSizes[0].size);
        } else {
            setSelectedSize('');
        }
    }, [art]);

    // Illumination tier derived from selected size
    const illuminationTier = useMemo(() => {
        if (!selectedSize) return 'none' as const;
        return getIlluminationTier(selectedSize);
    }, [selectedSize]);

    // Hide (and uncheck) illumination if selected size doesn't support it
    useEffect(() => {
        if (illuminationTier === 'none') {
            setAddIllumination(false);
        }
    }, [illuminationTier]);

    // Illumination add-on price for the currently selected size tier
    const illuminationPrice = useMemo(() => {
        if (illuminationTier === 'none') return 0;
        return MADE_TO_ORDER_ADD_ONS.illumination[illuminationTier].price;
    }, [illuminationTier]);

    // Selected size data object
    const selectedSizeData = useMemo(() => {
        if (!art?.madeToOrderSizes || !selectedSize) return null;
        return art.madeToOrderSizes.find(s => s.size === selectedSize) || null;
    }, [art, selectedSize]);

    // Live total for MTO configuration
    const mtoTotal = useMemo(() => {
        let total = selectedSizeData?.price ?? 0;
        if (addCrystals) total += MADE_TO_ORDER_ADD_ONS.crystals.price;
        if (addWoodFrame) total += MADE_TO_ORDER_ADD_ONS.woodFrame.price;
        if (addIllumination && illuminationTier !== 'none') total += illuminationPrice;
        if (addCustomFrame) total += MADE_TO_ORDER_ADD_ONS.customFrame.price;
        return total;
    }, [selectedSizeData, addCrystals, addWoodFrame, addIllumination, addCustomFrame, illuminationPrice, illuminationTier]);

    // Related pieces: same series first, then same category, excluding current
    const relatedPieces = useMemo(() => {
        if (!art) return [];
        const related: Artwork[] = [];
        if (art.series) {
            related.push(...FULL_ARCHIVE.filter(a => a.id !== art.id && a.series === art.series));
        }
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

    if (!art) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Piece Not Found</h1>
                    <p className="font-serif text-lg text-wood-600 mb-8">The piece you are looking for does not exist or has been moved.</p>
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

    // Whether this MTO piece has the full size-selector template
    const hasMTOSizes = Boolean(art.madeToOrderSizes && art.madeToOrderSizes.length > 0);

    // --- Cart handlers ---

    const handleAddToCartRTS = () => {
        const product: Product = {
            id: art.id,
            title: art.title,
            price: art.price ?? 0,
            category: art.category,
            image: art.coverImage,
            available: true,
            isReadyToShip: true,
            material: art.material,
            edition: art.edition,
            dimensions: art.dimensions,
            stripePriceId: art.stripePriceId,
            stripeUrl: art.stripeUrl,
        };
        addToCart(product);
        setRtsAdded(true);
        setTimeout(() => setRtsAdded(false), 2000);
    };

    const handleAddToCartMTO = () => {
        if (!selectedSizeData) return;

        // Build human-readable title
        const sizeDisplay = selectedSize.replace('"', ' inch');
        const addOnNames = [
            addCrystals && 'with crystals',
            addWoodFrame && 'with wood frame',
            addIllumination && 'illuminated',
            addCustomFrame && 'with custom frame',
        ].filter(Boolean) as string[];
        const displayTitle = addOnNames.length > 0
            ? `${art.title}, ${sizeDisplay}, ${addOnNames.join(', ')}`
            : `${art.title}, ${sizeDisplay}`;

        // Build add-on Stripe Price IDs for separate line items at checkout
        const addOnPriceIds: string[] = [];
        if (addCrystals) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.crystals.stripePriceId);
        if (addWoodFrame) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.woodFrame.stripePriceId);
        if (addIllumination && illuminationTier !== 'none') {
            addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.illumination[illuminationTier].stripePriceId);
        }
        if (addCustomFrame) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.customFrame.stripePriceId);

        // Unique cart ID per configuration so different configurations are separate items
        const configKey = [
            selectedSize,
            addCrystals ? 'xls' : '',
            addWoodFrame ? 'xwf' : '',
            addIllumination ? 'xil' : '',
            addCustomFrame ? 'xcf' : '',
        ].join('-');
        const cartId = `${art.id}-${configKey.replace(/[^a-zA-Z0-9-]/g, '')}`;

        const cartProduct: Product = {
            id: cartId,
            title: displayTitle,
            price: mtoTotal,
            category: art.category,
            image: art.coverImage,
            available: true,
            isReadyToShip: false,
            material: art.material,
            edition: art.edition,
            dimensions: art.dimensions,
            stripePriceId: selectedSizeData.stripePriceId,
            addOnPriceIds: addOnPriceIds.length > 0 ? addOnPriceIds : undefined,
        };
        addToCart(cartProduct);
        // CartContext opens the drawer automatically
    };

    // --- Schema markup ---

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

    const detailParts = [art.dimensions, art.material, art.year].filter(Boolean);
    const detailString = detailParts.join(' · ');

    return (
        <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(productSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
            />

            {/* Breadcrumb */}
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">
                <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                <span className="text-wood-300">/</span>

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
                            {editionText && !hasMTOSizes && <p className="text-bronze-600">{editionText}</p>}
                        </div>
                    </div>

                    <div className="prose prose-stone font-serif text-wood-600 font-light mb-8 max-w-lg leading-relaxed">
                        <p>{art.description}</p>
                        {art.longDescription && <p className="mt-4">{art.longDescription}</p>}
                    </div>

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

                    {/* Purchase section */}
                    <div className="border-t border-wood-200 pt-8 space-y-4">

                        {/* --- Edition closed --- */}
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

                        /* --- Ready to ship: Add to Cart --- */
                        ) : art.availability === 'READY_TO_SHIP' ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`font-mono text-xs uppercase tracking-widest ${availabilityColor}`}>Ready to ship</span>
                                    <span className="font-serif text-2xl text-wood-900 font-medium">${art.price?.toLocaleString('en-US')}</span>
                                </div>
                                <button
                                    onClick={handleAddToCartRTS}
                                    className={`w-full py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold transition-colors flex items-center justify-center gap-3 ${
                                        rtsAdded
                                            ? 'bg-bronze-600 text-paper-50'
                                            : 'bg-wood-900 text-paper-50 hover:bg-bronze-600'
                                    }`}
                                >
                                    {rtsAdded
                                        ? <><Check size={16} /> Added to Cart</>
                                        : <><ShoppingBag size={16} /> Add to Cart</>
                                    }
                                </button>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    Ships from Bali · Arrives in 2 to 3 weeks
                                </p>
                            </>

                        /* --- Made to order WITH size options: full MTO template --- */
                        ) : art.availability === 'MADE_TO_ORDER' && hasMTOSizes ? (
                            <div className="space-y-0">

                                {/* Size selector */}
                                <div className="mb-8">
                                    <p className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold mb-4">
                                        Select your size
                                    </p>
                                    <div className="space-y-2">
                                        {art.madeToOrderSizes!.map(sizeOption => (
                                            <label
                                                key={sizeOption.size}
                                                className={`flex items-center justify-between px-4 py-3 border cursor-pointer transition-all duration-150 ${
                                                    selectedSize === sizeOption.size
                                                        ? 'border-wood-900 bg-wood-50'
                                                        : 'border-wood-200 hover:border-wood-400'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                                        selectedSize === sizeOption.size ? 'border-wood-900' : 'border-wood-300'
                                                    }`}>
                                                        {selectedSize === sizeOption.size && (
                                                            <div className="w-2 h-2 rounded-full bg-wood-900" />
                                                        )}
                                                    </div>
                                                    <span className="font-serif text-lg text-wood-900">{sizeOption.size}</span>
                                                </div>
                                                <span className="font-mono text-sm text-wood-700 font-bold">
                                                    ${sizeOption.price.toLocaleString('en-US')}
                                                </span>
                                                <input
                                                    type="radio"
                                                    name={`size-${art.id}`}
                                                    value={sizeOption.size}
                                                    checked={selectedSize === sizeOption.size}
                                                    onChange={() => setSelectedSize(sizeOption.size)}
                                                    className="sr-only"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Add-on checkboxes */}
                                <div className="mb-6">
                                    <p className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold mb-4">
                                        Add to your piece
                                    </p>
                                    <div className="space-y-5">

                                        {/* Crystals */}
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                addCrystals ? 'border-wood-900 bg-wood-900' : 'border-wood-300 group-hover:border-wood-600'
                                            }`}>
                                                {addCrystals && <Checkmark />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <span className="font-serif text-lg text-wood-900">Add crystals</span>
                                                    <span className="font-mono text-sm text-wood-600 font-bold shrink-0">
                                                        +${MADE_TO_ORDER_ADD_ONS.crystals.price.toLocaleString('en-US')}
                                                    </span>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={addCrystals}
                                                onChange={e => setAddCrystals(e.target.checked)}
                                                className="sr-only"
                                            />
                                        </label>

                                        {/* Wood frame */}
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                addWoodFrame ? 'border-wood-900 bg-wood-900' : 'border-wood-300 group-hover:border-wood-600'
                                            }`}>
                                                {addWoodFrame && <Checkmark />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <span className="font-serif text-lg text-wood-900">Add wood frame</span>
                                                    <span className="font-mono text-sm text-wood-600 font-bold shrink-0">
                                                        +${MADE_TO_ORDER_ADD_ONS.woodFrame.price.toLocaleString('en-US')}
                                                    </span>
                                                </div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={addWoodFrame}
                                                onChange={e => setAddWoodFrame(e.target.checked)}
                                                className="sr-only"
                                            />
                                        </label>

                                        {/* Illumination — only shown when selected size supports it */}
                                        {illuminationTier !== 'none' && (
                                            <label className="flex items-start gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                    addIllumination ? 'border-wood-900 bg-wood-900' : 'border-wood-300 group-hover:border-wood-600'
                                                }`}>
                                                    {addIllumination && <Checkmark />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-baseline justify-between gap-4">
                                                        <span className="font-serif text-lg text-wood-900">Illuminate this piece</span>
                                                        <span className="font-mono text-sm text-wood-600 font-bold shrink-0">
                                                            +${illuminationPrice.toLocaleString('en-US')}
                                                        </span>
                                                    </div>
                                                    <p className="font-serif text-sm text-wood-500 mt-1 leading-relaxed">
                                                        LED installation included. We will finalize the light design together after your order.
                                                    </p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={addIllumination}
                                                    onChange={e => setAddIllumination(e.target.checked)}
                                                    className="sr-only"
                                                />
                                            </label>
                                        )}

                                        {/* Custom laser cut frame */}
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                addCustomFrame ? 'border-wood-900 bg-wood-900' : 'border-wood-300 group-hover:border-wood-600'
                                            }`}>
                                                {addCustomFrame && <Checkmark />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline justify-between gap-4">
                                                    <span className="font-serif text-lg text-wood-900">Custom laser cut frame</span>
                                                    <span className="font-mono text-sm text-wood-600 font-bold shrink-0">
                                                        +${MADE_TO_ORDER_ADD_ONS.customFrame.price.toLocaleString('en-US')}
                                                    </span>
                                                </div>
                                                <p className="font-serif text-sm text-wood-500 mt-1 leading-relaxed">
                                                    We will design this together after your order.
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={addCustomFrame}
                                                onChange={e => setAddCustomFrame(e.target.checked)}
                                                className="sr-only"
                                            />
                                        </label>
                                    </div>

                                    {/* See what's possible link */}
                                    <Link
                                        to="/creations"
                                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bronze-600 hover:text-bronze-500 font-bold mt-6 transition-colors"
                                    >
                                        See what's possible <ArrowRight size={12} />
                                    </Link>
                                </div>

                                {/* Live total */}
                                <div className="border-t border-wood-200 pt-6 pb-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">Total</span>
                                        <span className="font-serif text-2xl text-wood-900 font-medium">
                                            ${mtoTotal.toLocaleString('en-US')}
                                        </span>
                                    </div>
                                    <div className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">
                                        <span className="text-avail-order">Made to order</span>
                                        {' · '}4 to 6 weeks
                                    </div>
                                    {editionText && (
                                        <p className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 font-bold mt-1">
                                            {editionText}
                                        </p>
                                    )}
                                </div>

                                {/* Add to Cart */}
                                <button
                                    onClick={handleAddToCartMTO}
                                    disabled={!selectedSize}
                                    className="w-full py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <ShoppingBag size={16} /> Add to Cart
                                </button>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    Ships from Bali
                                </p>
                            </div>

                        /* --- Made to order WITHOUT size options: legacy Commission link --- */
                        ) : art.availability === 'MADE_TO_ORDER' ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`font-mono text-xs uppercase tracking-widest ${availabilityColor}`}>Made to order</span>
                                    <span className="font-serif text-2xl text-wood-900 font-medium">From ${art.price?.toLocaleString('en-US')}</span>
                                </div>
                                <Link
                                    to="/inquire"
                                    className="w-full py-4 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors flex items-center justify-center gap-3"
                                >
                                    Commission Piece <ArrowRight size={14} />
                                </Link>
                                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-wood-400 mt-4 font-bold">
                                    4 to 6 weeks production time
                                </p>
                            </>

                        /* --- Sold --- */
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
                        {art.availability === 'READY_TO_SHIP'
                            ? `$${art.price?.toLocaleString('en-US')}`
                            : hasMTOSizes
                            ? `$${mtoTotal.toLocaleString('en-US')}`
                            : `From $${art.price?.toLocaleString('en-US')}`
                        }
                    </span>

                    {art.availability === 'READY_TO_SHIP' ? (
                        <button
                            onClick={handleAddToCartRTS}
                            className={`min-h-[44px] px-8 py-3 font-mono text-xs uppercase tracking-[0.2em] font-bold transition-colors flex items-center gap-2 ${
                                rtsAdded
                                    ? 'bg-bronze-600 text-paper-50'
                                    : 'bg-wood-900 text-paper-50 hover:bg-bronze-600'
                            }`}
                        >
                            {rtsAdded ? <><Check size={14} /> Added</> : <><ShoppingBag size={14} /> Add to Cart</>}
                        </button>
                    ) : hasMTOSizes ? (
                        <button
                            onClick={handleAddToCartMTO}
                            disabled={!selectedSize}
                            className="min-h-[44px] px-8 py-3 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <ShoppingBag size={14} /> Add to Cart
                        </button>
                    ) : (
                        <Link
                            to="/inquire"
                            className="min-h-[44px] px-8 py-3 border border-wood-900 text-wood-900 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-wood-900 hover:text-paper-50 transition-colors flex items-center"
                        >
                            Commission
                        </Link>
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
