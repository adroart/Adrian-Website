/**
 * NotesDrawer — the walkthrough's own submission surface.
 *
 * A full-height quiet panel listing every note and verdict left anywhere in
 * the twenty-one chapters, grouped the same way the rail's own chapter list
 * is grouped, each entry editable in place. Two ways out: copy the whole
 * digest to hand to Claude in chat, or, on a published Artifact that grants
 * the capability, write it into a static record the page itself keeps.
 *
 * This file also carries the two small controls the rail borrows for the
 * same job in miniature (`VerdictPair`, `NoteField`), so the look of judging
 * a station is identical whether it happens under the phone or in here.
 */

import React, { useEffect, useRef, useState } from 'react';
import { espresso } from '../ceremony/tokens';
import { CHAPTERS } from './chapters';
import { ChapterNotes, NoteEntry, NotesStore, Verdict, digest } from './notes';

const { palette: C, fonts: F } = espresso;

/* ------------------------------------------------------------------ *
 * shared small controls: the rail uses these under the phone, this
 * drawer uses them again per entry, so a judgment reads identically
 * wherever it is made
 * ------------------------------------------------------------------ */

const VERDICT_LABEL: Record<Verdict, string> = { right: 'right', notyet: 'not right yet' };

export const VerdictPair: React.FC<{ value?: Verdict; onChange: (v?: Verdict) => void }> = ({
  value,
  onChange,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
    {(['right', 'notyet'] as Verdict[]).map(v => (
      <button
        key={v}
        type="button"
        onClick={() => onChange(value === v ? undefined : v)}
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          fontFamily: F.body,
          fontSize: 13,
          color: value === v ? C.brass : C.inkQuiet,
        }}
      >
        {VERDICT_LABEL[v]}
      </button>
    ))}
  </div>
);

const NOTE_DEBOUNCE_MS = 400;
const KEPT_VISIBLE_MS = 1800;

/* a growing field stops at this height and scrolls inside itself, so a very
   long note never pushes the surface it sits on */
const MAX_GROW_PX = 320;

export const NoteField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** grow with the text as it is written, up to MAX_GROW_PX, instead of
   *  offering a resize handle — the rail and the note sheet use this so a
   *  long note expands in place and never asks the page to scroll */
  autoGrow?: boolean;
}> = ({ value, onChange, placeholder, rows = 3, autoGrow = false }) => {
  const [text, setText] = useState(value);
  const [kept, setKept] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const keptRef = useRef<number | undefined>(undefined);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(keptRef.current);
    },
    [],
  );

  /* size the field to its text after every render that changed it; height is
     set imperatively so React's style diffing never fights it */
  useEffect(() => {
    const el = areaRef.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_GROW_PX)}px`;
  }, [text, autoGrow]);

  const handleChange = (next: string) => {
    setText(next);
    setKept(false);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onChange(next);
      setKept(true);
      window.clearTimeout(keptRef.current);
      keptRef.current = window.setTimeout(() => setKept(false), KEPT_VISIBLE_MS);
    }, NOTE_DEBOUNCE_MS);
  };

  return (
    <div>
      <textarea
        ref={areaRef}
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: autoGrow ? 'none' : 'vertical',
          /* the growing field never starts smaller than its rows ask for:
             rows × line-height × font-size, plus the padding and border */
          minHeight: autoGrow ? Math.round(rows * 13 * 1.55) + 18 : undefined,
          maxHeight: autoGrow ? MAX_GROW_PX : undefined,
          overflowY: 'auto',
          background: 'rgba(237,233,226,.04)',
          border: `1px solid ${C.hair}`,
          borderRadius: 8,
          color: C.inkBody,
          fontFamily: F.body,
          fontSize: 13,
          lineHeight: 1.55,
          padding: 8,
        }}
      />
      <p
        aria-live="polite"
        style={{
          minHeight: 14,
          margin: '5px 0 0',
          fontFamily: F.label,
          fontSize: 9.5,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: C.inkGhost,
        }}
      >
        {kept ? 'Kept.' : ''}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * the "send the notes" runtime probe
 * ------------------------------------------------------------------ */

/* Minimal, local to this file: the published-Artifact runtime exposes
   `window.claude.use('artifact')`, resolving only where the capability is
   granted. Everywhere else — the dev server, a standalone prototype file —
   `window.claude` is simply undefined, and every access below is optional. */
declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

const RECORD_ID = 'walkthrough-notes-record';

/** Write the digest into a static element outside the React root. A
 *  published Artifact persists a viewer-gesture DOM mutation on a live-doc
 *  page; this only ever runs from inside the click handler that calls it,
 *  so it always carries a real gesture. */
const writeStaticRecord = (text: string) => {
  let section = document.getElementById(RECORD_ID);
  if (!section) {
    section = document.createElement('section');
    section.id = RECORD_ID;
    section.hidden = true;
    document.body.appendChild(section);
  }
  section.innerHTML = '';
  const pre = document.createElement('pre');
  pre.textContent = text;
  section.appendChild(pre);
};

/* ------------------------------------------------------------------ *
 * the drawer
 * ------------------------------------------------------------------ */

type Props = {
  open: boolean;
  onClose: () => void;
  store: NotesStore;
  onUpdate: (
    chapterId: string,
    stationIndex: number,
    label: string,
    patch: Partial<Pick<NoteEntry, 'verdict' | 'note'>>,
  ) => void;
  onRemove: (chapterId: string, stationIndex: number) => void;
  onClearAll: () => void;
};

const quietButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 0,
  cursor: 'pointer',
  fontFamily: F.body,
  fontSize: 13,
  color: C.inkBody,
  padding: 0,
};

export const NotesDrawer: React.FC<Props> = ({ open, onClose, store, onUpdate, onRemove, onClearAll }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setFallbackText(null);
      setConfirmStartOver(false);
    }
  }, [open]);

  useEffect(() => {
    if (fallbackText && fallbackRef.current) {
      fallbackRef.current.focus();
      fallbackRef.current.select();
    }
  }, [fallbackText]);

  if (!open) return null;

  const groups: { chapterId: string; title: string; entries: [number, NoteEntry][] }[] = CHAPTERS.map(c => ({
    chapterId: c.id,
    title: c.title,
    entries: Object.entries(store[c.id] ?? ({} as ChapterNotes))
      .map(([idx, entry]) => [Number(idx), entry] as [number, NoteEntry])
      .sort((a, b) => a[0] - b[0]),
  })).filter(g => g.entries.length);

  const total = groups.reduce((n, g) => n + g.entries.length, 0);

  const handleCopy = async () => {
    const text = digest(store);
    try {
      await navigator.clipboard.writeText(text);
      setFallbackText(null);
      setMessage('Copied. Paste it to Claude in the chat.');
    } catch {
      setFallbackText(text);
      setMessage('Select all and copy, then paste it to Claude in the chat.');
    }
  };

  const handleSend = async () => {
    let artifact: unknown = null;
    try {
      const use = window.claude?.use;
      if (use) artifact = await use('artifact');
    } catch {
      artifact = null;
    }

    if (artifact) {
      writeStaticRecord(digest(store));
      setFallbackText(null);
      setMessage('Sent. The notes are kept with this page.');
      return;
    }

    await handleCopy();
  };

  const handleStartOver = () => {
    if (!confirmStartOver) {
      setConfirmStartOver(true);
      return;
    }
    onClearAll();
    setConfirmStartOver(false);
    setMessage(null);
    setFallbackText(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Your notes"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(13,11,9,.55)' }}
      />

      <div
        style={{
          position: 'relative',
          width: 420,
          maxWidth: '100%',
          height: '100%',
          overflowY: 'auto',
          background: C.ground,
          borderLeft: `1px solid ${C.hairStrong}`,
          padding: '24px 22px 32px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: F.display, fontWeight: 300, fontSize: 22, color: C.ink }}>
            Your notes
          </h2>
          <button type="button" onClick={onClose} style={{ ...quietButtonStyle, color: C.inkGhost, fontSize: 13 }}>
            Close
          </button>
        </div>

        <p
          style={{
            margin: '4px 0 0',
            fontFamily: F.label,
            fontSize: 10,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: C.inkGhost,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {total} {total === 1 ? 'entry' : 'entries'}
        </p>

        {!groups.length && (
          <p style={{ marginTop: 20, fontFamily: F.body, fontSize: 13.5, color: C.inkQuiet }}>
            Nothing left yet. A verdict or a note on any station will show up here.
          </p>
        )}

        {groups.map(group => (
          <div key={group.chapterId} style={{ marginTop: 24 }}>
            <h3
              style={{
                margin: '0 0 10px',
                fontFamily: F.label,
                fontSize: 10,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: C.inkQuiet,
              }}
            >
              {group.title}
            </h3>

            {group.entries.map(([stationIndex, entry]) => (
              <div
                key={stationIndex}
                style={{
                  paddingTop: 14,
                  marginTop: 14,
                  borderTop: `1px solid ${C.hair}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: F.body,
                      fontSize: 13.5,
                      color: C.inkBody,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    Station {stationIndex + 1} · {entry.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(group.chapterId, stationIndex)}
                    style={{ ...quietButtonStyle, fontSize: 12, color: C.inkGhost, fontStyle: 'italic' }}
                  >
                    Remove
                  </button>
                </div>

                <div style={{ paddingTop: 8 }}>
                  <VerdictPair
                    value={entry.verdict}
                    onChange={v => onUpdate(group.chapterId, stationIndex, entry.label, { verdict: v })}
                  />
                </div>

                <div style={{ paddingTop: 8 }}>
                  <NoteField
                    value={entry.note ?? ''}
                    onChange={note => onUpdate(group.chapterId, stationIndex, entry.label, { note })}
                    placeholder="A note on this station"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.hairStrong}` }}>
          <div style={{ display: 'flex', gap: 22 }}>
            <button type="button" onClick={handleCopy} style={quietButtonStyle}>
              Copy all notes
            </button>
            <button type="button" onClick={handleSend} style={{ ...quietButtonStyle, color: C.brass }}>
              Send the notes
            </button>
          </div>

          {message && (
            <p style={{ margin: '10px 0 0', fontFamily: F.body, fontStyle: 'italic', fontSize: 12.5, color: C.inkQuiet }}>
              {message}
            </p>
          )}

          {fallbackText && (
            <textarea
              ref={fallbackRef}
              readOnly
              value={fallbackText}
              rows={6}
              style={{
                marginTop: 10,
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(237,233,226,.04)',
                border: `1px solid ${C.hair}`,
                borderRadius: 8,
                color: C.inkBody,
                fontFamily: F.mono,
                fontSize: 11.5,
                padding: 8,
              }}
            />
          )}

          <div style={{ marginTop: 22 }}>
            <button
              type="button"
              onClick={handleStartOver}
              style={{ ...quietButtonStyle, fontStyle: 'italic', color: confirmStartOver ? C.wrong : C.inkGhost }}
            >
              {confirmStartOver ? 'Sure? This clears every note and verdict. Press again.' : 'Start over'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesDrawer;
