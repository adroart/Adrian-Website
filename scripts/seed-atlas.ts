/**
 * Reads FULL_ARCHIVE and writes a JSON file of suggested `created` events
 * Adrian can paste into the admin Seed Event form (or feed to a future bulk
 * endpoint). SOLD pieces are skipped — they should be `placed` somewhere
 * instead, and Adrian fills those in by hand.
 *
 * Run: tsx scripts/seed-atlas.ts
 * Output: /tmp/atlas-seed.json
 */
import fs from 'fs';
import path from 'path';
import { FULL_ARCHIVE } from '../data/mockData';
import type { LedgerEventType } from '../types';

interface SeedEvent {
    id: string;
    pieceId: string;
    type: LedgerEventType;
    date: string;
    cityId: null;
    note: string;
    actor: 'admin';
}

const OUTPUT = '/tmp/atlas-seed.json';

const today = new Date().toISOString();

const events: SeedEvent[] = FULL_ARCHIVE
    .filter((a) => a.availability !== 'SOLD')
    .map((a) => ({
        // Use crypto.randomUUID when available (Node 18+). Fall back to a
        // simple time-based id so this script runs even on older runtimes.
        id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? (crypto as Crypto).randomUUID()
                : `seed-${a.id}-${Date.now()}`,
        pieceId: a.id,
        type: 'created' as const,
        date: today,
        cityId: null,
        note: 'Auto-seeded from mockData',
        actor: 'admin' as const,
    }));

fs.writeFileSync(OUTPUT, JSON.stringify(events, null, 2), 'utf8');

const skipped = FULL_ARCHIVE.length - events.length;
console.log(
    `Wrote ${events.length} created-event seeds to ${path.resolve(OUTPUT)}`,
);
console.log(
    `Skipped ${skipped} SOLD piece${
        skipped === 1 ? '' : 's'
    } — Adrian, please add a 'placed' event for each of those manually.`,
);
