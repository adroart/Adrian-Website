import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
import { ARTWORK_ID_PATTERN } from '../_lib/artworkCatalog.js';
import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';

const MAX_RESULTS = 200;
const FILTERS = new Set([
  'publicCode', 'artworkId', 'editionNumber', 'title',
]);

function textParam(params, name, max) {
  const value = params.get(name);
  if (value === null || value === '') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : false;
}

function staticArtwork(pieceId) {
  return FULL_ARCHIVE.find((artwork) => artwork.id === pieceId) || null;
}

function serialize(row) {
  const artwork = staticArtwork(row.piece_id);
  return {
    id: row.id,
    artworkId: row.piece_id,
    title: artwork?.title ?? row.registry_title ?? row.piece_id,
    editionNumber: row.edition_number,
    publicCode: row.public_code ?? null,
    plateStatus: row.plate_status,
    backupStatus: row.backup_status ?? null,
    registeredAt: row.registered_at ?? null,
    stewardActive: Boolean(row.steward_active),
    recordVersion: row.record_version,
    stewardVersion: row.steward_version,
  };
}

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => !FILTERS.has(key))) {
    return jsonResponse({ ok: false, error: 'unknown_filter' }, 400);
  }
  const publicCode = textParam(params, 'publicCode', 32);
  const artworkId = textParam(params, 'artworkId', 80);
  const title = textParam(params, 'title', 120);
  if ([publicCode, artworkId, title].includes(false)) {
    return jsonResponse({ ok: false, error: 'invalid_filter' }, 400);
  }
  if (publicCode && !isPublicRegistryCode(publicCode.toUpperCase())) {
    return jsonResponse({ ok: false, error: 'invalid_public_code' }, 400);
  }
  if (artworkId && !ARTWORK_ID_PATTERN.test(artworkId.toUpperCase())) {
    return jsonResponse({ ok: false, error: 'invalid_artwork_id' }, 400);
  }
  let editionNumber = null;
  if (params.has('editionNumber')) {
    const rawEdition = params.get('editionNumber');
    editionNumber = rawEdition !== null && /^\d+$/.test(rawEdition) ? Number(rawEdition) : NaN;
    if (!Number.isSafeInteger(editionNumber) || editionNumber < 0 || editionNumber > 9999) {
      return jsonResponse({ ok: false, error: 'invalid_edition_number' }, 400);
    }
  }
  const where = [];
  const values = [];
  const bind = (value) => {
    values.push(value);
    return `?${values.length}`;
  };
  if (publicCode) where.push(`upper(kp.public_code) = upper(${bind(publicCode)})`);
  if (artworkId) where.push(`upper(kp.piece_id) = upper(${bind(artworkId)})`);
  if (editionNumber !== null) where.push(`kp.edition_number = ${bind(editionNumber)}`);
  if (title) {
    const needle = title.toLowerCase();
    const staticIds = FULL_ARCHIVE
      .filter((artwork) => artwork.title.toLowerCase().includes(needle))
      .map((artwork) => artwork.id);
    const registryClause = `instr(lower(COALESCE(ra.title, '')), lower(${bind(title)})) > 0`;
    if (staticIds.length) {
      const placeholders = staticIds.map((id) => bind(id));
      where.push(`(${registryClause} OR kp.piece_id IN (${placeholders.join(', ')}))`);
    } else {
      where.push(registryClause);
    }
  }
  try {
    const statement = env.DB.prepare(
      `SELECT kp.id, kp.piece_id, kp.edition_number, kp.public_code,
              kp.plate_status, kp.backup_status, kp.registered_at,
              CASE WHEN kp.keeper_user_id IS NOT NULL AND kp.released_at IS NULL
                THEN 1 ELSE 0 END AS steward_active,
              kp.record_version, kp.steward_version,
              ra.title AS registry_title
         FROM keeper_pieces kp
         LEFT JOIN registry_artworks ra ON ra.id = kp.piece_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY COALESCE(kp.plate_activated_at, kp.registered_at, kp.claimed_at) DESC, kp.id
         LIMIT ${MAX_RESULTS}`,
    ).bind(...values);
    const { results } = await statement.all();
    return jsonResponse({ ok: true, pieces: (results || []).map(serialize) });
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_search_failed' }, 500);
  }
}
