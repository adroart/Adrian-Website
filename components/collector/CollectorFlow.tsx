import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import {
  loadCollectorOnboarding,
  saveCollectorBirth,
  skipCollectorBirth,
  type CollectorOnboardingState,
} from '../../utils/collectorOnboarding';
import {
  CLOSED_COLLECTOR_PRIVACY,
  loadCollectorCuratedCities,
  loadCollectorPrivacy,
  saveCollectorPrivacy,
  type CollectorPrivacyState,
} from '../../utils/collectorPrivacy';
import { inspectInvitation, redeemInvitation, type InvitationInspection } from '../../utils/artworkInvitations';
import SignInTrigger from '../account/SignInTrigger';
import PrivacyAndBirth from './PrivacyAndBirth';
import CertificateScreen, { useEffectiveCertificate } from './CertificateScreen';
import OpeningScreen from './OpeningScreen';

type PrivateKeeperStatus = { byYou: boolean; keeperPieceId?: string };
type Stage = 'doors' | 'opening' | 'proof' | 'privacy' | 'certificate' | 'complete' | 'dream';

export default function CollectorFlow({
  identity,
  isSignedIn,
  initialProof = false,
  renderOwnershipProof,
  onProofComplete,
}: {
  identity: PublicPlateIdentity;
  isSignedIn: boolean;
  initialProof?: boolean;
  renderOwnershipProof: (onBound: () => Promise<void>, onCancel: () => void) => ReactNode;
  onProofComplete: () => Promise<PrivateKeeperStatus | null>;
}) {
  const [stage, setStage] = useState<Stage>(initialProof ? 'proof' : 'doors');
  const [proofMethod, setProofMethod] = useState<'none' | 'code' | 'invitation'>(initialProof ? 'code' : 'none');
  const [keeperPieceId, setKeeperPieceId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<CollectorOnboardingState | null>(null);
  const [privacy, setPrivacy] = useState<CollectorPrivacyState>(CLOSED_COLLECTOR_PRIVACY);
  const [cities, setCities] = useState<Array<{ id: string; label: string }>>([]);
  const [privateError, setPrivateError] = useState('');
  const [privateLoadAttempt, setPrivateLoadAttempt] = useState(0);
  const [privacySaved, setPrivacySaved] = useState(false);
  const certificateState = useEffectiveCertificate(identity.artworkId, identity.publicCode);
  const certificate = certificateState.status === 'ready' ? certificateState.certificate : {};
  const signInDestination = useMemo(() => {
    const query = new URLSearchParams({ instance: identity.publicCode, ref: 'qr', claim: '1' });
    return `/works/${encodeURIComponent(identity.artworkId)}?${query.toString()}`;
  }, [identity.artworkId, identity.publicCode]);

  useEffect(() => {
    setStage(initialProof ? 'proof' : 'doors');
    setProofMethod(initialProof ? 'code' : 'none');
    setKeeperPieceId(null);
    setOnboarding(null);
    setPrivacy(CLOSED_COLLECTOR_PRIVACY);
    setCities([]);
    setPrivateError('');
    setPrivateLoadAttempt(0);
    setPrivacySaved(false);
  }, [identity.publicCode]);

  useEffect(() => {
    if (!initialProof) return;
    setStage('proof');
    setProofMethod('code');
  }, [initialProof]);

  useEffect(() => {
    if (stage !== 'privacy' || !keeperPieceId) return;
    let current = true;
    setPrivateError('');
    Promise.all([
      loadCollectorOnboarding(),
      loadCollectorPrivacy(keeperPieceId),
      loadCollectorCuratedCities(),
    ])
      .then(([loadedOnboarding, loadedPrivacy, loadedCities]) => {
        if (!current) return;
        setOnboarding(loadedOnboarding);
        setPrivacy(loadedPrivacy);
        setCities(loadedCities);
      })
      .catch(() => {
        if (current) setPrivateError('Your private choices could not be opened right now. Please try again.');
      });
    return () => { current = false; };
  }, [keeperPieceId, privateLoadAttempt, stage]);

  const proofComplete = async () => {
    const status = await onProofComplete();
    if (!status?.byYou || !status.keeperPieceId) {
      setPrivateError('The private keeper record could not be verified. Please reopen this piece and try again.');
      return;
    }
    setKeeperPieceId(status.keeperPieceId);
    setStage('privacy');
  };

  if (stage === 'doors') {
    return (
      <section className="collector-doors" aria-labelledby="collector-doors-title">
        <p className="collector-eyebrow">Where would you like to begin?</p>
        <h3 id="collector-doors-title" className="sr-only">Choose what to do with this piece</h3>
        <div className="collector-door-grid">
          <button type="button" className="collector-door" onClick={() => setStage('opening')}>
            <span className="collector-door-title">Register and certify this piece</span>
            <span className="collector-door-copy">Connect its authentic record to you.</span>
          </button>
          <button type="button" className="collector-door" onClick={() => setStage('dream')}>
            <span className="collector-door-title">Begin your dream</span>
            <span className="collector-door-copy">A quiet door for what this piece may hold.</span>
          </button>
        </div>
      </section>
    );
  }

  if (stage === 'dream') {
    return (
      <section className="collector-screen" aria-labelledby="collector-dream-title">
        <p className="collector-eyebrow">Your dream</p>
        <h3 id="collector-dream-title" className="collector-title">This door opens next</h3>
        <p className="collector-copy">Dreams will arrive in the next phase. Nothing has been recorded.</p>
        <div className="collector-actions">
          <button type="button" className="collector-button-secondary" onClick={() => setStage('doors')}>Back to this piece</button>
        </div>
      </section>
    );
  }

  if (stage === 'opening') {
    return (
      <OpeningScreen
        title={identity.title}
        certificate={certificate}
        onCancel={() => setStage('doors')}
        onContinue={() => setStage('proof')}
      />
    );
  }

  if (stage === 'proof') {
    return (
      <section className="collector-screen" aria-labelledby="collector-proof-title">
        <p className="collector-eyebrow">Private proof</p>
        <h3 id="collector-proof-title" className="collector-title">How did this piece reach you?</h3>
        {!isSignedIn ? (
          <>
            <p className="collector-copy">Sign in before entering a private code or invitation.</p>
            <div className="collector-actions">
              <button type="button" className="collector-button-secondary" onClick={() => setStage('doors')}>Back</button>
              <SignInTrigger destination={signInDestination}>
                <button type="button" className="collector-button-primary">Sign in to continue</button>
              </SignInTrigger>
            </div>
          </>
        ) : proofMethod === 'none' ? (
          <div className="collector-door-grid">
            <button type="button" className="collector-door" onClick={() => setProofMethod('code')}>
              <span className="collector-door-title">Use Ownership Code</span>
              <span className="collector-door-copy">For a code carried by the artwork.</span>
            </button>
            <button type="button" className="collector-door" onClick={() => setProofMethod('invitation')}>
              <span className="collector-door-title">Use invitation</span>
              <span className="collector-door-copy">For a private invitation from Adrian.</span>
            </button>
          </div>
        ) : proofMethod === 'code' ? (
          renderOwnershipProof(proofComplete, () => setProofMethod('none'))
        ) : (
          <InvitationProof identity={identity} onRedeemed={proofComplete} onCancel={() => setProofMethod('none')} />
        )}
        {privateError && <p role="alert" className="collector-error">{privateError}</p>}
      </section>
    );
  }

  if (stage === 'privacy') {
    if (!onboarding || !keeperPieceId) {
      if (!privateError) return <p role="status" className="collector-copy">Opening your private choices</p>;
      return (
        <section className="collector-screen" aria-labelledby="collector-private-error-title">
          <h3 id="collector-private-error-title" className="collector-title">Your private choices are still closed</h3>
          <p role="alert" className="collector-error">{privateError}</p>
          <div className="collector-actions">
            <button
              type="button"
              className="collector-button-secondary"
              onClick={() => {
                setPrivateError('');
                setStage('complete');
              }}
            >
              Back to this piece
            </button>
            <button
              type="button"
              className="collector-button-primary"
              onClick={() => {
                setPrivateError('');
                setPrivateLoadAttempt((attempt) => attempt + 1);
              }}
            >
              Try again
            </button>
          </div>
        </section>
      );
    }
    return (
      <div className="collector-private-screen">
        {privateError && <p role="alert" className="collector-error">{privateError}</p>}
        <PrivacyAndBirth
          key={onboarding.status === 'current' ? `current:${onboarding.updatedAt}` : onboarding.status}
          onboarding={onboarding}
          privacy={privacy}
          keeperPieceId={keeperPieceId}
          curatedCities={cities}
          onSavePrivacy={async (input) => {
            try {
              setPrivacy(await saveCollectorPrivacy(input));
              setPrivacySaved(true);
            } catch {
              setPrivateError('Your privacy choices could not be saved right now. Please try again.');
            }
          }}
          onSaveBirth={async (inputs) => {
            try {
              const savedOnboarding = await saveCollectorBirth(inputs);
              setOnboarding(savedOnboarding);
              setPrivacy(await loadCollectorPrivacy(keeperPieceId));
              setPrivateError('');
              setPrivacySaved(false);
            } catch {
              setPrivateError('Your birth details could not be saved right now. You can skip and add them later.');
            }
          }}
          onSkip={async () => {
            try {
              setOnboarding(await skipCollectorBirth());
              setStage('certificate');
            } catch {
              setPrivateError('This step could not be skipped right now. Please try again.');
            }
          }}
        />
        {privacySaved && <p role="status" className="collector-saved">Privacy choices saved.</p>}
        {onboarding.status === 'current' && (
          <div className="collector-actions">
            <button type="button" className="collector-button-primary" onClick={() => setStage('certificate')}>
              Continue to certificate
            </button>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'certificate') {
    return (
      <CertificateScreen
        artworkId={identity.artworkId}
        publicCode={identity.publicCode}
        title={identity.title}
        editionLabel={identity.edition.label}
        testId="collector-certificate"
        onComplete={() => setStage('complete')}
      />
    );
  }

  return (
    <section className="collector-screen" aria-labelledby="collector-complete-title">
      <p className="collector-eyebrow">Complete</p>
      <h3 id="collector-complete-title" className="collector-title">Your piece is registered</h3>
      <p className="collector-copy">Its authentic record is connected to you. Your private choices can be changed later.</p>
    </section>
  );
}

function InvitationProof({
  identity,
  onRedeemed,
  onCancel,
}: {
  identity: PublicPlateIdentity;
  onRedeemed: () => Promise<void>;
  onCancel: () => void;
}) {
  const [token, setToken] = useState('');
  const [inspection, setInspection] = useState<InvitationInspection | null>(null);
  const [inspectedToken, setInspectedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => {
    requestId.current += 1;
    setToken('');
    setInspection(null);
    setInspectedToken(null);
    setRedeeming(false);
    setError('');
  }, [identity.publicCode]);

  const inspect = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setInspection(null);
    setInspectedToken(null);
    const currentRequest = ++requestId.current;
    const presentedToken = token;
    try {
      const result = await inspectInvitation(presentedToken);
      if (requestId.current !== currentRequest) return;
      if (result.artwork.publicCode !== identity.publicCode || result.artwork.artworkId !== identity.artworkId) {
        setInspection(null);
        setError(`This invitation belongs to ${result.artwork.title}. Open that piece from its invitation.`);
        return;
      }
      if (result.status !== 'available') {
        setInspection(result);
        setError({
          used: 'This invitation has already been used.',
          expired: 'This invitation has expired.',
          revoked: 'This invitation was revoked.',
        }[result.status]);
        return;
      }
      setInspection(result);
      setInspectedToken(presentedToken);
    } catch {
      if (requestId.current !== currentRequest) return;
      setInspection(null);
      setError('The invitation could not be opened.');
    } finally {
      if (requestId.current === currentRequest) setBusy(false);
    }
  };

  const redeem = async () => {
    const proofToken = inspectedToken;
    if (!proofToken || inspection?.status !== 'available') return;
    setBusy(true);
    setRedeeming(true);
    setError('');
    const currentRequest = ++requestId.current;
    try {
      await redeemInvitation(proofToken);
      if (requestId.current !== currentRequest) return;
      setToken('');
      setInspection(null);
      setInspectedToken(null);
      await onRedeemed();
    } catch {
      if (requestId.current !== currentRequest) return;
      setError('The invitation could not register this piece.');
    } finally {
      if (requestId.current === currentRequest) {
        setBusy(false);
        setRedeeming(false);
      }
    }
  };

  return (
    <form onSubmit={inspect} className="collector-proof-form" aria-label="Use artwork invitation">
      <label htmlFor="collector-invitation-token">Invitation</label>
      <input
        id="collector-invitation-token"
        type="password"
        autoComplete="off"
        value={token}
        disabled={redeeming}
        onChange={(event) => {
          if (redeeming) return;
          requestId.current += 1;
          setBusy(false);
          setToken(event.target.value);
          setInspection(null);
          setInspectedToken(null);
          setError('');
        }}
        required
      />
      {error && <p role="alert" className="collector-error">{error}</p>}
      {inspection?.status === 'available' && inspectedToken ? (
        <button type="button" className="collector-button-primary" disabled={busy} onClick={() => void redeem()}>
          {busy ? 'Registering' : 'Register invited piece'}
        </button>
      ) : (
        <div className="collector-actions">
          <button type="button" className="collector-button-secondary" onClick={() => { requestId.current += 1; setToken(''); setInspectedToken(null); onCancel(); }}>Back</button>
          <button type="submit" className="collector-button-primary" disabled={busy || !token}>
            {busy ? 'Opening' : 'Open invitation'}
          </button>
        </div>
      )}
    </form>
  );
}
