/**
 * chapters.ts — the walkthrough's whole table of contents.
 *
 * Two sections, in this order:
 *
 *  - 'making' — the four artist-ceremony chapters FIRST. Adrian's own
 *    words: he never found these, sitting unsignaled at the tail of a long
 *    list, and they are the half of the walk that shows how a piece and its
 *    codes actually come to exist. They lead now, not trail.
 *  - 'collecting' — the twelve real journeys, one per flow in `FLOWS`, each
 *    walked out into stations by `stations.ts`; the surfaces none of those
 *    twelve ever passes through but the jump list still names, grouped the
 *    way the jump list already groups them, so a chapter of leftover states
 *    reads apart from a chapter of leftover rooms rather than piling both
 *    into one undifferentiated "everything else"; and the arrival studies,
 *    which sit right after "Registering it, all the way" rather than at the
 *    very end, since arriving at the vault is the payoff of registering.
 *
 * Every chapter carries a `section` field so the rail can header the list
 * and eyebrow the strip without re-deriving which half of the walk it is in.
 */

import { FLOWS, JUMP, View } from '../collector/tourData';
import { PLACEHOLDERS } from '../collector/copy';
import { Station, stationFor, walkChain } from './stations';
import { CeremonyChapter, ceremonyChapters } from './ceremonyChapters';

/** one station of the arrival chapter: which of the three vault-arrival
 *  studies to mount, and how the rail names and captions it */
export type ArrivalStationSpec = { variant: 'a' | 'b' | 'c'; label: string; notice: string };

/** which half of the walk a chapter belongs to: the making of a piece and
 *  its codes, or the collector's own journey through one already made */
export type Section = 'making' | 'collecting';

export type Chapter =
  | { id: string; title: string; note: string; stations: Station[]; kind: 'collector'; section: Section }
  | (CeremonyChapter & { kind: 'ceremony'; section: Section })
  | { kind: 'arrival'; id: string; title: string; note: string; stations: ArrivalStationSpec[]; section: Section };

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
  section: 'collecting' as const,
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

/**
 * WALK keys that must never surface as a leftover walkthrough station, even
 * though `JUMP` (owned elsewhere) may still name them while a concurrent
 * lane finishes retiring them:
 *
 *  - 'shows': retired from walking this wave. The screen stays defined in
 *    `WALK` — it remains a door reached from inside a room — but it is no
 *    longer something the walkthrough should offer as a leftover step.
 *  - 'born', 'links': being deleted outright from `WALK`/`JUMP` by a
 *    concurrent lane in this same wave. Listed here defensively in case this
 *    file builds against a moment before that deletion lands; once
 *    `WALK.born` and `WALK.links` are gone, these two entries are simply
 *    unreachable and harmless.
 */
const RETIRED_FROM_WALK: string[] = ['shows', 'born', 'links'];

const isRetiredFromWalk = (v: View): boolean => v.kind === 'walk' && RETIRED_FROM_WALK.includes(v.key);

const OTHER_CHAPTERS: Chapter[] = JUMP.flatMap(([section, items]) => {
  const leftover = items.filter(([, target]) => !COVERED.has(viewKey(target)) && !isRetiredFromWalk(target));
  if (!leftover.length) return [];
  return [
    {
      id: `other-${slug(section)}`,
      title: section,
      note: OTHER_NOTE,
      stations: leftover.map(([, target], i) => stationFor(target, i === 0, OTHER_NOTE)),
      kind: 'collector' as const,
      section: 'collecting' as const,
    },
  ];
});

/* ------------------------------------------------------------------ *
 * the four ceremony chapters, leading the walk as the 'making' section
 * ------------------------------------------------------------------ */

const CEREMONY: Chapter[] = ceremonyChapters.map(c => ({ ...c, kind: 'ceremony' as const, section: 'making' as const }));

/* ------------------------------------------------------------------ *
 * the arrival studies, spliced in right after "Registering it, all the
 * way" (see the final-order block below), not appended at the end
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
  section: 'collecting',
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

/* ------------------------------------------------------------------ *
 * the final order: making, then collecting
 *
 * The ceremony chapters lead. Inside the collecting section the twelve
 * flows keep their `FLOWS` order, except the arrival studies (which are not
 * a flow at all) are spliced in right after "Registering it, all the way"
 * rather than tacked on at the very end — the vault opening is the payoff of
 * registering, so it reads right beside it. The leftover-surface chapters
 * still close out the walk, exactly as before.
 * ------------------------------------------------------------------ */

const REGISTER_ID = slug('Registering it, all the way');
const registerChapter = FLOW_CHAPTERS.find(c => c.id === REGISTER_ID);
const restOfFlows = FLOW_CHAPTERS.filter(c => c.id !== REGISTER_ID);

/* defensive: FLOWS is owned elsewhere. If its first-flow label ever changes,
   fall back to the flows' own original order with the arrival appended
   after all of them, rather than silently dropping a chapter. */
const COLLECTING: Chapter[] = registerChapter
  ? [registerChapter, ARRIVAL, ...restOfFlows, ...OTHER_CHAPTERS]
  : [...FLOW_CHAPTERS, ARRIVAL, ...OTHER_CHAPTERS];

export const CHAPTERS: Chapter[] = [...CEREMONY, ...COLLECTING];
