import React, { useState } from 'react';
import {
  inspectInvitation,
  redeemInvitation,
  type InvitationInspection,
} from '../../../utils/artworkInvitations';

type InvitationDoorProps = {
  initialToken?: string;
  onRedeemed?: () => void;
};

function messageFor(error: unknown) {
  if (!(error instanceof Error)) return 'The invitation could not be opened.';
  if (error.message === 'invitation_recipient_mismatch') {
    return 'Sign in with the verified email address this invitation was sent to.';
  }
  if (error.message === 'invitation_used') return 'This invitation has already been used.';
  if (error.message === 'invitation_expired') return 'This invitation has expired.';
  if (error.message === 'invitation_revoked') return 'This invitation is no longer available.';
  if (error.message === 'piece_already_held') {
    return 'This piece already has a keeper. Its stewardship remains protected.';
  }
  return 'The invitation could not be opened.';
}

export const InvitationDoor: React.FC<InvitationDoorProps> = ({
  initialToken = '',
  onRedeemed,
}) => {
  const [token, setToken] = useState(initialToken);
  const [inspection, setInspection] = useState<InvitationInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inspect = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setInspection(await inspectInvitation(token));
    } catch (caught) {
      setInspection(null);
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setError('');
    try {
      await redeemInvitation(token);
      setToken('');
      setInspection((current) => current ? { ...current, status: 'used' } : current);
      onRedeemed?.();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-xl mx-auto border border-wood-200 bg-paper-50 px-6 py-8 md:px-9">
      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 mb-2">
        A private invitation
      </p>
      <h2 className="font-display text-3xl text-wood-900 mb-3">Open your piece</h2>
      <p className="font-serif text-lg leading-relaxed text-wood-600 mb-7">
        Use the invitation sent by Adrian, then sign in with the same verified email address.
      </p>

      <form onSubmit={inspect} className="space-y-3">
        <label htmlFor="artwork-invitation-token" className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block">
          Invitation token
        </label>
        <input
          id="artwork-invitation-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setInspection(null);
          }}
          required
          className="w-full border border-wood-300 bg-white px-3 py-2.5 font-sans text-sm text-wood-900 focus:outline-none focus:border-bronze-500"
        />
        <button
          type="submit"
          disabled={busy || !token}
          className="min-h-11 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Opening' : 'Open invitation'}
        </button>
      </form>

      {error && <p role="alert" className="font-sans text-sm text-red-700 mt-5">{error}</p>}

      {inspection && (
        <div className="border-t border-wood-200 mt-8 pt-7">
          <p className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">
            {inspection.artwork.artworkId} · {inspection.artwork.publicCode}
          </p>
          <h3 className="font-serif text-2xl text-wood-900 mt-1">{inspection.artwork.title}</h3>
          {inspection.status === 'available' ? (
            <button
              type="button"
              onClick={redeem}
              disabled={busy}
              className="mt-5 min-h-11 font-label text-[11px] uppercase tracking-[0.16em] text-paper-50 bg-bronze-700 px-5 py-2.5 hover:bg-bronze-800 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Registering' : 'Register as keeper'}
            </button>
          ) : (
            <p className="font-serif text-lg text-wood-600 mt-4">
              This invitation is {inspection.status}.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default InvitationDoor;
