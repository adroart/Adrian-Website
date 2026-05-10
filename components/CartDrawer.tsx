
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, ArrowRight, Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart, getMaxQuantity } from '../CartContext';
import { formatPrice } from '../utils/formatPrice';

// Validate that a URL is a legitimate Stripe checkout URL before redirecting
function isValidStripeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' &&
            (parsed.hostname === 'checkout.stripe.com' || parsed.hostname.endsWith('.stripe.com'));
    } catch {
        return false;
    }
}

function isValidStripePaymentLink(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname === 'buy.stripe.com';
    } catch {
        return false;
    }
}

async function startCheckout(
    items: Array<{ stripePriceId?: string; stripeUrl?: string; addOnPriceIds?: string[]; quantity: number; title: string }>
): Promise<void> {
    // If every item (and its add-ons) has a real Stripe Price ID, use the Checkout Session API
    const allHavePriceId = items.every(
        (i) =>
            i.stripePriceId &&
            i.stripePriceId.startsWith('price_') &&
            (!i.addOnPriceIds || i.addOnPriceIds.every((id) => id.startsWith('price_')))
    );

    if (allHavePriceId) {
        // Expand each cart item into its constituent Stripe line items
        // Made-to-order add-ons become separate line items (each multiplied by item quantity)
        const lineItems: Array<{ stripePriceId: string; quantity: number }> = [];

        for (const item of items) {
            lineItems.push({ stripePriceId: item.stripePriceId!, quantity: item.quantity });
            if (item.addOnPriceIds) {
                for (const addOnId of item.addOnPriceIds) {
                    lineItems.push({ stripePriceId: addOnId, quantity: item.quantity });
                }
            }
        }

        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: lineItems }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Checkout failed');
        if (!data.url || !isValidStripeUrl(data.url)) {
            throw new Error('Received an invalid checkout URL. Please try again or contact the studio.');
        }
        // Fire conversion event - Cloudflare Analytics compatible
        try {
            if (typeof window !== 'undefined') {
                const zaraz = (window as unknown as { zaraz?: { track: (event: string, props: Record<string, unknown>) => void } }).zaraz;
                zaraz?.track('purchase_initiated', {
                    item_count: items.length,
                    value: items.reduce((sum, i) => sum + i.quantity, 0),
                });
            }
        } catch {}
        window.location.href = data.url;
        return;
    }

    // Fallback: open individual Stripe Payment Links for items that have them
    const itemsWithLinks = items.filter(
        (i) => i.stripeUrl && i.stripeUrl !== 'https://buy.stripe.com/PLACEHOLDER' && isValidStripePaymentLink(i.stripeUrl!)
    );
    if (itemsWithLinks.length > 0) {
        for (const item of itemsWithLinks) {
            window.open(item.stripeUrl, '_blank', 'noopener,noreferrer');
        }
        return;
    }

    // No valid Stripe IDs or payment links - surface a clear error
    throw new Error('Checkout is not yet configured for these pieces. Please contact the studio.');
}

const CartDrawer: React.FC = () => {
    const { items, removeFromCart, updateQuantity, totalItems, totalPrice, isCartOpen, closeCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const drawerRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef(0);

    useEffect(() => {
        if (typeof document === 'undefined' || !document.body) return;
        document.body.style.overflow = isCartOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isCartOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isCartOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeCart();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isCartOpen, closeCart]);

    // Trap focus within drawer when open
    useEffect(() => {
        if (!isCartOpen || !drawerRef.current) return;
        const drawer = drawerRef.current;
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const focusable = drawer.querySelectorAll<HTMLElement>(focusableSelector);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleTab);
        return () => document.removeEventListener('keydown', handleTab);
    }, [isCartOpen]);

    // Reset swipe offset when cart closes
    useEffect(() => {
        if (!isCartOpen) setSwipeOffset(0);
    }, [isCartOpen]);

    // Clear error when cart closes or items change
    useEffect(() => { setError(null); }, [isCartOpen, items.length]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = e.touches[0].clientX;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const diff = e.touches[0].clientX - touchStartRef.current;
        if (diff > 0) setSwipeOffset(Math.min(diff, 120));
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (swipeOffset > 80) {
            closeCart();
        }
        setSwipeOffset(0);
    }, [swipeOffset, closeCart]);

    // Duplicate Escape handler removed - already handled in useEffect above

    const handleCheckout = async () => {
        setLoading(true);
        setError(null);
        try {
            await startCheckout(
                items.map(({ product, quantity }) => ({
                    stripePriceId: product.stripePriceId,
                    stripeUrl: product.stripeUrl,
                    addOnPriceIds: product.addOnPriceIds,
                    quantity,
                    title: product.title,
                }))
            );
            // Dispatch custom event for any analytics listeners
            window.dispatchEvent(new CustomEvent('checkout_initiated', {
                detail: { itemCount: items.length, totalPrice }
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[3000] flex justify-end transition-all duration-500 ${isCartOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
            {/* Overlay */}
            <div
                className={`absolute inset-0 bg-wood-900/30 backdrop-blur-sm transition-opacity duration-500 dark-overlay ${isCartOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={closeCart}
            />

            {/* Drawer */}
            <div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Shopping cart"
                className={`relative w-full max-w-[480px] h-full bg-paper-50 border-l border-wood-200 shadow-2xl flex flex-col ${swipeOffset === 0 ? 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''} ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}
                style={isCartOpen && swipeOffset > 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}>

                {/* Header */}
                <div className="h-16 border-b border-wood-200 flex items-center justify-between px-6 bg-paper-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <ShoppingBag size={16} className="text-wood-600" />
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 font-semibold">
                            Cart
                        </span>
                        {totalItems > 0 && (
                            <span className="font-label text-[11px] bg-wood-900 text-paper-50 px-2 py-0.5 rounded-full">
                                {totalItems}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={closeCart}
                        className="p-4 -mr-4 hover:bg-wood-100 rounded-full transition-colors group flex items-center gap-2"
                    >
                        <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold hidden sm:inline">Close</span>
                        <X size={22} className="text-wood-900 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                {/* Content */}
                {items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
                        <div>
                            <p className="font-serif text-2xl text-wood-600 mb-3">Nothing here yet.</p>
                            <Link
                                to="/creations"
                                onClick={closeCart}
                                className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 font-semibold transition-colors"
                            >
                                Explore the creations
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar">
                            {items.map(({ product, quantity }) => (
                                <div key={product.id} className="flex gap-4">
                                    {/* Thumbnail */}
                                    <div className="w-20 h-20 shrink-0 bg-wood-100 border border-wood-200 overflow-hidden">
                                        <img
                                            src={product.image}
                                            alt={`${product.title} by Adrian Rasmussen`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-sans text-base text-wood-900 leading-snug mb-1 font-medium">
                                            {product.title}
                                        </h3>
                                        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
                                            {product.isReadyToShip ? (
                                                <span className="text-avail-ready">Ready to ship</span>
                                            ) : (
                                                <span className="text-avail-order">Made to order</span>
                                            )}
                                            {product.material && (
                                                <><span className="text-wood-200"> · </span>{product.material}</>
                                            )}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            {getMaxQuantity(product) === 1 ? (
                                                <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600 font-semibold">
                                                    One of one
                                                </span>
                                            ) : (
                                                <div className="flex items-center border border-wood-200 h-11">
                                                    <button
                                                        onClick={() =>
                                                            quantity === 1
                                                                ? removeFromCart(product.id)
                                                                : updateQuantity(product.id, -1)
                                                        }
                                                        className="w-11 h-11 flex items-center justify-center hover:bg-wood-100 transition-colors text-wood-600"
                                                        aria-label={quantity === 1 ? 'Remove piece' : 'Decrease quantity'}
                                                    >
                                                        {quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                                                    </button>
                                                    <span className="w-8 text-center font-label text-xs text-wood-900 font-semibold">
                                                        {quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(product.id, 1)}
                                                        className="w-11 h-11 flex items-center justify-center hover:bg-wood-100 transition-colors text-wood-600"
                                                        aria-label="Increase quantity"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            )}

                                            <span className="font-label text-sm text-wood-900 font-semibold">
                                                {formatPrice(product.price * quantity)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Remove */}
                                    <button
                                        onClick={() => removeFromCart(product.id)}
                                        className="self-start p-1 text-wood-300 hover:text-wood-700 transition-colors mt-0.5"
                                        aria-label="Remove from cart"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-wood-200 p-6 bg-paper-50 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center justify-between mb-1 px-1">
                                <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-700 font-semibold">Subtotal</span>
                                <span className="font-label text-xl text-wood-900 font-semibold">{formatPrice(totalPrice)}</span>
                            </div>
                            <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold px-1 mb-5">
                                Shipping calculated at checkout
                            </p>

                            {error && (
                                <p className="font-label text-[11px] text-red-600 uppercase tracking-[0.2em] font-semibold px-1 mb-4">
                                    {error}
                                </p>
                            )}

                            <button
                                onClick={handleCheckout}
                                disabled={loading}
                                className="w-full py-5 flex items-center justify-center gap-3 text-xs font-label uppercase tracking-[0.2em] transition-all duration-300 font-semibold shadow-lg bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <><Loader2 size={16} className="animate-spin" /> Redirecting...</>
                                ) : (
                                    <>Proceed to Purchase <ArrowRight size={16} /></>
                                )}
                            </button>

                            <button
                                onClick={closeCart}
                                className="w-full mt-3 py-2 font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 transition-colors font-semibold"
                            >
                                Continue browsing
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CartDrawer;
