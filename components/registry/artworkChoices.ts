/**
 * The choosable works for the registration ceremony: the compiled catalog
 * (data/mockData.ts) merged with the admin-created D1 drafts, exactly the way
 * AdminPieces builds its mintable list, plus the small helpers the "Name a
 * new work" screen needs: the taken-id check and the next-free-number
 * suggestion for a typed series prefix.
 */

import { FULL_ARCHIVE } from '../../data/mockData';
import { jsonRequest, type MintableArtwork } from '../../utils/adminPieces';

export const ARTWORK_ID_INPUT_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;

type DraftRow = {
  id: string;
  title: string;
  series: string | null;
  editionKind: 'unique' | 'numbered';
  editionSize: number | null;
};

export type ChoosableArtwork = MintableArtwork & { series: string | null };

/** The static catalog merged with D1 drafts, mirroring AdminPieces. */
export function mergeChoosableArtworks(drafts: DraftRow[]): ChoosableArtwork[] {
  const draftsById = new Map(drafts.map(draft => [draft.id, draft]));
  const staticList: ChoosableArtwork[] = FULL_ARCHIVE.map(artwork => {
    const draft = draftsById.get(artwork.id);
    const staticHasEdition = Number.isInteger(artwork.editionSize);
    const conflict = staticHasEdition && draft
      && (draft.editionKind !== 'numbered' || draft.editionSize !== artwork.editionSize);
    return {
      id: artwork.id,
      title: artwork.title,
      series: artwork.series || null,
      draft: false,
      editionKind: conflict
        ? 'conflict'
        : staticHasEdition
          ? 'numbered'
          : draft?.editionKind || 'unspecified',
      editionSize: staticHasEdition ? artwork.editionSize! : draft?.editionSize ?? null,
    };
  });
  const draftList = drafts
    .filter(draft => !FULL_ARCHIVE.some(artwork => artwork.id === draft.id))
    .map((draft): ChoosableArtwork => ({
      id: draft.id,
      title: draft.title,
      series: draft.series,
      draft: true,
      editionKind: draft.editionKind,
      editionSize: draft.editionSize,
    }));
  return [...staticList, ...draftList].sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadChoosableArtworks(): Promise<ChoosableArtwork[]> {
  let drafts: DraftRow[] = [];
  try {
    const data = await jsonRequest('/api/admin/artworks');
    drafts = (data.artworks || []) as DraftRow[];
  } catch {
    drafts = [];
  }
  return mergeChoosableArtworks(drafts);
}

export function filterArtworks(
  list: ChoosableArtwork[],
  query: string,
): ChoosableArtwork[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return list;
  return list.filter(artwork =>
    artwork.title.toLowerCase().includes(needle)
    || artwork.id.toLowerCase().includes(needle)
    || (artwork.series || '').toLowerCase().includes(needle));
}

export function takenArtworkIds(list: ChoosableArtwork[]): Set<string> {
  return new Set(list.map(artwork => artwork.id));
}

/**
 * The next free number for a typed series prefix. Given "sig" or "SIG-" and
 * the known ids, returns "SIG-104" when SIG-103 is the highest taken, or
 * "SIG-100" for a brand-new prefix. Returns null when the input is not a
 * bare prefix (a complete id is left exactly as typed).
 */
export function suggestNextArtworkId(
  taken: Iterable<string>,
  typed: string,
): string | null {
  const match = typed.trim().toUpperCase().match(/^([A-Z]{2,3})-?$/);
  if (!match) return null;
  const prefix = match[1];
  if (prefix === 'AR') return null;
  let highest = 0;
  for (const id of taken) {
    const hit = id.match(/^([A-Z]{2,3})-([0-9]{3})$/);
    if (hit && hit[1] === prefix) highest = Math.max(highest, Number(hit[2]));
  }
  const next = highest === 0 ? 100 : highest + 1;
  if (next > 999) return null;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}
