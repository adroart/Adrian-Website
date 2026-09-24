/**
 * The wired collector journey: the same screens the demo shell walks, run
 * against the live registry through api.ts. This file is the ONLY
 * orchestration point — every network call goes through api.ts, every screen
 * stays the demo component fed a `live` object, and the demo shell keeps
 * working untouched when nothing passes one.
 *
 * The code-then-account seam (implemented exactly as settled):
 *
 *   The typed sixteen characters live in MEMORY (pendingBind's context) from
 *   the moment the code page completes. The vault fires ONLY on an actual
 *   successful bind — never optimistically on completion.
 *
 *   Signed-in, verified visitor: code completes → bind fires immediately →
 *   vault on bound → the four → the gathering with Sign its record
 *   auto-satisfied → the remaining required screens → ignition with the real
 *   claim ordinal from the atlas projection.
 *
 *   Anonymous visitor: code completes → the 'account' held-code state →
 *   pendingBind.bridge() mirrors {publicCode, normalizedCode, ts} to
 *   sessionStorage under 'pendingBind:v1' immediately before the auth
 *   machinery opens (the one passage that can reload the document) → on
 *   return with a session, restore() reads it back, DELETES the key, and the
 *   bind fires → vault on bound.
 *
 *   pendingBind.settle() (memory + mirror cleared) runs on every terminal
 *   outcome: bound, mismatch, contested 202, any 4xx/5xx error state, and
 *   explicit abandonment. needs_verified_email is NOT terminal — the code is
 *   re-mirrored for the verification round trip.
 *
 * Bind outcome → screen, every kind of the api.ts discriminated union:
 *   bound                → the vault, then 'The code is true'
 *   mismatch             → the wrong-code screen (code state reset)
 *   pending (202)        → 'A passing begins' (the patient receiving screen)
 *   not_ready            → the reissued-plate state
 *   needs_verified_email → back through verification (held-code state, code
 *                          re-mirrored for the round trip)
 *   not_registered       → quiet retry state
 *   rate_limited         → quiet retry state
 *   conflict             → quiet retry state
 *   error                → quiet retry state
 *   network throw        → quiet retry state, code KEPT (a receipt, not an
 *                          outcome: "stays until it lands")
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from '../../lib/account/useAccount';
import SignInModal from '../account/SignInModal';
import { C } from './tokens';
import { COPY, PIECE, PLACEHOLDERS } from './copy';
import { CollectorStyles } from './styles';
import { Ground } from './ui';
import { PiecePage, Relationship } from './PiecePage';
import type { GroundInputs } from './PiecePage';
import { CodePage, CodeSubmitOutcome } from './CodePage';
import { WALK, WalkScreen, Screen, SHOW_LAMPS_DEFAULT } from './walk';
import { VaultArrival } from './vaultArrival';
import { StateScreen } from './states';
import type { RoomKey } from './rooms';
import { PendingBindProvider, usePendingBind, normalizeTypedCode } from './pendingBind';
import type { FamilyLive, FamilyPerson, GardenLive, PieceLive, Quiet } from './live';
import {
  bindKeeper,
  acceptCaretakerPassing,
  cancelCaretakerPassing,
  createCaretakerPassing,
  completeYearlyRitual,
  createCollectorDream,
  getAtlasOrdinal,
  getCertificate,
  getCollectorCuratedCities,
  getCollectorDreamState,
  getCollectorLetters,
  getCollectorOnboarding,
  getCollectorPrivacy,
  getCurrentKeeperPriceHistory,
  getKeeperMessage,
  getKeeperPieceStatus,
  getCaretakerPassingForSender,
  getLineage,
  getPublicDream,
  getRegistryIdentity,
  inspectCaretakerPassing,
  getYearlyRitualEligibility,
  inviteKeeperContributor,
  listKeeperContributors,
  revokeKeeperContributor,
  resendCaretakerPassing,
  setCollectorDreamTier,
  publishHistoricalCollectorDream,
  setKeeperDisplayLocation,
  shareCollectorDream,
  updateCollectorDream,
  CollectorApiNetworkError,
} from './api';
import type {
  CertificateContent,
  CollectorDreamState,
  CollectorLetter,
  CollectorOnboardingState,
  CollectorPrivacyState,
  CollectorBirthInputs,
  CollectorRitualAction,
  CollectorRitualEligibility,
  CurrentKeeperPriceEntry,
  DreamTier,
  KeeperContributorList,
  KeeperPieceStatus,
  LineageOutcome,
  PublicCollectorDream,
  CaretakerPassing,
} from './api';
import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import { searchPlaces } from '../../lib/astrology/places';

import { persistCollectorGathering, type GatheringOutcome } from './gathering';

const G = COPY.gathering;
const PRIVATE_READ_ERROR = 'Your private choices could not be opened right now. Please try again.';
const BIRTH_SAVE_ERROR = 'Your birth details could not be saved right now. You can skip and add them later.';
const PRIVACY_SAVE_ERROR = 'Your privacy choices could not be saved right now. Please try again.';
const PRIVACY_PENDING = 'Birth details remain optional. Public choices stay closed until adulthood is confirmed.';

/**
 * Strings no copy.ts key exists for yet. copy.ts is frozen this pass, so they
 * live here, registered as placeholders so none can reach Adrian disguised as
 * finished copy (the states.tsx / garden.tsx idiom). T3-COPY: hoist and settle.
 */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

/* the invite screen keeps its name and relation fields for the settled shape,
   but the wire stores email alone today, and the screen must say so */
const INVITE_EMAIL_ONLY = ph(
  'Today only their email is kept. Their name and what they are to you will have their own place here soon.',
);

/* the grave two-press confirm before a removal commits (the seal-confirm
   idiom from garden.tsx: the first press arms, the same row pressed again
   commits — never a browser confirm()) */
const REMOVE_CONFIRM = ph(
  'Removing them is total. Press it once more, and their access ends.',
);

/* the wired person screen's honest lines: email and status are all the
   registry holds, so nothing warmer is claimed */
const PERSON_INVITED_LINE = ph('Invited. The piece has written to them, and nothing more until they answer.');
const PERSON_STANDS_QUIET = ph('private to you, and they are not told');

/* invitation management, the artist's second walk: a pending invitation
   used to offer only "Take her off the piece." Cancelling one costs
   nothing (nothing was ever placed), so it is a single press rather than
   the grave two-press confirm a real removal still uses; resending is a
   revoke and a fresh invite through the same api.ts functions. */
const INVITE_CANCEL_LABEL = ph('Cancel the invitation');
const INVITE_CANCEL_NOTE = ph('Nothing was placed yet. Cancelling it costs nothing.');
const INVITE_RESEND_LABEL = ph('Send it again');
/* the fallback line when the matching invitation record has not loaded yet
   (a brief window right after opening the person screen) */
const INVITE_RESEND_FALLBACK = ph('A new letter, with a fresh thirty days to answer.');

/* how long an invitation letter waits before it lapses (the server caps at 31 days) */
const INVITE_DAYS = 30;

/** a plain short date, for the real sent/expiry lines on a pending invitation */
function formatShortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ *
 * A network-backed value with the quiet presentation: loading renders as
 * absence, failure renders as a plain line with one retry. Never a spinner,
 * never an error wall.
 * ------------------------------------------------------------------ */

function useQuiet<T>(
  enabled: boolean,
  load: () => Promise<T>,
  deps: React.DependencyList,
): Quiet<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Quiet<T>>({ status: 'loading' });
  const retry = useCallback(() => setAttempt(a => a + 1), []);
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'loading' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });
    load()
      .then(data => {
        if (active) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ status: 'failed', retry });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt, retry, ...deps]);
  return state;
}

/* ------------------------------------------------------------------ *
 * Gathering field parsing. The screens collect friendly text; the server
 * contract wants exact shapes. Anything that cannot be resolved stays
 * client-side (the typed record keeps it) rather than failing registration.
 * ------------------------------------------------------------------ */

export function parseBirthDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4})$/.exec(t);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function parseBirthTime(raw: string): string | null {
  const m = /^(\d{1,2})\s*[:h.]\s*(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${m[2]}`;
}

/**
 * The error code of a failed ApiOutcome, null when it landed. A plain reader
 * rather than discriminant narrowing, which this tsconfig does not perform.
 */
function failCode(outcome: { ok: boolean; error?: string }): string | null {
  return outcome.ok ? null : outcome.error ?? 'error';
}

/* Server refusals that are about the caretaker's own record, not about the
 * network. Reporting these as an unreachable piece is a lie the collector
 * cannot act on, and the same press will never clear them. */
const RESOLVABLE_REFUSALS = new Set([
  'adult_status_required',
  'minor_publicity_forbidden',
  'name_consent_required',
  'user_not_synced',
]);

function placementRefusal(code: string | null): 'held' | 'unready' {
  return code !== null && RESOLVABLE_REFUSALS.has(code) ? 'unready' : 'held';
}

/* ------------------------------------------------------------------ *
 * The journey
 * ------------------------------------------------------------------ */

type Step =
  | { kind: 'piece'; room?: RoomKey | null }
  | { kind: 'code'; initialCode?: string; initialWrong?: boolean }
  | { kind: 'walk'; key: keyof typeof WALK }
  /**
   * The sealed artist message, met once right after the vault: "Something
   * was left for you," before everything else (todo/plans/collector-screen-
   * wording.md, the gift mechanic). Reuses WALK.sealed's rendering verbatim
   * for the teaser, then WALK.written's rendering for the reveal with the
   * real body swapped in where its own locked copy would otherwise sit —
   * every other field on both screens (head, pill, link text) stays exactly
   * as authored.
   */
  | { kind: 'gift-message'; stage: 'sealed' | 'written' }
  | { kind: 'passing-result'; state: 'accepted' | 'cancelled' | 'expired' | 'error' }
  | {
      kind: 'state';
      /**
       * 'notyet' is the honest passing (D4): the passing screens exist as
       * demo surfaces but nothing behind them is wired, so the live door
       * says so instead of staging a passing that cannot happen.
       */
      key: 'account' | 'verify' | 'plate' | 'offline';
      onRetry?: () => void;
      receipt?: [string, string][];
      message?: string;
    };

export type WiredJourneyProps = {
  identity: PublicPlateIdentity;
  /** the catalog record's story text, when the piece is in the compiled catalog */
  story?: { lead: string | null; paragraphs: string[] } | null;
  /** arrive straight on the code page (?claim=1, or a door already pressed) */
  beginClaim?: boolean;
};

/** Account-owned rooms, drafts and async results must never survive an identity
 * change. Keep the pending-code provider outside this boundary so the deliberate
 * anonymous-to-sign-in bridge still works; discard it when leaving a known user. */
export const WiredJourney: React.FC<WiredJourneyProps> = props => {
  const account = useAccount();
  const pending = usePendingBind();
  const confirmedOwner = useRef<string | null>(null);
  if (account.isLoaded) confirmedOwner.current = account.isSignedIn ? account.userId : null;
  const owner = confirmedOwner.current;
  const previousOwner = useRef(owner);
  useLayoutEffect(() => {
    if (previousOwner.current && previousOwner.current !== owner) pending.settle();
    previousOwner.current = owner;
  }, [owner, pending]);
  return <AccountJourney key={`${props.identity.publicCode}:${owner ?? 'anonymous'}`} {...props} />;
};

const AccountJourney: React.FC<WiredJourneyProps> = ({
  identity,
  story = null,
  beginClaim = false,
}) => {
  const publicCode = identity.publicCode;
  const mounted = useRef(true);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const account = useAccount();
  const pending = usePendingBind();
  const signedIn = account.available && account.isLoaded && account.isSignedIn;

  const [step, setStep] = useState<Step>(
    beginClaim ? { kind: 'code' } : { kind: 'piece' },
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [lamps, setLamps] = useState<boolean[]>([...SHOW_LAMPS_DEFAULT]);
  const lampsEdited = useRef(false);
  const gatheringInFlight = useRef(false);
  const [gatheringBusy, setGatheringBusy] = useState(false);
  const [gatheringPrivate, setGatheringPrivate] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  /* the household: which person's screen is open, and whether the removal
     has been armed by its first press (the grave two-press confirm) */
  const [person, setPerson] = useState<FamilyPerson | null>(null);
  const [removeArmed, setRemoveArmed] = useState(false);

  /* one notion of now per mounted journey, threaded down as data so the
     piece page itself never reads the clock */
  const groundNow = useMemo(() => new Date().toISOString(), []);

  /* the sealed artist message: fetched once, right on a bound outcome,
     before the code-is-true screen. giftMessageBody holds the real body for
     the 'written'-shaped reveal; giftPendingRef is consumed the one time
     'codetrue' is reached right after this bind, so a later visit to
     'codetrue' (e.g. back from 'fork') never re-triggers the detour. */
  const [giftMessageBody, setGiftMessageBody] = useState<string | null>(null);
  const passingToken = useMemo(() => typeof window === 'undefined'
    ? ''
    : new URLSearchParams(window.location.search).get('passing') || '', []);
  const [activePassing, setActivePassing] = useState<CaretakerPassing | null>(null);
  const passingAttempt = useRef<string | null>(null);
  const [passingKind, setPassingKind] = useState<'sale' | 'gift'>('sale');
  const [passingValueMethod, setPassingValueMethod] = useState<
    'paid' | 'part_trade_paid' | 'traded' | 'given' | null
  >(null);
  const [incomingPassingError, setIncomingPassingError] = useState<string | null>(null);
  const giftPendingRef = useRef(false);

  /* the vault arrival's own once-only guard: true the first time this
     journey reaches codetrue (the real unlock), false on every return to it
     after (fork's back link, transfer's "I didn't mean to", gift's reveal
     continuing on). Read once per mount by VaultArrival itself; see its
     header for why that reading is frozen rather than reactive. */
  const arrivalPlayedRef = useRef(false);

  /* ---------------- data, all through api.ts ---------------- */

  const keeper = useQuiet<KeeperPieceStatus>(
    signedIn,
    async () => {
      const outcome = await getKeeperPieceStatus(publicCode);
      if (!outcome.ok) throw outcome;
      return outcome.data;
    },
    [publicCode, account.userId, refreshTick],
  );
  const keeperStatus = keeper.status === 'ready' ? keeper.data : null;
  const isYours = Boolean(keeperStatus?.byYou);
  const keeperPieceId = keeperStatus?.keeperPieceId ?? null;

  const incomingPassing = useQuiet<CaretakerPassing | null>(
    Boolean(passingToken && signedIn),
    async () => {
      const outcome = await inspectCaretakerPassing(passingToken);
      if (!outcome.ok) {
        setIncomingPassingError(failCode(outcome) || 'passing_failed');
        return null;
      }
      setIncomingPassingError(null);
      return outcome.data;
    },
    [passingToken, account.userId, refreshTick],
  );
  const senderPassing = useQuiet<CaretakerPassing | null>(
    Boolean(signedIn && keeperPieceId),
    async () => {
      const outcome = await getCaretakerPassingForSender(keeperPieceId || '');
      if (!outcome.ok) throw outcome;
      return outcome.data;
    },
    [keeperPieceId, account.userId, refreshTick],
  );

  useEffect(() => {
    if (!passingToken) return;
    if (!signedIn) {
      setAuthOpen(true);
      return;
    }
    if (incomingPassing.status === 'ready' && incomingPassing.data?.status === 'pending') {
      setActivePassing(incomingPassing.data);
      setStep({ kind: 'walk', key: 'passaccept' });
    } else if (incomingPassing.status === 'ready' && incomingPassing.data) {
      setStep({ kind: 'passing-result', state: incomingPassing.data.status === 'accepted'
        ? 'accepted' : incomingPassing.data.status === 'cancelled' ? 'cancelled' : 'expired' });
    } else if (incomingPassingError) {
      setStep({ kind: 'passing-result', state: 'error' });
    }
  }, [passingToken, signedIn, incomingPassing, incomingPassingError]);

  const lineage = useQuiet<LineageOutcome>(
    true,
    () => getLineage(publicCode),
    [publicCode, refreshTick],
  );

  const dream = useQuiet<PublicCollectorDream | null>(
    true,
    async () => {
      const outcome = await getPublicDream(publicCode);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return null;
      throw outcome;
    },
    [publicCode, refreshTick],
  );

  const certificate = useQuiet<CertificateContent | null>(
    true,
    async () => {
      const outcome = await getCertificate(identity.artworkId, publicCode, identity.edition);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return null;
      throw outcome;
    },
    [identity.artworkId, publicCode],
  );

  const ordinal = useQuiet<number | null>(
    true,
    async () => {
      const outcome = await getAtlasOrdinal(publicCode);
      if (!outcome.ok) throw outcome;
      return outcome.data;
    },
    [publicCode, refreshTick],
  );
  const ordinalValue = ordinal.status === 'ready' ? ordinal.data : null;

  const ritual = useQuiet<CollectorRitualEligibility | null>(
    Boolean(keeperPieceId),
    async () => {
      if (!keeperPieceId) return null;
      const outcome = await getYearlyRitualEligibility(keeperPieceId);
      return outcome.ok ? outcome.data : null;
    },
    [keeperPieceId, refreshTick],
  );

  const dreams = useQuiet<CollectorDreamState | null>(
    Boolean(keeperPieceId),
    async () => {
      if (!keeperPieceId) return null;
      const outcome = await getCollectorDreamState(keeperPieceId);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return null;
      throw outcome;
    },
    [keeperPieceId, refreshTick],
  );

  /* the household: active contributors and the letters still waiting for an
     answer. Caretaker-only, like the room that reads it. */
  const contributors = useQuiet<KeeperContributorList | null>(
    Boolean(keeperPieceId) && isYours,
    async () => {
      if (!keeperPieceId) return null;
      const outcome = await listKeeperContributors(keeperPieceId);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return null;
      throw outcome;
    },
    [keeperPieceId, refreshTick],
  );

  /* what the piece has written: read-only, generated by the backend on
     lineage events, never by this client */
  const letters = useQuiet<CollectorLetter[]>(
    Boolean(keeperPieceId) && isYours,
    async () => {
      if (!keeperPieceId) return [];
      const outcome = await getCollectorLetters(keeperPieceId);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return [];
      throw outcome;
    },
    [keeperPieceId, refreshTick],
  );

  /* what was paid: the keeper certificate ledger, fetched for the caretaker
     ALONE (guests never ask, and the server answers 403 to anyone but the
     current keeper anyway). Failure stays quiet — the merged information
     room renders a plain retry line, never an error wall. */
  const priceHistory = useQuiet<CurrentKeeperPriceEntry[]>(
    signedIn && isYours,
    async () => {
      const outcome = await getCurrentKeeperPriceHistory(publicCode);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return [];
      throw outcome;
    },
    [publicCode, refreshTick],
  );

  /* the caretaker's birth profile, read for exactly one derived value: the
     birth MONTH, which warms the ground near the birthday. The details
     themselves reach no screen from here. */
  const onboarding = useQuiet<CollectorOnboardingState | null>(
    signedIn && isYours,
    async () => {
      const outcome = await getCollectorOnboarding();
      if (!outcome.ok) throw outcome;
      return outcome.data;
    },
    [account.userId, isYours],
  );
  const privacy = useQuiet<CollectorPrivacyState>(
    signedIn && isYours && Boolean(keeperPieceId),
    async () => {
      const outcome = await getCollectorPrivacy(keeperPieceId ?? undefined);
      if (!outcome.ok) throw outcome;
      return outcome.data;
    },
    [account.userId, keeperPieceId, isYours],
  );
  useEffect(() => {
    if (privacy.status !== 'ready' || lampsEdited.current) return;
    const saved = privacy.data;
    if (!saved?.ring3 || !saved?.ring4) return;
    setLamps([true, true, saved.ring4.shareName, saved.ring4.shareFace,
      saved.ring3.shareDerivedChart, saved.ring4.shareBusiness, saved.ring4.shareMission]);
  }, [privacy]);

  const birthMonthIndex = useMemo(() => {
    if (onboarding.status !== 'ready' || !onboarding.data) return null;
    const state = onboarding.data;
    if (state.status !== 'current') return null;
    const month = Number(state.inputs.date.slice(5, 7));
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : null;
  }, [onboarding]);

  /* ---------------- relationship derivation ----------------
   * Signed in: /api/keeper/piece answers directly (byYou / kept).
   * Anonymous: the public lineage answers whether anyone has ever bound the
   * piece (a first_bound or transferred event). On any doubt the page reads
   * 'registered' — a lit Begin on a piece someone already holds is the worst
   * wrong frame in the flow, so doubt never produces one. */

  const relationship: Relationship = useMemo(() => {
    if (!account.isLoaded) return 'loading';
    if (signedIn) {
      if (keeper.status === 'loading') return 'loading';
      if (keeper.status === 'failed') return 'registered';
      const status = keeper.data;
      if (status.byYou) return 'yours';
      if (status.kept) return 'signedin';
      return 'unclaimed';
    }
    if (lineage.status === 'loading') return 'loading';
    if (lineage.status === 'failed') return 'registered';
    const outcome = lineage.data;
    if (outcome.kind === 'ok') {
      const claimed = outcome.events.some(
        event => event.eventType === 'first_bound' || event.eventType === 'transferred',
      );
      return claimed ? 'registered' : 'unclaimed';
    }
    if (outcome.kind === 'dark' || outcome.kind === 'not_found') return 'unclaimed';
    return 'registered';
  }, [account.isLoaded, signedIn, keeper, lineage]);

  /* the light. The orbit's `placed` axis counts what has been PLACED in the
     piece — placed-words data only. Today that is at most the one standing
     dream (any tier: the caretaker sees their own through the keeper state,
     a guest sees only what shines through the public dream), so the axis
     honestly reads 0 or 1 for now; it grows only when more placeable things
     exist. It is NEVER lineage.events.length — binds and transfers are
     history, not things placed in the piece, and counting them would dress
     an empty piece as a full one. `near` still reads the lineage: how
     lately the piece was tended is the age of the last public event. */
  const { placed, near } = useMemo(() => {
    const events = lineage.status === 'ready' && lineage.data.kind === 'ok'
      ? lineage.data.events
      : [];
    const own = dreams.status === 'ready' && dreams.data?.current ? 1 : 0;
    const shown = dream.status === 'ready' && dream.data ? 1 : 0;
    const last = events.length > 0 ? Date.parse(events[events.length - 1].eventAt) : NaN;
    const months = Number.isFinite(last)
      ? (Date.now() - last) / (30 * 24 * 60 * 60 * 1000)
      : Infinity;
    return {
      placed: Math.max(own, shown),
      near: months <= 1 ? 1 : months <= 6 ? 0.5 : 0.15,
    };
  }, [lineage, dream, dreams]);

  /* ---------------- the bind ---------------- */

  const bindNow = useCallback(
    async (code: { publicCode: string; normalizedCode: string }): Promise<CodeSubmitOutcome> => {
      let outcome;
      try {
        outcome = await bindKeeper({
          publicCode: code.publicCode,
          ownershipCode: code.normalizedCode,
        });
      } catch (cause) {
        /* the network dropped, not an outcome: the code is KEPT and the quiet
           state offers the same attempt again */
        void cause;
        setStep({
          kind: 'state',
          key: 'offline',
          receipt: [],
          onRetry: () => {
            const held = pending.peek();
            if (held) {
              setStep({ kind: 'code', initialCode: held.normalizedCode });
            } else {
              setStep({ kind: 'code' });
            }
          },
        });
        return { kind: 'handled' };
      }

      if (!mounted.current) return { kind: 'handled' };
      if (outcome.kind === 'bound') {
        /* the sealed message, before the four: fetched now so it is ready
           the moment the vault carries through to 'codetrue'. Never blocks
           the walk — any non-message outcome (no message, not the steward,
           dark flag, network drop) is skipped in silence. */
        try {
          const messageOutcome = await getKeeperMessage(code.publicCode);
          if (messageOutcome.ok && messageOutcome.data) {
            setGiftMessageBody(messageOutcome.data.body);
            giftPendingRef.current = true;
          }
        } catch {
          /* skip quietly */
        }
      }

      if (!mounted.current) return { kind: 'handled' };
      switch (outcome.kind) {
        case 'bound':
          pending.settle();
          refresh();
          return { kind: 'vault' };
        case 'mismatch':
          pending.settle();
          return { kind: 'wrong' };
        case 'pending':
          pending.settle();
          setStep({ kind: 'walk', key: 'receiving' });
          return { kind: 'handled' };
        case 'not_ready':
          pending.settle();
          setStep({ kind: 'state', key: 'plate' });
          return { kind: 'handled' };
        case 'needs_verified_email':
          /* not terminal: back through verification. The code stays held and
             is mirrored again for the round trip that can reload the page.
             A signed-in person lands on the confirm-email screen, not the
             no-account one, whose two buttons do nothing for them. */
          pending.hold(code.publicCode, code.normalizedCode);
          pending.bridge();
          setStep({ kind: 'state', key: signedIn ? 'verify' : 'account' });
          return { kind: 'handled' };
        case 'not_registered':
        case 'rate_limited':
        case 'conflict':
        case 'error':
        default:
          pending.settle();
          setStep({
            kind: 'state',
            key: 'offline',
            receipt: [],
            onRetry: () => setStep({ kind: 'code' }),
          });
          return { kind: 'handled' };
      }
    },
    // signedIn is read above: without it the callback keeps the value it
    // closed over, and a person who just signed in is told they have no
    // account.
    [pending, refresh, signedIn],
  );

  /** the code page completed. Memory first, then the bind or the bridge. */
  const submitCode = useCallback(
    async (typedCode: string): Promise<CodeSubmitOutcome> => {
      const normalizedCode = normalizeTypedCode(typedCode);
      pending.hold(publicCode, normalizedCode);
      if (!signedIn) {
        setStep({ kind: 'state', key: 'account' });
        return { kind: 'handled' };
      }
      return bindNow({ publicCode, normalizedCode });
    },
    [bindNow, pending, publicCode, signedIn],
  );

  /* returning with a session — from the modal (context flips) or from a
     document reload (mount with the mirror still in sessionStorage). The
     restore deletes the mirror in the same motion; the code page then fires
     the bind through the ordinary pause, so the vault has its stage. */
  useEffect(() => {
    if (!signedIn || step.kind === 'code') return;
    const held = pending.restore();
    if (!held) return;
    if (held.publicCode !== publicCode) {
      pending.settle();
      return;
    }
    setStep({ kind: 'code', initialCode: held.normalizedCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  /* Gathering stays on its authored screen until every dependent save lands.
   * The account boundary owns the draft and invalidates any old continuation. */
  const submitGathering = useCallback(async (chosen: boolean[], withBirth: boolean): Promise<GatheringOutcome> => {
    if (!keeperPieceId) return { kind: 'pending', stage: 'read' };
    let birth: CollectorBirthInputs | null = null;
    if (withBirth) {
      const raw = [typed[G.fieldDate] ?? '', typed[G.fieldTime] ?? '', typed[G.fieldPlace] ?? ''];
      if (raw.some(value => value.trim())) {
        const date = parseBirthDate(raw[0]);
        const time = parseBirthTime(raw[1]);
        if (!date || !time || !raw[2].trim()) return { kind: 'rejected', stage: 'birth' };
        try {
          const [place] = await searchPlaces(raw[2].trim(), 1);
          if (!mounted.current) return { kind: 'cancelled' };
          if (!place) return { kind: 'rejected', stage: 'birth' };
          birth = { date, time, place };
        } catch { return { kind: 'network', stage: 'birth' }; }
      }
    }
    const cityText = (typed[G.fieldCity] ?? '').trim().toLowerCase();
    let piece;
    if (cityText) {
      try {
        const cities = await getCollectorCuratedCities();
        if (!mounted.current) return { kind: 'cancelled' };
        if (!cities.ok) return { kind: 'rejected', stage: 'privacy' };
        const city = cities.data.find(item => item.label.toLowerCase().includes(cityText));
        if (!city) return { kind: 'rejected', stage: 'privacy' };
        piece = { keeperPieceId, shareCity: Boolean(chosen[1]), cityId: city.id };
      } catch { return { kind: 'network', stage: 'privacy' }; }
    }
    return persistCollectorGathering({
      keeperPieceId, birth, isCurrent: () => mounted.current,
      privacy: {
        ...(piece ? { piece } : {}),
        person: {
          shareIntention: Boolean(chosen[0]), shareName: Boolean(chosen[2]),
          shareFace: Boolean(chosen[3]), shareDerivedChart: Boolean(chosen[4]),
          shareBusiness: Boolean(chosen[5]), shareMission: Boolean(chosen[6]),
        },
      },
    });
  }, [typed, keeperPieceId]);

  /* the year's answer, whichever of the three it is. plant-new carries the
     field's words; reinforce and fulfilled carry nothing, exactly as the
     endpoint takes them (api.ts completeYearlyRitual). */
  const submitRitual = useCallback(async (action: CollectorRitualAction) => {
    if (!keeperPieceId) return;
    const body = (typed[COPY.ritual.field] ?? '').trim();
    if (action === 'plant-new' && !body) return;
    try {
      await completeYearlyRitual(
        action === 'plant-new'
          ? { keeperPieceId, action, body, scope: 'self' }
          : { keeperPieceId, action },
      );
      refresh();
    } catch {
      /* the words stay in the field; the door reopens from the piece */
    }
  }, [keeperPieceId, typed, refresh]);

  /* ---------------- the household submissions ---------------- */

  const submitInvite = useCallback(async () => {
    const email = (typed[COPY.people.inviteEmail] ?? '').trim();
    if (!keeperPieceId || !email) return;
    try {
      const outcome = await inviteKeeperContributor({
        keeperPieceId,
        intendedRecipientEmail: email,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (outcome.ok) {
        refresh();
        setStep({ kind: 'walk', key: 'invitesent' });
      }
      /* a server refusal keeps them on the screen with everything typed */
    } catch (cause) {
      if (cause instanceof CollectorApiNetworkError) {
        setStep({
          kind: 'state',
          key: 'offline',
          receipt: [[COPY.people.inviteEmail, email]],
          onRetry: () => setStep({ kind: 'walk', key: 'invite' }),
        });
      }
    }
  }, [keeperPieceId, typed, refresh]);

  const submitRemove = useCallback(async (target: FamilyPerson) => {
    if (!keeperPieceId) return;
    try {
      const outcome = await revokeKeeperContributor({
        keeperPieceId,
        ...(target.kind === 'contributor'
          ? { accessId: target.accessId }
          : { invitationId: target.invitationId }),
      });
      if (outcome.ok) {
        setPerson(null);
        setRemoveArmed(false);
        refresh();
        setStep({ kind: 'piece', room: 'family' });
      }
    } catch {
      /* the quiet failure: the screen stands, the same press tries again */
    }
  }, [keeperPieceId, refresh]);

  /* "Send it again": revoke the lapsed invitation, then send a fresh one to
     the same address with a new thirty-day window — both through the
     existing api.ts functions, never a bespoke resend endpoint. */
  const submitResendInvite = useCallback(
    async (target: Extract<FamilyPerson, { kind: 'invited' }>) => {
      if (!keeperPieceId) return;
      try {
        const revoked = await revokeKeeperContributor({ keeperPieceId, invitationId: target.invitationId });
        if (!revoked.ok) return;
        const invited = await inviteKeeperContributor({
          keeperPieceId,
          intendedRecipientEmail: target.email,
          expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (invited.ok) {
          setPerson(null);
          refresh();
          setStep({ kind: 'piece', room: 'family' });
        }
      } catch {
        /* the quiet failure: the screen stands, the same press tries again */
      }
    },
    [keeperPieceId, refresh],
  );

  /* ---------------- garden live ----------------
   * The three tiers (§6 "Three tiers, and what outlives you"), mirrored from
   * the backend's settled matrix: keep→shine, keep→seal, seal→shine. Shine
   * is permanent, keep is never a destination once the dream stands, and
   * UN-SHINING DOES NOT EXIST — revokeCollectorDreamSharing is never called
   * here or anywhere else, because a public dream entered the permanent
   * record the moment it shone. */

  const ritualEligibility = ritual.status === 'ready' ? ritual.data : null;

  const gardenLive: GardenLive | null = useMemo(() => {
    const hasOwnHistoricalSeal = dreams.status === 'ready'
      && Boolean(dreams.data?.history.some(entry => entry.tier === 'seal' && entry.body));
    if ((!isYours && !hasOwnHistoricalSeal) || !keeperPieceId) return null;

    /* Entering the light. The tier verb is the settled move; while migration
       041 has not reached the registry it answers 503, and keep→shine falls
       back to the audited share, which both eras accept and which the
       backend routes through the same keep→shine tier change once tiered.
       seal→shine has no fallback: a plain share on a sealed dream is
       refused by design, and seal itself only exists post-041. */
    const enterShine = async (fromSeal: boolean): Promise<boolean> => {
      const moved = failCode(await setCollectorDreamTier({ keeperPieceId, tier: 'shine' }));
      if (moved === null || moved === 'tier_unchanged') return true;
      if (moved === 'dream_tiers_unavailable' && !fromSeal) {
        const lit = await shareCollectorDream({ keeperPieceId, visibility: 'anonymous' });
        return lit.ok;
      }
      return false;
    };

    return {
      dreams,
      publishHistorical: async (dreamId: string) => {
        const outcome = await publishHistoricalCollectorDream({ keeperPieceId, dreamId });
        if (outcome.ok) refresh();
        return outcome.ok;
      },
      /* The yearly gate, pre-empted for the UI: outside the window the
         standing BODY settles. Unknown eligibility reads open — the server
         is the real gate, and `place` answers 'locked' when it refuses. */
      editWindowOpen: ritualEligibility?.eligible !== false,
      place: async (body: string, tier: DreamTier, heirsMayShare = true) => {
        try {
          const current = dreams.status === 'ready' ? dreams.data?.current ?? null : null;
          /* whether anything already landed, so a half-landed placement
             refreshes to true state before the quiet retry */
          let landedAny = false;

          if (!current) {
            /* first placement: ONE create carrying tier and the heirs'
               choice (migration 042's optional create fields). A pre-041
               registry answers 503 dream_tiers_unavailable BEFORE inserting
               anything (and an older handler 400s the unknown fields), so
               the fallback below retries the pre-041 two-step safely:
               plain create at keep, then the tier verb / audited share. */
            const planted = await createCollectorDream({
              keeperPieceId,
              body,
              scope: 'self',
              tier,
              heirsMayShare: tier === 'seal' ? false : heirsMayShare,
            });
            if (!planted.ok) {
              const code = failCode(planted);
              if (code !== 'dream_tiers_unavailable' && code !== 'invalid_input') {
                return placementRefusal(code);
              }
              const fallback = await createCollectorDream({ keeperPieceId, body, scope: 'self' });
              if (!fallback.ok) return placementRefusal(failCode(fallback));
              landedAny = true;
              if (tier === 'shine' && !(await enterShine(false))) {
                refresh();
                return 'held';
              }
              if (tier === 'seal') {
                const sealed = failCode(await setCollectorDreamTier({ keeperPieceId, tier: 'seal' }));
                if (sealed !== null && sealed !== 'tier_unchanged') {
                  refresh();
                  return 'held';
                }
              }
            }
          } else {
            const currentTier: DreamTier =
              current.tier ?? (current.visibility === 'private' ? 'keep' : 'shine');

            /* the words: version-checked, and yearly-gated by the server.
               'outside_birthday_window' is a state, never an error. */
            if (body !== current.body) {
              const edited = await updateCollectorDream({
                keeperPieceId,
                body,
                scope: current.scope,
                expectedVersion: current.version,
              });
              const editFail = failCode(edited);
              if (editFail !== null) {
                if (editFail === 'outside_birthday_window') return 'locked';
                return placementRefusal(editFail);
              }
              landedAny = true;
            }

            /* the tier move, when one was asked for. Only shine and seal are
               ever destinations; the control never offers a way back to
               keep, mirroring the backend exactly. */
            if (tier !== currentTier && tier !== 'keep') {
              const moved =
                tier === 'shine'
                  ? await enterShine(currentTier === 'seal')
                  : await setCollectorDreamTier({ keeperPieceId, tier: 'seal' }).then(outcome => {
                      const code = failCode(outcome);
                      return code === null || code === 'tier_unchanged';
                    });
              if (!moved) {
                if (landedAny) refresh();
                return 'held';
              }
              landedAny = true;
            }
          }

          refresh();
          return 'landed';
        } catch {
          return 'held';
        }
      },
    };
  }, [isYours, keeperPieceId, dreams, ritualEligibility, refresh]);

  /* ---------------- the household the room reads ----------------
   * Real people only: active contributors and letters still waiting for an
   * answer, email and status verbatim off the wire. Nothing is invented —
   * the contributor model holds no names, relations, or words. */

  const familyLive: FamilyLive | null = useMemo(() => {
    if (!isYours || !keeperPieceId) return null;
    const people: Quiet<FamilyPerson[]> =
      contributors.status === 'ready'
        ? {
            status: 'ready',
            data: [
              ...(contributors.data?.contributors ?? []).map(active => ({
                kind: 'contributor' as const,
                accessId: active.accessId,
                email: active.recipientEmail,
                grantedAt: active.grantedAt,
              })),
              ...(contributors.data?.invitations ?? [])
                .filter(invitation => invitation.status === 'available')
                .map(invitation => ({
                  kind: 'invited' as const,
                  invitationId: invitation.invitationId,
                  email: invitation.recipientEmail,
                  invitedAt: invitation.invitedAt,
                })),
            ],
          }
        : contributors;
    return {
      people,
      open: opened => {
        setPerson(opened);
        setRemoveArmed(false);
        setStep({ kind: 'walk', key: 'person' });
      },
    };
  }, [isYours, keeperPieceId, contributors]);

  /* "Send it again"'s own note: the real sent/expiry dates when the
     matching invitation has loaded (listKeeperContributors returns both,
     ContributorInvitation.invitedAt / .expiresAt), the honest fallback
     line otherwise — never a fabricated date. */
  const resendInviteNote = useMemo(() => {
    if (!person || person.kind !== 'invited' || contributors.status !== 'ready') {
      return INVITE_RESEND_FALLBACK;
    }
    const invitation = contributors.data?.invitations.find(inv => inv.invitationId === person.invitationId);
    if (!invitation) return INVITE_RESEND_FALLBACK;
    return `Sent ${formatShortDate(invitation.invitedAt)}. Waits until ${formatShortDate(invitation.expiresAt)}.`;
  }, [person, contributors]);

  /* ---------------- the ground reading's inputs ----------------
   * The GROUND axis (utils/collectorGround.ts): first binding from the
   * public lineage, the one notion of now this journey holds, and the birth
   * MONTH alone from onboarding. No curated-city coordinates exist on this
   * wire, so latitude stays null and the season tint reads neutral. */

  const groundInputs: GroundInputs = useMemo(() => {
    const events = lineage.status === 'ready' && lineage.data.kind === 'ok'
      ? lineage.data.events
      : [];
    const firstBound = events.find(event => event.eventType === 'first_bound');
    return {
      firstBoundAt: firstBound ? firstBound.eventAt : null,
      now: groundNow,
      latitude: null,
      birthMonthIndex,
    };
  }, [lineage, groundNow, birthMonthIndex]);

  /* ---------------- the live object the screens read ---------------- */

  const setDisplayLocation = useCallback(async (value: string): Promise<boolean> => {
    try {
      const outcome = await setKeeperDisplayLocation(publicCode, value);
      if (outcome.ok) refresh();
      return outcome.ok;
    } catch {
      return false;
    }
  }, [publicCode, refresh]);

  const live: PieceLive = useMemo(
    () => ({
      identity,
      dream: dream.status === 'ready'
        ? {
            status: 'ready',
            data: dream.data
              ? { body: dream.data.body, attribution: dream.data.attribution }
              : null,
          }
        : dream.status === 'failed'
          ? dream
          : { status: 'loading' },
      certificate,
      lineage,
      ordinal: ordinalValue,
      story,
      displayLocation: keeperStatus?.currentDisplayLocation ?? null,
      priceHistory: isYours ? priceHistory : null,
      accountEmail: account.email,
      ritual: ritual.status === 'ready' ? ritual.data : null,
      garden: gardenLive,
      family: familyLive,
      letters: isYours ? letters : null,
      setDisplayLocation: isYours ? setDisplayLocation : null,
    }),
    [identity, dream, certificate, lineage, ordinalValue, story, keeperStatus, account.email, ritual, gardenLive, familyLive, isYours, letters, priceHistory, setDisplayLocation],
  );

  /* ---------------- copy, dressed with the real piece ----------------
   * The wording record: "Every screen swaps in the real piece at runtime.
   * Ordinals shown are samples." The locked strings stay the source; only
   * the sample piece and the sample ordinal are swapped, never a word. */

  const swap = useCallback(
    (text?: string): string | undefined => {
      if (!text) return text;
      let out = text.split(PIECE.name).join(identity.title);
      if (identity.series) out = out.split(PIECE.series).join(identity.series);
      if (ordinalValue !== null) {
        out = out.split(String(PIECE.ordinal)).join(String(ordinalValue));
      }
      return out;
    },
    [identity, ordinalValue],
  );

  const submitPassing = useCallback(async () => {
    const recipientEmail = (typed[COPY.passing.readyField] || '').trim().toLowerCase();
    if (!keeperPieceId || !recipientEmail) return;
    if (!passingAttempt.current) passingAttempt.current = `passing-${crypto.randomUUID()}`;
    try {
      const outcome = await createCaretakerPassing({
        keeperPieceId,
        recipientEmail,
        confirmedRecipientEmail: recipientEmail,
        transferKind: passingKind,
        idempotencyKey: passingAttempt.current,
        ...((typed[COPY.passing.valueField] || '').trim() && passingValueMethod
          ? {
              declaredValueRaw: (typed[COPY.passing.valueField] || '').trim(),
              declaredValueMethod: passingValueMethod,
            }
          : {}),
      });
      if (!outcome.ok) {
        setStep({ kind: 'passing-result', state: failCode(outcome) === 'passing_expired' ? 'expired' : 'error' });
        return;
      }
      setActivePassing(outcome.data.passing);
      setStep({ kind: 'walk', key: 'passdone' });
      refresh();
    } catch {
      setStep({ kind: 'passing-result', state: 'error' });
    }
  }, [keeperPieceId, typed, refresh, passingKind, passingValueMethod]);

  const cancelPassing = useCallback(async () => {
    if (!activePassing) return;
    const outcome = await cancelCaretakerPassing(activePassing.id);
    if (!outcome.ok) {
      setStep({ kind: 'passing-result', state: 'error' });
      return;
    }
    setActivePassing(null);
    passingAttempt.current = null;
    setStep({ kind: 'piece' });
    refresh();
  }, [activePassing, refresh]);

  const acceptPassing = useCallback(async () => {
    if (!passingToken) return;
    const outcome = await acceptCaretakerPassing(passingToken);
    if (!outcome.ok) {
      setStep({ kind: 'passing-result', state: failCode(outcome) === 'passing_expired' ? 'expired' : 'error' });
      return;
    }
    setActivePassing(outcome.data.passing);
    refresh();
    setStep({ kind: 'piece' });
  }, [passingToken, refresh]);

  const resendPassing = useCallback(async () => {
    if (!activePassing) return;
    const outcome = await resendCaretakerPassing(activePassing.id);
    if (!outcome.ok) {
      setStep({ kind: 'passing-result', state: 'error' });
      return;
    }
    setActivePassing(outcome.data.passing);
    refresh();
  }, [activePassing, refresh]);

  const wiredScreen = useCallback(
    (key: keyof typeof WALK): Screen => {
      const base = WALK[key] as Screen;
      const screen: Screen = {
        ...base,
        head: swap(base.head) as string,
        body: swap(base.body),
        body2: swap(base.body2),
        eyebrow: swap(base.eyebrow),
        note: swap(base.note),
        preNote: swap(base.preNote),
      };
      /* Sign its record is auto-satisfied by the verified session the bind
         required, so the first reachable gathering screen has nothing behind
         it to correct. §7, 2026-08-20: that screen is now lives, not born. */
      if (key === 'lives') screen.back = undefined;
      if (key === 'light47' && gatheringPrivate) screen.body = PRIVACY_PENDING;

      /* the ritual's one-press answers become real actions: the demo rows
         walk straight to ritualfamily, the wired rows submit first. Matched
         by their locked titles, which are the stable thing about them. */
      if (key === 'ritual' && screen.rows) {
        screen.rows = screen.rows.map(([title, note, to]) => [
          title,
          note,
          title === COPY.ritual.reinforce
            ? '__ritualReinforce'
            : title === COPY.ritual.markFulfilled
              ? '__ritualFulfilled'
              : to,
        ]);
      }

      /* each person at their own birthday: the demo's sample household gives
         way to the real one. Real people, or nothing pending at all — zero
         fabricated waiting items, because no family-words model exists on
         the wire yet. */
      if (key === 'ritualfamily') {
        const people = familyLive?.people;
        const rows: [string, string, string][] =
          people?.status === 'ready'
            ? people.data.map(member => [member.email, '', '__home'] as [string, string, string])
            : [];
        screen.rows = rows.length > 0 ? rows : undefined;
      }

      /* the invitation stores email alone today; the kept name and relation
         fields say so instead of pretending */
      if (key === 'invite') screen.preNote = INVITE_EMAIL_ONLY;

      /* one person, real: their email as the head, their true status as the
         body. An invitation still waiting for its answer gets its own two
         rows (the artist's second walk): cancelling costs nothing, so it is
         a single press, never the grave two-press confirm that removing an
         active contributor still uses. */
      if (key === 'person' && person) {
        screen.head = person.email;
        if (person.kind === 'invited') {
          screen.body = PERSON_INVITED_LINE;
          screen.rows = [
            [INVITE_CANCEL_LABEL, INVITE_CANCEL_NOTE, '__personCancelInvite'],
            [INVITE_RESEND_LABEL, resendInviteNote, '__personResend'],
          ];
          screen.note = undefined;
        } else {
          screen.rows = [
            [COPY.people.personStands, PERSON_STANDS_QUIET, 'personSuccession'],
            [COPY.people.personRemove, COPY.people.personRemoveNote, '__personRemove'],
          ];
          screen.note = removeArmed ? REMOVE_CONFIRM : COPY.people.personNote;
        }
      }
      if (key === 'passdone' && activePassing?.status === 'pending') {
        screen.rows = activePassing.deliveryStatus === 'failed'
          ? [
              ['Send the invitation again', 'The earlier delivery did not land.', '__resendPassing'],
              ['Stop the passing', 'Nothing has moved yet.', '__cancelPassing'],
            ]
          : [['Stop the passing', 'Nothing has moved yet.', '__cancelPassing']];
      }
      if (key === 'passaccept') screen.to = '__acceptPassing';
      if (key === 'passvalue' && screen.rows) {
        const targets = [
          '__passingPaid', '__passingPartTrade', '__passingTraded', '__passingGiven',
        ];
        screen.rows = screen.rows.map(([title, note], index) => [title, note, targets[index]]);
      }
      return screen;
    },
    [swap, familyLive, person, removeArmed, resendInviteNote, activePassing, gatheringPrivate],
  );

  /* ---------------- navigation ---------------- */

  const go = useCallback(
    (key: string) => {
      const from = step.kind === 'walk' ? step.key : null;

      /* the armed removal disarms the moment any other press happens */
      if (key !== '__personRemove' && removeArmed) setRemoveArmed(false);

      if (gatheringInFlight.current) return;
      if (from === 'explain' && key === 'who2') {
        setTyped(current => ({ ...current, [G.fieldDate]: '', [G.fieldTime]: '', [G.fieldPlace]: '' }));
        setStep({ kind: 'walk', key: 'who2' });
        return;
      }
      if ((from === 'who2' || from === 'shows') && key === 'light47') {
        gatheringInFlight.current = true;
        setGatheringBusy(true);
        void submitGathering(from === 'who2' ? lamps.map((v, i) => i < 2 ? true : v) : lamps, from === 'who2')
          .then(result => {
            if (!mounted.current || result.kind === 'cancelled') return;
            if (result.kind === 'saved') {
              setGatheringPrivate(Boolean(result.sharingPending));
              refresh();
              setStep({ kind: 'walk', key: 'light47' });
              return;
            }
            const returnTo = result.stage === 'birth' ? 'who1' : from;
            setStep({
              kind: 'state', key: 'offline', receipt: [],
              message: result.kind === 'network' ? undefined
                : result.stage === 'read' ? PRIVATE_READ_ERROR
                  : result.kind === 'pending' && result.error === 'adult_profile_required' ? PRIVACY_PENDING
                    : result.stage === 'birth' ? BIRTH_SAVE_ERROR : PRIVACY_SAVE_ERROR,
              onRetry: () => setStep({ kind: 'walk', key: returnTo }),
            });
          }).finally(() => {
            gatheringInFlight.current = false;
            if (mounted.current) setGatheringBusy(false);
          });
        return;
      }
      /* the year's three answers. Planting anew submits the field's words on
         the way out of its own screen; the one-press answers submit here.
         All three walk on into ritualfamily — no skip, the household screen
         is real now. */
      if (from === 'ritualplant' && key === 'ritualfamily') {
        void submitRitual('plant-new');
      }
      if (key === '__ritualReinforce') {
        void submitRitual('reinforce');
        setStep({ kind: 'walk', key: 'ritualfamily' });
        return;
      }
      if (key === '__ritualFulfilled') {
        void submitRitual('fulfilled');
        setStep({ kind: 'walk', key: 'ritualfamily' });
        return;
      }

      /* the invitation: email required, sent through api.ts, and the sent
         screen is reached only once the letter actually left */
      if (from === 'invite' && key === 'invitesent') {
        void submitInvite();
        return;
      }

      if (from === 'passconfirm' && key === 'passdone') {
        void submitPassing();
        return;
      }
      if (key === 'passname') setPassingKind('gift');
      if (key === 'passsell') setPassingKind('sale');
      const passingMethods = {
        __passingPaid: 'paid',
        __passingPartTrade: 'part_trade_paid',
        __passingTraded: 'traded',
        __passingGiven: 'given',
      } as const;
      if (key in passingMethods) {
        setPassingValueMethod(passingMethods[key as keyof typeof passingMethods]);
        setStep({ kind: 'walk', key: 'passready' });
        return;
      }
      if (key === '__cancelPassing') {
        void cancelPassing();
        return;
      }
      if (key === '__resendPassing') {
        void resendPassing();
        return;
      }
      if (key === '__acceptPassing') {
        void acceptPassing();
        return;
      }

      /* the removal: the grave two-press confirm (the seal-confirm idiom).
         First press arms and the screen says what a second press does;
         the same row pressed again commits through api.ts. */
      if (key === '__personRemove') {
        if (!removeArmed) {
          setRemoveArmed(true);
          return;
        }
        if (person) void submitRemove(person);
        return;
      }

      /* a pending invitation's own two actions: cancelling is single-press
         (nothing was ever placed), resending is a revoke and a fresh
         invite in one motion */
      if (key === '__personCancelInvite') {
        if (person && person.kind === 'invited') void submitRemove(person);
        return;
      }
      if (key === '__personResend') {
        if (person && person.kind === 'invited') void submitResendInvite(person);
        return;
      }

      if (key === 'codetrue' && giftPendingRef.current) {
        /* the one detour: before 'The code is true', the sealed message
           waiting from this exact bind. Consumed once — a later return to
           'codetrue' (the fork's quiet back link) never re-triggers it. */
        giftPendingRef.current = false;
        setStep({ kind: 'gift-message', stage: 'sealed' });
        return;
      }
      if (key === '__giftOpen') {
        setStep({ kind: 'gift-message', stage: 'written' });
        return;
      }
      if (key === 'sign') {
        /* the account already exists — the bind required it. The chain is
           sign → lives → who1 → who2 → light47 now (§7 2026-08-20, then
           the artist's second walk splitting who into two screens). */
        setStep({ kind: 'walk', key: 'lives' });
        return;
      }
      if (key === 'passfork') {
        if (senderPassing.status === 'ready' && senderPassing.data?.status === 'pending') {
          setActivePassing(senderPassing.data);
          setStep({ kind: 'walk', key: 'passdone' });
        } else {
          setStep({ kind: 'walk', key: 'passfork' });
        }
        return;
      }
      if (key === '__home') {
        refresh();
        setStep({ kind: 'piece' });
        return;
      }
      if (key === '__garden') {
        setStep({ kind: 'piece', room: 'garden' });
        return;
      }
      if (key === '__family') {
        setStep({ kind: 'piece', room: 'family' });
        return;
      }
      if (key === '__code') {
        setStep({ kind: 'code' });
        return;
      }
      if (key in WALK) setStep({ kind: 'walk', key: key as keyof typeof WALK });
    },
    [step, submitGathering, submitRitual, submitInvite, submitRemove, submitResendInvite, submitPassing, cancelPassing, acceptPassing, resendPassing, person, removeArmed, lamps, typed, refresh, senderPassing],
  );

  /* ---------------- the account bridge ---------------- */

  const openAccountBridge = useCallback(() => {
    /* the one passage that can reload the document: mirror first */
    pending.bridge();
    setAuthOpen(true);
  }, [pending]);

  const abandonAccountBridge = useCallback(() => {
    /* explicit abandonment is a terminal outcome */
    pending.settle();
    setStep({ kind: 'piece' });
  }, [pending]);

  /* ---------------- render ---------------- */

  let surface: React.ReactNode = null;

  if (step.kind === 'piece') {
    surface = (
      <PiecePage
        key={`piece-${step.room ?? 'page'}`}
        relationship={relationship}
        placed={placed}
        near={near}
        live={live}
        initialRoom={step.room ?? null}
        ground={groundInputs}
        canOpenGarden={Boolean(keeperStatus?.authorHistory)}
        onBegin={() => setStep({ kind: 'code' })}
        onSignIn={() => setAuthOpen(true)}
        onWalk={go}
      />
    );
  } else if (step.kind === 'code') {
    surface = (
      <CodePage
        key={`code-${step.initialCode ?? ''}-${step.initialWrong ? 'wrong' : ''}`}
        pieceName={identity.title}
        initialCode={step.initialCode}
        initialWrong={step.initialWrong}
        onSubmit={submitCode}
        onTrue={() => go('codetrue')}
        onNoCode={() => {
          pending.settle();
          setStep({ kind: 'piece' });
        }}
        onGift={() => go('gift')}
        onBack={() => {
          pending.settle();
          setStep({ kind: 'piece' });
        }}
      />
    );
  } else if (step.kind === 'walk') {
    if (['who1', 'who2', 'shows'].includes(step.key)
      && (onboarding.status !== 'ready' || privacy.status !== 'ready')) {
      const failed = onboarding.status === 'failed' || privacy.status === 'failed';
      surface = failed ? (
        <StateScreen state="offline" message={PRIVATE_READ_ERROR} receipt={[]}
          onPrimary={() => {
            if (onboarding.status === 'failed') onboarding.retry();
            if (privacy.status === 'failed') privacy.retry();
          }}
          onSecondary={() => setStep({ kind: 'piece' })}
          onBack={() => setStep({ kind: 'piece' })} />
      ) : <Ground light="i" wash><div style={{ flex: 1 }} /></Ground>;
    } else if (step.key === 'light47' && ordinalValue === null) {
      /* ignition waits for the real ordinal: a quiet hold while the atlas
         answers, the quiet retry state if it cannot */
      if (ordinal.status === 'loading') {
        surface = (
          <Ground light="i" wash>
            <div style={{ flex: 1 }} />
          </Ground>
        );
      } else {
        surface = (
          <StateScreen
            state="offline"
            receipt={[]}
            onPrimary={() => (ordinal.status === 'failed' ? ordinal.retry() : refresh())}
            onSecondary={() => setStep({ kind: 'piece' })}
            onBack={() => setStep({ kind: 'piece' })}
          />
        );
      }
    } else if (step.key === 'codetrue') {
      /* codetrue's entrance dress, not a separate route: the same screen
         WalkScreen would otherwise render for this key, dressed with the
         vault arrival. `play` is read once per mount (see the ref above and
         VaultArrival's own header) so a return to this exact key later in
         the same journey renders already settled. */
      const play = !arrivalPlayedRef.current;
      arrivalPlayedRef.current = true;
      surface = <VaultArrival play={play} onGo={go} screen={wiredScreen('codetrue')} />;
    } else {
      surface = (
        <fieldset disabled={gatheringBusy} aria-busy={gatheringBusy} style={{ display: 'contents' }}>
        <WalkScreen
          screen={wiredScreen(step.key)}
          onGo={go}
          values={typed}
          onType={(label, value) => {
            if (label === COPY.passing.readyField && typed[label] !== value) {
              passingAttempt.current = null;
            }
            setTyped(t => ({ ...t, [label]: value }));
          }}
          lampsValue={lamps}
          onLamps={next => { lampsEdited.current = true; setLamps(next); }}
        />
        </fieldset>
      );
    }
  } else if (step.kind === 'gift-message') {
    /* the sealed artist message, met once right after the vault. 'sealed'
       renders WALK.sealed exactly as authored — the teaser is the same for
       a collector's gift or the artist's own words, by design. 'written'
       renders WALK.written's shape with its body swapped for the real
       message; every other field (head, link text) stays exactly as
       authored, and its link continues the walk into 'codetrue' rather than
       returning home, since the four screens still follow. */
    const screen: Screen = step.stage === 'sealed'
      ? { ...WALK.sealed, to: '__giftOpen' }
      : { ...WALK.written, body: giftMessageBody ?? WALK.written.body, linkTo: 'codetrue' };
    surface = (
      <WalkScreen
        screen={screen}
        onGo={go}
        values={typed}
        onType={(label, value) => setTyped(t => ({ ...t, [label]: value }))}
        lampsValue={lamps}
        onLamps={setLamps}
      />
    );
  } else if (step.kind === 'passing-result') {
    const copy = {
      accepted: ['The passing is complete', 'This piece now rests with its next caretaker.'],
      cancelled: ['The passing was stopped', 'Nothing moved.'],
      expired: ['The passing has expired', 'Nothing moved. Its caretaker can begin again.'],
      error: ['The passing did not land', 'Nothing moved. Return to the piece and try again.'],
    }[step.state];
    surface = (
      <WalkScreen
        screen={{ head: ph(copy[0]), body: ph(copy[1]), link: COPY.threshold.writtenReturn, linkTo: '__home', light: 'f', caption: 'The passing · current state' }}
        onGo={go}
        values={typed}
        onType={(label, value) => setTyped(t => ({ ...t, [label]: value }))}
        lampsValue={lamps}
        onLamps={setLamps}
      />
    );
  } else {
    surface = (
      <StateScreen
        state={step.key}
        heldCode={step.key === 'account' ? pending.peek()?.normalizedCode : undefined}
        onPrimary={
          step.key === 'account'
            ? openAccountBridge
            : step.key === 'verify'
              ? openAccountBridge
              : step.onRetry ?? (() => setStep({ kind: 'piece' }))
        }
        onSecondary={
          step.key === 'account' ? openAccountBridge : () => setStep({ kind: 'piece' })
        }
        onBack={
          step.key === 'account' || step.key === 'verify'
            ? abandonAccountBridge
            : () => setStep({ kind: 'piece' })
        }
        receipt={step.receipt}
        message={step.message}
      />
    );
  }

  return (
    <>
      {surface}
      {authOpen && (
        <SignInModal
          onClose={() => setAuthOpen(false)}
          onSignedIn={() => {
            setAuthOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Chrome: the journey needs a positioned, screen-sized ancestor (every
 * Ground fills its container). The works page brings a full-height room;
 * the shell brings its phone frame and uses WiredJourney directly.
 * ------------------------------------------------------------------ */

export type WiredCollectorArrivalProps = {
  identity: PublicPlateIdentity;
  /** the compiled catalog record, when one exists, for the story room */
  artwork?: { description?: string; longDescription?: string } | null;
  beginClaim?: boolean;
};

const WiredCollectorArrival: React.FC<WiredCollectorArrivalProps> = ({
  identity,
  artwork = null,
  beginClaim = false,
}) => {
  const story = useMemo(() => {
    const paragraphs = [artwork?.longDescription || artwork?.description].filter(
      (text): text is string => Boolean(text),
    );
    return paragraphs.length > 0 ? { lead: null, paragraphs } : null;
  }, [artwork]);

  return (
    <PendingBindProvider>
      <div
        className="collector-root"
        data-marks="0"
        style={{
          background: C.void,
          minHeight: '100dvh',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <CollectorStyles />
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 430,
            height: '100dvh',
            background: C.ground,
            overflow: 'hidden',
          }}
        >
          <WiredJourney identity={identity} story={story} beginClaim={beginClaim} />
        </div>
      </div>
    </PendingBindProvider>
  );
};

/**
 * Shell wired mode: resolve a typed public code to its identity, then run
 * the journey. Loading and failure keep the quiet presentation.
 */
export const WiredByCode: React.FC<{ publicCode: string }> = ({ publicCode }) => {
  const identity = useQuiet<PublicPlateIdentity | null>(
    Boolean(publicCode),
    async () => {
      const outcome = await getRegistryIdentity(publicCode);
      if (outcome.ok) return outcome.data;
      if (outcome.status === 404) return null;
      throw outcome;
    },
    [publicCode],
  );

  if (identity.status === 'ready' && identity.data) {
    return (
      <PendingBindProvider>
        <WiredJourney identity={identity.data} />
      </PendingBindProvider>
    );
  }
  return (
    <Ground light="b">
      <div style={{ flex: 1 }} />
      {identity.status === 'failed' && (
        <div style={{ position: 'relative', flex: 'none', paddingBottom: 12 }}>
          <button
            type="button"
            onClick={identity.retry}
            style={{
              background: 'none',
              border: 0,
              cursor: 'pointer',
              color: C.inkQuiet,
              fontFamily: 'inherit',
              fontSize: 13.5,
              padding: 0,
            }}
          >
            {COPY.code.tryAgain}
          </button>
        </div>
      )}
    </Ground>
  );
};

export default WiredCollectorArrival;
