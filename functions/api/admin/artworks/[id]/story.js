/**
 * /api/admin/artworks/[id]/story — the artwork's story, added after
 * registration without ever blocking it.
 *
 * POST { story } writes a NEW append-only catalog snapshot (source 'admin',
 * migration 035) that merges the newest stored snapshot's fields with the
 * updated description, then regenerates the permanent Piece Record for every
 * registered instance of the artwork with trigger_event 'attachment',
 * FAIL-SOFT with per-instance outcomes. GET returns the current story from
 * the newest snapshot.
 *
 * The story cap is 5000 characters: the catalog snapshot canonicalization
 * (catalogSnapshot.js) holds descriptions to 5000, and refusing a longer
 * story here is better than silently truncating what Adrian wrote.
 *
 * Guarded like registration itself: admin session plus the registry step-up
 * unlock (mirroring register-artwork.js).
 */
import {
  jsonResponse,
  requireDb,
  requireRegistryUnlock,
} from '../../../_lib/admin.js';
import { resolveArtwork } from '../../../_lib/artworkCatalog.js';
import {
  ensureCatalogSnapshot,
  latestCatalogSnapshot,
} from '../../../_lib/catalogSnapshot.js';
import { normalizedArtworkId, regenerateArtworkRecords } from './media.js';

const STORY_MAX = 5000;

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

/**
 * The story is prose: trimmed, 1 to 5000 characters, newlines allowed, every
 * other control character refused.
 */
function normalizedStory(value) {
  if (typeof value !== 'string') return null;
  const story = value.replace(/\r\n?/g, '\n').trim();
  if (!story || story.length > STORY_MAX) return null;
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(story)) return null;
  return story;
}

/** Snapshot metadata back into the artwork shape canonicalization expects. */
function artworkShapeFromMetadata(artworkId, metadata) {
  return {
    id: artworkId,
    title: metadata?.title,
    series: metadata?.series ?? null,
    category: metadata?.category ?? null,
    year: metadata?.year ?? null,
    dimensions: metadata?.dimensions ?? null,
    materials: Array.isArray(metadata?.materials) ? metadata.materials : [],
    description: metadata?.description ?? null,
    editionKind: metadata?.edition?.kind ?? undefined,
    editionSize: metadata?.edition?.size ?? null,
  };
}

export async function onRequest({ request, env, params }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const artworkId = normalizedArtworkId(params?.id);
  if (!artworkId) return jsonResponse({ ok: false, error: 'unknown_artwork' }, 404);

  try {
    const snapshot = await latestCatalogSnapshot(env, artworkId);

    if (request.method === 'GET') {
      return jsonResponse({
        ok: true,
        artworkId,
        story: typeof snapshot?.metadata?.description === 'string'
          ? snapshot.metadata.description
          : null,
        snapshot: snapshot
          ? { snapshotHash: snapshot.snapshotHash, source: snapshot.source, createdAt: snapshot.createdAt }
          : null,
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }
    if (!exactKeys(body, ['story'])) {
      return jsonResponse({ ok: false, error: 'invalid_story' }, 400);
    }
    const story = normalizedStory(body.story);
    if (!story) return jsonResponse({ ok: false, error: 'invalid_story' }, 400);

    // The base fields come from the newest snapshot when one exists,
    // otherwise from the live catalog resolution, so the new snapshot always
    // carries the full descriptive metadata plus the updated story.
    let base;
    if (snapshot) {
      base = artworkShapeFromMetadata(artworkId, snapshot.metadata);
    } else {
      const artwork = await resolveArtwork(env, artworkId);
      if (!artwork) return jsonResponse({ ok: false, error: 'unknown_artwork' }, 404);
      base = artwork;
    }

    const written = await ensureCatalogSnapshot(env, { ...base, description: story }, {
      source: 'admin',
      createdAt: new Date().toISOString(),
    });
    const records = env.ARTWORK_REGISTRY_BACKUP
      ? await regenerateArtworkRecords(env, artworkId, new Date().toISOString())
      : { total: 0, generated: 0, unchanged: 0, failed: 0, outcomes: [] };
    return jsonResponse({
      ok: true,
      artworkId,
      story,
      snapshot: { snapshotHash: written.snapshotHash, inserted: written.inserted },
      records,
    }, written.inserted ? 201 : 200);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code === 'invalid_catalog_metadata') {
      return jsonResponse({ ok: false, error: code }, 400);
    }
    if (code === 'artwork_edition_metadata_conflict') {
      return jsonResponse({ ok: false, error: code }, 409);
    }
    if (code === 'db_not_configured') {
      return jsonResponse({ ok: false, error: code }, 503);
    }
    if (code) return jsonResponse({ ok: false, error: code }, 500);
    return jsonResponse({ ok: false, error: 'story_request_failed' }, 500);
  }
}
