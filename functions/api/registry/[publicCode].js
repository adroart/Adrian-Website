import { findStaticArtwork } from '../_lib/artworkCatalog.js';
import { latestCatalogSnapshot } from '../_lib/catalogSnapshot.js';
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
    title: staticArtwork ? staticArtwork.title : overlay.title,
    series: staticArtwork ? staticArtwork.series ?? null : overlay.series ?? null,
    editionKind,
    editionSize,
    publicProvenance: staticArtwork?.provenance ?? [],
  };
}

function projectStoredCreatorHistory(rows) {
  if (!Array.isArray(rows)) throw new Error('invalid stored creator history');
  return rows.map((row) => ({
    entryType: row?.entry_type,
    title: row?.title,
    detail: row?.detail,
    role: row?.role,
    occurredAt: row?.occurred_at,
  }));
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
  let creatorHistoryRows;
  let publicIdentityStatus;
  try {
    plate = await env.DB
      .prepare(
        `WITH RECURSIVE successor_chain(
           id, public_code, plate_status, superseded_by_keeper_piece_id, depth
         ) AS (
           SELECT successor.id, successor.public_code, successor.plate_status,
                  successor.superseded_by_keeper_piece_id, 1
             FROM keeper_pieces root
             JOIN keeper_pieces successor
               ON successor.id = root.superseded_by_keeper_piece_id
            WHERE root.public_code = ?1
           UNION ALL
           SELECT successor.id, successor.public_code, successor.plate_status,
                  successor.superseded_by_keeper_piece_id, chain.depth + 1
             FROM successor_chain chain
             JOIN keeper_pieces successor
               ON successor.id = chain.superseded_by_keeper_piece_id
            WHERE chain.depth < 64
         )
         SELECT plate.id, plate.piece_id, plate.edition_number, plate.public_code,
                plate.plate_status, plate.registration_status,
                (SELECT public_code FROM successor_chain
                  WHERE plate_status IN ('generated', 'active')
                    AND superseded_by_keeper_piece_id IS NULL
                  ORDER BY depth DESC LIMIT 1) AS current_public_code
           FROM keeper_pieces plate
          WHERE plate.public_code = ?1
            AND (
              plate.plate_status IN ('generated', 'active', 'superseded')
              OR (
                plate.registration_status = 'registered'
                AND plate.plate_status = 'legacy'
              )
            )`,
      )
      .bind(publicCode)
      .first();
    if (!plate) return json({ ok: false, error: 'not_found' }, 404);
    const physicalStatus = ['generated', 'active', 'superseded'].includes(plate.plate_status)
      ? plate.plate_status
      : null;
    publicIdentityStatus = physicalStatus
      || (plate.registration_status === 'registered' && plate.plate_status === 'legacy'
        ? 'registered'
        : null);
    if (!publicIdentityStatus) {
      return json({ ok: false, error: 'not_found' }, 404);
    }
    if (plate.public_code !== publicCode) return integrityError();

    overlay = await env.DB
      .prepare('SELECT id, title, series, edition_size FROM registry_artworks WHERE id = ?1')
      .bind(plate.piece_id)
      .first();
    const creatorHistoryResult = await env.DB
      .prepare(
        `SELECT entry_type, title, detail, role, occurred_at
           FROM artwork_provenance_entries
          WHERE keeper_piece_id = ?1
            AND visibility = 'public'
            AND removed_at IS NULL
          ORDER BY created_at, id`,
      )
      .bind(plate.id)
      .all();
    creatorHistoryRows = creatorHistoryResult?.results;
    if (!Array.isArray(creatorHistoryRows)) throw new Error('invalid creator history result');
  } catch {
    return unavailable();
  }

  try {
    const snapshot = await latestCatalogSnapshot(env, plate.piece_id);
    const frozen = snapshot?.metadata;
    if (frozen && (frozen.id !== plate.piece_id || typeof frozen.title !== 'string'
      || !frozen.title.trim())) throw new Error('invalid catalog snapshot');
    // The newest explicit snapshot is the descriptive authority for registered
    // artwork. Older content-addressed records retain their original snapshot.
    const metadata = frozen ? {
      title: frozen.title,
      series: frozen.series ?? null,
      editionKind: frozen.edition?.kind ?? (plate.edition_number === 0 ? 'unique' : 'numbered'),
      editionSize: frozen.edition?.size ?? null,
      publicProvenance: findStaticArtwork(plate.piece_id)?.provenance ?? [],
    } : resolveMetadata(plate, overlay);
    const discloseSuccessor = plate.plate_status === 'superseded'
      && env.ARTWORK_REGISTRY_SUCCESSOR_DISCLOSURE === 'disclosed'
      && isPublicRegistryCode(plate.current_public_code);
    const identity = projectPublicPlateIdentity({
      artworkId: plate.piece_id,
      title: metadata.title,
      series: metadata.series,
      editionKind: metadata.editionKind,
      editionNumber: plate.edition_number,
      editionSize: metadata.editionSize,
      publicCode: plate.public_code,
      plateStatus: publicIdentityStatus,
      publicProvenance: metadata.publicProvenance,
      creatorHistory: projectStoredCreatorHistory(creatorHistoryRows),
      ...(plate.plate_status === 'superseded' ? {
        successorDisclosure: discloseSuccessor ? 'disclosed' : 'withheld',
        ...(discloseSuccessor ? { currentPublicCode: plate.current_public_code } : {}),
      } : {}),
    });
    return json({ ok: true, identity });
  } catch {
    return integrityError();
  }
}
