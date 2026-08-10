export const COLLECTOR_FIELD_SCHEMA_VERSION = 3 as const;
export const COLLECTOR_FIELD_RESTING_BRIGHTNESS = 1 as const;
export const COLLECTOR_FIELD_DIM_BRIGHTNESS = 0.24 as const;
export const COLLECTOR_FIELD_NEUTRAL_MARKER_SIZE = 1 as const;

export type CollectorFieldPlaceFacet = {
  id: string;
  label: string;
};

export type CollectorFieldCity = CollectorFieldPlaceFacet & {
  country: string;
  lat: number;
  lng: number;
};

export type CollectorFieldIdentity = {
  publicCode: string | null;
  editionLabel: string | null;
  status: 'registered' | 'private' | 'unregistered';
  ordinal: number | null;
  city: CollectorFieldCity | null;
  brightness: 1 | 0.24;
  markerSize: 1;
};

export type CollectorFieldArtwork = {
  artworkId: string;
  title: string;
  series: string | null;
  year: number | null;
  identity: CollectorFieldIdentity[];
};

export type CollectorFieldState = {
  generatedAt: string;
  schemaVersion: 3;
  lights: CollectorFieldArtwork[];
  facets: {
    series: string[];
    years: number[];
    places: CollectorFieldPlaceFacet[];
  };
  chainTips: Record<string, string>;
};

function invalid(): never {
  throw new Error('collector_field_invalid');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) invalid();
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max
    || value.trim() !== value) invalid();
  return value;
}

function nullableText(value: unknown, max: number): string | null {
  return value === null ? null : text(value, max);
}

function editionNumber(label: string | null): number | null {
  if (label === null) return null;
  if (label === 'Original') return 0;
  const match = /^Edition ([1-9]\d*)$/.exec(label);
  if (!match) invalid();
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value)) invalid();
  return value;
}

function sortedUniqueText(values: unknown, max: number): string[] {
  if (!Array.isArray(values)) invalid();
  const parsed = values.map((value) => text(value, max));
  for (let index = 0; index < parsed.length; index += 1) {
    if (index > 0 && parsed[index - 1] >= parsed[index]) invalid();
  }
  return parsed;
}

function sameTextList(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sameNumberList(actual: readonly number[], expected: readonly number[]) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function parsePlaceFacet(value: unknown): CollectorFieldPlaceFacet {
  const place = record(value);
  exact(place, ['id', 'label']);
  const id = text(place.id, 120);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) invalid();
  return { id, label: text(place.label, 240) };
}

function parseCity(value: unknown): CollectorFieldCity | null {
  if (value === null) return null;
  const city = record(value);
  exact(city, ['id', 'label', 'country', 'lat', 'lng']);
  const facet = parsePlaceFacet({ id: city.id, label: city.label });
  if (typeof city.lat !== 'number' || !Number.isFinite(city.lat)
    || city.lat < -90 || city.lat > 90
    || typeof city.lng !== 'number' || !Number.isFinite(city.lng)
    || city.lng < -180 || city.lng > 180) invalid();
  return {
    ...facet,
    country: text(city.country, 120),
    lat: city.lat,
    lng: city.lng,
  };
}

function parseIdentity(value: unknown): CollectorFieldIdentity {
  const identity = record(value);
  exact(identity, [
    'publicCode', 'editionLabel', 'status', 'ordinal', 'city', 'brightness',
    'markerSize',
  ]);
  const publicCode = nullableText(identity.publicCode, 11);
  if (publicCode !== null && !/^AR-[A-Z0-9]{8}$/.test(publicCode)) invalid();
  const editionLabel = nullableText(identity.editionLabel, 80);
  if (!['registered', 'private', 'unregistered'].includes(String(identity.status))) invalid();
  const status = identity.status as CollectorFieldIdentity['status'];
  let ordinal: number | null = null;
  if (identity.ordinal !== null) {
    if (typeof identity.ordinal !== 'number'
      || !Number.isSafeInteger(identity.ordinal) || identity.ordinal <= 0) invalid();
    ordinal = identity.ordinal;
  }
  const city = parseCity(identity.city);
  if (identity.markerSize !== COLLECTOR_FIELD_NEUTRAL_MARKER_SIZE) invalid();
  if (status === 'registered') {
    if (!city || publicCode === null || ordinal === null
      || identity.brightness !== COLLECTOR_FIELD_RESTING_BRIGHTNESS) invalid();
  } else if (status === 'private') {
    if (city !== null || publicCode === null || ordinal === null
      || identity.brightness !== COLLECTOR_FIELD_RESTING_BRIGHTNESS) invalid();
  } else if (city !== null || ordinal !== null
    || identity.brightness !== COLLECTOR_FIELD_DIM_BRIGHTNESS) {
    invalid();
  }
  return {
    publicCode,
    editionLabel,
    status,
    ordinal,
    city,
    brightness: identity.brightness as 1 | 0.24,
    markerSize: 1,
  };
}

function parseArtwork(value: unknown): CollectorFieldArtwork {
  const artwork = record(value);
  exact(artwork, ['artworkId', 'title', 'series', 'year', 'identity']);
  const artworkId = text(artwork.artworkId, 128);
  if (!/^[A-Z][A-Z0-9]*-[0-9][A-Z0-9-]*$/.test(artworkId)) invalid();
  if (!Array.isArray(artwork.identity) || artwork.identity.length < 1) invalid();
  let year: number | null = null;
  if (artwork.year !== null) {
    if (!Number.isSafeInteger(artwork.year) || Number(artwork.year) < 1000
      || Number(artwork.year) > 9999) invalid();
    year = Number(artwork.year);
  }
  const identity = artwork.identity.map(parseIdentity);
  let previousEdition = -1;
  for (const entry of identity) {
    const edition = editionNumber(entry.editionLabel);
    if (edition === null) {
      if (identity.length !== 1 || entry.status !== 'unregistered'
        || entry.publicCode !== null || entry.ordinal !== null) invalid();
      continue;
    }
    if (edition <= previousEdition) invalid();
    previousEdition = edition;
  }
  return {
    artworkId,
    title: text(artwork.title, 300),
    series: nullableText(artwork.series, 80),
    year,
    identity,
  };
}

export function parseCollectorFieldState(value: unknown): CollectorFieldState {
  const state = record(value);
  exact(state, ['generatedAt', 'schemaVersion', 'lights', 'facets', 'chainTips']);
  if (state.schemaVersion !== COLLECTOR_FIELD_SCHEMA_VERSION
    || typeof state.generatedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(state.generatedAt)
    || !Number.isFinite(Date.parse(state.generatedAt))
    || new Date(state.generatedAt).toISOString() !== state.generatedAt
    || !Array.isArray(state.lights)) invalid();
  const lights = state.lights.map(parseArtwork);
  for (let index = 0; index < lights.length; index += 1) {
    if (index > 0 && lights[index - 1].artworkId >= lights[index].artworkId) invalid();
  }
  const facets = record(state.facets);
  exact(facets, ['series', 'years', 'places']);
  const series = sortedUniqueText(facets.series, 80);
  if (!Array.isArray(facets.years)) invalid();
  const years = facets.years.map((year) => {
    if (!Number.isSafeInteger(year) || Number(year) < 1000 || Number(year) > 9999) invalid();
    return Number(year);
  });
  for (let index = 0; index < years.length; index += 1) {
    if (index > 0 && years[index - 1] >= years[index]) invalid();
  }
  if (!Array.isArray(facets.places)) invalid();
  const places = facets.places.map(parsePlaceFacet);
  for (let index = 0; index < places.length; index += 1) {
    if (index > 0) {
      const before = places[index - 1];
      const after = places[index];
      if (before.label > after.label
        || (before.label === after.label && before.id >= after.id)) invalid();
    }
  }
  const expectedSeries = [...new Set(lights
    .map((artwork) => artwork.series)
    .filter((value): value is string => value !== null))].sort();
  const expectedYears = [...new Set(lights
    .map((artwork) => artwork.year)
    .filter((value): value is number => value !== null))].sort((a, b) => a - b);
  const expectedPlaceMap = new Map<string, CollectorFieldPlaceFacet>();
  for (const artwork of lights) {
    for (const identity of artwork.identity) {
      if (!identity.city) continue;
      const existing = expectedPlaceMap.get(identity.city.id);
      if (existing && existing.label !== identity.city.label) invalid();
      expectedPlaceMap.set(identity.city.id, {
        id: identity.city.id,
        label: identity.city.label,
      });
    }
  }
  const expectedPlaces = [...expectedPlaceMap.values()]
    .sort((a, b) => compareText(a.label, b.label) || compareText(a.id, b.id));
  if (!sameTextList(series, expectedSeries)
    || !sameNumberList(years, expectedYears)
    || places.length !== expectedPlaces.length
    || places.some((place, index) => place.id !== expectedPlaces[index].id
      || place.label !== expectedPlaces[index].label)) invalid();
  const chainTipsRecord = record(state.chainTips);
  const chainTips: Record<string, string> = {};
  const editionsByArtwork = new Map<string, Set<number>>();
  for (const artwork of lights) {
    const editions = new Set<number>();
    for (const identity of artwork.identity) {
      const edition = editionNumber(identity.editionLabel);
      if (edition !== null) editions.add(edition);
    }
    editionsByArtwork.set(artwork.artworkId, editions);
  }
  for (const key of Object.keys(chainTipsRecord).sort()) {
    const hash = chainTipsRecord[key];
    const match = /^([A-Z][A-Z0-9]*-[0-9][A-Z0-9-]*):(\d+)(?::native)?$/.exec(key);
    const edition = match ? Number(match[2]) : Number.NaN;
    if (!match || !Number.isSafeInteger(edition)
      || !editionsByArtwork.get(match[1])?.has(edition)
      || typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) invalid();
    chainTips[key] = hash;
  }
  return {
    generatedAt: state.generatedAt,
    schemaVersion: 3,
    lights,
    facets: { series, years, places },
    chainTips,
  };
}

export function parseCollectorFieldResponse(value: unknown): CollectorFieldState {
  const response = record(value);
  exact(response, ['ok', 'state']);
  if (response.ok !== true) invalid();
  return parseCollectorFieldState(response.state);
}

export async function fetchCollectorField(
  input: RequestInfo | URL = '/api/atlas',
  fetcher: typeof fetch = fetch,
): Promise<CollectorFieldState> {
  const response = await fetcher(input, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('collector_field_request_failed');
  return parseCollectorFieldResponse(await response.json());
}
