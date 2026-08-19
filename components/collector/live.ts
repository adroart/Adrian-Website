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
  CollectorRitualEligibility,
  LineageOutcome,
} from './api';

/** A network-backed value with the quiet loading/failure presentation. */
export type Quiet<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; retry: () => void };

/** What the wired garden can do. All writes go through api.ts in wired.tsx. */
export type GardenLive = {
  /** the piece's dream state, for the index */
  dreams: Quiet<CollectorDreamState | null>;
  /**
   * Place words in the piece: create or version-checked update of the current
   * dream, then share (anonymous) or revoke to private per the capsule.
   * Resolves true when everything landed; false is the quiet failure.
   */
  place: (body: string, shine: boolean) => Promise<boolean>;
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
  /** the caretaker's story text for the piece, from the catalog record */
  story: { lead: string | null; paragraphs: string[] } | null;
  /** caretaker-only extras */
  displayLocation: string | null;
  accountEmail: string | null;
  ritual: CollectorRitualEligibility | null;
  garden: GardenLive | null;
};
