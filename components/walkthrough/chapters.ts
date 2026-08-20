/**
 * chapters.ts — the walkthrough's whole table of contents.
 *
 * Twelve chapters, one per real journey in `FLOWS`, each walked out into
 * stations by `stations.ts`. Then the surfaces none of those twelve ever
 * passes through but the jump list still names — grouped the way the jump
 * list already groups them, so a chapter of leftover states reads apart
 * from a chapter of leftover rooms rather than piling both into one
 * undifferentiated "everything else". Then the two artist-ceremony demo
 * chapters a concurrent agent owns, appended last and unmodified.
 */

import { FLOWS, JUMP, View } from '../collector/tourData';
import { PLACEHOLDERS } from '../collector/copy';
import { Station, stationFor, walkChain } from './stations';
import { CeremonyChapter, ceremonyChapters } from './ceremonyChapters';

/** one station of the arrival chapter: which of the three vault-arrival
 *  studies to mount, and how the rail names and captions it */
export type ArrivalStationSpec = { variant: 'a' | 'b' | 'c'; label: string; notice: string };

export type Chapter =
  | { id: string; title: string; note: string; stations: Station[]; kind: 'collector' }
  | (CeremonyChapter & { kind: 'ceremony' })
  | { kind: 'arrival'; id: string; title: string; note: string; stations: ArrivalStationSpec[] };

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const viewKey = (v: View): string => (v.kind === 'piece' || v.kind === 'code' ? v.kind : `${v.kind}:${v.key}`);

/* ------------------------------------------------------------------ *
 * the twelve real journeys
 * ------------------------------------------------------------------ */

/** the register flow's piece → code → codetrue prefix is wired inline in
 *  the shell (`CollectorShell`'s `onBegin` and `onTrue` handlers), not in
 *  `WALK`, so it is hand-authored here rather than walked; the chain proper
 *  resumes at `codetrue` itself, per the plan. */
const registerStations = (label: string, note: string): Station[] => [
  stationFor({ kind: 'piece' }, true, note),
  stationFor({ kind: 'code' }, false, note),
  ...walkChain('codetrue', label, note, false),
];

const flowStations = (label: string, start: View, note: string): Station[] => {
  if (label === 'Registering it, all the way') return registerStations(label, note);
  if (start.kind === 'walk') return walkChain(start.key, label, note);
  // the one flow that starts on a room rather than a walk screen: "Adding
  // to your piece" opens straight on the garden, which is not itself a
  // WALK key, so there is nothing further to chain from here.
  return [stationFor(start, true, note)];
};

const FLOW_CHAPTERS: Extract<Chapter, { kind: 'collector' }>[] = FLOWS.map(([label, start, note]) => ({
  id: slug(label),
  title: label,
  note,
  stations: flowStations(label, start, note),
  kind: 'collector' as const,
}));

/* ------------------------------------------------------------------ *
 * everything else: what none of the twelve ever reaches
 * ------------------------------------------------------------------ */

const COVERED = new Set<string>();
for (const chapter of FLOW_CHAPTERS) {
  for (const s of chapter.stations) COVERED.add(viewKey(s.view));
}

/*
 * One chapter per JUMP section rather than a single monolithic pile: the
 * sections already group by moment in the journey — the door's other
 * states, a screen left off the threshold, the rooms behind the piece page,
 * the letters the piece itself writes, a way back into an account — and
 * that grouping is worth keeping. A director scanning the leftovers wants
 * to check "the states nothing walks through" as its own thing, separately
 * from "the rooms nothing walks through"; mixing five states, eight rooms,
 * and two letters into one chapter would read as an undifferentiated
 * dumping ground instead of the deliberate list it actually is. Sections
 * with nothing left over (the four, the passing, arriving by letter — every
 * entry in each is already reached by one of the twelve) are skipped.
 */
const OTHER_NOTE = 'Reachable only by a direct jump: no walked journey passes through here.';

const OTHER_CHAPTERS: Chapter[] = JUMP.flatMap(([section, items]) => {
  const leftover = items.filter(([, target]) => !COVERED.has(viewKey(target)));
  if (!leftover.length) return [];
  return [
    {
      id: `other-${slug(section)}`,
      title: section,
      note: OTHER_NOTE,
      stations: leftover.map(([, target], i) => stationFor(target, i === 0, OTHER_NOTE)),
      kind: 'collector' as const,
    },
  ];
});

/* ------------------------------------------------------------------ *
 * the two ceremony chapters, appended last
 * ------------------------------------------------------------------ */

const CEREMONY: Chapter[] = ceremonyChapters.map(c => ({ ...c, kind: 'ceremony' as const }));

/* ------------------------------------------------------------------ *
 * the arrival studies, appended last
 *
 * Adrian's ruling (wording record §7, item 2, 2026-08-20): the unlock must
 * arrive somewhere and stay; three arrivals are built for his walkthrough
 * and his verdict picks one. Each station mounts one self-contained study
 * from `components/collector/vaultArrival.tsx`, so Back/Next simply swap
 * studies — nothing here is a view the collector shell can be pointed at.
 * ------------------------------------------------------------------ */

/** the walk.tsx idiom: unwritten caption copy, registered so it reads as
 *  unwritten wherever the placeholder marks are on. T3-COPY. */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

const ARRIVAL: Chapter = {
  kind: 'arrival',
  id: 'arrival-choose',
  title: 'Choose the arrival',
  note: 'One of these becomes the way the vault opens; walk each and say which is true.',
  stations: [
    {
      variant: 'a',
      label: 'It parts and settles',
      notice: ph('The panels part over the piece page itself, and the true words settle into it.'),
    },
    {
      variant: 'b',
      label: 'Inside the opened vault',
      notice: ph('The ring stays standing, and for one beat the vault is the room the journey stands in.'),
    },
    {
      variant: 'c',
      label: 'The piece is the proof',
      notice: ph('The vault light resolves into the piece’s own drawing, and the true words follow it.'),
    },
  ],
};

export const CHAPTERS: Chapter[] = [...FLOW_CHAPTERS, ...OTHER_CHAPTERS, ...CEREMONY, ARRIVAL];
