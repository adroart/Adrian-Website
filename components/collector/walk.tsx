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
import { Body, Brass, ChoiceRow, Eyebrow, Field, Flag, Ground, Head, Lamp, Note, Plus, SegmentedTabs, TLink } from './ui';
import { Drawing } from './drawings';
import { Star } from './Orbit';

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
  /** a hairline-divided list of choices, never buttons */
  rows?: [string, string, Target][];
  /** the What shows lamps */
  lamps?: boolean;
  /** the display-grain chips */
  grain?: boolean;
  /** the add-a-link tile */
  tiles?: boolean;
  /**
   * The gathering's final page, per Adrian's ruling (§7, 2026-08-20): who
   * you are and your links, held on one page as two SegmentedTabs sections,
   * with the five identity lamps (name, face, chart, work, mission) rendered
   * inline in the first section. Renders its own bespoke content rather than
   * composing from `fields`/`lamps`/`tiles`, because no other screen shares
   * its shape.
   */
  who?: boolean;
  /** the one brass act */
  pill?: string;
  to?: Target;
  /** the quiet way out */
  link?: string;
  linkTo?: Target;
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

/* the who page: built fresh for §7, "the gathering, re-ordered" (2026-08-20).
   No card was drawn and no copy.ts key exists yet, so every string here is a
   placeholder awaiting Adrian, registered the same way as the lamp notes
   above. */
const WHO_HEAD = ph('Who you are · Your links');
const WHO_BODY = ph('Held together now, each with its own light on the map, on by default.');
/* the birthday privacy line, beneath the birth fields */
const WHO_BIRTHDAY_NOTE = ph(
  'Private, always. Never shown, never sold. It quietly feeds the Oracle and the Dream.',
);
/* the links section's map-light toggle: an honest unwired placeholder. No
   shareLinks field exists on the wire, so the choice stores client-side only
   until one does. */
const WHO_LINKS_SHOW_LABEL = ph('Show on the map');
const WHO_LINKS_SHOW_NOTE = ph('Not connected yet. It will hold your choice here soon.');

export const WALK = {
  /* ── the threshold ───────────────────────────────────────────── */

  codetrue: {
    head: COPY.threshold.trueHead,
    body: COPY.threshold.trueBody,
    art: 'piece',
    pill: COPY.threshold.trueContinue,
    to: 'pull',
    link: COPY.threshold.trueFork,
    linkTo: 'fork',
    stack: true,
    light: 'c',
    caption: 'Code confirmed · first caretaker',
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
    head: COPY.threshold.giftHead,
    body: COPY.threshold.giftBody,
    art: 'letter',
    back: 'fork',
    pill: COPY.threshold.giftSeal,
    to: 'sealed',
    light: 'k',
    caption: 'The gift · giver’s side · warm',
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
    fields: [[G.fieldFirst, G.fieldLast], [G.fieldEmail], [G.fieldPassword]],
    hints: { [G.fieldEmail]: G.hintEmail, [G.fieldPassword]: G.hintPassword },
    note: G.signNote,
    pill: G.signPill,
    to: 'lives',
    required: true,
    light: 'o',
    caption: 'Required · one account across everything',
  },

  born: {
    head: G.bornHead,
    body: G.bornBody,
    eyebrow: G.eyebrow,
    fields: [[G.fieldDate, G.fieldTime], [G.fieldPlace]],
    hints: { [G.fieldDate]: G.hintDate, [G.fieldTime]: G.hintTime, [G.fieldPlace]: G.hintPlace },
    back: 'sign',
    note: G.bornNote,
    why: G.bornWhy,
    pill: G.continue,
    to: 'lives',
    link: G.skip,
    linkTo: 'explain',
    light: 'p',
    caption: 'An add on · reachable forever, never a gate',
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
    grain: true,
    pill: G.continue,
    to: 'who',
    required: true,
    light: 'q',
    caption: 'Required · a light must live somewhere',
  },

  links: {
    head: G.linksHead,
    body: G.linksBody,
    eyebrow: G.eyebrow,
    fields: [[G.fieldSite]],
    back: 'lives',
    hints: { [G.fieldSite]: G.hintSite },
    tiles: true,
    pill: G.continue,
    to: 'shows',
    link: G.skip,
    linkTo: 'shows',
    light: 'a',
    caption: 'An add on · reachable forever, never a gate',
  },

  shows: {
    head: G.showsHead,
    body: G.showsBody,
    back: 'links',
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
    /* §7, 2026-08-20: both doors of the sheet lead back to the who page now,
       the only screen that still asks for the birthday and the links this
       sheet explains. */
    to: 'who',
    link: G.explainSkip,
    linkTo: 'who',
    light: 'k',
    caption: 'The explainer · one sheet, two doors',
  },

  /* §7, 2026-08-20: "The gathering, re-ordered." The piece's own facts are
     not optional and never were choices; only what concerns the person is
     chosen. The path becomes sign → lives → who → light47, and this is the
     final page, holding who you are and your links together, each with its
     own light on the map, on by default. required stays true because the
     page itself sits in the required path; the personal fields inside it
     stay optional (skippable by simply staying empty — no skip link, no
     gate). born, links, and shows survive untouched below, as leftover
     chapters no longer on the required path. */
  who: {
    head: WHO_HEAD,
    body: WHO_BODY,
    eyebrow: G.eyebrow,
    who: true,
    back: 'lives',
    pill: G.continue,
    to: 'light47',
    required: true,
    light: 'p',
    caption: 'Required · who you are and your links, held on one page',
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
    rows: [
      ['Sara', 'wife · first in line', 'passready'],
      ['Ines', 'daughter · second', 'passready'],
      ['Tomas', 'brother · not in line', 'passready'],
    ],
    back: 'passfork',
    note: COPY.passing.nameNote,
    light: 'l',
    caption: 'Passing it on · the line you already set',
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
    note: COPY.passing.readyNote,
    pill: COPY.threshold.transferBegin,
    to: 'passdone',
    link: COPY.threshold.transferNot,
    linkTo: '__home',
    light: 'f',
    caption: 'The passing · grave, and it does not soften',
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
    fields: [[COPY.people.joinWhoName], [COPY.people.joinWhoBorn]],
    back: 'joinhello',
    note: COPY.people.joinWhoNote,
    pill: COPY.people.joinWhoPill,
    to: '__home',
    light: 'p',
    caption: 'A collaborator arrives · two things, never five',
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
    rows: [
      ['“I bought it the week your mother got well.”', '1998 · he never let this shine', '__home'],
      ['“I have looked at it every morning since.”', '2004 · he never let this shine', '__home'],
      ['“If you are reading this it went to you, which is what I wanted.”', '2019 · he marked this one for you', '__home'],
    ],
    back: 'inherit',
    note: COPY.heir.readNote,
    light: 'm',
    caption: 'The heir reads · and decides what the world learns',
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
   * Wired: the What shows lamps and the display-grain chips, controlled from
   * above so the choices can actually be kept. Absent, each screen holds its
   * own state exactly as the demo shell always has.
   */
  lampsValue?: boolean[];
  onLamps?: (lamps: boolean[]) => void;
  grainValue?: 0 | 1;
  onGrain?: (grain: 0 | 1) => void;
};

export const WalkScreen: React.FC<Props> = ({
  screen,
  onGo,
  values,
  onType,
  lampsValue,
  onLamps,
  grainValue,
  onGrain,
}) => {
  const [ownGrain, setOwnGrain] = useState<0 | 1>(0);
  const [ownLamps, setOwnLamps] = useState<boolean[]>([...SHOW_LAMPS_DEFAULT]);
  const [linksOpen, setLinksOpen] = useState(false);
  /* the who page's own two bits of state: which SegmentedTabs section is
     open, and the links section's map-light toggle. Neither is lifted,
     because the tab is pure navigation and the toggle is the honest unwired
     placeholder (§7): it stores here, client-side, until a wire exists. */
  const [whoTab, setWhoTab] = useState<0 | 1>(0);
  const [linksShow, setLinksShow] = useState(true);
  const grain = grainValue ?? ownGrain;
  const setGrain = onGrain ?? setOwnGrain;
  const lamps = lampsValue ?? ownLamps;
  const setLamps = (next: (l: boolean[]) => boolean[]) => {
    if (onLamps) onLamps(next(lamps));
    else setOwnLamps(next);
  };

  const advance = () => screen.to && onGo(screen.to);

  /* words alone sit in the middle of the page; anything read downward does not */
  const centred =
    !screen.fields && !screen.rows && !screen.lamps && !screen.tiles && !screen.grain && !screen.who;

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
            /* a lamps or who screen lets its one scrolling rail take the
               band, so the wrapper must be allowed to fill and shrink */
            flex: centred ? 1 : screen.lamps || screen.who ? '1 1 auto' : 'none',
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
                      value={values?.[label as string] ?? ''}
                      onChange={v => onType?.(label as string, v)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {screen.grain && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <GrainChip label={G.grainCity} on={grain === 0} onClick={() => setGrain(0)} />
                <GrainChip label={G.grainRegion} on={grain === 1} onClick={() => setGrain(1)} />
              </div>
              {/* the "less accurate" annotation, under the Area chip once it is
                  picked (§7's own words for the region option) */}
              {grain === 1 && (
                <div style={{ paddingTop: 8 }}>
                  <Eyebrow size={9.5}>{G.grainAreaNote}</Eyebrow>
                </div>
              )}
            </div>
          )}

          {screen.tiles && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 22 }}>
              <LinkTiles open={linksOpen} onToggle={() => setLinksOpen(v => !v)} />
            </div>
          )}

          {/* the who page: born's fields and the identity lamps in one
              section, the links field, tiles and the map-light toggle in the
              other. §7, 2026-08-20. */}
          {screen.who && (
            <div
              style={{
                position: 'relative',
                flex: '1 1 auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                paddingTop: 26,
              }}
            >
              <SegmentedTabs options={[G.bornHead, G.linksHead]} active={whoTab} onChange={i => setWhoTab(i as 0 | 1)} />

              <div
                className="collector-scroll"
                style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingTop: 28 }}
              >
                {whoTab === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

                    {/* the birthday annotation: private, always, quietly
                        feeding the Oracle and the Dream. Flagged for Adrian. */}
                    <Note>{WHO_BIRTHDAY_NOTE}</Note>

                    {/* the why door, the same sheet the skip on the leftover
                        born screen opens */}
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

                    {/* the five identity lamps, inline. The two piece-fact
                        lamps (what you place in it, the light on the map) do
                        not appear here: they are not optional, and default
                        true always. */}
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
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <Field
                      label={G.fieldSite}
                      hint={G.hintSite}
                      lit
                      value={values?.[G.fieldSite] ?? ''}
                      onChange={v => onType?.(G.fieldSite, v)}
                    />
                    <LinkTiles open={linksOpen} onToggle={() => setLinksOpen(v => !v)} />
                    {/* the section-level show-on-the-map toggle, on by
                        default (§7). Honest and unwired: no shareLinks field
                        exists, so it stores client-side only for now. */}
                    <Lamp
                      title={WHO_LINKS_SHOW_LABEL}
                      note={WHO_LINKS_SHOW_NOTE}
                      on={linksShow}
                      onToggle={() => setLinksShow(v => !v)}
                    />
                  </div>
                )}
              </div>
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

          {screen.note && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <Note top={22}>{screen.note}</Note>
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

          {/* each required screen says so plainly */}
          {screen.required && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <Note top={18}>{G.required}</Note>
            </div>
          )}
        </div>
      )}

      {!centred && !screen.lamps && !screen.who && <div style={{ position: 'relative', flex: 1, minHeight: 0 }} />}

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

const GrainChip: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label, on, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: `1px solid ${on ? C.brassEdge : C.hairStrong}`,
      borderRadius: 999,
      padding: '8px 16px',
      background: 'none',
      fontFamily: F.label,
      fontSize: 10,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: on ? C.brass : C.inkQuiet,
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);

/**
 * The add-a-link tile: a plus, a label, and the note that opens onto the
 * service grid. Lifted out of the `links` screen's inline block so the who
 * page's links section can share it exactly rather than re-derive it.
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
