/**
 * The piece page. One page, one address, four relationships.
 *
 * ONE BODY, and a foot that reads relationship. Not four pages. The drawing,
 * the name and the dream sit at identical positions in all four, which is what
 * makes it one page rather than four that resemble each other.
 *
 * The four relationships, per the wording record §6:
 *   unclaimed  — a lit Begin, the only bright thing on an otherwise quiet page
 *   registered — two peer doors, neither above the other
 *   signedin   — signed in, but not theirs. An account is not a claim.
 *   yours      — no pill, no doors, nothing left to claim
 *
 * And a fifth that is not a relationship but a moment: `loading`, one API round
 * trip while the page works out who is holding the phone. The foot is simply
 * absent until it knows. A lit Begin on a piece someone already holds is the
 * worst wrong frame in the flow.
 *
 * Rows open in place. The one link travels, and it is a link rather than a row
 * for exactly that reason.
 */

import React, { useState } from 'react';
import { C, F } from './tokens';
import { COPY, PIECE } from './copy';
import { Brass, Eyebrow, Flag, Ground, Row, TLink } from './ui';
import { Drawing } from './drawings';
import { Orbit } from './Orbit';
import { Room, RoomKey } from './rooms';

export type Relationship = 'loading' | 'unclaimed' | 'registered' | 'signedin' | 'yours';

type Props = {
  relationship: Relationship;
  /** everything ever placed in the piece. Drives the orbit, nothing else. */
  placed?: number;
  /** the near light, 0 to 1: how lately it has been tended */
  near?: number;
  onBegin?: () => void;
  onSignIn?: () => void;
  onWalk?: (key: string) => void;
};

export const PiecePage: React.FC<Props> = ({
  relationship,
  placed = 7,
  near = 1,
  onBegin,
  onSignIn,
  onWalk,
}) => {
  const [room, setRoom] = useState<RoomKey | null>(null);

  const isCaretaker = relationship === 'yours';
  const registered = relationship !== 'unclaimed' && relationship !== 'loading';

  /* a room opens in place: the body gives way, the room becomes the surface,
     and closing returns to the page. Nothing navigates. */
  if (room) {
    return <Room room={room} onClose={() => setRoom(null)} onWalk={onWalk} />;
  }

  return (
    <Ground light={relationship === 'yours' ? 'l' : 'a'} pad="40px 28px 26px">
      {/* the head. Identical in all four. */}
      <div
        style={{
          position: 'relative',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          paddingBottom: 13,
          borderBottom: `1px solid ${C.hairStrong}`,
        }}
      >
        <Drawing motif="piece" size={40} lit draw label={`${PIECE.name}, line drawing`} />
        <div style={{ minWidth: 0 }}>
          <div>
            <Eyebrow size={10.5}>{PIECE.series}</Eyebrow>
          </div>
          <div
            style={{
              fontFamily: F.display,
              fontWeight: 300,
              fontSize: 23,
              lineHeight: 1.15,
              color: C.ink,
              marginTop: 2,
            }}
          >
            {PIECE.name}
          </div>
        </div>
      </div>

      {/* the authenticity line, visible to anyone */}
      <div style={{ flex: 'none', paddingTop: 8, fontFamily: F.body, fontSize: 11.5, color: C.inkQuiet }}>
        {registered ? COPY.page.statusRegistered : COPY.page.statusUnclaimed}
      </div>

      {/* the dream: the first thing any guest reads. Placing it IS the choice
          to show it, so there is no switch for it anywhere. Words only; who
          wrote them does not show. */}
      {registered && (
        <blockquote style={{ margin: 0, flex: 'none', paddingTop: 20 }}>
          <p
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 300,
              fontSize: 26,
              lineHeight: 1.26,
              letterSpacing: '-.015em',
              color: C.ink,
              textWrap: 'pretty',
              textShadow: '0 0 24px rgba(212,184,138,.2)',
            }}
          >
            <Flag text={COPY.page.dreamSample} />
          </p>
          <cite style={{ display: 'block', marginTop: 12, fontStyle: 'normal' }}>
            <Eyebrow size={10}>{COPY.page.dreamCite}</Eyebrow>
          </cite>
        </blockquote>
      )}

      {/* the open centre. The light lives here on a registered piece; on an
          unclaimed one the drawing stands in its place, at the same size, so
          the page reads whole rather than empty.

          It keeps a fixed height on the caretaker's page: nine rows plus the
          dream cannot fit under a light that also grows, and the light is the
          thing that must not move. */}
      <div
        style={{
          position: 'relative',
          flex: isCaretaker ? 'none' : '1 1 auto',
          height: isCaretaker ? 186 : undefined,
          minHeight: isCaretaker ? undefined : 190,
          overflow: 'hidden',
        }}
      >
        {registered ? (
          <Orbit placed={placed} near={near} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Drawing motif="piece" size={128} draw />
          </div>
        )}
      </div>

      {/* the rows. The public four are on every relationship; the caretaker's
          five exist ONLY when the piece is theirs, and are never greyed,
          hinted at, or shown as locked.

          On the caretaker's page the ROWS scroll, not the page: the head, the
          dream and the light hold their positions and the list moves under
          them. The no-scroll law is a law about setup screens, and this is the
          one surface a person returns to for years. */}
      <div
        className={isCaretaker ? 'collector-scroll' : undefined}
        style={
          isCaretaker
            ? { position: 'relative', flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }
            : { position: 'relative', flex: 'none' }
        }
      >
        <Row label={COPY.page.rowStory} onClick={() => setRoom('story')} />
        <Row label={COPY.page.rowCertificate} onClick={() => setRoom('certificate')} />
        <Row label={COPY.page.rowHistory} onClick={() => setRoom('history')} />
        <Row label={COPY.page.rowDreams} onClick={() => setRoom('dreams')} last={!isCaretaker} />

        {isCaretaker && (
          <>
            <Row label={COPY.page.rowGarden} warm onClick={() => setRoom('garden')} />
            <Row label={COPY.page.rowInformation} onClick={() => setRoom('information')} />
            <Row label={COPY.page.rowFamily} onClick={() => setRoom('family')} />
            <Row label={COPY.page.rowPassing} onClick={() => onWalk?.('passfork')} />
            <Row label={COPY.page.rowAccount} onClick={() => setRoom('account')} last />
          </>
        )}

        {/* a link, not a row, because rows open in place and links travel */}
        <div style={{ paddingTop: 17 }}>
          <a
            href="/"
            style={{ fontFamily: F.body, fontSize: 14, color: C.inkQuiet, textDecoration: 'none' }}
          >
            {COPY.page.siteLink}
          </a>
        </div>
      </div>

      {/* the foot: the only part that differs across the four */}
      <Foot relationship={relationship} onBegin={onBegin} onSignIn={onSignIn} />
    </Ground>
  );
};

/**
 * The foot, and it is the whole of what a relationship changes.
 *
 * Held while the page works out who is holding the phone: absent, and the page
 * is otherwise whole. Never a spinner and never a guess.
 */
const Foot: React.FC<{ relationship: Relationship; onBegin?: () => void; onSignIn?: () => void }> = ({
  relationship,
  onBegin,
  onSignIn,
}) => {
  if (relationship === 'loading') {
    return (
      <div style={{ position: 'relative', flex: 'none', borderTop: `1px solid ${C.hair}`, height: 96, marginTop: 18 }} />
    );
  }

  /* nothing left to claim, and nothing to sign into */
  if (relationship === 'yours') {
    return <div style={{ position: 'relative', flex: 'none', height: 18 }} />;
  }

  /* unclaimed: a lit Begin, the only bright thing on the page. No sign-in link,
     because nobody has an account for an unregistered piece. */
  if (relationship === 'unclaimed') {
    return (
      <div style={{ position: 'relative', flex: 'none', paddingTop: 22, display: 'flex', justifyContent: 'center' }}>
        <Brass full lifted onClick={onBegin}>
          {COPY.page.begin}
        </Brass>
      </div>
    );
  }

  /* registered: two peers at the foot, equal weight, differing only in what
     they say. This is the one screen in the flow with two peer actions, and it
     is bent here and nowhere else, because it is the only screen where the
     system genuinely does not know who is holding the phone. */
  return (
    <div
      style={{
        position: 'relative',
        flex: 'none',
        paddingTop: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <TLink tone={C.inkBody} onClick={onBegin}>
        {relationship === 'signedin' ? COPY.page.doorHold : COPY.page.doorLook}
      </TLink>
      <span style={{ width: 1, height: 16, background: C.hairStrong, display: 'block' }} />
      <TLink tone={C.inkBody} onClick={relationship === 'signedin' ? onBegin : onSignIn}>
        {relationship === 'signedin' ? COPY.page.doorLook : COPY.page.doorTend}
      </TLink>
    </div>
  );
};
