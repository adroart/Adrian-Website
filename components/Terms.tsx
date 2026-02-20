
import React from 'react';
import { Link } from 'react-router-dom';

const Terms: React.FC = () => {
  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="font-serif text-5xl text-wood-900 mb-12 font-medium">Terms of Service</h1>

        <div className="prose prose-lg font-serif text-wood-700 max-w-none">
          <p className="text-wood-500 text-sm mb-8">Last updated: February 2026</p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Overview</h2>
          <p>
            This website is operated by Adrian Rasmussen. By accessing or using this site, you agree to the following terms.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Purchases</h2>
          <p>
            All purchases are processed through Stripe. Prices are listed in USD. By completing a purchase, you agree to Stripe's terms of service. All sales are final unless otherwise agreed upon in writing.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Commissions</h2>
          <p>
            Commission inquiries submitted through the website do not constitute a binding agreement. Terms for commissioned work — including scope, timeline, and payment — are agreed upon separately via direct communication.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Shipping</h2>
          <p>
            Most pieces ship from Bali, Indonesia. Estimated delivery times are approximate and may vary based on customs and destination. The buyer is responsible for any import duties or taxes.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Intellectual Property</h2>
          <p>
            All images, text, and artwork on this site are the property of Adrian Rasmussen unless otherwise noted. You may not reproduce, distribute, or use any content without written permission.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Limitation of Liability</h2>
          <p>
            This website is provided "as is" without warranties of any kind. Adrian Rasmussen is not liable for any damages arising from your use of this site.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Contact</h2>
          <p>
            Questions about these terms can be directed to{' '}
            <a href="mailto:hello@adrianrasmussen.art" className="text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors">
              hello@adrianrasmussen.art
            </a>.
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-wood-200">
          <Link
            to="/"
            className="font-mono text-xs uppercase tracking-widest text-wood-500 hover:text-wood-900 transition-colors font-bold"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Terms;
