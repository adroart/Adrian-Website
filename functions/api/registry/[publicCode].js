import { findStaticArtwork } from '../_lib/artworkCatalog.js';
import {
  isPublicRegistryCode,
  projectPublicPlateIdentity,
} from '../../../utils/publicRegistry.ts';

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function unavailable() {
  return json({ ok: false, error: 'registry_unavailable' }, 503);
}

function integrityError() {
  return json({ ok: false, error: 'identity_integrity_error' }, 409);
}

function storedEditionSize(row) {
  if (!row || row.edition_size == null) return null;
  if (!Number.isSafeInteger(row.edition_size) || row.edition_size < 1) {
    throw new Error('invalid stored edition metadata');
  }
  return row.edition_size;
}

function resolveMetadata(plate, overlay) {
  const staticArtwork = findStaticArtwork(plate.piece_id);
  if (!staticArtwork && !overlay) throw new Error('unknown artwork metadata');
  if (overlay && overlay.id !== plate.piece_id) throw new Error('artwork metadata mismatch');

  let editionKind;
  let editionSize;
  if (staticArtwork?.editionSize !== undefined && staticArtwork.editionSize !== null) {
    if (!Number.isSafeInteger(staticArtwork.editionSize) || staticArtwork.editionSize < 1) {
      throw new Error('invalid catalog edition metadata');
    }
    const overlaySize = storedEditionSize(overlay);
    if (overlay && overlaySize !== staticArtwork.editionSize) {
      throw new Error('artwork edition metadata conflict');
    }
    editionKind = 'numbered';
    editionSize = staticArtwork.editionSize;
  } else if (overlay) {
    editionSize = storedEditionSize(overlay);
    editionKind = editionSize === null ? 'unique' : 'numbered';
  } else {
    // Historical catalog plates can predate explicit edition-size metadata.
    editionKind = plate.edition_number === 0 ? 'unique' : 'numbered';
    editionSize = null;
  }

  return {
    title: staticArtwork?.title ?? overlay.title,
    series: staticArtwork?.series ?? overlay?.series ?? null,
    editionKind,
    editionSize,
    publicProvenance: staticArtwork?.provenance ?? [],
  };
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

  const publicCode = params?.publicCode;
  if (!isPublicRegistryCode(publicCode)) {
    return json({ ok: false, error: 'not_found' }, 404);
  }
  if (!env?.DB) return unavailable();

  let plate;
  let overlay;
  try {
    plate = await env.DB
      .prepare(
        `SELECT piece_id, edition_number, public_code, plate_status
           FROM keeper_pieces
          WHERE public_code = ?1
            AND plate_status IN ('generated', 'active')`,
      )
      .bind(publicCode)
      .first();
    if (!plate) return json({ ok: false, error: 'not_found' }, 404);
    if (plate.plate_status !== 'generated' && plate.plate_status !== 'active') {
      return json({ ok: false, error: 'not_found' }, 404);
    }
    if (plate.public_code !== publicCode) return integrityError();

    overlay = await env.DB
      .prepare('SELECT id, title, series, edition_size FROM registry_artworks WHERE id = ?1')
      .bind(plate.piece_id)
      .first();
  } catch {
    return unavailable();
  }

  try {
    const metadata = resolveMetadata(plate, overlay);
    const identity = projectPublicPlateIdentity({
      artworkId: plate.piece_id,
      title: metadata.title,
      series: metadata.series,
      editionKind: metadata.editionKind,
      editionNumber: plate.edition_number,
      editionSize: metadata.editionSize,
      publicCode: plate.public_code,
      plateStatus: plate.plate_status,
      publicProvenance: metadata.publicProvenance,
    });
    return json({ ok: true, identity });
  } catch {
    return integrityError();
  }
}
