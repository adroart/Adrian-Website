import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from './AccountLayout';
import { useAccount } from '../../lib/account/useAccount';
import {
  acceptArtworkContributorInvitation,
  ArtworkContributorRequestError,
  beginContributorAcceptAttempt,
  inspectArtworkContributorInvitation,
  isContributorMutationOutcomeAmbiguous,
  type ContributorAttempt,
  type ContributorAcceptRequest,
  type ContributorInvitationInspection,
  type ContributorProofStatus,
} from '../../utils/artworkContributors';

const STATUS_COPY: Record<ContributorProofStatus, string> = {
  available: 'This invitation is ready to accept.',
  used: 'This invitation has already been used.',
  expired: 'This invitation has expired. Ask the current keeper for a new one.',
  revoked: 'This invitation was revoked by the current keeper.',
  already_active: 'You already have contributor access to this artwork.',
  claim_pending: 'A stewardship claim is pending for this account, so contributor access cannot be added yet.',
};

function requestMessage(error: unknown, action: 'inspect' | 'accept') {
  if (!(error instanceof ArtworkContributorRequestError)) {
    return action === 'inspect'
      ? 'This invitation could not be checked. Please try again.'
      : 'Contributor access could not be accepted. The same attempt can be retried safely.';
  }
  if (error.code === 'contributor_network_error') {
    return action === 'inspect'
      ? 'The invitation could not be checked because the network was unavailable. Please try again.'
      : 'The network response was lost. Retry to continue the same safe acceptance attempt.';
  }
  if (error.code === 'contributor_invitation_not_available') {
    return 'This invitation is unavailable for this signed-in account.';
  }
  if (error.code === 'verified_email_required') {
    return 'A verified account email is required before an invitation can be used.';
  }
  const proofStatus = error.code.replace('contributor_invitation_', '') as ContributorProofStatus;
  if (proofStatus in STATUS_COPY) return STATUS_COPY[proofStatus];
  return action === 'inspect'
    ? 'This invitation could not be checked. Please try again.'
    : 'Contributor access could not be accepted. The same attempt can be retried safely.';
}

function editionLabel(inspection: ContributorInvitationInspection) {
  const { edition } = inspection.artwork;
  if (edition.kind === 'unique') return 'Unique work';
  return edition.size ? `Number ${edition.number} of ${edition.size}` : `Number ${edition.number}`;
}

const ContributorAccess: React.FC = () => {
  const { userId } = useAccount();
  const [proofUserId, setProofUserId] = useState(userId);
  const [token, setToken] = useState('');
  const [inspection, setInspection] = useState<ContributorInvitationInspection | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'accept' | null>(null);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [acceptedPath, setAcceptedPath] = useState('');
  const request = useRef<AbortController | null>(null);
  const acceptAttempt = useRef<ContributorAttempt<ContributorAcceptRequest> | null>(null);

  const clearProof = useCallback(() => {
    request.current?.abort();
    request.current = null;
    acceptAttempt.current = null;
    setToken('');
    setInspection(null);
    setBusy(null);
    setError('');
    setOutcome('');
    setAcceptedPath('');
  }, []);

  useEffect(() => {
    clearProof();
    setProofUserId(userId);
    return () => {
      request.current?.abort();
      request.current = null;
      acceptAttempt.current = null;
    };
  }, [clearProof, userId]);

  const proofMatches = proofUserId === userId;
  const visibleToken = proofMatches ? token : '';
  const visibleInspection = proofMatches ? inspection : null;
  const visibleError = proofMatches ? error : '';
  const visibleOutcome = proofMatches ? outcome : '';
  const visibleAcceptedPath = proofMatches ? acceptedPath : '';

  const editToken = (value: string) => {
    if (busy) return;
    setProofUserId(userId);
    acceptAttempt.current = null;
    setToken(value.trimStart().slice(0, 512));
    setInspection(null);
    setError('');
    setOutcome('');
  };

  const inspect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy('inspect');
    setError('');
    setOutcome('');
    setInspection(null);
    acceptAttempt.current = null;
    try {
      const result = await inspectArtworkContributorInvitation(token.trim(), controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      setInspection(result);
    } catch (cause) {
      if (controller.signal.aborted || request.current !== controller) return;
      setError(requestMessage(cause, 'inspect'));
    } finally {
      if (!controller.signal.aborted && request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  };

  const accept = async () => {
    if (!inspection || inspection.status !== 'available' || !token.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy('accept');
    setError('');
    setOutcome('');
    acceptAttempt.current = beginContributorAcceptAttempt(
      acceptAttempt.current,
      { token },
    );
    try {
      const result = await acceptArtworkContributorInvitation(
        acceptAttempt.current.request,
        controller.signal,
      );
      if (controller.signal.aborted || request.current !== controller) return;
      setToken('');
      setInspection(null);
      acceptAttempt.current = null;
      setAcceptedPath(`/works/${encodeURIComponent(inspection.artwork.artworkId)}${
        inspection.artwork.publicCode
          ? `?instance=${encodeURIComponent(inspection.artwork.publicCode)}`
          : ''
      }`);
      setOutcome(result.status === 'replay'
        ? 'Contributor access was already accepted by this safe attempt.'
        : 'Contributor access is now active. Open the artwork record to see your private relationship.');
    } catch (cause) {
      if (controller.signal.aborted || request.current !== controller) return;
      if (!isContributorMutationOutcomeAmbiguous(cause)) acceptAttempt.current = null;
      setError(requestMessage(cause, 'accept'));
    } finally {
      if (!controller.signal.aborted && request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  };

  return (
    <AccountLayout title="Contributor access">
      <div className="max-w-2xl">
        <p className="font-serif text-base leading-7 text-wood-700 mb-8">
          Paste the one-time invitation shared by the current keeper. It is checked privately and never added to this page address or saved in this browser.
        </p>

        <form onSubmit={inspect} className="space-y-5" aria-label="Inspect contributor invitation">
          <div>
            <label htmlFor="contributor-invitation" className="block font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 mb-2">
              Contributor invitation
            </label>
            <textarea
              id="contributor-invitation"
              name="contributorInvitation"
              rows={4}
              required
              autoComplete="off"
              spellCheck={false}
              value={visibleToken}
              disabled={Boolean(busy)}
              onChange={(event) => editToken(event.target.value)}
              aria-describedby="contributor-invitation-help contributor-invitation-outcome"
              aria-invalid={Boolean(visibleError)}
              className="block w-full max-w-full resize-y rounded border border-wood-200 bg-paper-50 px-4 py-3 font-serif text-base leading-7 text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-60"
            />
            <p id="contributor-invitation-help" className="mt-2 font-serif text-base leading-7 text-wood-600">
              The invitation is tied to one verified account email and one exact artwork.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={Boolean(busy) || !token.trim()}
              className="min-h-11 rounded-full bg-wood-900 px-6 py-3 font-label text-[11px] uppercase tracking-[0.18em] text-paper-50 transition-colors hover:bg-bronze-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45"
            >
              {busy === 'inspect' ? 'Checking invitation' : 'Check invitation'}
            </button>
            {(visibleToken || visibleInspection) && (
              <button
                type="button"
                onClick={clearProof}
                disabled={Boolean(busy)}
                className="min-h-11 rounded-full px-6 py-3 font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 hover:text-bronze-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div id="contributor-invitation-outcome" className="mt-8" aria-live="polite">
          {visibleError && <p role="alert" className="font-serif text-base leading-7 text-bronze-800">{visibleError}</p>}
          {visibleOutcome && (
            <div role="status" className="font-serif text-base leading-7 text-wood-800">
              <p>{visibleOutcome}</p>
              {visibleAcceptedPath && (
                <Link
                  to={visibleAcceptedPath}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full px-5 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2"
                >
                  Open artwork record
                </Link>
              )}
            </div>
          )}
          {visibleInspection && (
            <section className="rounded border border-wood-200 bg-paper-100 p-6" aria-labelledby="contributor-artwork-heading">
              <h2 id="contributor-artwork-heading" className="font-display text-2xl text-wood-900 mb-5">
                Invitation artwork
              </h2>
              <dl className="space-y-3 font-serif text-base leading-7 text-wood-700">
                <div><dt className="inline text-wood-500">Identifier: </dt><dd className="inline text-wood-900">{visibleInspection.artwork.artworkId}</dd></div>
                <div><dt className="inline text-wood-500">Edition: </dt><dd className="inline text-wood-900">{editionLabel(visibleInspection)}</dd></div>
                <div><dt className="inline text-wood-500">Public code: </dt><dd className="inline text-wood-900">{visibleInspection.artwork.publicCode ?? 'Not issued'}</dd></div>
                <div><dt className="inline text-wood-500">Invitation status: </dt><dd className="inline text-wood-900">{STATUS_COPY[visibleInspection.status]}</dd></div>
              </dl>
              {visibleInspection.status === 'available' && (
                <button
                  type="button"
                  onClick={() => void accept()}
                  disabled={Boolean(busy)}
                  className="mt-6 min-h-11 rounded-full bg-bronze-700 px-6 py-3 font-label text-[11px] uppercase tracking-[0.18em] text-paper-50 transition-colors hover:bg-wood-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500 focus-visible:ring-offset-2 disabled:opacity-45"
                >
                  {busy === 'accept' ? 'Accepting access' : 'Accept contributor access'}
                </button>
              )}
            </section>
          )}
        </div>

        <p className="mt-8 font-serif text-base leading-7 text-wood-600">
          Contributors are not keepers. Contributor access cannot transfer or recover an artwork, make a stewardship claim, invite another contributor, or read private prices.
        </p>
      </div>
    </AccountLayout>
  );
};

export default ContributorAccess;
