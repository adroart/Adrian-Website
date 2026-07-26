/**
 * Artwork resolution for minting.
 *
 * The public catalog is compiled into the bundle (data/mockData.ts). Admin-added
 * draft pieces live in the D1 `registry_artworks` table (migration 015). Minting
 * accepts a piece from EITHER source: the static catalog is checked first, then
 * the draft table. Everything here is minimal — only what the plate needs (id,
 * title, edition size). No codes, no personal data.
 */
import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import { isMissingTableError } from './keeper.js';

export const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
export const DRAFT_TITLE_MAX = 120;
export const DRAFT_SERIES_MAX = 80;
export const DRAFT_EDITION_MAX = 9999;

/** The static catalog entry for a piece id, or null. */
export function findStaticArtwork(pieceId) {
  return FULL_ARCHIVE.find((artwork) => artwork.id === pieceId) || null;
}

/**
 * Resolve a piece id to the minimal shape minting needs, from the static catalog
 * first, then the draft table. Returns null when the id is unknown in both.
 */
export async function resolveArtwork(env, pieceId) {
  const staticArtwork = findStaticArtwork(pieceId);
  if (staticArtwork) {
    return {
      id: staticArtwork.id,
      title: staticArtwork.title,
      editionSize: Number.isInteger(staticArtwork.editionSize) ? staticArtwork.editionSize : null,
      source: 'catalog',
    };
  }
  if (!env?.DB) return null;
  try {
    const row = await env.DB
      .prepare('SELECT id, title, edition_size FROM registry_artworks WHERE id = ?1')
      .bind(pieceId)
      .first();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      editionSize: row.edition_size == null ? null : Number(row.edition_size),
      source: 'registry',
    };
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

/**
 * Validate and normalize a draft-piece create request. Pure — the endpoint layers
 * on the "already in the catalog" and "already a draft" collision checks.
 */
export function validateDraftInput(body) {
  const id = typeof body?.id === 'string' ? body.id.trim().toUpperCase() : '';
  if (!ARTWORK_ID_PATTERN.test(id)) return { error: 'invalid_id' };
  // AR- is reserved for issued plate public codes; keep artwork ids out of it.
  if (id.startsWith('AR-')) return { error: 'reserved_prefix' };

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > DRAFT_TITLE_MAX) return { error: 'invalid_title' };

  const series = typeof body?.series === 'string' && body.series.trim()
    ? body.series.trim().slice(0, DRAFT_SERIES_MAX)
    : null;

  let editionSize = null;
  if (body?.editionSize !== undefined && body?.editionSize !== null && body?.editionSize !== '') {
    const parsed = Number(body.editionSize);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > DRAFT_EDITION_MAX) {
      return { error: 'invalid_edition_size' };
    }
    editionSize = parsed;
  }

  return { id, title, series, editionSize };
}
