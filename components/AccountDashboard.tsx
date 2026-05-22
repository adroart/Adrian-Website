import React from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from './account/AccountLayout';
import { useAccount } from '../lib/account/useAccount';

const AccountDashboard: React.FC = () => {
  const { email } = useAccount();

  return (
    <AccountLayout title="Your account">
      {email && (
        <p className="font-serif text-wood-700 mb-8">
          Signed in as <span className="text-wood-900">{email}</span>.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <Link
          to="/oracle/profile"
          className="block p-6 border border-wood-200 rounded hover:border-bronze-500/60 transition-colors"
        >
          <div className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-600 mb-3">
            Hologenetic Profile
          </div>
          <div className="font-display text-xl text-wood-900 mb-1">
            Your birth chart
          </div>
          <p className="font-serif text-sm text-wood-700">
            Enter your birth data once and your eleven positions follow you
            through every reading.
          </p>
        </Link>

        <Link
          to="/account/orders"
          className="block p-6 border border-wood-200 rounded hover:border-bronze-500/60 transition-colors"
        >
          <div className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-600 mb-3">
            Orders
          </div>
          <div className="font-display text-xl text-wood-900 mb-1">
            Past purchases
          </div>
          <p className="font-serif text-sm text-wood-700">
            Review what you have acquired and link to receipts.
          </p>
        </Link>

        <Link
          to="/account/collections"
          className="block p-6 border border-wood-200 rounded hover:border-bronze-500/60 transition-colors sm:col-span-2"
        >
          <div className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-600 mb-3">
            Collections
          </div>
          <div className="font-display text-xl text-wood-900 mb-1">
            Saved pieces and cards
          </div>
          <p className="font-serif text-sm text-wood-700">
            Gather oracle cards, artworks, and products into named groupings.
          </p>
        </Link>
      </div>
    </AccountLayout>
  );
};

export default AccountDashboard;
