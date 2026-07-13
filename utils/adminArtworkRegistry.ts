import type { ArtworkPlateManifest } from './artworkPlate';

export interface IssuedPlatePackage {
  ownershipCode: string;
  publicCode: string;
  publicUrl: string;
  frontSvg: string;
  undersideSvg: string;
  frontSha256: string;
  undersideSha256: string;
  manifest: ArtworkPlateManifest;
  backupStatus?: string;
  warning?: string;
}

export interface SensitivePlateState {
  issuanceKey: string | null;
  package: IssuedPlatePackage | null;
  revealedForPieceId: string | null;
  revealedOwnershipCode: string | null;
  revealedUndersideSvg: string | null;
  stepUpSecret: string;
}

export interface PlateDownload {
  filename: string;
  mimeType: 'image/svg+xml' | 'application/json';
  content: string;
}

export interface ActivationChecklist {
  realMetalQrScanned: boolean;
  artworkEditionPublicCodeMatch: boolean;
  undersideOwnershipCodeMatch: boolean;
  attachmentAndAbrasionInspected: boolean;
  frontSha256: string;
  undersideSha256: string;
}

export function beginIssuanceAttempt(
  currentKey: string | null,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  return currentKey || createKey();
}

export function projectPlateDownloads(
  plate: Pick<IssuedPlatePackage, 'publicCode' | 'frontSvg' | 'undersideSvg' | 'manifest'>,
): PlateDownload[] {
  return [
    {
      filename: `${plate.publicCode}-front.svg`,
      mimeType: 'image/svg+xml',
      content: plate.frontSvg,
    },
    {
      filename: `${plate.publicCode}-underside-private.svg`,
      mimeType: 'image/svg+xml',
      content: plate.undersideSvg,
    },
    {
      filename: `${plate.publicCode}-manifest-private.json`,
      mimeType: 'application/json',
      content: `${JSON.stringify(plate.manifest, null, 2)}\n`,
    },
  ];
}

export function activationChecklistComplete(
  checklist: ActivationChecklist,
  storedFrontSha256: string,
  storedUndersideSha256: string,
): boolean {
  return checklist.realMetalQrScanned === true &&
    checklist.artworkEditionPublicCodeMatch === true &&
    checklist.undersideOwnershipCodeMatch === true &&
    checklist.attachmentAndAbrasionInspected === true &&
    checklist.frontSha256 === storedFrontSha256 &&
    checklist.undersideSha256 === storedUndersideSha256;
}

export function clearSensitivePlateState(_state: SensitivePlateState): SensitivePlateState {
  return {
    issuanceKey: null,
    package: null,
    revealedForPieceId: null,
    revealedOwnershipCode: null,
    revealedUndersideSvg: null,
    stepUpSecret: '',
  };
}
