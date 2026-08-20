/**
 * stations.ts — pure derivation of a walkable station list from the real
 * collector wiring: `WALK`, `JUMP`, and `REVIEW`. No storage, no React.
 *
 * A station is one stop on the rail: a real `View` the shell can be pointed
 * at, the label the jump list already gave that view, and — where there is
 * one — a notice worth reading before judging what is on the screen. Nothing
 * here is hand-maintained data about the journey; it is all read off
 * `tourData.ts` and `review.ts` so a station list cannot drift from the real
 * wiring the way a hand-copied one eventually would.
 */

import { JUMP, View, WALK } from '../collector/tourData';
import type { Screen } from '../collector/walk';
import { KIND_LABEL, Note, REVIEW } from '../collector/review';

export type Station = { view: View; label: string; notice?: string };

/* ------------------------------------------------------------------ *
 * the four pseudo-targets a WALK screen's `to` or a row can point at,
 * which are not themselves WALK keys
 * ------------------------------------------------------------------ */

const PSEUDO = ['__home', '__garden', '__code', '__family'] as const;
type Pseudo = (typeof PSEUDO)[number];
const isPseudo = (k: string): k is Pseudo => (PSEUDO as readonly string[]).includes(k);

/** the real view each pseudo-target resolves to, once a chain reaches it */
const PSEUDO_VIEW: Record<Pseudo, View> = {
  __home: { kind: 'piece' },
  __garden: { kind: 'room', key: 'garden' },
  __code: { kind: 'code' },
  __family: { kind: 'room', key: 'family' },
};

/**
 * The two forks a chain cannot resolve from `WALK` alone: a row-choice
 * screen where which row a given flow takes depends on which flow is
 * walking it. `fork` is asked by two different journeys and answers each
 * differently; `passfork` the same. Every other row-choice screen in `WALK`
 * has exactly one live target (its other rows repeat it), so the generic
 * "first unvisited row target" rule in `walkChain` resolves those without
 * being told which flow is asking.
 */
export const BRANCH_CHOICE: Record<string, Record<string, string>> = {
  'Giving it as a gift': { fork: 'gift' },
  'Passing it to someone you love': { passfork: 'passname' },
  'Selling it to a stranger': { passfork: 'passsell' },
};

/* ------------------------------------------------------------------ *
 * labels and notices
 * ------------------------------------------------------------------ */

/** two views are the same station, by kind and (where it carries one) key.
 *  Exported so a host of a chain (the walkthrough rail) can tell whether a
 *  reported view matches the next station without re-deriving this rule. */
export const sameView = (a: View, b: View): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'piece' || a.kind === 'code') return true;
  return (a as { key: string }).key === (b as { key: string }).key;
};

/** the label the jump list already uses for this exact view, so a station
 *  reads with the same name a press in the jump list gives it. Falls back to
 *  the raw WALK key when nothing in the jump list names this view — every
 *  WALK key has a JUMP entry today, so this is a defensive fallback rather
 *  than a path any station currently takes. */
export const jumpLabelFor = (view: View): string => {
  for (const [, items] of JUMP) {
    for (const [label, target] of items) {
      if (sameView(target, view)) return label;
    }
  }
  return view.kind === 'walk' ? view.key : view.kind;
};

/** the review key this view's notes are filed under. Two views share a key
 *  with something else — the room called grid and the state called account —
 *  so they are looked up the same way `CollectorShell` already looks them
 *  up, rather than a second time by hand. */
const reviewKeyFor = (view: View): string => {
  if (view.kind === 'state') return view.key === 'account' ? 'account_state' : view.key;
  if (view.kind === 'room') return view.key === 'grid' ? 'grid_room' : view.key;
  if (view.kind === 'walk' || view.kind === 'letter') return view.key;
  return view.kind;
};

/**
 * How severe a note is, most to least: an open call decides the screen, a
 * known gap is knowingly wrong, unwritten copy is missing but harmless to
 * the walk, and `mine` is only about who drew the look. Lower number wins.
 */
const SEVERITY: Record<Note['kind'], number> = { call: 0, gap: 1, unwritten: 2, mine: 3 };

/**
 * The notice under one station.
 *
 * The surface's most severe review note wins, because that is the thing
 * most worth reading before judging what is on the screen: an open call
 * outranks a known gap, which outranks missing copy, which outranks a note
 * that is only about who drew the look. Ties within a kind keep the first
 * note of that kind, so the order authored in `review.ts` still matters
 * when two notes carry the same weight. It carries its `KIND_LABEL` prefix
 * for the three kinds that mean "this isn't settled yet" — unwritten copy,
 * a known gap, or an open call — because those change how the screen
 * should be read; a `mine` note is about who drew the look, not about the
 * screen misleading anyone, so it appears bare. Failing a review note, the
 * chapter's own note stands in, but only for the chapter's first station:
 * every other station stays quiet rather than repeat it.
 */
const noticeFor = (view: View, isFirst: boolean, chapterNote: string): string | undefined => {
  const notes: Note[] = REVIEW[reviewKeyFor(view)] ?? [];
  if (notes.length) {
    const n = notes.reduce((worst, cur) => (SEVERITY[cur.kind] < SEVERITY[worst.kind] ? cur : worst));
    return n.kind === 'mine' ? n.text : `${KIND_LABEL[n.kind]}: ${n.text}`;
  }
  return isFirst ? chapterNote : undefined;
};

export const stationFor = (view: View, isFirst: boolean, chapterNote: string): Station => ({
  view,
  label: jumpLabelFor(view),
  notice: noticeFor(view, isFirst, chapterNote),
});

/* ------------------------------------------------------------------ *
 * the chain walker
 * ------------------------------------------------------------------ */

/**
 * Follow a chain of real `WALK` screens exactly as a press through them
 * would, starting at `startKey` — included as the chain's own first
 * station — and stopping the moment the trail leaves `WALK` altogether: at
 * a pseudo-target (the piece page as its keeper, the garden, the code page,
 * or the family room) or at a screen this flow has no way to reach next.
 *
 * At each step: the screen's own `to` wins; failing that, the one branch
 * this flow is known to take out of a row-choice screen (`BRANCH_CHOICE`);
 * failing that, the first row target that is not the screen itself and has
 * not already been visited. A seen-set guards the walk: `person` names
 * itself as the target of two of its own three rows, and without the guard
 * that would loop forever rather than end the chain.
 *
 * `chainIsFirst` is false only when the chain is the tail of a
 * hand-authored prefix (the register flow's piece → code → codetrue) — the
 * chain's own start station must not fall back to the chapter note in that
 * case, because it is not really the chapter's first station; the prefix's
 * first station is.
 */
export const walkChain = (
  startKey: keyof typeof WALK,
  flowLabel: string,
  chapterNote: string,
  chainIsFirst = true,
): Station[] => {
  const stations: Station[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = startKey;

  while (cur !== undefined && !seen.has(cur)) {
    seen.add(cur);

    if (isPseudo(cur)) {
      stations.push(stationFor(PSEUDO_VIEW[cur], chainIsFirst && stations.length === 0, chapterNote));
      break;
    }

    const screen = (WALK as Record<string, Screen | undefined>)[cur];
    if (!screen) break; // unknown target: nothing further to walk

    const view: View = { kind: 'walk', key: cur as keyof typeof WALK };
    stations.push(stationFor(view, chainIsFirst && stations.length === 0, chapterNote));

    let next: string | undefined = screen.to;
    if (!next) next = BRANCH_CHOICE[flowLabel]?.[cur];
    if (!next && screen.rows) {
      next = screen.rows.map(([, , target]) => target).find(t => t !== cur && !seen.has(t));
    }
    cur = next;
  }

  return stations;
};
