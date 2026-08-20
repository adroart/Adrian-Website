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

import React, { useState } from 'react';
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
   holds for a person, so the rows say exactly that and nothing warmer */
const FAMILY_ON_PIECE = ph('On the piece');
const FAMILY_INVITED = ph('Invited');

/* the account room's rows and its one kept line */
const ACCOUNT_KEPT = ph('Kept. The light moves with you.');
const ACCOUNT_KEEP_ACTION = ph('Keep it');
const ACCOUNT_SHOWS_ROW = ph('What shows');
const ACCOUNT_LETTERS_ROW = ph('Letters');
const ACCOUNT_LIVES_LABEL = ph('Where the art lives');

/* the letters room: the record's own empty line (§5 "the piece page after
   registration": empty sections carry one quiet line), and a plain word per
   letter kind. None of these is Adrian's yet. */
const LETTERS_EMPTY = ph('Nothing written yet.');

/* the story's second voice: the commissioner's paragraph. The label and the
   demo paragraph are both samples — the wire that carries a real
   commissioner's words does not exist yet (live.ts story.commissioned). */
const STORY_COMMISSIONED_LABEL = ph('From the one who asked for it');
const STORY_COMMISSIONED_SAMPLE = ph(
  'Sample, a commissioner might write: I asked for this piece the year the family workshop was sold, so that one made thing would still hold the smell of that room.',
);

/* the history room: the two tab words were inline in the old tab strip, and
   the rest are the written items' honest lines */
const HISTORY_TAB_MOVED = ph('How it moved');
const HISTORY_TAB_WRITTEN = ph('What was written');
const HISTORY_BACK = ph('Back to the history');
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

export const Room: React.FC<Props> = ({ room, onClose, onWalk, onOpenRoom, live }) => {
  /* the garden brings its own ground: its first surface is the piece asking a
     single thing full screen, which has no room header to sit under */
  if (room === 'garden') return <Garden onWalk={onWalk} onClose={onClose} live={live?.garden ?? undefined} />;

  /* rooms that end in a list, rather than in something to close, carry their
     own way out and take no brass */
  const listRoom = room === 'family' || room === 'account' || room === 'letters';

  return (
    <Ground light={LIGHT[room] as never} pad="44px 30px 30px">
      <RoomHead title={TITLES[room]} onBack={onClose} />
      {room === 'story' && (live ? <LiveStoryRoom live={live} /> : <StoryRoom />)}
      {room === 'history' && (live ? <LiveHistoryRoom live={live} /> : <HistoryRoom />)}
      {room === 'dreams' && (live ? <LiveDreamsRoom live={live} /> : <DreamsRoom />)}
      {room === 'information' && (live ? <LiveInformationRoom live={live} /> : <InformationRoom />)}
      {room === 'family' && (live ? <LiveFamilyRoom live={live} onWalk={onWalk} /> : <FamilyRoom onWalk={onWalk} />)}
      {room === 'account' && (live ? <LiveAccountRoom live={live} onWalk={onWalk} onOpenRoom={onOpenRoom} /> : <AccountRoom />)}
      {room === 'letters' && <LettersRoom live={live} />}
      {room === 'grid' && <GridRoom />}
      {!listRoom && (
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
    <div style={{ paddingTop: 26 }}>
      <Eyebrow>{STORY_COMMISSIONED_LABEL}</Eyebrow>
    </div>
    <Body top={10}>{STORY_COMMISSIONED_SAMPLE}</Body>
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
   is the press target; without, it is the same quiet line it always was. */
const HistoryEntry: React.FC<{
  year: string | null;
  month: string | null;
  text: string;
  note?: string | null;
  onOpen?: () => void;
}> = ({ year, month, text, note, onOpen }) => {
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
      <div style={{ fontFamily: F.body, fontSize: 15.5, lineHeight: 1.45, color: C.ink }}>{text}</div>
      {note && <div style={{ paddingTop: 4, fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet }}>{note}</div>}
    </>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 16, paddingBottom: 26 }}>
      <HistoryDate year={year} month={month} />
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
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

/* a written item opened: the words whole, in the dream-reading typography the
   garden's review page settled (F.display 300 at 23, the writer's line breaks
   kept). Rendered in the room itself; the quiet link returns to the spine. */
type HistoryReading = { eyebrow: string | null; body: string };

const HistoryReadingView: React.FC<{ reading: HistoryReading; onBack: () => void }> = ({ reading, onBack }) => (
  <RoomBody top={16}>
    <div>
      <TLink onClick={onBack}>{HISTORY_BACK}</TLink>
    </div>
    {reading.eyebrow && (
      <div style={{ paddingTop: 14 }}>
        <Eyebrow>{reading.eyebrow}</Eyebrow>
      </div>
    )}
    <p
      style={{
        margin: '14px 0 0',
        fontFamily: F.display,
        fontWeight: 300,
        fontSize: 23,
        lineHeight: 1.36,
        color: C.inkWarm,
        textWrap: 'pretty',
        whiteSpace: 'pre-wrap',
      }}
    >
      <Flag text={reading.body} />
    </p>
  </RoomBody>
);

const HistoryRoom: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [reading, setReading] = useState<HistoryReading | null>(null);
  return (
    <>
      <div style={{ flex: 'none', paddingTop: 10 }}>
        <Note>{COPY.rooms.historyNote}</Note>
      </div>
      {reading ? (
        <HistoryReadingView reading={reading} onBack={() => setReading(null)} />
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
                  onOpen={entry.body ? () => setReading({ eyebrow: entry.note, body: entry.body as string }) : undefined}
                />
              ))}
          </RoomBody>
        </>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * The dreams: what other caretakers let shine. Words with no name, each
 * with the city its light sits in. The most recent leads.
 * ------------------------------------------------------------------ */

const DREAMS: [string, string][] = [
  ['That this house stays a place people arrive at unannounced.', 'Sonoma County'],
  ['That my daughter reads the letter I have not written yet.', 'Lisbon'],
  ['That the workshop outlives me and someone else swears in it.', 'Bergen'],
  ['That we stop measuring the years by what went wrong in them.', 'Kyoto'],
];

const DreamsRoom: React.FC = () => (
  <>
    <div style={{ flex: 'none', paddingTop: 11 }}>
      <Note>{COPY.rooms.dreamsNote}</Note>
    </div>
    <RoomBody top={24}>
      {DREAMS.map(([text, city], i) => (
        <div key={city} style={{ padding: '0 0 26px' }}>
          <p
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 300,
              fontSize: i === 0 ? 23 : 21,
              lineHeight: 1.36,
              color: i === 0 ? C.inkWarm : C.ink,
              textWrap: 'pretty',
            }}
          >
            {text}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 10 }}>
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
            <Eyebrow>{city}</Eyebrow>
          </div>
        </div>
      ))}
      <Note>{COPY.rooms.dreamsFoot}</Note>
    </RoomBody>
  </>
);

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
    <div style={{ flex: 'none', paddingTop: 10 }}>
      <Note>{COPY.rooms.infoNote}</Note>
    </div>
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

const FamilyRoom: React.FC<{ onWalk?: (key: string) => void }> = ({ onWalk }) => (
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
        <div style={{ display: 'flex', gap: 20, paddingTop: 16 }}>
          <span style={{ fontFamily: F.body, fontSize: 14, color: C.brass, cursor: 'pointer' }}>
            {COPY.rooms.familyShine}
          </span>
          <span style={{ fontFamily: F.body, fontSize: 14, color: C.inkQuiet, cursor: 'pointer' }}>
            {COPY.rooms.familyKeep}
          </span>
        </div>
      </div>
    </RoomBody>
  </>
);

/* ------------------------------------------------------------------ *
 * Your account. Nothing from setting up is frozen.
 * ------------------------------------------------------------------ */

const ACCOUNT: [string, string][] = [
  ['Name', 'Adrian Rasmussen'],
  ['Email', 'adrian@somewhere'],
  ['Password', 'Changed in April'],
  ['Where the art lives', 'Sonoma County · shown as city'],
  ['Your links', 'Website and Instagram shown'],
  ['What shows', 'Four choices open, one closed'],
  /* birth details are shown to nobody, ever. The row states itself and there
     is no switch on it. */
  ['Born', 'Held, shown to nobody'],
];

const AccountRoom: React.FC = () => (
  <>
    <div style={{ flex: 'none', paddingTop: 11 }}>
      <Note>{COPY.rooms.accountNote}</Note>
    </div>
    <RoomBody top={18}>
      {ACCOUNT.map(([label, value]) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
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
        </div>
      ))}
      <Note top={20}>{COPY.rooms.accountFoot}</Note>
      <div style={{ paddingTop: 18 }}>
        <span style={{ fontFamily: F.body, fontSize: 14, color: C.inkQuiet, cursor: 'pointer' }}>
          {COPY.rooms.accountSignOut}
        </span>
      </div>
    </RoomBody>
  </>
);

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
          here the day a wire fills it. */}
      {live.story?.commissioned && (
        <>
          <div style={{ paddingTop: 26 }}>
            <Eyebrow>{STORY_COMMISSIONED_LABEL}</Eyebrow>
          </div>
          <Body top={10}>{live.story.commissioned}</Body>
        </>
      )}
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

const LiveHistoryRoom: React.FC<{ live: PieceLive }> = ({ live }) => {
  const [tab, setTab] = useState(0);
  const [reading, setReading] = useState<HistoryReading | null>(null);
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
        <HistoryReadingView reading={reading} onBack={() => setReading(null)} />
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
                        body: shining.body,
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
                        body: kept.body,
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

const LiveDreamsRoom: React.FC<{ live: PieceLive }> = ({ live }) => {
  const dream = live.dream.status === 'ready' ? live.dream.data : null;
  return (
    <>
      <div style={{ flex: 'none', paddingTop: 11 }}>
        <Note>{COPY.rooms.dreamsNote}</Note>
      </div>
      <RoomBody top={24}>
        {dream && (
          <div style={{ padding: '0 0 26px' }}>
            <p
              style={{
                margin: 0, fontFamily: F.display, fontWeight: 300, fontSize: 23,
                lineHeight: 1.36, color: C.inkWarm, textWrap: 'pretty',
              }}
            >
              {dream.body}
            </p>
          </div>
        )}
        {live.dream.status === 'failed' && (
          <div style={{ paddingBottom: 16 }}>
            <TLink onClick={live.dream.retry}>{COPY.code.tryAgain}</TLink>
          </div>
        )}
        {dream && <Note>{COPY.rooms.dreamsFoot}</Note>}
      </RoomBody>
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
  const caretaker = priceHistory !== null;
  const paid =
    priceHistory && priceHistory.status === 'ready' ? latestPaid(priceHistory.data) : null;
  return (
    <>
      <div style={{ flex: 'none', paddingTop: 10 }}>
        {/* each viewer gets the locked line that is true for them: the guest's
            says the paid line is not here, the caretaker's says it is */}
        <Note>{caretaker ? COPY.rooms.infoNote : COPY.rooms.certNote}</Note>
      </div>
      <RoomBody>
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
                  {COPY.people.sentBody}
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

const LettersRoom: React.FC<{ live?: PieceLive }> = ({ live }) => {
  const letters = live?.letters ?? null;
  const rows = letters?.status === 'ready' ? letters.data : [];
  return (
    <RoomBody top={18}>
      {rows.map(letter => (
        <Ledger
          key={letter.id}
          label={LETTER_KIND_WORD[letter.kind] ?? letter.kind}
          value={new Date(letter.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
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
