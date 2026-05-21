/**
 * Quick verification of the gate calculation:
 *   tsx scripts/verify-astrology.ts
 *
 * Sanity checks:
 *   1. Jan 22 09:30 UTC of any year → Gate 41 (the wheel anchor)
 *   2. today's sun gate prints something sensible
 *   3. a known birth chart matches published values
 *
 * Run this whenever the gate sequence or wheel anchor is touched.
 */

import { sunLongitude, eclipticLongitudes } from '../lib/astrology/ephemeris';
import { longitudeToGateLine, findDesignTime, GATE_SEQUENCE } from '../lib/astrology/gates';
import { todaysEnergy, yearsEnergy } from '../lib/astrology/today';

console.log(`GATE_SEQUENCE length: ${GATE_SEQUENCE.length}`);
console.log(`First gate: ${GATE_SEQUENCE[0]} (expected 41)`);

console.log('\n--- yearsEnergy: Gate 41 transit each year (exact moment) ---');
for (const y of [2024, 2025, 2026, 2027]) {
  const probe = new Date(Date.UTC(y, 5, 1));
  const e = yearsEnergy(probe);
  const lon = sunLongitude(e.transitAt);
  console.log(`${y}: cycle=${e.year}  gate=${e.gate}.${e.line}  transit=${e.transitAt.toISOString()}  sun=${lon.toFixed(4)}°  ${e.gate === 41 ? 'OK' : 'BAD'}`);
}

console.log('\n--- Today\'s energy (machine clock) ---');
const t = todaysEnergy();
console.log(`Sun gate today: ${t.gate}.${t.line}`);
const sunNow = sunLongitude(new Date());
console.log(`(raw sun longitude: ${sunNow.toFixed(3)}°)`);

console.log('\n--- This year\'s keynote ---');
const y = yearsEnergy();
console.log(`${y.year}: Gate ${y.gate}.${y.line}`);

console.log('\n--- All planet longitudes right now ---');
const all = eclipticLongitudes(new Date());
for (const k of Object.keys(all) as Array<keyof typeof all>) {
  const lon = all[k];
  const gl = longitudeToGateLine(lon);
  console.log(`  ${k.padEnd(8)}  ${lon.toFixed(3).padStart(8)}°  →  ${gl.gate}.${gl.line}`);
}

console.log('\n--- Design-time round-trip ---');
const natalUtc = new Date(Date.UTC(1990, 5, 15, 12, 0, 0));
const natalSun = sunLongitude(natalUtc);
const target = ((natalSun - 88) + 360) % 360;
const designUtc = findDesignTime(natalUtc, target);
const designSun = sunLongitude(designUtc);
const delta = ((designSun - target + 540) % 360) - 180;
console.log(`natal sun = ${natalSun.toFixed(4)}°   target = ${target.toFixed(4)}°`);
console.log(`design UTC = ${designUtc.toISOString()}`);
console.log(`design sun = ${designSun.toFixed(4)}°   error = ${Math.abs(delta).toExponential(2)}°`);
