/**
 * Verify the full profile pipeline with a known input.
 *   tsx scripts/verify-profile.ts
 *
 * Uses a sample date + Asia/Denpasar tz. Not a published chart, but lets
 * us sanity-check that the math runs, produces 11 valid {gate, line}
 * pairs, and is stable across re-runs.
 */

import { buildHologeneticProfile } from '../lib/astrology/profile';
import { placeToUtc } from '../lib/astrology/places';
import { PROFILE_POSITIONS } from '../data/profilePositions';

const inputs = {
  date: '1985-07-14',
  time: '09:30',
  place: { label: 'Denpasar, Bali, Indonesia', lat: -8.6705, lng: 115.2126, tzId: 'Asia/Makassar' },
};

const utc = placeToUtc(inputs.date, inputs.time, inputs.place.tzId);
console.log(`local: ${inputs.date} ${inputs.time} @ ${inputs.place.tzId}`);
console.log(`utc:   ${utc.toISOString()}`);

const p = buildHologeneticProfile({ utcBirth: utc });
console.log('\n--- Hologenetic Profile ---');
for (const meta of PROFILE_POSITIONS) {
  const gl = p[meta.key];
  const valid =
    gl.gate >= 1 && gl.gate <= 64 && gl.line >= 1 && gl.line <= 6 ? 'OK' : 'BAD';
  console.log(`  ${meta.label.padEnd(11)}  ${String(gl.gate).padStart(2)}.${gl.line}   ${valid}`);
}

// Stability: rerun once and confirm identical result.
const p2 = buildHologeneticProfile({ utcBirth: utc });
const stable = JSON.stringify(p) === JSON.stringify(p2);
console.log(`\nstability: ${stable ? 'OK' : 'BAD'}`);

// Sensitivity: change birth time by 1 minute and confirm at least one
// fast-moving position (Mercury / Pearl) shifts.
const utc2 = placeToUtc(inputs.date, '09:31', inputs.place.tzId);
const p3 = buildHologeneticProfile({ utcBirth: utc2 });
const moonShift = p.pearl.gate !== p3.pearl.gate || p.pearl.line !== p3.pearl.line;
console.log(`pearl shifts on +1 min birth time: ${moonShift ? 'changed' : 'unchanged (line stable)'}`);
console.log(`  before: ${p.pearl.gate}.${p.pearl.line}   after: ${p3.pearl.gate}.${p3.pearl.line}`);
