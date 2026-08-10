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

import React, { useEffect, useState } from 'react';
import { C, F } from './tokens';
import { MARKS_DEFAULT } from './copy';
import { CollectorStyles } from './styles';
import { PiecePage, Relationship } from './PiecePage';
import { CodePage } from './CodePage';
import { Room, RoomKey } from './rooms';
import { StateScreen, StateKey } from './states';
import { LetterScreen, LetterKey } from './letters';
import { WALK, WalkScreen } from './walk';
import { KIND_LABEL, Note, REVIEW } from './review';

type View =
  | { kind: 'piece' }
  | { kind: 'code' }
  | { kind: 'walk'; key: keyof typeof WALK }
  | { kind: 'room'; key: RoomKey }
  | { kind: 'state'; key: StateKey }
  | { kind: 'letter'; key: LetterKey };

/* ------------------------------------------------------------------ *
 * The jump list, grouped as the interactive spec groups it
 * ------------------------------------------------------------------ */

type Jump = [label: string, go: View];

/**
 * Where each surface came from, so a review can check a screen against its
 * source rather than against a memory.
 *
 * A value is the design file's own card id. `null` means the designer never
 * drew it: those were built from the wording record and the interactive spec,
 * following the shape the drawn screens establish, and they are the ones that
 * most need Adrian's eye, because nothing exists to compare them to.
 */
const SOURCE: Record<string, string | null> = {
  /* the piece page and the code, from section 2a, the winter piece page.
     Its loading foot is 20a and its empty state is 20h. */
  piece: '2a · 20a · 20h',
  code: '2a',
  codetrue: '2a',

  /* drawn */
  sign: '9a',
  born: '9b',
  lives: '9c',
  links: '9d',
  shows: '9e',
  light47: '9f',
  welcome: '9g',
  explain: '9h',
  transfer: '19e',
  passready: '19e',
  passaccept: '19f',

  /* not drawn: built from the record and the spec */
  fork: null,
  gift: null,
  sealed: null,
  receiving: null,
  written: null,
  pull: null,
  grid: null,
  love: null,
  carries: null,
  forgot: null,
  ritual: null,
  ritualfamily: null,
  passfork: null,
  passname: null,
  passsell: null,
  passvalue: null,
  passdone: null,
  invite: null,
  invitesent: null,
  person: null,
  joinletter: null,
  joinhello: null,
  joinwho: null,
  inheritletter: null,
  inheritaccept: null,
  inherit: null,
  inheritread: null,

  /* the rooms, all drawn */
  story: '19a',
  certificate: '19b',
  history: '14f',
  dreams: '19c',
  information: '14a',
  garden: '15g · 15e · 14c',
  family: '14d',
  account: '19g',

  /* the states, all drawn */
  recordonly: '20b',
  held: '20e',
  plate: '20f',
  offline: '20g',
  letter: '14e',
  email: '14g',
};

/* two rooms share a key with a walked screen, so they are looked up by hand */
const ROOM_SOURCE: Record<string, string | null> = { grid: '19h' };
const STATE_SOURCE: Record<string, string | null> = { account: '20c' };

const sourceOf = (v: View): string | null | undefined => {
  if (v.kind === 'room') return ROOM_SOURCE[v.key] ?? SOURCE[v.key];
  if (v.kind === 'state') return STATE_SOURCE[v.key] ?? SOURCE[v.key];
  if (v.kind === 'walk') return SOURCE[v.key];
  return SOURCE[v.kind];
};

/**
 * The journeys, each startable at its first screen.
 *
 * Four of them cannot be entered from inside the app and never will be: the
 * gift's receiving side, the collaborator, the heir, and accepting a passing
 * all arrive by letter, because none of those people had a door until the
 * piece reached them. Starting them here is the only way to walk them.
 */
const FLOWS: [label: string, start: View, note: string][] = [
  [
    'Registering it, all the way',
    { kind: 'piece' },
    'Begin, sixteen ones, the vault, the four, all five gathering screens, and out onto the page as yours.',
  ],
  ['Giving it as a gift', { kind: 'walk', key: 'fork' }, 'The giver seals words into it and the record never moves.'],
  ['Receiving one that was a gift', { kind: 'walk', key: 'sealed' }, 'Arrives right after the vault, before everything else.'],
  ['Passing it to someone you love', { kind: 'walk', key: 'passfork' }, 'It stays inside the house, and the line was set privately.'],
  ['Selling it to a stranger', { kind: 'walk', key: 'passsell' }, 'What travels is stated in one line rather than triaged.'],
  ['Accepting a piece passed to you', { kind: 'walk', key: 'passaccept' }, 'Arrives by letter. Nothing moves without their hand on it.'],
  ['Claiming one someone else holds', { kind: 'walk', key: 'receiving' }, 'Thirty silent days with reminders, and only refusal reaches Adrian.'],
  ['Being asked onto a piece', { kind: 'walk', key: 'joinletter' }, 'Two screens, never five. She is not registering it and not receiving it.'],
  ['Inheriting it', { kind: 'walk', key: 'inheritletter' }, 'The payoff of the three tiers, and the one that needs call 5 settled.'],
  ['The year turning', { kind: 'walk', key: 'ritual' }, 'One occasion, and every person has their own birthday window.'],
  ['Adding to your piece', { kind: 'room', key: 'garden' }, 'The garden: ask, index, write.'],
  ['Signing back in', { kind: 'walk', key: 'welcome' }, 'No code for everyday life. The code sleeps until a passing.'],
];

const JUMP: [string, Jump[]][] = [
  [
    'The door',
    [
      ['Nobody holds it', { kind: 'piece' }],
      ['The code page', { kind: 'code' }],
      ['A true code, no account', { kind: 'state', key: 'account' }],
      ['Already held', { kind: 'state', key: 'held' }],
      ['A reissued plate', { kind: 'state', key: 'plate' }],
      ['The connection dropped', { kind: 'state', key: 'offline' }],
      ['The registry is off', { kind: 'state', key: 'recordonly' }],
    ],
  ],
  [
    'The threshold',
    [
      ['The code is true', { kind: 'walk', key: 'codetrue' }],
      ['For someone else', { kind: 'walk', key: 'fork' }],
      ['Leave your wishes', { kind: 'walk', key: 'gift' }],
      ['Something was left', { kind: 'walk', key: 'sealed' }],
      ['Passing it on', { kind: 'walk', key: 'transfer' }],
      ['A passing begins', { kind: 'walk', key: 'receiving' }],
      ['We have written', { kind: 'walk', key: 'written' }],
    ],
  ],
  [
    'The four',
    [
      ['You felt the pull', { kind: 'walk', key: 'pull' }],
      ['The resonant grid', { kind: 'walk', key: 'grid' }],
      ['When you focus your love', { kind: 'walk', key: 'love' }],
      ['It carries on', { kind: 'walk', key: 'carries' }],
    ],
  ],
  [
    'The gathering',
    [
      ['Sign its record', { kind: 'walk', key: 'sign' }],
      ['Who you are', { kind: 'walk', key: 'born' }],
      ['Where it lives', { kind: 'walk', key: 'lives' }],
      ['Your links', { kind: 'walk', key: 'links' }],
      ['What shows', { kind: 'walk', key: 'shows' }],
      ['What this is for', { kind: 'walk', key: 'explain' }],
      ['You are Light 47', { kind: 'walk', key: 'light47' }],
    ],
  ],
  [
    'Inside the page',
    [
      ['The story', { kind: 'room', key: 'story' }],
      ['The certificate', { kind: 'room', key: 'certificate' }],
      ['The history', { kind: 'room', key: 'history' }],
      ['The dreams', { kind: 'room', key: 'dreams' }],
      ['Piece information', { kind: 'room', key: 'information' }],
      ['Add to your piece', { kind: 'room', key: 'garden' }],
      ['The people you love', { kind: 'room', key: 'family' }],
      ['Your account', { kind: 'room', key: 'account' }],
      ['The Resonant Grid', { kind: 'room', key: 'grid' }],
    ],
  ],
  [
    'The year turns',
    [
      ['The year turns', { kind: 'walk', key: 'ritual' }],
      ['Each at their own birthday', { kind: 'walk', key: 'ritualfamily' }],
      ['A letter from the piece', { kind: 'letter', key: 'letter' }],
      ['Someone placed something', { kind: 'letter', key: 'email' }],
    ],
  ],
  [
    'The passing',
    [
      ['Two exits', { kind: 'walk', key: 'passfork' }],
      ['It stays in the house', { kind: 'walk', key: 'passname' }],
      ['What travels', { kind: 'walk', key: 'passsell' }],
      ['What it was worth', { kind: 'walk', key: 'passvalue' }],
      ['Let it go', { kind: 'walk', key: 'passready' }],
      ['It is waiting', { kind: 'walk', key: 'passdone' }],
      ['Accepting it', { kind: 'walk', key: 'passaccept' }],
    ],
  ],
  [
    'Asking someone on',
    [
      ['Ask them onto the piece', { kind: 'walk', key: 'invite' }],
      ['The letter is sent', { kind: 'walk', key: 'invitesent' }],
      ['One person', { kind: 'walk', key: 'person' }],
    ],
  ],
  [
    'Arriving by letter',
    [
      ['A piece has asked for you', { kind: 'walk', key: 'joinletter' }],
      ['A collaborator arrives', { kind: 'walk', key: 'joinhello' }],
      ['Who you are (theirs)', { kind: 'walk', key: 'joinwho' }],
      ['It has come to you', { kind: 'walk', key: 'inheritletter' }],
      ['It is yours to carry', { kind: 'walk', key: 'inheritaccept' }],
      ['What he kept', { kind: 'walk', key: 'inherit' }],
      ['In his own words', { kind: 'walk', key: 'inheritread' }],
    ],
  ],
  [
    'Signing in',
    [
      ['Welcome back', { kind: 'walk', key: 'welcome' }],
      ['A way back in', { kind: 'walk', key: 'forgot' }],
    ],
  ],
];

/* ------------------------------------------------------------------ */

const CollectorShell: React.FC = () => {
  const [view, setView] = useState<View>({ kind: 'piece' });
  const [relationship, setRelationship] = useState<Relationship>('unclaimed');
  const [placed, setPlaced] = useState(7);
  const [near, setNear] = useState(1);
  const [marks, setMarks] = useState(MARKS_DEFAULT);

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

  const go = (key: string) => {
    if (key === '__home') {
      setRelationship('yours');
      setView({ kind: 'piece' });
      return;
    }
    if (key === '__garden') {
      setRelationship('yours');
      setView({ kind: 'room', key: 'garden' });
      return;
    }
    if (key === '__code') {
      setView({ kind: 'code' });
      return;
    }
    if (key in WALK) setView({ kind: 'walk', key: key as keyof typeof WALK });
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
          onBegin={() => setView({ kind: 'code' })}
          onSignIn={() => setView({ kind: 'walk', key: 'welcome' })}
          onWalk={go}
        />
      )}
      {view.kind === 'code' && (
        <CodePage
          onTrue={() => setView({ kind: 'walk', key: 'codetrue' })}
          onNoCode={() => setView({ kind: 'state', key: 'account' })}
          onGift={() => setView({ kind: 'walk', key: 'gift' })}
          onBack={() => setView({ kind: 'piece' })}
        />
      )}
      {view.kind === 'walk' && <WalkScreen screen={WALK[view.key]} onGo={go} />}
      {view.kind === 'room' && (
        <Room room={view.key} onClose={() => setView({ kind: 'piece' })} onWalk={go} />
      )}
      {view.kind === 'state' && (
        <StateScreen state={view.key} onBack={() => setView({ kind: 'piece' })} />
      )}
      {view.kind === 'letter' && (
        <LetterScreen letter={view.key} onBack={() => setView({ kind: 'piece' })} />
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

      {/* the phone, at 390 by 844. On a phone it is the viewport itself; on a
          desktop it is a frame, because this surface is drawn for a phone and
          reviewing it at 1440 wide would flatter it dishonestly. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px 64px' }}>
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
          {screen}
        </div>

        <p
          className="collector-caption"
          style={{
            margin: '16px 0 0',
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

        <Flows onStart={next => { if (next.kind === 'room') setRelationship('yours'); if (next.kind === 'piece') setRelationship('unclaimed'); setView(next); }} />

        <Controls
          relationship={relationship}
          setRelationship={r => {
            setRelationship(r);
            setView({ kind: 'piece' });
          }}
          placed={placed}
          setPlaced={setPlaced}
          near={near}
          setNear={setNear}
          marks={marks}
          setMarks={setMarks}
          onJump={next => {
            if (next.kind === 'room') setRelationship('yours');
            setView(next);
          }}
        />
      </div>
    </div>
  );
};

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

export default CollectorShell;
