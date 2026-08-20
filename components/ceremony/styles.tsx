/**
 * The ceremony kit's own stylesheet, kept out of `src/index.css` so this room
 * never leaks into the public site.
 *
 * Keyframes and hover rules are copied from the Claude Design file verbatim.
 * Everything animates once on entry and then holds still: nothing loops except
 * the orbit, which is the light itself rather than a decoration.
 *
 * Reduced motion gets clean fades everywhere, per the locked motion rules.
 *
 * The class-name hooks (`collector-root`, `collector-row`, `collector-ph`,
 * `collector-scroll`, `cad-draw`) are the kit's own, shared with the
 * primitives in `ui.tsx`; they keep their historical names so the DOM the
 * collector walk renders does not change. The accent colours come from the
 * theme, espresso unless a sibling theme is passed.
 */

import React from 'react';
import espresso, { CeremonyTheme } from './tokens';

export const CeremonyStyles: React.FC<{ theme?: CeremonyTheme }> = ({ theme = espresso }) => (
  <style>{`
    @keyframes cadDraw { to { stroke-dashoffset: 0 } }
    @keyframes spinSlow { to { transform: rotate(360deg) } }
    @keyframes spinRev { to { transform: rotate(-360deg) } }
    @keyframes fed { 0%,100% { transform: scale(1); opacity: .82 } 50% { transform: scale(1.1); opacity: 1 } }
    @keyframes ignite { from { opacity: 0 } to { opacity: 1 } }
    @keyframes riseIn { from { opacity: 0; transform: translateY(9px) } to { opacity: 1; transform: none } }
    @keyframes seat { 0% { transform: translateY(-5px); opacity: 0 } 60% { transform: translateY(1.5px); opacity: 1 } 100% { transform: none } }
    @keyframes tumble { 0% { transform: translateY(-120%) } 70% { transform: translateY(6%) } 100% { transform: translateY(0) } }

    /* the vault: the one big motion in the flow, and nothing after it competes
       with its scale. Two to four seconds, never longer. */
    @keyframes vaultTop { 0% { transform: translateY(0) } 18% { transform: translateY(6px) } 100% { transform: translateY(-100%) } }
    @keyframes vaultBot { 0% { transform: translateY(0) } 18% { transform: translateY(-6px) } 100% { transform: translateY(100%) } }
    @keyframes vaultLight { from { opacity: 0 } to { opacity: 1 } }
    @keyframes seam { 0% { opacity: 0; transform: scaleX(.2) } 30% { opacity: 1; transform: scaleX(1) } 100% { opacity: .5; transform: scaleX(1) } }
    @keyframes ringTurn { 0% { transform: rotate(0); opacity: 0 } 12% { opacity: 1 } 100% { transform: rotate(96deg); opacity: 1 } }

    /* the drawing draws itself: ordered stroke paths, first stroke first */
    .cad-draw path, .cad-draw circle, .cad-draw line {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: cadDraw 1.5s cubic-bezier(.16,1,.3,1) forwards;
    }
    .cad-draw *:nth-child(2) { animation-delay: .18s }
    .cad-draw *:nth-child(3) { animation-delay: .34s }
    .cad-draw *:nth-child(4) { animation-delay: .5s }
    .cad-draw *:nth-child(5) { animation-delay: .64s }

    /* The collector room is not the public site, and the site's prose styles
       must not reach into it. src/index.css dresses blockquote with a brass
       left rule for writings; here the dream IS a blockquote and that rule
       reads as an ornament nobody asked for. Reset the elements the site
       styles globally, and nothing else. */
    .collector-root blockquote {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      font-style: normal;
      quotes: none;
    }
    .collector-root blockquote::before,
    .collector-root blockquote::after { content: none }
    .collector-root cite { font-style: normal }
    .collector-root h1, .collector-root h2, .collector-root h3 { margin: 0 }

    /* unwritten copy, marked. Off unless the root asks for it. */
    .collector-ph { border-bottom: 0; padding-bottom: 1px }
    .collector-root[data-marks="1"] .collector-ph {
      border-bottom: 1px dashed ${theme.palette.wrongEdge};
    }

    .collector-row:hover { color: ${theme.palette.brass} !important }
    .collector-row:hover .collector-chev { color: ${theme.palette.brass} !important }
    .collector-scroll { scrollbar-width: none }
    .collector-scroll::-webkit-scrollbar { display: none }

    /* focus has to be visible on espresso, and brass is the only accent that
       reads at this ground's contrast */
    .collector-root :focus-visible {
      outline: 2px solid ${theme.palette.brass};
      outline-offset: 2px;
      border-radius: 4px;
    }

    @media (prefers-reduced-motion: reduce) {
      .collector-root *, .collector-root *::before, .collector-root *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
      }
      .cad-draw path, .cad-draw circle, .cad-draw line { stroke-dashoffset: 0 }
    }

    /* the orbit's own door: opening a room from the light gets one quiet
       entrance, a settle rather than a jump, so the light's transition into
       the questions reads as continuous rather than a hard cut. Everything
       else that opens a room stays the instant, un-animated swap it always
       was. */
    @keyframes collectorRoomEnter {
      from { opacity: 0; transform: scale(.97) }
      to { opacity: 1; transform: scale(1) }
    }
    .collector-room-enter {
      animation: collectorRoomEnter .38s cubic-bezier(.16,1,.3,1) both;
    }

    @media (prefers-reduced-motion: reduce) {
      .collector-room-enter { animation: none; opacity: 1; transform: none }
    }

    /* ── the three arrival studies (collector/vaultArrival.tsx) ─────────
       What stands after the vault opens, per Adrian's ruling (§7, item 2,
       2026-08-20): the unlock arrives somewhere and stays. New names only;
       the vault's own seam / vaultLight / ringTurn / vaultTop / vaultBot
       keyframes above are reused by the studies, never redefined. */

    /* variant A: the true words appear as a line across the opening, hold
       there while the panels finish, then glide up into their slot on the
       page beneath. The 178px is the drop from that slot to the opening. */
    @keyframes arrivalSettle {
      0% { opacity: 0; transform: translateY(178px) }
      16% { opacity: 1; transform: translateY(178px) }
      60% { opacity: 1; transform: translateY(178px) }
      100% { opacity: 1; transform: none }
    }

    /* variant B: the ring stops being the vault's dial and becomes the
       standing frame the words compose inside */
    @keyframes arrivalRingGrow { from { transform: scale(.62) } to { transform: scale(1) } }

    /* variant C: the vault light gives itself up to the drawing */
    @keyframes arrivalLightFade { to { opacity: 0 } }

    /* variant C: the piece's strokes begin only once the light has carried
       them in — the same cadDraw animation the drawing always plays, started
       later and a touch quicker so the whole passage stays inside four
       seconds. Same specificity tier as the cad-draw rules above; being
       later in this sheet is what lets these win. */
    .arrival-draw-late path, .arrival-draw-late circle, .arrival-draw-late line {
      animation-duration: 1.15s;
      animation-delay: .85s;
    }
    .arrival-draw-late *:nth-child(2) { animation-delay: 1s }
    .arrival-draw-late *:nth-child(3) { animation-delay: 1.15s }
    .arrival-draw-late *:nth-child(4) { animation-delay: 1.3s }
    .arrival-draw-late *:nth-child(5) { animation-delay: 1.42s }

    /* The arrival studies' own reduced-motion collapse. The global
       collector-root rule above shortens durations but leaves delays
       standing, and these sequences are almost entirely delay: zero those
       too, and the fill modes hold every element at its settled end-state. */
    @media (prefers-reduced-motion: reduce) {
      .arrival-anim { animation-delay: 0s !important; animation-duration: .01ms !important }
      .arrival-draw-late path, .arrival-draw-late circle, .arrival-draw-late line {
        animation-delay: 0s !important;
        stroke-dashoffset: 0 !important;
      }
    }
  `}</style>
);
