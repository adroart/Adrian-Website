/**
 * The rooms behind the rows.
 *
 * Each opens in place from the piece page, with the same motion the public rows
 * use: one motion vocabulary everywhere. Closing returns to the page. Nothing
 * here navigates.
 *
 * The split that keeps the privacy model honest:
 *   the certificate shows materials and making to everyone;
 *   what was paid lives in Piece information, which is caretaker-only;
 *   birth details are shown to nobody, ever, on either surface;
 *   the provenance chain is public.
 */

import React, { useState } from 'react';
import { C, F } from './tokens';
import { COPY, PIECE } from './copy';
import { Body, Brass, Eyebrow, Ground, Ledger, Note, Plus, RoomBody, RoomHead } from './ui';
import { Drawing } from './drawings';
import { ResonantGrid } from './ResonantGrid';
import { Garden } from './garden';

export type RoomKey =
  | 'story'
  | 'certificate'
  | 'history'
  | 'dreams'
  | 'information'
  | 'garden'
  | 'family'
  | 'account'
  | 'grid';

const TITLES: Record<RoomKey, string> = {
  story: COPY.page.rowStory,
  certificate: COPY.page.rowCertificate,
  history: COPY.page.rowHistory,
  dreams: COPY.page.rowDreams,
  information: COPY.page.rowInformation,
  garden: COPY.garden.title,
  family: COPY.page.rowFamily,
  account: COPY.page.rowAccount,
  grid: 'The Resonant Grid',
};

const LIGHT: Record<RoomKey, string> = {
  story: 'a',
  certificate: 'b',
  history: 'n',
  dreams: 'i',
  information: 'i',
  garden: 'j',
  family: 'l',
  account: 'm',
  grid: 'n',
};

type Props = { room: RoomKey; onClose: () => void; onWalk?: (key: string) => void };

export const Room: React.FC<Props> = ({ room, onClose, onWalk }) => {
  /* the garden brings its own ground: its first surface is the piece asking a
     single thing full screen, which has no room header to sit under */
  if (room === 'garden') return <Garden onWalk={onWalk} onClose={onClose} />;

  /* rooms that end in a list, rather than in something to close, carry their
     own way out and take no brass */
  const listRoom = room === 'family' || room === 'account';

  return (
    <Ground light={LIGHT[room] as never} pad="44px 30px 30px">
      <RoomHead title={TITLES[room]} onBack={onClose} />
      {room === 'story' && <StoryRoom />}
      {room === 'certificate' && <CertificateRoom />}
      {room === 'history' && <HistoryRoom />}
      {room === 'dreams' && <DreamsRoom />}
      {room === 'information' && <InformationRoom />}
      {room === 'family' && <FamilyRoom onWalk={onWalk} />}
      {room === 'account' && <AccountRoom />}
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
 * The story: the public row every guest reads, in Adrian's voice.
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
    <Note top={22}>{COPY.rooms.storyNote}</Note>
  </RoomBody>
);

/* ------------------------------------------------------------------ *
 * The certificate: authenticity, for anyone who scans it. What was paid
 * is not here, and the room says so plainly rather than hiding the gap.
 * ------------------------------------------------------------------ */

const CertificateRoom: React.FC = () => (
  <>
    <div style={{ flex: 'none', paddingTop: 11 }}>
      <Note>{COPY.rooms.certNote}</Note>
    </div>
    <RoomBody>
      <div style={{ display: 'grid', placeItems: 'center', height: 118, marginBottom: 18 }}>
        <Drawing motif="piece" size={92} lit draw />
      </div>
      <Ledger label="Series" value="Universal Language, 1 of 64" />
      <Ledger label="Made" value="2024" />
      <Ledger label="Material" value="Claro walnut, brass inlay" />
      <Ledger label="Dimensions" value="420 × 420 × 90 mm" />
      <Ledger label="Finish" value="Hard wax oil, hand rubbed" />
      <Ledger label="Registered" value={`Light ${PIECE.ordinal}`} />
      <Note top={18}>{COPY.rooms.certFoot}</Note>
    </RoomBody>
  </>
);

/* ------------------------------------------------------------------ *
 * The history: the public spine, and what was written into it. Names
 * appear only where a caretaker chose to be seen.
 * ------------------------------------------------------------------ */

const MOVED = [
  ['2024', 'Made in the workshop', 'Sonoma County'],
  ['2024', 'Registered by its first caretaker', 'named by choice'],
  ['2025', 'The plate was replaced', 'the record is the same record'],
  ['2026', 'Still held', 'Sonoma County'],
];

const WRITTEN = [
  ['2024', 'A dream was placed in it', 'shining · words with no name'],
  ['2025', 'Someone in the house wrote into it', 'kept with the piece'],
  ['2026', 'The dream was placed again', 'shining · words with no name'],
];

const HistoryRoom: React.FC = () => {
  const [tab, setTab] = useState<0 | 1>(0);
  const entries = tab === 0 ? MOVED : WRITTEN;
  return (
    <>
      <div style={{ flex: 'none', paddingTop: 10 }}>
        <Note>{COPY.rooms.historyNote}</Note>
      </div>
      <div style={{ flex: 'none', paddingTop: 18 }}>
        <div
          style={{
            display: 'flex',
            padding: 4,
            borderRadius: 999,
            background: 'rgba(52,43,34,.34)',
            backdropFilter: 'blur(30px) saturate(140%)',
            boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.06)',
          }}
        >
          {['How it moved', 'What was written'].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(i as 0 | 1)}
              style={{
                flex: 1,
                border: 0,
                borderRadius: 999,
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: F.label,
                fontSize: 10,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                background: i === tab ? 'rgba(212,170,110,.13)' : 'none',
                boxShadow: i === tab ? 'inset 0 .5px 0 rgba(255,244,220,.18),inset 0 0 0 1px rgba(226,190,134,.11)' : undefined,
                color: i === tab ? C.inkBrass : '#a1968a',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <RoomBody top={24}>
        {entries.map(([year, text, note], i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 16, paddingBottom: 26 }}>
            <div style={{ paddingTop: 4 }}>
              <Eyebrow>{year}</Eyebrow>
            </div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
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
              <div style={{ paddingTop: 4, fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet }}>{note}</div>
            </div>
          </div>
        ))}
      </RoomBody>
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
 * Piece information: caretaker-only, and the one place price appears.
 * ------------------------------------------------------------------ */

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
      <Ledger label="What was paid" value="$14,000" warm />
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
