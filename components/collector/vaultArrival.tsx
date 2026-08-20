/**
 * The three arrivals: what stands after the vault opens.
 *
 * Adrian's ruling (wording record §7, item 2, 2026-08-20): "The unlock
 * arrives and stays. The vault must open directly onto the destination
 * itself. The words that say the code is true belong to the arrival, not to
 * a page that follows it. Three arrivals are built for my walkthrough, and
 * my verdict picks one."
 *
 * These are those three, as self-contained studies for the walkthrough rail:
 *
 *   A · It parts and settles — the panels part exactly as today; beneath
 *       them the piece page's head is already in place and fades up as they
 *       finish; the true words render as a line across the opening and then
 *       settle INTO the page, a quiet line above the fold.
 *   B · Inside the opened vault — the ring persists as the standing frame;
 *       the true words, Continue and the fork compose inside it; outside the
 *       ring the dark ground holds. The vault is briefly the room.
 *   C · The piece is the proof — the vault light resolves into the piece's
 *       own line drawing, stroke-drawn in; the true words appear beneath
 *       once the strokes complete.
 *
 * Each mounts its own 390 x 844 espresso frame, plays its arrival on mount,
 * and carries a quiet replay control, because Adrian will watch them
 * repeatedly. They are arrival STUDIES, not the flow: Continue and the fork
 * link are inert here, and pressing Continue shows one quiet line saying so.
 * Production routing (CodePage's onTrue into codetrue) is untouched until
 * Adrian picks.
 *
 * All copy is the locked codetrue copy, verbatim from copy.ts: trueHead,
 * trueBody, trueContinue, trueFork. The vault's own keyframes (seam,
 * vaultLight, ringTurn, vaultTop, vaultBot) are reused from
 * ceremony/styles.tsx, never redefined; the studies' new keyframes
 * (arrivalSettle, arrivalRingGrow, arrivalLightFade) and their
 * reduced-motion collapse are appended there. Reduced motion collapses every
 * sequence to its settled end-state.
 *
 * Nothing here stores, sends, or reads anything: no network, no storage.
 */

import React, { useState } from 'react';
import { C, F } from './tokens';
import { COPY, MARKS_DEFAULT, PIECE, PLACEHOLDERS } from './copy';
import { Body, Brass, Eyebrow, Head, Ground, Note, Spacer, TLink } from './ui';
import { Drawing } from './drawings';
import { CeremonyStyles } from '../ceremony/styles';

/** the walk.tsx idiom: unwritten copy, registered so it can never reach
 *  Adrian disguised as finished words. T3-COPY: hoist into copy.ts. */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

/** what an inert Continue admits to being, in these studies alone */
const PH_CONTINUE_LINE = ph('The walk would continue from here.');

const EASE_PART = 'cubic-bezier(.65,0,.35,1)';
const EASE_CARRY = 'cubic-bezier(.22,.61,.36,1)';

/* ------------------------------------------------------------------ *
 * the frame, and the replay
 * ------------------------------------------------------------------ */

/**
 * The 390 x 844 espresso frame every station surface wears, with the study's
 * one piece of apparatus: a quiet replay in the top corner. Everything
 * animated remounts under a new key on replay, so the whole arrival plays
 * again from its first frame.
 */
const Frame: React.FC<{ onReplay: () => void; children: React.ReactNode }> = ({
  onReplay,
  children,
}) => (
  <div
    className="collector-root"
    data-marks={MARKS_DEFAULT ? '1' : '0'}
    style={{ display: 'flex', justifyContent: 'center' }}
  >
    <CeremonyStyles />
    <div
      style={{
        position: 'relative',
        width: 390,
        height: 844,
        maxWidth: '100%',
        boxSizing: 'border-box',
        borderRadius: 34,
        overflow: 'hidden',
        background: C.ground,
        border: `1px solid ${C.hairStrong}`,
      }}
    >
      {children}
      <button
        type="button"
        onClick={onReplay}
        style={{
          position: 'absolute',
          top: 14,
          right: 18,
          zIndex: 9,
          background: 'none',
          border: 0,
          cursor: 'pointer',
          padding: '4px 2px',
          fontFamily: F.label,
          fontSize: 9,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: C.inkGhost,
        }}
      >
        Replay
      </button>
    </div>
  </div>
);

/** one hook per variant: the replay counter that rekeys the sequence, and
 *  the inert Continue's one quiet admission */
const useStudy = () => {
  const [run, setRun] = useState(0);
  const [continued, setContinued] = useState(false);
  const replay = () => {
    setContinued(false);
    setRun(r => r + 1);
  };
  return { run, continued, setContinued, replay };
};

/* ------------------------------------------------------------------ *
 * the vault itself, re-dressed
 *
 * The same markup CodePage's Vault draws, on the same keyframes, so the
 * opening in every study IS today's opening. Local rather than imported
 * because CodePage does not export it and is owned elsewhere this pass.
 * ------------------------------------------------------------------ */

const VaultDress: React.FC<{ ring?: boolean; lightFade?: boolean }> = ({
  ring = false,
  lightFade = false,
}) => (
  /* the whole dress gives way once the panels have parted. In CodePage the
     navigation at 1300ms is what carries the seam and ring off screen; an
     arrival that stays must let them go itself, or the seam's settled
     opacity (.5, forwards) reads as a line struck through the words. */
  <div
    className="arrival-anim"
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 6,
      pointerEvents: 'none',
      animation: 'arrivalLightFade .7s ease 1.2s forwards',
    }}
  >
    <div
      className="arrival-anim"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 1,
        transform: 'translateY(-50%)',
        background: 'rgba(237,233,226,.75)',
        animation: `seam .5s ${EASE_CARRY} forwards`,
      }}
    />
    <div
      className="arrival-anim"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 70,
        transform: 'translateY(-50%)',
        opacity: 0,
        animation: lightFade
          ? `vaultLight .8s ${EASE_CARRY} .1s forwards, arrivalLightFade .8s ease 1.2s forwards`
          : `vaultLight .8s ${EASE_CARRY} .1s forwards`,
        background:
          'linear-gradient(180deg,transparent,rgba(237,233,226,.14) 46%,rgba(237,233,226,.14) 54%,transparent)',
      }}
    />
    {ring && (
      <div
        className="arrival-anim"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 210,
          height: 210,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.2)',
          opacity: 0,
          animation: `ringTurn 1.1s ${EASE_PART} forwards`,
        }}
      />
    )}
    <div
      className="arrival-anim"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '50%',
        background: C.ground,
        borderBottom: '1px solid rgba(237,233,226,.4)',
        boxShadow: '0 6px 20px rgba(0,0,0,.6)',
        animation: `vaultTop 1.15s ${EASE_PART} forwards`,
      }}
    >
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 9, height: 1, background: 'rgba(237,233,226,.1)', display: 'block' }} />
      <span style={{ position: 'absolute', left: 24, bottom: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
      <span style={{ position: 'absolute', right: 24, bottom: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
    </div>
    <div
      className="arrival-anim"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
        background: C.ground,
        borderTop: '1px solid rgba(237,233,226,.4)',
        boxShadow: '0 -6px 20px rgba(0,0,0,.6)',
        animation: `vaultBot 1.15s ${EASE_PART} forwards`,
      }}
    >
      <span style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 1, background: 'rgba(237,233,226,.1)', display: 'block' }} />
      <span style={{ position: 'absolute', left: 24, top: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
      <span style={{ position: 'absolute', right: 24, top: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * the shared foot: Continue and the fork, exactly as codetrue carries
 * them (stack: true — the brass, then the quiet link beneath it)
 * ------------------------------------------------------------------ */

const StudyFoot: React.FC<{
  continued: boolean;
  onContinue: () => void;
  /** delay in seconds before the foot rises in */
  at: number;
  /** variant B centres its foot inside the ring */
  centred?: boolean;
}> = ({ continued, onContinue, at, centred = false }) => (
  <div
    className="arrival-anim"
    style={{
      position: 'relative',
      flex: 'none',
      paddingTop: 18,
      display: 'flex',
      flexDirection: 'column',
      alignItems: centred ? 'center' : 'flex-start',
      gap: 4,
      opacity: 0,
      animation: `riseIn .5s ease ${at}s both`,
    }}
  >
    <Brass onClick={onContinue}>{COPY.threshold.trueContinue}</Brass>
    <TLink>{COPY.threshold.trueFork}</TLink>
    {continued && (
      <div style={{ textAlign: centred ? 'center' : 'left' }}>
        <Note top={4}>{PH_CONTINUE_LINE}</Note>
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ *
 * A · It parts and settles
 *
 * 0.00–1.15  the vault opens exactly as today (seam, light, ring, panels)
 * 0.75–1.35  the piece page's head and status fade up beneath the parting
 * 0.45–2.35  the true words appear as a line across the opening (~0.45–0.75),
 *            hold there while the panels finish, then glide up and settle
 *            into their slot on the page (arrivalSettle)
 * 2.30–2.80  Continue and the fork rise at the foot
 * ------------------------------------------------------------------ */

export const ArrivalVariantA: React.FC = () => {
  const { run, continued, setContinued, replay } = useStudy();
  return (
    <Frame onReplay={replay}>
      <div key={run} style={{ position: 'absolute', inset: 0 }}>
        <Ground light="c" pad="40px 28px 26px">
          {/* the piece page's own head: drawing · series · title, composed
              as PiecePage composes it, already in place beneath the panels */}
          <div
            className="arrival-anim"
            style={{
              position: 'relative',
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              paddingBottom: 13,
              borderBottom: `1px solid ${C.hairMid}`,
              opacity: 0,
              animation: 'ignite .6s ease .75s both',
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

          {/* the authenticity line, true from this moment */}
          <div
            className="arrival-anim"
            style={{
              position: 'relative',
              flex: 'none',
              paddingTop: 8,
              fontFamily: F.body,
              fontSize: 11.5,
              color: C.inkQuiet,
              opacity: 0,
              animation: 'ignite .6s ease .9s both',
            }}
          >
            {COPY.page.statusRegistered}
          </div>

          {/* the true words: a line across the opening that settles into the
              page. zIndex 7 lifts it above the parting panels (zIndex 6) so
              it reads across the opening while they finish. */}
          <div
            className="arrival-anim"
            style={{
              position: 'relative',
              zIndex: 7,
              flex: 'none',
              marginTop: 26,
              opacity: 0,
              animation: `arrivalSettle 1.9s ${EASE_CARRY} .45s both`,
            }}
          >
            <Head size={30}>{COPY.threshold.trueHead}</Head>
            <Body top={12} size={13.5}>
              {COPY.threshold.trueBody}
            </Body>
          </div>

          <Spacer />

          <StudyFoot continued={continued} onContinue={() => setContinued(true)} at={2.3} />
        </Ground>

        <VaultDress ring />
      </div>
    </Frame>
  );
};

/* ------------------------------------------------------------------ *
 * B · Inside the opened vault
 *
 * 0.00–1.15  seam, light, panels part as today
 * 0.00–1.10  the ring comes on through the opening, at the vault's own size
 *            (ringTurn under arrivalRingGrow's backwards fill at scale .62)
 * 1.00–1.70  the ring grows into the standing frame (arrivalRingGrow) while
 *            the ground outside it darkens to the dark ground (ignite)
 * 1.60–2.65  head, body, Continue, fork rise inside the ring in turn
 * ------------------------------------------------------------------ */

const RING = 336;

export const ArrivalVariantB: React.FC = () => {
  const { run, continued, setContinued, replay } = useStudy();
  return (
    <Frame onReplay={replay}>
      <div key={run} style={{ position: 'absolute', inset: 0 }}>
        <Ground light="c" pad="0">
          {/* the dark ground outside the ring: the space the room does not
              claim. transparent to the ring's radius, dark beyond it. */}
          <div
            className="arrival-anim"
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle at 50% 50%, transparent ${RING / 2 - 1}px, rgba(9,7,5,.86) ${RING / 2 + 1}px)`,
              opacity: 0,
              animation: 'ignite .7s ease 1s both',
            }}
          />

          {/* the standing frame. ringTurn brings it on; arrivalRingGrow,
              later in the animation list, owns the transform channel with
              its backwards fill, so the ring holds the vault's own 210px
              (scale .62 of 336) until it grows at 1s. */}
          <div
            className="arrival-anim"
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: RING,
              height: RING,
              marginLeft: -RING / 2,
              marginTop: -RING / 2,
              borderRadius: '50%',
              boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.2)',
              opacity: 0,
              animation: `ringTurn 1.1s ${EASE_PART} forwards, arrivalRingGrow .7s ${EASE_PART} 1s both`,
            }}
          />

          {/* what composes inside the ring, unscaled: the true words, then
              the two ways on, each rising in turn once the room stands */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 232,
              transform: 'translate(-50%,-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div
              className="arrival-anim"
              style={{ opacity: 0, animation: 'riseIn .5s ease 1.6s both' }}
            >
              <Head size={24}>{COPY.threshold.trueHead}</Head>
            </div>
            <div
              className="arrival-anim"
              style={{ opacity: 0, animation: 'riseIn .5s ease 1.75s both' }}
            >
              <Body top={10} size={12}>
                {COPY.threshold.trueBody}
              </Body>
            </div>
            <StudyFoot continued={continued} onContinue={() => setContinued(true)} at={1.95} centred />
          </div>
        </Ground>

        <VaultDress />
      </div>
    </Frame>
  );
};

/* ------------------------------------------------------------------ *
 * C · The piece is the proof
 *
 * 0.00–1.15  seam, light in, panels part as today
 * 1.20–2.00  the light gives itself up (arrivalLightFade)
 * 0.85–2.45  the piece's own strokes draw in where the light was
 *            (cadDraw via the arrival-draw-late timings)
 * 2.30–2.95  the true words rise beneath the finished drawing
 * 2.70–3.20  Continue and the fork rise at the foot
 * ------------------------------------------------------------------ */

export const ArrivalVariantC: React.FC = () => {
  const { run, continued, setContinued, replay } = useStudy();
  return (
    <Frame onReplay={replay}>
      <div key={run} style={{ position: 'absolute', inset: 0 }}>
        <Ground light="c" pad="44px 30px 30px">
          <Spacer />

          {/* the proof itself: the piece's line drawing, stroke-drawn where
              the vault light stood */}
          <div
            className="arrival-draw-late"
            style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center' }}
          >
            <Drawing motif="piece" size={132} draw label={`${PIECE.name}, line drawing`} />
          </div>

          <div style={{ position: 'relative', flex: 'none', textAlign: 'center' }}>
            <div
              className="arrival-anim"
              style={{ marginTop: 34, opacity: 0, animation: 'riseIn .55s ease 2.3s both' }}
            >
              <Head size={31}>{COPY.threshold.trueHead}</Head>
            </div>
            <div
              className="arrival-anim"
              style={{
                margin: '0 auto',
                maxWidth: '34ch',
                opacity: 0,
                animation: 'riseIn .55s ease 2.45s both',
              }}
            >
              <Body top={14} size={13.5}>
                {COPY.threshold.trueBody}
              </Body>
            </div>
          </div>

          <Spacer />

          <StudyFoot continued={continued} onContinue={() => setContinued(true)} at={2.7} />
        </Ground>

        <VaultDress lightFade />
      </div>
    </Frame>
  );
};
