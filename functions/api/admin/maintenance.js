import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
import { ARTWORK_ID_PATTERN } from '../_lib/artworkCatalog.js';
import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';

const MAX_RESULTS = 200;
const PUBLIC_FILTERS = new Set([
  'publicCode', 'artworkId', 'editionNumber', 'title',
]);
const POST_FILTERS = new Set([...PUBLIC_FILTERS, 'holderName']);

function textParam(params, name, max) {
  const value = params.get(name);
  if (value === null || value === '') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : false;
}

function textField(value, max) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return false;
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
  };
}

function parseEditionNumber(rawEdition) {
  if (rawEdition === null || rawEdition === undefined || rawEdition === '') return null;
  const editionNumber = typeof rawEdition === 'number'
    ? rawEdition
    : /^\d+$/.test(String(rawEdition)) ? Number(rawEdition) : NaN;
  if (!Number.isSafeInteger(editionNumber) || editionNumber < 0 || editionNumber > 9999) {
    return false;
  }
  return editionNumber;
}

function rejectUnknownKeys(keys, allowed) {
  return keys.some((key) => !allowed.has(key));
}

function buildSearchFilters(source, { allowHolderName }) {
  const publicCode = textField(source.publicCode, 32);
  const artworkId = textField(source.artworkId, 80);
  const title = textField(source.title, 120);
  const holderName = allowHolderName ? textField(source.holderName, 120) : null;
  if ([publicCode, artworkId, title, holderName].includes(false)) {
    return { error: 'invalid_filter' };
  }
  const editionNumber = parseEditionNumber(source.editionNumber);
  if (editionNumber === false) return { error: 'invalid_edition_number' };
  if (publicCode && !isPublicRegistryCode(publicCode.toUpperCase())) {
    return { error: 'invalid_public_code' };
  }
  if (artworkId && !ARTWORK_ID_PATTERN.test(artworkId.toUpperCase())) {
    return { error: 'invalid_artwork_id' };
  }
  return {
    filters: { publicCode, artworkId, title, editionNumber, holderName },
  };
}

async function readJsonBody(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body;
  } catch {
    return null;
  }
}

function searchPieces(env, filters) {
  const {
    publicCode, artworkId, title, editionNumber, holderName,
  } = filters;
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
  if (holderName) {
    where.push(`kp.keeper_user_id IS NOT NULL`);
    where.push(
      `instr(lower(COALESCE(holder.name, '')), lower(${bind(holderName)})) > 0`,
    );
  }
  const joinHolder = holderName
    ? 'LEFT JOIN user holder ON holder.id = kp.keeper_user_id'
    : '';
  return env.DB.prepare(
    `SELECT kp.id, kp.piece_id, kp.edition_number, kp.public_code,
            kp.plate_status, ra.title AS registry_title
       FROM keeper_pieces kp
       LEFT JOIN registry_artworks ra ON ra.id = kp.piece_id
       ${joinHolder}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY kp.id
       LIMIT ${MAX_RESULTS}`,
  ).bind(...values);
}

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  let filtersResult;
  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (rejectUnknownKeys([...params.keys()], PUBLIC_FILTERS)) {
      return jsonResponse({ ok: false, error: 'unknown_filter' }, 400);
    }
    filtersResult = buildSearchFilters({
      publicCode: params.get('publicCode'),
      artworkId: params.get('artworkId'),
      title: params.get('title'),
      editionNumber: params.has('editionNumber') ? params.get('editionNumber') : null,
    }, { allowHolderName: false });
  } else if (request.method === 'POST') {
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ ok: false, error: 'invalid_body' }, 400);
    if (rejectUnknownKeys(Object.keys(body), POST_FILTERS)) {
      return jsonResponse({ ok: false, error: 'unknown_filter' }, 400);
    }
    filtersResult = buildSearchFilters(body, { allowHolderName: true });
  } else {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }

  if ('error' in filtersResult) {
    return jsonResponse({ ok: false, error: filtersResult.error }, 400);
  }

  try {
    const { results } = await searchPieces(env, filtersResult.filters).all();
    return jsonResponse({ ok: true, pieces: (results || []).map(serialize) });
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_search_failed' }, 500);
  }
}
