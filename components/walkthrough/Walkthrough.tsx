/**
 * The guided walkthrough rail: the frame Adrian clicks through around the
 * real collector screens.
 *
 * It is not a second design of the journey. The phone above the rail is
 * either the real `CollectorShell` (`chrome="tour"`, no harness of its own)
 * pointed at one real `View`, or the real `CeremonyStation` running one of
 * the two artist-ceremony demos. The rail beneath it only ever narrates and
 * steers what is already true on the real screen: it advances the moment the
 * real screen reports it moved to the next station on its own (a tap inside
 * the phone), and its own Back/Next links move the real screen the same way
 * a jump-list press already does, through the shell's own `jumpTo`.
 *
 * Chapters come from `chapters.ts`: the twelve real journeys, the surfaces
 * none of them passes through, and the two ceremony demos, in that order.
 * Moving between chapters always opens on that chapter's first station,
 * whichever direction you came from; moving station to station inside one
 * chapter is what Back and Next are for.
 *
 * Layered on top of that walk is the feedback rail: a verdict and a note per
 * station, kept by `notes.ts` and reviewed all at once in `NotesDrawer`, so
 * Adrian can judge every station across the whole walk and submit it in one
 * pass rather than narrating out loud as he goes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { espresso } from '../ceremony/tokens';
import CollectorShell, { CollectorShellHandle } from '../collector/CollectorShell';
import type { View } from '../collector/tourData';
import CeremonyStation from './CeremonyStation';
import { CHAPTERS, Chapter } from './chapters';
import { sameView } from './stations';
import { NoteField, NotesDrawer, VerdictPair } from './NotesDrawer';
import * as notes from './notes';
import type { NotesStore, Verdict } from './notes';

const { palette: C, fonts: F } = espresso;

/* legal here, unlike inside the collector journey itself: this directory
   sits outside the collector's own storage-discipline scan, and remembering
   where a long walkthrough left off (and what was written along the way) is
   the whole point of a rail. */
const STORAGE_KEY = 'walkthrough-progress';

type Progress = { chapterId: string; stationIndex: number };

const loadProgress = (): Progress | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (typeof parsed.chapterId === 'string' && typeof parsed.stationIndex === 'number') {
      return { chapterId: parsed.chapterId, stationIndex: parsed.stationIndex };
    }
  } catch {
    /* a corrupt or unavailable store just means starting at the beginning */
  }
  return null;
};

const saveProgress = (p: Progress) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private browsing or a full quota: the walkthrough still works, it
       just will not remember where it was */
  }
};

export const Walkthrough: React.FC = () => {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [stationIndex, setStationIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notesStore, setNotesStore] = useState<NotesStore>(() => notes.load());
  const shellRef = useRef<CollectorShellHandle>(null);

  /* restore progress once, on mount, after CHAPTERS already exists */
  useEffect(() => {
    const saved = loadProgress();
    if (!saved) return;
    const idx = CHAPTERS.findIndex(c => c.id === saved.chapterId);
    if (idx < 0) return;
    const bound = Math.min(Math.max(saved.stationIndex, 0), CHAPTERS[idx].stations.length - 1);
    setChapterIndex(idx);
    setStationIndex(bound);
  }, []);

  const chapter: Chapter = CHAPTERS[chapterIndex];
  const station = chapter.stations[stationIndex];
  const total = chapter.stations.length;

  useEffect(() => {
    saveProgress({ chapterId: chapter.id, stationIndex });
  }, [chapter.id, stationIndex]);

  /* the note toggle only resets when the station itself changes, so it does
     not snap shut mid-sentence while the debounced save behind it settles */
  useEffect(() => {
    setNoteOpen(Boolean(notesStore[chapter.id]?.[stationIndex]?.note));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id, stationIndex]);

  const goToChapter = (idx: number) => {
    setChapterIndex(idx);
    setStationIndex(0);
    setListOpen(false);
  };

  /* observation: the real shell reports every view it lands on, whether that
     came from a tap inside the phone or from our own jumpTo below. Only a
     tap that lands on the very next station in this chapter's own list ever
     moves the rail; anything else (including a view this chapter does not
     name) leaves the rail exactly where it was. */
  const onCollectorViewChange = (v: View) => {
    if (chapter.kind !== 'collector') return;
    const upcoming = chapter.stations[stationIndex + 1];
    if (upcoming && sameView(upcoming.view, v)) setStationIndex(i => i + 1);
  };

  const onCeremonyStep = (step: string) => {
    if (chapter.kind !== 'ceremony') return;
    const upcoming = chapter.stations[stationIndex + 1];
    if (upcoming && upcoming.step === step) setStationIndex(i => i + 1);
  };

  const hasPrevChapter = chapterIndex > 0;
  const hasNextChapter = chapterIndex < CHAPTERS.length - 1;
  const atFinalStation = stationIndex === total - 1;

  const back = () => {
    if (chapter.kind === 'collector' && stationIndex > 0) {
      const idx = stationIndex - 1;
      setStationIndex(idx);
      shellRef.current?.jumpTo(chapter.stations[idx].view);
      return;
    }
    /* a ceremony chapter cannot be rewound a station at a time (nothing
       drives CeremonyStation backward), and a collector chapter's own first
       station has nothing behind it either: both fall through to leaving
       the chapter entirely, which the previous-chapter case below covers. */
    if (hasPrevChapter) goToChapter(chapterIndex - 1);
  };

  const next = () => {
    /* at a chapter's last station, Next stops meaning "advance within this
       chapter" (there is nothing left to advance to) and starts meaning
       "leave for the next chapter" — the same place the chapter strip's own
       next arrow, or the chapter list, would already take you. */
    if (atFinalStation) {
      if (hasNextChapter) goToChapter(chapterIndex + 1);
      return;
    }
    /* short of the final station, inside a ceremony chapter the real button
       in the frame is the only way forward: skipping ahead of it would show
       a station the ceremony has not actually reached yet. */
    if (chapter.kind !== 'collector') return;
    const idx = stationIndex + 1;
    setStationIndex(idx);
    shellRef.current?.jumpTo(chapter.stations[idx].view);
  };

  /** a direct jump to any other station in this chapter — the scrubber's own
   *  press, same mechanism as Back/Next: only legal inside a collector
   *  chapter, where the real screen can actually be pointed at a view. */
  const jumpToStation = (idx: number) => {
    if (chapter.kind !== 'collector' || idx === stationIndex) return;
    setStationIndex(idx);
    shellRef.current?.jumpTo(chapter.stations[idx].view);
  };

  const canBack = (chapter.kind === 'collector' && stationIndex > 0) || hasPrevChapter;
  const canNext = atFinalStation ? hasNextChapter : chapter.kind === 'collector';
  const nextLabel = atFinalStation && hasNextChapter ? 'Next chapter' : 'Next';

  const startOver = () => {
    goToChapter(0);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clean up if it was never written */
    }
  };

  /* keyboard: Right/Left move a station (where the rail already allows it),
     Shift+Right/Left move a whole chapter. Silent while any input or
     textarea has focus (the notes textarea foremost among them) and while
     the notes drawer is open over everything. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (drawerOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) {
          if (hasNextChapter) goToChapter(chapterIndex + 1);
        } else {
          next();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) {
          if (hasPrevChapter) goToChapter(chapterIndex - 1);
        } else {
          back();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, stationIndex, chapterIndex, drawerOpen]);

  const entry = notesStore[chapter.id]?.[stationIndex];

  const setVerdict = (v?: Verdict) => {
    setNotesStore(s => notes.update(s, chapter.id, stationIndex, station.label, { verdict: v }));
  };
  const setNoteText = (text: string) => {
    setNotesStore(s => notes.update(s, chapter.id, stationIndex, station.label, { note: text }));
  };
  const drawerUpdate = (
    chapterId: string,
    idx: number,
    label: string,
    patch: Parameters<typeof notes.update>[4],
  ) => setNotesStore(s => notes.update(s, chapterId, idx, label, patch));
  const drawerRemove = (chapterId: string, idx: number) =>
    setNotesStore(s => notes.remove(s, chapterId, idx));
  const drawerClearAll = () => setNotesStore(notes.clearAll());

  const totalNotes = notes.countEntries(notesStore);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.void,
        color: C.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '28px 16px 72px',
      }}
    >
      {/* the compact chapter strip: always visible, always the same shape,
          regardless of what kind of chapter is on screen */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 6,
          width: '100%',
          maxWidth: 460,
          paddingBottom: 16,
          fontFamily: F.label,
          fontSize: 10,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
        }}
      >
        <StripLink onClick={() => hasPrevChapter && goToChapter(chapterIndex - 1)} disabled={!hasPrevChapter}>
          ‹ previous
        </StripLink>
        <span style={{ color: C.inkGhost }}>
          · {chapter.title} · {chapterIndex + 1} of {CHAPTERS.length} ·
        </span>
        <StripLink onClick={() => hasNextChapter && goToChapter(chapterIndex + 1)} disabled={!hasNextChapter}>
          next ›
        </StripLink>
      </div>

      <div
        style={{
          position: 'relative',
          width: 390,
          height: 844,
          maxWidth: '100%',
          borderRadius: 34,
          background: C.ground,
          border: `1px solid ${C.hairStrong}`,
          overflow: 'hidden',
          boxShadow: '0 32px 64px -24px rgba(0,0,0,.7)',
        }}
      >
        {chapter.kind === 'ceremony' ? (
          <CeremonyStation key={chapter.id} surface={chapter.surface} onStepChange={onCeremonyStep} />
        ) : (
          <CollectorShell
            key={chapter.id}
            ref={shellRef}
            chrome="tour"
            initialView={chapter.stations[0].view}
            onViewChange={onCollectorViewChange}
          />
        )}
      </div>

      {/* the station scrubber: this chapter's stations as small numbered
          buttons. Collector chapters can jump station to station from here;
          a ceremony chapter renders the same row but only the current
          station is ever lit, everything else inert — the real button in
          the frame stays the only way forward there. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          maxWidth: 460,
          paddingTop: 16,
        }}
      >
        {chapter.stations.map((s, i) => {
          const current = i === stationIndex;
          const clickable = chapter.kind === 'collector' && !current;
          const marked = notes.hasEntry(notesStore, chapter.id, i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => clickable && jumpToStation(i)}
              disabled={!clickable}
              title={s.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 0,
                padding: '3px 5px',
                cursor: clickable ? 'pointer' : 'default',
                fontFamily: F.label,
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                color: current ? C.brass : C.inkGhost,
              }}
            >
              <span>{i + 1}</span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: marked ? C.brass : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* the caption rail: never part of the design, entirely the tour's own */}
      <div style={{ width: '100%', maxWidth: 460, paddingTop: 10, textAlign: 'center' }}>
        <span
          style={{
            display: 'block',
            fontFamily: F.label,
            fontSize: 10,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: C.inkQuiet,
          }}
        >
          {chapter.title}
        </span>

        <h2
          style={{
            margin: '10px 0 0',
            fontFamily: F.display,
            fontWeight: 300,
            fontSize: 24,
            lineHeight: 1.25,
            color: C.ink,
          }}
        >
          {station.label}
        </h2>

        {station.notice && (
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: F.body,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: C.inkBody,
            }}
          >
            {station.notice}
          </p>
        )}

        {chapter.kind === 'ceremony' && (
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: F.body,
              fontStyle: 'italic',
              fontSize: 12.5,
              color: C.inkGhost,
            }}
          >
            Use the real button in the frame to continue here.
          </p>
        )}

        <p
          style={{
            margin: '16px 0 0',
            fontFamily: F.label,
            fontSize: 10,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: C.inkGhost,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Station {stationIndex + 1} of {total}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, paddingTop: 14 }}>
          <RailLink onClick={back} disabled={!canBack}>
            Back
          </RailLink>
          <RailLink onClick={next} disabled={!canNext} brass>
            {nextLabel}
          </RailLink>
        </div>

        {/* the verdict and the note: judged per station, quietly, under
            everything that describes the station itself */}
        <div style={{ paddingTop: 22, borderTop: `1px solid ${C.hair}`, marginTop: 22 }}>
          <VerdictPair value={entry?.verdict} onChange={setVerdict} />

          <button
            type="button"
            onClick={() => setNoteOpen(o => !o)}
            style={{
              display: 'block',
              margin: '12px auto 0',
              background: 'none',
              border: 0,
              cursor: 'pointer',
              fontFamily: F.label,
              fontSize: 9.5,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: C.inkQuiet,
              padding: '4px 0',
            }}
          >
            {noteOpen ? 'Hide the note' : 'Leave a note'}
          </button>

          {noteOpen && (
            <div style={{ paddingTop: 10, textAlign: 'left' }}>
              <NoteField key={`${chapter.id}:${stationIndex}`} value={entry?.note ?? ''} onChange={setNoteText} />
            </div>
          )}
        </div>

        <div style={{ paddingTop: 22, borderTop: `1px solid ${C.hair}`, marginTop: 22 }}>
          <button
            type="button"
            onClick={() => setListOpen(o => !o)}
            style={{
              background: 'none',
              border: 0,
              cursor: 'pointer',
              fontFamily: F.label,
              fontSize: 9.5,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: C.inkQuiet,
              padding: '4px 0',
            }}
          >
            {listOpen ? 'Hide the chapters' : `Chapters · ${CHAPTERS.length}`}
          </button>

          {listOpen && (
            <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => goToChapter(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                    border: 0,
                    background: 'none',
                    padding: '7px 4px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: F.body,
                    fontSize: 13,
                    color: i === chapterIndex ? C.brass : C.inkBody,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {c.title}
                    {notes.chapterHasEntries(notesStore, c.id) && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: C.brass,
                        }}
                      />
                    )}
                  </span>
                  {c.kind === 'ceremony' && (
                    <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: '.1em', color: C.inkGhost }}>
                      ceremony
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {totalNotes > 0 && (
          <div style={{ paddingTop: 22, borderTop: `1px solid ${C.hair}`, marginTop: 22 }}>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={{
                background: 'none',
                border: 0,
                cursor: 'pointer',
                fontFamily: F.label,
                fontSize: 9.5,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: C.brass,
                padding: '4px 0',
              }}
            >
              Your notes · {totalNotes}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={startOver}
          style={{
            display: 'block',
            margin: '18px auto 0',
            background: 'none',
            border: 0,
            cursor: 'pointer',
            fontFamily: F.body,
            fontStyle: 'italic',
            fontSize: 12.5,
            color: C.inkGhost,
          }}
        >
          Start from the beginning
        </button>
      </div>

      <NotesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        store={notesStore}
        onUpdate={drawerUpdate}
        onRemove={drawerRemove}
        onClearAll={drawerClearAll}
      />
    </div>
  );
};

/** the compact chapter strip's own quiet link: same idiom as RailLink, but
 *  sized and cased to sit inline in the label-weight strip rather than the
 *  body-weight caption below it. */
const StripLink: React.FC<{ children: React.ReactNode; onClick: () => void; disabled?: boolean }> = ({
  children,
  onClick,
  disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      background: 'none',
      border: 0,
      padding: 0,
      cursor: disabled ? 'default' : 'pointer',
      font: 'inherit',
      color: disabled ? C.inkGhost : C.inkBody,
      opacity: disabled ? 0.45 : 1,
    }}
  >
    {children}
  </button>
);

const RailLink: React.FC<{ children: React.ReactNode; onClick: () => void; disabled?: boolean; brass?: boolean }> = ({
  children,
  onClick,
  disabled,
  brass,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      background: 'none',
      border: 0,
      padding: 0,
      cursor: disabled ? 'default' : 'pointer',
      fontFamily: F.body,
      fontSize: 14,
      color: disabled ? C.inkGhost : brass ? C.brass : C.inkBody,
      opacity: disabled ? 0.45 : 1,
    }}
  >
    {children}
  </button>
);

export default Walkthrough;
