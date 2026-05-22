export interface Place {
  /** Display label, e.g. "Denpasar, Bali, Indonesia". */
  label: string;
  lat: number;
  lng: number;
  /** IANA timezone id at the time of birth (e.g. "Asia/Denpasar"). */
  tzId: string;
}

type CitiesIndex = ReadonlyArray<{
  name: string;
  admin?: string;
  country: string;
  cc: string;        // ISO-3166 alpha-2
  lat: number;
  lng: number;
  tz: string;        // IANA id
}>;

let _index: CitiesIndex | null = null;
let _indexLoad: Promise<CitiesIndex> | null = null;

/**
 * Lazy-load the bundled cities dataset on first use. Served as a static
 * asset from /data/cities-index.json so it cache-busts independently of
 * the JS bundle.
 */
async function loadCitiesIndex(): Promise<CitiesIndex> {
  if (_index) return _index;
  if (!_indexLoad) {
    _indexLoad = fetch('/data/cities-index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CitiesIndex) => {
        _index = data;
        return data;
      })
      .catch(() => {
        _index = [];
        return [];
      });
  }
  return _indexLoad;
}

/**
 * Typeahead search across the bundled cities index. Returns up to
 * `limit` matches sorted by the order they appear in the dataset
 * (already population-sorted at build time).
 */
export async function searchPlaces(query: string, limit = 8): Promise<Place[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const idx = await loadCitiesIndex();
  const out: Place[] = [];
  for (const c of idx) {
    const haystack = `${c.name} ${c.admin ?? ''} ${c.country}`.toLowerCase();
    if (haystack.includes(q)) {
      out.push({
        label: [c.name, c.admin, c.country].filter(Boolean).join(', '),
        lat: c.lat,
        lng: c.lng,
        tzId: c.tz,
      });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Convert a local (date, time, IANA tz) tuple to a UTC moment.
 *
 * Uses `Intl.DateTimeFormat` to read the offset that the host's IANA db
 * believes was in effect at that local moment, then walks back the
 * difference. This handles historical DST changes because the host
 * timezone db is the modern IANA db.
 */
export function placeToUtc(dateStr: string, timeStr: string, tzId: string): Date {
  // Pretend the local date+time is already UTC so we can construct a Date.
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  // Find the UTC offset (in minutes) that `tzId` had at this naive moment.
  // We probe once, then refine — the offset itself can shift by an hour
  // on DST days, but two passes is enough to converge.
  const fmt = new Intl.DateTimeFormat('en-US', {
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
    const parts = fmt.formatToParts(new Date(epochMs));
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    let yr = get('year');
    const mo = get('month');
    const da = get('day');
    let hr = get('hour');
    const mi = get('minute');
    const se = get('second');
    // Intl returns "24" for midnight on some platforms — normalise.
    if (hr === 24) hr = 0;
    return Date.UTC(yr, mo - 1, da, hr, mi, se);
  };

  // First pass: how does the IANA db interpret `naiveUtcMs`?
  let utcMs = naiveUtcMs;
  for (let i = 0; i < 2; i++) {
    const offsetMs = partsToUtc(utcMs) - utcMs;
    utcMs = naiveUtcMs - offsetMs;
  }
  return new Date(utcMs);
}

