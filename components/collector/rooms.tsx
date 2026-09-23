/**
 * The rooms behind the rows.
 *
 * Each opens in place from the piece page, with the same motion the public rows
 * use: one motion vocabulary everywhere. Closing returns to the page. Nothing
 * here navigates.
 *
 * The shape that keeps the privacy model honest (Adrian's ruling: the
 * certificate IS the piece information — one room, not two):
 *   everyone who scans the piece sees the public certificate content;
 *   the caretaker alone additionally sees the private rows, and what was
 *   paid stays masked even for them until they choose to reveal it;
 *   birth details are shown to nobody, ever, on any surface;
 *   the provenance chain is public.
 */

import React, { useEffect, useState } from 'react';
import { C, F } from './tokens';
import { COPY, PIECE, PLACEHOLDERS } from './copy';
import { Body, Brass, Eyebrow, Field, Flag, Ground, Ledger, Note, Plus, RoomBody, RoomHead, SegmentedTabs, TLink } from './ui';
import { Drawing } from './drawings';
import { ResonantGrid } from './ResonantGrid';
import { Garden } from './garden';
import type { FamilyPerson, PieceLive } from './live';
import type { CurrentKeeperPriceEntry } from './api';
import { formatLineageEventLabel } from '../../utils/publicLineage';

/**
 * Strings no copy.ts key exists for yet. copy.ts is frozen this pass, so they
 * live here, registered as placeholders so none can reach Adrian disguised as
 * finished copy (the states.tsx / garden.tsx idiom). T3-COPY: hoist and settle.
 */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

/* the household's honest status words: email and status are all the registry
   holds for a person, so the rows say exactly that and nothing warmer. The
   invited line's static word; the date beside it is real fetched data and is
   never itself marked a placeholder. */
const FAMILY_ON_PIECE = ph('On the piece');
const FAMILY_INVITED = ph('Invited');
const FAMILY_SENT_WORD = ph('Sent');

/* the two waiting-card actions, pressed: a single press is enough, and it
   settles into a quiet confirmation. Neither line exists yet in copy.ts. */
const FAMILY_SHINE_CONFIRM = ph('It shines now, and it stays.');
const FAMILY_KEEP_CONFIRM = ph('Kept in the record.');

/* the account room's rows and its one kept line */
const ACCOUNT_KEPT = ph('Kept. The light moves with you.');
const ACCOUNT_KEPT_GENERIC = ph('Kept.');
const ACCOUNT_KEEP_ACTION = ph('Keep it');
const ACCOUNT_SHOWS_ROW = ph('What shows');
const ACCOUNT_LETTERS_ROW = ph('Letters');
const ACCOUNT_LIVES_LABEL = ph('Where the art lives');
/* consolidated row: 'Your links' and 'What shows' merged to one line, per
   the artist's own note that the list can be tightened */
const ACCOUNT_SHOWS_LINKS_ROW = ph('What shows and your links');
const ACCOUNT_SHOWS_LINKS_NOTE = ph(
  'What the piece shows, and the links that travel beside it. Changing either still lives on its own screen for now.',
);
const ACCOUNT_NEW_PASSWORD_LABEL = ph('New password');
const ACCOUNT_PASSWORD_CHANGED = ph('Changed just now');
/* the one conventional Back a suppressed room head hands to Your account's
   own edit views (§1's mechanic, shared here) */
const ACCOUNT_BACK = ph('Back to your account');

/* the quiet press affordance shared by every entry that opens into a fuller
   reading: a hover underline on the entry's own text, plus a small trailing
   label. Never a chevron glyph standing in for state. */
const READ_IT = ph('Read it');
const OPEN_AFFORDANCE_CSS =
  '.collector-open-entry:hover .collector-open-entry-text{text-decoration:underline;text-underline-offset:3px}';

/* the letters room: the record's own empty line (§5 "the piece page after
   registration": empty sections carry one quiet line), and a plain word per
   letter kind. None of these is Adrian's yet. */
const LETTERS_EMPTY = ph('Nothing written yet.');

/* the story's second voice: the commissioner's paragraph. The label and the
   demo paragraph are both samples — the wire that carries a real
   commissioner's words does not exist yet (live.ts story.commissioned).
   The scaffolding ("Sample, a commissioner might write:") used to open the
   paragraph itself; it now sits above it instead, as its own quiet label,
   so the quote reads as a quote. */
const STORY_COMMISSIONED_LABEL = ph('From the one who asked for it');
const STORY_COMMISSIONED_SAMPLE_LABEL = ph('A sample, until a commissioner writes');
const STORY_COMMISSIONED_SAMPLE = ph(
  'I asked for this piece the year the family workshop was sold, so that one made thing would still hold the smell of that room.',
);

/* the history room: the two tab words were inline in the old tab strip, and
   the rest are the written items' honest lines */
const HISTORY_TAB_MOVED = ph('How it moved');
const HISTORY_TAB_WRITTEN = ph('What was written');
/* the one conventional Back a reading hands to the room's own head while
   it is open (§1's fix: two Backs on screen collapse to one) */
const HISTORY_BACK = ph('Back to the history');
const DREAMS_BACK = ph('Back to the dreams');
const WRITTEN_SHINES_TEXT = ph('A dream was placed in it');
const WRITTEN_SHINES_NOTE = ph('shining · words with no name');
const WRITTEN_SHINES_WORD = ph('shining');
const WRITTEN_KEPT_TEXT = ph('Your words were placed in it');
const WRITTEN_KEPT_NOTE = ph('kept with the piece');
const WRITTEN_SEALED_NOTE = ph('sealed · words for you alone');
const LETTER_KIND_WORD: Record<string, string> = {
  'kin-claim': ph('Asking someone on'),
  anniversary: ph('The year turning'),
  transfer: ph('A passing'),
};

export type RoomKey =
  | 'story'
  | 'history'
  | 'dreams'
  | 'information'
  | 'garden'
  | 'family'
  | 'account'
  | 'letters'
  | 'grid';

const TITLES: Record<RoomKey, string> = {
  story: COPY.page.rowStory,
  history: COPY.page.rowHistory,
  dreams: COPY.page.rowDreams,
  information: COPY.page.rowInformation,
  garden: COPY.garden.title,
  family: COPY.page.rowFamily,
  account: COPY.page.rowAccount,
  letters: ACCOUNT_LETTERS_ROW,
  grid: 'The Resonant Grid',
};

const LIGHT: Record<RoomKey, string> = {
  story: 'a',
  history: 'n',
  dreams: 'i',
  information: 'i',
  garden: 'j',
  family: 'l',
  account: 'm',
  letters: 'g',
  grid: 'n',
};

type Props = {
  room: RoomKey;
  onClose: () => void;
  onWalk?: (key: string) => void;
  /** open a sibling room in place (the account room's Letters row) */
  onOpenRoom?: (room: RoomKey) => void;
  /** wired: the real piece. Absent, every room renders the demo unchanged. */
  live?: PieceLive;
};

/**
 * What a room hands up when it opens a reading or an edit view in place of
 * its own list: the room shell suppresses its own conventional Back (and its
 * Close brass, where it has one) and shows this one instead, in the exact
 * position the shell's Back occupied. Fixes §1: two visually identical Backs
 * on screen at once, one of which silently exited the whole room.
 */
type ChromeOverride = { backLabel: string; onBack: () => void } | null;
type OnChrome = (override: ChromeOverride) => void;

/** The room shell's own head, drawn once more with a room-supplied label,
 *  for exactly the moment a room has something open that isn't its list. */
const SubHead: React.FC<{ title: string; backLabel: string; onBack: () => void }> = ({
  title,
  backLabel,
  onBack,
}) => (
  <div
    style={{
      position: 'relative',
      flex: 'none',
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 14,
      borderBottom: `1px solid ${C.hairStrong}`,
      paddingBottom: 15,
    }}
  >
    <span style={{ fontFamily: F.display, fontWeight: 300, fontSize: 26, color: C.ink }}>{title}</span>
    <button
      type="button"
      onClick={onBack}
      style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, color: C.inkQuiet }}
    >
      {backLabel}
    </button>
  </div>
);

export const Room: React.FC<Props> = ({ room, onClose, onWalk, onOpenRoom, live }) => {
  /* a room's reading/edit view can only ever belong to the room currently
     mounted, so switching rooms clears any override the previous one left */
  const [chromeOverride, setChromeOverride] = useState<ChromeOverride>(null);
  useEffect(() => setChromeOverride(null), [room]);

  /* the garden brings its own ground: its first surface is the piece asking a
     single thing full screen, which has no room header to sit under */
  if (room === 'garden') return <Garden onWalk={onWalk} onClose={onClose} live={live?.garden ?? undefined} liveEmpty={Boolean(live) && !live.garden} />;

  /* rooms that end in a list, rather than in something to close, carry their
     own way out and take no brass */
  const listRoom = room === 'family' || room === 'account' || room === 'letters';

  return (
    <Ground light={LIGHT[room] as never} pad="44px 30px 30px">
      <style>{OPEN_AFFORDANCE_CSS}</style>
      {chromeOverride ? (
        <SubHead title={TITLES[room]} backLabel={chromeOverride.backLabel} onBack={chromeOverride.onBack} />
      ) : (
        <RoomHead title={TITLES[room]} onBack={onClose} />
      )}
      {room === 'story' && (live ? <LiveStoryRoom live={live} /> : <StoryRoom />)}
      {room === 'history' && (live ? <LiveHistoryRoom live={live} onChrome={setChromeOverride} /> : <HistoryRoom onChrome={setChromeOverride} />)}
      {room === 'dreams' && (live ? <LiveDreamsRoom live={live} onChrome={setChromeOverride} /> : <DreamsRoom onChrome={setChromeOverride} />)}
      {room === 'information' && (live ? <LiveInformationRoom live={live} /> : <InformationRoom />)}
      {room === 'family' && (live ? <LiveFamilyRoom live={live} onWalk={onWalk} /> : <FamilyRoom onWalk={onWalk} />)}
      {room === 'account' && (live ? <LiveAccountRoom live={live} onWalk={onWalk} onOpenRoom={onOpenRoom} /> : <AccountRoom onClose={onClose} onChrome={setChromeOverride} />)}
      {room === 'letters' && <LettersRoom live={live} />}
      {room === 'grid' && <GridRoom />}
      {!listRoom && !chromeOverride && (
        <div style={{ flex: 'none', marginTop: 'auto', paddingTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <Brass onClick={onClose}>{COPY.page.close}</Brass>
        </div>
      )}
    </Ground>
  );
};

/* ------------------------------------------------------------------ *
 * The story: the public row every guest reads. Adrian's voice leads, and
 * the commissioner's paragraph follows when the piece was asked for.
 * ------------------------------------------------------------------ */

/**
 * The commissioner's paragraph, given a proper quote presentation: display
 * face, italic, its own colour, set apart from Adrian's own body voice
 * rather than sharing its typography. `sampleLabel` is the small scaffolding
 * line that used to open the sentence itself ("Sample, a commissioner might
 * write:"); it now sits above the quote as its own 10px quiet label, present
 * only while the paragraph is still a sample rather than a real one.
 */
const CommissionerQuote: React.FC<{ sampleLabel?: string; text: string; flagged?: boolean }> = ({
  sampleLabel,
  text,
  flagged = false,
}) => (
  <>
    <div style={{ paddingTop: 26 }}>
      <Eyebrow>{STORY_COMMISSIONED_LABEL}</Eyebrow>
    </div>
    {sampleLabel && (
      <div style={{ paddingTop: 12 }}>
        <Eyebrow size={10}>{sampleLabel}</Eyebrow>
      </div>
    )}
    <p
      style={{
        margin: `${sampleLabel ? 8 : 12}px 0 0`,
        fontFamily: F.display,
        fontStyle: 'italic',
        fontWeight: 300,
        fontSize: 19,
        lineHeight: 1.58,
        color: C.inkWarm,
        textWrap: 'pretty',
      }}
    >
      {flagged ? <Flag text={text} /> : text}
    </p>
  </>
);

const StoryRoom: React.FC = () => (
  <RoomBody top={22}>
    <p
      style={{
        margin: 0,
        fontFamily: F.display,
        fontWeight: 300,
        fontSize: 24,
        lineHeight: 1.4,
        color: C.ink,
      }}
    >
      {COPY.rooms.storyLead}
    </p>
    <Body top={18}>{COPY.rooms.storyBody1}</Body>
    <Body top={16}>{COPY.rooms.storyBody2}</Body>
    {/* the commissioner's voice: why the piece was asked for. Sample only —
        clearly a placeholder, never Adrian's or a real commissioner's words. */}
    <CommissionerQuote sampleLabel={STORY_COMMISSIONED_SAMPLE_LABEL} text={STORY_COMMISSIONED_SAMPLE} flagged />
    <Note top={22}>{COPY.rooms.storyNote}</Note>
  </RoomBody>
);

/* ------------------------------------------------------------------ *
 * The history: the public spine, and what was written into it. Names
 * appear only where a caretaker chose to be seen.
 * ------------------------------------------------------------------ */

/* the demo spine. The demo entries only ever had years, so the months here
   are plausible sample data, ph-marked, never presented as record truth. */
const MOVED: { year: string; month: string; text: string; note: string }[] = [
  { year: '2024', month: ph('February'), text: 'Made in the workshop', note: 'Sonoma County' },
  { year: '2024', month: ph('April'), text: 'Registered by its first caretaker', note: 'named by choice' },
  { year: '2025', month: ph('June'), text: 'The plate was replaced', note: 'the record is the same record' },
  { year: '2026', month: ph('August'), text: 'Still held', note: 'Sonoma County' },
];

/* the demo written items. A body means the words shine and the entry opens;
   the kept entry carries no body here, exactly as a guest would meet it. */
const WRITTEN: { year: string; month: string; text: string; note: string; body: string | null }[] = [
  {
    year: '2024',
    month: ph('April'),
    text: 'A dream was placed in it',
    note: 'shining · words with no name',
    body: COPY.page.dreamSample,
  },
  {
    year: '2025',
    month: ph('March'),
    text: 'Someone in the house wrote into it',
    note: 'kept with the piece',
    body: null,
  },
  {
    year: '2026',
    month: ph('April'),
    text: 'The dream was placed again',
    note: 'shining · words with no name',
    body: ph('That the ones who visit this house leave lighter than they came.'),
  },
];

/* the date column: the year eyebrow stays where it always sat, and the month
   word sits directly beneath it in the same quiet label face. Either half
   renders only when the entry actually carries that data. */
const HistoryDate: React.FC<{ year: string | null; month: string | null }> = ({ year, month }) => (
  <div style={{ paddingTop: 4 }}>
    {year && (
      <div>
        <Eyebrow>{year}</Eyebrow>
      </div>
    )}
    {month && (
      <div style={{ paddingTop: 3 }}>
        <Eyebrow size={9}>{month}</Eyebrow>
      </div>
    )}
  </div>
);

/* one entry on the spine. With onOpen it is a real button and the whole line
   is the press target, carrying the shared quiet press affordance (a hover
   underline on its own text, plus a small trailing label, never a chevron);
   without onOpen it is the same plain line it always was, no affordance. */
const HistoryEntry: React.FC<{
  year: string | null;
  month: string | null;
  text: string;
  note?: string | null;
  onOpen?: () => void;
}> = ({ year, month, text, note, onOpen }) => {
  const pressable = Boolean(onOpen);
  const line = (
    <>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 7,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: C.brass,
          boxShadow: '0 0 9px 3px rgba(212,184,138,.4)',
          display: 'block',
        }}
      />
      <span
        style={{ position: 'absolute', left: 2, top: 16, bottom: -26, width: 1, background: C.hair, display: 'block' }}
      />
      <div
        className={pressable ? 'collector-open-entry-text' : undefined}
        style={{ fontFamily: F.body, fontSize: 15.5, lineHeight: 1.45, color: C.ink, display: 'inline-block' }}
      >
        {text}
      </div>
      {note && <div style={{ paddingTop: 4, fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet }}>{note}</div>}
      {pressable && (
        <div
          style={{
            paddingTop: 4,
            fontFamily: F.label,
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: C.brass,
          }}
        >
          {READ_IT}
        </div>
      )}
    </>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 16, paddingBottom: 26 }}>
      <HistoryDate year={year} month={month} />
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="collector-open-entry"
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'none',
            border: 0,
            padding: '0 0 0 20px',
            cursor: 'pointer',
          }}
        >
          {line}
        </button>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 20 }}>{line}</div>
      )}
    </div>
  );
};

/**
 * A reading opened in place: the words whole, in the dream-reading
 * typography the garden's review page settled (F.display 300 at 23). Shared
 * by the history's written items and the dreams' portal entries — one
 * paragraph or several; a single-name `eyebrow` line, when there is one,
 * leads. The room's own head carries the one Back while this is open (§1);
 * this view renders no back link of its own.
 */
type Reading = { eyebrow: string | null; paragraphs: string[] };

const ReadingView: React.FC<{ reading: Reading }> = ({ reading }) => (
  <RoomBody top={16}>
    {reading.eyebrow && (
      <div>
        <Eyebrow>{reading.eyebrow}</Eyebrow>
      </div>
    )}
    {reading.paragraphs.map((body, i) => (
      <p
        key={i}
        style={{
          margin: i === 0 ? (reading.eyebrow ? '14px 0 0' : 0) : '18px 0 0',
          fontFamily: F.display,
          fontWeight: 300,
          fontSize: 23,
          lineHeight: 1.36,
          color: C.inkWarm,
          textWrap: 'pretty',
          whiteSpace: 'pre-wrap',
        }}
      >
        <Flag text={body} />
      </p>
    ))}
  </RoomBody>
);

const HistoryRoom: React.FC<{ onChrome?: OnChrome }> = ({ onChrome }) => {
  const [tab, setTab] = useState(0);
  const [reading, setReading] = useState<Reading | null>(null);
  /* §1's fix: while a reading is open, the room hands its Back up to the
     shell instead of drawing its own — the shell suppresses RoomHead's Back
     and the Close brass, and shows this one Back in their place */
  useEffect(() => {
    onChrome?.(reading ? { backLabel: HISTORY_BACK, onBack: () => setReading(null) } : null);
  }, [reading, onChrome]);
  return (
    <>
      <div style={{ flex: 'none', paddingTop: 10 }}>
        <Note>{COPY.rooms.historyNote}</Note>
      </div>
      {reading ? (
        <ReadingView reading={reading} />
      ) : (
        <>
          <div style={{ flex: 'none', paddingTop: 18 }}>
            <SegmentedTabs options={[HISTORY_TAB_MOVED, HISTORY_TAB_WRITTEN]} active={tab} onChange={setTab} />
          </div>
          <RoomBody top={24}>
            {tab === 0 &&
              MOVED.map(entry => (
                <HistoryEntry key={`${entry.year}-${entry.text}`} year={entry.year} month={entry.month} text={entry.text} note={entry.note} />
              ))}
            {tab === 1 &&
              WRITTEN.map(entry => (
                <HistoryEntry
                  key={`${entry.year}-${entry.text}`}
                  year={entry.year}
                  month={entry.month}
                  text={entry.text}
                  note={entry.note}
                  /* only words that shine open for a guest; the kept entry
                     carries no press at all */
                  onOpen={entry.body ? () => setReading({ eyebrow: entry.note, paragraphs: [entry.body as string] }) : undefined}
                />
              ))}
          </RoomBody>
        </>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * The dreams: what other caretakers let shine. Each opener is the whole
 * dream's own first line, in the demo's original display type; press it
 * and it opens into a portal, the paragraphs standing behind it — a
 * caretaker's small words made room enough to actually read. Nameless is
 * the default; exactly one demo entry carries a name, signed with the city,
 * so Adrian can see what that looks like the day someone chooses it.
 * ------------------------------------------------------------------ */

/* draft replacement for the locked COPY.rooms.dreamsNote, in workbook
   territory rather than settled: the artist's own note was "the writing in
   here should encourage people to share because of the power with it," and
   the old line only ever described what other people did, never invited
   the reader. Not Adrian's words yet. */
const DREAMS_NOTE_WORKBOOK = ph(
  'What other caretakers chose to let shine. If something is stirring in you, there is room for it here too, whenever you are ready and however much you want to say.',
);

type DreamEntry = { opener: string; city: string; name: string | null; paragraphs: string[] };

const DREAMS: DreamEntry[] = [
  {
    opener: ph('That this house stays a place people arrive at unannounced.'),
    city: 'Sonoma County',
    name: null,
    paragraphs: [
      ph(
        "I don't mean guests who call ahead. I mean the kind of arriving where someone is already halfway through the door before they remember to knock, because some part of them already knows this is a house that opens.",
      ),
      ph(
        'We built it that way on purpose, or maybe it built us that way and we just went along. Either way, I hope the door stays like that long after I have stopped being the one who answers it.',
      ),
    ],
  },
  {
    opener: ph('That my daughter reads the letter I have not written yet.'),
    city: 'Lisbon',
    /* the one demo entry that carries a name, per the artist's request to
       see the named case: name and city both shown, signed treatment */
    name: ph('Miriam'),
    paragraphs: [
      ph(
        "I have started it four times, in four different notebooks. Every time I reach the part about her mother I stop, because I don't yet know how to say it without it sounding like an apology.",
      ),
      ph(
        'It is not an apology. It is just true, and true things seem to take longer to write down than sorry ones do. One day it will be finished, and she will read it, and I hope by then I will have found the right order for it.',
      ),
    ],
  },
  {
    opener: ph('That the workshop outlives me and someone else swears in it.'),
    city: 'Bergen',
    name: null,
    paragraphs: [
      ph(
        'Not politely. Actually swears, the way you do when a chisel skips and takes a piece of your thumb with it, or a joint you have fought for three hours finally seats.',
      ),
      ph(
        "That is how I will know the place is still alive. Not the tools staying where I left them, but somebody's temper breaking in it, the way mine has for years, over the same wood doing the same thing it has always done.",
      ),
    ],
  },
  {
    opener: ph('That we stop measuring the years by what went wrong in them.'),
    city: 'Kyoto',
    name: null,
    paragraphs: [
      ph(
        "Every year someone asks how it was, and I catch myself running down the list of what broke, who left, what didn't heal in time, before I have said one true good thing.",
      ),
      ph(
        'I want a year where the honest answer is just: it happened, and I was there for most of it. I think that would be enough, if I let it be.',
      ),
    ],
  },
];

/** the eyebrow line under an opener, and the reading's own eyebrow above its
 *  paragraphs: name and city together when a name was given, city alone
 *  otherwise — the same treatment either place */
const dreamAttribution = (entry: DreamEntry): string => (entry.name ? `${entry.name} · ${entry.city}` : entry.city);

const DreamEntryRow: React.FC<{ entry: DreamEntry; lead: boolean; onOpen: () => void }> = ({ entry, lead, onOpen }) => (
  <div style={{ padding: '0 0 26px' }}>
    <button
      type="button"
      onClick={onOpen}
      className="collector-open-entry"
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
    >
      <p
        className="collector-open-entry-text"
        style={{
          margin: 0,
          fontFamily: F.display,
          fontWeight: 300,
          fontSize: lead ? 23 : 21,
          lineHeight: 1.36,
          color: lead ? C.inkWarm : C.ink,
          textWrap: 'pretty',
        }}
      >
        {entry.opener}
      </p>
      <div
        style={{
          paddingTop: 4,
          fontFamily: F.label,
          fontSize: 10,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: C.brass,
        }}
      >
        {READ_IT}
      </div>
    </button>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 8 }}>
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: C.brass,
          boxShadow: '0 0 9px 3px rgba(212,184,138,.4)',
          flex: 'none',
          display: 'block',
        }}
      />
      <Eyebrow>{dreamAttribution(entry)}</Eyebrow>
    </div>
  </div>
);

const DreamsRoom: React.FC<{ onChrome?: OnChrome }> = ({ onChrome }) => {
  const [reading, setReading] = useState<Reading | null>(null);
  useEffect(() => {
    onChrome?.(reading ? { backLabel: DREAMS_BACK, onBack: () => setReading(null) } : null);
  }, [reading, onChrome]);

  return (
    <>
      <div style={{ flex: 'none', paddingTop: 11 }}>
        <Note>{DREAMS_NOTE_WORKBOOK}</Note>
      </div>
      {reading ? (
        <ReadingView reading={reading} />
      ) : (
        <RoomBody top={24}>
          {DREAMS.map((entry, i) => (
            <DreamEntryRow
              key={entry.opener}
              entry={entry}
              lead={i === 0}
              onOpen={() => setReading({ eyebrow: dreamAttribution(entry), paragraphs: entry.paragraphs })}
            />
          ))}
          <Note>{COPY.rooms.dreamsFoot}</Note>
        </RoomBody>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Piece information: the certificate and the record are one room. Everyone
 * who scans the piece reads the public certificate content; the caretaker
 * alone sees the private rows beneath it, and what was paid stays masked
 * even for them until they choose to look.
 * ------------------------------------------------------------------ */

/** '· · · · ·' in the Ledger idiom: an amount held, not an amount missing. */
const PAID_MASK = '· · · · ·';

/**
 * The one place price appears, masked by default. The whole row is a real
 * button and works exactly like a show-password control: one press reveals,
 * the same press re-masks, aria-pressed carries the state.
 */
const PaidLedger: React.FC<{ amount: string }> = ({ amount }) => {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown(s => !s)}
      aria-pressed={shown}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 0,
        borderBottom: `1px solid ${C.hair}`,
        padding: '13px 0',
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 'none' }}>
        <Eyebrow>What was paid</Eyebrow>
      </span>
      <span
        style={{
          fontFamily: F.body,
          fontSize: 14.5,
          color: shown ? C.inkWarm : C.inkQuiet,
          textAlign: 'right',
        }}
      >
        {shown ? amount : PAID_MASK}
      </span>
    </button>
  );
};

const InformationRoom: React.FC = () => (
  <>
    {/* COPY.rooms.infoNote used to open this room, saying "the full record.
        what was paid appears here and nowhere else" on a screen that IS
        that record, with the masked price sitting a few rows below.
        Deleted per the artist: it doesn't need to be there. */}
    <RoomBody>
      {/* the photograph slot has an empty state: the piece's own line drawing
          stands in, and the page never shows a broken or blank image. Adding a
          photograph is a caretaker act. */}
      <div
        style={{
          position: 'relative',
          width: 240,
          height: 240,
          margin: '6px auto 22px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 2,
          boxShadow: `inset 0 0 0 1px ${C.hairStrong}`,
        }}
      >
        <Drawing motif="piece" size={120} />
      </div>
      <Ledger label="Series" value="Universal Language, 1 of 64" />
      <Ledger label="Made" value="2024, over eleven months" />
      <Ledger label="Material" value="Claro walnut, brass inlay" />
      <Ledger label="Dimensions" value="420 × 420 × 90 mm" />
      <Ledger label="Finish" value="Hard wax oil, hand rubbed" />
      <Ledger label="Registered" value={`9 April 2026 · Light ${PIECE.ordinal}`} />
      <Ledger label="First caretaker" value="Adrian Rasmussen" />
      <Ledger label="Shown publicly" value="Not yet · open it in What shows" />
      <Ledger label="Where it lives" value="Sonoma County" />
      <PaidLedger amount="$14,000" />
      <Note top={18}>{COPY.rooms.infoFoot}</Note>
    </RoomBody>
  </>
);

/* ------------------------------------------------------------------ *
 * The people you love. The household is the people whose love is in the
 * piece, not an invite list. Being on it promises nothing.
 * ------------------------------------------------------------------ */

const HOUSEHOLD: [string, string, string][] = [
  ['Marta', 'Wife', 'Placed her words in the spring'],
  ['Ines', 'Daughter', 'Her words shine without her name'],
  ['Tomas', 'Son', 'Invited, has not written yet'],
];

const FamilyRoom: React.FC<{ onWalk?: (key: string) => void }> = ({ onWalk }) => {
  /* the waiting card's own settled state: a single press on either action is
     enough (no arm-then-commit here), and it flips the card into a quiet
     confirmation rather than opening anything further */
  const [waiting, setWaiting] = useState<'pending' | 'shine' | 'keep'>('pending');
  return (
  <>
    <div style={{ flex: 'none', paddingTop: 10 }}>
      <Note>{COPY.rooms.familyNote}</Note>
      {/* §6, verbatim, on the household's own room: the list is love, never
          a promise of succession */}
      <Note top={6}>{COPY.rooms.familyPromise}</Note>
    </div>
    <RoomBody top={18}>
      {HOUSEHOLD.map(([name, relation, note]) => (
        <button
          key={name}
          type="button"
          onClick={() => onWalk?.('person')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'none',
            border: 0,
            borderBottom: `1px solid ${C.hair}`,
            padding: '15px 0',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 }}>
            <span style={{ fontFamily: F.body, fontSize: 16, color: C.ink }}>{name}</span>
            <Eyebrow>{relation}</Eyebrow>
          </span>
          <span style={{ display: 'block', paddingTop: 5, fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet }}>
            {note}
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onWalk?.('invite')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          width: '100%',
          background: 'none',
          border: 0,
          padding: '20px 0 0',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Plus />
        <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{COPY.rooms.familyInvite}</span>
      </button>

      {/* words waiting for the caretaker to read once before they shine. The
          caretaker is the one approver of what shines from their piece. */}
      <div
        style={{
          marginTop: 30,
          padding: '22px 22px 20px',
          borderRadius: 22,
          background:
            'linear-gradient(180deg,rgba(237,233,226,.11) 0%,rgba(237,233,226,.05) 44%,rgba(237,233,226,.03) 100%)',
          backdropFilter: 'blur(22px) saturate(120%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,252,244,.22),inset 0 0 0 1px rgba(237,233,226,.09),0 18px 40px -24px rgba(0,0,0,.9)',
        }}
      >
        <Eyebrow tone={C.brass}>{COPY.rooms.familyWaiting}</Eyebrow>
        <p style={{ margin: '11px 0 0', fontFamily: F.body, fontSize: 14.5, lineHeight: 1.66, color: C.inkWarm }}>
          {COPY.letter.emailQuote}
        </p>
        <div style={{ paddingTop: 9, fontFamily: F.body, fontSize: 12.5, color: 'rgba(242,227,196,.6)' }}>
          Ines · read it once before it shines
        </div>
        {waiting === 'pending' ? (
          <div style={{ display: 'flex', gap: 20, paddingTop: 16 }}>
            <span
              onClick={() => setWaiting('shine')}
              style={{ fontFamily: F.body, fontSize: 14, color: C.brass, cursor: 'pointer' }}
            >
              {COPY.rooms.familyShine}
            </span>
            <span
              onClick={() => setWaiting('keep')}
              style={{ fontFamily: F.body, fontSize: 14, color: C.inkQuiet, cursor: 'pointer' }}
            >
              {COPY.rooms.familyKeep}
            </span>
          </div>
        ) : (
          <div
            style={{
              paddingTop: 16,
              fontFamily: F.body,
              fontSize: 14,
              color: waiting === 'shine' ? C.brass : 'rgba(242,227,196,.6)',
            }}
          >
            {waiting === 'shine' ? FAMILY_SHINE_CONFIRM : FAMILY_KEEP_CONFIRM}
          </div>
        )}
      </div>
    </RoomBody>
  </>
  );
};

/* ------------------------------------------------------------------ *
 * Your account. Nothing from setting up is frozen.
 * ------------------------------------------------------------------ */

/* the rows, consolidated: 'Your links' and 'What shows' merge into one row
   per the artist's note that the list could be tightened. Born keeps its own
   row, since its view says something different from the others (nothing
   editable there, honestly) rather than being folded into anything. */
const AccountRow: React.FC<{ label: string; value: string; onOpen: () => void }> = ({ label, value, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      width: '100%',
      textAlign: 'left',
      background: 'none',
      border: 0,
      borderBottom: `1px solid ${C.hair}`,
      padding: '15px 0',
      cursor: 'pointer',
    }}
  >
    <div style={{ minWidth: 0 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ paddingTop: 6, fontFamily: F.body, fontSize: 15, color: C.ink }}>{value}</div>
    </div>
    <span style={{ fontFamily: F.body, fontSize: 15, color: C.inkQuiet, flex: 'none' }}>›</span>
  </button>
);

/**
 * One row's edit view: a Field-style input prefilled with the row's current
 * value, and a Keep-it commit that lands into the room's own local demo
 * state (there is nothing to save to; the point is that pressing it does
 * something real within the screen). The same suppressed-chrome mechanic as
 * a reading carries this view's Back, so it renders none of its own.
 */
const AccountFieldEdit: React.FC<{
  label: string;
  value: string;
  hint?: string;
  keptNote: string;
  onCommit: (next: string) => void;
}> = ({ label, value, hint, keptNote, onCommit }) => {
  const [draft, setDraft] = useState(value);
  const [kept, setKept] = useState(false);
  return (
    <RoomBody top={16}>
      <div style={{ padding: '0 0 13px' }}>
        <Field
          label={label}
          value={draft}
          hint={hint}
          onChange={v => {
            setKept(false);
            setDraft(v);
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 8 }}>
          {kept ? <Note>{keptNote}</Note> : <span />}
          <TLink
            onClick={() => {
              onCommit(draft);
              setKept(true);
            }}
          >
            {ACCOUNT_KEEP_ACTION}
          </TLink>
        </div>
      </div>
    </RoomBody>
  );
};

type AccountView = 'name' | 'email' | 'password' | 'location' | 'showsLinks' | 'born' | null;

const AccountRoom: React.FC<{ onClose?: () => void; onChrome?: OnChrome }> = ({ onClose, onChrome }) => {
  const [name, setName] = useState('Adrian Rasmussen');
  const [email, setEmail] = useState('adrian@somewhere');
  const [passwordNote, setPasswordNote] = useState('Changed in April');
  const [location, setLocation] = useState('Sonoma County · shown as city');
  const [view, setView] = useState<AccountView>(null);

  useEffect(() => {
    onChrome?.(view ? { backLabel: ACCOUNT_BACK, onBack: () => setView(null) } : null);
  }, [view, onChrome]);

  return (
    <>
      <div style={{ flex: 'none', paddingTop: 11 }}>
        <Note>{COPY.rooms.accountNote}</Note>
      </div>
      {view === null && (
        <RoomBody top={18}>
          <AccountRow label="Name" value={name} onOpen={() => setView('name')} />
          <AccountRow label="Email" value={email} onOpen={() => setView('email')} />
          <AccountRow label="Password" value={passwordNote} onOpen={() => setView('password')} />
          <AccountRow label={ACCOUNT_LIVES_LABEL} value={location} onOpen={() => setView('location')} />
          <AccountRow
            label={ACCOUNT_SHOWS_LINKS_ROW}
            value="Four choices open, one closed · website and Instagram shown"
            onOpen={() => setView('showsLinks')}
          />
          {/* birth details are shown to nobody, ever. The row states itself
              and there is no switch on it. */}
          <AccountRow label="Born" value="Held, shown to nobody" onOpen={() => setView('born')} />
          <Note top={20}>{COPY.rooms.accountFoot}</Note>
          <div style={{ paddingTop: 18 }}>
            <button
              type="button"
              onClick={() => onClose?.()}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                fontFamily: F.body,
                fontSize: 14,
                color: C.inkQuiet,
                cursor: 'pointer',
              }}
            >
              {COPY.rooms.accountSignOut}
            </button>
          </div>
        </RoomBody>
      )}
      {view === 'name' && (
        <AccountFieldEdit label="Name" value={name} keptNote={ACCOUNT_KEPT_GENERIC} onCommit={setName} />
      )}
      {view === 'email' && (
        <AccountFieldEdit label="Email" value={email} keptNote={ACCOUNT_KEPT_GENERIC} onCommit={setEmail} />
      )}
      {view === 'password' && (
        <AccountFieldEdit
          label={ACCOUNT_NEW_PASSWORD_LABEL}
          value=""
          hint={COPY.gathering.hintPassword}
          keptNote={ACCOUNT_KEPT_GENERIC}
          onCommit={next => setPasswordNote(next ? ACCOUNT_PASSWORD_CHANGED : passwordNote)}
        />
      )}
      {view === 'location' && (
        <AccountFieldEdit label={ACCOUNT_LIVES_LABEL} value={location} keptNote={ACCOUNT_KEPT} onCommit={setLocation} />
      )}
      {view === 'showsLinks' && (
        <RoomBody top={16}>
          <Note>{ACCOUNT_SHOWS_LINKS_NOTE}</Note>
          <Ledger label={ACCOUNT_SHOWS_ROW} value="Four choices open, one closed" />
          <Ledger label="Your links" value="Website and Instagram shown" />
        </RoomBody>
      )}
      {view === 'born' && (
        <RoomBody top={16}>
          <div style={{ padding: '0 0 15px' }}>
            <Eyebrow>Born</Eyebrow>
            <div style={{ paddingTop: 6, fontFamily: F.body, fontSize: 15, color: C.ink }}>Held, shown to nobody</div>
          </div>
          <Note>{COPY.gathering.showBirthNote}</Note>
        </RoomBody>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * The wired rooms. Same surfaces, real registry data via api.ts (fetched
 * upstream in wired.tsx — no room touches the network itself). Every
 * network state renders quietly: an absence is an absence, a failure is a
 * plain line with the one locked retry word, never an error wall.
 * ------------------------------------------------------------------ */

const LiveStoryRoom: React.FC<{ live: PieceLive }> = ({ live }) => {
  const certificate = live.certificate.status === 'ready' ? live.certificate.data : null;
  const paragraphs = live.story?.paragraphs?.length
    ? live.story.paragraphs
    : [certificate?.openingWording, certificate?.certificateWording].filter(
        (line): line is string => Boolean(line),
      );
  return (
    <RoomBody top={22}>
      {live.story?.lead && (
        <p style={{ margin: 0, fontFamily: F.display, fontWeight: 300, fontSize: 24, lineHeight: 1.4, color: C.ink }}>
          {live.story.lead}
        </p>
      )}
      {paragraphs.map((text, i) => (
        <Body key={i} top={i === 0 && !live.story?.lead ? 4 : 16}>{text}</Body>
      ))}
      {/* the commissioner's paragraph, when the record carries one.
          TODO(server): nothing supplies story.commissioned yet — it is a
          future field on the catalog/registry record (live.ts), rendered
          here the day a wire fills it. Real content, so no sample label and
          no Flag: it is never a placeholder once it exists. */}
      {live.story?.commissioned && <CommissionerQuote text={live.story.commissioned} />}
    </RoomBody>
  );
};

/** year and month straight off an ISO instant; either half absent is absent */
const isoDateParts = (iso: string): { year: string | null; month: string | null } => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { year: null, month: null };
  return {
    year: String(at.getFullYear()),
    month: at.toLocaleDateString('en-GB', { month: 'long' }),
  };
};

/** day, month word, year — the LettersRoom idiom, reused for the household's
 *  invited-sent date. Null on a date that fails to parse. */
const formatFullDate = (iso: string): string | null => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const LiveHistoryRoom: React.FC<{ live: PieceLive; onChrome?: OnChrome }> = ({ live, onChrome }) => {
  const [tab, setTab] = useState(0);
  const [reading, setReading] = useState<Reading | null>(null);
  useEffect(() => {
    onChrome?.(reading ? { backLabel: HISTORY_BACK, onBack: () => setReading(null) } : null);
  }, [reading, onChrome]);
  const { lineage } = live;
  const outcome = lineage.status === 'ready' ? lineage.data : null;
  /* the dark lineage is the quiet absence the design prescribes: the note
     stands alone and nothing reads as an error */
  const events = outcome && outcome.kind === 'ok' ? outcome.events : [];

  /* what was written, from live data that already exists. The shining public
     dream is readable by anyone and opens for anyone; the caretaker's own
     standing words that do NOT shine come from the garden's dream state,
     which only ever reaches the caretaker's hands — so a guest never meets
     a kept entry at all, clickable or otherwise. */
  const shining = live.dream.status === 'ready' ? live.dream.data : null;
  const gardenDreams =
    live.garden && live.garden.dreams.status === 'ready' ? live.garden.dreams.data : null;
  const kept =
    gardenDreams?.current && gardenDreams.current.visibility === 'private' && gardenDreams.current.body
      ? gardenDreams.current
      : null;
  const keptSealed = kept?.tier === 'seal';

  return (
    <>
      <div style={{ flex: 'none', paddingTop: 10 }}>
        <Note>{COPY.rooms.historyNote}</Note>
      </div>
      {reading ? (
        <ReadingView reading={reading} />
      ) : (
        <>
          <div style={{ flex: 'none', paddingTop: 18 }}>
            <SegmentedTabs options={[HISTORY_TAB_MOVED, HISTORY_TAB_WRITTEN]} active={tab} onChange={setTab} />
          </div>
          <RoomBody top={24}>
            {tab === 0 && (
              <>
                {events.map((event) => {
                  const { year, month } = isoDateParts(event.eventAt);
                  return (
                    <HistoryEntry
                      key={event.eventHash}
                      year={year}
                      month={month}
                      text={formatLineageEventLabel(event.eventType)}
                    />
                  );
                })}
                {lineage.status === 'failed' && (
                  <div style={{ paddingTop: 6 }}>
                    <TLink onClick={lineage.retry}>{COPY.code.tryAgain}</TLink>
                  </div>
                )}
              </>
            )}
            {tab === 1 && (
              <>
                {/* the public dream carries no date on this wire, and the
                    entry says nothing rather than inventing one */}
                {shining && (
                  <HistoryEntry
                    year={null}
                    month={null}
                    text={WRITTEN_SHINES_TEXT}
                    note={
                      shining.attribution
                        ? `${WRITTEN_SHINES_WORD} · ${shining.attribution}`
                        : WRITTEN_SHINES_NOTE
                    }
                    onOpen={() =>
                      setReading({
                        eyebrow: shining.attribution
                          ? `${WRITTEN_SHINES_WORD} · ${shining.attribution}`
                          : WRITTEN_SHINES_NOTE,
                        paragraphs: [shining.body],
                      })
                    }
                  />
                )}
                {kept && (
                  /* only the caretaker holds this data, so only the caretaker
                     passes through */
                  <HistoryEntry
                    year={isoDateParts(kept.createdAt).year}
                    month={isoDateParts(kept.createdAt).month}
                    text={WRITTEN_KEPT_TEXT}
                    note={keptSealed ? WRITTEN_SEALED_NOTE : WRITTEN_KEPT_NOTE}
                    onOpen={() =>
                      setReading({
                        eyebrow: keptSealed ? WRITTEN_SEALED_NOTE : WRITTEN_KEPT_NOTE,
                        paragraphs: [kept.body],
                      })
                    }
                  />
                )}
                {live.dream.status === 'failed' && (
                  <div style={{ paddingTop: 6 }}>
                    <TLink onClick={live.dream.retry}>{COPY.code.tryAgain}</TLink>
                  </div>
                )}
              </>
            )}
          </RoomBody>
        </>
      )}
    </>
  );
};

/**
 * The wired dreams room. The wire carries one shared dream at most, with no
 * paragraph structure of its own — so the "opener" and the reading behind it
 * show the same real words; nothing is fabricated to make the portal deeper
 * than what actually exists. Pressing it still opens the same reading view
 * history and the demo dreams use, so the room behaves the same way whether
 * the words are real or sample.
 */
const LiveDreamsRoom: React.FC<{ live: PieceLive; onChrome?: OnChrome }> = ({ live, onChrome }) => {
  const dream = live.dream.status === 'ready' ? live.dream.data : null;
  const [reading, setReading] = useState<Reading | null>(null);
  useEffect(() => {
    onChrome?.(reading ? { backLabel: DREAMS_BACK, onBack: () => setReading(null) } : null);
  }, [reading, onChrome]);

  return (
    <>
      <div style={{ flex: 'none', paddingTop: 11 }}>
        <Note>{DREAMS_NOTE_WORKBOOK}</Note>
      </div>
      {reading ? (
        <ReadingView reading={reading} />
      ) : (
        <RoomBody top={24}>
          {dream && (
            <div style={{ padding: '0 0 26px' }}>
              <button
                type="button"
                onClick={() => setReading({ eyebrow: dream.attribution, paragraphs: [dream.body] })}
                className="collector-open-entry"
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              >
                <p
                  className="collector-open-entry-text"
                  style={{
                    margin: 0, fontFamily: F.display, fontWeight: 300, fontSize: 23,
                    lineHeight: 1.36, color: C.inkWarm, textWrap: 'pretty',
                  }}
                >
                  {dream.body}
                </p>
                <div style={{ paddingTop: 4, fontFamily: F.label, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.brass }}>
                  {READ_IT}
                </div>
              </button>
            </div>
          )}
          {live.dream.status === 'failed' && (
            <div style={{ paddingBottom: 16 }}>
              <TLink onClick={live.dream.retry}>{COPY.code.tryAgain}</TLink>
            </div>
          )}
          {dream && <Note>{COPY.rooms.dreamsFoot}</Note>}
        </RoomBody>
      )}
    </>
  );
};

/**
 * How the ledger's minor units become the room's amount. Kept deliberately
 * plain: the registry records minor units (cents), Intl renders the currency,
 * and a round amount drops its cents the way the demo's $14,000 does.
 */
const formatPaid = (entry: CurrentKeeperPriceEntry): string => {
  const major = entry.amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: entry.currency,
      maximumFractionDigits: entry.amountMinor % 100 === 0 ? 0 : 2,
    }).format(major);
  } catch {
    return `${major} ${entry.currency}`;
  }
};

/** the latest entry: the server orders known dates ascending with
 *  unknown-dated entries last, so the newest known date is the last known
 *  row; a ledger of only unknowns falls back to its final row */
const latestPaid = (entries: CurrentKeeperPriceEntry[]): CurrentKeeperPriceEntry | null => {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].occurrence.precision !== 'unknown') return entries[i];
  }
  return entries.length > 0 ? entries[entries.length - 1] : null;
};

/**
 * The merged live room. Everyone reads the public certificate content; the
 * caretaker (the only relationship whose live object carries priceHistory)
 * additionally sees where it lives and the masked paid line. The demo's
 * first-caretaker and shown-publicly rows have no wire yet, so here they are
 * honestly absent rather than staged.
 */
const LiveInformationRoom: React.FC<{ live: PieceLive }> = ({ live }) => {
  const { identity, certificate, ordinal, displayLocation, priceHistory } = live;
  const ready = certificate.status === 'ready' ? certificate.data : null;
  const publicNotes = Array.isArray(ready?.publicLedger)
    ? ready.publicLedger.filter(entry => entry && typeof entry.message === 'string' && entry.message.trim())
    : [];
  const caretaker = priceHistory !== null;
  const paid =
    priceHistory && priceHistory.status === 'ready' ? latestPaid(priceHistory.data) : null;
  return (
    <>
      {/* the caretaker's header note used to say "the full record. what was
          paid appears here and nowhere else" on a screen that IS that
          record, a few rows above the masked price itself — deleted per the
          artist. The guest's note stays: certNote tells a first-time guest
          what they are looking at and that price isn't part of it, which
          the page gives them nowhere else. */}
      {!caretaker && (
        <div style={{ flex: 'none', paddingTop: 10 }}>
          <Note>{COPY.rooms.certNote}</Note>
        </div>
      )}
      <RoomBody top={caretaker ? 20 : 16}>
        <div
          style={{
            position: 'relative', width: 240, height: 240, margin: '6px auto 22px',
            display: 'grid', placeItems: 'center', borderRadius: 2,
            boxShadow: `inset 0 0 0 1px ${C.hairStrong}`,
          }}
        >
          <Drawing motif="piece" size={120} />
        </div>
        {identity.series && <Ledger label="Series" value={identity.series} />}
        <Ledger label="Edition" value={identity.edition.label} />
        {ready?.yearWording && <Ledger label="Made" value={ready.yearWording} />}
        {ready?.materials && ready.materials.length > 0 && (
          <Ledger label="Material" value={ready.materials.join(', ')} />
        )}
        {ready?.origin && <Ledger label="Origin" value={ready.origin} />}
        {ready?.techniques && ready.techniques.length > 0 && (
          <Ledger label="Technique" value={ready.techniques.join(', ')} />
        )}
        {publicNotes.length > 0 && (
          <section aria-label="Creator notes" style={{ paddingTop: 18, paddingBottom: 8 }}>
            <Eyebrow>From the studio</Eyebrow>
            {publicNotes.map((entry, index) => (
              <p key={entry.id ?? index} style={{
                margin: '12px 0 0', fontFamily: F.body, fontSize: 15,
                lineHeight: 1.72, color: C.inkBody, whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}>
                {entry.message}
              </p>
            ))}
          </section>
        )}
        {ordinal !== null && <Ledger label="Registered" value={`Light ${ordinal}`} />}
        {caretaker && displayLocation && <Ledger label="Where it lives" value={displayLocation} />}
        {/* what was paid: caretaker only, latest entry, masked until pressed.
            An empty ledger is an absence, never an empty row. */}
        {paid && <PaidLedger amount={formatPaid(paid)} />}
        {priceHistory && priceHistory.status === 'failed' && (
          <div style={{ paddingTop: 16 }}>
            <TLink onClick={priceHistory.retry}>{COPY.code.tryAgain}</TLink>
          </div>
        )}
        {certificate.status === 'failed' && (
          <div style={{ paddingTop: 16 }}>
            <TLink onClick={certificate.retry}>{COPY.code.tryAgain}</TLink>
          </div>
        )}
        <Note top={18}>{caretaker ? COPY.rooms.infoFoot : COPY.rooms.certFoot}</Note>
      </RoomBody>
    </>
  );
};

/**
 * The wired household. Email and status only — the verified contributor wire
 * (utils/artworkContributors.ts) carries no name, relation, or words model,
 * so the rows carry exactly what is real and nothing invented. The waiting
 * shine/keep pair from the demo does not render here at all: no approval data
 * model exists in the wired era, and an honest absence beats a staged card.
 */
const LiveFamilyRoom: React.FC<{ live: PieceLive; onWalk?: (key: string) => void }> = ({ live, onWalk }) => {
  const family = live.family;
  const people = family?.people;
  return (
    <>
      <div style={{ flex: 'none', paddingTop: 10 }}>
        <Note>{COPY.rooms.familyNote}</Note>
        {/* §6, verbatim, on the household's own room */}
        <Note top={6}>{COPY.rooms.familyPromise}</Note>
      </div>
      <RoomBody top={18}>
        {people?.status === 'ready' &&
          people.data.map(person => (
            <button
              key={person.kind === 'contributor' ? person.accessId : person.invitationId}
              type="button"
              onClick={() => family?.open(person)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 0,
                borderBottom: `1px solid ${C.hair}`,
                padding: '15px 0',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 }}>
                <span style={{ fontFamily: F.body, fontSize: 16, color: C.ink, minWidth: 0, overflowWrap: 'anywhere' }}>
                  {person.email}
                </span>
                <Eyebrow>{person.kind === 'contributor' ? FAMILY_ON_PIECE : FAMILY_INVITED}</Eyebrow>
              </span>
              {person.kind === 'invited' && (
                <span style={{ display: 'block', paddingTop: 5, fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet }}>
                  {/* the invitation entry (utils/artworkContributors.ts
                      ContributorInvitation, threaded through as
                      FamilyPerson in live.ts) carries invitedAt but no
                      expiresAt, so this renders when it was sent and
                      nothing about when it expires — that half isn't real
                      data here yet. Falls back to the generic locked line
                      only if the date fails to parse. */}
                  {formatFullDate(person.invitedAt)
                    ? `${FAMILY_SENT_WORD} ${formatFullDate(person.invitedAt)}`
                    : COPY.people.sentBody}
                </span>
              )}
            </button>
          ))}
        {people?.status === 'failed' && (
          <div style={{ paddingTop: 6 }}>
            <TLink onClick={people.retry}>{COPY.code.tryAgain}</TLink>
          </div>
        )}

        <button
          type="button"
          onClick={() => onWalk?.('invite')}
          style={{
            display: 'flex', alignItems: 'center', gap: 13, width: '100%',
            background: 'none', border: 0, padding: '20px 0 0', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Plus />
          <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{COPY.rooms.familyInvite}</span>
        </button>
      </RoomBody>
    </>
  );
};

/**
 * The wired account room. The one editable thing today is where the art
 * lives (presentation state, PUT through api.ts); everything else reads, and
 * the rows that have a real surface elsewhere link out to it: What shows
 * opens the lamps screen, Letters opens the letters room in place.
 */
const LiveAccountRoom: React.FC<{
  live: PieceLive;
  onWalk?: (key: string) => void;
  onOpenRoom?: (room: RoomKey) => void;
}> = ({ live, onWalk, onOpenRoom }) => {
  const [location, setLocation] = useState(live.displayLocation ?? '');
  const [kept, setKept] = useState(false);
  const save = live.setDisplayLocation;

  const keep = () => {
    if (!save) return;
    void save(location.trim()).then(landed => setKept(landed));
  };

  return (
    <>
      <div style={{ flex: 'none', paddingTop: 11 }}>
        <Note>{COPY.rooms.accountNote}</Note>
      </div>
      <RoomBody top={18}>
        {live.accountEmail && (
          <div style={{ borderBottom: `1px solid ${C.hair}`, padding: '15px 0' }}>
            <Eyebrow>Email</Eyebrow>
            <div style={{ paddingTop: 6, fontFamily: F.body, fontSize: 15, color: C.ink }}>
              {live.accountEmail}
            </div>
          </div>
        )}

        {save && (
          <div style={{ borderBottom: `1px solid ${C.hair}`, padding: '15px 0 13px' }}>
            <Field
              label={ACCOUNT_LIVES_LABEL}
              value={location}
              hint={COPY.gathering.hintCity}
              onChange={value => {
                setKept(false);
                setLocation(value);
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 8 }}>
              {kept ? <Note>{ACCOUNT_KEPT}</Note> : <span />}
              <TLink onClick={keep}>{ACCOUNT_KEEP_ACTION}</TLink>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onWalk?.('shows')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            width: '100%', textAlign: 'left', background: 'none', border: 0,
            borderBottom: `1px solid ${C.hair}`, padding: '15px 0', cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{ACCOUNT_SHOWS_ROW}</span>
          <span style={{ fontFamily: F.body, fontSize: 15, color: C.inkQuiet, flex: 'none' }}>›</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenRoom?.('letters')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            width: '100%', textAlign: 'left', background: 'none', border: 0,
            borderBottom: `1px solid ${C.hair}`, padding: '15px 0', cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{ACCOUNT_LETTERS_ROW}</span>
          <span style={{ fontFamily: F.body, fontSize: 15, color: C.inkQuiet, flex: 'none' }}>›</span>
        </button>

        <Note top={20}>{COPY.rooms.accountFoot}</Note>
      </RoomBody>
    </>
  );
};

/* ------------------------------------------------------------------ *
 * Letters: what the piece has written, read-only. Generated by the
 * backend on lineage events; this room only reads.
 * ------------------------------------------------------------------ */

export const LettersRoom: React.FC<{ live?: PieceLive }> = ({ live }) => {
  const letters = live?.letters ?? null;
  const rows = letters?.status === 'ready' ? letters.data : [];
  return (
    <RoomBody top={18}>
      {rows.map(letter => (
        <div key={letter.id} style={{ paddingBottom: 18 }}>
          <Ledger
            label={LETTER_KIND_WORD[letter.kind] ?? letter.kind}
            value={new Date(letter.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
          <p style={{
            margin: '10px 0 0',
            fontFamily: F.body,
            fontSize: 15,
            lineHeight: 1.72,
            color: C.inkBody,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}>
            {letter.body}
          </p>
        </div>
      ))}
      {letters?.status === 'failed' && (
        <div style={{ paddingTop: 6 }}>
          <TLink onClick={letters.retry}>{COPY.code.tryAgain}</TLink>
        </div>
      )}
      {(!letters || (letters.status === 'ready' && rows.length === 0)) && (
        <Note top={4}>{LETTERS_EMPTY}</Note>
      )}
    </RoomBody>
  );
};

/* ------------------------------------------------------------------ *
 * The Resonant Grid.
 * ------------------------------------------------------------------ */

const GridRoom: React.FC = () => (
  <>
    <div style={{ flex: 'none', paddingTop: 11 }}>
      <Note>{COPY.rooms.gridNote}</Note>
    </div>
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <ResonantGrid />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 26 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: C.brass,
            boxShadow: '0 0 10px 3px rgba(212,184,138,.5)',
            flex: 'none',
            display: 'block',
          }}
        />
        <span style={{ fontFamily: F.body, fontSize: 14, color: C.inkWarm }}>{COPY.rooms.gridName}</span>
      </div>
      <Note top={12}>{COPY.rooms.gridFoot}</Note>
    </div>
  </>
);
