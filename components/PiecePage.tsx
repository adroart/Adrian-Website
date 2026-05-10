
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Artwork, AvailabilityStatus, SizeVariant, Product } from '../types';
import { FULL_ARCHIVE, SERIES_DATA, MADE_TO_ORDER_ADD_ONS } from '../data/mockData';
import { ArrowRight, ArrowUpRight, Share2, BookOpen, ShoppingBag, Check } from 'lucide-react';
import { useCart } from '../CartContext';
import { LAUNCH_FLAGS } from '../launchFlags';
import { img as cldImg } from '../utils/cloudinary';
import { formatPrice } from '../utils/formatPrice';
import VisualLightbox from './VisualLightbox';
import Breadcrumb, { type Crumb } from './Breadcrumb';
import GalleryTileCard from './GalleryTileCard';
import { useMetaTags } from '../hooks/useMetaTags';
import { ulCardNumber, ulAltText, ulMetaDescription, ulMetaTitle } from '../utils/universalLanguage';

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

// Determine illumination tier from a size string like '29 cm', '58 cm', '24"'
// Supports both cm and inch formats. Thresholds: none < 30cm/12", medium 30-60cm/12-24", large 60-90cm/24-36", major 90cm+/36"+
function getIlluminationTier(sizeStr: string): 'none' | 'medium' | 'large' | 'major' {
    const match = sizeStr.match(/(\d+)/);
    if (!match) return 'medium';
    const value = parseInt(match[1], 10);
    const isCm = /cm/i.test(sizeStr);
    const cm = isCm ? value : value * 2.54;
    if (cm < 30) return 'none';
    if (cm <= 60) return 'medium';   // 30-60 cm (12-24")
    if (cm <= 90) return 'large';    // 60-90 cm (24-36")
    return 'major';                  // 90 cm+ (36"+)
}

// Size tier for add-ons (crystals, wood frame) that scale with piece size
function getAddOnSizeTier(sizeStr: string): 'small' | 'medium' | 'large' {
    const match = sizeStr.match(/(\d+)/);
    if (!match) return 'small';
    const value = parseInt(match[1], 10);
    const isCm = /cm/i.test(sizeStr);
    const cm = isCm ? value : value * 2.54;
    if (cm <= 35) return 'small';    // ~29 cm
    if (cm <= 65) return 'medium';   // ~58 cm
    return 'large';                  // ~90 cm+
}

// Progressive scarcity edition display per tech spec
function getEditionDisplay(art: Artwork, selectedVariant?: SizeVariant | null): string | null {
    if (art.editionSize) {
        const sold = art.editionSold || 0;
        const percentSold = (sold / art.editionSize) * 100;

        if (percentSold >= 100) return 'Edition closed';

        // Show specific piece number when a variant with editionNumber is selected
        if (selectedVariant?.editionNumber) {
            return `Edition of ${art.editionSize} · #${selectedVariant.editionNumber} · Signed and numbered`;
        }
        // Legacy: RTS without variants still shows piece number
        if (art.availability === 'READY_TO_SHIP' && art.editionNumber && !art.sizeVariants) {
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
        <path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Recently viewed - localStorage ring buffer, max 8 IDs
function useRecentlyViewed(currentId: string): string[] {
    const KEY = 'recently_viewed_pieces';

    useEffect(() => {
        try {
            const raw = localStorage.getItem(KEY);
            const prev: string[] = raw ? JSON.parse(raw) : [];
            const updated = [currentId, ...prev.filter(id => id !== currentId)].slice(0, 8);
            localStorage.setItem(KEY, JSON.stringify(updated));
        } catch { /* ignore */ }
    }, [currentId]);

    return useMemo(() => {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return [];
            const all: string[] = JSON.parse(raw);
            return all.filter(id => id !== currentId).slice(0, 4);
        } catch { return []; }
    }, [currentId]);
}

// More from this series - compact tile grid
const MoreFromSeries: React.FC<{ art: Artwork; seriesLink: string | null }> = ({ art, seriesLink }) => {
    if (!art.series) return null;
    const seriesPieces = FULL_ARCHIVE.filter(a => a.id !== art.id && a.series === art.series).slice(0, 3);
    if (seriesPieces.length === 0) return null;
    return (
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-20 md:mt-32">
            <div className="border-t border-wood-200 pt-12 mb-10">
                <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">
                    More from this series
                </span>
            </div>
            <div className="columns-2 md:columns-3 gap-4 md:gap-6 card-stagger">
                {seriesPieces.map(piece => (
                    <GalleryTileCard
                        key={piece.id}
                        art={piece}
                        showDetails
                        subtitleOverride={piece.series ?? piece.category}
                    />
                ))}
            </div>
            {seriesLink && (
                <div className="mt-10 text-center">
                    <Link
                        to={seriesLink}
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold border-b border-bronze-300 pb-1 transition-colors"
                    >
                        View all {art.series} <ArrowRight size={12} />
                    </Link>
                </div>
            )}
        </div>
    );
};

const PiecePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { addToCart } = useCart();

    // If the reader arrived from an oracle card (BuySheet → here), show a
    // one-tap return link that takes them straight back to where they were
    // reading, system param and all.
    const navState = location.state as { oracleOrigin?: string; preferredSize?: string; openConfigurator?: boolean } | null;
    const oracleOrigin = navState?.oracleOrigin ?? null;
    const openConfigurator = navState?.openConfigurator === true;

    // Image gallery state
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const touchStartX = useRef(0);

    // Ready-to-ship cart state
    const [rtsAdded, setRtsAdded] = useState(false);

    // Share / copy state
    const [copied, setCopied] = useState(false);

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Series description collapsible
    const [seriesDescExpanded, setSeriesDescExpanded] = useState(false);

    // Made-to-order configuration state
    const [selectedSize, setSelectedSize] = useState('');
    const [addCrystals, setAddCrystals] = useState(false);
    const [addWoodFrame, setAddWoodFrame] = useState(false);
    const [addIllumination, setAddIllumination] = useState(false);

    // Two-step configurator: 1 = pick size, 2 = pick options + buy.
    // Step 1 is skipped when there's only one size to choose; step 2 is
    // always shown (it carries the buy CTA + total).
    const [configStep, setConfigStep] = useState<1 | 2>(1);

    // Sticky bottom bar visibility: hide when purchase section is in view
    const purchaseRef = useRef<HTMLDivElement>(null);
    const [purchaseVisible, setPurchaseVisible] = useState(false);

    const art = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);

    // Recently viewed tracking
    const recentIds = useRecentlyViewed(id ?? '');
    const recentPieces = useMemo(
        () => recentIds.map(rid => FULL_ARCHIVE.find(a => a.id === rid)).filter((a): a is Artwork => Boolean(a)),
        [recentIds],
    );

    // Dynamic meta tags for sharing
    const ogImage = art ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${art.coverImage}` : undefined;
    const isUL = art?.series === 'Universal Language';
    useMetaTags({
        title: art ? (isUL ? ulMetaTitle(art) : art.title) : undefined,
        description: art ? (isUL ? ulMetaDescription(art) : `${art.title} by Adrian Rasmussen · ${art.category}${art.dimensions ? ` · ${art.dimensions}` : ''}`) : undefined,
        image: ogImage,
    });

    // Reset state when navigating to a different piece
    useEffect(() => {
        window.scrollTo(0, 0);
        setActiveImageIndex(0);
        setRtsAdded(false);
        setAddCrystals(false);
        setAddWoodFrame(false);
        setAddIllumination(false);
        setLightboxOpen(false);
        setSeriesDescExpanded(false);
        setConfigStep(1);
    }, [id]);

    // Resolve variants: prefer sizeVariants, fall back to legacy madeToOrderSizes
    const variants = useMemo(() => art?.sizeVariants ?? art?.madeToOrderSizes ?? [], [art]);

    // Set default selected size when piece loads or changes. If the reader
    // arrived from an oracle BuySheet with a specific size in mind, honor
    // that selection instead of defaulting to first-in-stock.
    const preferredSize = navState?.preferredSize ?? null;

    useEffect(() => {
        if (variants.length === 0) {
            setSelectedSize('');
            return;
        }
        const matchPreferred = preferredSize ? variants.find(v => v.size === preferredSize) : null;
        if (matchPreferred) {
            setSelectedSize(matchPreferred.size);
            return;
        }
        // Default to the first in-stock variant if one exists, otherwise first
        const inStockVariant = variants.find(v => ('availability' in v) && v.availability === 'IN_STOCK');
        setSelectedSize(inStockVariant?.size ?? variants[0].size);
    }, [variants, preferredSize]);

    // Configurator step skip logic. If there's only one size to pick from,
    // there's no decision to make in step 1, so jump straight to step 2. If
    // the reader arrived from an oracle BuySheet with a preferred size, the
    // size choice is also already made — skip to step 2.
    useEffect(() => {
        if (variants.length <= 1 || preferredSize) {
            setConfigStep(2);
        } else {
            setConfigStep(1);
        }
    }, [variants.length, preferredSize, id]);

    // If the reader arrived from a BuySheet (preferredSize OR
    // openConfigurator), scroll to the configurator on mount so they land
    // on the purchase controls, not on the breadcrumb. The id-reset effect
    // above scrolls to (0, 0) first; we wait a frame for layout, then
    // scroll into the configurator. Retry a couple of frames if the ref
    // isn't attached yet (it lives behind a few conditional branches).
    useEffect(() => {
        if (!preferredSize && !openConfigurator) return;
        let attempts = 0;
        let raf = 0;
        const attempt = () => {
            const el = purchaseRef.current;
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            attempts += 1;
            if (attempts < 20) raf = requestAnimationFrame(attempt);
        };
        raf = requestAnimationFrame(attempt);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, preferredSize, openConfigurator]);

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

    // Hide sticky bottom bar when purchase section is visible in viewport
    useEffect(() => {
        const el = purchaseRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setPurchaseVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Illumination add-on price for the currently selected size tier
    const illuminationPrice = useMemo(() => {
        if (illuminationTier === 'none') return 0;
        return MADE_TO_ORDER_ADD_ONS.illumination[illuminationTier].price;
    }, [illuminationTier]);

    // Add-on size tier for crystals / wood frame (small, medium, large)
    const addOnTier = useMemo(() => {
        if (!selectedSize) return 'small' as const;
        return getAddOnSizeTier(selectedSize);
    }, [selectedSize]);

    const crystalsPrice = MADE_TO_ORDER_ADD_ONS.crystals[addOnTier].price;
    const woodFramePrice = MADE_TO_ORDER_ADD_ONS.woodFrame[addOnTier].price;

    // Selected size data object
    const selectedSizeData = useMemo((): SizeVariant | null => {
        if (variants.length === 0 || !selectedSize) return null;
        return variants.find(s => s.size === selectedSize) || null;
    }, [variants, selectedSize]);

    // Live total for MTO configuration
    const mtoTotal = useMemo(() => {
        let total = selectedSizeData?.price ?? 0;
        if (addCrystals) total += crystalsPrice;
        if (addWoodFrame) total += woodFramePrice;
        if (addIllumination && illuminationTier !== 'none') total += illuminationPrice;
        return total;
    }, [selectedSizeData, addCrystals, addWoodFrame, addIllumination, crystalsPrice, woodFramePrice, illuminationPrice, illuminationTier]);

    // Which add-ons does THIS piece offer? When availableAddOns is undefined,
    // default to all three (preserves existing behavior). Illumination
    // additionally requires the size tier to support it.
    const availableAddOns = art?.availableAddOns ?? ['crystals', 'woodFrame', 'illumination'];
    const showCrystals = availableAddOns.includes('crystals');
    const showWoodFrame = availableAddOns.includes('woodFrame');
    const showIllumination = availableAddOns.includes('illumination') && illuminationTier !== 'none';
    const hasAnyAddOn = showCrystals || showWoodFrame || showIllumination;

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
        return related.slice(0, 8);
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
                    <p className="font-sans text-lg text-wood-600 mb-8">The piece you are looking for does not exist or has been moved.</p>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
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
    const editionText = getEditionDisplay(art, selectedSizeData);
    const editionClosed = isEditionClosed(art);

    // Availability text color per spec
    const availabilityColor = art.availability === 'READY_TO_SHIP'
        ? 'text-avail-ready font-medium'
        : art.availability === 'MADE_TO_ORDER'
        ? 'text-avail-order'
        : 'text-avail-sold';

    // Whether this piece has the full variant configurator
    const hasVariants = variants.length > 0;

    // Whether the currently selected variant is in stock
    const selectedIsInStock = selectedSizeData?.availability === 'IN_STOCK';

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

    const handleAddToCartVariant = () => {
        if (!selectedSizeData) return;

        const isInStock = selectedSizeData.availability === 'IN_STOCK';

        // Build human-readable title
        const sizeDisplay = selectedSize.replace('"', ' inch');
        const addOnNames = [
            addCrystals && 'with crystals',
            addWoodFrame && 'with wood frame',
            addIllumination && 'illuminated',
        ].filter(Boolean) as string[];
        const displayTitle = addOnNames.length > 0
            ? `${art.title}, ${sizeDisplay}, ${addOnNames.join(', ')}`
            : `${art.title}, ${sizeDisplay}`;

        // Build add-on Stripe Price IDs for separate line items at checkout
        const addOnPriceIds: string[] = [];
        if (addCrystals) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.crystals[addOnTier].stripePriceId);
        if (addWoodFrame) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.woodFrame[addOnTier].stripePriceId);
        if (addIllumination && illuminationTier !== 'none') {
            addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.illumination[illuminationTier].stripePriceId);
        }

        // Unique cart ID per configuration so different configurations are separate items
        const configKey = [
            selectedSize,
            addCrystals ? 'xls' : '',
            addWoodFrame ? 'xwf' : '',
            addIllumination ? 'xil' : '',
        ].join('-');
        const cartId = `${art.id}-${configKey.replace(/[^a-zA-Z0-9-]/g, '')}`;

        const cartProduct: Product = {
            id: cartId,
            title: displayTitle,
            price: mtoTotal,
            category: art.category,
            image: art.coverImage,
            available: true,
            isReadyToShip: isInStock,
            material: art.material,
            edition: art.edition,
            dimensions: art.dimensions,
            stripePriceId: selectedSizeData.stripePriceId,
            addOnPriceIds: addOnPriceIds.length > 0 ? addOnPriceIds : undefined,
        };
        addToCart(cartProduct);
        // CartContext opens the drawer automatically
    };

    // --- Share handler ---

    const handleShare = async () => {
        const url = window.location.href;
        try {
            await navigator.share({ title: art.title, url });
        } catch {
            try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch { /* silently ignore */ }
        }
    };

    // --- Schema markup ---

    const artworkSchema = {
        '@context': 'https://schema.org',
        '@type': 'VisualArtwork',
        name: art.title,
        description: isUL ? ulMetaDescription(art) : art.description,
        url: `https://adrianrasmussen.com/creations/${art.id}`,
        image: `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_1200,c_fill,g_auto/${art.coverImage}`,
        creator: { '@type': 'Person', name: 'Adrian Rasmussen', url: 'https://adrianrasmussen.com/about' },
        ...(art.year && { dateCreated: art.year }),
        ...(art.material && { artMedium: art.material }),
        ...(art.series && seriesSlug && {
            isPartOf: {
                '@type': 'Collection',
                name: `${art.series} Series`,
                url: `https://adrianrasmussen.com/creations/multidimensional-art/${seriesSlug}`,
            },
        }),
        ...(art.price && {
            offers: {
                '@type': 'Offer',
                price: art.price,
                priceCurrency: 'USD',
                availability: art.availability === 'SOLD'
                    ? 'https://schema.org/SoldOut'
                    : 'https://schema.org/InStock',
                url: `https://adrianrasmussen.com/creations/${art.id}`,
            },
        }),
    };

    const breadcrumbItems = [
        { '@type': 'ListItem', position: 1, name: 'Creations', item: 'https://adrianrasmussen.com/creations' },
    ];
    if (art.series && seriesSlug) {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 2, name: art.series,
            item: `https://adrianrasmussen.com/creations/multidimensional-art/${seriesSlug}`,
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

    // Breadcrumb crumbs for the Breadcrumb component (desktop)
    const breadcrumbCrumbs = (() => {
        const crumbs: Crumb[] = [{ label: 'Creations', to: '/creations' }];
        if (isMultidimensional) {
            crumbs.push({ label: 'Multidimensional Art', to: '/creations/multidimensional-art' });
            if (seriesLink && art.series) {
                crumbs.push({ label: art.series, to: seriesLink });
            } else if (signaturePiecesLink) {
                crumbs.push({ label: 'Signature Pieces', to: signaturePiecesLink });
            }
        } else if (art.category) {
            crumbs.push({ label: art.category, to: `/creations?category=${encodeURIComponent(art.category)}` });
        }
        crumbs.push({ label: art.title });
        return crumbs;
    })();

    // Structured metadata for mobile-first stacked display
    const metadataRows = [
        art.dimensions && { label: 'Dimensions', value: art.dimensions },
        art.material && { label: 'Material', value: art.material },
        art.year && { label: 'Year', value: art.year },
    ].filter(Boolean) as { label: string; value: string }[];

    return (
        <section className="bg-paper-50 min-h-screen pt-[101px] md:pt-[66px] pb-24 md:pb-32 animate-fade-in">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(artworkSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
            />

            {/* Return to oracle reading — shown only when the reader arrived
                via a card's BuySheet. One tap takes them back to the same
                card with their active system preserved (?system=...). */}
            {oracleOrigin && (
                <div className="bg-paper-100 border-b border-wood-200/60">
                    <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center justify-between gap-4">
                        <Link
                            to={oracleOrigin}
                            className="inline-flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.22em] text-bronze-700 hover:text-bronze-800 transition-colors"
                        >
                            <ArrowRight size={14} className="rotate-180" />
                            Return to your oracle reading
                        </Link>
                    </div>
                </div>
            )}

            {/* Breadcrumb - Mobile: simplified (← Category), Desktop: full path */}
            {/* Mobile breadcrumb */}
            <div className="md:hidden max-w-7xl mx-auto px-6 py-5 border-b border-wood-100">
                <button
                    onClick={() => {
                        if (window.history.length <= 1) {
                            navigate(
                                isMultidimensional
                                    ? (seriesLink ?? '/creations/multidimensional-art')
                                    : (art.category ? `/creations?category=${encodeURIComponent(art.category)}` : '/creations')
                            );
                        } else {
                            navigate(-1);
                        }
                    }}
                    className="min-h-[44px] inline-flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold hover:text-wood-900 transition-colors"
                >
                    <ArrowRight size={14} className="rotate-180" />
                    {isMultidimensional ? (art.series ?? 'Multidimensional Art') : (art.category ?? 'Creations')}
                </button>
            </div>

            {/* Desktop breadcrumb - full path */}
            <div className="hidden md:flex max-w-7xl mx-auto px-12 py-6">
                <Breadcrumb crumbs={breadcrumbCrumbs} />
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
                {/* Images */}
                <div className="space-y-4">
                    <div
                        className="relative w-full bg-wood-100 overflow-hidden cursor-zoom-in"
                        onClick={() => {
                            setLightboxIndex(activeImageIndex);
                            setLightboxOpen(true);
                        }}
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
                            src={cldImg(allImages[activeImageIndex], { w: 1200 })}
                            className="w-full h-auto object-cover transition-opacity duration-300 pointer-events-none"
                            alt={isUL ? ulAltText(art, ulCardNumber(art.coverImage)) : art.title}
                        />
                    </div>
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 text-center md:hidden">
                        Tap image to enlarge
                    </p>

                    {allImages.length > 1 && (
                        <div className="flex justify-center gap-3 py-3 lg:hidden">
                            {allImages.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveImageIndex(i)}
                                    aria-label={`View image ${i + 1}`}
                                    className={`rounded-full transition-all duration-300 ${
                                        i === activeImageIndex
                                            ? 'w-5 h-2.5 bg-bronze-500'
                                            : 'w-2.5 h-2.5 bg-wood-300 hover:bg-wood-500'
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    {allImages.length > 1 && (
                        <div className="hidden lg:grid grid-cols-5 gap-2">
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
                                        src={cldImg(img, { w: 150, h: 150 })}
                                        className="w-full aspect-square object-cover"
                                        alt={isUL ? ulAltText(art, ulCardNumber(art.coverImage)) : `${art.title} view ${i + 1}`}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="lg:pt-8 lg:sticky lg:top-28 lg:self-start">
                    <div className="mb-6 md:mb-8">
                        {art.series && (seriesLink || seriesSlug) && (
                            <Link
                                to={seriesLink ?? `/creations/multidimensional-art/${seriesSlug}`}
                                className="flex items-center gap-2 text-bronze-600 font-label text-xs uppercase tracking-[0.2em] font-semibold mb-5 hover:underline py-1"
                            >
                                {art.series} Series <ArrowUpRight size={12} />
                            </Link>
                        )}
                        <div className="flex items-start justify-between gap-3 mb-6">
                            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-wood-900 leading-[1.1] font-medium">
                                {art.title}
                            </h1>
                            <button
                                onClick={handleShare}
                                className="shrink-0 mt-1 flex items-center gap-1.5 font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 hover:text-wood-900 transition-colors font-semibold"
                                aria-label="Share this piece"
                            >
                                {copied ? <><Check size={12} className="text-bronze-600" /> Copied</> : <><Share2 size={12} /> Share</>}
                            </button>
                        </div>

                        {/* Mobile: stacked labeled metadata rows */}
                        <div className="md:hidden bg-wood-50/40 border border-wood-100 p-4 space-y-3">
                            {metadataRows.map(row => (
                                <div key={row.label} className="flex items-baseline gap-3">
                                    <span className="font-label text-xs uppercase tracking-[0.1em] text-wood-600 font-semibold shrink-0">{row.label}</span>
                                    <span className="flex-1 border-b border-dotted border-wood-200 translate-y-[-3px]"></span>
                                    <span className="font-sans text-base text-wood-700 text-right shrink-0">{row.value}</span>
                                </div>
                            ))}
                            {editionText && !hasVariants && (
                                <div className="pt-1.5 mt-1 border-t border-wood-100">
                                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold">{editionText}</span>
                                </div>
                            )}
                        </div>

                        {/* Desktop: segmented metadata bar */}
                        <div className="hidden md:block">
                            <div className="flex items-center divide-x divide-wood-200 bg-wood-50/60 border border-wood-100 py-3">
                                {metadataRows.map((row, i) => (
                                    <div key={row.label} className={`px-5 ${i === 0 ? 'pl-5' : ''}`}>
                                        <span className="block font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 font-semibold mb-0.5">{row.label}</span>
                                        <span className="block font-sans text-base text-wood-800">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            {editionText && !hasVariants && (
                                <p className="font-sans text-base text-bronze-600 mt-3">{editionText}</p>
                            )}
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="prose prose-stone font-sans text-wood-700 leading-[1.7] md:leading-[1.8] text-base md:text-[17px] max-w-[62ch]">
                            <p>{art.description}</p>
                            {art.longDescription && <p className="mt-4">{art.longDescription}</p>}
                        </div>

                        {art.seriesDescription && (
                            <div className="mt-6 border-t border-wood-100 pt-4">
                                <button
                                    onClick={() => setSeriesDescExpanded(v => !v)}
                                    className="flex items-center justify-between w-full text-left group py-2 -my-2"
                                    aria-expanded={seriesDescExpanded}
                                >
                                    <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-700 font-semibold">
                                        About the {art.series ?? 'Series'}
                                    </span>
                                    <span className="font-label text-[11px] text-wood-600 font-semibold transition-all duration-200">
                                        {seriesDescExpanded ? 'Less' : 'More'}
                                    </span>
                                </button>
                                {seriesDescExpanded && (
                                    <div className="mt-4 font-sans text-wood-600 leading-[1.8] text-base max-w-[62ch] animate-fade-in">
                                        <p>{art.seriesDescription}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {art.relatedStorySlug && (
                        <Link
                            to={`/writings/${art.relatedStorySlug}`}
                            className="flex items-center gap-3 px-5 py-4 border border-wood-200 bg-wood-50/50 hover:bg-wood-50 hover:border-bronze-300 transition-all mb-10 group"
                        >
                            <BookOpen size={16} className="text-bronze-600 shrink-0" />
                            <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 group-hover:text-bronze-500 font-semibold">
                                Read the story behind this piece
                            </span>
                            <ArrowRight size={12} className="text-bronze-400 ml-auto shrink-0" />
                        </Link>
                    )}

                    {/* Purchase section */}
                    <div ref={purchaseRef} className="border border-wood-200 bg-wood-50 px-5 py-6 md:p-8 mt-6 md:mt-2">

                        {/* --- Edition closed --- */}
                        {editionClosed ? (
                            <div className="space-y-4">
                                <div className="w-full py-4 border border-wood-200 text-avail-sold font-label text-xs uppercase tracking-[0.2em] font-semibold flex items-center justify-center">
                                    Edition closed
                                </div>
                                <Link
                                    to="/inquire"
                                    state={{ piece: art.title, pieceId: art.id }}
                                    className="w-full min-h-[52px] py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3"
                                >
                                    Commission a similar piece <ArrowRight size={14} />
                                </Link>
                            </div>

                        /* --- Unified configurator: pieces with size variants --- */
                        ) : hasVariants ? (
                            <div className="space-y-0">

                                {/* Step indicator — only when there's an actual size choice
                                    to make. With one size, there's no step 1, so no
                                    indicator either. */}
                                {variants.length > 1 && (
                                    <div className="flex items-center gap-3 mb-6">
                                        <button
                                            type="button"
                                            onClick={() => setConfigStep(1)}
                                            className={`font-label text-[11px] uppercase tracking-[0.18em] font-semibold transition-colors ${
                                                configStep === 1
                                                    ? 'text-wood-900'
                                                    : 'text-wood-500 hover:text-wood-700'
                                            }`}
                                        >
                                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-[10px] ${
                                                configStep === 1 ? 'bg-wood-900 text-paper-50' : 'bg-wood-200 text-wood-700'
                                            }`}>1</span>
                                            Size
                                        </button>
                                        <span className="flex-1 h-px bg-wood-200" aria-hidden="true" />
                                        <button
                                            type="button"
                                            onClick={() => setConfigStep(2)}
                                            disabled={!selectedSize}
                                            className={`font-label text-[11px] uppercase tracking-[0.18em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                configStep === 2
                                                    ? 'text-wood-900'
                                                    : 'text-wood-500 hover:text-wood-700'
                                            }`}
                                        >
                                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-[10px] ${
                                                configStep === 2 ? 'bg-wood-900 text-paper-50' : 'bg-wood-200 text-wood-700'
                                            }`}>2</span>
                                            {hasAnyAddOn ? 'Options & buy' : 'Review & buy'}
                                        </button>
                                    </div>
                                )}

                                {/* --- Step 1: Size --- */}
                                {configStep === 1 && variants.length > 1 && (
                                    <div className="mb-2">
                                        <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold mb-4">
                                            Select your size
                                        </p>
                                        <div className="space-y-2">
                                            {variants.map(sizeOption => {
                                                const isInStock = sizeOption.availability === 'IN_STOCK';
                                                const isSelected = selectedSize === sizeOption.size;
                                                return (
                                                    <label
                                                        key={sizeOption.size}
                                                        className={`flex items-center justify-between px-4 py-3.5 border cursor-pointer transition-all duration-150 ${
                                                            isSelected
                                                                ? 'border-wood-900 bg-wood-50'
                                                                : 'border-wood-200 hover:border-wood-400'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                                                isSelected ? 'border-wood-900' : 'border-wood-300'
                                                            }`}>
                                                                {isSelected && (
                                                                    <div className="w-2 h-2 rounded-full bg-wood-900" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-sans text-lg text-wood-900">{sizeOption.size}</span>
                                                                <span className={`font-label text-[10px] uppercase tracking-[0.15em] font-semibold ${
                                                                    isInStock ? 'text-avail-ready' : 'text-wood-400'
                                                                }`}>
                                                                    {isInStock
                                                                        ? `In stock${sizeOption.editionNumber ? ` · #${sizeOption.editionNumber}` : ''}`
                                                                        : 'Made to order · 1 to 3 weeks'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="font-label text-sm text-wood-700 font-semibold">
                                                            {formatPrice(sizeOption.price)}
                                                        </span>
                                                        <input
                                                            type="radio"
                                                            name={`size-${art.id}`}
                                                            value={sizeOption.size}
                                                            checked={isSelected}
                                                            onChange={() => setSelectedSize(sizeOption.size)}
                                                            className="sr-only"
                                                        />
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setConfigStep(2)}
                                            disabled={!selectedSize}
                                            className="w-full min-h-[52px] py-4 mt-6 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {hasAnyAddOn ? 'Continue to options' : 'Continue to review'} <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* --- Step 2: Options + total + buy --- */}
                                {configStep === 2 && (
                                    <>
                                        {/* Selected size summary, with a tap to change */}
                                        {selectedSizeData && variants.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setConfigStep(1)}
                                                className="w-full flex items-center justify-between px-4 py-3 mb-6 border border-wood-200 hover:border-wood-400 transition-colors text-left group"
                                            >
                                                <div>
                                                    <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 font-semibold block">Size</span>
                                                    <span className="font-sans text-base text-wood-900">{selectedSizeData.size}</span>
                                                </div>
                                                <span className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-600 group-hover:text-bronze-500 font-semibold">
                                                    Change
                                                </span>
                                            </button>
                                        )}

                                        {/* Add-on checkboxes — filtered to what THIS piece offers */}
                                        {hasAnyAddOn && (
                                            <div className="mb-6">
                                                <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold mb-4">
                                                    Add to your piece
                                                </p>
                                                <div className="space-y-6">

                                                    {showCrystals && (
                                                        <label className="flex items-start gap-3 cursor-pointer group">
                                                            <div className={`w-6 h-6 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                                addCrystals ? 'border-wood-900 bg-wood-900 text-paper-50' : 'border-wood-300 group-hover:border-wood-600'
                                                            }`}>
                                                                {addCrystals && <Checkmark />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-baseline justify-between gap-4">
                                                                    <span className="font-sans text-lg text-wood-900">Add crystals</span>
                                                                    <span className="font-label text-sm text-wood-600 font-semibold shrink-0">
                                                                        +{formatPrice(crystalsPrice)}
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
                                                    )}

                                                    {showWoodFrame && (
                                                        <label className="flex items-start gap-3 cursor-pointer group">
                                                            <div className={`w-6 h-6 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                                addWoodFrame ? 'border-wood-900 bg-wood-900 text-paper-50' : 'border-wood-300 group-hover:border-wood-600'
                                                            }`}>
                                                                {addWoodFrame && <Checkmark />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-baseline justify-between gap-4">
                                                                    <span className="font-sans text-lg text-wood-900">Add wood frame</span>
                                                                    <span className="font-label text-sm text-wood-600 font-semibold shrink-0">
                                                                        +{formatPrice(woodFramePrice)}
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
                                                    )}

                                                    {showIllumination && (
                                                        <label className="flex items-start gap-3 cursor-pointer group">
                                                            <div className={`w-6 h-6 border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                                                addIllumination ? 'border-wood-900 bg-wood-900 text-paper-50' : 'border-wood-300 group-hover:border-wood-600'
                                                            }`}>
                                                                {addIllumination && <Checkmark />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-baseline justify-between gap-4">
                                                                    <span className="font-sans text-lg text-wood-900">Illuminate this piece</span>
                                                                    <span className="font-label text-sm text-wood-600 font-semibold shrink-0">
                                                                        +{formatPrice(illuminationPrice)}
                                                                    </span>
                                                                </div>
                                                                <p className="font-sans text-sm text-wood-700 mt-1 leading-[1.7]">
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

                                                </div>

                                                <Link
                                                    to="/creations"
                                                    className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold mt-6 transition-colors"
                                                >
                                                    See what's possible <ArrowRight size={12} />
                                                </Link>
                                            </div>
                                        )}

                                        {/* Live total with dynamic availability */}
                                        <div className="border-t border-wood-200 pt-6 pb-6 bg-wood-50/60 -mx-5 px-5 md:-mx-8 md:px-8">
                                            <div className="flex items-end justify-between mb-3">
                                                <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">Total</span>
                                                <span className="font-serif text-3xl text-wood-900 font-medium">
                                                    {formatPrice(mtoTotal)}
                                                </span>
                                            </div>
                                            <div className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold transition-all duration-300">
                                                {selectedIsInStock ? (
                                                    <>
                                                        <span className="inline-block px-2 py-0.5 bg-wood-100 text-avail-ready rounded-sm mr-1">In stock</span>
                                                        {' · '}Ships in 2 to 3 weeks
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="inline-block px-2 py-0.5 bg-wood-100 text-avail-order rounded-sm mr-1">Made to order</span>
                                                        {' · '}1 to 3 weeks
                                                    </>
                                                )}
                                            </div>
                                            {editionText && (
                                                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mt-1">
                                                    {editionText}
                                                </p>
                                            )}
                                        </div>

                                        {/* Add to Cart / Request to Purchase */}
                                        {LAUNCH_FLAGS.shopEnabled ? (
                                        <button
                                            onClick={handleAddToCartVariant}
                                            disabled={!selectedSize}
                                            className="w-full min-h-[52px] py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <ShoppingBag size={16} /> Add to Cart
                                        </button>
                                        ) : (
                                        <Link
                                            to="/inquire"
                                            state={{
                                                piece: art.title,
                                                pieceId: art.id,
                                                mode: 'purchase',
                                                price: formatPrice(mtoTotal),
                                                size: selectedSize,
                                                addOns: [
                                                    ...(addCrystals ? [`Crystals (+${formatPrice(crystalsPrice)})`] : []),
                                                    ...(addWoodFrame ? [`Wood frame (+${formatPrice(woodFramePrice)})`] : []),
                                                    ...(addIllumination ? [`Illumination (+${formatPrice(illuminationPrice)})`] : []),
                                                ],
                                                availability: selectedIsInStock ? 'Ready to ship' : 'Made to order',
                                            }}
                                            className="w-full min-h-[52px] py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                                        >
                                            Request to Purchase
                                        </Link>
                                        )}

                                        {/* Shipping handled separately — set the buyer's expectation
                                            before they commit. Adrian invoices the actual shipping
                                            rate after the piece price clears. */}
                                        <p className="text-center font-sans text-[13px] text-wood-600 mt-4 leading-[1.55] max-w-[40ch] mx-auto">
                                            Shipping handled separately based on destination. You'll receive shipping details and a separate invoice within 48 hours of purchase.
                                        </p>

                                        {/* Or commission a similar piece */}
                                        <Link
                                            to="/inquire"
                                            state={{ piece: art.title, pieceId: art.id }}
                                            className="block text-center font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold mt-4 transition-colors"
                                        >
                                            Or commission a similar piece
                                        </Link>
                                    </>
                                )}
                            </div>

                        /* --- Ready to ship (simple, no variants): Add to Cart --- */
                        ) : art.availability === 'READY_TO_SHIP' ? (
                            <div className="space-y-5">
                                {/* Mobile: stacked label + price */}
                                <div className="md:hidden space-y-1.5">
                                    <span className={`inline-block px-2.5 py-1 text-[11px] font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 ${availabilityColor}`}>Ready to ship</span>
                                    <span className="block font-serif text-4xl text-wood-900 font-medium">{art.price != null ? formatPrice(art.price) : ''}</span>
                                </div>
                                {/* Desktop: side by side */}
                                <div className="hidden md:flex justify-between items-end">
                                    <span className={`inline-block px-2.5 py-1 text-xs font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 ${availabilityColor}`}>Ready to ship</span>
                                    <span className="font-serif text-3xl text-wood-900 font-medium">{art.price != null ? formatPrice(art.price) : ''}</span>
                                </div>
                                {LAUNCH_FLAGS.shopEnabled ? (
                                <button
                                    onClick={handleAddToCartRTS}
                                    className={`w-full min-h-[52px] py-4 font-label text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 flex items-center justify-center gap-3 ${
                                        rtsAdded
                                            ? 'bg-bronze-600 text-paper-50 scale-[1.02] shadow-lg ring-2 ring-bronze-400/50'
                                            : 'bg-wood-900 text-paper-50 hover:bg-bronze-600 active:scale-[0.98]'
                                    }`}
                                >
                                    {rtsAdded
                                        ? <><Check size={16} /> Added to Cart</>
                                        : <><ShoppingBag size={16} /> Add to Cart</>
                                    }
                                </button>
                                ) : (
                                <Link
                                    to="/inquire"
                                    state={{
                                        piece: art.title,
                                        pieceId: art.id,
                                        mode: 'purchase',
                                        price: art.price != null ? formatPrice(art.price) : '',
                                        availability: 'Ready to ship',
                                    }}
                                    className="w-full min-h-[52px] py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                                >
                                    Request to Purchase
                                </Link>
                                )}
                                <p className="text-center font-sans text-[13px] text-wood-600 mt-1 leading-[1.55] max-w-[40ch] mx-auto">
                                    Ships from Bali. Shipping handled separately based on destination, invoiced within 48 hours of purchase.
                                </p>
                            </div>

                        /* --- Made to order WITHOUT size options: Commission link --- */
                        ) : art.availability === 'MADE_TO_ORDER' ? (
                            <div className="space-y-5">
                                {/* Mobile: stacked label + price */}
                                <div className="md:hidden space-y-1.5">
                                    <span className={`inline-block px-2.5 py-1 text-[11px] font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 ${availabilityColor}`}>Made to order</span>
                                    <span className="block font-serif text-4xl text-wood-900 font-medium">From {art.price != null ? formatPrice(art.price) : ''}</span>
                                </div>
                                {/* Desktop: side by side */}
                                <div className="hidden md:flex justify-between items-end">
                                    <span className={`inline-block px-2.5 py-1 text-xs font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 ${availabilityColor}`}>Made to order</span>
                                    <span className="font-serif text-3xl text-wood-900 font-medium">From {art.price != null ? formatPrice(art.price) : ''}</span>
                                </div>
                                <Link
                                    to="/inquire"
                                    state={{
                                        piece: art.title,
                                        pieceId: art.id,
                                        mode: 'purchase',
                                        price: art.price != null ? `From ${formatPrice(art.price)}` : '',
                                        availability: 'Made to order',
                                    }}
                                    className="w-full min-h-[52px] py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3"
                                >
                                    Commission This Piece <ArrowRight size={14} />
                                </Link>
                                <p className="text-center font-sans text-[13px] text-wood-600 mt-1 leading-[1.55] max-w-[40ch] mx-auto">
                                    1 to 3 weeks production time. Shipping handled separately based on destination, invoiced within 48 hours of purchase.
                                </p>
                            </div>

                        /* --- Sold --- */
                        ) : (
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <span className="inline-block px-2.5 py-1 text-xs font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 text-avail-sold">
                                        This piece has found its home
                                    </span>
                                    {art.price != null && (
                                        <span className="font-label text-xs text-wood-600 font-semibold">
                                            Originally {formatPrice(art.price)}
                                        </span>
                                    )}
                                </div>

                                {art.series && seriesLink && seriesData && (
                                    <p className="font-sans text-base text-wood-600 leading-[1.7]">
                                        Part of the{' '}
                                        <Link to={seriesLink} className="text-bronze-600 hover:underline">
                                            {art.series} series
                                        </Link>
                                        {seriesData.pieceCount ? ` · ${seriesData.pieceCount}` : ''}
                                    </p>
                                )}

                                <Link
                                    to="/inquire"
                                    state={{ piece: art.title, pieceId: art.id }}
                                    className="w-full min-h-[52px] py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors flex items-center justify-center gap-3"
                                >
                                    Inquire about a similar piece <ArrowRight size={14} />
                                </Link>
                                <p className="text-center font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold">
                                    Each piece is made by hand in Bali
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Category label */}
                    <div className="mt-8 md:mt-8 pt-6 md:pt-8 border-t border-wood-200 flex items-center justify-between">
                        <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold">
                            {art.category}
                        </span>
                        <Link
                            to={isMultidimensional ? '/creations/multidimensional-art' : `/creations?category=${encodeURIComponent(art.category)}`}
                            className="inline-flex items-center gap-1 font-label text-[11px] uppercase tracking-[0.15em] text-bronze-600 font-semibold hover:text-bronze-500 transition-colors"
                        >
                            Browse all <ArrowRight size={11} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Bar (Mobile) */}
            {(art.availability === 'SOLD' || editionClosed) ? (
                <div className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-paper-50 border-t border-wood-200 px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transition-transform duration-300 ${purchaseVisible ? 'translate-y-full' : 'translate-y-0'}`}>
                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-avail-sold font-semibold">
                        This piece has found its home
                    </span>
                    <Link
                        to="/inquire"
                        state={{ piece: art.title, pieceId: art.id }}
                        className="min-h-[44px] px-6 py-3 border border-wood-900 text-wood-900 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-wood-900 hover:text-paper-50 transition-colors flex items-center"
                    >
                        Inquire
                    </Link>
                </div>
            ) : (
                <div className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-paper-50 border-t border-wood-200 px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transition-transform duration-300 ${purchaseVisible ? 'translate-y-full' : 'translate-y-0'}`}>
                    <span className="font-serif text-xl text-wood-900 font-medium">
                        {hasVariants
                            ? formatPrice(mtoTotal)
                            : art.availability === 'READY_TO_SHIP'
                            ? (art.price != null ? formatPrice(art.price) : '')
                            : `From ${art.price != null ? formatPrice(art.price) : ''}`
                        }
                    </span>

                    {LAUNCH_FLAGS.shopEnabled && hasVariants ? (
                        <button
                            onClick={handleAddToCartVariant}
                            disabled={!selectedSize}
                            className="min-h-[44px] px-8 py-3 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <ShoppingBag size={14} /> Add to Cart
                        </button>
                    ) : LAUNCH_FLAGS.shopEnabled && art.availability === 'READY_TO_SHIP' ? (
                        <button
                            onClick={handleAddToCartRTS}
                            className={`min-h-[44px] px-8 py-3 font-label text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-300 flex items-center gap-2 ${
                                rtsAdded
                                    ? 'bg-bronze-600 text-paper-50 ring-2 ring-bronze-400/50'
                                    : 'bg-wood-900 text-paper-50 hover:bg-bronze-600 active:scale-[0.98]'
                            }`}
                        >
                            {rtsAdded ? <><Check size={14} /> Added</> : <><ShoppingBag size={14} /> Add to Cart</>}
                        </button>
                    ) : (
                        <Link
                            to="/inquire"
                            state={{
                                piece: art.title,
                                pieceId: art.id,
                                mode: 'purchase',
                                price: hasVariants ? formatPrice(mtoTotal) : (art.price != null ? formatPrice(art.price) : ''),
                                size: hasVariants ? selectedSize : undefined,
                                addOns: hasVariants ? [
                                    ...(addCrystals ? [`Crystals (+${formatPrice(crystalsPrice)})`] : []),
                                    ...(addWoodFrame ? [`Wood frame (+${formatPrice(woodFramePrice)})`] : []),
                                    ...(addIllumination ? [`Illumination (+${formatPrice(illuminationPrice)})`] : []),
                                ] : [],
                                availability: hasVariants
                                    ? (selectedIsInStock ? 'Ready to ship' : 'Made to order')
                                    : (art.availability === 'READY_TO_SHIP' ? 'Ready to ship' : 'Made to order'),
                            }}
                            className="min-h-[44px] px-8 py-3 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors flex items-center"
                        >
                            Request to Purchase
                        </Link>
                    )}
                </div>
            )}

            {/* More from this series - compact tile grid, series pieces only */}
            <MoreFromSeries art={art} seriesLink={seriesLink} />

            {/* Recently Viewed */}
            {recentPieces.length > 0 && (
                <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 md:mt-24">
                    <div className="border-t border-wood-200 pt-12 mb-10">
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold">
                            Recently Viewed
                        </span>
                    </div>
                    <div className="columns-2 md:columns-4 gap-4 md:gap-6 card-stagger">
                        {recentPieces.map(piece => (
                            <GalleryTileCard key={piece.id} art={piece} showDetails subtitleOverride={piece.series ?? piece.category} />
                        ))}
                    </div>
                </div>
            )}

            {/* Related Pieces */}
            {relatedPieces.length === 0 && (
                <div className="max-w-7xl mx-auto px-6 md:px-12 mt-20 md:mt-32">
                    <div className="border-t border-wood-200 pt-12 text-center">
                        <h2 className="font-serif text-2xl text-wood-700 font-medium mb-3">Explore more</h2>
                        <Link
                            to="/creations"
                            className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 font-semibold transition-colors border-b border-wood-300 pb-1"
                        >
                            Browse all creations <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>
            )}
            {relatedPieces.length > 0 && (
                <div className="max-w-7xl mx-auto px-6 md:px-12 mt-20 md:mt-32">
                    <div className="border-t border-wood-200 pt-12 mb-10">
                        <h2 className="font-serif text-3xl text-wood-900 font-medium">
                            {art.series ? `More from ${art.series}` : 'Related Works'}
                        </h2>
                        <p className="font-sans text-base text-wood-500 mt-2">
                            {art.series
                                ? `Explore other pieces in the ${art.series} series`
                                : 'You may also be drawn to these pieces'}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-10 card-stagger">
                        {relatedPieces.map((related) => (
                            <Link
                                key={related.id}
                                to={`/creations/${related.id}`}
                                className="group"
                            >
                                <div className="relative overflow-hidden transition-all duration-500 group-hover:shadow-lg">
                                    <img
                                        src={cldImg(related.coverImage, { w: 600 })}
                                        alt={`${related.title} by Adrian Rasmussen`}
                                        loading="lazy"
                                        className={`w-full object-cover transition-transform duration-[1.5s] group-hover:scale-105 ${related.availability === 'SOLD' ? 'opacity-60' : ''}`}
                                    />
                                    {related.availability === 'SOLD' && (
                                        <div className="absolute inset-0 bg-paper-50/20 pointer-events-none" />
                                    )}
                                </div>
                                <div className="mt-3 md:mt-4">
                                    <h4 className="font-sans text-base md:text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-tight">
                                        {related.title}
                                    </h4>
                                    {!art.series && (
                                        <p className="font-label text-[11px] md:text-[12px] uppercase tracking-[0.1em] text-wood-600 font-semibold mt-1.5 leading-none">
                                            {related.category}
                                        </p>
                                    )}
                                    <span className={`inline-block mt-2 px-2 py-0.5 font-label text-[10px] md:text-[11px] uppercase tracking-[0.15em] font-semibold rounded-sm ${
                                        related.availability === 'SOLD'
                                            ? 'bg-wood-100 text-avail-sold'
                                            : related.availability === 'READY_TO_SHIP'
                                            ? 'bg-wood-100 text-avail-ready'
                                            : 'bg-wood-100 text-avail-order'
                                    }`}>
                                        {related.availability === 'SOLD' && 'Sold'}
                                        {related.availability === 'READY_TO_SHIP' && 'Ready to ship'}
                                        {related.availability === 'MADE_TO_ORDER' && 'Made to order'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Navigation links to series and parent category */}
                    {isMultidimensional && (
                        <div className="mt-14 pt-10 border-t border-wood-200 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
                            {seriesLink && art.series && (
                                <Link
                                    to={seriesLink}
                                    className="group flex items-center gap-3 font-sans text-lg text-wood-700 hover:text-bronze-700 transition-colors"
                                >
                                    <span>View all {art.series}</span>
                                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                </Link>
                            )}
                            <Link
                                to="/creations/multidimensional-art"
                                className="group flex items-center gap-3 font-sans text-lg text-wood-700 hover:text-bronze-700 transition-colors"
                            >
                                <span>Explore all Multidimensional Art</span>
                                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Image Lightbox */}
            {lightboxOpen && (
                <VisualLightbox
                    images={allImages.map(i => cldImg(i, { w: 1800 }))}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </section>
    );
};

export default PiecePage;
