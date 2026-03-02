
import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="font-serif text-5xl text-wood-900 mb-12 font-medium">Privacy Policy</h1>

        <div className="prose prose-lg font-serif text-wood-700 max-w-none">
          <p className="text-wood-500 text-sm mb-8">Last updated: March 2026</p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Information We Collect</h2>
          <p>
            When you use this website, we may collect information you provide directly, such as your name and email address when submitting the inquiry form or subscribing to the newsletter.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">How We Use Your Information</h2>
          <p>We use the information you provide to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Respond to commission inquiries</li>
            <li>Send newsletter updates (only if you subscribe)</li>
            <li>Process purchases through Stripe</li>
          </ul>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Third-Party Services</h2>
          <p>
            This site uses Resend for inquiry form delivery, Kit (ConvertKit) for newsletter subscriptions, Stripe for payment processing, and Cloudflare for hosting. Each service has its own privacy policy governing the data they process on our behalf.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Cookies</h2>
          <p>
            This site uses minimal cookies necessary for functionality. We do not use tracking cookies or third-party analytics.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data at any time by contacting us at{' '}
            <a href="mailto:hello@adrianrasmussen.com" className="text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors">
              hello@adrianrasmussen.com
            </a>.
          </p>

          <h2 className="font-serif text-2xl text-wood-900 mt-12 mb-4 font-medium">Contact</h2>
          <p>
            For any privacy-related questions, reach out to{' '}
            <a href="mailto:hello@adrianrasmussen.com" className="text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors">
              hello@adrianrasmussen.com
            </a>.
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-wood-200">
          <Link
            to="/"
            className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 transition-colors font-semibold"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PrivacyPolicy;
