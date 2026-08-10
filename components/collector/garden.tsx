/**
 * The garden: Add to your piece.
 *
 * The garden does not live in onboarding. It lives on the piece page, always,
 * from the day of registration onward: fill one now, five next month, the rest
 * across years. Nothing is required and nothing expires.
 *
 * Three surfaces, and the design file picked the first two:
 *   ask   — the piece asks a single thing, full screen, in its own voice
 *   index — a numbered list carrying the first line of each answer, the piece's
 *           own table of contents
 *   write — the page the garden hands you to: one question, a plain rule, and
 *           the one real decision under it
 *
 * The card-stack arrangement (14b in the design file) predates these two and is
 * marked superseded there. It is not built.
 *
 * Sharing is the DEFAULT and the control is how you withhold, per the settled
 * privacy model: the piece shines, the person opts in. So the control is never
 * a permission request.
 *
 * OPEN, and Adrian's: the questions themselves. The eight in `copy.ts` show the
 * intended shape and are marked as placeholders.
 */

import React, { useState } from 'react';
import { C, F } from './tokens';
import { COPY } from './copy';
import { Area, Brass, Capsule, Eyebrow, Flag, Ground, Note, Plus, RoomBody, RoomHead, TLink } from './ui';

type View = 'ask' | 'index' | 'write';

/** what the piece already holds, for the shell */
const PLACED: (string | null)[] = [
  'I saw it in the hallway of a house I was leaving…',
  'On the long wall, where the afternoon reaches it…',
  'The night the power went out and we ate on the floor…',
  null,
  null,
  null,
  null,
  null,
];

export const Garden: React.FC<{ onWalk?: (key: string) => void; onClose?: () => void }> = ({ onClose }) => {
  const [view, setView] = useState<View>('ask');
  const [which, setWhich] = useState(3);

  if (view === 'index') {
    return (
      <GardenIndex
        onBack={() => setView('ask')}
        onPick={i => {
          setWhich(i);
          setView('write');
        }}
        onClose={onClose}
      />
    );
  }

  if (view === 'write') {
    return <QuestionPage index={which} onBack={() => setView('index')} onPlace={() => setView('index')} />;
  }

  return (
    <GardenAsk
      index={which}
      onSeeAll={() => setView('index')}
      onWrite={() => setView('write')}
      onAnother={() => setWhich(i => (i + 1) % COPY.garden.questions.length)}
    />
  );
};

/* ------------------------------------------------------------------ *
 * One at a time. The piece asks a single thing, full screen, in its own
 * voice. Nothing else on the screen.
 * ------------------------------------------------------------------ */

const GardenAsk: React.FC<{
  index: number;
  onSeeAll: () => void;
  onWrite: () => void;
  onAnother: () => void;
}> = ({ index, onSeeAll, onWrite, onAnother }) => (
  <Ground light="b" pad="44px 30px 30px">
    <div style={{ flex: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 }}>
      <Eyebrow>{COPY.garden.asks}</Eyebrow>
      <button
        type="button"
        onClick={onSeeAll}
        style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, color: C.brass }}
      >
        {COPY.garden.seeAll}
      </button>
    </div>

    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <p
        style={{
          margin: 0,
          fontFamily: F.display,
          fontWeight: 300,
          fontSize: 37,
          lineHeight: 1.14,
          color: C.ink,
          textWrap: 'pretty',
        }}
      >
        <Flag text={COPY.garden.questions[index]} />
      </p>
      <p style={{ margin: '22px 0 0', fontFamily: F.body, fontSize: 14.5, lineHeight: 1.7, color: C.inkBody }}>
        <Flag text={COPY.garden.frames[0]} />
      </p>
    </div>

    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingTop: 18,
        borderTop: `1px solid ${C.hair}`,
      }}
    >
      <TLink onClick={onAnother}>{COPY.garden.askOwn}</TLink>
      <button
        type="button"
        onClick={onWrite}
        style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: F.body, fontSize: 15.5, color: C.brass }}
      >
        {COPY.garden.writeIt} →
      </button>
    </div>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * The index. A numbered list with the first line of what was written
 * under each answered one, so the page reads as the piece's own table
 * of contents. No count anywhere, and no state is a failure.
 * ------------------------------------------------------------------ */

const GardenIndex: React.FC<{ onBack: () => void; onPick: (i: number) => void; onClose?: () => void }> = ({
  onBack,
  onPick,
}) => (
  <Ground light="a" pad="44px 30px 30px">
    <RoomHead title={COPY.garden.title} onBack={onBack} />
    <RoomBody top={20}>
      {COPY.garden.questions.map((q, i) => {
        const answer = PLACED[i];
        return (
          <button
            key={q}
            type="button"
            onClick={() => onPick(i)}
            style={{
              display: 'grid',
              gridTemplateColumns: '26px minmax(0,1fr)',
              gap: 14,
              width: '100%',
              padding: '15px 0',
              borderBottom: `1px solid ${C.hair}`,
              background: 'none',
              border: 0,
              borderBottomWidth: 1,
              borderBottomStyle: 'solid',
              borderBottomColor: C.hair,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ paddingTop: 5 }}>
              <Eyebrow tone={answer ? C.brass : C.inkQuiet}>{String(i + 1).padStart(2, '0')}</Eyebrow>
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: F.body, fontSize: 16, color: answer ? C.inkWarm : C.ink }}>
                <Flag text={q} />
              </span>
              {answer ? (
                <span
                  style={{
                    display: 'block',
                    paddingTop: 6,
                    fontFamily: F.body,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'rgba(242,227,196,.6)',
                  }}
                >
                  {answer}
                </span>
              ) : (
                <span style={{ display: 'block', paddingTop: 6 }}>
                  <Eyebrow>{COPY.garden.stateNotYet}</Eyebrow>
                </span>
              )}
            </span>
          </button>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingTop: 20 }}>
        <Plus />
        <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{COPY.garden.own}</span>
      </div>
    </RoomBody>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * A question, opened. One question, a plain rule, and the one real
 * decision under it.
 * ------------------------------------------------------------------ */

export const QuestionPage: React.FC<{ index: number; onBack: () => void; onPlace: () => void }> = ({
  index,
  onBack,
  onPlace,
}) => {
  const [text, setText] = useState('');
  const [where, setWhere] = useState<0 | 1>(0);

  return (
    <Ground light="k" pad="44px 30px 30px">
      <RoomHead title={COPY.garden.questions[index]} onBack={onBack} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 26 }}>
        <div style={{ flex: 'none' }}>
          <Note>{COPY.garden.frames[1]}</Note>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <Area value={text} hint={COPY.garden.answerHint} rows={5} onChange={setText} />
        </div>

        {/* the one real decision. Sharing is the default; this is how you
            withhold, never a permission request. */}
        <div style={{ flex: 'none', paddingTop: 16 }}>
          <div style={{ paddingBottom: 9 }}>
            <Eyebrow>{COPY.garden.whereLabel}</Eyebrow>
          </div>
          <Capsule options={[COPY.garden.whereShine, COPY.garden.whereKeep]} active={where} onPick={setWhere} />
          <div style={{ paddingTop: 10 }}>
            <Note>{COPY.garden.whereNote}</Note>
          </div>
        </div>

        {/* the lock is a single line, deliberately, so the mechanic can change
            without touching anything else on this screen */}
        <div style={{ flex: 'none', paddingTop: 14 }}>
          <Note>{COPY.garden.lock}</Note>
        </div>
      </div>

      <div
        style={{
          flex: 'none',
          marginTop: 'auto',
          paddingTop: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <TLink onClick={onBack}>{COPY.garden.finishLater}</TLink>
        <Brass onClick={onPlace}>{COPY.garden.place}</Brass>
      </div>
    </Ground>
  );
};
