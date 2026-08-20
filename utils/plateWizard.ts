/**
 * Pure, isomorphic stage logic for the guided artwork-plate wizard
 * (components/AdminPlateWizard.tsx).
 *
 * The wizard is a linear, one-piece-at-a-time re-presentation of the existing
 * Artwork Registry desk (components/AdminPieces.tsx). It drives the SAME admin
 * endpoints; it adds no new server behavior. Keeping the stage math here — pure
 * and free of React or fetch — lets it be unit tested and keeps the component
 * focused on rendering.
 *
 * The wizard is fabrication-only: it starts from an artwork that is already a
 * registered identity (minted at /admin/register) and covers only the four
 * doing-stages that add and verify optional physical fabrication:
 *   Fabrication files → Encrypted backup → Prove recovery → Activate
 * Registering a new artwork identity happens at /admin/register, not here.
 */

export type PlateWizardStageKey =
  | 'fabricate'
  | 'backup'
  | 'recovery'
  | 'activate';

export interface PlateWizardStage {
  key: PlateWizardStageKey;
  title: string;
  summary: string;
}

/** The permanent, ordered spine of the wizard. Order is the flow. */
export const PLATE_WIZARD_STAGES: readonly PlateWizardStage[] = [
  {
    key: 'fabricate',
    title: 'Fabrication files',
    summary: 'Download the front and underside SVGs and the private manifest for the etcher.',
  },
  {
    key: 'backup',
    title: 'Encrypted backup',
    summary: 'Confirm the encrypted Ownership Code envelope is mirrored to R2.',
  },
  {
    key: 'recovery',
    title: 'Prove recovery',
    summary: 'Rebuild the plate from the encrypted backup alone, before any metal is cut.',
  },
  {
    key: 'activate',
    title: 'Activate',
    summary: 'Check the real engraved metal, then lock the identity permanently.',
  },
] as const;

/** State needed to place an already-registered piece back into the flow. */
export interface PlateLifecycleSnapshot {
  plateStatus: string; // 'legacy' | 'generated' | 'active'
  backupStatus: string | null; // 'pending' | 'failed' | 'verified' | null
  recoveryQualificationStatus?: 'missing' | 'stale' | 'current';
  /** Whether this row is a minted, registered identity (has a public code). */
  registered?: boolean;
}

/**
 * The earliest incomplete stage for RESUMING a piece already in the registry.
 * Returns null when the piece is either not wizard-eligible (an unregistered
 * legacy row with no minted identity) or active with a current copied-file
 * recovery proof.
 *
 * A registered identity with no plate fabricated yet (plate status 'legacy')
 * starts at 'fabricate'. A freshly generated plate whose backup is not yet
 * verified must repair the backup first, so it resumes at 'backup'. Once
 * verified, it resumes at 'fabricate' so the operator can re-download the etch
 * files and walk forward through the recovery drill and activation. An active
 * identity whose backup dependencies changed is reopened at recovery and must
 * pass the physical activation checks again after its copied-file proof is
 * renewed.
 */
export function plateWizardStageForPiece(
  piece: PlateLifecycleSnapshot,
): PlateWizardStageKey | null {
  if (piece.plateStatus === 'generated') {
    return piece.backupStatus === 'verified' ? 'fabricate' : 'backup';
  }
  if (piece.plateStatus === 'active') {
    return piece.backupStatus === 'verified'
      && piece.recoveryQualificationStatus !== 'current'
      ? 'recovery'
      : null;
  }
  if (piece.plateStatus === 'legacy' && piece.registered) {
    return 'fabricate'; // registered identity, no plate fabricated yet
  }
  return null; // unregistered legacy row, or unknown — not wizard-eligible
}

/** Index of a stage in PLATE_WIZARD_STAGES, or -1 if unknown. */
export function plateWizardStageIndex(key: PlateWizardStageKey): number {
  return PLATE_WIZARD_STAGES.findIndex((stage) => stage.key === key);
}
