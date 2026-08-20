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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from '../../lib/account/useAccount';
import SignInModal from '../account/SignInModal';
import { C } from './tokens';
import { COPY, PIECE } from './copy';
import { CollectorStyles } from './styles';
import { Ground } from './ui';
import { PiecePage, Relationship } from './PiecePage';
import { CodePage, CodeSubmitOutcome } from './CodePage';
import { WALK, WalkScreen, Screen } from './walk';
import { StateScreen } from './states';
import type { RoomKey } from './rooms';
import { PendingBindProvider, usePendingBind, normalizeTypedCode } from './pendingBind';
import type { GardenLive, PieceLive, Quiet } from './live';
import {
  bindKeeper,
  completeYearlyRitual,
  createCollectorDream,
  getAtlasOrdinal,
  getCertificate,
  getCollectorCuratedCities,
  getCollectorDreamState,
  getKeeperMessage,
  getKeeperPieceStatus,
  getLineage,
  getPublicDream,
  getRegistryIdentity,
  getYearlyRitualEligibility,
  saveCollectorBirthProfile,
  setCollectorDreamTier,
  shareCollectorDream,
  updateCollectorDream,
  updateCollectorPrivacy,
  CollectorApiNetworkError,
} from './api';
import type {
  CertificateContent,
  CollectorDreamState,
  CollectorRitualEligibility,
  DreamTier,
  KeeperPieceStatus,
  LineageOutcome,
  PublicCollectorDream,
} from './api';
import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import { searchPlaces } from '../../lib/astrology/places';

const G = COPY.gathering;

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
  | {
      kind: 'state';
      /**
       * 'notyet' is the honest passing (D4): the passing screens exist as
       * demo surfaces but nothing behind them is wired, so the live door
       * says so instead of staging a passing that cannot happen.
       */
      key: 'account' | 'plate' | 'offline' | 'notyet';
      onRetry?: () => void;
      receipt?: [string, string][];
    };

export type WiredJourneyProps = {
  identity: PublicPlateIdentity;
  /** the catalog record's story text, when the piece is in the compiled catalog */
  story?: { lead: string | null; paragraphs: string[] } | null;
  /** arrive straight on the code page (?claim=1, or a door already pressed) */
  beginClaim?: boolean;
};

export const WiredJourney: React.FC<WiredJourneyProps> = ({
  identity,
  story = null,
  beginClaim = false,
}) => {
  const publicCode = identity.publicCode;
  const account = useAccount();
  const pending = usePendingBind();
  const signedIn = account.available && account.isLoaded && account.isSignedIn;

  const [step, setStep] = useState<Step>(
    beginClaim ? { kind: 'code' } : { kind: 'piece' },
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [lamps, setLamps] = useState<boolean[]>([true, true, false]);
  const [grain, setGrain] = useState<0 | 1>(0);
  const [cityId, setCityId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  /* the sealed artist message: fetched once, right on a bound outcome,
     before the code-is-true screen. giftMessageBody holds the real body for
     the 'written'-shaped reveal; giftPendingRef is consumed the one time
     'codetrue' is reached right after this bind, so a later visit to
     'codetrue' (e.g. back from 'fork') never re-triggers the detour. */
  const [giftMessageBody, setGiftMessageBody] = useState<string | null>(null);
  const giftPendingRef = useRef(false);

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
      const outcome = await getCertificate(identity.artworkId, publicCode);
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
             is mirrored again for the round trip that can reload the page. */
          pending.hold(code.publicCode, code.normalizedCode);
          pending.bridge();
          setStep({ kind: 'state', key: 'account' });
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
    [pending, refresh],
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

  /* ---------------- the gathering submissions ----------------
   * Failures never cost the person their words: everything typed stays in
   * the `typed` record, network drops surface the offline receipt state, and
   * server-rule rejections (no adult birth profile on file, an uncurated
   * city) quietly keep the value client-side. */

  const submitBorn = useCallback(async (): Promise<'landed' | 'kept' | 'dropped'> => {
    const date = parseBirthDate(typed[G.fieldDate] ?? '');
    const time = parseBirthTime(typed[G.fieldTime] ?? '');
    const placeText = (typed[G.fieldPlace] ?? '').trim();
    if (!date || !time || !placeText) return 'kept';
    let place;
    try {
      [place] = await searchPlaces(placeText, 1);
    } catch {
      place = undefined;
    }
    if (!place) return 'kept';
    try {
      const outcome = await saveCollectorBirthProfile({ date, time, place });
      return outcome.ok ? 'landed' : 'kept';
    } catch (cause) {
      if (cause instanceof CollectorApiNetworkError) return 'dropped';
      return 'kept';
    }
  }, [typed]);

  const resolveCity = useCallback(async (): Promise<void> => {
    const cityText = (typed[G.fieldCity] ?? '').trim().toLowerCase();
    if (!cityText) return;
    try {
      const outcome = await getCollectorCuratedCities();
      if (!outcome.ok) return;
      const hit = outcome.data.find(city => city.label.toLowerCase().includes(cityText));
      setCityId(hit ? hit.id : null);
    } catch {
      /* uncurated for now; the light stays client-side until it can be placed */
    }
  }, [typed]);

  const submitShows = useCallback(
    async (chosen: boolean[]): Promise<'landed' | 'kept' | 'dropped'> => {
      let landed = false;
      try {
        if (keeperPieceId && cityId) {
          const outcome = await updateCollectorPrivacy({
            piece: { keeperPieceId, shareCity: Boolean(chosen[1]), cityId },
          });
          landed = landed || outcome.ok;
        }
        const person = await updateCollectorPrivacy({
          person: {
            shareDerivedChart: false,
            shareFace: Boolean(chosen[2]),
            shareName: Boolean(chosen[2]),
            shareIntention: Boolean(chosen[0]),
            shareBusiness: false,
            shareMission: false,
          },
        });
        landed = landed || person.ok;
        return landed ? 'landed' : 'kept';
      } catch (cause) {
        if (cause instanceof CollectorApiNetworkError) return 'dropped';
        return 'kept';
      }
    },
    [keeperPieceId, cityId],
  );

  const submitRitual = useCallback(async () => {
    const body = (typed[COPY.ritual.field] ?? '').trim();
    if (!keeperPieceId || !body) return;
    try {
      await completeYearlyRitual({
        keeperPieceId,
        action: 'plant-new',
        body,
        scope: 'self',
      });
      refresh();
    } catch {
      /* the words stay in the field; the door reopens from the piece */
    }
  }, [keeperPieceId, typed, refresh]);

  /* ---------------- garden live ----------------
   * The three tiers (§6 "Three tiers, and what outlives you"), mirrored from
   * the backend's settled matrix: keep→shine, keep→seal, seal→shine. Shine
   * is permanent, keep is never a destination once the dream stands, and
   * UN-SHINING DOES NOT EXIST — revokeCollectorDreamSharing is never called
   * here or anywhere else, because a public dream entered the permanent
   * record the moment it shone. */

  const ritualEligibility = ritual.status === 'ready' ? ritual.data : null;

  const gardenLive: GardenLive | null = useMemo(() => {
    if (!isYours || !keeperPieceId) return null;

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
      /* The yearly gate, pre-empted for the UI: outside the window the
         standing BODY settles. Unknown eligibility reads open — the server
         is the real gate, and `place` answers 'locked' when it refuses. */
      editWindowOpen: ritualEligibility?.eligible !== false,
      place: async (body: string, tier: DreamTier) => {
        try {
          const current = dreams.status === 'ready' ? dreams.data?.current ?? null : null;
          /* whether anything already landed, so a half-landed placement
             refreshes to true state before the quiet retry */
          let landedAny = false;

          if (!current) {
            /* first placement: the dream is planted (the server plants at
               keep with heirs ON), then moved to the asked-for tier.
               api.ts's create does not carry tier/heirsMayShare yet (T2b);
               the two-step lands the identical end state. */
            const planted = await createCollectorDream({ keeperPieceId, body, scope: 'self' });
            if (!planted.ok) return 'held';
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
                return editFail === 'outside_birthday_window' ? 'locked' : 'held';
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

  /* ---------------- the live object the screens read ---------------- */

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
      accountEmail: account.email,
      ritual: ritual.status === 'ready' ? ritual.data : null,
      garden: gardenLive,
    }),
    [identity, dream, certificate, lineage, ordinalValue, story, keeperStatus, account.email, ritual, gardenLive],
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
         it to correct */
      if (key === 'born') screen.back = undefined;
      return screen;
    },
    [swap],
  );

  /* ---------------- navigation ---------------- */

  const go = useCallback(
    (key: string) => {
      const from = step.kind === 'walk' ? step.key : null;

      /* side effects on leaving a gathering screen by its own brass */
      if (from === 'born' && key === 'lives') {
        void submitBorn().then(result => {
          if (result === 'dropped') {
            setStep({
              kind: 'state',
              key: 'offline',
              receipt: [
                [G.fieldDate, typed[G.fieldDate] ?? ''],
                [G.fieldPlace, typed[G.fieldPlace] ?? ''],
              ].filter(([, value]) => value) as [string, string][],
              onRetry: () => setStep({ kind: 'walk', key: 'born' }),
            });
          }
        });
      }
      if (from === 'lives' && key === 'links') void resolveCity();
      if (from === 'shows' && key === 'light47') {
        void submitShows(lamps).then(result => {
          if (result === 'dropped') {
            setStep({
              kind: 'state',
              key: 'offline',
              receipt: (typed[G.fieldCity]
                ? [[G.fieldCity, typed[G.fieldCity]]]
                : []) as [string, string][],
              onRetry: () => setStep({ kind: 'walk', key: 'shows' }),
            });
          }
        });
      }
      if (from === 'ritual' && key === 'ritualfamily') {
        void submitRitual();
        setStep({ kind: 'piece' });
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
        /* the account already exists — the bind required it */
        setStep({ kind: 'walk', key: 'born' });
        return;
      }
      if (key === 'passfork') {
        /* the honest passing (D4): the passing screens are demo surfaces
           with nothing wired behind them, and walking a live caretaker into
           a passing that cannot complete would be a lie. One quiet state
           says the passing opens here soon, and the piece is untouched. */
        setStep({ kind: 'state', key: 'notyet' });
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
    [step, submitBorn, resolveCity, submitShows, submitRitual, lamps, typed, refresh],
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
    if (step.key === 'light47' && ordinalValue === null) {
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
    } else {
      surface = (
        <WalkScreen
          screen={wiredScreen(step.key)}
          onGo={go}
          values={typed}
          onType={(label, value) => setTyped(t => ({ ...t, [label]: value }))}
          lampsValue={lamps}
          onLamps={setLamps}
          grainValue={grain}
          onGrain={setGrain}
        />
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
        grainValue={grain}
        onGrain={setGrain}
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
            : step.onRetry ?? (() => setStep({ kind: 'piece' }))
        }
        onSecondary={
          step.key === 'account' ? openAccountBridge : () => setStep({ kind: 'piece' })
        }
        onBack={step.key === 'account' ? abandonAccountBridge : () => setStep({ kind: 'piece' })}
        receipt={step.receipt}
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
