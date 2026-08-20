/**
 * The shapes the wired journey threads through the demo surfaces.
 *
 * Every screen in components/collector/ renders demo content when no `live`
 * object is passed — that keeps CollectorShell's demo mode (Adrian's review
 * vehicle) byte-for-byte what it was. When `wired.tsx` passes one of these,
 * the same screens render real registry data instead.
 *
 * Types only. No fetching here — all network access stays in api.ts, and all
 * orchestration stays in wired.tsx.
 */

import type { PublicPlateIdentity } from '../../utils/publicRegistry';
import type {
  CertificateContent,
  CollectorDreamState,
  CollectorLetter,
  CollectorRitualEligibility,
  CurrentKeeperPriceEntry,
  DreamTier,
  LineageOutcome,
} from './api';

/** A network-backed value with the quiet loading/failure presentation. */
export type Quiet<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; retry: () => void };

/**
 * How a placement resolved.
 *   landed  everything asked for is now in the registry
 *   held    the quiet failure: nothing is lost, the same brass tries again
 *   locked  the server's yearly gate answered: the words settle until the
 *           birthday window opens. A state, never an error.
 */
export type GardenPlaceOutcome = 'landed' | 'held' | 'locked';

/** What the wired garden can do. All writes go through api.ts in wired.tsx. */
export type GardenLive = {
  /** the piece's dream state, for the index */
  dreams: Quiet<CollectorDreamState | null>;
  /**
   * Whether the yearly window is open for editing the standing words. First
   * placement is never gated, and neither are tier moves — only a body edit
   * on the existing dream waits for the birthday. Unknown eligibility reads
   * as open: the server is the real gate either way, and `place` answers
   * 'locked' when it refuses.
   */
  editWindowOpen: boolean;
  /**
   * Place words in the piece at a tier (§6 "Three tiers, and what outlives
   * you"): create the dream, or version-checked update of the standing one,
   * then the tier move the choice asks for. The allowed moves mirror the
   * backend's matrix — keep→shine, keep→seal, seal→shine; shine is
   * permanent and keep is never a destination once the dream stands.
   * Un-shining does not exist anywhere.
   */
  place: (
    body: string,
    tier: DreamTier,
    /**
     * "The ones who come after may share this," meaningful only on the FIRST
     * placement (the create call carries it; no wire exists to change it on
     * a standing dream). Omitted, the server default (ON) stands.
     */
    heirsMayShare?: boolean,
  ) => Promise<GardenPlaceOutcome>;
};

/**
 * One person on the piece: an active contributor, or an invitation still
 * waiting for its answer. Email and status are ALL the registry holds —
 * utils/artworkContributors.ts's verified wire shape has no name, relation,
 * or words model, and no screen may pretend otherwise.
 */
export type FamilyPerson =
  | { kind: 'contributor'; accessId: string; email: string; grantedAt: string }
  | { kind: 'invited'; invitationId: string; email: string; invitedAt: string };

/**
 * What the wired household room reads. The WRITES (invite, the grave
 * two-press removal) live on the walked screens, orchestrated by wired.tsx
 * through api.ts — the room itself only lists and opens.
 */
export type FamilyLive = {
  /** everyone on the piece, quiet-presented; an empty list is an absence */
  people: Quiet<FamilyPerson[]>;
  /** open one person's screen (wired.tsx holds the selection) */
  open: (person: FamilyPerson) => void;
};

/** Everything the live piece page and its rooms read. */
export type PieceLive = {
  identity: PublicPlateIdentity;
  /** the shared public dream, when the piece lets one shine */
  dream: Quiet<{ body: string; attribution: string | null } | null>;
  certificate: Quiet<CertificateContent | null>;
  lineage: Quiet<LineageOutcome>;
  /** the real claim ordinal (Light N), when the atlas has projected it */
  ordinal: number | null;
  /**
   * The caretaker's story text for the piece, from the catalog record.
   * `commissioned` is the commissioner's own paragraph, why they asked for
   * the piece — TODO(server): no wire supplies it yet; it is a future field
   * on the catalog/registry record, typed now so the story room can render
   * it the day it lands.
   */
  story: { lead: string | null; paragraphs: string[]; commissioned?: string | null } | null;
  /** caretaker-only extras */
  displayLocation: string | null;
  /**
   * What was paid, from the keeper certificate ledger. Non-null ONLY when
   * the piece is yours — guests and past keepers never fetch or carry it.
   * The room renders the latest entry masked until the caretaker reveals it.
   */
  priceHistory: Quiet<CurrentKeeperPriceEntry[]> | null;
  accountEmail: string | null;
  ritual: CollectorRitualEligibility | null;
  garden: GardenLive | null;
  /** the household, when the piece is yours */
  family: FamilyLive | null;
  /** what the piece has written, read-only, when the piece is yours */
  letters: Quiet<CollectorLetter[]> | null;
  /**
   * Move the light: PUT the display location through api.ts. Resolves true
   * when it landed; the caller keeps the typed value either way.
   */
  setDisplayLocation: ((value: string) => Promise<boolean>) | null;
};
