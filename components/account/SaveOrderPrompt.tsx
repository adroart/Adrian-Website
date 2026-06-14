import React, { useEffect, useState } from 'react';
import { useAccount } from '../../lib/account/useAccount';
import SignInTrigger from './SignInTrigger';

interface Props {
  sessionId: string | null;
}

/**
 * Shown on /order-confirmed when the visitor finishes checkout. For guests
 * it offers a one-tap sign-up so the order links to an account. For
 * already-signed-in users it confirms the order is saved and links to
 * the orders page.
 */
const SaveOrderPrompt: React.FC<Props> = ({ sessionId }) => {
  const account = useAccount();
  const [claimState, setClaimState] = useState<'idle' | 'claiming' | 'done' | 'error'>('idle');

  // Claim the order once the user is signed in.
  useEffect(() => {
    if (!account.available || !account.isSignedIn || !sessionId || claimState !== 'idle') return;
    setClaimState('claiming');
    account
      .fetchAuthed('/api/orders/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeSessionId: sessionId }),
      })
      .then((r) => setClaimState(r.ok ? 'done' : 'error'))
      .catch(() => setClaimState('error'));
  }, [account, sessionId, claimState]);

  if (!account.available || !sessionId) return null;

  return (
    <div className="save-order-prompt">
      {!account.isSignedIn ? (
        <>
          <p className="save-order-prompt__copy">
            Save this order to an account so you can find it later and re-order easily.
          </p>
          <SignInTrigger>
            <button type="button" className="save-order-prompt__cta">
              Save to my account
            </button>
          </SignInTrigger>
        </>
      ) : claimState === 'done' ? (
        <p className="save-order-prompt__copy">
          Your order is saved. <a href="/account/orders" className="save-order-prompt__link">View all orders</a>.
        </p>
      ) : claimState === 'error' ? (
        <p className="save-order-prompt__copy">
          We could not attach this order automatically. <a href="/account/orders" className="save-order-prompt__link">View your orders</a>.
        </p>
      ) : (
        <p className="save-order-prompt__copy">Saving your order…</p>
      )}

      <style>{`
        .save-order-prompt {
          margin-top: 32px;
          padding: 18px 20px;
          background: color-mix(in oklab, var(--color-paper-100) 80%, transparent);
          border: 1px solid color-mix(in oklab, var(--color-bronze-600) 25%, transparent);
          border-radius: 4px;
        }
        .save-order-prompt__copy {
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px;
          color: var(--color-wood-800);
          margin: 0 0 12px;
        }
        .save-order-prompt__cta {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-paper-50);
          background: var(--color-bronze-600);
          border: 0;
          border-radius: 3px;
          padding: 10px 16px;
          cursor: pointer;
        }
        .save-order-prompt__cta:hover {
          background: var(--color-bronze-700, var(--color-bronze-600));
        }
        .save-order-prompt__link {
          color: var(--color-bronze-600);
        }
      `}</style>
    </div>
  );
};

export default SaveOrderPrompt;
