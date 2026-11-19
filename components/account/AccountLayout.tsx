import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import { LAUNCH_FLAGS } from '../../launchFlags';

interface AccountLayoutProps {
  title: string;
  children: React.ReactNode;
}

export const MANDALA_PROFILE_URL = 'https://mandalacodes.com/profile';
export const MANDALA_PROFILE_HANDOFF = '/api/auth/handoff?next=%2Fprofile';

const NAV: Array<{ to: string; label: string }> = [
  { to: '/account', label: 'Overview' },
  { to: MANDALA_PROFILE_HANDOFF, label: 'Mandala profile' },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/collections', label: 'Collections' },
  ...(LAUNCH_FLAGS.livingLegacy
    ? [{ to: '/account/contributor-access', label: 'Contributor access' }]
    : []),
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
        <a href={MANDALA_PROFILE_URL} className="mt-3 inline-block text-bronze-700 underline">
          Open your Mandala profile
        </a>
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
          <ul className="flex flex-wrap gap-x-6 gap-y-1 md:block md:space-y-2">
            {NAV.map((item) => {
              const active =
                item.to === '/account'
                  ? location.pathname === '/account'
                  : location.pathname.startsWith(item.to);
              const className = [
                'flex min-h-11 items-center font-label text-label uppercase tracking-[0.22em] py-2 transition-colors',
                active ? 'text-bronze-600' : 'text-wood-700 hover:text-bronze-600',
              ].join(' ');
              return (
                <li key={item.to}>
                  {item.to === MANDALA_PROFILE_HANDOFF ? (
                    <a href={item.to} className={className}>{item.label}</a>
                  ) : (
                    <Link to={item.to} className={className}>{item.label}</Link>
                  )}
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
