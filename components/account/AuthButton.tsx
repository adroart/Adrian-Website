import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import { signOut } from '../../lib/account/authClient';
import SignInTrigger from './SignInTrigger';

/**
 * Sign-in / account affordance in the site header. Signed out: a "Sign in"
 * button that opens the self-owned modal. Signed in: a small menu with a link
 * to the account area and sign out. Renders nothing when accounts are off.
 */
const AuthButton: React.FC = () => {
  const { available, isSignedIn, email } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!available) return null;

  if (!isSignedIn) {
    return (
      <div className="ar-auth-button">
        <SignInTrigger>
          <button type="button" className="ar-auth-button__signin">
            Sign in
          </button>
        </SignInTrigger>
        <style>{authButtonStyles}</style>
      </div>
    );
  }

  return (
    <div className="ar-auth-button">
      <button
        type="button"
        className="ar-auth-button__signin"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        Account
      </button>
      {menuOpen && (
        <div className="ar-auth-menu" onMouseLeave={() => setMenuOpen(false)}>
          {email && <p className="ar-auth-menu__email">{email}</p>}
          <Link to="/account" className="ar-auth-menu__item" onClick={() => setMenuOpen(false)}>
            Your account
          </Link>
          <Link to="/account/collections" className="ar-auth-menu__item" onClick={() => setMenuOpen(false)}>
            Collections
          </Link>
          <Link to="/account/orders" className="ar-auth-menu__item" onClick={() => setMenuOpen(false)}>
            Orders
          </Link>
          <button
            type="button"
            className="ar-auth-menu__item ar-auth-menu__signout"
            onClick={() => { setMenuOpen(false); signOut(); }}
          >
            Sign out
          </button>
        </div>
      )}
      <style>{authButtonStyles}</style>
    </div>
  );
};

const authButtonStyles = `
  .ar-auth-button { position: relative; display: inline-flex; align-items: center; }
  .ar-auth-button__signin {
    font-family: 'Lato', Helvetica, sans-serif;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-wood-800);
    background: transparent;
    border: 0;
    padding: 6px 4px;
    cursor: pointer;
    transition: color 0.2s;
  }
  .ar-auth-button__signin:hover { color: var(--color-bronze-600); }
  .ar-auth-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 50;
    width: 200px;
    background: var(--color-paper-50);
    border: 1px solid color-mix(in oklab, var(--color-wood-600) 22%, transparent);
    box-shadow: 0 8px 24px -10px rgba(0,0,0,0.18);
    padding: 6px;
  }
  .ar-auth-menu__email {
    font-family: 'Cormorant Garamond', serif;
    font-size: 13px;
    color: var(--color-wood-500);
    padding: 6px 8px;
    margin: 0 0 4px;
    border-bottom: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ar-auth-menu__item {
    display: block;
    width: 100%;
    text-align: left;
    font-family: 'Lato', Helvetica, sans-serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-wood-700);
    background: transparent;
    border: 0;
    padding: 8px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .ar-auth-menu__item:hover {
    background: color-mix(in oklab, var(--color-bronze-400) 10%, transparent);
    color: var(--color-bronze-700);
  }
  .ar-auth-menu__signout { color: var(--color-wood-400); }
`;

export default AuthButton;
