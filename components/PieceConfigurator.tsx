import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Artwork, SizeVariant, Product } from '../types';
import { MADE_TO_ORDER_ADD_ONS } from '../data/mockData';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '../CartContext';
import { LAUNCH_FLAGS } from '../launchFlags';
import { formatPrice } from '../utils/formatPrice';

// Determine illumination tier from a size string like '29 cm', '58 cm', '24"'
function getIlluminationTier(sizeStr: string): 'none' | 'medium' | 'large' | 'major' {
    const match = sizeStr.match(/(\d+)/);
    if (!match) return 'medium';
    const value = parseInt(match[1], 10);
    const isCm = /cm/i.test(sizeStr);
    const cm = isCm ? value : value * 2.54;
    if (cm < 30) return 'none';
    if (cm <= 60) return 'medium';
    if (cm <= 90) return 'large';
    return 'major';
}

function getAddOnSizeTier(sizeStr: string): 'small' | 'medium' | 'large' {
    const match = sizeStr.match(/(\d+)/);
    if (!match) return 'small';
    const value = parseInt(match[1], 10);
    const isCm = /cm/i.test(sizeStr);
    const cm = isCm ? value : value * 2.54;
    if (cm <= 35) return 'small';
    if (cm <= 65) return 'medium';
    return 'large';
}

function getEditionDisplay(art: Artwork, selectedVariant?: SizeVariant | null): string | null {
    if (art.editionSize) {
        const sold = art.editionSold || 0;
        const percentSold = (sold / art.editionSize) * 100;
        if (percentSold >= 100) return 'Edition closed';
        if (selectedVariant?.editionNumber) {
            return `Edition of ${art.editionSize} · #${selectedVariant.editionNumber} · Signed and numbered`;
        }
        if (art.availability === 'READY_TO_SHIP' && art.editionNumber && !art.sizeVariants) {
            return `Edition of ${art.editionSize} · #${art.editionNumber} · Signed and numbered`;
        }
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

const Checkmark: React.FC = () => (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
        <path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export interface PieceConfiguratorProps {
    art: Artwork;
    // If the reader arrived with a specific size in mind (e.g. from an oracle
    // BuySheet that surfaced a variant tile), pre-select it and skip step 1.
    initialSize?: string | null;
}

/**
 * Two-step buy wizard for variant pieces. Step 1 picks size, step 2 picks
 * options + buys. Step 1 is skipped when there's only one size or an
 * initialSize is provided. Used both inline on PiecePage and embedded in
 * the oracle BuySheet so readers never have to leave their reading.
 */
const PieceConfigurator: React.FC<PieceConfiguratorProps> = ({ art, initialSize }) => {
    const { addToCart } = useCart();

    const variants = useMemo(() => art.sizeVariants ?? art.madeToOrderSizes ?? [], [art]);

    const [selectedSize, setSelectedSize] = useState('');
    const [addCrystals, setAddCrystals] = useState(false);
    const [addWoodFrame, setAddWoodFrame] = useState(false);
    const [addIllumination, setAddIllumination] = useState(false);
    const [configStep, setConfigStep] = useState<1 | 2>(1);

    // Initial selection
    useEffect(() => {
        if (variants.length === 0) {
            setSelectedSize('');
            return;
        }
        const matchPreferred = initialSize ? variants.find(v => v.size === initialSize) : null;
        if (matchPreferred) {
            setSelectedSize(matchPreferred.size);
            return;
        }
        const inStockVariant = variants.find(v => v.availability === 'IN_STOCK');
        setSelectedSize(inStockVariant?.size ?? variants[0].size);
    }, [variants, initialSize]);

    // Step skip: one size or pre-supplied size means there's no choice to make.
    useEffect(() => {
        if (variants.length <= 1 || initialSize) {
            setConfigStep(2);
        } else {
            setConfigStep(1);
        }
    }, [variants.length, initialSize, art.id]);

    const illuminationTier = useMemo(() => {
        if (!selectedSize) return 'none' as const;
        return getIlluminationTier(selectedSize);
    }, [selectedSize]);

    useEffect(() => {
        if (illuminationTier === 'none') setAddIllumination(false);
    }, [illuminationTier]);

    const illuminationPrice = useMemo(() => {
        if (illuminationTier === 'none') return 0;
        return MADE_TO_ORDER_ADD_ONS.illumination[illuminationTier].price;
    }, [illuminationTier]);

    const addOnTier = useMemo(() => {
        if (!selectedSize) return 'small' as const;
        return getAddOnSizeTier(selectedSize);
    }, [selectedSize]);

    const crystalsPrice = MADE_TO_ORDER_ADD_ONS.crystals[addOnTier].price;
    const woodFramePrice = MADE_TO_ORDER_ADD_ONS.woodFrame[addOnTier].price;

    const selectedSizeData = useMemo((): SizeVariant | null => {
        if (variants.length === 0 || !selectedSize) return null;
        return variants.find(s => s.size === selectedSize) || null;
    }, [variants, selectedSize]);

    const mtoTotal = useMemo(() => {
        let total = selectedSizeData?.price ?? 0;
        if (addCrystals) total += crystalsPrice;
        if (addWoodFrame) total += woodFramePrice;
        if (addIllumination && illuminationTier !== 'none') total += illuminationPrice;
        return total;
    }, [selectedSizeData, addCrystals, addWoodFrame, addIllumination, crystalsPrice, woodFramePrice, illuminationPrice, illuminationTier]);

    const availableAddOns = art.availableAddOns ?? ['crystals', 'woodFrame', 'illumination'];
    const showCrystals = availableAddOns.includes('crystals');
    const showWoodFrame = availableAddOns.includes('woodFrame');
    const showIllumination = availableAddOns.includes('illumination') && illuminationTier !== 'none';
    const hasAnyAddOn = showCrystals || showWoodFrame || showIllumination;

    const editionText = getEditionDisplay(art, selectedSizeData);
    const selectedIsInStock = selectedSizeData?.availability === 'IN_STOCK';

    const handleAddToCartVariant = () => {
        if (!selectedSizeData) return;
        const isInStock = selectedSizeData.availability === 'IN_STOCK';
        const sizeDisplay = selectedSize.replace('"', ' inch');
        const addOnNames = [
            addCrystals && 'with crystals',
            addWoodFrame && 'with wood frame',
            addIllumination && 'illuminated',
        ].filter(Boolean) as string[];
        const displayTitle = addOnNames.length > 0
            ? `${art.title}, ${sizeDisplay}, ${addOnNames.join(', ')}`
            : `${art.title}, ${sizeDisplay}`;

        const addOnPriceIds: string[] = [];
        if (addCrystals) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.crystals[addOnTier].stripePriceId);
        if (addWoodFrame) addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.woodFrame[addOnTier].stripePriceId);
        if (addIllumination && illuminationTier !== 'none') {
            addOnPriceIds.push(MADE_TO_ORDER_ADD_ONS.illumination[illuminationTier].stripePriceId);
        }

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
    };

    if (variants.length === 0) return null;

    return (
        <div className="space-y-0">
            {/* Step indicator — only shown when there's a real size choice */}
            {variants.length > 1 && (
                <div className="flex items-center gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => setConfigStep(1)}
                        className={`font-label text-[11px] uppercase tracking-[0.18em] font-semibold transition-colors ${
                            configStep === 1 ? 'text-wood-900' : 'text-wood-500 hover:text-wood-700'
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
                            configStep === 2 ? 'text-wood-900' : 'text-wood-500 hover:text-wood-700'
                        }`}
                    >
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-[10px] ${
                            configStep === 2 ? 'bg-wood-900 text-paper-50' : 'bg-wood-200 text-wood-700'
                        }`}>2</span>
                        {hasAnyAddOn ? 'Options & buy' : 'Review & buy'}
                    </button>
                </div>
            )}

            {/* Step 1: size */}
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
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-wood-900" />}
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

            {/* Step 2: options + total + buy */}
            {configStep === 2 && (
                <>
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
                                        <input type="checkbox" checked={addCrystals} onChange={e => setAddCrystals(e.target.checked)} className="sr-only" />
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
                                        <input type="checkbox" checked={addWoodFrame} onChange={e => setAddWoodFrame(e.target.checked)} className="sr-only" />
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
                                        <input type="checkbox" checked={addIllumination} onChange={e => setAddIllumination(e.target.checked)} className="sr-only" />
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="border-t border-wood-200 pt-6 pb-6">
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

                    <p className="text-center font-sans text-[13px] text-wood-600 mt-4 leading-[1.55] max-w-[40ch] mx-auto">
                        Shipping handled separately based on destination. You'll receive shipping details and a separate invoice within 48 hours of purchase.
                    </p>

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
    );
};

export default PieceConfigurator;
