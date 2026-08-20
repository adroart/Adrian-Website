/**
 * Append-only catalog metadata snapshots for permanent Piece Records.
 *
 * A Piece Record (docs/piece-record-format.md) references catalog metadata by
 * content hash so the record stays resolvable after the live catalog changes.
 * This module canonicalizes a catalog metadata object the same way the record
 * itself is canonicalized (the sorted-keys `stable` algorithm of lineage.js),
 * hashes it, and inserts it into `artwork_catalog_snapshots` (migration 035)
 * idempotently by (artwork_id, snapshot_hash).
 *
 * Field names align with the Artwork type in types.ts and with what
 * resolveArtwork in functions/api/_lib/artworkCatalog.js produces. The
 * snapshot holds descriptive metadata only: no prices, no availability, no
 * commerce fields, nothing personal.
 */

const SNAPSHOT_SOURCES = new Set(['mockData', 'admin']);

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

/** Sorted-keys canonicalization, byte-compatible with lineage.js stable(). */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function optionalText(value, maximum) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maximum);
}

function normalizedMaterials(artwork) {
  const source = Array.isArray(artwork?.materials)
    ? artwork.materials
    : artwork?.material !== undefined && artwork?.material !== null
      ? [artwork.material]
      : [];
  const materials = [];
  for (const item of source) {
    const text = optionalText(item, 240);
    if (text && !materials.includes(text)) materials.push(text);
  }
  return materials;
}

/**
 * Canonical catalog metadata for one artwork. Every key is always present
 * (null when unknown) so snapshots of the same content always hash the same.
 */
export function canonicalizeCatalogMetadata(artwork) {
  const id = optionalText(artwork?.id, 80);
  const title = optionalText(artwork?.title, 240);
  if (!id || !title) throw codedError('invalid_catalog_metadata');
  const editionSize = Number.isInteger(artwork?.editionSize) && artwork.editionSize > 0
    ? artwork.editionSize
    : null;
  const editionKind = artwork?.editionKind === 'unique' || artwork?.editionKind === 'numbered'
    ? artwork.editionKind
    : editionSize !== null
      ? 'numbered'
      : null;
  return stable({
    id,
    title,
    series: optionalText(artwork?.series, 160),
    category: optionalText(artwork?.category, 160),
    year: optionalText(artwork?.year, 40),
    dimensions: optionalText(artwork?.dimensions, 240),
    materials: normalizedMaterials(artwork),
    description: optionalText(artwork?.description, 5000),
    edition: { kind: editionKind, size: editionSize },
  });
}

/** Canonical JSON text and its SHA-256 for a catalog metadata object. */
export async function catalogSnapshotDigest(artwork) {
  const canonical = canonicalizeCatalogMetadata(artwork);
  const canonicalJson = JSON.stringify(canonical);
  const snapshotHash = await sha256Hex(canonicalJson);
  return { canonical, canonicalJson, snapshotHash };
}

/**
 * Insert the snapshot if this exact content is not already stored for this
 * artwork. Idempotent by (artwork_id, snapshot_hash); rows are append-only
 * (migration 035 forbids UPDATE and DELETE).
 */
export async function ensureCatalogSnapshot(env, artwork, { source, createdAt }) {
  if (!env?.DB) throw codedError('db_not_configured');
  if (!SNAPSHOT_SOURCES.has(source)) throw codedError('invalid_snapshot_source');
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw codedError('invalid_timestamp');
  }
  const { canonical, canonicalJson, snapshotHash } = await catalogSnapshotDigest(artwork);
  const artworkId = canonical.id;
  const id = `acs-${artworkId.toLowerCase()}-${snapshotHash.slice(0, 32)}`;
  const result = await env.DB.prepare(
    `INSERT INTO artwork_catalog_snapshots
       (id, artwork_id, snapshot_hash, canonical_json, source, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE NOT EXISTS (
        SELECT 1 FROM artwork_catalog_snapshots
         WHERE artwork_id = ?2 AND snapshot_hash = ?3
      )`,
  ).bind(id, artworkId, snapshotHash, canonicalJson, source, createdAt).run();
  return {
    artworkId,
    snapshotHash,
    canonicalJson,
    inserted: Number(result?.meta?.changes ?? 0) > 0,
  };
}

/** Newest stored snapshot for an artwork, or null (missing table included). */
export async function latestCatalogSnapshot(env, artworkId) {
  if (!env?.DB) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT snapshot_hash, canonical_json, source, created_at
         FROM artwork_catalog_snapshots
        WHERE artwork_id = ?1
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
    ).bind(artworkId).first();
    if (!row) return null;
    const metadata = JSON.parse(row.canonical_json);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    return {
      snapshotHash: row.snapshot_hash,
      source: row.source,
      createdAt: row.created_at,
      metadata,
    };
  } catch (error) {
    if (error instanceof Error && /no such table/i.test(error.message)) return null;
    throw error;
  }
}
