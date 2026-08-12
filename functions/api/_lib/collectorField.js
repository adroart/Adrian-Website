import { TRUSTED_ATLAS_PLACES } from '../../../data/atlasPlaces.ts';

export const COLLECTOR_FIELD_SCHEMA_VERSION = 3;
export const COLLECTOR_FIELD_RESTING_BRIGHTNESS = 1;
export const COLLECTOR_FIELD_DIM_BRIGHTNESS = 0.24;
export const COLLECTOR_FIELD_NEUTRAL_MARKER_SIZE = 1;

const trustedPlaces = new Map(TRUSTED_ATLAS_PLACES.map((place) => [place.id, place]));

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function numericYear(value) {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return Number.isSafeInteger(year) ? year : null;
}

function publicCity(row) {
  if (!row?.city_id || !row?.city_label) return null;
  const trusted = trustedPlaces.get(row.city_id);
  if (!trusted) return null;
  return {
    id: row.city_id,
    label: [trusted.city, trusted.region, trusted.country].filter(Boolean).join(', '),
    country: trusted.country,
    lat: trusted.lat,
    lng: trusted.lng,
  };
}

function editionLabel(editionNumber) {
  const edition = Number(editionNumber ?? 0);
  return edition > 0 ? `Edition ${edition}` : 'Original';
}

function sourceMeta(events) {
  const genesis = events?.find((event) => event.type === 'created');
  return {
    series: cleanText(genesis?.series),
  };
}

function sourceIdentityIsPublic(events) {
  let visible = true;
  let retired = false;
  for (const event of events) {
    if (event.type === 'withdrawn') visible = false;
    if (event.type === 'revealed') visible = true;
    if (event.type === 'retired') retired = true;
  }
  return visible && !retired;
}

function identityProjection(row, consent) {
  const ordinal = Number.isSafeInteger(Number(row.claim_ordinal)) && Number(row.claim_ordinal) > 0
    ? Number(row.claim_ordinal)
    : null;
  const isRegistered = row.registration_status === 'registered' && ordinal !== null;
  const city = isRegistered ? publicCity(consent) : null;
  let status = 'unregistered';
  if (isRegistered) status = city ? 'registered' : 'private';
  return {
    publicCode: cleanText(row.public_code),
    editionLabel: editionLabel(row.edition_number),
    status,
    ordinal,
    city,
    brightness: isRegistered
      ? COLLECTOR_FIELD_RESTING_BRIGHTNESS
      : COLLECTOR_FIELD_DIM_BRIGHTNESS,
    markerSize: COLLECTOR_FIELD_NEUTRAL_MARKER_SIZE,
    _sort: `${String(Number(row.edition_number ?? 0)).padStart(12, '0')}:${row.public_code || ''}:${row.id}`,
  };
}

function syntheticCatalogIdentity() {
  return {
    publicCode: null,
    editionLabel: null,
    status: 'unregistered',
    ordinal: null,
    city: null,
    brightness: COLLECTOR_FIELD_DIM_BRIGHTNESS,
    markerSize: COLLECTOR_FIELD_NEUTRAL_MARKER_SIZE,
    _sort: '',
  };
}

function stripInternalIdentity(identity) {
  const { _sort: _sort, ...safe } = identity;
  return safe;
}

export function projectCollectorField({
  generatedAt,
  catalogRows,
  identityRows,
  consentRows,
  metadataByArtworkId,
  sourceEventsByPiece,
}) {
  const catalogById = new Map(catalogRows.map((row) => [row.artwork_id, row]));
  const consentByIdentity = new Map(consentRows.map((row) => [row.keeper_piece_id, row]));
  const identitiesByArtwork = new Map();
  const rowsByArtwork = new Map();
  const chainTips = {};

  for (const row of identityRows) {
    const artworkRows = rowsByArtwork.get(row.piece_id) || [];
    artworkRows.push(row);
    rowsByArtwork.set(row.piece_id, artworkRows);
    const sourceEvents = sourceEventsByPiece.get(row.id) || [];
    const hasSource = sourceEvents.length > 0;
    if (row.registration_status !== 'registered' && !hasSource) continue;
    if (row.registration_status !== 'registered' && !sourceIdentityIsPublic(sourceEvents)) continue;
    const projected = identityProjection(row, consentByIdentity.get(row.id));
    const list = identitiesByArtwork.get(row.piece_id) || [];
    list.push(projected);
    identitiesByArtwork.set(row.piece_id, list);
    const tipKey = `${row.piece_id}:${Number(row.edition_number ?? 0)}`;
    const nativeTip = cleanText(row.lineage_head_hash);
    if (nativeTip) chainTips[`${tipKey}:native`] = nativeTip;
    const sourceTip = sourceEvents.at(-1)?.hash;
    if (sourceTip) chainTips[tipKey] = sourceTip;
  }

  const artworkIds = new Set([
    ...catalogById.keys(),
    ...identitiesByArtwork.keys(),
  ]);
  const lights = [...artworkIds].sort(compareText).map((artworkId) => {
    const catalog = catalogById.get(artworkId);
    const metadata = metadataByArtworkId.get(artworkId);
    const rowsForArtwork = rowsByArtwork.get(artworkId) || [];
    const source = rowsForArtwork
      .map((row) => sourceMeta(sourceEventsByPiece.get(row.id)))
      .find((candidate) => candidate.series);
    const identities = identitiesByArtwork.get(artworkId) || [syntheticCatalogIdentity()];
    identities.sort((a, b) => compareText(a._sort, b._sort));
    return {
      artworkId,
      title: cleanText(metadata?.title) || artworkId,
      series: cleanText(catalog?.series) || cleanText(metadata?.series) || source?.series || null,
      year: numericYear(metadata?.year),
      identity: identities.map(stripInternalIdentity),
    };
  });

  const series = [...new Set(lights.map((artwork) => artwork.series).filter(Boolean))]
    .sort(compareText);
  const years = [...new Set(lights.map((artwork) => artwork.year).filter(Number.isSafeInteger))]
    .sort((a, b) => a - b);
  const placeMap = new Map();
  for (const artwork of lights) {
    for (const identity of artwork.identity) {
      if (identity.city) {
        placeMap.set(identity.city.id, {
          id: identity.city.id,
          label: identity.city.label,
        });
      }
    }
  }
  const places = [...placeMap.values()]
    .sort((a, b) => compareText(a.label, b.label) || compareText(a.id, b.id));

  return {
    generatedAt,
    schemaVersion: COLLECTOR_FIELD_SCHEMA_VERSION,
    lights,
    facets: { series, years, places },
    chainTips: Object.fromEntries(
      Object.entries(chainTips).sort(([a], [b]) => compareText(a, b)),
    ),
  };
}
