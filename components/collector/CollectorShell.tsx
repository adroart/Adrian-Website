/**
 * The collector shell: every surface of the journey, walkable.
 *
 * This is a LOOK AND NAVIGATION shell. Nothing is wired: no account, no
 * database, no `/api/keeper/*`, no flag read. The code that opens the piece is
 * sixteen ones and a code of sixteen nines runs the wrong-code state, both
 * checked in the browser. Everything a person types is thrown away on the next
 * screen. That is deliberate: the point of this pass is that the right graphics
 * are in the right places and the whole flow walks end to end.
 *
 * It lives at `/collector`, which is chromeless and off the site's navigation.
 * `components/WorksPage.tsx` at `/works/:code`, which is where the engraved QR
 * actually lands, is untouched: evolving it into this body is the next pass,
 * and doing it before the look is settled would put an unfinished surface on
 * live infrastructure.
 *
 * The jump list under the phone reaches any screen in one press, exactly as the
 * interactive spec does, so every part can be opened and looked at without
 * pressing through the flow to get there.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { C, F } from './tokens';
import { MARKS_DEFAULT } from './copy';
import { CollectorStyles } from './styles';
import { CollectorDisplay } from './display';
import { PiecePage, Relationship } from './PiecePage';
import { CodePage } from './CodePage';
import { VaultArrival } from './vaultArrival';
import { Room } from './rooms';
import { StateScreen } from './states';
import { LetterScreen } from './letters';
import { KIND_LABEL, Note, REVIEW } from './review';
import { WiredByCode } from './wired';
import { isValidPublicCode } from './api';
import { FLOWS, JUMP, View, WALK, WalkScreen, sourceOf } from './tourData';

export type { View } from './tourData';

/* ------------------------------------------------------------------ */

/** dev builds only: the same screens can be run against the real api.ts */
const DEV_SHELL = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

export type CollectorShellProps = {
  /** 'full' (default) is the review harness, byte-identical to before this
   *  contract existed. 'tour' hides that harness and renders only the phone
   *  frame and its screen, for a host page that supplies its own chrome. */
  chrome?: 'full' | 'tour';
  /**
   * How the journey is displayed. 'card' is the review vehicle: the phone at
   * the size it was drawn, floating, with the harness underneath. 'full' is
   * the product: the journey fills the screen it is opened on. See display.tsx.
   */
  frame?: 'card' | 'full';
  /** the view the shell opens on, before the `?screen=` mount effect (which
   *  still runs and may override it) has a chance to look at the URL */
  initialView?: View;
  onViewChange?: (view: View) => void;
};

export type CollectorShellHandle = {
  /** jump to any view from outside, with the same relationship inference a
   *  press in the Flows list uses */
  jumpTo: (view: View) => void;
};

/** the relationship a jump into `v` implies, exactly as the Flows onStart
 *  handler infers it: entering a room is entering as its keeper, and
 *  restarting at the piece page is entering unclaimed. Every other jump
 *  target (a walk screen, a state, a letter, the code page) carries no
 *  relationship of its own and leaves whoever was looking as they were. */
const relationshipForJump = (v: View): Relationship | undefined =>
  v.kind === 'room' ? 'yours' : v.kind === 'piece' ? 'unclaimed' : undefined;

const CollectorShell = forwardRef<CollectorShellHandle, CollectorShellProps>(function CollectorShell(
  { chrome = 'full', frame: frameProp, initialView, onViewChange }: CollectorShellProps,
  ref,
) {
  const [view, setView] = useState<View>(initialView ?? { kind: 'piece' });
  /* dev-only shell mode: 'demo' is the review vehicle, untouched; 'wired'
     runs the same screens against whatever backend the dev server proxies
     to. The sixteen-1s code only opens the piece in demo mode. */
  const [mode, setMode] = useState<'demo' | 'wired'>('demo');
  /* the review harness can flip between looking at the journey and using it;
     a host that states a frame owns it and the switch does not appear */
  const [frameState, setFrameState] = useState<'card' | 'full'>('card');
  const frame = frameProp ?? frameState;
  const [wiredCode, setWiredCode] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('unclaimed');
  const [placed, setPlaced] = useState(7);
  const [near, setNear] = useState(1);
  const [marks, setMarks] = useState(MARKS_DEFAULT);
  /* what has been typed anywhere in the flow, so a back link can actually be
     used to correct something rather than only to look at it again */
  const [typed, setTyped] = useState<Record<string, string>>({});
  /* Where the review has been. The design deliberately gives the flow no global
     back: the four advance on a tap and nothing behind them is meant to be
     revisited. So back lives in the harness, under the phone, and it restores
     who was looking as well as which surface, because the two travel together. */
  const [trail, setTrail] = useState<{ view: View; relationship: Relationship }[]>([]);

  /* the vault arrival's own once-only guard: true the first time this shell
     reaches codetrue, false on every return to it after. Read once per
     mount by VaultArrival itself; see its header for why that reading is
     frozen rather than reactive. */
  const arrivalPlayedRef = useRef(false);

  /** go somewhere, and remember where we were */
  const visit = (next: View, who?: Relationship) => {
    setTrail(t => [...t, { view, relationship }].slice(-60));
    if (who) setRelationship(who);
    setView(next);
  };

  useEffect(() => {
    onViewChange?.(view);
  }, [view]);

  useImperativeHandle(ref, () => ({
    jumpTo: (next: View) => visit(next, relationshipForJump(next)),
  }));

  /* the pop reads the trail from the closure rather than from inside the
     updater: a state updater must be pure, and StrictMode runs it twice */
  const back = () => {
    const last = trail[trail.length - 1];
    if (!last) return;
    setTrail(t => t.slice(0, -1));
    setView(last.view);
    setRelationship(last.relationship);
  };

  /* a screen can be reached directly, so a look can be shared as a link and a
     test can land on one surface without walking to it */
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('screen');
    if (!key) return;
    for (const [, items] of JUMP) {
      const hit = items.find(([, target]) => 'key' in target && target.key === key);
      if (hit) {
        setView(hit[1]);
        if (hit[1].kind === 'room') setRelationship('yours');
        return;
      }
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const go = (key: string) => {
    if (key === '__home') {
      setRelationship('yours');
      visit({ kind: 'piece' });
      return;
    }
    if (key === '__garden') {
      setRelationship('yours');
      visit({ kind: 'room', key: 'garden' });
      return;
    }
    if (key === '__code') {
      visit({ kind: 'code' });
      return;
    }
    if (key === '__family') {
      visit({ kind: 'room', key: 'family' }, 'yours');
      return;
    }
    if (key in WALK) visit({ kind: 'walk', key: key as keyof typeof WALK });
  };

  const caption =
    view.kind === 'walk'
      ? WALK[view.key].caption
      : view.kind === 'code'
        ? 'The code · sixteen characters, two rows of eight'
        : view.kind === 'room'
          ? 'A room · opened in place, never navigated to'
          : view.kind === 'state'
            ? 'A state the happy path does not walk'
            : view.kind === 'letter'
              ? 'What the piece writes · never from an app'
              : `The piece page · ${relationship}`;

  const source = sourceOf(view);

  /* what is worth checking on this exact surface */
  const notes: Note[] =
    (view.kind === 'state'
      ? REVIEW[view.key === 'account' ? 'account_state' : view.key]
      : view.kind === 'room'
        ? REVIEW[view.key === 'grid' ? 'grid_room' : view.key]
        : view.kind === 'walk' || view.kind === 'letter'
          ? REVIEW[view.key]
          : REVIEW[view.kind]) ?? [];

  const screen = (
    <>
      {view.kind === 'piece' && (
        <PiecePage
          relationship={relationship}
          placed={placed}
          near={near}
          onBegin={() => visit({ kind: 'code' })}
          onSignIn={() => visit({ kind: 'walk', key: 'welcome' })}
          onWalk={go}
        />
      )}
      {view.kind === 'code' && (
        <CodePage
          onTrue={() => visit({ kind: 'walk', key: 'codetrue' })}
          onNoCode={() => visit({ kind: 'state', key: 'account' })}
          onGift={() => visit({ kind: 'walk', key: 'gift' })}
          onBack={() => visit({ kind: 'piece' })}
        />
      )}
      {view.kind === 'walk' && view.key === 'codetrue' && (() => {
        /* codetrue's entrance dress, not a separate route: `play` is read
           once per mount (see the ref above and VaultArrival's own header)
           so a return to this exact key later in the same walk (or the
           walkthrough rail stepping back to it) renders already settled. */
        const play = !arrivalPlayedRef.current;
        arrivalPlayedRef.current = true;
        return <VaultArrival play={play} onGo={go} screen={WALK.codetrue} />;
      })()}
      {view.kind === 'walk' && view.key !== 'codetrue' && (
        <WalkScreen
          screen={WALK[view.key]}
          onGo={go}
          values={typed}
          onType={(label, value) => setTyped(t => ({ ...t, [label]: value }))}
        />
      )}
      {view.kind === 'room' && (
        <Room room={view.key} onClose={() => visit({ kind: 'piece' })} onWalk={go} />
      )}
      {view.kind === 'state' && (
        <StateScreen state={view.key} onBack={() => visit({ kind: 'piece' })} />
      )}
      {view.kind === 'letter' && (
        <LetterScreen letter={view.key} onBack={() => visit({ kind: 'piece' })} />
      )}
    </>
  );

  return (
    <div
      className="collector-root"
      data-marks={marks ? '1' : '0'}
      style={{ background: C.void, color: C.ink, minHeight: '100vh' }}
    >
      <CollectorStyles />

      {/* Two frames, and only one of them is the product. `card` is the phone
          at the size it was drawn, floating, for checking the journey against
          the design file. `full` is the journey filling the screen it was
          opened on, which is how it is actually used. What each screen size
          shows is decided in display.tsx, not here. */}
      <div className="collector-stage" data-frame={frame}>
        <CollectorDisplay />
        <div
          className="collector-frame"
          data-frame={frame}
          data-wide={view.kind === 'piece' ? '1' : '0'}
        >
          {mode === 'wired' && DEV_SHELL
            ? (isValidPublicCode(wiredCode)
                ? <WiredByCode key={wiredCode} publicCode={wiredCode} />
                : <div style={{ position: 'absolute', inset: 0, background: C.ground }} />)
            : screen}
        </div>

        {/* The one way back out of full, because the harness that normally
            carries the switch is not on screen there. It belongs to the
            review shell only: a host that states its own frame never gets it,
            so nothing of the harness can reach a real collector. */}
        {chrome !== 'tour' && !frameProp && frame === 'full' && (
          <button
            type="button"
            onClick={() => setFrameState('card')}
            style={{
              position: 'fixed',
              right: 14,
              bottom: 14,
              zIndex: 20,
              border: `1px solid ${C.hairStrong}`,
              borderRadius: 999,
              padding: '6px 14px',
              background: 'rgba(0,0,0,.45)',
              backdropFilter: 'blur(6px)',
              fontFamily: F.body,
              fontSize: 12,
              color: C.inkQuiet,
              cursor: 'pointer',
            }}
          >
            Back to review
          </button>
        )}

        {/* the harness below the phone: dev-mode chips, back/restart, caption,
            source, review notes, the flow starters, and the jump-list
            controls. None of it is part of the design; it exists so every
            surface can be reached and checked. A host page rendering its own
            chrome (chrome="tour") hides all of it and supplies its own. */}
        {chrome !== 'tour' && frame === 'card' && (
        <>
        {/* dev-only: run the same screens against the real api.ts. The demo
            mode above stays exactly what it was — Adrian's review vehicle. */}
        {DEV_SHELL && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginTop: 14,
              flexWrap: 'wrap',
            }}
          >
            {(['demo', 'wired'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                style={{
                  border: `1px solid ${mode === value ? C.brassEdge : C.hairStrong}`,
                  borderRadius: 999,
                  padding: '6px 15px',
                  background: 'none',
                  fontFamily: F.body,
                  fontSize: 12.5,
                  color: mode === value ? C.brass : C.inkQuiet,
                  cursor: 'pointer',
                }}
              >
                {value === 'demo' ? 'Demo' : 'Wired (dev)'}
              </button>
            ))}
            {mode === 'wired' && (
              <input
                value={wiredCode}
                onChange={e => setWiredCode(e.target.value.toUpperCase().trim())}
                placeholder="AR-XXXXXXXX"
                spellCheck={false}
                autoComplete="off"
                aria-label="Public code for wired mode"
                style={{
                  border: `1px solid ${C.hairStrong}`,
                  borderRadius: 999,
                  padding: '6px 15px',
                  background: 'none',
                  fontFamily: F.body,
                  fontSize: 12.5,
                  color: C.inkBody,
                  width: 150,
                }}
              />
            )}
          </div>
        )}

        {/* Looking at it, or using it. The card is the artboard at its drawn
            size, honest for review and wrong for use; full is the journey with
            the screen to itself. A host that states its own frame owns it and
            never sees this. */}
        {!frameProp && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            {(['card', 'full'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setFrameState(value)}
                style={{
                  border: `1px solid ${frame === value ? C.brassEdge : C.hairStrong}`,
                  borderRadius: 999,
                  padding: '6px 15px',
                  background: 'none',
                  fontFamily: F.body,
                  fontSize: 12.5,
                  color: frame === value ? C.brass : C.inkQuiet,
                  cursor: 'pointer',
                }}
              >
                {value === 'card' ? 'Review it' : 'Use it'}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            marginTop: 16,
            minHeight: 30,
          }}
        >
          <button
            type="button"
            onClick={back}
            disabled={!trail.length}
            title="Left arrow key"
            style={{
              border: `1px solid ${trail.length ? C.hairStrong : 'transparent'}`,
              borderRadius: 999,
              padding: '6px 15px',
              background: 'none',
              fontFamily: F.body,
              fontSize: 12.5,
              color: trail.length ? C.inkBody : 'transparent',
              cursor: trail.length ? 'pointer' : 'default',
            }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => {
              setTyped({});
              visit({ kind: 'piece' }, 'unclaimed');
            }}
            style={{
              border: `1px solid ${C.hairStrong}`,
              borderRadius: 999,
              padding: '6px 15px',
              background: 'none',
              fontFamily: F.body,
              fontSize: 12.5,
              color: C.inkQuiet,
              cursor: 'pointer',
            }}
          >
            Start over at the door
          </button>
        </div>

        <p
          className="collector-caption"
          style={{
            margin: '14px 0 0',
            fontFamily: F.label,
            fontSize: 10,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: C.inkQuiet,
            textAlign: 'center',
          }}
        >
          {caption}
        </p>

        {/* where this surface came from, so it can be checked against its
            source rather than against a memory */}
        <p
          className="collector-source"
          style={{
            margin: '8px 0 0',
            fontFamily: F.body,
            fontSize: 12.5,
            color: source ? C.brass : C.wrong,
            textAlign: 'center',
          }}
        >
          {source
            ? `Drawn in the design file, card ${source}`
            : 'Not drawn. Built from the wording record and the spec.'}
        </p>

        <ReviewPanel notes={notes} source={source} />

        <Flows onStart={next => visit(next, relationshipForJump(next))} />

        <Controls
          relationship={relationship}
          setRelationship={r => visit({ kind: 'piece' }, r)}
          placed={placed}
          setPlaced={setPlaced}
          near={near}
          setNear={setNear}
          marks={marks}
          setMarks={setMarks}
          onJump={next => visit(next, next.kind === 'room' ? 'yours' : undefined)}
        />
        </>
        )}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * The controls under the phone. These are the shell's own scaffolding
 * and are not part of the design: they exist so every state can be
 * reached and looked at, and they come out when this becomes the page.
 * ------------------------------------------------------------------ */

const Controls: React.FC<{
  relationship: Relationship;
  setRelationship: (r: Relationship) => void;
  placed: number;
  setPlaced: (n: number) => void;
  near: number;
  setNear: (n: number) => void;
  marks: boolean;
  setMarks: (b: boolean) => void;
  onJump: (v: View) => void;
}> = ({ relationship, setRelationship, placed, setPlaced, near, setNear, marks, setMarks, onJump }) => (
  <div style={{ width: '100%', maxWidth: 860, paddingTop: 30 }}>
    <Group label="Who is looking">
      {(
        [
          ['Nobody holds it', 'unclaimed'],
          ['Someone else holds it', 'registered'],
          ['Signed in, not yours', 'signedin'],
          ['It is yours', 'yours'],
          ['Still working it out', 'loading'],
        ] as [string, Relationship][]
      ).map(([label, value]) => (
        <Btn key={value} on={relationship === value} onClick={() => setRelationship(value)}>
          {label}
        </Btn>
      ))}
    </Group>

    <Group label="What is in it · the long glow">
      {[0, 2, 7, 12, 20].map(n => (
        <Btn key={n} on={placed === n} onClick={() => setPlaced(n)}>
          {n === 0 ? 'Nothing yet' : `${n} placed`}
        </Btn>
      ))}
    </Group>

    <Group label="Lately tended · the near light">
      {(
        [
          ['This month', 1],
          ['Some months ago', 0.5],
          ['A long while', 0.15],
        ] as [string, number][]
      ).map(([label, value]) => (
        <Btn key={label} on={near === value} onClick={() => setNear(value)}>
          {label}
        </Btn>
      ))}
    </Group>

    {/* Copy nobody has written yet carries a dashed rule. Switch it off to read
        the screens the way a visitor would; switch it on to see exactly how
        much of this is still waiting on Adrian. */}
    <Group label="Unwritten copy">
      <Btn on={marks} onClick={() => setMarks(true)}>
        Mark it
      </Btn>
      <Btn on={!marks} onClick={() => setMarks(false)}>
        Read it as a visitor
      </Btn>
    </Group>

    <p
      style={{
        margin: '18px 0 0',
        textAlign: 'center',
        fontFamily: F.body,
        fontStyle: 'italic',
        fontSize: 12.5,
        color: C.inkQuiet,
      }}
    >
      This piece’s code is sixteen ones. Sixteen nines runs the wrong-code state.
    </p>

    {/* the crosswalk, in the list itself: a screen the designer drew carries
        its card id, and a screen nobody drew says so. Those are the ones that
        most need Adrian's eye, because nothing exists to compare them to. */}
    <Group label="Reading the list below">
      <span style={{ fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet, lineHeight: 1.6 }}>
        A screen with a card id was <span style={{ color: C.brass }}>drawn in the design file</span>; check it
        against that card. A screen without one was{' '}
        <span style={{ color: C.wrong }}>built from the wording record and the spec</span>, and there is nothing
        to compare it to.
      </span>
    </Group>

    {JUMP.map(([section, items]) => (
      <Group key={section} label={section}>
        {items.map(([label, target]) => {
          const src = sourceOf(target);
          return (
            <Btn key={label} onClick={() => onJump(target)} tone={src ? 'drawn' : 'undrawn'}>
              {label}
              <span className="collector-src-tag" style={{ fontSize: 10, letterSpacing: '.08em', opacity: 0.75, marginLeft: 7 }}>
                {src ?? 'new'}
              </span>
            </Btn>
          );
        })}
      </Group>
    ))}
  </div>
);

/**
 * What is worth checking on the surface in view, and what it should have been
 * compared against.
 *
 * Four kinds of wrong, kept apart because they need different answers: copy
 * nobody has written, a decision still open, a screen nobody drew, and
 * something knowingly not right yet.
 */
const ReviewPanel: React.FC<{ notes: Note[]; source: string | null | undefined }> = ({ notes, source }) => {
  if (!notes.length) {
    return (
      <p style={{ margin: '14px 0 0', fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet, textAlign: 'center' }}>
        {source
          ? 'Nothing flagged here. Check it against the card and it should match.'
          : 'Nothing flagged here, and nothing to compare it to.'}
      </p>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 640,
        margin: '18px auto 0',
        border: `1px solid ${C.hairStrong}`,
        borderRadius: 16,
        padding: '16px 18px 18px',
        background: 'rgba(0,0,0,.22)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <span
        style={{
          fontFamily: F.label,
          fontSize: 9.5,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: C.inkQuiet,
        }}
      >
        What to check here
      </span>

      {notes.map((n, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span
            style={{
              flex: 'none',
              marginTop: 6,
              width: 5,
              height: 5,
              borderRadius: '50%',
              display: 'block',
              background: n.kind === 'call' ? C.brass : n.kind === 'gap' ? C.wrong : C.inkQuiet,
              boxShadow: n.kind === 'call' ? '0 0 9px 3px rgba(212,184,138,.35)' : undefined,
            }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontFamily: F.label,
                fontSize: 8.5,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: n.kind === 'call' ? C.brass : n.kind === 'gap' ? C.wrong : C.inkQuiet,
              }}
            >
              {KIND_LABEL[n.kind]}
            </span>
            <span
              style={{
                display: 'block',
                paddingTop: 6,
                fontFamily: F.body,
                fontSize: 13.5,
                lineHeight: 1.66,
                color: C.inkBody,
              }}
            >
              {n.text}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};

/** Start any journey at its first screen. Four of them arrive by letter and
 *  have no door inside the app, so this is the only way to walk those. */
const Flows: React.FC<{ onStart: (v: View) => void }> = ({ onStart }) => (
  <div style={{ width: '100%', maxWidth: 860, paddingTop: 34 }}>
    <span
      style={{
        display: 'block',
        fontFamily: F.label,
        fontSize: 9.5,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        color: C.brass,
        paddingBottom: 4,
      }}
    >
      Walk a whole flow
    </span>
    <span style={{ display: 'block', fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet, paddingBottom: 14 }}>
      Each starts at its first screen and every press after that is the real one. Four of them arrive by letter and
      have no door inside the app, so this is the only way to walk those.
    </span>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }}>
      {FLOWS.map(([label, start, note]) => (
        <button
          key={label}
          type="button"
          onClick={() => onStart(start)}
          style={{
            textAlign: 'left',
            border: `1px solid ${C.hairStrong}`,
            borderRadius: 14,
            background: 'rgba(0,0,0,.18)',
            padding: '13px 15px',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'block', fontFamily: F.body, fontSize: 14.5, color: C.ink }}>{label}</span>
          <span
            style={{
              display: 'block',
              paddingTop: 5,
              fontFamily: F.body,
              fontSize: 12,
              lineHeight: 1.55,
              color: C.inkQuiet,
            }}
          >
            {note}
          </span>
        </button>
      ))}
    </div>
  </div>
);

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 0', borderTop: `1px solid ${C.hair}`, flexWrap: 'wrap' }}>
    <span
      style={{
        flex: 'none',
        width: 190,
        fontFamily: F.label,
        fontSize: 9.5,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        color: C.inkQuiet,
      }}
    >
      {label}
    </span>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 200 }}>{children}</div>
  </div>
);

const Btn: React.FC<{
  children: React.ReactNode;
  on?: boolean;
  onClick: () => void;
  /** drawn in the design file, or built from the record with nothing to compare */
  tone?: 'drawn' | 'undrawn';
}> = ({ children, on, onClick, tone }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: `1px solid ${on ? C.brassEdge : tone === 'undrawn' ? 'rgba(196,90,60,.34)' : C.hairStrong}`,
      borderRadius: 999,
      padding: '6px 12px',
      background: 'none',
      fontFamily: F.body,
      fontSize: 12.5,
      color: on ? C.brass : tone === 'undrawn' ? C.wrong : C.inkBody,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

CollectorShell.displayName = 'CollectorShell';

export default CollectorShell;
