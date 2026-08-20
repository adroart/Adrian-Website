/**
 * The vault arrival: what stands the instant the sixteen-character code
 * proves true, and stays.
 *
 * Adrian's ruling (2026-08-20), deciding among three studies built for his
 * walkthrough: "the center should be the glowing dot not a vector.. the dot
 * is your interactions with the art." No ring frame, no light bar, no
 * stroke-drawn motif — the vault's own light gathers into the same GlowDot
 * (`components/collector/glowDot.tsx`) that stands at the center of the
 * piece page itself, so the dot settling here IS the visual continuity with
 * the page the collector lands on. There is no forwarding page: this
 * component IS the codetrue screen, dressed with its own entrance, and the
 * visitor stays on it — Continue leads onward exactly where codetrue's own
 * `to` always has, never to a page of the arrival's own.
 *
 * The choreography (~3.1s total, every timing in the JSX below; a
 * `prefers-reduced-motion` visitor gets each of these collapsed to
 * near-instant by the shared `.arrival-anim` rule in ceremony/styles.tsx):
 *
 *   0.00–1.15  the vault opens exactly as it always has: the seam parts,
 *              the light bar ignites, the top and bottom panels slide away
 *              (VaultDress below, adapted from CodePage's own vault — the
 *              ring it used to carry is gone, per the ruling above)
 *   1.00–1.70  that light gives itself up (arrivalLightFade, reused as-is
 *              from ceremony/styles.tsx)
 *   0.85–1.85  the dot blooms into the space the light is leaving
 *              (arrivalDotBloom: opacity and scale only)
 *   1.55–2.05  the dot settles slightly upward into its resting place
 *              (arrivalDotSettle, on a separate wrapper element so its
 *              translateY never fights the bloom's own scale on the same
 *              `transform`)
 *   2.00–3.10  the locked words rise beneath it in turn: trueHead, then
 *              trueBody, then codetrue's own footing (its quiet fork
 *              question, then Continue) — read from the `screen` prop
 *              rather than duplicated here, so a real unlock shows the real
 *              piece's name (wired.tsx's `wiredScreen('codetrue')` swaps
 *              trueBody's sample piece for it) and this stays the one real
 *              destination rather than a copy of it
 *
 * Two ways this mounts:
 *   `play={true}`  the real thing: a successful unlock, or the walkthrough
 *                  chapter that walks the register flow into codetrue for
 *                  the first time. The full choreography above plays once.
 *   `play={false}` a revisit — the fork screen's own back link, transfer's
 *                  "I didn't mean to" link, gift's reveal continuing on —
 *                  lands on the same screen already settled: no dress, no
 *                  reveal. The code proved true once; landing here again is
 *                  not a second unlocking. `play` is read only at this
 *                  component's own mount (frozen into local state below),
 *                  so an unrelated re-render mid-choreography (wired.tsx
 *                  resolves several `useQuiet` reads around this moment)
 *                  can never snap an entrance already in flight back to its
 *                  settled state.
 *
 * The walkthrough's own study wrapper (components/walkthrough/
 * ArrivalStation.tsx) owns the 390×844 frame, the replay control, and the
 * one inert admission Continue makes there — none of that belongs in this
 * production component, which mounts directly inside whichever phone frame
 * already exists (WiredJourney's, CollectorShell's).
 */

import React, { useState } from 'react';
import { C } from './tokens';
import { Body, Brass, Head, Ground, TLink } from './ui';
import { GlowDot } from './glowDot';

const EASE_PART = 'cubic-bezier(.65,0,.35,1)';
const EASE_CARRY = 'cubic-bezier(.22,.61,.36,1)';

/**
 * What codetrue itself carries, exactly the fields this arrival dresses. A
 * caller passes `WALK.codetrue` (the demo shell, the walkthrough study) or
 * `wiredScreen('codetrue')` (a real unlock, its piece name already swapped
 * in) — never a copy typed out here, so nothing can drift from the one real
 * screen this is. Plain strings rather than `Pick<Screen, ...>`: `WALK`
 * itself (walk.tsx) carries no `as const`, so its own entries type looser
 * than `Screen` does (wired.tsx casts with `as Screen` where it needs the
 * stricter shape) — this type only needs to accept either.
 */
export type VaultArrivalScreen = {
  head: string;
  body?: string;
  light?: string;
  pill?: string;
  to?: string;
  foreLink?: string;
  foreLinkTo?: string;
};

/** a fixed presence for the arrival moment itself: unlike the piece page's
 *  own GlowDot, whose warmth PiecePage feeds from the piece's live
 *  interaction history (glowDot.tsx), the code has just this instant proved
 *  true and carries no history yet to read a warmth from */
const ARRIVAL_DOT_WARMTH = 0.8;

export type VaultArrivalProps = {
  /** true only the first time this mount is the arrival; see the header
   *  above for exactly what plays and what a revisit renders instead */
  play: boolean;
  /** where Continue and the quiet fork question lead: `go`/`onGo` in
   *  whichever shell mounts this, called with `screen.to` / `foreLinkTo` */
  onGo: (target: string) => void;
  screen: VaultArrivalScreen;
};

/* ------------------------------------------------------------------ *
 * the vault, re-dressed: the same markup CodePage's own vault draws, on
 * the same keyframes, minus the ring the ruling above retired. Local
 * rather than imported because CodePage does not export it and is owned
 * elsewhere this pass.
 * ------------------------------------------------------------------ */

const VaultDress: React.FC = () => (
  <div
    className="arrival-anim"
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 6,
      pointerEvents: 'none',
      animation: 'arrivalLightFade .7s ease 1s forwards',
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
        animation: `vaultLight .8s ${EASE_CARRY} .1s forwards`,
        background:
          'linear-gradient(180deg,transparent,rgba(237,233,226,.14) 46%,rgba(237,233,226,.14) 54%,transparent)',
      }}
    />
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
 * the settled content: codetrue itself, composed the same way WalkScreen's
 * own "centred" branch composes a wordless-fields screen (head, body, one
 * brass act) — the one difference is the art slot, which carries the
 * GlowDot rather than a Drawing motif, per the ruling. `animate` is false
 * for a revisit (rendered already in its final, static state, nothing
 * timed) and true for the one real playing of the entrance, where each
 * piece carries the class and animation the header above describes.
 * ------------------------------------------------------------------ */

const CodetrueSettled: React.FC<{
  screen: VaultArrivalScreen;
  animate: boolean;
  onGo: (target: string) => void;
}> = ({ screen, animate, onGo }) => {
  /* the un-animated case renders with no opacity/animation styling at all,
     rather than an animation frozen at its 100% frame, so a revisit never
     depends on a keyframe's own end-state staying exactly still */
  const reveal = (anim: string): React.CSSProperties => (animate ? { opacity: 0, animation: anim } : {});
  const animCls = animate ? 'arrival-anim' : undefined;

  return (
    <Ground light={screen.light}>
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* the settle: a wrapper of its own, so its translateY never
            fights the bloom's scale on the same transform */}
        <div className={animCls} style={{ position: 'relative', flex: 'none', ...reveal(`arrivalDotSettle .5s ${EASE_CARRY} 1.55s both`) }}>
          {/* the bloom: opacity and scale, nothing else */}
          <div
            className={animCls}
            style={{
              position: 'relative',
              height: 150,
              display: 'grid',
              placeItems: 'center',
              ...reveal(`arrivalDotBloom 1s ${EASE_CARRY} .85s both`),
            }}
          >
            <GlowDot size={132} warmth={ARRIVAL_DOT_WARMTH} breathing />
          </div>
        </div>

        <div className={animCls} style={{ position: 'relative', flex: 'none', ...reveal('riseIn .5s ease 2s both') }}>
          <Head>{screen.head}</Head>
        </div>

        {screen.body && (
          <div className={animCls} style={{ position: 'relative', flex: 'none', ...reveal('riseIn .5s ease 2.2s both') }}>
            <Body top={16}>{screen.body}</Body>
          </div>
        )}
      </div>

      {/* the quiet fork question, its own row above the foot rather than
          sharing it with the brass act — codetrue's own shape */}
      {screen.foreLink && (
        <div className={animCls} style={{ position: 'relative', flex: 'none', paddingTop: 4, ...reveal('riseIn .5s ease 2.45s both') }}>
          <TLink onClick={() => screen.foreLinkTo && onGo(screen.foreLinkTo)}>{screen.foreLink}</TLink>
        </div>
      )}

      {screen.pill && (
        <div
          className={animCls}
          style={{
            position: 'relative',
            flex: 'none',
            paddingTop: 18,
            display: 'flex',
            justifyContent: 'flex-end',
            ...reveal('riseIn .5s ease 2.6s both'),
          }}
        >
          <Brass onClick={() => screen.to && onGo(screen.to)}>{screen.pill}</Brass>
        </div>
      )}
    </Ground>
  );
};

/* ------------------------------------------------------------------ *
 * the one arrival
 * ------------------------------------------------------------------ */

export const VaultArrival: React.FC<VaultArrivalProps> = ({ play, onGo, screen }) => {
  /* frozen at this component's own mount: a later re-render of whatever
     mounts this (wired.tsx's several `useQuiet` resolutions land around
     this exact moment; CollectorShell carries its own state) must never
     flip an entrance already in flight, or already finished, back to the
     un-played state. See "Two ways this mounts" above. */
  const [animate] = useState(() => play);

  return (
    <>
      <CodetrueSettled screen={screen} animate={animate} onGo={onGo} />
      {animate && <VaultDress />}
    </>
  );
};
