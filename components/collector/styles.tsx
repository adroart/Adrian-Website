/**
 * The collector surface's own stylesheet, kept out of `src/index.css` so this
 * room never leaks into the public site.
 *
 * Keyframes and hover rules are copied from the Claude Design file verbatim.
 * Everything animates once on entry and then holds still: nothing loops except
 * the orbit, which is the light itself rather than a decoration.
 *
 * Reduced motion gets clean fades everywhere, per the locked motion rules.
 */

import React from 'react';
import { C } from './tokens';

export const CollectorStyles: React.FC = () => (
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

    .collector-row:hover { color: ${C.brass} !important }
    .collector-row:hover .collector-chev { color: ${C.brass} !important }
    .collector-scroll { scrollbar-width: none }
    .collector-scroll::-webkit-scrollbar { display: none }

    /* focus has to be visible on espresso, and brass is the only accent that
       reads at this ground's contrast */
    .collector-root :focus-visible {
      outline: 2px solid ${C.brass};
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
  `}</style>
);
