/**
 * The walked screens: everything that is not the piece page or a room.
 *
 * The threshold, the four, the gathering, the year turning, the passing, the
 * invitation, the arrival by letter, and signing back in. Each is a spec rather
 * than a component, because they share one shape and differ only in what they
 * carry: one drawing in the upper third, a short headline, brief body, one
 * brass act in the lower third, skips as plain text links.
 *
 * The laws these keep:
 *   No setup screen ever scrolls. If a screen would scroll, it splits.
 *   One breath, one idea, one tap.
 *   Brass appears once per screen, on the only thing you can act on.
 *   Nothing is asked on any of the four: pure receiving.
 *   No skip link on the four. Tap anywhere advances.
 */

import React, { useState } from 'react';
import { C, F, VIGNETTE } from './tokens';
import { COPY, PLACEHOLDERS } from './copy';
import { Motif } from './drawings';
import { Area, Body, Brass, ChoiceRow, Eyebrow, Field, Flag, Ground, Head, Lamp, Note, Plus, TLink } from './ui';
import { Drawing } from './drawings';
import { Star } from './Orbit';
import { INHERIT_WRITINGS, InheritReading, SHINING_STATUS } from './inheritRead';

/**
 * Where a press goes. A plain string rather than a union of the registry's own
 * keys, because the registry is typed against this shape and a union of its
 * keys would reference itself. Three targets are not screens:
 *   __home   the piece page, as yours
 *   __garden Add to your piece
 *   __family The people you love
 *   __code   the code page
 */
export type Target = string;

export type Screen = {
  head: string;
  body?: string;
  body2?: string;
  art?: Motif;
  eyebrow?: string;
  note?: string;
  /**
   * A quiet line rendered BEFORE the fields: a rule that must be read before
   * writing, not after. The ritual carries its "placing it is the choosing"
   * line here, so nobody types the year's words and only then learns they
   * will show.
   */
  preNote?: string;
  /** rows of lit fields; an inner array is one row */
  fields?: [string, string?][];
  hints?: Record<string, string>;
  /**
   * Per-field HTML input meta, keyed by the field's label: its `type`
   * (defaults to a plain text field) and `autoComplete` hint. Additive on
   * `Field` (components/ceremony/ui.tsx) — every existing screen renders
   * exactly as before.
   */
  fieldMeta?: Record<string, { type?: string; autoComplete?: string }>;
  /** a hairline-divided list of choices, never buttons */
  rows?: [string, string, Target][];
  /** the What shows lamps */
  lamps?: boolean;
  /** the add-a-link tile */
  tiles?: boolean;
  /**
   * The gathering's split final pages, per the artist's second walk
   * (2026-08-20): who you are (birth fields, the five identity lamps) and
   * your links (site, tiles, the map-light lamp), now two screens rather
   * than one page holding both behind a SegmentedTabs. `1` renders the
   * first half, `2` the second. Renders its own bespoke content rather than
   * composing from `fields`/`lamps`/`tiles`, because no other screen shares
   * its shape.
   */
  who?: 1 | 2;
  /** a writing field: [the value's key in `values`, the placeholder hint] */
  area?: [key: string, hint?: string];
  /** the passing's readback: the typed value of this field, shown large and centred */
  readback?: string;
  /** the passing's reorderable line of succession (passname) */
  reorder?: boolean;
  /** the heir's readable writings (inheritread): rows open a reading view in
      place rather than navigating away */
  inheritReadings?: boolean;
  /** the one brass act */
  pill?: string;
  to?: Target;
  /** the quiet way out */
  link?: string;
  linkTo?: Target;
  /**
   * A quiet question line, its own row directly above the foot, rather than
   * sharing the foot with the brass (the un-stacked fork door on `codetrue`).
   */
  foreLink?: string;
  foreLinkTo?: Target;
  /**
   * A quiet back link, top right, the one navigation the shared design rules
   * allow: "no navigation beyond a quiet back link."
   *
   * It goes on a screen for exactly two reasons and no others:
   *   a person can be wrong about something they just typed, or
   *   the screen would otherwise trap them with no way out at all.
   *
   * It is deliberately absent from the four, where nothing is asked and there
   * is nothing to correct; from the threshold, because crossing it is the
   * point; from ignition; and from every terminal screen that already says
   * Return to the piece.
   */
  back?: Target;
  /** the italic door into the explainer */
  why?: string;
  /** tap anywhere advances, and there is no skip link */
  tap?: boolean;
  /** a sheet lifted over the page, rather than a page */
  sheet?: boolean;
  /** the ignition star */
  ignite?: boolean;
  /** this screen is one registration cannot proceed without */
  required?: boolean;
  /**
   * Suppresses the generic "not registered until this is placed" note on a
   * `required` screen whose own `note` already carries that point (sign's
   * signNote does). Without it a required screen with its own note stacks
   * two grey lines that say the same thing.
   */
  noRequiredNote?: boolean;
  /** a second quiet note, stacked under the first: used where a locked note
      and a new functional caveat both need saying, without merging into
      one string */
  note2?: string;
  /**
   * the quiet way out sits UNDER the brass, left aligned, rather than beside
   * it. Used where the link is a whole sentence and would wrap to three lines
   * in a side-by-side foot.
   */
  stack?: boolean;
  /** which vignette the design drew it with */
  light?: keyof typeof VIGNETTE;
  /** what this screen is, for the shell's caption strip */
  caption: string;
};

const G = COPY.gathering;

/**
 * Strings no copy.ts key exists for yet. copy.ts is frozen this pass, so they
 * live here, registered as placeholders so none can reach Adrian disguised as
 * finished copy (the states.tsx / garden.tsx idiom). T3-COPY: hoist into
 * copy.ts and have Adrian settle them.
 */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

/* What shows, split per the real privacy fields (functions/api/collector/
 * privacy.js): shareIntention, shareCity, shareName, shareFace,
 * shareDerivedChart, shareBusiness, shareMission. Name and face are separate
 * lamps because they are separate consents on the wire; the locked combined
 * line ("Your name and face") stays in copy.ts untouched for Adrian to
 * resettle. There is NO links lamp — no privacy field exists for links. */
const LAMP_NAME = ph('Your name');
const LAMP_NAME_NOTE = ph('Off until you tick it. Your face is its own tick.');
const LAMP_FACE = ph('Your face');
const LAMP_FACE_NOTE = ph('Off until you tick it, and separate from your name.');
const LAMP_CHART = ph('Your chart');
const LAMP_CHART_NOTE = ph(
  'What your birth details produce, never the details themselves. Off until you tick it.',
);
const LAMP_WORK = ph('Your work');
const LAMP_WORK_NOTE = ph('Your business, for the people your piece moves. Off until you tick it.');
const LAMP_MISSION = ph('Your mission');
const LAMP_MISSION_NOTE = ph('Off until you tick it.');

/**
 * The What shows lamps, in wire order. Index N here is index N of the lamps
 * boolean array everywhere (walk state, wired.tsx's submitShows mapping):
 *   0 shareIntention · 1 shareCity · 2 shareName · 3 shareFace ·
 *   4 shareDerivedChart · 5 shareBusiness · 6 shareMission
 * The birth-details row is not in this list: it is fixed, never a lamp.
 */
export const SHOW_LAMPS: [title: string, note: string][] = [
  [G.showPlaced, G.showPlacedNote],
  [G.showLight, G.showLightNote],
  [LAMP_NAME, LAMP_NAME_NOTE],
  [LAMP_FACE, LAMP_FACE_NOTE],
  [LAMP_CHART, LAMP_CHART_NOTE],
  [LAMP_WORK, LAMP_WORK_NOTE],
  [LAMP_MISSION, LAMP_MISSION_NOTE],
];

/** the drawn defaults: the piece shines, the person opts in */
export const SHOW_LAMPS_DEFAULT: boolean[] = [true, true, false, false, false, false, false];

/**
 * The five identity lamps, indices 2..6 of SHOW_LAMPS in wire order, for the
 * who page (§7, 2026-08-20). The two piece-fact lamps at indices 0 and 1
 * (shareIntention, shareCity) disappear as choices there: the piece's own
 * facts are not optional, and default true always.
 */
export const WHO_LAMPS: [title: string, note: string][] = SHOW_LAMPS.slice(2);

/** the succession sub-screen's own line: no data model behind it yet */
const SUCCESSION_SOON = ph('Where they stand in the line will be kept privately here soon.');

/* codetrue, the artist's second walk: "It should be a question — if this
   piece is for someone else click here to leave your message — and the
   continue should be on the right side." The fork door becomes its own
   quiet question line above the foot, rather than sharing it with brass. */
const CODETRUE_FORK_LINE = ph('Is this piece for someone else? Leave your message with it.');

/* gift, the artist's second walk: the screen said "write what you wish" but
   had no field to write in. workbook: his own phrasing for head/body gets
   settled there; the hint below is a plain functional placeholder. */
const GIFT_HEAD = ph('Inscribe your message'); // workbook
const GIFT_BODY = ph(
  'What you write here is permanently inscribed into the history of the artwork, and greets them the day they make it theirs.',
); // workbook
const GIFT_FIELD_KEY = 'gift message';
const GIFT_FIELD_HINT = ph('Write what you wish for them');

/* the who pages: built fresh for §7, "the gathering, re-ordered"
   (2026-08-20), then split back into two screens per the artist's second
   walk ("lets change it back to city ... this should be 2 pages and title
   only 1 line not 2"). who1's head/body reuse born's locked copy verbatim
   (bornHead/bornBody are exactly "Who you are" and its one-line body) and
   who2's reuse links' (linksHead/linksBody are exactly "Your links" and
   its body) rather than re-registering the same words as fresh
   placeholders — the same locked strings, now carried by two screens
   instead of one. */
/* the birthday privacy line, beneath the birth fields */
const WHO_BIRTHDAY_NOTE = ph(
  'Private, always. Never shown, never sold. It quietly feeds the Oracle and the Dream.',
);
/* the links section's map-light toggle: an honest unwired placeholder. No
   shareLinks field exists on the wire, so the choice stores client-side only
   until one does. */
const WHO_LINKS_SHOW_LABEL = ph('Show on the map');
const WHO_LINKS_SHOW_NOTE = ph('Not connected yet. It will hold your choice here soon.');

/* sign, the artist's second walk: "You should have to repeat your
   password." Its own row under the password, not beside it. */
const SIGN_REPEAT_PASSWORD = ph('Repeat the password');

/* joinwho, the artist's second walk: "you need the exact birth date, time
   and location. Maybe sometimes they're not accessible. That's okay, but
   this is where you collect it." workbook: the exact phrasing is his to
   settle; the shape (leave it empty, it is still enough) is what he asked
   for. */
const JOINWHO_FLEX_NOTE = ph(
  'If the time or place is out of reach, leave it. What you give is enough to begin.',
); // workbook

/* passname, the artist's second walk: "These are drag and droppable. And you
   can order who has control." The reordering itself needs no locked words;
   these two are the only new copy, deliberately plain words rather than
   chevrons. */
const PASS_UP = ph('Up');
const PASS_DOWN = ph('Down');

type PassRow = { name: string; relation: string };
/* the demo's own sample line, unflagged like the rest of the demo names
   ("Sara" / "Ines" / "Tomas") used elsewhere on this walk */
const PASSNAME_PEOPLE: PassRow[] = [
  { name: 'Sara', relation: 'wife' },
  { name: 'Ines', relation: 'daughter' },
  { name: 'Tomas', relation: 'brother' },
];
const passOrderLabel = (position: number): string =>
  position === 0 ? 'first in line' : position === 1 ? 'second' : 'not in line';

/* passready → passconfirm, the artist's second walk: "What if the wrong
   email is typed and someone else gets to hold it forever?" A readback
   screen between the typed address and the send. */
const PASSCONFIRM_HEAD = ph('To this hand, and no other');
const PASSCONFIRM_BODY = ph(
  'Check every letter. The passing waits for them to accept it, and until they do nothing has moved and you can stop it.',
); // workbook
const PASSCONFIRM_SEND = ph('Send the passing');
const PASSCONFIRM_CHANGE = ph('Change the address');

export const WALK = {
  /* ── the threshold ───────────────────────────────────────────── */

  codetrue: {
    head: COPY.threshold.trueHead,
    body: COPY.threshold.trueBody,
    art: 'piece',
    pill: COPY.threshold.trueContinue,
    to: 'pull',
    foreLink: CODETRUE_FORK_LINE,
    foreLinkTo: 'fork',
    light: 'c',
    caption: 'Code confirmed · first caretaker · a question above the foot, Continue at right',
  },

  fork: {
    head: COPY.threshold.forkHead,
    rows: [
      [COPY.threshold.forkGift, COPY.threshold.forkGiftNote, 'gift'],
      [COPY.threshold.forkPass, COPY.threshold.forkPassNote, 'transfer'],
    ],
    back: 'codetrue',
    light: 'e',
    caption: 'The fork · two intentions, separated',
  },

  gift: {
    head: GIFT_HEAD, // workbook
    body: GIFT_BODY, // workbook
    art: 'letter',
    area: [GIFT_FIELD_KEY, GIFT_FIELD_HINT],
    back: 'fork',
    pill: COPY.threshold.giftSeal,
    to: 'sealed',
    light: 'k',
    caption: 'The gift · giver’s side · warm · now with a place to write',
  },

  sealed: {
    head: COPY.threshold.sealedHead,
    body: COPY.threshold.sealedBody,
    art: 'letter',
    pill: COPY.threshold.sealedOpen,
    to: 'pull',
    light: 'l',
    caption: 'The gift · receiver’s side, right after the vault',
  },

  transfer: {
    head: COPY.threshold.transferHead,
    body: COPY.threshold.transferBody,
    art: 'hands',
    pill: COPY.threshold.transferBegin,
    to: 'written',
    link: COPY.threshold.transferNot,
    linkTo: 'codetrue',
    light: 'f',
    caption: 'The transfer · grave, never softened',
  },

  receiving: {
    head: COPY.threshold.receivingHead,
    body: COPY.threshold.receivingBody,
    art: 'piece',
    pill: COPY.threshold.trueContinue,
    to: 'written',
    light: 'e',
    caption: 'The receiving side · patient, never grasping',
  },

  written: {
    head: COPY.threshold.writtenHead,
    body: COPY.threshold.writtenBody,
    art: 'letter',
    link: COPY.threshold.writtenReturn,
    linkTo: '__home',
    light: 'g',
    caption: 'The passing, resolved · thirty days live here',
  },

  /* ── the four ────────────────────────────────────────────────── *
   * Fifteen words a screen defeats skimming: the glance is the read.
   * Nothing is asked on any of them. No skip link; tap anywhere. */

  pull: {
    head: COPY.four.pullHead,
    body: COPY.four.pullBody,
    art: 'piece',
    tap: true,
    to: 'grid',
    light: 'a',
    caption: 'One of four · the drawing draws itself',
  },

  grid: {
    head: COPY.four.gridHead,
    body: COPY.four.gridBody,
    art: 'globe',
    tap: true,
    to: 'love',
    light: 'b',
    caption: 'Two of four · lights come on one by one',
  },

  love: {
    head: COPY.four.loveHead,
    body: COPY.four.loveBody,
    art: 'piece',
    tap: true,
    to: 'carries',
    light: 'l',
    caption: 'Three of four · the glow swells once',
  },

  carries: {
    head: COPY.four.carriesHead,
    body: COPY.four.carriesBody,
    body2: COPY.four.carriesBody2,
    art: 'none',
    pill: COPY.four.carriesBegin,
    to: 'sign',
    light: 'i',
    caption: 'Four of four · the only screen with no drawing',
  },

  /* ── the gathering ───────────────────────────────────────────── *
   * Registration is binary: incomplete means not registered. There is
   * no half-registered state, so no resumable wizard and no progress. */

  sign: {
    head: G.signHead,
    body: G.signBody,
    eyebrow: G.eyebrow,
    fields: [[G.fieldFirst, G.fieldLast], [G.fieldEmail], [G.fieldPassword], [SIGN_REPEAT_PASSWORD]],
    hints: { [G.fieldEmail]: G.hintEmail, [G.fieldPassword]: G.hintPassword },
    fieldMeta: {
      [G.fieldEmail]: { type: 'email', autoComplete: 'email' },
      [G.fieldPassword]: { type: 'password', autoComplete: 'new-password' },
      [SIGN_REPEAT_PASSWORD]: { type: 'password', autoComplete: 'new-password' },
    },
    note: G.signNote,
    /* the artist's second walk: two grey notes were stacking on this screen
       (signNote, then the generic required note). signNote already says
       what needs saying here, so the generic one is suppressed rather than
       doubled underneath it. */
    noRequiredNote: true,
    pill: G.signPill,
    to: 'lives',
    required: true,
    light: 'o',
    caption: 'Required · one account across everything, repeat password, one grey note not two',
  },

  lives: {
    head: G.livesHead,
    body: G.livesBody,
    eyebrow: G.eyebrow,
    fields: [[G.fieldCity]],
    hints: { [G.fieldCity]: G.hintCity },
    /* §7, 2026-08-20: sign its record is auto-satisfied by the verified
       session the bind required, so this is now the first reachable
       gathering screen. wired.tsx suppresses this back at runtime exactly
       as it did for born before the reorder; the demo shell still shows it,
       correcting into sign, the true previous step. */
    back: 'sign',
    note: G.livesNote,
    /* the artist's second walk: "lets change it back to city, I dont need
       area this is too cautious" — the grain chips (City / Area) are gone;
       city is the only grain, always. */
    pill: G.continue,
    to: 'who1',
    required: true,
    light: 'q',
    caption: 'Required · a light must live somewhere · city only, no grain chips',
  },

  shows: {
    head: G.showsHead,
    body: G.showsBody,
    /* leftover chapter, no longer on the required path (§7, 2026-08-20);
       its back correction lived on `links`, which no longer exists — it now
       corrects straight to `who2`, the screen that carries the same links */
    back: 'who2',
    eyebrow: G.eyebrow,
    lamps: true,
    pill: G.showsPill,
    to: 'light47',
    required: true,
    light: 'b',
    caption: 'Required · nothing shines until this is answered',
  },

  explain: {
    head: G.explainHead,
    body: G.explainBody,
    sheet: true,
    pill: G.explainAdd,
    /* the artist's second walk splits the gathering's final page back into
       two screens; both doors of the sheet lead back to who1, the screen
       that still asks for the birthday this sheet explains */
    to: 'who1',
    link: G.explainSkip,
    linkTo: 'who1',
    light: 'k',
    caption: 'The explainer · one sheet, two doors',
  },

  /* who splits back into two pages, the artist's second walk: "this should
     be 2 pages and title only 1 line not 2." who1 carries born's old
     content (birth fields, the why door, the five identity lamps); who2
     carries links' old content (the site field, the tiles, the map-light
     lamp). The chain: sign → lives → who1 → who2 → light47. required stays
     true on both because the pair sits in the required path; the personal
     fields inside them stay optional (skippable by simply staying empty —
     no skip link, no gate). */
  who1: {
    head: G.bornHead,
    body: G.bornBody,
    eyebrow: G.eyebrow,
    who: 1,
    back: 'lives',
    pill: G.continue,
    to: 'who2',
    required: true,
    light: 'p',
    caption: 'Required · who you are, one line head, first of two',
  },

  who2: {
    head: G.linksHead,
    body: G.linksBody,
    eyebrow: G.eyebrow,
    who: 2,
    back: 'who1',
    pill: G.continue,
    to: 'light47',
    required: true,
    light: 'a',
    caption: 'Required · your links, one line head, second of two',
  },

  /* ── ignition ────────────────────────────────────────────────── */

  light47: {
    head: COPY.ignition.head,
    body: COPY.ignition.body,
    ignite: true,
    pill: COPY.ignition.pill,
    to: '__home',
    light: 'i',
    caption: 'Ignition · the light comes on for the first time',
  },

  /* ── the year turns ──────────────────────────────────────────── */

  /* the three choices, never a blank form (§5 "The yearly ritual"): a
     hairline-divided list. Reinforce and fulfilled are one press; only
     planting anew opens a field, on its own screen. */
  ritual: {
    head: COPY.ritual.head,
    body: COPY.ritual.body,
    art: 'piece',
    rows: [
      [COPY.ritual.reinforce, '', 'ritualfamily'],
      [COPY.ritual.plantNew, '', 'ritualplant'],
      [COPY.ritual.markFulfilled, '', 'ritualfamily'],
    ],
    link: COPY.ritual.notThisYear,
    linkTo: '__home',
    light: 'a',
    caption: 'The year turns · three ways to answer, none required',
  },

  ritualplant: {
    head: COPY.ritual.plantNew,
    art: 'piece',
    preNote: COPY.ritual.note,
    fields: [[COPY.ritual.field]],
    back: 'ritual',
    pill: COPY.garden.place,
    to: 'ritualfamily',
    light: 'a',
    caption: 'The year turns · the new dream, and placing it is the choosing',
  },

  ritualfamily: {
    head: COPY.ritual.familyHead,
    body: COPY.ritual.familyBody,
    rows: [
      ['Sara · waiting for you', '“That it keeps holding the quiet in this house.”', '__home'],
      ['Ines · waiting for you', '“I hope it is still here when I am big.” · shown without her name', '__home'],
      ['Tomas · asked in March', 'his window has not come round yet', '__home'],
    ],
    back: 'ritual',
    note: COPY.ritual.familyNote,
    link: COPY.threshold.writtenReturn,
    linkTo: '__home',
    light: 'l',
    caption: 'The year turns · each person at their own birthday',
  },

  /* ── the passing ─────────────────────────────────────────────── *
   * Two exits that look alike and are not: naming someone is private
   * and can be undone, selling is neither. */

  passfork: {
    head: COPY.passing.forkHead,
    body: COPY.passing.forkBody,
    rows: [
      [COPY.passing.forkLove, COPY.passing.forkLoveNote, 'passname'],
      [COPY.passing.forkSell, COPY.passing.forkSellNote, 'passsell'],
    ],
    link: COPY.threshold.transferNot,
    linkTo: '__home',
    light: 'f',
    caption: 'The passing · two exits, one is undoable',
  },

  passname: {
    head: COPY.passing.nameHead,
    body: COPY.passing.nameBody,
    art: 'hands',
    /* the artist's second walk: "These are drag and droppable. And you can
       order who has control." Real reordering, not a static line: rows drag
       and reorder, and the always-visible Up / Down words are the
       accessible path. A single Continue replaces the old row-tap
       navigation. */
    reorder: true,
    back: 'passfork',
    note: COPY.passing.nameNote,
    pill: G.continue,
    to: 'passready',
    light: 'l',
    caption: 'Passing it on · the line you already set, drag or Up / Down to reorder',
  },

  passsell: {
    head: COPY.passing.sellHead,
    body: COPY.passing.sellBody,
    back: 'passfork',
    note: COPY.passing.sellNote,
    pill: G.continue,
    to: 'passvalue',
    link: COPY.passing.sellBack,
    linkTo: '__garden',
    light: 'k',
    caption: 'The passing · one line, never a triage',
  },

  passvalue: {
    head: COPY.passing.valueHead,
    body: COPY.passing.valueBody,
    fields: [[COPY.passing.valueField]],
    rows: [
      [COPY.passing.valuePaid, COPY.passing.valuePaidNote, 'passready'],
      [COPY.passing.valuePart, COPY.passing.valuePartNote, 'passready'],
      [COPY.passing.valueTrade, COPY.passing.valueTradeNote, 'passready'],
      [COPY.passing.valueGiven, COPY.passing.valueGivenNote, 'passready'],
    ],
    back: 'passsell',
    note: COPY.passing.valueNote,
    light: 'm',
    caption: 'The ledger · the chain is public, the sums are not',
  },

  passready: {
    head: COPY.passing.readyHead,
    body: COPY.passing.readyBody,
    fields: [[COPY.passing.readyField]],
    fieldMeta: { [COPY.passing.readyField]: { type: 'email', autoComplete: 'email' } },
    note: COPY.passing.readyNote,
    pill: COPY.threshold.transferBegin,
    /* the artist's second walk: "What if the wrong email is typed and
       someone else gets to hold it forever?" Begin the passing now opens a
       readback rather than sending straight away. */
    to: 'passconfirm',
    link: COPY.threshold.transferNot,
    linkTo: '__home',
    light: 'f',
    caption: 'The passing · grave, and it does not soften · email field, typed address read back next',
  },

  passconfirm: {
    head: PASSCONFIRM_HEAD,
    readback: COPY.passing.readyField,
    body: PASSCONFIRM_BODY, // workbook
    pill: PASSCONFIRM_SEND,
    to: 'passdone',
    link: PASSCONFIRM_CHANGE,
    linkTo: 'passready',
    light: 'f',
    caption: 'The passing · the readback before it is sent, large and centred',
  },

  passdone: {
    head: COPY.passing.doneHead,
    body: COPY.passing.doneBody,
    art: 'letter',
    link: COPY.threshold.writtenReturn,
    linkTo: '__home',
    light: 'g',
    caption: 'The passing · nothing has moved yet',
  },

  passaccept: {
    head: COPY.passing.acceptHead,
    body: COPY.passing.acceptBody,
    note: COPY.passing.acceptNote,
    pill: COPY.passing.acceptPill,
    to: '__home',
    link: COPY.passing.acceptNot,
    linkTo: '__home',
    light: 'l',
    caption: 'The passing · what the next caretaker sees',
  },

  /* ── asking someone on ───────────────────────────────────────── */

  invite: {
    head: COPY.people.inviteHead,
    body: COPY.people.inviteBody,
    fields: [[COPY.people.inviteName], [COPY.people.inviteRelation], [COPY.people.inviteEmail]],
    note: COPY.people.inviteNote,
    pill: COPY.people.inviteSend,
    to: 'invitesent',
    link: COPY.threshold.transferNot,
    linkTo: '__home',
    light: 'l',
    caption: 'The invitation · the caretaker’s side',
  },

  invitesent: {
    head: COPY.people.sentHead,
    body: COPY.people.sentBody,
    art: 'letter',
    link: COPY.threshold.writtenReturn,
    linkTo: '__home',
    light: 'g',
    caption: 'The invitation · nothing until they answer',
  },

  person: {
    head: 'Sara',
    body: COPY.people.personBody,
    rows: [
      [COPY.people.personApprove, COPY.people.personApproveNote, 'ritualfamily'],
      [COPY.people.personStands, COPY.people.personStandsNote, 'personSuccession'],
      [COPY.people.personRemove, COPY.people.personRemoveNote, 'person'],
    ],
    back: '__family',
    note: COPY.people.personNote,
    light: 'm',
    caption: 'One person · the line is private, the removal is total',
  },

  /* the succession mark: private, one tap deeper, inside a person, never on
     the row (§6). NO toggle — naming someone next is a will, not a switch,
     and nothing behind it is wired yet. */
  personSuccession: {
    head: COPY.people.personStands,
    body: COPY.passing.nameNote,
    note: SUCCESSION_SOON,
    back: 'person',
    light: 'm',
    caption: 'The succession mark · private, one tap deeper, never on the row',
  },

  /* ── arriving by letter ──────────────────────────────────────── */

  joinletter: {
    head: COPY.people.joinLetterHead,
    body: COPY.people.joinLetterBody,
    art: 'letter',
    pill: COPY.people.joinLetterOpen,
    to: 'joinhello',
    link: COPY.people.joinLetterNot,
    linkTo: '__home',
    light: 'g',
    caption: 'Arrives by letter · the collaborator’s first screen',
  },

  joinhello: {
    head: COPY.people.joinHelloHead,
    body: COPY.people.joinHelloBody,
    art: 'piece',
    note: COPY.people.joinHelloNote,
    pill: COPY.four.carriesBegin,
    to: 'joinwho',
    light: 'a',
    caption: 'A collaborator arrives · not a stranger, not the caretaker',
  },

  joinwho: {
    head: COPY.people.joinWhoHead,
    body: COPY.people.joinWhoBody,
    /* the artist's second walk: "They're creating their own account, their
       password... you need the exact birth date, time and location." A
       password field, and the caretaker's own birth fields and hints,
       reused verbatim rather than re-derived. */
    fields: [
      [COPY.people.joinWhoName],
      [G.fieldPassword],
      [G.fieldDate, G.fieldTime],
      [G.fieldPlace],
    ],
    hints: {
      [G.fieldPassword]: G.hintPassword,
      [G.fieldDate]: G.hintDate,
      [G.fieldTime]: G.hintTime,
      [G.fieldPlace]: G.hintPlace,
    },
    fieldMeta: { [G.fieldPassword]: { type: 'password', autoComplete: 'new-password' } },
    back: 'joinhello',
    note: COPY.people.joinWhoNote,
    note2: JOINWHO_FLEX_NOTE, // workbook
    pill: COPY.people.joinWhoPill,
    to: '__home',
    light: 'p',
    caption: 'A collaborator arrives · their name, a password, and their birth details',
  },

  inheritletter: {
    head: COPY.heir.letterHead,
    body: COPY.heir.letterBody,
    art: 'letter',
    pill: COPY.heir.letterPill,
    to: 'inheritaccept',
    link: COPY.threshold.transferNot,
    linkTo: '__home',
    light: 'g',
    caption: 'Arrives by letter · nothing has moved yet',
  },

  inheritaccept: {
    head: COPY.heir.acceptHead,
    body: COPY.heir.acceptBody,
    art: 'piece',
    pill: G.continue,
    to: 'inherit',
    light: 'e',
    caption: 'The passing completes · by their hand, never by a timer',
  },

  inherit: {
    head: COPY.heir.keptHead,
    body: COPY.heir.keptBody,
    art: 'piece',
    note: COPY.heir.keptNote,
    pill: COPY.heir.keptPill,
    to: 'inheritread',
    link: COPY.heir.keptNot,
    linkTo: '__home',
    light: 'c',
    caption: 'The heir arrives · what he kept is now readable',
  },

  inheritread: {
    head: COPY.heir.readHead,
    body: COPY.heir.readBody,
    /* the artist's second walk: "These should be expandable ... writings,
       not just one-word sentences. And inside of this you can click it and
       enable it or disable it. However, once you choose to share it, it's
       forever with it." Rows open a full reading in place; INHERIT_WRITINGS
       (inheritRead.tsx) carries the three kept writings. */
    inheritReadings: true,
    back: 'inherit',
    note: COPY.heir.readNote,
    light: 'm',
    caption: 'The heir reads · each writing opens, and the shine control is arm-then-commit',
  },

  /* ── returning ───────────────────────────────────────────────── */

  welcome: {
    head: COPY.returning.welcomeHead,
    body: COPY.returning.welcomeBody,
    eyebrow: 'Signing in',
    fields: [[G.fieldEmail], ['Password']],
    hints: { [G.fieldEmail]: G.hintEmail },
    pill: COPY.returning.welcomePill,
    to: '__home',
    link: COPY.returning.welcomeForgot,
    linkTo: 'forgot',
    light: 'j',
    caption: 'Signing in again · a returning caretaker',
  },

  forgot: {
    head: COPY.returning.forgotHead,
    body: COPY.returning.forgotBody,
    eyebrow: 'Signing in',
    fields: [[G.fieldEmail]],
    hints: { [G.fieldEmail]: G.hintEmail },
    pill: COPY.returning.forgotPill,
    to: 'welcome',
    link: COPY.returning.forgotBack,
    linkTo: 'welcome',
    light: 'o',
    caption: 'Recovery · never an edit to history',
  },
} satisfies Record<string, Screen>;

/* ------------------------------------------------------------------ *
 * The renderer
 * ------------------------------------------------------------------ */

type Props = {
  screen: Screen;
  onGo: (key: string) => void;
  /**
   * What has been typed across the whole gathering, keyed by field label.
   *
   * It lives above the screen rather than inside it because a back link is
   * worthless if the field is empty when you arrive: the reason to go back is
   * that something in it was wrong, and you cannot fix what is no longer
   * there. It also keeps the promise the required screens make out loud:
   * "nothing you have written is lost."
   */
  values?: Record<string, string>;
  onType?: (label: string, value: string) => void;
  /**
   * Wired: the What shows lamps, controlled from above so the choices can
   * actually be kept. Absent, each screen holds its own state exactly as
   * the demo shell always has.
   */
  lampsValue?: boolean[];
  onLamps?: (lamps: boolean[]) => void;
};

export const WalkScreen: React.FC<Props> = ({
  screen,
  onGo,
  values,
  onType,
  lampsValue,
  onLamps,
}) => {
  const [ownLamps, setOwnLamps] = useState<boolean[]>([...SHOW_LAMPS_DEFAULT]);
  const [linksOpen, setLinksOpen] = useState(false);
  /* who2's own bit of state: the links section's map-light toggle. Not
     lifted, because it is the honest unwired placeholder (§7): it stores
     here, client-side, until a wire exists. */
  const [linksShow, setLinksShow] = useState(true);
  const lamps = lampsValue ?? ownLamps;
  const setLamps = (next: (l: boolean[]) => boolean[]) => {
    if (onLamps) onLamps(next(lamps));
    else setOwnLamps(next);
  };

  /* passname's reorderable line of succession: demo-only React state, drag
     and the Up / Down words both mutate the same order array */
  const [passOrder, setPassOrder] = useState<number[]>(() => PASSNAME_PEOPLE.map((_, i) => i));
  const [passDrag, setPassDrag] = useState<number | null>(null);
  const movePass = (position: number, dir: -1 | 1) => {
    setPassOrder(order => {
      const target = position + dir;
      if (target < 0 || target >= order.length) return order;
      const next = [...order];
      [next[position], next[target]] = [next[target], next[position]];
      return next;
    });
  };
  const dropPass = (position: number) => {
    if (passDrag === null || passDrag === position) {
      setPassDrag(null);
      return;
    }
    setPassOrder(order => {
      const next = [...order];
      const [moved] = next.splice(passDrag, 1);
      next.splice(position, 0, moved);
      return next;
    });
    setPassDrag(null);
  };

  /* inheritread's reading view: which writing is open, and which have been
     let shine. Demo-only React state. */
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const [shining, setShining] = useState<boolean[]>(() => INHERIT_WRITINGS.map(() => false));

  const advance = () => screen.to && onGo(screen.to);

  /* words alone sit in the middle of the page; anything read downward does not */
  const centred =
    !screen.fields &&
    !screen.rows &&
    !screen.lamps &&
    !screen.tiles &&
    !screen.who &&
    !screen.area &&
    !screen.reorder &&
    !screen.inheritReadings;

  /* the explainer is a sheet lifted over the page, not a page of its own */
  if (screen.sheet) {
    return (
      <Ground light={screen.light} wash pad="0 30px 30px">
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,11,9,.55)' }} />
        <div style={{ position: 'relative', flex: 1 }} />
        <div
          style={{
            position: 'relative',
            flex: 'none',
            margin: '0 -30px -30px',
            background: C.sheet,
            borderTop: `1px solid ${C.hairStrong}`,
            borderRadius: '22px 22px 34px 34px',
            padding: '34px 30px 30px',
          }}
        >
          <h2 style={{ margin: 0, fontFamily: F.display, fontWeight: 300, fontSize: 28, lineHeight: 1.12, color: C.ink }}>
            {screen.head}
          </h2>
          <p style={{ margin: '18px 0 0', fontFamily: F.body, fontSize: 14.5, lineHeight: 1.72, color: C.inkBody }}>
            {screen.body}
          </p>
          <div style={{ paddingTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {screen.link && <TLink onClick={() => screen.linkTo && onGo(screen.linkTo)}>{screen.link}</TLink>}
            {screen.pill && <Brass onClick={advance}>{screen.pill}</Brass>}
          </div>
        </div>
      </Ground>
    );
  }

  /* a writing opened: its own small screen, in place of the list, with its
     own back door and its own let-it-shine control */
  if (screen.inheritReadings && readingIndex !== null) {
    const writing = INHERIT_WRITINGS[readingIndex];
    return (
      <Ground light={screen.light} pad="44px 30px 30px">
        <InheritReading
          writing={writing}
          shining={shining[readingIndex]}
          onShine={() => setShining(s => s.map((v, i) => (i === readingIndex ? true : v)))}
          onBack={() => setReadingIndex(null)}
        />
      </Ground>
    );
  }

  return (
    <Ground
      light={screen.light}
      wash={Boolean(screen.eyebrow) || screen.ignite}
      pad={screen.eyebrow || screen.ignite ? '56px 30px 30px' : '44px 30px 30px'}
    >
      {/* the four advance on a tap anywhere: the fast lane is built in, and a
          skip link would teach everyone the screens are optional filler */}
      {screen.tap && (
        <button
          type="button"
          onClick={advance}
          aria-label="Continue"
          style={{ position: 'absolute', inset: 0, background: 'none', border: 0, cursor: 'pointer', zIndex: 3 }}
        />
      )}

      {/* the eyebrow, and the one navigation the design rules allow. They share
          a line so the back link costs no vertical space on a screen that must
          not scroll. */}
      {(screen.eyebrow || screen.back) && (
        <div
          style={{
            position: 'relative',
            flex: 'none',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: screen.eyebrow ? 'space-between' : 'flex-end',
            gap: 14,
            minHeight: 18,
          }}
        >
          {screen.eyebrow && <Eyebrow size={10.5}>{screen.eyebrow}</Eyebrow>}
          {screen.back && (
            <button
              type="button"
              onClick={() => onGo(screen.back as string)}
              style={{
                background: 'none',
                border: 0,
                cursor: 'pointer',
                fontFamily: F.body,
                fontSize: 13.5,
                color: C.inkQuiet,
                padding: 0,
              }}
            >
              Back
            </button>
          )}
        </div>
      )}

      {screen.ignite ? (
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Star />
          <div style={{ marginTop: 40 }}>
            <Head size={38}>{screen.head}</Head>
          </div>
          <div style={{ maxWidth: '28ch' }}>
            <Body top={20}>{screen.body}</Body>
          </div>
        </div>
      ) : (
        /* a screen carrying only words sits in the middle of the page, the way
           the design draws it. A screen with fields, rows or lamps starts at
           the top, because those are read downward and a centred form drifts. */
        <div
          style={{
            position: 'relative',
            /* a lamps, who, or inheritReadings screen lets its one
               scrolling rail take the band, so the wrapper must be allowed
               to fill and shrink; area and reorder are small enough to sit
               flex:none like fields and rows do */
            flex: centred ? 1 : screen.lamps || screen.who || screen.inheritReadings ? '1 1 auto' : 'none',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: centred ? 'center' : 'flex-start',
          }}
        >
          {screen.art && screen.art !== 'none' && (
            <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 150 }}>
              <Drawing motif={screen.art} size={104} draw />
            </div>
          )}

          <div style={{ position: 'relative', flex: 'none', marginTop: screen.eyebrow ? 14 : 0 }}>
            <Head size={screen.art === 'none' || !screen.art ? 34 : 33}>
              <Flag text={screen.head} />
            </Head>
          </div>

          {screen.body && <Body top={16}>{screen.body}</Body>}
          {screen.body2 && <Body top={14}>{screen.body2}</Body>}

          {/* the rule that must be read before writing */}
          {screen.preNote && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <Note top={22}>{screen.preNote}</Note>
            </div>
          )}

          {/* the fields. Lit, never boxed: the rule under the field holding the
              cursor is the only light on the screen. */}
          {screen.fields && (
            <div style={{ position: 'relative', flex: 'none', display: 'flex', flexDirection: 'column', gap: 26, paddingTop: 40 }}>
              {screen.fields.map((row, r) => (
                <div key={r} style={{ display: 'flex', gap: 16 }}>
                  {row.filter(Boolean).map((label, i) => (
                    <Field
                      key={label}
                      label={label as string}
                      hint={screen.hints?.[label as string]}
                      lit={r === 0 && i === 0}
                      type={screen.fieldMeta?.[label as string]?.type}
                      autoComplete={screen.fieldMeta?.[label as string]?.autoComplete}
                      value={values?.[label as string] ?? ''}
                      onChange={v => onType?.(label as string, v)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* a writing field: the same idiom as the garden's answer field */}
          {screen.area && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 26 }}>
              <Area
                value={values?.[screen.area[0]] ?? ''}
                hint={screen.area[1]}
                onChange={v => onType?.(screen.area[0], v)}
              />
            </div>
          )}

          {/* the passing's readback: the typed address, large and centred,
              so a mistyped hand cannot slip past unread */}
          {screen.readback && (
            <div
              style={{
                position: 'relative',
                flex: 'none',
                paddingTop: 30,
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: F.display,
                  fontWeight: 300,
                  fontSize: 30,
                  lineHeight: 1.3,
                  color: C.ink,
                  wordBreak: 'break-word',
                }}
              >
                {values?.[screen.readback] || '—'}
              </span>
            </div>
          )}

          {screen.tiles && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 22 }}>
              <LinkTiles open={linksOpen} onToggle={() => setLinksOpen(v => !v)} />
            </div>
          )}

          {/* who1: born's old fields and the five identity lamps. who2:
              links' old field, tiles and the map-light toggle. Two screens
              now, the artist's second walk, rather than one page behind a
              SegmentedTabs. */}
          {screen.who === 1 && (
            <div
              className="collector-scroll"
              style={{
                position: 'relative',
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                paddingTop: 26,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Field
                    label={G.fieldDate}
                    hint={G.hintDate}
                    lit
                    value={values?.[G.fieldDate] ?? ''}
                    onChange={v => onType?.(G.fieldDate, v)}
                  />
                  <Field
                    label={G.fieldTime}
                    hint={G.hintTime}
                    value={values?.[G.fieldTime] ?? ''}
                    onChange={v => onType?.(G.fieldTime, v)}
                  />
                </div>
                <Field
                  label={G.fieldPlace}
                  hint={G.hintPlace}
                  value={values?.[G.fieldPlace] ?? ''}
                  onChange={v => onType?.(G.fieldPlace, v)}
                />
              </div>

              {/* the birthday annotation: private, always, quietly feeding
                  the Oracle and the Dream. Flagged for Adrian. */}
              <Note>{WHO_BIRTHDAY_NOTE}</Note>

              {/* the why door, the same sheet the skip on the leftover
                  born screen opened */}
              <button
                type="button"
                onClick={() => onGo('explain')}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: 0,
                  fontFamily: F.body,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: C.inkBody,
                  borderBottom: '1px solid rgba(196,190,180,.4)',
                  paddingBottom: 2,
                  cursor: 'pointer',
                }}
              >
                {G.bornWhy}
              </button>

              {/* the five identity lamps, inline. The two piece-fact lamps
                  (what you place in it, the light on the map) do not appear
                  here: they are not optional, and default true always. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {WHO_LAMPS.map(([title, note], i) => {
                  const idx = i + 2;
                  return (
                    <Lamp
                      key={title}
                      title={title}
                      note={note}
                      on={Boolean(lamps[idx])}
                      onToggle={() => setLamps(l => l.map((v, j) => (j === idx ? !v : v)))}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {screen.who === 2 && (
            <div
              className="collector-scroll"
              style={{
                position: 'relative',
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                paddingTop: 26,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              <Field
                label={G.fieldSite}
                hint={G.hintSite}
                lit
                value={values?.[G.fieldSite] ?? ''}
                onChange={v => onType?.(G.fieldSite, v)}
              />
              <LinkTiles open={linksOpen} onToggle={() => setLinksOpen(v => !v)} />
              {/* the section-level show-on-the-map toggle, on by default
                  (§7). Honest and unwired: no shareLinks field exists, so
                  it stores client-side only for now. */}
              <Lamp
                title={WHO_LINKS_SHOW_LABEL}
                note={WHO_LINKS_SHOW_NOTE}
                on={linksShow}
                onToggle={() => setLinksShow(v => !v)}
              />
            </div>
          )}

          {/* passname's reorderable line: drag a row, or use the
              always-visible Up / Down words. The order note updates live. */}
          {screen.reorder && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 22 }}>
              {passOrder.map((personIdx, position) => {
                const p = PASSNAME_PEOPLE[personIdx];
                return (
                  <div
                    key={p.name}
                    draggable
                    onDragStart={() => setPassDrag(position)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => dropPass(position)}
                    onDragEnd={() => setPassDrag(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      width: '100%',
                      borderTop: position === 0 ? `1px solid ${C.hair}` : undefined,
                      borderBottom: `1px solid ${C.hair}`,
                      padding: '15px 0',
                      cursor: 'grab',
                      opacity: passDrag === position ? 0.5 : 1,
                    }}
                  >
                    <span>
                      <span style={{ display: 'block', fontFamily: F.body, fontSize: 16, color: C.ink }}>
                        {p.name}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          paddingTop: 5,
                          fontFamily: F.body,
                          fontSize: 12.5,
                          lineHeight: 1.55,
                          color: C.inkQuiet,
                        }}
                      >
                        {p.relation} · {passOrderLabel(position)}
                      </span>
                    </span>
                    <span style={{ display: 'flex', gap: 14, flex: 'none' }}>
                      <button
                        type="button"
                        onClick={() => movePass(position, -1)}
                        disabled={position === 0}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          cursor: position === 0 ? 'default' : 'pointer',
                          fontFamily: F.label,
                          fontSize: 10,
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: position === 0 ? 'rgba(161,150,138,.35)' : C.inkQuiet,
                        }}
                      >
                        {PASS_UP}
                      </button>
                      <button
                        type="button"
                        onClick={() => movePass(position, 1)}
                        disabled={position === passOrder.length - 1}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          cursor: position === passOrder.length - 1 ? 'default' : 'pointer',
                          fontFamily: F.label,
                          fontSize: 10,
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: position === passOrder.length - 1 ? 'rgba(161,150,138,.35)' : C.inkQuiet,
                        }}
                      >
                        {PASS_DOWN}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* What shows. The piece shines and the person opts in; one lamp per
              real privacy field (SHOW_LAMPS, wire order). The birth details
              row states itself and carries no switch, because they are shown
              to nobody, ever. Seven lamps outgrow the band, so this one list
              scrolls inside its own rail — the screen's head and foot hold. */}
          {screen.lamps && (
            <div
              className="collector-scroll"
              style={{
                position: 'relative',
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                paddingTop: 34,
              }}
            >
              {SHOW_LAMPS.map(([title, note], i) => (
                <Lamp
                  key={title}
                  title={title}
                  note={note}
                  on={Boolean(lamps[i])}
                  onToggle={() => setLamps(l => l.map((v, j) => (j === i ? !v : v)))}
                />
              ))}
              <Lamp title={G.showBirth} note={G.showBirthNote} on={false} fixed fixedWord={G.showNever} />
            </div>
          )}

          {/* a hairline-divided list of choices, never buttons */}
          {screen.rows && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 26 }}>
              {screen.rows.map(([title, note, to]) => (
                <ChoiceRow key={title} title={title} note={note} onClick={() => onGo(to)} />
              ))}
            </div>
          )}

          {/* the heir's three kept writings: pressing one opens the reading
              view (above) rather than navigating away */}
          {screen.inheritReadings && (
            <div
              className="collector-scroll"
              style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingTop: 26 }}
            >
              {INHERIT_WRITINGS.map((writing, i) => (
                <ChoiceRow
                  key={writing.title}
                  title={writing.title}
                  note={`${writing.year} · ${shining[i] ? SHINING_STATUS : writing.status}`}
                  onClick={() => setReadingIndex(i)}
                />
              ))}
            </div>
          )}

          {screen.note && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <Note top={22}>{screen.note}</Note>
            </div>
          )}

          {screen.note2 && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <Note top={10}>{screen.note2}</Note>
            </div>
          )}

          {/* a quiet door into the same sheet the skip shows */}
          {screen.why && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => onGo('explain')}
                style={{
                  background: 'none',
                  border: 0,
                  fontFamily: F.body,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: C.inkBody,
                  borderBottom: '1px solid rgba(196,190,180,.4)',
                  paddingBottom: 2,
                  cursor: 'pointer',
                }}
              >
                {screen.why}
              </button>
            </div>
          )}

          {/* each required screen says so plainly, unless its own note
              already carries the point (sign's noRequiredNote) */}
          {screen.required && !screen.noRequiredNote && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <Note top={18}>{G.required}</Note>
            </div>
          )}
        </div>
      )}

      {!centred && !screen.lamps && !screen.who && !screen.inheritReadings && (
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }} />
      )}

      {/* a quiet question line of its own, sitting directly above the foot
          rather than sharing it with the brass act (codetrue's fork door) */}
      {screen.foreLink && (
        <div style={{ position: 'relative', flex: 'none', paddingTop: 4 }}>
          <TLink onClick={() => screen.foreLinkTo && onGo(screen.foreLinkTo)}>{screen.foreLink}</TLink>
        </div>
      )}

      {!screen.tap && (screen.pill || screen.link) && (
        <div
          style={{
            position: 'relative',
            flex: 'none',
            paddingTop: 18,
            display: 'flex',
            alignItems: screen.stack ? 'flex-start' : 'center',
            flexDirection: screen.stack ? 'column' : 'row',
            justifyContent: screen.link && !screen.stack ? 'space-between' : 'flex-end',
            gap: screen.stack ? 4 : 16,
          }}
        >
          {screen.stack && screen.pill && <Brass onClick={advance}>{screen.pill}</Brass>}
          {screen.link && <TLink onClick={() => screen.linkTo && onGo(screen.linkTo)}>{screen.link}</TLink>}
          {!screen.stack && screen.pill && <Brass onClick={advance}>{screen.pill}</Brass>}
        </div>
      )}
    </Ground>
  );
};

/**
 * The add-a-link tile: a plus, a label, and the note that opens onto the
 * service grid. Its own component so who2's links section can share it
 * exactly rather than re-derive it.
 */
const LinkTiles: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => (
  <div style={{ position: 'relative' }}>
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        width: '100%',
        border: 0,
        background: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Plus />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: F.body, fontSize: 15, color: C.ink }}>{G.linksAdd}</span>
        <span style={{ display: 'block', paddingTop: 3 }}>
          <Eyebrow size={9.5}>{G.linksAddNote}</Eyebrow>
        </span>
      </span>
    </button>
    {open && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px', paddingTop: 12 }}>
        {['Instagram', 'X', 'Facebook', 'YouTube', 'TikTok', 'LinkedIn'].map(name => (
          <button
            key={name}
            type="button"
            style={{
              display: 'block',
              width: '100%',
              border: 0,
              borderBottom: `1px solid ${C.hair}`,
              background: 'none',
              padding: '13px 2px',
              textAlign: 'left',
              fontFamily: F.body,
              fontSize: 15,
              color: C.ink,
              cursor: 'pointer',
            }}
          >
            {name}
          </button>
        ))}
      </div>
    )}
  </div>
);
