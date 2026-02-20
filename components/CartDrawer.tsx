
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '../CartContext';

const formatPrice = (price: number) => `$${price.toLocaleString('en-US')}`;

const CartDrawer: React.FC = () => {
    const { items, removeFromCart, updateQuantity, totalItems, totalPrice, isCartOpen, closeCart } = useCart();

    useEffect(() => {
        if (typeof document === 'undefined' || !document.body) return;
        document.body.style.overflow = isCartOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isCartOpen]);

    if (typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[3000] flex justify-end transition-all duration-500 ${isCartOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
            {/* Overlay */}
            <div
                className={`absolute inset-0 bg-wood-900/30 backdrop-blur-sm transition-opacity duration-500 ${isCartOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={closeCart}
            />

            {/* Drawer */}
            <div className={`relative w-full max-w-[480px] h-full bg-paper-50 border-l border-wood-200 shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="h-16 border-b border-wood-200 flex items-center justify-between px-6 bg-paper-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <ShoppingBag size={16} className="text-wood-600" />
                        <span className="font-mono text-xs uppercase tracking-widest text-wood-900 font-bold">
                            Cart
                        </span>
                        {totalItems > 0 && (
                            <span className="font-mono text-[10px] bg-wood-900 text-paper-50 px-2 py-0.5 rounded-full">
                                {totalItems}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={closeCart}
                        className="p-4 -mr-4 hover:bg-wood-100 rounded-full transition-colors group flex items-center gap-2"
                    >
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-500 font-bold hidden sm:inline">Close</span>
                        <X size={22} className="text-wood-900 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                {/* Content */}
                {items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
                        <ShoppingBag size={40} className="text-wood-200" />
                        <div>
                            <p className="font-serif text-2xl text-wood-400 mb-2">Your cart is empty.</p>
                            <p className="font-mono text-xs uppercase tracking-widest text-wood-300 font-bold">
                                Add pieces from the shop to begin.
                            </p>
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
                                        <h3 className="font-serif text-lg text-wood-900 leading-tight mb-1 font-medium truncate">
                                            {product.title}
                                        </h3>
                                        <p className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mb-3">
                                            {product.category}
                                            {product.material && <span className="text-wood-200"> · </span>}
                                            {product.material}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            {/* Quantity controls */}
                                            <div className="flex items-center border border-wood-200 h-8">
                                                <button
                                                    onClick={() => updateQuantity(product.id, -1)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-wood-100 transition-colors text-wood-600"
                                                    aria-label="Decrease quantity"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-8 text-center font-mono text-xs text-wood-900 font-bold">
                                                    {quantity}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(product.id, 1)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-wood-100 transition-colors text-wood-600"
                                                    aria-label="Increase quantity"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>

                                            <span className="font-mono text-sm text-wood-900 font-bold">
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
                                <span className="font-mono text-xs uppercase tracking-widest text-wood-500 font-bold">Subtotal</span>
                                <span className="font-mono text-xl text-wood-900 font-bold">{formatPrice(totalPrice)}</span>
                            </div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-wood-300 font-bold px-1 mb-5">
                                Shipping calculated at checkout
                            </p>

                            {items.length === 1 ? (
                                <a
                                    href={items[0].product.stripeUrl || 'https://buy.stripe.com/PLACEHOLDER'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-5 flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-[0.2em] transition-all duration-300 font-bold shadow-lg bg-wood-900 text-paper-50 hover:bg-bronze-700 hover:shadow-xl"
                                >
                                    Proceed to Purchase <ArrowRight size={16} />
                                </a>
                            ) : (
                                <div className="space-y-3">
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold text-center mb-4">
                                        Complete each piece separately
                                    </p>
                                    {items.map(({ product }) => (
                                        <a
                                            key={product.id}
                                            href={product.stripeUrl || 'https://buy.stripe.com/PLACEHOLDER'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-3 flex items-center justify-between gap-3 text-xs font-mono uppercase tracking-[0.15em] transition-all duration-300 font-bold border border-wood-300 px-4 text-wood-900 hover:bg-wood-900 hover:text-paper-50 hover:border-wood-900"
                                        >
                                            <span className="truncate">{product.title}</span>
                                            <span className="shrink-0 flex items-center gap-2">
                                                {formatPrice(product.price)} <ArrowRight size={12} />
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CartDrawer;
