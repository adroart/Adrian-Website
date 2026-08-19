/**
 * Artwork resolution for minting and for the public works fallback.
 *
 * The public catalog is compiled into the bundle (data/mockData.ts). Admin-added
 * draft pieces live in the D1 `registry_artworks` table (migration 015). A
 * registered artwork also carries an append-only catalog snapshot (migration 035,
 * catalogSnapshot.js) taken at registration time. Resolution order is:
 *
 *   1. the newest catalog snapshot for the artwork, when one exists — it is
 *      authoritative for a registered piece, carrying the full descriptive
 *      shape (title, series, category, year, dimensions, materials,
 *      description, edition) frozen at registration time;
 *   2. otherwise the static catalog;
 *   3. otherwise the draft table.
 *
 * A snapshot lookup failure (missing table, or an unrecognized mock in tests)
 * is treated the same as "no snapshot" — it never blocks the static/draft
 * fallback below it. No codes, no personal data live here.
 */
import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import { isMissingTableError } from './keeper.js';
import { latestCatalogSnapshot } from './catalogSnapshot.js';

export const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
export const DRAFT_TITLE_MAX = 120;
export const DRAFT_SERIES_MAX = 80;
export const DRAFT_EDITION_MAX = 9999;

export function editionKindForSize(editionSize) {
  return Number.isInteger(editionSize) ? 'numbered' : 'unique';
}

function catalogError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function registryEditionSize(row) {
  if (!row || row.edition_size == null) return null;
  const editionSize = Number(row.edition_size);
  if (!Number.isInteger(editionSize) || editionSize < 1 || editionSize > DRAFT_EDITION_MAX) {
    throw catalogError('invalid_stored_edition_metadata');
  }
  return editionSize;
}

async function findRegistryArtwork(env, pieceId) {
  if (!env?.DB) return null;
  try {
    return await env.DB
      .prepare('SELECT id, title, edition_size FROM registry_artworks WHERE id = ?1')
      .bind(pieceId)
      .first();
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

/** The static catalog entry for a piece id, or null. */
export function findStaticArtwork(pieceId) {
  return FULL_ARCHIVE.find((artwork) => artwork.id === pieceId) || null;
}

/**
 * The newest catalog snapshot's metadata for a piece id, or null. Any failure
 * reading or parsing it (missing table, malformed row) is treated as "no
 * snapshot" rather than propagated, so a snapshot lookup can never itself
 * cause artwork resolution to fail closed.
 */
async function findSnapshotArtwork(env, pieceId) {
  try {
    const snapshot = await latestCatalogSnapshot(env, pieceId);
    return snapshot?.metadata || null;
  } catch {
    return null;
  }
}

function fromSnapshot(metadata) {
  const editionKind = metadata.edition?.kind === 'unique' || metadata.edition?.kind === 'numbered'
    ? metadata.edition.kind
    : 'unspecified';
  return {
    id: metadata.id,
    title: metadata.title,
    editionKind,
    editionSize: metadata.edition?.size ?? null,
    source: 'snapshot',
    series: metadata.series ?? null,
    category: metadata.category ?? null,
    year: metadata.year ?? null,
    dimensions: metadata.dimensions ?? null,
    materials: Array.isArray(metadata.materials) ? metadata.materials : [],
    description: metadata.description ?? null,
  };
}

/**
 * Resolve a piece id to the shape minting and the public works fallback need.
 * The newest catalog snapshot wins when one exists; otherwise the static
 * catalog is checked, then the draft table. Returns null when the id is
 * unknown everywhere.
 */
export async function resolveArtwork(env, pieceId) {
  const snapshotMetadata = await findSnapshotArtwork(env, pieceId);
  if (snapshotMetadata) return fromSnapshot(snapshotMetadata);

  const staticArtwork = findStaticArtwork(pieceId);
  const row = await findRegistryArtwork(env, pieceId);
  if (staticArtwork) {
    const staticHasEdition = Number.isInteger(staticArtwork.editionSize);
    const storedEditionSize = registryEditionSize(row);
    if (staticHasEdition && row && storedEditionSize !== staticArtwork.editionSize) {
      throw catalogError('artwork_edition_metadata_conflict');
    }
    const editionSize = staticHasEdition
      ? staticArtwork.editionSize
      : row
        ? storedEditionSize
        : null;
    return {
      id: staticArtwork.id,
      title: staticArtwork.title,
      editionKind: staticHasEdition || row ? editionKindForSize(editionSize) : 'unspecified',
      editionSize,
      source: 'catalog',
    };
  }
  if (!row) return null;
  const editionSize = registryEditionSize(row);
  return {
    id: row.id,
    title: row.title,
    editionKind: editionKindForSize(editionSize),
    editionSize,
    source: 'registry',
  };
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

  const editionKind = typeof body?.editionKind === 'string' ? body.editionKind.trim() : '';
  if (!editionKind) return { error: 'edition_required' };
  if (editionKind !== 'unique' && editionKind !== 'numbered') {
    return { error: 'invalid_edition_kind' };
  }

  if (editionKind === 'unique') {
    if (body?.uniqueConfirmed !== true) return { error: 'unique_confirmation_required' };
    return { id, title, series, editionKind, editionSize: null };
  }

  if (body?.editionSize === undefined || body?.editionSize === null || body?.editionSize === '') {
    return { error: 'edition_size_required' };
  }
  const editionSize = Number(body.editionSize);
  if (!Number.isInteger(editionSize) || editionSize < 1 || editionSize > DRAFT_EDITION_MAX) {
    return { error: 'invalid_edition_size' };
  }

  return { id, title, series, editionKind, editionSize };
}
