/**
 * /api/admin/artworks — admin-created draft pieces (migration 015).
 *
 *   GET  — list draft pieces (authenticated admin). Merged with the static
 *          catalog in the UI to populate the mint dropdown.
 *   POST — create a draft piece or save an edition-metadata overlay for an
 *          existing static piece (registry step-up unlock required, because it
 *          adds something mintable). Static overlays always retain canonical
 *          catalog title and series metadata.
 *
 * Drafts carry no codes and no personal data. A draft becomes a real, richly
 * presented piece when it is later added to data/mockData.ts; until then its
 * public /works page appears only once a plate has been issued for it.
 */
import { jsonResponse, requireAdmin, requireRegistryUnlock, requireDb } from '../_lib/admin.js';
import {
  registryAdminEnabled,
  notFound,
  migrationNotApplied,
  isMissingTableError,
} from '../_lib/keeper.js';
import {
  editionKindForSize,
  findStaticArtwork,
  validateDraftInput,
} from '../_lib/artworkCatalog.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'POST') {
    const authorization = await requireRegistryUnlock(request, env);
    if (authorization instanceof Response) return authorization;
  } else {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;
  }
  if (!registryAdminEnabled(env)) return notFound();
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listDrafts(env);
  if (request.method === 'POST') return createDraft(request, env);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

function serialize(row) {
  const editionSize = row.edition_size == null ? null : Number(row.edition_size);
  return {
    id: row.id,
    title: row.title,
    series: row.series || null,
    editionKind: editionKindForSize(editionSize),
    editionSize,
    createdAt: row.created_at,
  };
}

async function listDrafts(env) {
  try {
    const { results } = await env.DB
      .prepare('SELECT id, title, series, edition_size, created_at FROM registry_artworks ORDER BY created_at DESC')
      .all();
    return jsonResponse({ ok: true, artworks: (results || []).map(serialize) });
  } catch (error) {
    // A missing table just means no drafts yet; the static catalog still works.
    if (isMissingTableError(error)) return jsonResponse({ ok: true, artworks: [] });
    return jsonResponse({ ok: false, error: 'list_failed' }, 500);
  }
}

async function createDraft(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const requestedId = typeof body?.id === 'string' ? body.id.trim().toUpperCase() : '';
  const staticArtwork = findStaticArtwork(requestedId);
  const input = validateDraftInput(staticArtwork ? {
    ...body,
    id: requestedId,
    title: staticArtwork.title,
    series: staticArtwork.series,
  } : body);
  if (input.error) return jsonResponse({ ok: false, error: input.error }, 400);

  if (staticArtwork) {
    input.title = staticArtwork.title;
    input.series = staticArtwork.series || null;
  }

  const createdAt = new Date().toISOString();
  try {
    await env.DB
      .prepare(
        `INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
      .bind(input.id, input.title, input.series, input.editionSize, createdAt)
      .run();
  } catch (error) {
    if (isMissingTableError(error)) return migrationNotApplied();
    if (/unique/i.test(String(error?.message || ''))) {
      return jsonResponse({ ok: false, error: 'already_exists' }, 409);
    }
    return jsonResponse({ ok: false, error: 'create_failed' }, 500);
  }

  return jsonResponse({
    ok: true,
    artwork: {
      id: input.id,
      title: input.title,
      series: input.series,
      editionKind: input.editionKind,
      editionSize: input.editionSize,
      createdAt,
    },
  }, 201);
}
