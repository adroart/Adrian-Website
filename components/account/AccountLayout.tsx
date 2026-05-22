import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import { LAUNCH_FLAGS } from '../../launchFlags';

interface AccountLayoutProps {
  title: string;
  children: React.ReactNode;
}

const NAV: Array<{ to: string; label: string }> = [
  { to: '/account', label: 'Overview' },
  { to: '/oracle/profile', label: 'Profile' },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/collections', label: 'Collections' },
];

/**
 * Shared chrome for every /account/* page. Redirects guests to home when
 * accounts are unavailable (Clerk not configured or flag off); shows a
 * brief sign-in prompt when signed out but configured.
 */
const AccountLayout: React.FC<AccountLayoutProps> = ({ title, children }) => {
  const location = useLocation();
  const { available, isLoaded, isSignedIn } = useAccount();

  if (!available && !LAUNCH_FLAGS.accounts) {
    return <Navigate to="/" replace />;
  }

  if (!isLoaded) {
    return <div className="min-h-screen" aria-hidden="true" />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-6 max-w-xl mx-auto">
        <h1 className="font-display text-3xl text-wood-900 mb-3">{title}</h1>
        <p className="font-serif text-wood-700">
          Please sign in to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-24 px-6 max-w-5xl mx-auto">
      <header className="mb-10">
        <h1 className="font-display text-3xl text-wood-900">{title}</h1>
      </header>
      <div className="grid md:grid-cols-[180px_1fr] gap-10">
        <nav aria-label="Account">
          <ul className="space-y-2">
            {NAV.map((item) => {
              const active =
                item.to === '/account'
                  ? location.pathname === '/account'
                  : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={[
                      'block font-label text-[11px] uppercase tracking-[0.22em] py-2 transition-colors',
                      active ? 'text-bronze-600' : 'text-wood-700 hover:text-bronze-600',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <section>{children}</section>
      </div>
    </div>
  );
};

export default AccountLayout;
