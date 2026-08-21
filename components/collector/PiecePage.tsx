/**
 * The piece page. One page, one address, four relationships.
 *
 * ONE BODY, and a foot that reads relationship. Not four pages. The drawing,
 * the name and the dream sit at identical positions in all four, which is what
 * makes it one page rather than four that resemble each other.
 *
 * The four relationships, per the wording record §6:
 *   unclaimed  — a standard Begin, the only brass on an otherwise quiet page
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

import React, { useMemo, useState } from 'react';
import { C, F } from './tokens';
import { COPY, PIECE, PLACEHOLDERS } from './copy';
import { Brass, Eyebrow, Flag, Ground, Note, Row, TLink } from './ui';
import { Drawing } from './drawings';
import { Orbit } from './Orbit';
import { GlowDot } from './glowDot';
import { Room, RoomKey } from './rooms';
import type { PieceLive } from './live';
import { composeGround } from '../../utils/collectorGround';

export type Relationship = 'loading' | 'unclaimed' | 'registered' | 'signedin' | 'yours';

/**
 * Strings no copy.ts key exists for yet, or standing in for a rendering this
 * feedback pass removes. copy.ts is frozen this pass, so they live here,
 * registered as placeholders so none can reach Adrian disguised as finished
 * copy (the states.tsx / walk.tsx idiom). Adrian's feedback, 2026-08-20: the
 * quiet "Not yet registered" line moves off the top of the page and becomes
 * a prominent eyebrow at the Begin foot instead, and the standing note that
 * used to sit under Begin (COPY.page.unclaimedNote) is dropped.
 */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};
const UNCLAIMED_EYEBROW = ph('Unclaimed artwork');
const UNCLAIMED_FOOT_LINE = ph('Begin to claim it');

/**
 * The GROUND axis inputs (utils/collectorGround.ts). Everything arrives from
 * above as data — `now` is an ISO string handed in by the caller, and this
 * file NEVER reads the system clock, so demo renders are reproducible and
 * the wired page has exactly one notion of now per render.
 */
export type GroundInputs = {
  /** the piece's first binding, ISO; null renders a fully neutral ground */
  firstBoundAt: string | null;
  now: string;
  latitude: number | null;
  birthMonthIndex: number | null;
};

/** the demo shell's fixed ground: the sample piece, registered 9 April 2026,
 *  looked at on one fixed summer day. Never Date.now(). */
const DEMO_GROUND: GroundInputs = {
  firstBoundAt: '2026-04-09T12:00:00.000Z',
  now: '2026-08-20T12:00:00.000Z',
  latitude: null,
  birthMonthIndex: null,
};

type Props = {
  relationship: Relationship;
  /** everything ever placed in the piece. Drives the orbit, nothing else. */
  placed?: number;
  /** the near light, 0 to 1: how lately it has been tended */
  near?: number;
  onBegin?: () => void;
  onSignIn?: () => void;
  onWalk?: (key: string) => void;
  /**
   * Wired: the real piece. Absent, the page renders the demo sample exactly
   * as the shell always has.
   */
  live?: PieceLive;
  /** open with one room already showing (a caretaker door re-entered) */
  initialRoom?: RoomKey | null;
  /** the ground reading's inputs; absent, the fixed demo ground stands */
  ground?: GroundInputs | null;
};

export const PiecePage: React.FC<Props> = ({
  relationship,
  placed = 7,
  near = 1,
  onBegin,
  onSignIn,
  onWalk,
  live,
  initialRoom = null,
  ground = null,
}) => {
  const [room, setRoom] = useState<RoomKey | null>(initialRoom);
  /* true only while the room now showing was opened by pressing the orbit
     itself, per Adrian: the light should carry you into the questions with a
     transitional animation. Every other door into a room (a row, a sibling
     room reopening another) stays the instant swap it always was. */
  const [roomFromOrbit, setRoomFromOrbit] = useState(false);
  const closeRoom = () => {
    setRoom(null);
    setRoomFromOrbit(false);
  };
  const liveDream = live
    ? (live.dream.status === 'ready' ? live.dream.data : null)
    : undefined;

  const isCaretaker = relationship === 'yours';
  const registered = relationship !== 'unclaimed' && relationship !== 'loading';

  /* the glow dot's warmth, fed by the piece's own interactions: how much
     lineage the piece carries and how many letters it has been sent. Demo
     shell (no live data): the fixed ~0.7 the design was drawn against.
     Wired: a small saturating clamp on the combined count, the same curve
     shape as utils/collectorGround.ts's groundWarmth but sized for a
     handful of events rather than years — see glowDot.tsx. */
  const centreWarmth = useMemo(() => {
    if (!live) return 0.7;
    const lineageEvents =
      live.lineage.status === 'ready' && live.lineage.data.kind === 'ok'
        ? live.lineage.data.events.length
        : 0;
    const writings = live.letters && live.letters.status === 'ready' ? live.letters.data.length : 0;
    const n = lineageEvents + writings;
    return 1 - Math.exp(-Math.max(0, n) / 4);
  }, [live]);

  /* the GROUND reading, once per render-inputs: years held warm it, season
     and hour tint it, the birthday month is the warmest it ever gets. It
     feeds two CSS custom properties on the page Ground and nothing else —
     never brass, never the light. */
  const inputs = ground ?? DEMO_GROUND;
  const tint = useMemo(() => {
    if (!inputs.firstBoundAt) return null;
    return composeGround({
      firstBoundAt: inputs.firstBoundAt,
      now: inputs.now,
      latitude: inputs.latitude,
      birthMonthIndex: inputs.birthMonthIndex,
    });
  }, [inputs.firstBoundAt, inputs.now, inputs.latitude, inputs.birthMonthIndex]);

  /* a room opens in place: the body gives way, the room becomes the surface,
     and closing returns to the page. Nothing navigates. */
  if (room) {
    return (
      <div className={roomFromOrbit ? 'collector-room-enter' : undefined} style={{ position: 'absolute', inset: 0 }}>
        <Room room={room} onClose={closeRoom} onWalk={onWalk} onOpenRoom={setRoom} live={live} />
      </div>
    );
  }

  return (
    <Ground
      light={relationship === 'yours' ? 'l' : 'a'}
      pad="var(--pp-pad,40px 28px 26px)"
      tint={registered ? tint : null}
    >
      {/* The reading column. At phone width every custom property below is
          undefined and each fallback is the value this page already had, so
          the phone renders exactly as before. At desk width the frame defines
          them and the one drawn wide layout takes over — see pieceDesktop.tsx. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          width: '100%',
          textAlign: 'var(--pp-text,left)' as React.CSSProperties['textAlign'],
        }}
      >
      {/* the head. Identical in all four. */}
      <div
        style={{
          position: 'relative',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'var(--pp-head-justify,flex-start)',
          gap: 'var(--pp-head-gap,13px)',
          paddingBottom: 13,
          borderBottom: `var(--pp-head-border,1px solid ${C.hairMid})`,
        }}
      >
        <Drawing motif="piece" size={40} lit draw label={`${live ? live.identity.title : PIECE.name}, line drawing`} />
        <div style={{ minWidth: 0 }}>
          <div>
            <Eyebrow size={10.5}>{live ? (live.identity.series ?? live.identity.edition.label) : PIECE.series}</Eyebrow>
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
            {live ? live.identity.title : PIECE.name}
          </div>
        </div>
      </div>

      {/* the authenticity line, visible to anyone. Registered only: the
          unclaimed case now reads more prominently, at the Begin foot,
          per feedback. */}
      {registered && (
        <div
          style={{
            position: 'relative',
            flex: 'none',
            paddingTop: 'var(--pp-status-top,8px)',
            fontFamily: F.body,
            fontSize: 'var(--pp-status-size,11.5px)',
            color: C.inkQuiet,
          }}
        >
          {COPY.page.statusRegistered}
        </div>
      )}

      {/* the dream: the first thing any guest reads. Placing it IS the choice
          to show it, so there is no switch for it anywhere. Words only; who
          wrote them does not show. On the wired page a piece with nothing
          shared simply has no dream block: a quiet absence, never a prompt. */}
      {registered && (live === undefined || liveDream) && (
        <blockquote
          style={{ position: 'relative', margin: 0, flex: 'none', paddingTop: 'var(--pp-quote-top,20px)' }}
        >
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
            {liveDream ? liveDream.body : <Flag text={COPY.page.dreamSample} />}
          </p>
          <cite style={{ display: 'block', marginTop: 12, fontStyle: 'normal' }}>
            {live && live.ritual?.eligible && relationship === 'yours' ? (
              /* the year has turned: the cite line is the quiet door in */
              <button
                type="button"
                onClick={() => onWalk?.('ritual')}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
              >
                <Eyebrow size={10}>{COPY.page.dreamCite}</Eyebrow>
              </button>
            ) : (
              <Eyebrow size={10}>{COPY.page.dreamCite}</Eyebrow>
            )}
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
          width: '100%',
          flex: isCaretaker ? 'none' : '1 1 auto',
          height: isCaretaker ? 'var(--pp-band-max,186px)' : undefined,
          minHeight: isCaretaker ? undefined : 'var(--pp-band-min,190px)',
          maxHeight: 'var(--pp-band-max,none)',
          overflow: 'hidden',
        }}
      >
        {registered ? (
          isCaretaker ? (
            /* the caretaker's light is a door: pressing it opens Add to your
               piece. A real button, keyboard reachable, focus ring kept —
               and visually still just the light, because the light is the
               invitation and nothing here may read as a prompt. */
            <button
              type="button"
              onClick={() => {
                setRoomFromOrbit(true);
                setRoom('garden');
              }}
              aria-label={COPY.page.rowGarden}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                width: '100%',
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <Orbit placed={placed} near={near} />
            </button>
          ) : (
            <Orbit placed={placed} near={near} />
          )
        ) : (
          /* the piece's presence, not a vector: per Adrian, "the center
             should be the glowing dot not a vector.. the dot is your
             interactions with the art." See glowDot.tsx. */
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <GlowDot size={128} warmth={centreWarmth} breathing />
          </div>
        )}
      </div>

      {/* the rows. The public four are on every relationship; the caretaker's
          own rows exist ONLY when the piece is theirs, and are never greyed,
          hinted at, or shown as locked.

          On the caretaker's page the ROWS scroll, not the page: the head, the
          dream and the light hold their positions and the list moves under
          them. The no-scroll law is a law about setup screens, and this is the
          one surface a person returns to for years. */}
      <div
        className={isCaretaker ? 'collector-scroll' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 'var(--pp-measure,100%)',
          marginInline: 'auto',
          ...(isCaretaker
            ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' as const }
            : { flex: 'none' }),
        }}
      >
        {/* the certificate IS the piece information: one room, one row, the
            record's preferred label. Everyone opens it; what each viewer
            sees inside is the room's business. */}
        <Row label={COPY.page.rowStory} onClick={() => setRoom('story')} />
        <Row label={COPY.page.rowInformation} onClick={() => setRoom('information')} />
        <Row label={COPY.page.rowHistory} onClick={() => setRoom('history')} />
        <Row label={COPY.page.rowDreams} onClick={() => setRoom('dreams')} last={!isCaretaker} />

        {isCaretaker && (
          <>
            <Row label={COPY.page.rowGarden} warm onClick={() => setRoom('garden')} />
            <Row label={COPY.page.rowFamily} onClick={() => setRoom('family')} />
            <Row label={COPY.page.rowPassing} onClick={() => onWalk?.('passfork')} />
            <Row label={COPY.page.rowAccount} onClick={() => setRoom('account')} last />
          </>
        )}

        {/* a link, not a row, because rows open in place and links travel */}
        <div style={{ paddingTop: 17, textAlign: 'var(--pp-link-align,inherit)' as React.CSSProperties['textAlign'] }}>
          <a
            href="/"
            style={{ fontFamily: F.body, fontSize: 14, color: C.inkQuiet, textDecoration: 'none' }}
          >
            {COPY.page.siteLink}
          </a>
        </div>
      </div>

      {/* the foot: the only part that differs across the four */}
      <Foot relationship={relationship} onBegin={onBegin} onSignIn={onSignIn} onOpenRoom={setRoom} />
      </div>
    </Ground>
  );
};

/**
 * The foot, and it is the whole of what a relationship changes.
 *
 * Held while the page works out who is holding the phone: absent, and the page
 * is otherwise whole. Never a spinner and never a guess.
 */
const Foot: React.FC<{ relationship: Relationship; onBegin?: () => void; onSignIn?: () => void; onOpenRoom?: (room: RoomKey) => void }> = ({
  relationship,
  onBegin,
  onSignIn,
  onOpenRoom,
}) => {
  if (relationship === 'loading') {
    return (
      <div style={{ position: 'relative', flex: 'none', borderTop: `1px solid ${C.hair}`, height: 96, marginTop: 'var(--pp-foot-push,18px)' }} />
    );
  }

  /* nothing left to claim, and nothing to sign into */
  if (relationship === 'yours') {
    return <div style={{ position: 'relative', flex: 'none', height: 18, marginTop: 'var(--pp-foot-push,0)' }} />;
  }

  /* unclaimed: a lit Begin, the only bright thing on the page. No sign-in link,
     because nobody has an account for an unregistered piece.

     It is the SAME object as every other brass button in the flow: standard
     brass, no lifted glow, per feedback 2026-08-20 ("the glow behind the
     button does not look good... the Begin needs to be standard button
     theme"). What used to be a quiet line under the title, and a standing
     note under Begin, are now one prominent eyebrow pair sitting above the
     button instead: the unclaimed status, moved somewhere it is actually
     seen. */
  if (relationship === 'unclaimed') {
    return (
      <div
        style={{
          position: 'relative',
          flex: 'none',
          paddingTop: 22,
          marginTop: 'var(--pp-foot-push,0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center', paddingBottom: 16 }}>
          <Eyebrow size={10.5}>
            <Flag text={UNCLAIMED_EYEBROW} />
          </Eyebrow>
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.inkBody, marginTop: 5 }}>
            <Flag text={UNCLAIMED_FOOT_LINE} />
          </div>
        </div>
        <Brass onClick={onBegin}>
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
        marginTop: 'var(--pp-foot-push,0)',
        width: '100%',
        maxWidth: 'var(--pp-measure,100%)',
        marginInline: 'auto',
      }}
    >
      {/* The two doors. Centred as a pair with a divider between them on the
          phone; split to the two ends under a hairline at desk width, which is
          how the wide artboard draws them. Same two doors, same words, same
          order either way: only where they sit changes. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'var(--pp-foot-items,center)',
          justifyContent: 'var(--pp-foot-justify,center)',
          gap: 'var(--pp-foot-gap,16px)',
          borderTop: 'var(--pp-foot-border,0)',
          paddingTop: 'var(--pp-foot-top,0)',
          fontSize: 'var(--pp-foot-size,inherit)',
        }}
      >
        <span style={{ flex: 'var(--pp-foot-flex,0 0 auto)', textAlign: 'left' }}>
          <TLink tone={C.inkBody} onClick={relationship === 'signedin' ? onBegin : () => onOpenRoom?.('story')}>
            {relationship === 'signedin' ? COPY.page.doorHold : COPY.page.doorLook}
          </TLink>
        </span>
        <span
          style={{
            width: 1,
            height: 16,
            background: C.hair,
            display: 'var(--pp-foot-divider,block)',
            alignSelf: 'center',
          }}
        />
        <span style={{ flex: 'var(--pp-foot-flex,0 0 auto)', textAlign: 'right' }}>
          <TLink tone={C.inkBody} onClick={relationship === 'signedin' ? () => onOpenRoom?.('story') : onSignIn}>
            {relationship === 'signedin' ? COPY.page.doorLook : COPY.page.doorTend}
          </TLink>
        </span>
      </div>
      {/* the short line beneath the two doors — Adrian's chosen wording, 2026-08-20 */}
      <div style={{ textAlign: 'center', maxWidth: '40ch', margin: '0 auto' }}>
        <Note top={8}>{COPY.page.registeredNotYoursNote}</Note>
      </div>
    </div>
  );
};
