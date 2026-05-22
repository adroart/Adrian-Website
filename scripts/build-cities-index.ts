/**
 * Build a population-sorted cities index for the profile form's place
 * typeahead.
 *
 * The repo ships with a curated 92-city seed at public/data/cities-index.json
 * that covers most birthplaces customers are likely to enter. To expand it:
 *
 *   1. Download https://download.geonames.org/export/dump/cities15000.zip
 *   2. Unzip locally: `unzip cities15000.zip` (yields cities15000.txt, ~10MB)
 *   3. Run: `npx tsx scripts/build-cities-index.ts cities15000.txt [popFloor]`
 *      (popFloor defaults to 50000 — lower it for more cities, larger file)
 *
 * Output overwrites public/data/cities-index.json with all cities of
 * population >= popFloor, sorted by population descending so the typeahead
 * naturally prefers larger cities.
 *
 * The GeoNames file is CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * Include "Place data from GeoNames" in site credits if you ship a custom index.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface City {
  name: string;
  admin?: string;
  country: string;
  cc: string;
  lat: number;
  lng: number;
  tz: string;
}

// Country code → display name. Bare minimum for the seed countries plus
// a fallback. Extend as needed.
const COUNTRY_NAMES: Record<string, string> = {
  ID: 'Indonesia', SG: 'Singapore', TH: 'Thailand', MY: 'Malaysia',
  JP: 'Japan', KR: 'South Korea', HK: 'Hong Kong', TW: 'Taiwan',
  PH: 'Philippines', CN: 'China', IN: 'India', AE: 'United Arab Emirates',
  TR: 'Turkey', IL: 'Israel', EG: 'Egypt', ZA: 'South Africa',
  NG: 'Nigeria', GB: 'United Kingdom', IE: 'Ireland', FR: 'France',
  DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
  AT: 'Austria', CZ: 'Czechia', PL: 'Poland', IT: 'Italy', ES: 'Spain',
  PT: 'Portugal', GR: 'Greece', SE: 'Sweden', DK: 'Denmark', NO: 'Norway',
  FI: 'Finland', IS: 'Iceland', RU: 'Russia', US: 'United States',
  CA: 'Canada', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina', CL: 'Chile',
  PE: 'Peru', CO: 'Colombia', AU: 'Australia', NZ: 'New Zealand',
};

function main() {
  const [, , tsvPath, popFloorArg] = process.argv;
  if (!tsvPath) {
    console.error('Usage: tsx scripts/build-cities-index.ts <cities15000.txt> [popFloor=50000]');
    process.exit(1);
  }
  const popFloor = Number(popFloorArg ?? 50_000);

  const tsv = readFileSync(tsvPath, 'utf8');
  const rows = tsv.split('\n');

  type Row = City & { pop: number };
  const out: Row[] = [];
  for (const line of rows) {
    if (!line) continue;
    const f = line.split('\t');
    // GeoNames columns: 1=name, 4=lat, 5=lng, 8=country code,
    //                   10=admin1 code, 14=population, 17=timezone
    const name = f[1];
    const lat = Number(f[4]);
    const lng = Number(f[5]);
    const cc = f[8];
    const adminCode = f[10];
    const pop = Number(f[14] || 0);
    const tz = f[17];
    if (!name || !cc || !tz || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (pop < popFloor) continue;
    const country = COUNTRY_NAMES[cc] ?? cc;
    out.push({
      name,
      admin: adminCode || undefined,
      country,
      cc,
      lat,
      lng,
      tz,
      pop,
    });
  }
  out.sort((a, b) => b.pop - a.pop);

  // Strip `pop` from the persisted shape — it's only used here for ordering.
  const persisted = out.map(({ pop, ...rest }) => rest);
  const dest = resolve(__dirname, '../public/data/cities-index.json');
  writeFileSync(dest, JSON.stringify(persisted));
  console.log(`Wrote ${persisted.length} cities to ${dest}`);
}

main();
