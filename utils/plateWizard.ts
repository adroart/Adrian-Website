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
 * The seven doing-stages mirror docs/lineage-plate-runbook.md exactly:
 *   Issue → Fabrication files → Encrypted backup → Prove recovery →
 *   Activate → Assign → Ship
 */

export type PlateWizardStageKey =
  | 'issue'
  | 'fabricate'
  | 'backup'
  | 'recovery'
  | 'activate'
  | 'assign'
  | 'ship';

export interface PlateWizardStage {
  key: PlateWizardStageKey;
  title: string;
  summary: string;
}

/** The permanent, ordered spine of the wizard. Order is the flow. */
export const PLATE_WIZARD_STAGES: readonly PlateWizardStage[] = [
  {
    key: 'issue',
    title: 'Issue identity',
    summary: 'Mint the permanent public QR code and the secret Ownership Code.',
  },
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
  {
    key: 'assign',
    title: 'Assign',
    summary: 'Tie the exact active plate to a paid order or an opaque manual handoff.',
  },
  {
    key: 'ship',
    title: 'Ship',
    summary: 'Do the final physical comparison, then mark the piece shipped.',
  },
] as const;

/** State needed to place an already-registered piece back into the flow. */
export interface PlateLifecycleSnapshot {
  plateStatus: string; // 'legacy' | 'generated' | 'active'
  backupStatus: string | null; // 'pending' | 'failed' | 'verified' | null
  hasFulfillment: boolean;
  shipped: boolean;
}

/**
 * The earliest incomplete stage for RESUMING a piece already in the registry.
 * Returns null when the piece is either not wizard-eligible (a legacy row with
 * no minted plate identity) or already fully shipped (nothing left to do).
 *
 * A freshly generated plate whose backup is not yet verified must repair the
 * backup first, so it resumes at 'backup'. Once verified, it resumes at
 * 'fabricate' so the operator can re-download the etch files and walk forward
 * through the recovery drill and activation.
 */
export function plateWizardStageForPiece(
  piece: PlateLifecycleSnapshot,
): PlateWizardStageKey | null {
  if (piece.plateStatus === 'generated') {
    return piece.backupStatus === 'verified' ? 'fabricate' : 'backup';
  }
  if (piece.plateStatus === 'active') {
    if (!piece.hasFulfillment) return 'assign';
    if (!piece.shipped) return 'ship';
    return null; // active, assigned, and shipped — complete
  }
  return null; // legacy or unknown — not wizard-eligible
}

/** Index of a stage in PLATE_WIZARD_STAGES, or -1 if unknown. */
export function plateWizardStageIndex(key: PlateWizardStageKey): number {
  return PLATE_WIZARD_STAGES.findIndex((stage) => stage.key === key);
}
