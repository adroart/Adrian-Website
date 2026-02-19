
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Product, Artwork } from '../types';
import { Trash2, ArrowLeft, ArrowRight, CreditCard, ShieldCheck, ShoppingBag } from 'lucide-react';

interface CartProps {
  items: (Product | Artwork)[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

const Cart: React.FC<CartProps> = ({ items, onRemove, onClear }) => {
  const navigate = useNavigate();
  const [checkoutStep, setCheckoutStep] = useState<'REVIEW' | 'PROCESSING' | 'SUCCESS'>('REVIEW');

  const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const shipping = subtotal > 0 ? 50 : 0;
  const total = subtotal + shipping;

  const handleCheckout = () => {
    setCheckoutStep('PROCESSING');
    setTimeout(() => {
      setCheckoutStep('SUCCESS');
      onClear();
    }, 2500);
  };

  if (checkoutStep === 'SUCCESS') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-paper-50 animate-fade-in text-center">
        <div className="w-24 h-24 bg-bronze-50 border border-bronze-200 rounded-full flex items-center justify-center mb-8">
          <ShieldCheck size={48} className="text-bronze-600" />
        </div>
        <h1 className="text-4xl md:text-5xl font-serif text-wood-900 mb-4 font-medium">Acquisition Successful</h1>
        <p className="font-serif text-xl text-wood-600 max-w-md mb-12">
          Your selected pieces are being prepared for transit. A confirmation has been sent to your email.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-10 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-widest hover:bg-bronze-600 transition-colors font-bold"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  return (
    <section className="pt-32 pb-20 min-h-screen bg-paper-50 selection:bg-bronze-200">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4 text-bronze-600">
              <ShoppingBag size={20} />
              <span className="font-mono text-xs uppercase tracking-widest font-bold">Your Selection</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-wood-900 font-medium">Selected Works</h1>
          </div>
          <Link
            to="/shop"
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-wood-500 hover:text-wood-900 transition-colors font-bold border-b border-wood-200 pb-1"
          >
            <ArrowLeft size={14} /> Continue Exploring
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center border border-dashed border-wood-200 bg-white/50">
            <ShoppingBag size={48} className="text-wood-200 mb-6" />
            <p className="font-serif text-2xl text-wood-400 mb-8">No pieces selected.</p>
            <Link
              to="/shop"
              className="px-8 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-widest hover:bg-bronze-600 transition-all font-bold"
            >
              Browse Works
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">

            {/* List */}
            <div className="lg:col-span-2 space-y-8">
              {items.map((item, idx) => {
                const isArt = 'coverImage' in item;
                const image = isArt ? (item as Artwork).coverImage : (item as Product).image;

                return (
                  <div key={`${item.id}-${idx}`} className="group flex flex-col sm:flex-row gap-6 p-6 bg-white border border-wood-100 hover:border-bronze-200 transition-all shadow-sm">
                    <div className="w-full sm:w-32 h-32 bg-wood-50 overflow-hidden shrink-0">
                      <img src={image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt={item.title} />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-serif text-2xl text-wood-900 leading-tight font-medium">{item.title}</h3>
                          <span className="font-mono text-lg text-wood-900 font-bold">${item.price}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 font-bold">{item.category}</span>
                          <span className="text-wood-200 text-xs">•</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">Ref: {item.id}</span>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => onRemove(idx)}
                          className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-wood-400 hover:text-red-600 transition-colors font-bold"
                        >
                          <Trash2 size={12} /> Remove Piece
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-8 border-t border-wood-200 flex justify-between items-center text-wood-400 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">
                 <span>Pieces: {String(items.length).padStart(2, '0')}</span>
                 <div className="h-px flex-1 mx-8 bg-wood-100"></div>
                 <span>Studio Inventory</span>
              </div>
            </div>

            {/* Checkout Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-wood-200 p-8 shadow-xl sticky top-32">
                <h2 className="font-serif text-2xl text-wood-900 mb-8 border-b border-wood-100 pb-4">Summary</h2>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between font-mono text-xs uppercase tracking-widest text-wood-600 font-bold">
                    <span>Subtotal</span>
                    <span>${subtotal}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs uppercase tracking-widest text-wood-600 font-bold">
                    <span>Shipping</span>
                    <span>${shipping}</span>
                  </div>
                  <div className="pt-4 border-t border-wood-200 flex justify-between font-mono text-lg text-wood-900 font-bold">
                    <span>Total</span>
                    <span>${total}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3 p-4 bg-wood-50 border border-wood-100">
                    <ShieldCheck className="text-bronze-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] font-mono text-wood-500 leading-relaxed uppercase tracking-widest font-bold">
                      Hand-packed and insured shipping from the studio.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutStep === 'PROCESSING'}
                  className={`w-full py-5 flex items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] transition-all font-bold shadow-lg ${
                    checkoutStep === 'PROCESSING'
                    ? 'bg-wood-200 text-wood-400 cursor-wait'
                    : 'bg-wood-900 text-paper-50 hover:bg-bronze-700 shadow-xl'
                  }`}
                >
                  {checkoutStep === 'PROCESSING' ? (
                    <span className="animate-pulse">Finalizing...</span>
                  ) : (
                    <>
                      Complete Acquisition <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="mt-6 text-center">
                   <div className="flex items-center justify-center gap-4 text-wood-300">
                      <CreditCard size={18} />
                      <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Secure Protocol</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

export default Cart;
