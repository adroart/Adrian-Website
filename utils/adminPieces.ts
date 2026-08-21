/**
 * Shared helpers for admin piece and plate management components.
 * Used by AdminPieces.tsx and AdminPlateWizard.tsx.
 */
import type { ActivationChecklist } from './adminArtworkRegistry';
import { FULL_ARCHIVE } from '../data/mockData';

export interface PieceRecordSummary {
  hash: string;
  generatedAt: string;
  trigger: string;
  legacySections: boolean;
  ageDays: number | null;
  stale: boolean;
}

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
  record: PieceRecordSummary | null;
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

/** One piece's outcome from POST /api/admin/records/rebuild. */
export interface RecordRebuildOutcome {
  publicCode: string | null;
  status: 'generated' | 'unchanged' | 'failed' | 'skipped';
  recordHash?: string;
  error?: string;
}

/** The full response body of POST /api/admin/records/rebuild (200 or 207). */
export interface RecordRebuildResult {
  ok: boolean;
  generatedAt: string;
  trigger: string;
  total: number;
  generated: number;
  unchanged: number;
  failed: number;
  outcomes: RecordRebuildOutcome[];
}

/**
 * POST /api/admin/records/rebuild for one piece or the whole registry. The
 * endpoint deliberately answers 207 with a per-piece outcome list whenever
 * any piece failed; response.ok is still true for a 207 (it is a 2xx
 * status), so this reads the body itself rather than trusting response.ok,
 * and treats the presence of an outcomes array as "this is a real rebuild
 * result" regardless of whether every piece in it succeeded. A response with
 * no outcomes array (registry_locked, invalid_public_code, the bucket not
 * configured, and so on) is a genuine request failure and throws.
 */
export async function requestRecordRebuild(
  url: string,
  body?: Record<string, unknown>,
): Promise<RecordRebuildResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => null);
  if (!data || !Array.isArray(data.outcomes)) {
    throw new Error(data?.message || data?.error || `Rebuild request failed (${response.status})`);
  }
  return data as RecordRebuildResult;
}

/** The Record line's display text: "Full", "Placeholder", or "None". */
export function recordLabel(record: PieceRecordSummary | null): string {
  if (!record) return 'None';
  const kind = record.legacySections ? 'Full' : 'Placeholder';
  return `${kind} · ${formatDate(record.generatedAt)}`;
}

/** The plain-language hover explanation for the Record line. */
export function recordHoverText(record: PieceRecordSummary | null): string {
  if (!record) {
    return 'No permanent record has been generated for this piece yet. Rebuild creates the first one.';
  }
  if (record.legacySections) {
    return record.stale
      ? 'This record carries its full lineage and shines sections, but the registry has moved since it was generated. Rebuild to bring it current.'
      : 'This record carries its full lineage and shines sections.';
  }
  return 'This record was generated while the living record was not yet published, so its lineage and shines sections say so instead of showing them. A rebuild after that changes converts it to a full record.';
}

/** One piece's rebuild outcome, in Adrian's plain register. */
export function summarizeRecordRebuild(outcome: RecordRebuildOutcome): string {
  if (outcome.status === 'generated') return 'Record rebuilt.';
  if (outcome.status === 'unchanged') return 'Record unchanged. It already matched.';
  if (outcome.status === 'skipped') return 'This piece has no public code to build a record from.';
  return `Record rebuild failed: ${outcome.error || 'unknown error'}.`;
}

/**
 * The registry-wide rebuild summary, reported honestly: a plain count line,
 * then every failing code named with its own error, never collapsed into a
 * generic success or failure.
 */
export function summarizeRecordRebuildAll(result: RecordRebuildResult): string {
  const noun = result.total === 1 ? 'record' : 'records';
  const summary = `${result.total} ${noun}: ${result.generated} rebuilt, ${result.unchanged} unchanged`
    + (result.failed > 0 ? `, ${result.failed} failed` : '') + '.';
  const failures = result.outcomes.filter((outcome) => outcome.status === 'failed');
  if (!failures.length) return summary;
  const detail = failures
    .map((outcome) => `${outcome.publicCode || 'unknown piece'} (${outcome.error || 'unknown error'})`)
    .join('; ');
  return `${summary} Failed: ${detail}.`;
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
