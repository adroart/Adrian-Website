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
import { CollectorStyles } from './styles';
import { PiecePage, Relationship } from './PiecePage';
import { CodePage } from './CodePage';
import { Room, RoomKey } from './rooms';
import { StateScreen, StateKey } from './states';
import { LetterScreen, LetterKey } from './letters';
import { WALK, WalkScreen } from './walk';

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
    <div className="collector-root" style={{ background: C.void, color: C.ink, minHeight: '100vh' }}>
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
  onJump: (v: View) => void;
}> = ({ relationship, setRelationship, placed, setPlaced, near, setNear, onJump }) => (
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

    {JUMP.map(([section, items]) => (
      <Group key={section} label={section}>
        {items.map(([label, target]) => (
          <Btn key={label} onClick={() => onJump(target)}>
            {label}
          </Btn>
        ))}
      </Group>
    ))}
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

const Btn: React.FC<{ children: React.ReactNode; on?: boolean; onClick: () => void }> = ({ children, on, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: `1px solid ${on ? C.brassEdge : C.hairStrong}`,
      borderRadius: 999,
      padding: '6px 12px',
      background: 'none',
      fontFamily: F.body,
      fontSize: 12.5,
      color: on ? C.brass : C.inkBody,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

export default CollectorShell;
