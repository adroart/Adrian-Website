/** The private first-bind letter. Proof exists only while this screen is mounted. */
import React, { useEffect, useRef, useState } from 'react';
import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import { inspectFirstBindInvitation, redeemFirstBindInvitation } from './api';
import type { FirstBindInvitationInspection } from './api';
import { locked, placeholder } from './copy';
import { C, F } from './tokens';
import { Brass, Eyebrow, Ground, TLink } from './ui';

const LETTER = {
  eyebrow: locked('AN INVITATION FROM ADRIAN'),
  body: locked('You have held this piece since before its record began. This invitation brings it onto the registry, with its history yours to complete.'),
  accept: locked('Accept the invitation'),
  decline: locked('This is not my piece'),
  answered: locked('This invitation has already been answered. If that was not you, contact Adrian.'),
};
const READ = placeholder('Read invitation');
const UNAVAILABLE = placeholder('The invitation could not be opened right now. Please try again.');
const DIFFERENT_PIECE = placeholder('This invitation is for another piece.');
const WRONG_ACCOUNT = placeholder('Sign in with the verified email address this invitation was sent to.');
const ALREADY_HELD = placeholder('This piece already has a caretaker. Contact Adrian if this seems wrong.');
const INVALID = placeholder('This invitation could not be found. Check it and try again.');

type Props = {
  identity: PublicPlateIdentity;
  onBack: () => void;
  onRedeemed: () => Promise<void>;
};

type Proof = { token: string; inspection: FirstBindInvitationInspection };

function matchesPiece(inspection: FirstBindInvitationInspection, identity: PublicPlateIdentity): boolean {
  return inspection?.artwork?.artworkId === identity.artworkId
    && inspection.artwork.publicCode === identity.publicCode;
}

function refusal(error: string): string {
  if (['invitation_used', 'invitation_expired', 'invitation_revoked'].includes(error)) return LETTER.answered;
  if (error === 'invitation_recipient_mismatch' || error === 'verified_email_required') return WRONG_ACCOUNT;
  if (error === 'piece_already_held') return ALREADY_HELD;
  if (error === 'invitation_not_found' || error === 'invalid_invitation_proof') return INVALID;
  return UNAVAILABLE;
}

export const InvitationPage: React.FC<Props> = ({ identity, onBack, onRedeemed }) => {
  const [token, setToken] = useState('');
  const [proof, setProof] = useState<Proof | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      attempt.current += 1;
      inFlight.current = false;
    };
  }, []);

  const leave = () => {
    attempt.current += 1;
    inFlight.current = false;
    setToken('');
    setProof(null);
    setMessage(null);
    onBack();
  };

  const inspect = async (event: React.FormEvent) => {
    event.preventDefault();
    const submitted = token.trim();
    if (!submitted || inFlight.current) return;
    const current = ++attempt.current;
    inFlight.current = true;
    setBusy(true);
    setProof(null);
    setMessage(null);
    try {
      const result = await inspectFirstBindInvitation(submitted);
      if (!alive.current || attempt.current !== current) return;
      if (result.ok === false) {
        setMessage(refusal(result.error));
      } else if (!matchesPiece(result.data, identity)) {
        setMessage(DIFFERENT_PIECE);
      } else if (result.data.status === 'available') {
        setProof({ token: submitted, inspection: result.data });
      } else if (['used', 'expired', 'revoked'].includes(result.data.status)) {
        setMessage(LETTER.answered);
      } else {
        setMessage(UNAVAILABLE);
      }
    } catch {
      if (alive.current && attempt.current === current) setMessage(UNAVAILABLE);
    } finally {
      if (alive.current && attempt.current === current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  const accept = async () => {
    if (inFlight.current || !proof || proof.token !== token.trim()
      || proof.inspection.status !== 'available' || !matchesPiece(proof.inspection, identity)) return;
    const current = ++attempt.current;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemFirstBindInvitation(proof.token);
      if (!alive.current || attempt.current !== current) return;
      if (result.ok === false) {
        setProof(null);
        setMessage(refusal(result.error));
      } else if (result.data?.pieceId !== identity.artworkId) {
        setProof(null);
        setMessage(UNAVAILABLE);
      } else {
        setProof(null);
        setToken('');
        setCompleted(true);
        await onRedeemed();
      }
    } catch {
      if (alive.current && attempt.current === current) setMessage(UNAVAILABLE);
    } finally {
      if (alive.current && attempt.current === current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <Ground light="j" pad="44px 30px 30px">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <Eyebrow>{identity.title}</Eyebrow>
        {!completed && <TLink onClick={leave}>Back</TLink>}
      </div>
      {completed ? <div style={{ flex: 1 }} /> : proof ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Eyebrow>{LETTER.eyebrow}</Eyebrow>
          <h1 style={{ fontFamily: F.display, fontWeight: 300, fontSize: 34, lineHeight: 1.12, color: C.ink, margin: '20px 0 0' }}>
            {identity.title} is waiting
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 15, lineHeight: 1.7, color: C.inkBody, margin: '22px 0 0' }}>{LETTER.body}</p>
          {message && <p role="alert" style={{ fontFamily: F.body, color: C.inkBody }}>{message}</p>}
          <div style={{ marginTop: 30 }}>
            {busy ? <p style={{ fontFamily: F.body, color: C.inkQuiet }}>Opening</p>
              : <Brass full onClick={accept}>{LETTER.accept}</Brass>}
          </div>
          <div style={{ marginTop: 16, textAlign: 'center' }}><TLink onClick={leave}>{LETTER.decline}</TLink></div>
        </div>
      ) : (
        <form onSubmit={inspect} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontFamily: F.display, fontWeight: 300, fontSize: 34, color: C.ink, margin: '0 0 25px' }}>Invitation</h1>
          <label htmlFor="first-bind-invitation" style={{ fontFamily: F.label, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.inkBody }}>Invitation</label>
          <input id="first-bind-invitation" type="password" value={token}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"
            onChange={event => {
              attempt.current += 1;
              setToken(event.target.value);
              setProof(null);
              setMessage(null);
              setBusy(false);
              inFlight.current = false;
            }}
            style={{ marginTop: 10, padding: '13px 14px', width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,.28)', border: `1px solid ${C.hairStrong}`, color: C.ink, fontFamily: F.body, fontSize: 15 }} />
          {message && <p role="alert" style={{ fontFamily: F.body, fontSize: 13, lineHeight: 1.6, color: C.inkBody }}>{message}</p>}
          <button type="submit" disabled={busy || !token.trim()}
            style={{ marginTop: 23, minHeight: 44, border: `1px solid ${C.brassEdge}`, background: C.brass, color: C.ground, fontFamily: F.label, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', opacity: busy || !token.trim() ? .5 : 1 }}>
            {busy ? 'Opening' : READ}
          </button>
        </form>
      )}
    </Ground>
  );
};
