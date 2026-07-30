import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LAUNCH_FLAGS } from '../../launchFlags';
import { useAccount } from '../../lib/account/useAccount';
import { isWellFormedRecoveryCode } from '../../utils/recoveryCode';
import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import SignInTrigger from '../account/SignInTrigger';
import IntentionRitual from './IntentionRitual';

interface StewardStatus {
  kept: boolean;
  byYou: boolean;
  currentDisplayLocation?: string | null;
}

type BindPayload = {
  ok?: boolean;
  status?: string;
  message?: string;
  claim?: { outcome?: string };
};

export type StewardBindResult =
  | { kind: 'bound' }
  | { kind: 'pending'; message: string }
  | { kind: 'error'; message: string };

export function stewardClaimDestination(
  identity: Readonly<Pick<PublicPlateIdentity, 'artworkId' | 'publicCode'>>,
): string {
  const query = new URLSearchParams({
    instance: identity.publicCode,
    ref: 'qr',
    claim: '1',
  });
  return `/works/${encodeURIComponent(identity.artworkId)}?${query.toString()}`;
}

export function classifyStewardBindResult(status: number, payload: BindPayload): StewardBindResult {
  if (status === 202 && payload.status === 'claim_requested') {
    return {
      kind: 'pending',
      message: payload.message || 'Your stewardship request is recorded for manual review.',
    };
  }
  if (status >= 200 && status < 300 && payload.ok === true) return { kind: 'bound' };
  return {
    kind: 'error',
    message: payload.message || 'That Ownership Code did not register this piece. Check it and try again.',
  };
}

export const KeeperPanel: React.FC<{ publicIdentity: PublicPlateIdentity }> = ({ publicIdentity }) => {
  const { isSignedIn, isLoaded, available, fetchAuthed } = useAccount();
  const [searchParams] = useSearchParams();
  const publicCode = publicIdentity.publicCode;
  const [status, setStatus] = useState<StewardStatus | null>(null);
  const [statusPublicCode, setStatusPublicCode] = useState(publicCode);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [door, setDoor] = useState<'closed' | 'register' | 'intention'>('closed');
  const statusRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const statusRequestId = useRef(0);
  const claimReturn = searchParams.get('claim') === '1';

  const loadStatus = React.useCallback(async () => {
    statusRequest.current?.controller.abort();
    const controller = new AbortController();
    const id = ++statusRequestId.current;
    statusRequest.current = { id, controller };
    setStatusPublicCode(publicCode);
    setStatus(null);
    setStatusLoaded(false);
    setStatusError(false);

    if (!isSignedIn) {
      return;
    }
    const params = new URLSearchParams({ publicCode });
    const response = await fetchAuthed(`/api/keeper/piece?${params.toString()}`, {
      signal: controller.signal,
    }).catch(() => null);
    if (controller.signal.aborted || statusRequest.current?.id !== id) return;
    if (!response?.ok) {
      setStatusError(true);
      setStatusLoaded(false);
      return;
    }
    const data = await response.json().catch(() => null);
    if (controller.signal.aborted || statusRequest.current?.id !== id) return;
    if (!data) {
      setStatusError(true);
      return;
    }
    setStatus({
      kept: data.kept === true,
      byYou: data.byYou === true,
      currentDisplayLocation: data.currentDisplayLocation,
    });
    setStatusLoaded(true);
  }, [fetchAuthed, isSignedIn, publicCode]);

  useEffect(() => {
    statusRequest.current?.controller.abort();
    setStatusPublicCode(publicCode);
    setStatus(null);
    setStatusLoaded(false);
    setStatusError(false);
    setDoor(isSignedIn && claimReturn ? 'register' : 'closed');
    if (isLoaded && isSignedIn) void loadStatus();
    return () => statusRequest.current?.controller.abort();
  }, [claimReturn, isLoaded, isSignedIn, loadStatus, publicCode]);

  if (!LAUNCH_FLAGS.livingLegacy || !available) return null;

  const statusMatches = statusPublicCode === publicCode;
  const currentStatus = statusMatches ? status : null;
  const currentStatusLoaded = statusMatches && statusLoaded;
  const currentStatusError = statusMatches && statusError;
  const youKeep = currentStatusLoaded && currentStatus?.byYou === true;
  const keptByOther = currentStatusLoaded && currentStatus?.kept === true && !youKeep;
  const unclaimed = currentStatusLoaded && currentStatus?.kept === false;

  return (
    <section className="mt-20 print:hidden" aria-labelledby="stewardship-heading">
      <div className="flex items-center justify-center gap-4 mb-12" aria-hidden="true">
        <div className="h-px w-12 bg-bronze-300" />
        <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
        <div className="h-px w-12 bg-bronze-300" />
      </div>
      <h2 id="stewardship-heading" className="sr-only">Artwork stewardship</h2>

      {!isSignedIn && (
        <div className="max-w-md mx-auto text-center">
          <p className="font-serif text-[17px] text-wood-700 leading-[1.9] mb-6">
            If you hold this piece, you can register as its steward and, when you wish, fuse a
            yearly intention into it.
          </p>
          <SignInTrigger destination={stewardClaimDestination(publicIdentity)}>
            <button
              type="button"
              className="inline-flex items-center gap-3 px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
            >
              Sign in to begin
            </button>
          </SignInTrigger>
        </div>
      )}

      {isSignedIn && !currentStatusLoaded && !currentStatusError && (
        <p className="max-w-md mx-auto text-center font-sans text-sm text-wood-500" role="status" aria-live="polite">
          Checking stewardship
        </p>
      )}

      {isSignedIn && currentStatusError && (
        <div className="max-w-md mx-auto text-center" role="status" aria-live="polite">
          <p className="font-sans text-sm text-wood-600 mb-5">Stewardship could not be checked right now.</p>
          <button type="button" onClick={() => void loadStatus()} className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-700 border-b border-bronze-300 pb-1">
            Try again
          </button>
        </div>
      )}

      {isSignedIn && unclaimed && (
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
            <OwnershipCodeForm
              key={`register-${publicCode}`}
              publicCode={publicCode}
              title={publicIdentity.title}
              variant="register"
              onBound={async () => {
                await loadStatus();
                setDoor('intention');
              }}
              onCancel={() => setDoor('closed')}
            />
          )}
        </div>
      )}

      {keptByOther && (
        <div className="max-w-md mx-auto">
          <p className="text-center font-serif text-[16px] text-wood-600 leading-[1.9] mb-8">
            This piece already has a steward. You can submit a stewardship request for manual review.
          </p>
          <OwnershipCodeForm
            key={`request-${publicCode}`}
            publicCode={publicCode}
            title={publicIdentity.title}
            variant="request"
            onBound={loadStatus}
          />
        </div>
      )}

      {youKeep && (
        <div className="max-w-xl mx-auto">
          <p className="text-center font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold mb-10">
            You are the current steward
          </p>
          <DisplayLocation
            key={`location-${publicCode}`}
            publicCode={publicCode}
            current={currentStatus?.currentDisplayLocation ?? null}
            onSaved={loadStatus}
          />
          <div className="mt-16">
            <IntentionRitual
              pieceId={publicIdentity.artworkId}
              editionNumber={publicIdentity.edition.number ?? 0}
            />
          </div>
        </div>
      )}
    </section>
  );
};

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
        type="button"
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

function OwnershipCodeForm({
  publicCode,
  title,
  variant,
  onBound,
  onCancel,
}: {
  publicCode: string;
  title: string;
  variant: 'register' | 'request';
  onBound: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { fetchAuthed } = useAccount();
  const bindRequest = useRef<AbortController | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ message: string } | null>(null);
  const wellFormed = isWellFormedRecoveryCode(code);
  const requesting = variant === 'request';
  const titleId = `ownership-code-title-${requesting ? 'request' : 'register'}`;
  const helpId = `ownership-code-help-${requesting ? 'request' : 'register'}`;
  const outcomeId = `ownership-code-outcome-${requesting ? 'request' : 'register'}`;
  const inputId = `ownership-code-${requesting ? 'request' : 'register'}`;
  const noteId = 'stewardship-evidence-note';

  useEffect(() => () => {
    bindRequest.current?.abort();
    bindRequest.current = null;
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(null);
    if (!wellFormed) {
      setError('That Ownership Code does not look complete. Check the underside of the piece.');
      return;
    }
    setBusy(true);
    bindRequest.current?.abort();
    const controller = new AbortController();
    bindRequest.current = controller;
    try {
      const response = await fetchAuthed('/api/keeper/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ publicCode, ownershipCode: code, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted || bindRequest.current !== controller) return;
      const result = classifyStewardBindResult(response.status, data);
      if (result.kind === 'pending') {
        setPending({ message: result.message });
        return;
      }
      if (result.kind === 'error') {
        setError(result.message);
        return;
      }
      await onBound();
    } catch {
      if (controller.signal.aborted || bindRequest.current !== controller) return;
      setError('Stewardship could not be updated right now. Please try again.');
    } finally {
      if (!controller.signal.aborted && bindRequest.current === controller) {
        setBusy(false);
        bindRequest.current = null;
      }
    }
  };

  return (
    <form
      aria-label={requesting ? 'Request stewardship' : 'Register stewardship'}
      aria-labelledby={titleId}
      onSubmit={submit}
      className="max-w-md mx-auto text-center"
    >
      <h3 id={titleId} className="font-serif text-2xl text-wood-900 mb-3">
        {requesting ? 'Request stewardship' : `Register ${title}`}
      </h3>
      <p id={helpId} className="font-sans text-[14px] text-wood-500 leading-[1.8] mb-8">
        Enter the Ownership Code engraved on the underside of the art. It is not the public QR number.
      </p>
      <label htmlFor={inputId} className="block font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 font-semibold mb-2">
        Ownership Code
      </label>
      <input
        id={inputId}
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 24))}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        spellCheck={false}
        autoComplete="off"
        aria-describedby={`${helpId} ${outcomeId}`}
        aria-invalid={Boolean(error)}
        className="w-full bg-paper-50 border border-wood-200 px-4 py-3 font-label text-[16px] tracking-[0.2em] text-center text-wood-800 uppercase focus:outline-none focus:border-bronze-400 transition-colors"
      />
      {requesting && (
        <div className="mt-6 text-left">
          <label htmlFor={noteId} className="block font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 font-semibold mb-2">
            Evidence note (optional)
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            aria-describedby={helpId}
            className="w-full bg-paper-50 border border-wood-200 px-4 py-3 font-sans text-sm text-wood-800 focus:outline-none focus:border-bronze-400 transition-colors"
          />
        </div>
      )}
      <div id={outcomeId} className="mt-4 min-h-5" aria-live="polite">
        {error && <p role="alert" className="font-sans text-[13px] text-bronze-700 leading-[1.7]">{error}</p>}
        {pending && (
          <div role="status" className="border border-bronze-300 bg-paper-100 p-4 text-left">
            <p className="font-sans text-[13px] text-wood-700 leading-[1.7]">{pending.message}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-6 mt-8">
        {onCancel && (
          <button type="button" onClick={onCancel} className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 font-semibold hover:text-wood-600 transition-colors">
            Not now
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors disabled:opacity-40"
        >
          {busy ? 'Submitting' : requesting ? 'Request stewardship' : 'Register'}
        </button>
      </div>
    </form>
  );
}

function DisplayLocation({
  publicCode,
  current,
  onSaved,
}: {
  publicCode: string;
  current: string | null;
  onSaved: () => void;
}) {
  const { fetchAuthed } = useAccount();
  const locationRequest = useRef<AbortController | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(current ?? ''), [current]);
  useEffect(() => () => {
    locationRequest.current?.abort();
    locationRequest.current = null;
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    locationRequest.current?.abort();
    const controller = new AbortController();
    locationRequest.current = controller;
    try {
      const response = await fetchAuthed('/api/keeper/piece', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          publicCode,
          currentDisplayLocation: value.trim(),
        }),
      });
      if (controller.signal.aborted || locationRequest.current !== controller) return;
      if (response.ok) {
        setEditing(false);
        onSaved();
      } else {
        setError('This location could not be saved. Please try again.');
      }
    } catch {
      if (controller.signal.aborted || locationRequest.current !== controller) return;
      setError('This location could not be saved. Please try again.');
    } finally {
      if (!controller.signal.aborted && locationRequest.current === controller) {
        setBusy(false);
        locationRequest.current = null;
      }
    }
  };

  return (
    <div className="text-center">
      <p id="display-location-label" className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-3">
        Where it lives now
      </p>
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} aria-describedby="display-location-label" className="font-serif text-[17px] text-wood-700 italic border-b border-transparent hover:border-bronze-300 transition-colors">
          {current || 'Add where this piece currently rests'}
        </button>
      ) : (
        <div className="max-w-sm mx-auto">
          <label htmlFor="display-location" className="sr-only">Current display location</label>
          <input
            id="display-location"
            value={value}
            onChange={(event) => setValue(event.target.value.slice(0, 200))}
            placeholder="A room, a city, a sanctuary"
            aria-describedby="display-location-outcome"
            className="w-full bg-paper-50 border border-wood-200 px-4 py-2.5 font-serif text-[16px] text-wood-700 text-center focus:outline-none focus:border-bronze-400 transition-colors"
          />
          <p id="display-location-outcome" role={error ? 'alert' : undefined} aria-live="polite" className="font-sans text-xs text-bronze-700 mt-3 min-h-4">
            {error}
          </p>
          <div className="flex items-center justify-center gap-5 mt-4">
            <button type="button" onClick={() => setEditing(false)} className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 font-semibold">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-600 font-semibold border-b border-bronze-300 pb-1 disabled:opacity-40">
              {busy ? 'Saving' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KeeperPanel;
