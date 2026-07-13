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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function projectIssuedPlateResponse(value: unknown): IssuedPlatePackage {
  if (!isRecord(value) || !isRecord(value.manifest)) {
    throw new Error('Incomplete issuance package');
  }
  const requiredStrings = [
    'ownershipCode', 'publicCode', 'publicUrl', 'frontSvg', 'undersideSvg',
    'frontSha256', 'undersideSha256',
  ] as const;
  if (requiredStrings.some((field) => typeof value[field] !== 'string' || !value[field])) {
    throw new Error('Incomplete issuance package');
  }
  const manifest = value.manifest;
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.publicCode !== 'string' ||
    typeof manifest.artworkId !== 'string' ||
    !Number.isSafeInteger(manifest.editionNumber) ||
    typeof manifest.publicUrl !== 'string' ||
    typeof manifest.ownershipCode !== 'string' ||
    typeof manifest.frontSha256 !== 'string' ||
    typeof manifest.undersideSha256 !== 'string' ||
    typeof manifest.generatedAt !== 'string'
  ) {
    throw new Error('Incomplete issuance package manifest');
  }
  for (const field of ['publicCode', 'publicUrl', 'ownershipCode', 'frontSha256', 'undersideSha256'] as const) {
    if (value[field] !== manifest[field]) {
      throw new Error(`Issuance package mismatch: ${field}`);
    }
  }
  return {
    ownershipCode: value.ownershipCode as string,
    publicCode: value.publicCode as string,
    publicUrl: value.publicUrl as string,
    frontSvg: value.frontSvg as string,
    undersideSvg: value.undersideSvg as string,
    frontSha256: value.frontSha256 as string,
    undersideSha256: value.undersideSha256 as string,
    manifest: {
      schemaVersion: 1,
      publicCode: manifest.publicCode as string,
      artworkId: manifest.artworkId as string,
      editionNumber: manifest.editionNumber as number,
      publicUrl: manifest.publicUrl as string,
      ownershipCode: manifest.ownershipCode as string,
      frontSha256: manifest.frontSha256 as string,
      undersideSha256: manifest.undersideSha256 as string,
      generatedAt: manifest.generatedAt as string,
    },
    ...(typeof value.backupStatus === 'string' ? { backupStatus: value.backupStatus } : {}),
    ...(typeof value.warning === 'string' ? { warning: value.warning } : {}),
  };
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
