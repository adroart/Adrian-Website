import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LAUNCH_FLAGS } from '../../launchFlags';
import { useAccount } from '../../lib/account/useAccount';
import { isWellFormedRecoveryCode } from '../../utils/recoveryCode';
import {
  ArtworkContributorRequestError,
  beginContributorInviteAttempt,
  beginContributorRevokeAttempt,
  clearContributorInvitationToken,
  createArtworkContributorInvitation,
  loadArtworkContributors,
  isContributorMutationOutcomeAmbiguous,
  revokeArtworkContributor,
  type ArtworkContributorList,
  type ContributorAttempt,
  type ContributorInviteRequest,
  type ContributorInviteResult,
  type ContributorRevokeDraft,
  type ContributorRevokeRequest,
} from '../../utils/artworkContributors';
import type { PublicCreatorHistoryEntry, PublicPlateIdentity } from '../../utils/publicRegistry';
import CollectorFlow from '../collector/legacy/CollectorFlow';
import CollectorLife from '../collector/legacy/CollectorLife';
import IntentionRitual from './IntentionRitual';

interface StewardStatus {
  kept: boolean;
  byYou: boolean;
  contributor: boolean;
  keeperPieceId?: string;
  currentDisplayLocation?: string | null;
  stewardHistory?: PublicCreatorHistoryEntry[];
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
  const { isSignedIn, isLoaded, available, userId, fetchAuthed } = useAccount();
  const [searchParams] = useSearchParams();
  const publicCode = publicIdentity.publicCode;
  const [status, setStatus] = useState<StewardStatus | null>(null);
  const [statusPublicCode, setStatusPublicCode] = useState(publicCode);
  const [statusUserId, setStatusUserId] = useState(userId);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [collectorJourneyUserId, setCollectorJourneyUserId] = useState<string | null>(null);
  const statusRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const statusRequestId = useRef(0);
  const claimReturn = searchParams.get('claim') === '1';

  const loadStatus = React.useCallback(async (options: { background?: boolean } = {}) => {
    statusRequest.current?.controller.abort();
    const controller = new AbortController();
    const id = ++statusRequestId.current;
    statusRequest.current = { id, controller };
    setStatusPublicCode(publicCode);
    setStatusUserId(userId);
    if (!options.background) {
      setStatus(null);
      setStatusLoaded(false);
      setStatusError(false);
    }

    if (!isSignedIn) return null;
    const params = new URLSearchParams({ publicCode });
    const response = await fetchAuthed(`/api/keeper/piece?${params.toString()}`, {
      signal: controller.signal,
    }).catch(() => null);
    if (controller.signal.aborted || statusRequest.current?.id !== id) return;
    if (!response?.ok) {
      if (!options.background) {
        setStatusError(true);
        setStatusLoaded(false);
      }
      return null;
    }
    const data = await response.json().catch(() => null);
    if (controller.signal.aborted || statusRequest.current?.id !== id) return;
    if (!data) {
      if (!options.background) setStatusError(true);
      return null;
    }
    const nextStatus: StewardStatus = {
      kept: data.kept === true,
      byYou: data.byYou === true,
      contributor: data.contributor === true,
      ...(data.byYou === true && typeof data.keeperPieceId === 'string'
        ? { keeperPieceId: data.keeperPieceId }
        : {}),
      currentDisplayLocation: data.currentDisplayLocation,
      stewardHistory: Array.isArray(data.stewardHistory) ? data.stewardHistory : [],
    };
    setStatus(nextStatus);
    setStatusLoaded(true);
    if (!nextStatus.kept) setCollectorJourneyUserId(userId);
    return nextStatus;
  }, [fetchAuthed, isSignedIn, publicCode, userId]);

  useEffect(() => {
    statusRequest.current?.controller.abort();
    setStatusPublicCode(publicCode);
    setStatusUserId(userId);
    setStatus(null);
    setStatusLoaded(false);
    setStatusError(false);
    setCollectorJourneyUserId(null);
    if (isLoaded && isSignedIn) void loadStatus();
    return () => statusRequest.current?.controller.abort();
  }, [claimReturn, isLoaded, isSignedIn, loadStatus, publicCode, userId]);

  useEffect(() => {
    if (!(status?.byYou || status?.contributor) || statusUserId !== userId || statusPublicCode !== publicCode) return;
    const refresh = () => void loadStatus({ background: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = window.setInterval(refresh, 4000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadStatus, publicCode, status?.byYou, status?.contributor, statusPublicCode, statusUserId, userId]);

  if (!LAUNCH_FLAGS.livingLegacy || !available) return null;

  const statusMatches = statusPublicCode === publicCode && statusUserId === userId;
  const currentStatus = statusMatches ? status : null;
  const currentStatusLoaded = statusMatches && statusLoaded;
  const currentStatusError = statusMatches && statusError;
  const youKeep = currentStatusLoaded && currentStatus?.byYou === true;
  const youContribute = currentStatusLoaded && currentStatus?.contributor === true;
  const keptByOther = currentStatusLoaded && currentStatus?.kept === true && !youKeep && !youContribute;

  return (
    <section className="mt-20 print:hidden" aria-labelledby="stewardship-heading">
      <div className="flex items-center justify-center gap-4 mb-12" aria-hidden="true">
        <div className="h-px w-12 bg-bronze-300" />
        <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
        <div className="h-px w-12 bg-bronze-300" />
      </div>
      <h2 id="stewardship-heading" className="sr-only">Artwork stewardship</h2>

      {(!isSignedIn || collectorJourneyUserId === userId) && (
        <CollectorFlow
          key={`${publicCode}:${userId ?? 'guest'}`}
          identity={publicIdentity}
          isSignedIn={isSignedIn}
          initialProof={Boolean(isSignedIn && claimReturn && !youKeep)}
          renderOwnershipProof={(onBound, onCancel) => (
            <OwnershipCodeForm
              key={`register-${publicCode}`}
              publicCode={publicCode}
              title={publicIdentity.title}
              variant="register"
              onBound={onBound}
              onCancel={onCancel}
            />
          )}
          onProofComplete={loadStatus}
        />
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
            onBound={async () => { await loadStatus(); }}
          />
        </div>
      )}

      {youContribute && (
        <div className="max-w-xl mx-auto rounded border border-wood-200 bg-paper-100 p-6 text-center" aria-live="polite">
          <p className="font-display text-2xl text-wood-900 mb-3">You are a contributor to this artwork</p>
          <p className="font-serif text-base leading-7 text-wood-700 mb-5">
            Contributors are not keepers. You cannot transfer or recover this artwork, make a stewardship claim, invite contributors, or read private prices.
          </p>
          <Link
            to="/account/contributor-access"
            className="inline-flex min-h-11 items-center rounded-full px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2"
          >
            Open contributor access
          </Link>
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
          {currentStatus?.keeperPieceId && (
            <ContributorManagement keeperPieceId={currentStatus.keeperPieceId} />
          )}
          {currentStatus?.stewardHistory && currentStatus.stewardHistory.length > 0 && (
            <div className="mt-14 border-t border-wood-200 pt-10" aria-labelledby="steward-history-heading">
              <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold mb-3">Private to the steward</p>
              <h3 id="steward-history-heading" className="font-serif text-2xl text-wood-900 mb-6">From the creator</h3>
              <div className="space-y-6">
                {currentStatus.stewardHistory.map((entry, index) => (
                  <article key={`${entry.entryType}-${entry.title}-${index}`} className="border-l border-bronze-300 pl-5">
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-bronze-600 mb-2">{entry.entryType.replaceAll('_', ' ')}{entry.occurredAt ? ` · ${entry.occurredAt}` : ''}</p>
                    <h4 className="font-serif text-xl text-wood-900">{entry.title}</h4>
                    {entry.role && <p className="font-sans text-xs text-wood-500 mt-1">{entry.role}</p>}
                    {entry.detail && <p className="font-serif text-[16px] leading-[1.8] text-wood-700 mt-3">{entry.detail}</p>}
                  </article>
                ))}
              </div>
            </div>
          )}
          <div className="mt-16">
            <IntentionRitual
              pieceId={publicIdentity.artworkId}
              editionNumber={publicIdentity.edition.number ?? 0}
            />
          </div>
          {currentStatus?.keeperPieceId && collectorJourneyUserId !== userId && (
            <CollectorLife keeperPieceId={currentStatus.keeperPieceId} />
          )}
        </div>
      )}
    </section>
  );
};

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
      setCode('');
      setNote('');
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

function localExpiryInput(days = 7) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function contributorErrorMessage(error: unknown, action: 'load' | 'invite' | 'revoke') {
  if (error instanceof ArtworkContributorRequestError) {
    if (error.code === 'contributor_network_error') {
      return action === 'load'
        ? 'Contributor access could not be refreshed because the network was unavailable.'
        : `The network response was lost. Retry to continue the same safe ${action} attempt.`;
    }
    const messages: Record<string, string> = {
      contributor_recipient_not_found: 'No account was found for that email address.',
      contributor_recipient_unverified: 'That account must verify its email before it can be invited.',
      contributor_recipient_ambiguous: 'That email cannot be invited right now. Contact the artist for help.',
      contributor_cannot_be_keeper: 'The current keeper cannot also be a contributor.',
      contributor_already_invited: 'A current invitation already exists for that account.',
      contributor_already_active: 'That account already has contributor access.',
      contributor_invitation_expired: 'This invitation has expired and can no longer be revoked.',
      contributor_invitation_used: 'This invitation was already accepted.',
      contributor_invitation_revoked: 'This invitation was already revoked.',
      contributor_access_not_found: 'This contributor no longer has active access.',
      stale_keeper_authority: 'Stewardship changed while this page was open. Refresh the artwork record.',
    };
    if (messages[error.code]) return messages[error.code];
  }
  if (action === 'load') return 'Contributor access could not be refreshed. Please try again.';
  return `Contributor access could not be ${action === 'invite' ? 'invited' : 'revoked'}. Please try again.`;
}

function formatContributorDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

function ContributorManagement({ keeperPieceId }: { keeperPieceId: string }) {
  const [list, setList] = useState<ArtworkContributorList | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(localExpiryInput);
  const [busy, setBusy] = useState<'invite' | 'revoke' | null>(null);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [secret, setSecret] = useState<ContributorInviteResult | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ContributorRevokeDraft | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const mutationRequest = useRef<AbortController | null>(null);
  const inviteAttempt = useRef<ContributorAttempt<ContributorInviteRequest> | null>(null);
  const revokeAttempt = useRef<ContributorAttempt<ContributorRevokeRequest> | null>(null);
  const revokeConfirm = useRef<HTMLButtonElement | null>(null);
  const revokeOrigin = useRef<HTMLButtonElement | null>(null);

  const load = React.useCallback(async (quiet = false) => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    if (!quiet) {
      setState('loading');
      setError('');
    }
    try {
      const next = await loadArtworkContributors(keeperPieceId, controller.signal);
      if (controller.signal.aborted || listRequest.current !== controller) return;
      setList(next);
      setState('ready');
      setError('');
    } catch (cause) {
      if (controller.signal.aborted || listRequest.current !== controller) return;
      if (!quiet) {
        setState('error');
        setError(contributorErrorMessage(cause, 'load'));
      }
    } finally {
      if (listRequest.current === controller) listRequest.current = null;
    }
  }, [keeperPieceId]);

  useEffect(() => {
    setList(null);
    setSecret(null);
    setEmail('');
    setExpiresAt(localExpiryInput());
    setRevokeTarget(null);
    inviteAttempt.current = null;
    revokeAttempt.current = null;
    void load();
    return () => {
      listRequest.current?.abort();
      mutationRequest.current?.abort();
      listRequest.current = null;
      mutationRequest.current = null;
      inviteAttempt.current = null;
      revokeAttempt.current = null;
    };
  }, [keeperPieceId, load]);

  useEffect(() => {
    if (revokeTarget) revokeConfirm.current?.focus();
  }, [revokeTarget]);

  const editInvite = (field: 'email' | 'expiry', value: string) => {
    if (busy) return;
    inviteAttempt.current = null;
    setError('');
    setOutcome('');
    if (field === 'email') setEmail(value.slice(0, 254));
    else setExpiresAt(value);
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !expiresAt || secret) return;
    let expiresInstant: string;
    try {
      expiresInstant = new Date(expiresAt).toISOString();
    } catch {
      setError('Choose a valid invitation expiry.');
      return;
    }
    mutationRequest.current?.abort();
    const controller = new AbortController();
    mutationRequest.current = controller;
    setBusy('invite');
    setError('');
    setOutcome('');
    inviteAttempt.current = beginContributorInviteAttempt(inviteAttempt.current, {
      keeperPieceId,
      intendedRecipientEmail: email,
      expiresAt: expiresInstant,
    });
    try {
      const result = await createArtworkContributorInvitation(
        inviteAttempt.current.request,
        controller.signal,
      );
      if (controller.signal.aborted || mutationRequest.current !== controller) return;
      inviteAttempt.current = null;
      setEmail('');
      setExpiresAt(localExpiryInput());
      if (result.token) {
        setSecret(result);
        setOutcome('Copy this one-time invitation now. It disappears when dismissed or when this page reloads.');
      } else {
        setOutcome('The invitation exists, but its one-time value cannot be shown again. Revoke it and create a new invitation if it was not saved.');
      }
      await load();
    } catch (cause) {
      if (controller.signal.aborted || mutationRequest.current !== controller) return;
      if (!isContributorMutationOutcomeAmbiguous(cause)) inviteAttempt.current = null;
      setError(contributorErrorMessage(cause, 'invite'));
    } finally {
      if (!controller.signal.aborted && mutationRequest.current === controller) {
        mutationRequest.current = null;
        setBusy(null);
      }
    }
  };

  const chooseRevoke = (draft: ContributorRevokeDraft, origin: HTMLButtonElement) => {
    if (busy) return;
    revokeOrigin.current = origin;
    revokeAttempt.current = null;
    setRevokeTarget(draft);
    setError('');
    setOutcome('');
  };

  const cancelRevoke = () => {
    const origin = revokeOrigin.current;
    setRevokeTarget(null);
    revokeAttempt.current = null;
    setError('');
    requestAnimationFrame(() => origin?.focus());
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    mutationRequest.current?.abort();
    const controller = new AbortController();
    mutationRequest.current = controller;
    setBusy('revoke');
    setError('');
    setOutcome('');
    revokeAttempt.current = beginContributorRevokeAttempt(
      revokeAttempt.current,
      revokeTarget,
    );
    try {
      const result = await revokeArtworkContributor(
        revokeAttempt.current.request,
        controller.signal,
      );
      if (controller.signal.aborted || mutationRequest.current !== controller) return;
      revokeAttempt.current = null;
      setRevokeTarget(null);
      setOutcome(result.status === 'replay'
        ? 'This safe revocation attempt was already completed.'
        : 'Contributor access was revoked.');
      await load();
    } catch (cause) {
      if (controller.signal.aborted || mutationRequest.current !== controller) return;
      if (!isContributorMutationOutcomeAmbiguous(cause)) revokeAttempt.current = null;
      setError(contributorErrorMessage(cause, 'revoke'));
    } finally {
      if (!controller.signal.aborted && mutationRequest.current === controller) {
        mutationRequest.current = null;
        setBusy(null);
      }
    }
  };

  const pending = list?.invitations.filter((invitation) => invitation.status === 'available') ?? [];
  const active = list?.contributors ?? [];
  const revokeId = revokeTarget && ('invitationId' in revokeTarget
    ? revokeTarget.invitationId
    : revokeTarget.accessId);

  return (
    <section className="mt-14 border-t border-wood-200 pt-10" aria-labelledby="contributor-management-heading">
      <h3 id="contributor-management-heading" className="font-display text-2xl text-wood-900 mb-3">
        Artwork contributors
      </h3>
      <p className="font-serif text-base leading-7 text-wood-700 mb-8">
        Invite a verified account to this exact artwork. Contributors are not keepers and cannot transfer, recover, claim, invite, or read private prices.
      </p>

      {secret?.token && (
        <section className="min-w-0 rounded border border-bronze-300 bg-paper-100 p-5 mb-8" aria-labelledby="contributor-secret-heading">
          <h4 id="contributor-secret-heading" className="font-display text-xl text-wood-900 mb-3">One-time invitation</h4>
          <p className="font-serif text-base leading-7 text-wood-700 mb-4">
            Copy and send this privately. It is held only in this open page and cannot be shown again.
          </p>
          <p className="break-all select-all rounded bg-paper-50 p-4 font-serif text-base leading-7 text-wood-900">{secret.token}</p>
          <button
            type="button"
            onClick={() => setSecret((current) => {
              if (current) clearContributorInvitationToken(current);
              return null;
            })}
            className="mt-4 min-h-11 rounded-full px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2"
          >
            Dismiss invitation
          </button>
        </section>
      )}

      {!secret && (
        <form onSubmit={invite} className="space-y-5" aria-label="Invite an artwork contributor">
          <div>
            <label htmlFor="contributor-email" className="block font-label text-[11px] uppercase tracking-[0.16em] text-wood-600 mb-2">Verified account email</label>
            <input
              id="contributor-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={Boolean(busy)}
              onChange={(event) => editInvite('email', event.target.value)}
              className="block min-h-11 w-full rounded border border-wood-200 bg-paper-50 px-4 py-3 font-serif text-base text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="contributor-expiry" className="block font-label text-[11px] uppercase tracking-[0.16em] text-wood-600 mb-2">Invitation expires</label>
            <input
              id="contributor-expiry"
              type="datetime-local"
              required
              step="60"
              min={localExpiryInput(0)}
              max={localExpiryInput(31)}
              value={expiresAt}
              disabled={Boolean(busy)}
              onChange={(event) => editInvite('expiry', event.target.value)}
              className="block min-h-11 w-full rounded border border-wood-200 bg-paper-50 px-4 py-3 font-serif text-base text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={Boolean(busy) || !email.trim() || !expiresAt}
            className="min-h-11 rounded-full bg-wood-900 px-6 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-paper-50 hover:bg-bronze-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45"
          >
            {busy === 'invite' ? 'Creating invitation' : 'Create invitation'}
          </button>
        </form>
      )}

      <div className="mt-6 min-h-7" aria-live="polite">
        {error && <p role="alert" className="font-serif text-base leading-7 text-bronze-800">{error}</p>}
        {outcome && <p role="status" className="font-serif text-base leading-7 text-wood-700">{outcome}</p>}
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h4 className="font-display text-xl text-wood-900">Private access list</h4>
          <button
            type="button"
            onClick={() => void load()}
            disabled={state === 'loading' || Boolean(busy)}
            className="min-h-11 rounded-full px-4 py-2 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45"
          >
            Refresh
          </button>
        </div>
        {state === 'loading' && <p role="status" className="font-serif text-base text-wood-600">Loading contributor access</p>}
        {state === 'error' && (
          <div>
            <p role="alert" className="font-serif text-base leading-7 text-bronze-800">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-full px-4 py-2 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2">Try again</button>
          </div>
        )}
        {state === 'ready' && pending.length === 0 && active.length === 0 && (
          <p className="font-serif text-base leading-7 text-wood-600">No pending invitations or active contributors.</p>
        )}
        {state === 'ready' && (pending.length > 0 || active.length > 0) && (
          <ul className="divide-y divide-wood-200" aria-label="Pending invitations and active contributors">
            {pending.map((invitation) => (
              <li key={invitation.invitationId} className="py-5 first:pt-0">
                <p className="break-words font-serif text-base text-wood-900">{invitation.recipientEmail}</p>
                <p className="mt-1 font-serif text-base leading-7 text-wood-600">Pending until {formatContributorDate(invitation.expiresAt)}</p>
                {revokeId === invitation.invitationId ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="w-full font-serif text-base text-wood-700">Revoke this exact pending invitation?</p>
                    <button ref={revokeConfirm} type="button" onClick={() => void revoke()} disabled={Boolean(busy)} className="min-h-11 rounded-full bg-wood-900 px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-paper-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45">{busy === 'revoke' ? 'Revoking' : error ? 'Retry revocation' : 'Confirm revoke'}</button>
                    <button type="button" onClick={cancelRevoke} disabled={Boolean(busy)} className="min-h-11 rounded-full px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-wood-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={(event) => chooseRevoke({ keeperPieceId, invitationId: invitation.invitationId }, event.currentTarget)} disabled={Boolean(busy)} className="mt-3 min-h-11 rounded-full px-4 py-2 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45">Revoke pending invitation</button>
                )}
              </li>
            ))}
            {active.map((contributor) => (
              <li key={contributor.accessId} className="py-5 first:pt-0">
                <p className="break-words font-serif text-base text-wood-900">{contributor.recipientEmail}</p>
                <p className="mt-1 font-serif text-base leading-7 text-wood-600">Active since {formatContributorDate(contributor.grantedAt)}</p>
                {revokeId === contributor.accessId ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="w-full font-serif text-base text-wood-700">Remove this exact contributor's access?</p>
                    <button ref={revokeConfirm} type="button" onClick={() => void revoke()} disabled={Boolean(busy)} className="min-h-11 rounded-full bg-wood-900 px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-paper-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45">{busy === 'revoke' ? 'Revoking' : error ? 'Retry revocation' : 'Confirm revoke'}</button>
                    <button type="button" onClick={cancelRevoke} disabled={Boolean(busy)} className="min-h-11 rounded-full px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-wood-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={(event) => chooseRevoke({ keeperPieceId, accessId: contributor.accessId }, event.currentTarget)} disabled={Boolean(busy)} className="mt-3 min-h-11 rounded-full px-4 py-2 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45">Revoke contributor access</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
