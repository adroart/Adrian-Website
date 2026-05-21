import React from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { useAccount } from '../../lib/account/useAccount';

/**
 * Sign-in / user-menu affordance shown in the site header. When accounts
 * are not provisioned (no Clerk key or launch flag off), this renders
 * nothing so the header is unchanged from the guest experience.
 */
const AuthButton: React.FC = () => {
  const { available } = useAccount();
  if (!available) return null;

  return (
    <div className="ar-auth-button">
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="ar-auth-button__signin">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { userButtonAvatarBox: { width: 28, height: 28 } } }}
        />
      </SignedIn>
      <style>{`
        .ar-auth-button {
          display: inline-flex;
          align-items: center;
        }
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
        .ar-auth-button__signin:hover {
          color: var(--color-bronze-600);
        }
      `}</style>
    </div>
  );
};

export default AuthButton;
