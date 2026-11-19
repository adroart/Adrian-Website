
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { Artwork, AvailabilityStatus, SizeVariant, Product } from '../types';
import { FULL_ARCHIVE, SERIES_DATA } from '../data/mockData';
import { STORIES } from '../data/generatedStories';
import { storyLinksArtwork } from './shared/StoryBody';
import { ArrowRight, ArrowUpRight, BookOpen, ShoppingBag, Check } from 'lucide-react';
import { useCart } from '../CartContext';
import { LAUNCH_FLAGS } from '../launchFlags';
import { img as cldImg } from '../utils/media';
import { formatPrice } from '../utils/formatPrice';
import VisualLightbox from './VisualLightbox';
import ArtImage from './ArtImage';
import { hasWhitePhotoBackdrop } from './gallery/galleryContent';
import PieceConfigurator from './PieceConfigurator';
import Breadcrumb, { type Crumb } from './Breadcrumb';
import GalleryTileCard from './GalleryTileCard';
import SaveToCollectionButton from './account/SaveToCollectionButton';
import { useMetaTags } from '../hooks/useMetaTags';
import { ulCardNumber, ulAltText, ulMetaDescription, ulMetaTitle, companionCardUrl, contextualCardReturn } from '../utils/universalLanguage';
import { resolvePiece, isLegacyPieceParam, piecePath, pieceUrl } from '../utils/pieceSlug';

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

const PiecePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { addToCart } = useCart();

    // If the reader arrived from an oracle card (BuySheet → here), show a
    // one-tap return link that takes them straight back to where they were
    // reading, system param and all.
    const navState = location.state as { oracleOrigin?: string; preferredSize?: string; openConfigurator?: boolean } | null;
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

    // Sticky bottom bar visibility: hide when purchase section is in view
    const purchaseRef = useRef<HTMLDivElement>(null);
    const [purchaseVisible, setPurchaseVisible] = useState(false);

    // Accepts the canonical title slug (/creations/amphibian-dream) and the legacy
    // catalog id (/creations/SIG-100), so every link ever shared keeps resolving.
    const art = useMemo(() => resolvePiece(FULL_ARCHIVE, id), [id]);
    const cardUrl = art ? companionCardUrl(art) : null;
    const oracleOrigin = art ? contextualCardReturn(art, location.search, navState?.oracleOrigin) : null;

    // An id URL is a working URL, not the canonical one. Send it to the slug so the
    // address bar, the share sheet and the analytics all agree on one address per piece.
    useEffect(() => {
        if (art && isLegacyPieceParam(art, id)) {
            navigate(piecePath(art) + location.search, { replace: true, state: location.state });
        }
    }, [art, id, navigate, location.search, location.state]);

    // Recently viewed tracking — keyed on the stable id, never the slug
    const recentIds = useRecentlyViewed(art?.id ?? '');
    const recentPieces = useMemo(
        () => recentIds.map(rid => FULL_ARCHIVE.find(a => a.id === rid)).filter((a): a is Artwork => Boolean(a)),
        [recentIds],
    );

    // Dynamic meta tags for sharing
    const ogImage = art ? `https://adrianrasmussen.com${cldImg(art.coverImage, { w: 1200, h: 630, format: 'jpg' })}` : undefined;
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
        setLightboxOpen(false);
    }, [id]);

    // Resolve variants: prefer sizeVariants, fall back to legacy madeToOrderSizes
    const variants = useMemo(() => art?.sizeVariants ?? art?.madeToOrderSizes ?? [], [art]);

    // Set default selected size when piece loads or changes. If the reader
    // arrived from an oracle BuySheet with a specific size in mind, honor
    // that selection instead of defaulting to first-in-stock.
    const preferredSize = navState?.preferredSize ?? null;

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
        if (art.series === 'Universal Language') {
            const number = ulCardNumber(art.coverImage);
            if (number !== null) {
                related.sort((left, right) => {
                    const leftDistance = Math.abs((ulCardNumber(left.coverImage) ?? Infinity) - number);
                    const rightDistance = Math.abs((ulCardNumber(right.coverImage) ?? Infinity) - number);
                    return leftDistance - rightDistance;
                });
            }
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
            <section className="bg-surface-page min-h-screen pt-32 pb-32 px-6">
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
    const editionText = getEditionDisplay(art);
    const editionClosed = isEditionClosed(art);

    // Availability text color per spec
    const availabilityColor = art.availability === 'READY_TO_SHIP'
        ? 'text-avail-ready font-medium'
        : art.availability === 'MADE_TO_ORDER'
        ? 'text-avail-order'
        : 'text-avail-sold';

    // Whether this piece has the full variant configurator
    const hasVariants = variants.length > 0;

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
        url: pieceUrl(art),
        image: `https://adrianrasmussen.com${cldImg(art.coverImage, { w: 1200, h: 1200, format: 'jpg' })}`,
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
                url: pieceUrl(art),
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
            '@type': 'ListItem', position: 3, name: art.title, item: pieceUrl(art),
        });
    } else {
        breadcrumbItems.push({
            '@type': 'ListItem', position: 2, name: art.title, item: pieceUrl(art),
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
        <section className="public-gallery gallery-piece-page min-h-screen">
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
            {cardUrl && oracleOrigin && (
                <div className="bg-paper-100 border-b border-wood-200/60 mb-3">
                    <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex items-center justify-between gap-4">
                        <a
                            href={oracleOrigin}
                            className="inline-flex items-center gap-2 font-label text-label uppercase tracking-[0.22em] text-bronze-700 hover:text-bronze-800 transition-colors"
                        >
                            Return to your reading on Mandala Codes
                        </a>
                    </div>
                </div>
            )}

            <div className="gallery-width">
                <Breadcrumb className="gallery-crumb" crumbs={breadcrumbCrumbs} />
            </div>

            <div className="gallery-width gallery-piece">
                <header className="gallery-piece-heading">
                    {art.series && (
                        <Link
                            to={seriesLink ?? `/creations/multidimensional-art/${seriesSlug}`}
                            className="gallery-piece-series"
                        >
                            {art.series}{isUL && ulCardNumber(art.coverImage) !== null && ` · No. ${ulCardNumber(art.coverImage)}`}
                        </Link>
                    )}
                    <h1 className="gallery-title" aria-label={art.title}>{isUL ? art.title.replace(/\s*-\s*\d+$/, '') : art.title}</h1>
                </header>

                <div className="gallery-piece-photographs">
                    <button
                        type="button"
                        className={`gallery-mat gallery-piece-stage block w-full cursor-zoom-in${hasWhitePhotoBackdrop(allImages[activeImageIndex]) ? " gallery-mat-white-backdrop" : ""}`}
                        aria-label="Enlarge artwork photograph"
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
                        <ArtImage
                            key={allImages[activeImageIndex]}
                            publicId={allImages[activeImageIndex]}
                            variant="gallery"
                            sizes="(max-width: 767px) 100vw, 58vw"
                            className="pointer-events-none"
                            alt={isUL ? ulAltText(art, ulCardNumber(art.coverImage)) : art.title}
                        />
                    </button>
                    <p className="gallery-caption gallery-note">
                        <span>{allImages.length > 1 ? `View ${activeImageIndex + 1} of ${allImages.length}` : 'Artwork photograph'}</span>
                        <span>Enlarge image</span>
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
                                            ? 'w-5 h-2.5 bg-bronze-600'
                                            : 'w-2.5 h-2.5 bg-wood-300 hover:bg-wood-500'
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    {allImages.length > 1 && (
                        <div className="hidden lg:grid grid-cols-5 gap-2 mt-3">
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
                                        className="w-full aspect-square object-contain"
                                        alt={isUL ? ulAltText(art, ulCardNumber(art.coverImage)) : `${art.title} view ${i + 1}`}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="gallery-piece-details">
                    <dl className="gallery-piece-facts">
                        {metadataRows.map(row => (
                            <React.Fragment key={row.label}>
                                <dt>{row.label}</dt><dd>{row.value}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                    {editionText && !hasVariants && (
                        <p className="gallery-note mt-2">{editionText}</p>
                    )}
                    <div className="gallery-piece-tools">
                        <button
                            onClick={handleShare}
                            className="gallery-action"
                            aria-label="Share this piece"
                        >
                            {copied ? 'Copied' : 'Share'}
                        </button>
                        <SaveToCollectionButton kind="artwork" itemRef={art.id} label="Save" variant="inline" />
                    </div>

                    <div className="mb-8">
                        <div className="prose prose-stone font-sans text-wood-700 leading-prose md:leading-airy text-base md:text-body max-w-[62ch]">
                            <p>{art.description}</p>
                            {art.longDescription && <p className="mt-4">{art.longDescription}</p>}
                        </div>

                        {art.seriesDescription && seriesLink && (
                            <Link to={seriesLink} className="gallery-action mt-2">About {art.series ?? 'the series'}</Link>
                        )}
                    </div>

                    {STORIES.filter(story => storyLinksArtwork(story, art)).map(story => (
                        <Link key={story.slug} to={`/writings/${story.slug}`}
                            className="flex items-center gap-3 px-5 py-3 border border-wood-200 bg-wood-50/50 hover:bg-wood-50 hover:border-bronze-300 transition-all mb-3">
                            <span className="font-label text-xs uppercase tracking-[0.15em] text-bronze-700 font-semibold">
                                Read: {story.title}
                            </span>
                        </Link>
                    ))}

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
                            <PieceConfigurator key={art.id} art={art} initialSize={preferredSize} />

                        /* --- Ready to ship (simple, no variants): Add to Cart --- */
                        ) : art.availability === 'READY_TO_SHIP' ? (
                            <div className="space-y-5">
                                {/* Mobile: stacked label + price */}
                                <div className="md:hidden space-y-1.5">
                                    <span className={`inline-block px-2.5 py-1 text-label font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 ${availabilityColor}`}>Ready to ship</span>
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
                                <p className="text-center font-sans text-caption text-wood-600 mt-1 leading-[1.55] max-w-[40ch] mx-auto">
                                    Shipping and lead time will be confirmed for your piece and destination before purchase.
                                </p>
                            </div>

                        /* --- Made to order WITHOUT size options: Commission link --- */
                        ) : art.availability === 'MADE_TO_ORDER' ? (
                            <div className="space-y-5">
                                {/* Mobile: stacked label + price */}
                                <div className="md:hidden space-y-1.5">
                                    <span className={`inline-block px-2.5 py-1 text-label font-label uppercase tracking-[0.2em] font-semibold rounded-sm bg-wood-100 ${availabilityColor}`}>Made to order</span>
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
                                <p className="text-center font-sans text-caption text-wood-600 mt-1 leading-[1.55] max-w-[40ch] mx-auto">
                                    Shipping and lead time will be confirmed for your piece and destination before purchase.
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
                                    <p className="font-sans text-base text-wood-600 leading-prose">
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
                                <p className="text-center font-label text-label uppercase tracking-[0.2em] text-wood-600 font-semibold">
                                    Each piece is made by hand in the studio
                                </p>
                            </div>
                        )}
                    </div>

                    {cardUrl && !oracleOrigin && (
                        <a href={cardUrl} className="gallery-action">
                            Explore this piece’s companion card on Mandala Codes
                        </a>
                    )}

                    {/* Category label */}
                    <div className="mt-8 md:mt-8 pt-6 md:pt-8 border-t border-wood-200 flex items-center justify-between">
                        <span className="font-label text-label uppercase tracking-[0.2em] text-wood-600 font-semibold">
                            {art.category}
                        </span>
                        <Link
                            to={isMultidimensional ? '/creations/multidimensional-art' : `/creations?category=${encodeURIComponent(art.category)}`}
                            className="inline-flex items-center gap-1 font-label text-label uppercase tracking-[0.15em] text-bronze-600 font-semibold hover:text-bronze-600 transition-colors"
                        >
                            Browse all <ArrowRight size={11} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Bar (Mobile) */}
            {(art.availability === 'SOLD' || editionClosed) ? (
                <div className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-paper-50 border-t border-wood-200 px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transition-transform duration-300 ${purchaseVisible ? 'translate-y-full' : 'translate-y-0'}`}>
                    <span className="font-label text-label uppercase tracking-[0.2em] text-avail-sold font-semibold">
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
                            ? `From ${formatPrice(Math.min(...variants.map(v => v.price)))}`
                            : art.availability === 'READY_TO_SHIP'
                            ? (art.price != null ? formatPrice(art.price) : '')
                            : `From ${art.price != null ? formatPrice(art.price) : ''}`
                        }
                    </span>

                    {hasVariants ? (
                        <button
                            onClick={() => purchaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="min-h-[44px] px-6 py-3 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
                        >
                            View options
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
                                price: art.price != null ? formatPrice(art.price) : '',
                                availability: art.availability === 'READY_TO_SHIP' ? 'Ready to ship' : 'Made to order',
                            }}
                            className="min-h-[44px] px-8 py-3 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors flex items-center"
                        >
                            Request to Purchase
                        </Link>
                    )}
                </div>
            )}

            {/* Recently Viewed */}
            {recentPieces.length > 0 && (
                <div className="max-w-7xl mx-auto px-6 md:px-12 mt-16 md:mt-24">
                    <div className="border-t border-wood-200 pt-12 mb-10">
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-700 font-semibold">
                            Recently Viewed
                        </span>
                    </div>
                    <div className="gallery-grid">
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
                            className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-700 hover:text-wood-900 font-semibold transition-colors border-b border-wood-300 pb-1"
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
                        <p className="font-sans text-base text-wood-700 mt-2">
                            {art.series
                                ? `Explore other pieces in the ${art.series} series`
                                : 'You may also be drawn to these pieces'}
                        </p>
                    </div>
                    <div className="gallery-grid">
                        {relatedPieces.map(related => (
                            <GalleryTileCard key={related.id} art={related} showDetails />
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
                    images={allImages.map(id => cldImg(id, hasWhitePhotoBackdrop(id) ? {} : { w: 1800 }))}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </section>
    );
};

export default PiecePage;
