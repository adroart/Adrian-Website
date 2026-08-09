const EXPECTED_CATALOG_COUNT = 173;
const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;

function membershipError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeOptionalText(value, maxLength, errorCode) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw membershipError(errorCode);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw membershipError(errorCode);
  return normalized;
}

function normalizeCatalogArtwork(artwork) {
  const artworkId = typeof artwork?.id === 'string' ? artwork.id.trim().toUpperCase() : '';
  if (!ARTWORK_ID_PATTERN.test(artworkId)) throw membershipError('invalid_catalog_artwork_id');
  const series = normalizeOptionalText(artwork.series, 80, 'invalid_catalog_series');
  const category = normalizeOptionalText(artwork.category, 80, 'invalid_catalog_category');
  if (!category) throw membershipError('invalid_catalog_category');
  return { artworkId, series, category };
}

async function membershipDigest(row) {
  const bytes = new TextEncoder().encode(JSON.stringify([
    'registry-catalog-membership-v1',
    row.artworkId,
    row.series,
    row.category,
  ]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function queryRows(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.results) ? result.results : [];
}

export async function planCatalogMembership(env, catalog) {
  if (!env?.DB || !Array.isArray(catalog)) throw membershipError('catalog_membership_unavailable');
  const normalized = catalog.map(normalizeCatalogArtwork)
    .sort((left, right) => left.artworkId.localeCompare(right.artworkId));
  if (normalized.length !== EXPECTED_CATALOG_COUNT) {
    throw membershipError('catalog_count_mismatch');
  }
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].artworkId === normalized[index].artworkId) {
      throw membershipError('duplicate_catalog_artwork');
    }
  }

  const withDigests = await Promise.all(normalized.map(async (row) => ({
    ...row,
    catalogDigest: await membershipDigest(row),
  })));
  let existing;
  try {
    existing = queryRows(await env.DB.prepare(
      `SELECT artwork_id, series, category, catalog_digest
         FROM registry_catalog_membership
        ORDER BY artwork_id`,
    ).all());
  } catch {
    throw membershipError('catalog_membership_unavailable');
  }
  const existingById = new Map(existing.map((row) => [row.artwork_id, row]));
  const inserts = [];
  const unchanged = [];
  const conflicts = [];

  for (const row of withDigests) {
    const stored = existingById.get(row.artworkId);
    if (!stored) {
      inserts.push({ artworkId: row.artworkId, series: row.series, category: row.category });
      continue;
    }
    if (stored.catalog_digest !== row.catalogDigest) {
      conflicts.push({ artworkId: row.artworkId, reason: 'catalog_digest_mismatch' });
      continue;
    }
    if ((stored.series ?? null) !== row.series || stored.category !== row.category) {
      conflicts.push({ artworkId: row.artworkId, reason: 'stored_metadata_mismatch' });
      continue;
    }
    unchanged.push(row.artworkId);
  }

  return {
    catalogCount: EXPECTED_CATALOG_COUNT,
    inserts,
    unchanged,
    conflicts,
  };
}

export async function applyCatalogMembership(env, plan) {
  if (!env?.DB || typeof env.DB.batch !== 'function') {
    throw membershipError('catalog_membership_unavailable');
  }
  if (!plan || !Array.isArray(plan.inserts) || !Array.isArray(plan.unchanged)
    || !Array.isArray(plan.conflicts)) {
    throw membershipError('invalid_catalog_membership_plan');
  }
  if (plan.conflicts.length) throw membershipError('catalog_membership_conflict');
  if (!plan.inserts.length) {
    return { inserted: 0, unchanged: plan.unchanged.length, conflicts: 0 };
  }

  const firstSeededAt = new Date().toISOString();
  const statements = await Promise.all(plan.inserts.map(async (candidate) => {
    const row = normalizeCatalogArtwork({
      id: candidate.artworkId,
      series: candidate.series,
      category: candidate.category,
    });
    const digest = await membershipDigest(row);
    return env.DB.prepare(
      `INSERT INTO registry_catalog_membership
         (artwork_id, series, category, catalog_digest, first_seeded_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    ).bind(row.artworkId, row.series, row.category, digest, firstSeededAt);
  }));

  try {
    const results = await env.DB.batch(statements);
    if (!Array.isArray(results) || results.length !== statements.length
      || results.some((result) => result?.success !== true
        || Number(result?.meta?.changes) !== 1)) {
      throw membershipError('catalog_membership_write_failed');
    }
  } catch (error) {
    if (error?.code === 'catalog_membership_write_failed') throw error;
    throw membershipError('catalog_membership_write_failed');
  }
  return {
    inserted: statements.length,
    unchanged: plan.unchanged.length,
    conflicts: 0,
  };
}
