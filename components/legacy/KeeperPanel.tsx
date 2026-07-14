import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '../../types';
import { LAUNCH_FLAGS } from '../../launchFlags';
import { useAccount } from '../../lib/account/useAccount';
import { isWellFormedRecoveryCode } from '../../utils/recoveryCode';
import IntentionRitual from './IntentionRitual';

/**
 * KeeperPanel is the legacy implementation name for the two steward doors:
 *   (a) "Register / certify this piece" is the universal door. Bind yourself as
 *       the steward with the permanent Ownership Code on the underside.
 *   (b) "Begin your intention" is the deep door, opened once the piece is yours.
 *
 * Nobody is pushed. A steward who only wants the certificate stops at (a). The
 * intention ritual (IntentionRitual) is offered, never forced.
 *
 * Gated behind the `livingLegacy` flag. When the visitor is not signed in, the
 * doors invite sign-in calmly rather than blocking. When the piece is already
 * kept by someone else, we say so plainly and do not contest (the patient
 * transfer process lives in mandalacodes).
 *
 * Design system: paper/wood/stone/bronze, Cormorant/Lato/Cinzel, middle dots,
 * no em dashes, no icons, no badges, nothing over the artwork.
 */

interface StewardStatus {
  kept: boolean;
  byYou: boolean;
  currentDisplayLocation?: string | null;
}

export const KeeperPanel: React.FC<{ artwork: Artwork; editionNumber?: number }> = ({
  artwork,
  editionNumber = 0,
}) => {
  const { isSignedIn, isLoaded, available, fetchAuthed } = useAccount();
  const [status, setStatus] = useState<StewardStatus | null>(null);
  const [door, setDoor] = useState<'closed' | 'register' | 'intention'>('closed');

  const loadStatus = React.useCallback(async () => {
    if (!isSignedIn) {
      setStatus(null);
      return;
    }
    const params = new URLSearchParams({ pieceId: artwork.id, editionNumber: String(editionNumber) });
    const res = await fetchAuthed(`/api/keeper/piece?${params.toString()}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      setStatus({ kept: data.kept, byYou: data.byYou, currentDisplayLocation: data.currentDisplayLocation });
    }
  }, [isSignedIn, artwork.id, editionNumber, fetchAuthed]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void loadStatus();
  }, [isLoaded, isSignedIn, loadStatus]);

  if (!LAUNCH_FLAGS.livingLegacy || !available) return null;

  const youKeep = status?.byYou ?? false;
  const keptByOther = (status?.kept ?? false) && !youKeep;

  return (
    <section className="mt-20 print:hidden">
      <div className="flex items-center justify-center gap-4 mb-12">
        <div className="h-px w-12 bg-bronze-300" />
        <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
        <div className="h-px w-12 bg-bronze-300" />
      </div>

      {/* Not signed in: a calm invitation, never a wall. */}
      {!isSignedIn && (
        <div className="max-w-md mx-auto text-center">
          <p className="font-serif text-[17px] text-wood-700 leading-[1.9] mb-6">
            If you hold this piece, you can register as its steward and, when you wish, fuse a
            yearly intention into it.
          </p>
          <Link
            to="/account"
            className="inline-flex items-center gap-3 px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
          >
            Sign in to begin
          </Link>
        </div>
      )}

      {/* Signed in, not yet the steward, free to claim. */}
      {isSignedIn && !youKeep && !keptByOther && (
        <div className="max-w-lg mx-auto">
          {door !== 'register' ? (
            <div className="grid sm:grid-cols-2 gap-5">
              <DoorCard
                title="Register this piece"
                body="Register as its steward with the Ownership Code on the underside of the art."
                cta="Register as the steward"
                onClick={() => setDoor('register')}
              />
              <DoorCard
                title="Begin your intention"
                body="The deeper door. Set a yearly intention into the piece around your birthday. Opens once you are its steward."
                cta="About this"
                muted
                onClick={() => setDoor('register')}
              />
            </div>
          ) : (
            <RegisterForm
              artwork={artwork}
              editionNumber={editionNumber}
              onBound={async () => {
                await loadStatus();
                setDoor('intention');
              }}
              onCancel={() => setDoor('closed')}
            />
          )}
        </div>
      )}

      {/* Already kept by someone else. */}
      {keptByOther && (
        <p className="max-w-md mx-auto text-center font-serif text-[16px] text-wood-600 leading-[1.9]">
          This piece already has a steward. A transfer of stewardship moves through a
          separate, patient process.
        </p>
      )}

      {/* You are the steward. */}
      {youKeep && (
        <div className="max-w-xl mx-auto">
          <p className="text-center font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold mb-10">
            You are the current steward
          </p>

          <DisplayLocation
            artwork={artwork}
            editionNumber={editionNumber}
            current={status?.currentDisplayLocation ?? null}
            onSaved={loadStatus}
          />

          <div className="mt-16">
            <IntentionRitual pieceId={artwork.id} editionNumber={editionNumber} />
          </div>
        </div>
      )}
    </section>
  );
};

// ── A door tile ──

function DoorCard({
  title,
  body,
  cta,
  onClick,
  muted,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <div className="border border-wood-200 p-6 flex flex-col text-center">
      <h3 className="font-serif text-xl text-wood-900 mb-3">{title}</h3>
      <p className="font-sans text-[13px] text-wood-500 leading-[1.8] mb-6 flex-1">{body}</p>
      <button
        onClick={onClick}
        className={`font-label text-[11px] uppercase tracking-[0.15em] font-semibold pb-1 border-b transition-colors ${
          muted
            ? 'text-wood-400 border-wood-200 hover:text-bronze-700 hover:border-bronze-300'
            : 'text-bronze-600 border-bronze-300 hover:text-bronze-800'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

// ── The Ownership Code bind form ──

function RegisterForm({
  artwork,
  editionNumber,
  onBound,
  onCancel,
}: {
  artwork: Artwork;
  editionNumber: number;
  onBound: () => void;
  onCancel: () => void;
}) {
  const { fetchAuthed } = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wellFormed = isWellFormedRecoveryCode(code);

  const submit = async () => {
    setError(null);
    if (!wellFormed) {
      setError('That Ownership Code does not look complete. Check the underside of the piece.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetchAuthed('/api/keeper/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode: code, pieceId: artwork.id, editionNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'That Ownership Code did not bind this piece. Please check it and try again.');
        return;
      }
      onBound();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <h3 className="font-serif text-2xl text-wood-900 mb-3">Register {artwork.title}</h3>
      <p className="font-sans text-[14px] text-wood-500 leading-[1.8] mb-8">
        Enter the Ownership Code engraved on the underside of the art. It is not the public QR number.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 24))}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        spellCheck={false}
        autoComplete="off"
        className="w-full bg-paper-50 border border-wood-200 px-4 py-3 font-label text-[16px] tracking-[0.2em] text-center text-wood-800 uppercase focus:outline-none focus:border-bronze-400 transition-colors"
      />
      {error && <p className="font-sans text-[13px] text-bronze-700 mt-4 leading-[1.7]">{error}</p>}
      <div className="flex items-center justify-center gap-6 mt-8">
        <button
          onClick={onCancel}
          className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 font-semibold hover:text-wood-600 transition-colors"
        >
          Not now
        </button>
        <button
          onClick={submit}
          disabled={busy || !code.trim()}
          className="px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors disabled:opacity-40"
        >
          {busy ? 'Binding' : 'Register'}
        </button>
      </div>
    </div>
  );
}

// Current display location, editable by the steward.

function DisplayLocation({
  artwork,
  editionNumber,
  current,
  onSaved,
}: {
  artwork: Artwork;
  editionNumber: number;
  current: string | null;
  onSaved: () => void;
}) {
  const { fetchAuthed } = useAccount();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(current ?? ''), [current]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetchAuthed('/api/keeper/piece', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceId: artwork.id,
          editionNumber,
          currentDisplayLocation: value.trim(),
        }),
      });
      if (res.ok) {
        setEditing(false);
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-center">
      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-3">
        Where it lives now
      </p>
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="font-serif text-[17px] text-wood-700 italic border-b border-transparent hover:border-bronze-300 transition-colors"
        >
          {current || 'Add where this piece currently rests'}
        </button>
      ) : (
        <div className="max-w-sm mx-auto">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 200))}
            placeholder="A room, a city, a sanctuary"
            className="w-full bg-paper-50 border border-wood-200 px-4 py-2.5 font-serif text-[16px] text-wood-700 text-center focus:outline-none focus:border-bronze-400 transition-colors"
          />
          <div className="flex items-center justify-center gap-5 mt-4">
            <button
              onClick={() => setEditing(false)}
              className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-600 font-semibold border-b border-bronze-300 pb-1 disabled:opacity-40"
            >
              {busy ? 'Saving' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KeeperPanel;
