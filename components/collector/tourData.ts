/**
 * Pure tour data for the collector shell: the view union, the flows, the jump
 * list, and the source crosswalk. No storage, no network, no React state —
 * just the shape of the journey, so a host page can walk it without pulling
 * in the shell's own harness scaffolding.
 */

import { RoomKey } from './rooms';
import { StateKey } from './states';
import { LetterKey } from './letters';
import { WALK, WalkScreen } from './walk';

export type View =
  | { kind: 'piece' }
  | { kind: 'code' }
  | { kind: 'walk'; key: keyof typeof WALK }
  | { kind: 'room'; key: RoomKey }
  | { kind: 'state'; key: StateKey }
  | { kind: 'letter'; key: LetterKey };

/* ------------------------------------------------------------------ *
 * The jump list, grouped as the interactive spec groups it
 * ------------------------------------------------------------------ */

export type Jump = [label: string, go: View];

/**
 * Where each surface came from, so a review can check a screen against its
 * source rather than against a memory.
 *
 * A value is the design file's own card id. `null` means the designer never
 * drew it: those were built from the wording record and the interactive spec,
 * following the shape the drawn screens establish, and they are the ones that
 * most need Adrian's eye, because nothing exists to compare them to.
 */
export const SOURCE: Record<string, string | null> = {
  /* the piece page and the code, from section 2a, the winter piece page.
     Its loading foot is 20a and its empty state is 20h. */
  piece: '2a · 20a · 20h',
  code: '2a',
  codetrue: '2a',

  /* drawn */
  sign: '9a',
  lives: '9c',
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
  /* who you are, and your links: §7 2026-08-20's re-ordered gathering,
     split back into two one-line-headed screens by the artist's second
     walk (2026-08-20). Built fresh from the walkthrough rulings; no card
     exists to compare either to. */
  who1: null,
  who2: null,
  /* the passing's readback, added by the artist's second walk: no card
     exists to compare it to either. */
  passconfirm: null,
  ritual: null,
  ritualplant: null,
  ritualfamily: null,
  passfork: null,
  passname: null,
  passsell: null,
  passvalue: null,
  passdone: null,
  invite: null,
  invitesent: null,
  person: null,
  personSuccession: null,
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
  /* not drawn: the read-only listing of what the piece has written. Reached
     from the account room — letters is not one of §6's six caretaker rows. */
  letters: null,

  /* the states, all drawn */
  recordonly: '20b',
  held: '20e',
  plate: '20f',
  offline: '20g',
  /* not drawn: the honest door while the passing is unwired (D4). Built from
     the shape the drawn states establish; the copy is placeholder. */
  notyet: null,
  letter: '14e',
  email: '14g',
};

/* two rooms share a key with a walked screen, so they are looked up by hand */
export const ROOM_SOURCE: Record<string, string | null> = { grid: '19h' };
export const STATE_SOURCE: Record<string, string | null> = { account: '20c' };

export const sourceOf = (v: View): string | null | undefined => {
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
export const FLOWS: [label: string, start: View, note: string][] = [
  [
    'Registering it, all the way',
    { kind: 'piece' },
    'Begin, sixteen ones, the vault, the four, all four gathering screens (sign, where it lives, who you are, and your links), and out onto the page as yours.',
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

export const JUMP: [string, Jump[]][] = [
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
      /* the real chain, the artist's second walk (2026-08-20):
         sign → lives → who1 → who2 → light47 */
      ['Sign its record', { kind: 'walk', key: 'sign' }],
      ['Where it lives', { kind: 'walk', key: 'lives' }],
      ['Who you are', { kind: 'walk', key: 'who1' }],
      ['Your links', { kind: 'walk', key: 'who2' }],
      ['You are Light 47', { kind: 'walk', key: 'light47' }],
      /* leftover chapter: still defined, no longer on the required path */
      ['What shows', { kind: 'walk', key: 'shows' }],
      ['What this is for', { kind: 'walk', key: 'explain' }],
    ],
  ],
  [
    'Inside the page',
    [
      ['The story', { kind: 'room', key: 'story' }],
      ['The history', { kind: 'room', key: 'history' }],
      ['The dreams', { kind: 'room', key: 'dreams' }],
      ['Piece information', { kind: 'room', key: 'information' }],
      ['Add to your piece', { kind: 'room', key: 'garden' }],
      ['The people you love', { kind: 'room', key: 'family' }],
      ['Your account', { kind: 'room', key: 'account' }],
      ['Letters', { kind: 'room', key: 'letters' }],
      ['The Resonant Grid', { kind: 'room', key: 'grid' }],
    ],
  ],
  [
    'The year turns',
    [
      ['The year turns', { kind: 'walk', key: 'ritual' }],
      ['Plant a new dream', { kind: 'walk', key: 'ritualplant' }],
      ['Each at their own birthday', { kind: 'walk', key: 'ritualfamily' }],
      ['A letter from the piece', { kind: 'letter', key: 'letter' }],
      ['Someone placed something', { kind: 'letter', key: 'email' }],
    ],
  ],
  [
    'The passing',
    [
      ['Not open yet (the wired door)', { kind: 'state', key: 'notyet' }],
      ['Two exits', { kind: 'walk', key: 'passfork' }],
      ['It stays in the house', { kind: 'walk', key: 'passname' }],
      ['What travels', { kind: 'walk', key: 'passsell' }],
      ['What it was worth', { kind: 'walk', key: 'passvalue' }],
      ['Let it go', { kind: 'walk', key: 'passready' }],
      ['To this hand, and no other', { kind: 'walk', key: 'passconfirm' }],
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
      ['Where she stands', { kind: 'walk', key: 'personSuccession' }],
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

/* re-exported for consumer convenience, so a host of the tour need only
   import from './tourData' rather than reaching into './walk' as well */
export { WALK, WalkScreen };
