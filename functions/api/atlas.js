import { FULL_ARCHIVE } from '../../data/mockData.ts';
import { buildLineageEvent } from './_lib/lineage.js';
import { projectCollectorField } from './_lib/collectorField.js';
import {
  canonicalizeAtlasSourceEvent,
  verifyAtlasSourceChains,
} from '../../utils/atlasSourceImport.ts';

function json(body, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  });
}

function rows(result) {
  return Array.isArray(result) ? result : result?.results;
}

async function verifyLocalLineage(env, pieces) {
  const result = await env.DB.prepare(
    `SELECT id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
            event_hash, public_payload_json
       FROM artwork_lineage_events
      ORDER BY keeper_piece_id ASC, sequence ASC`,
  ).all();
  const all = rows(result);
  if (!Array.isArray(all)) throw new Error('atlas_local_lineage_unavailable');
  const byPiece = new Map();
  for (const event of all) {
    const list = byPiece.get(event.keeper_piece_id) || [];
    list.push(event);
    byPiece.set(event.keeper_piece_id, list);
  }
  const seenOrdinals = new Set();
  for (const piece of pieces) {
    const events = byPiece.get(piece.id) || [];
    const count = Number(piece.lineage_event_count);
    if (!Number.isSafeInteger(count) || count < 0 || count !== events.length) {
      throw new Error('atlas_local_lineage_count');
    }
    let previousHash = null;
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (Number(event.sequence) !== index + 1 || event.previous_hash !== previousHash) {
        throw new Error('atlas_local_lineage_link');
      }
      let publicPayload;
      try {
        publicPayload = JSON.parse(event.public_payload_json);
      } catch {
        throw new Error('atlas_local_lineage_payload');
      }
      const recomputed = await buildLineageEvent({
        keeperPieceId: piece.id,
        sequence: Number(event.sequence),
        eventType: event.event_type,
        eventAt: event.event_at,
        previousHash: event.previous_hash,
        publicPayload,
      });
      if (recomputed.eventHash !== event.event_hash) {
        throw new Error('atlas_local_lineage_hash');
      }
      previousHash = event.event_hash;
    }
    if ((piece.lineage_head_hash || null) !== previousHash) {
      throw new Error('atlas_local_lineage_anchor');
    }
    const firstBounds = events.filter((event) => event.event_type === 'first_bound');
    const ordinal = Number(piece.claim_ordinal);
    if (firstBounds.length > 1
      || (firstBounds.length === 0
        && (piece.claim_ordinal != null || piece.first_bound_event_id != null))
      || (firstBounds.length === 1
        && (!Number.isSafeInteger(ordinal) || ordinal <= 0
          || piece.first_bound_event_id !== firstBounds[0].id
          || seenOrdinals.has(ordinal)))) {
      throw new Error('atlas_local_lineage_ordinal');
    }
    if (firstBounds.length === 1) seenOrdinals.add(ordinal);
  }
}

async function loadAndVerifySourceChains(env, pieces) {
  const [chainResult, eventResult, cityResult] = await Promise.all([
    env.DB.prepare(`SELECT id, keeper_piece_id, source_event_count, source_head_hash
      FROM atlas_source_chains ORDER BY id ASC`).all(),
    env.DB.prepare(`SELECT id, source_chain_id, source_sequence, source_event_id,
      source_event_type, source_event_at, source_previous_hash, source_event_hash,
      source_event_json FROM atlas_source_chain_events
      ORDER BY source_chain_id ASC, source_sequence ASC`).all(),
    env.DB.prepare(`SELECT id, city, region, country, country_code, lat, lng
      FROM atlas_source_cities ORDER BY id ASC`).all(),
  ]);
  const chains = rows(chainResult);
  const events = rows(eventResult);
  const cities = rows(cityResult);
  if (!Array.isArray(chains) || !Array.isArray(events) || !Array.isArray(cities)) {
    throw new Error('atlas_source_unavailable');
  }
  const pieceIds = new Set(pieces.map((piece) => piece.id));
  const piecesById = new Map(pieces.map((piece) => [piece.id, piece]));
  const eventsByChain = new Map();
  for (const row of events) {
    const list = eventsByChain.get(row.source_chain_id) || [];
    list.push(row);
    eventsByChain.set(row.source_chain_id, list);
  }
  const chainIds = new Set(chains.map((chain) => chain.id));
  if ([...eventsByChain.keys()].some((chainId) => !chainIds.has(chainId))) {
    throw new Error('atlas_source_orphan_event');
  }
  const verified = new Map();
  for (const chain of chains) {
    if (!pieceIds.has(chain.keeper_piece_id)) throw new Error('atlas_source_orphan');
    const chainRows = eventsByChain.get(chain.id) || [];
    if (Number(chain.source_event_count) !== chainRows.length || chainRows.length === 0) {
      throw new Error('atlas_source_count');
    }
    const sourceEvents = [];
    for (let index = 0; index < chainRows.length; index += 1) {
      const row = chainRows[index];
      if (Number(row.source_sequence) !== index + 1) throw new Error('atlas_source_sequence');
      let event;
      try {
        event = JSON.parse(row.source_event_json);
      } catch {
        throw new Error('atlas_source_json');
      }
      if (canonicalizeAtlasSourceEvent(event) !== row.source_event_json
        || event.id !== row.source_event_id || event.type !== row.source_event_type
        || event.date !== row.source_event_at || event.prevHash !== row.source_previous_hash
        || event.hash !== row.source_event_hash) {
        throw new Error('atlas_source_envelope');
      }
      sourceEvents.push(event);
    }
    verified.set(chain.keeper_piece_id, sourceEvents);
  }
  if (chains.length === 0 && events.length !== 0) throw new Error('atlas_source_orphan_event');
  if (chains.length > 0) {
    const sourceCities = cities.map((city) => ({
      id: city.id,
      city: city.city,
      ...(city.region ? { region: city.region } : {}),
      country: city.country,
      countryCode: city.country_code,
      lat: Number(city.lat),
      lng: Number(city.lng),
    }));
    const strict = await verifyAtlasSourceChains(
      [...verified.values()].flat(),
      sourceCities,
    );
    const strictByHead = new Map(strict.chains.map((sourceChain) => [sourceChain.headHash, sourceChain]));
    for (const chain of chains) {
      const sourceChain = strictByHead.get(chain.source_head_hash);
      const keeper = piecesById.get(chain.keeper_piece_id);
      if (!sourceChain || !keeper
        || sourceChain.events.length !== Number(chain.source_event_count)
        || sourceChain.pieceId !== keeper.piece_id
        || sourceChain.editionNumber !== Number(keeper.edition_number ?? 0)) {
        throw new Error('atlas_source_keeper_identity');
      }
      const storedEvents = verified.get(chain.keeper_piece_id) || [];
      if (storedEvents.some((event, index) => event.hash !== sourceChain.events[index]?.hash)) {
        throw new Error('atlas_source_order');
      }
    }
  }
  return { sourceEventsByPiece: verified, cities };
}

export async function buildPublicAtlasState(env, generatedAt = new Date().toISOString()) {
  const [pieceResult, catalogResult, consentResult] = await Promise.all([
    env.DB.prepare(
    `SELECT piece.id, piece.piece_id, piece.edition_number, piece.public_code,
            piece.registration_status, piece.lineage_head_hash,
            piece.lineage_event_count, ordinal.claim_ordinal,
            ordinal.first_bound_event_id
       FROM keeper_pieces AS piece
       LEFT JOIN collector_claim_ordinals AS ordinal
         ON ordinal.keeper_piece_id = piece.id
      WHERE piece.plate_status IN ('legacy', 'generated', 'active')
      ORDER BY piece.piece_id ASC, piece.edition_number ASC, piece.id ASC`,
    ).all(),
    env.DB.prepare(
      `SELECT artwork_id, series, category
         FROM registry_catalog_membership
        ORDER BY artwork_id ASC`,
    ).all(),
    env.DB.prepare(
      `SELECT privacy.keeper_piece_id, privacy.city_id, city.label AS city_label
         FROM collector_piece_privacy AS privacy
         JOIN keeper_pieces AS piece ON piece.id = privacy.keeper_piece_id
         JOIN users AS account ON account.id = privacy.user_id
         JOIN profiles AS profile ON profile.user_id = privacy.user_id
         JOIN collector_curated_cities AS city ON city.id = privacy.city_id
        WHERE privacy.share_city = 1
          AND piece.plate_status IN ('legacy', 'generated', 'active')
          AND piece.keeper_user_id = account.auth_user_id
          AND piece.claimed_at IS NOT NULL
          AND piece.released_at IS NULL
          AND city.active = 1
          AND city.population >= 50000
          AND date(profile.birth_date) = profile.birth_date
          AND date(profile.birth_date, '+18 years') <= date(?1)
        ORDER BY privacy.keeper_piece_id ASC`,
    ).bind(generatedAt).all(),
  ]);
  const pieces = rows(pieceResult);
  const catalogRows = rows(catalogResult);
  const consentRows = rows(consentResult);
  if (!Array.isArray(pieces) || !Array.isArray(catalogRows) || !Array.isArray(consentRows)) {
    throw new Error('atlas_registry_unavailable');
  }
  await verifyLocalLineage(env, pieces);
  const { sourceEventsByPiece } = await loadAndVerifySourceChains(env, pieces);
  const metadataByArtworkId = new Map(FULL_ARCHIVE.map((artwork) => [artwork.id, artwork]));
  return projectCollectorField({
    generatedAt,
    catalogRows,
    identityRows: pieces,
    consentRows,
    metadataByArtworkId,
    sourceEventsByPiece,
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }
  if (!env?.DB) return json({ ok: false, error: 'atlas_unavailable' }, 503);
  try {
    const state = await buildPublicAtlasState(env);
    return json({ ok: true, state });
  } catch (error) {
    if (error instanceof Error && /(?:integrity|lineage|source_|anchor|count)/.test(error.message)) {
      return json({ ok: false, error: 'atlas_integrity_error' }, 409);
    }
    return json({ ok: false, error: 'atlas_unavailable' }, 503);
  }
}
