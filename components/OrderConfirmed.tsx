
import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../CartContext';
import { useMetaTags } from '../hooks/useMetaTags';

const OrderConfirmed: React.FC = () => {
  const [searchParams] = useSearchParams();
  // Stored for future order lookup - not currently used in the UI
  const _sessionId = searchParams.get('session_id');

  const { clearCart } = useCart();

  useMetaTags({ title: 'Thank You' });

  useEffect(() => {
    clearCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
      <div className="max-w-2xl text-center">
        <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 block mb-8 font-semibold">
          Order Received
        </span>
        <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-8 font-medium leading-[1.05]">
          Thank you.
        </h1>
        <p className="font-serif text-xl md:text-2xl text-wood-600 mb-6 leading-[1.6] font-light">
          Your piece is being prepared with the same care it was created with. You'll receive an email confirmation shortly.
        </p>
        <p className="font-sans text-base text-wood-600 mb-6 leading-[1.7] max-w-xl mx-auto">
          Shipping is handled separately based on your destination. You'll receive shipping details and a separate invoice within 48 hours.
        </p>
        <p className="font-sans text-base text-wood-500 mb-12 leading-[1.7]">
          If you have any questions about your order, reach out at{' '}
          <a
            href="mailto:hello@adrianrasmussen.com"
            className="text-bronze-600 hover:text-bronze-500 transition-colors"
          >
            hello@adrianrasmussen.com
          </a>
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link
            to="/creations"
            className="inline-flex items-center gap-3 px-8 py-4 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
          >
            Continue Exploring <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default OrderConfirmed;
