/**
 * notes.ts — the walkthrough's own note-taking store.
 *
 * A tiny store over localStorage, keyed `walkthrough-notes:v1`, holding one
 * verdict and/or one free-text note per station Adrian has actually judged.
 * Nothing here calls a server: Adrian walks all twenty-one chapters leaving
 * notes across however many sittings that takes, then submits everything at
 * once from the notes drawer.
 *
 * Not part of the collector's own storage discipline
 * (`tests/collector-wiring.test.ts` only scans `components/collector/`):
 * this directory sits outside that scan, same as `Walkthrough.tsx`'s own
 * progress key, and remembering what was written about which station is the
 * whole point of this store.
 */

import { CHAPTERS } from './chapters';

export type Verdict = 'right' | 'notyet';

export type NoteEntry = {
  verdict?: Verdict;
  note?: string;
  /** the station's own label, captured at write time, so a single entry (or
   *  the digest below) reads standalone without cross-referencing chapters.ts */
  label: string;
  /** ISO timestamp of the entry's last edit */
  updatedAt: string;
};

/** one chapter's notes, keyed by station index */
export type ChapterNotes = Record<number, NoteEntry>;

/** the whole store, keyed by chapter id */
export type NotesStore = Record<string, ChapterNotes>;

const STORAGE_KEY = 'walkthrough-notes:v1';

const VERDICT_WORD: Record<Verdict, string> = {
  right: 'right',
  notyet: 'not right yet',
};

export const load = (): NotesStore => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as NotesStore;
  } catch {
    /* a corrupt or unavailable store just means starting empty */
  }
  return {};
};

export const save = (store: NotesStore): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private browsing or a full quota: notes just will not persist */
  }
};

/** true once a real verdict or a non-blank note is on the entry; an entry
 *  that fails this is dropped rather than kept empty. */
const isMeaningful = (entry: Pick<NoteEntry, 'verdict' | 'note'>): boolean =>
  Boolean(entry.verdict) || Boolean(entry.note?.trim());

/**
 * Merge one field change into one station's entry — a verdict, a note text,
 * or both — and persist the result. `label` is the station's current label,
 * restamped on every write so an old entry never carries a stale one.
 * Returns the new store (already saved) so a caller can hand it straight to
 * a state setter.
 */
export const update = (
  store: NotesStore,
  chapterId: string,
  stationIndex: number,
  label: string,
  patch: Partial<Pick<NoteEntry, 'verdict' | 'note'>>,
): NotesStore => {
  const chapter = store[chapterId] ?? {};
  const existing = chapter[stationIndex];
  const merged: NoteEntry = {
    verdict: 'verdict' in patch ? patch.verdict : existing?.verdict,
    note: 'note' in patch ? patch.note : existing?.note,
    label,
    updatedAt: new Date().toISOString(),
  };

  const nextChapter: ChapterNotes = { ...chapter };
  if (isMeaningful(merged)) nextChapter[stationIndex] = merged;
  else delete nextChapter[stationIndex];

  const next: NotesStore = { ...store };
  if (Object.keys(nextChapter).length) next[chapterId] = nextChapter;
  else delete next[chapterId];

  save(next);
  return next;
};

/** remove one station's entry outright (the notes drawer's "remove"). */
export const remove = (store: NotesStore, chapterId: string, stationIndex: number): NotesStore => {
  const chapter = store[chapterId];
  if (!chapter || !(stationIndex in chapter)) return store;

  const nextChapter: ChapterNotes = { ...chapter };
  delete nextChapter[stationIndex];

  const next: NotesStore = { ...store };
  if (Object.keys(nextChapter).length) next[chapterId] = nextChapter;
  else delete next[chapterId];

  save(next);
  return next;
};

/** wipe every note and verdict. Returns the empty store so a caller can set
 *  state with it directly, the same shape every other function here returns. */
export const clearAll = (): NotesStore => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if it was never written */
  }
  return {};
};

/** total notes-or-verdicts across the whole store, for "Your notes · N". */
export const countEntries = (store: NotesStore): number =>
  Object.values(store).reduce((n, chapter) => n + Object.keys(chapter).length, 0);

/** whether one station carries a note or a verdict, for the scrubber and
 *  chapter-list dots. */
export const hasEntry = (store: NotesStore, chapterId: string, stationIndex: number): boolean =>
  Boolean(store[chapterId]?.[stationIndex]);

/** whether any station in one chapter carries a note or a verdict. */
export const chapterHasEntries = (store: NotesStore, chapterId: string): boolean =>
  Boolean(store[chapterId] && Object.keys(store[chapterId]).length);

/**
 * A standalone markdown record of every note and verdict: `# Walkthrough
 * notes`, then one `## <chapter title>` heading per chapter that carries an
 * entry, in the walkthrough's own chapter order, then one line per noted
 * station in station order, with the note (if any) indented beneath it.
 * Reads on its own — pasted into a chat, or read back cold — without the
 * app open beside it.
 */
export const digest = (store: NotesStore): string => {
  const lines: string[] = ['# Walkthrough notes'];
  let any = false;

  for (const chapter of CHAPTERS) {
    const entries = store[chapter.id];
    if (!entries) continue;
    const stationIndices = Object.keys(entries)
      .map(Number)
      .sort((a, b) => a - b);
    if (!stationIndices.length) continue;

    any = true;
    lines.push('', `## ${chapter.title}`);
    for (const stationIndex of stationIndices) {
      const entry = entries[stationIndex];
      const verdictWord = entry.verdict ? VERDICT_WORD[entry.verdict] : 'no verdict';
      lines.push('', `- Station ${stationIndex + 1} · ${entry.label} · ${verdictWord}`);
      if (entry.note?.trim()) lines.push(`  ${entry.note.trim()}`);
    }
  }

  if (!any) lines.push('', 'No notes yet.');
  return lines.join('\n');
};
