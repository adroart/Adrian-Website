import { FULL_ARCHIVE } from '../../data/mockData.ts';
import { buildLineageEvent } from './_lib/lineage.js';
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

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function catalogMeta(pieceId) {
  const artwork = FULL_ARCHIVE.find((candidate) => candidate.id === pieceId);
  if (!artwork) return {};
  return {
    series: artwork.series,
    category: artwork.category,
    isSignaturePiece: artwork.isSignaturePiece === true,
  };
}

async function verifyLocalLineage(env, pieces) {
  const result = await env.DB.prepare(
    `SELECT keeper_piece_id, sequence, event_type, event_at, previous_hash,
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

function projectPiece(piece, events, claimOrdinal) {
  const catalog = catalogMeta(piece.piece_id);
  const genesis = (events || []).find((event) => event.type === 'created');
  const meta = {
    series: catalog.series || genesis?.series,
    category: catalog.category || genesis?.category,
    isSignaturePiece: catalog.isSignaturePiece === true,
  };
  let cityId = null;
  let internalStatus = 'seeking';
  let visible = true;
  let claimedAt = null;
  let placedAt;
  for (const event of events || []) {
    if (event.type === 'created') {
      internalStatus = 'seeking';
      if (event.cityId) cityId = event.cityId;
    }
    if (event.type === 'claimed' && !claimedAt) claimedAt = event.date;
    if (event.type === 'placed' || event.type === 'moved') {
      cityId = event.cityId ?? null;
      internalStatus = 'placed';
      placedAt = event.date;
    }
    if (event.type === 'withdrawn') visible = false;
    if (event.type === 'revealed') visible = true;
    if (event.type === 'retired') {
      internalStatus = 'retired';
      cityId = null;
    }
  }
  if (!visible || internalStatus === 'retired') return null;
  const status = internalStatus === 'placed'
    ? (claimedAt ? 'placed' : 'unawakened')
    : 'seeking';
  const pieceType = genesis?.pieceType
    || (meta.series === 'Universal Language' ? 'mandala' : 'other');
  const kind = meta.series === 'Universal Language'
    ? 'sixty-four'
    : meta.series === 'Mandala' || pieceType === 'mandala'
      ? 'mandala'
      : meta.isSignaturePiece
        ? 'signature'
      : slug(meta.category) || 'other';
  return {
    pieceId: piece.piece_id,
    editionNumber: Number(piece.edition_number ?? 0),
    ...(meta.series ? { series: meta.series } : {}),
    ...(meta.category ? { category: meta.category } : {}),
    cityId,
    status,
    ...(placedAt ? { placedAt } : {}),
    pieceType,
    kind,
    ...(claimOrdinal ? { claimOrdinal } : {}),
    kinshipEligible: !claimedAt,
  };
}

export async function buildPublicAtlasState(env, generatedAt = new Date().toISOString()) {
  const pieceResult = await env.DB.prepare(
    `SELECT id, piece_id, edition_number, lineage_head_hash, lineage_event_count
       FROM keeper_pieces
      WHERE plate_status IN ('legacy', 'generated', 'active')
      ORDER BY piece_id ASC, edition_number ASC, id ASC`,
  ).all();
  const pieces = rows(pieceResult);
  if (!Array.isArray(pieces)) throw new Error('atlas_registry_unavailable');
  await verifyLocalLineage(env, pieces);
  const { sourceEventsByPiece, cities } = await loadAndVerifySourceChains(env, pieces);

  const claimed = [];
  for (const piece of pieces) {
    const firstClaim = (sourceEventsByPiece.get(piece.id) || []).find((event) => event.type === 'claimed');
    if (firstClaim) claimed.push({ id: piece.id, at: firstClaim.date, eventId: firstClaim.id });
  }
  claimed.sort((a, b) => a.at.localeCompare(b.at) || a.eventId.localeCompare(b.eventId));
  const ordinals = new Map(claimed.map((claim, index) => [claim.id, index + 1]));
  const projected = [];
  const chainTips = {};
  for (const piece of pieces) {
    const events = sourceEventsByPiece.get(piece.id) || [];
    const publicPiece = projectPiece(piece, events, ordinals.get(piece.id));
    if (!publicPiece) continue;
    projected.push(publicPiece);
    const tip = events.at(-1)?.hash;
    if (tip) chainTips[`${piece.piece_id}:${Number(piece.edition_number ?? 0)}`] = tip;
  }
  const referencedCities = new Set(projected.map((piece) => piece.cityId).filter(Boolean));
  return {
    generatedAt,
    schemaVersion: 2,
    pieces: projected,
    cities: cities
      .filter((city) => referencedCities.has(city.id))
      .map((city) => ({
        id: city.id,
        city: city.city,
        ...(city.region ? { region: city.region } : {}),
        country: city.country,
        countryCode: city.country_code,
        lat: Number(city.lat),
        lng: Number(city.lng),
      })),
    chainTips,
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }
  if (!env?.DB) return json({ ok: false, error: 'atlas_unavailable' }, 503);
  try {
    const state = await buildPublicAtlasState(env);
    return json({ ok: true, state }, 200, 'public, max-age=60');
  } catch (error) {
    if (error instanceof Error && /(?:integrity|lineage|source_|anchor|count)/.test(error.message)) {
      return json({ ok: false, error: 'atlas_integrity_error' }, 409);
    }
    return json({ ok: false, error: 'atlas_unavailable' }, 503);
  }
}
