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
import { COPY } from './copy';
import { Motif } from './drawings';
import { Body, Brass, ChoiceRow, Eyebrow, Field, Flag, Ground, Head, Lamp, Note, Plus, TLink } from './ui';
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
    to: 'born',
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
    back: 'born',
    note: G.livesNote,
    grain: true,
    pill: G.continue,
    to: 'links',
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
    to: 'born',
    link: G.explainSkip,
    linkTo: 'lives',
    light: 'k',
    caption: 'The explainer · one sheet, two doors',
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

  ritual: {
    head: COPY.ritual.head,
    body: COPY.ritual.body,
    art: 'piece',
    preNote: COPY.ritual.note,
    fields: [[COPY.ritual.field]],
    pill: COPY.garden.place,
    to: 'ritualfamily',
    link: COPY.ritual.keep,
    linkTo: '__home',
    light: 'a',
    caption: 'The year turns · one occasion, once a year',
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
      [COPY.people.personStands, COPY.people.personStandsNote, 'person'],
      [COPY.people.personRemove, COPY.people.personRemoveNote, 'person'],
    ],
    back: '__family',
    note: COPY.people.personNote,
    light: 'm',
    caption: 'One person · the line is private, the removal is total',
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
  const [ownLamps, setOwnLamps] = useState<boolean[]>([true, true, false]);
  const [linksOpen, setLinksOpen] = useState(false);
  const grain = grainValue ?? ownGrain;
  const setGrain = onGrain ?? setOwnGrain;
  const lamps = lampsValue ?? ownLamps;
  const setLamps = (next: (l: boolean[]) => boolean[]) => {
    if (onLamps) onLamps(next(lamps));
    else setOwnLamps(next);
  };

  const advance = () => screen.to && onGo(screen.to);

  /* words alone sit in the middle of the page; anything read downward does not */
  const centred = !screen.fields && !screen.rows && !screen.lamps && !screen.tiles && !screen.grain;

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
            flex: centred ? 1 : 'none',
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
            <div style={{ position: 'relative', flex: 'none', display: 'flex', gap: 8, paddingTop: 20 }}>
              <GrainChip label={G.grainCity} on={grain === 0} onClick={() => setGrain(0)} />
              <GrainChip label={G.grainRegion} on={grain === 1} onClick={() => setGrain(1)} />
            </div>
          )}

          {screen.tiles && (
            <div style={{ position: 'relative', flex: 'none', paddingTop: 22 }}>
              <button
                type="button"
                onClick={() => setLinksOpen(v => !v)}
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
              {linksOpen && (
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
          )}

          {/* What shows. The piece shines and the person opts in; the birth
              details row states itself and carries no switch, because they are
              shown to nobody, ever. */}
          {screen.lamps && (
            <div style={{ position: 'relative', flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 34 }}>
              <Lamp
                title={G.showPlaced}
                note={G.showPlacedNote}
                on={lamps[0]}
                onToggle={() => setLamps(l => [!l[0], l[1], l[2]])}
              />
              <Lamp
                title={G.showLight}
                note={G.showLightNote}
                on={lamps[1]}
                onToggle={() => setLamps(l => [l[0], !l[1], l[2]])}
              />
              <Lamp
                title={G.showName}
                note={G.showNameNote}
                on={lamps[2]}
                onToggle={() => setLamps(l => [l[0], l[1], !l[2]])}
              />
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

      {!centred && <div style={{ position: 'relative', flex: 1, minHeight: 0 }} />}

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
