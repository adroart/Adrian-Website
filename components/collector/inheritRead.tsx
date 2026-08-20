/**
 * The heir's readable writings, opened.
 *
 * "In his own words" used to be three one-line rows that routed straight
 * home. The artist's second walk asked for more: rows that open, full
 * multi-paragraph writings rather than one-word sentences, and inside each
 * one a way to let it shine — arm on the first press, commit on the second,
 * and once it shines there is no way back (the same rule the garden's three
 * tiers already keep for a sealed or kept dream).
 *
 * Split out of walk.tsx because this reading view is its own small screen
 * with its own back door and its own control, and nothing else on the walk
 * shares its shape. Demo-only: the shine state that walk.tsx threads through
 * here lives in React state, never storage.
 */

import React, { useState } from 'react';
import { COPY, PLACEHOLDERS } from './copy';
import { C, F } from './tokens';
import { Body, Brass, Note, TLink } from './ui';

/**
 * Strings no copy.ts key exists for yet. copy.ts is frozen this pass, so
 * they live here, registered as placeholders exactly as walk.tsx and
 * wired.tsx already do. T3-COPY: hoist into copy.ts and have Adrian settle
 * them.
 */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

export type InheritWriting = {
  title: string;
  year: string;
  /** the row's own status line, plain demo text, unflagged — the same
      convention the original one-line rows used for "Sara" / "Ines" / "Tomas" */
  status: string;
  /** 2-3 paragraph demo body in the dead man's plain voice.
      workbook: his phrasing gets settled there. */
  paragraphs: string[];
};

export const INHERIT_WRITINGS: InheritWriting[] = [
  {
    title: '“I bought it the week your mother got well.”',
    year: '1998',
    status: 'he never let this shine',
    paragraphs: [
      ph(
        'I did not tell her what it cost. I am not sure I could have told anyone what it cost, because most of it was not money.',
      ), // workbook
      ph(
        'We had spent that spring in waiting rooms, and I remember standing in front of this piece and feeling, for the first time in months, like something in the world was still being made rather than only endured.',
      ), // workbook
      ph(
        'I bought it the week she got well. I have never let go of that timing, even if nobody else ever sees why it matters.',
      ), // workbook
    ],
  },
  {
    title: '“I have looked at it every morning since.”',
    year: '2004',
    status: 'he never let this shine',
    paragraphs: [
      ph('It hangs where the morning light finds it first, before it finds anything else in the house.'), // workbook
      ph(
        'Some mornings I only glance at it on the way to the coffee. Other mornings I stand there longer than I mean to. Either way, it is the first thing I see, and I chose that on purpose.',
      ), // workbook
      ph('I have looked at it every morning since, and I do not expect that to change while I am the one looking.'), // workbook
    ],
  },
  {
    title: '“If you are reading this it went to you, which is what I wanted.”',
    year: '2019',
    status: 'he marked this one for you',
    paragraphs: [
      ph('I wrote the other two for myself, mostly. This one I wrote for you, because by 2019 I already knew where I wanted it to end up.'), // workbook
      ph(
        'If you are reading this it went to you, which is what I wanted. Do with it what you like. Keep it quiet or let it speak; either one is the piece still doing its work.',
      ), // workbook
      ph('I marked this one for you on purpose. The rest I leave to you.'), // workbook
    ],
  },
];

/** the row's status word once a writing has been let shine */
export const SHINING_STATUS = ph('shining');

const SHINE_ARM_NOTE = ph('Once it shines, it stays. Press again and it shines.');
/* "Let it shine" already exists twice, locked, elsewhere on the walk
   (rooms.tsx's family room and the garden's tier control) — reused here
   rather than re-registered, so the same words are never carried as both
   locked copy and an unsettled placeholder at once. */
const SHINE_LABEL = COPY.rooms.familyShine;
const BACK_TO_LIST = ph('Back to the list');

/**
 * One writing, opened: the full text, the date/status line, a quiet way back
 * to the list, and the let-it-shine control. A shone writing shows a quiet
 * shining state and carries no way to undo it.
 */
export const InheritReading: React.FC<{
  writing: InheritWriting;
  shining: boolean;
  onShine: () => void;
  onBack: () => void;
}> = ({ writing, shining, onShine, onBack }) => {
  const [armed, setArmed] = useState(false);

  const pressShine = () => {
    if (shining) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    onShine();
    setArmed(false);
  };

  return (
    <div
      style={{
        position: 'relative',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 8,
      }}
    >
      <div
        className="collector-scroll"
        style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: F.display,
            fontWeight: 300,
            fontSize: 26,
            lineHeight: 1.2,
            color: C.ink,
          }}
        >
          {writing.title}
        </h2>
        <div style={{ paddingTop: 6 }}>
          <Note>{`${writing.year} · ${shining ? SHINING_STATUS : writing.status}`}</Note>
        </div>
        <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {writing.paragraphs.map((paragraph, i) => (
            <Body key={i}>{paragraph}</Body>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 'none', paddingTop: 18 }}>
        {armed && !shining && (
          <div style={{ paddingBottom: 10 }}>
            <Note>{SHINE_ARM_NOTE}</Note>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <TLink onClick={onBack}>{BACK_TO_LIST}</TLink>
          {shining ? (
            <span
              style={{
                fontFamily: F.label,
                fontSize: 10.5,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: C.brass,
              }}
            >
              {SHINING_STATUS}
            </span>
          ) : (
            <Brass onClick={pressShine}>{SHINE_LABEL}</Brass>
          )}
        </div>
      </div>
    </div>
  );
};
