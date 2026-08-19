/**
 * Shared helpers for admin piece and plate management components.
 * Used by AdminPieces.tsx and AdminPlateWizard.tsx.
 */
import type { ActivationChecklist } from './adminArtworkRegistry';
import { FULL_ARCHIVE } from '../data/mockData';

export interface PieceRow {
  id: string;
  pieceId: string;
  editionNumber: number;
  publicCode: string | null;
  plateStatus: string;
  backupStatus: string | null;
  backupReference: string | null;
  backupSha256: string | null;
  frontSha256: string | null;
  undersideSha256: string | null;
  plateGeneratedAt: string | null;
  plateActivatedAt: string | null;
  backupAt: string | null;
  keeperBound: boolean;
  currentDisplayLocation: string | null;
  registeredAt: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
  recoveryQualification?: {
    status: 'missing' | 'stale' | 'current';
    reasons: string[];
    qualifiedAt: string | null;
  };
}

export interface MintableArtwork {
  id: string;
  title: string;
  draft: boolean;
  editionKind: 'unique' | 'numbered' | 'unspecified' | 'conflict';
  editionSize: number | null;
}

export const emptyChecklist: ActivationChecklist = {
  realMetalQrScanned: false,
  artworkEditionPublicCodeMatch: false,
  undersideOwnershipCodeMatch: false,
  attachmentAndAbrasionInspected: false,
  frontSha256: '',
  undersideSha256: '',
};

export const TITLE_BY_ID: Record<string, string> = Object.fromEntries(
  FULL_ARCHIVE.map((artwork) => [artwork.id, artwork.title]),
);

export function titleFor(pieceId: string): string {
  return TITLE_BY_ID[pieceId] || pieceId;
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'Not yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

export async function jsonRequest(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

export function downloadText(filename: string, mimeType: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
