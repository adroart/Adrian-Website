export interface Place {
  label: string;
  lat: number;
  lng: number;
  tzId: string;
}

type CitiesIndex = ReadonlyArray<{
  name: string;
  admin?: string;
  country: string;
  cc: string;
  lat: number;
  lng: number;
  tz: string;
}>;

let index: CitiesIndex | null = null;
let indexLoad: Promise<CitiesIndex> | null = null;

async function loadCitiesIndex(): Promise<CitiesIndex> {
  if (index) return index;
  if (!indexLoad) {
    indexLoad = fetch('/data/cities-index.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((data: CitiesIndex) => {
        index = data;
        return data;
      })
      .catch(() => {
        index = [];
        return [];
      });
  }
  return indexLoad;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export async function searchPlaces(query: string, limit = 8): Promise<Place[]> {
  const normalized = fold(query.trim());
  if (normalized.length < 2) return [];
  const tokens = normalized.split(/[\s,]+/).filter(Boolean);
  const cities = await loadCitiesIndex();
  const scored: Array<{ place: Place; score: number; order: number }> = [];

  for (let order = 0; order < cities.length; order += 1) {
    const city = cities[order];
    const name = fold(city.name);
    const full = fold(`${city.name} ${city.admin ?? ''} ${city.country}`);
    if (!tokens.every((token) => full.includes(token))) continue;
    const first = tokens[0];
    let score = 20;
    if (name === normalized) score = 100;
    else if (name === first) score = 95;
    else if (name.startsWith(first)) score = 80;
    else if (name.includes(first)) score = 60;
    if (tokens.length > 1) {
      const rest = fold(`${city.admin ?? ''} ${city.country}`);
      if (tokens.slice(1).every((token) => rest.includes(token))) score += 15;
    }
    scored.push({
      place: {
        label: [city.name, city.admin, city.country].filter(Boolean).join(', '),
        lat: city.lat,
        lng: city.lng,
        tzId: city.tz,
      },
      score,
      order,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map(({ place }) => place);
}

export function placeToUtc(dateStr: string, timeStr: string, tzId: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tzId,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const partsToUtc = (epochMs: number): number => {
    const parts = formatter.formatToParts(new Date(epochMs));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const formattedYear = get('year');
    const formattedMonth = get('month');
    const formattedDay = get('day');
    const formattedHour = get('hour') === 24 ? 0 : get('hour');
    return Date.UTC(
      formattedYear,
      formattedMonth - 1,
      formattedDay,
      formattedHour,
      get('minute'),
      get('second'),
    );
  };
  let utcMs = naiveUtcMs;
  for (let index = 0; index < 2; index += 1) {
    const offsetMs = partsToUtc(utcMs) - utcMs;
    utcMs = naiveUtcMs - offsetMs;
  }
  const resolved = formatter.formatToParts(new Date(utcMs));
  const resolvedPart = (type: string) => Number(
    resolved.find((part) => part.type === type)?.value,
  );
  const resolvedHour = resolvedPart('hour') === 24 ? 0 : resolvedPart('hour');
  if (resolvedPart('year') !== year
    || resolvedPart('month') !== month
    || resolvedPart('day') !== day
    || resolvedHour !== hour
    || resolvedPart('minute') !== minute) {
    throw new Error('nonexistent_local_time');
  }
  return new Date(utcMs);
}
