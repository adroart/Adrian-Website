/**
 * The piece page at desk width. (Centring is done by `text-align` and by
 * `margin-inline: auto` on the two capped blocks, never by `align-items` on
 * the column: the light and the head must stay full-width flex children, and
 * centring the column itself would shrink them to their content.)
 *
 * The design file `Collector Piece Page.dc.html` is 174 artboards at 390 by
 * 844 and exactly ONE at 1280 by 1020: the piece page, last card in the
 * document. That single wide drawing is the whole of what this file encodes.
 * Every other screen in the journey was drawn for a phone only, which is why
 * `CollectorShell` widens its frame for the piece page and for nothing else.
 *
 * It is one page, not two. The wording, the rows, their order and the foot's
 * two doors are identical to the phone; what changes is the viewable area:
 *
 *   the head loses its rule and centres
 *   the inscription centres and takes more air above it
 *   the light spans the full width of the card and caps at 320 tall
 *   the rows and the foot hold a 460 reading measure, centred
 *   the foot's two doors split left and right under a hairline
 *
 * HOW it is applied matters. Every value below is a CSS custom property whose
 * FALLBACK, written at each use site in `PiecePage.tsx`, is the phone value
 * the page already had. Under 1180 no property here is defined, every use site
 * falls back, and the phone renders byte-identically to before this file
 * existed. Media queries cannot override inline styles without `!important`,
 * and the collector surface is inline-styled throughout; custom properties are
 * the one mechanism that lets the design widen the page without a second copy
 * of it to keep in sync.
 *
 * The measurements are the artboard's own, read off the rendered design rather
 * than retyped from a screenshot.
 *
 * ONE KNOWN DEVIATION: the artboard's foot carries the two doors and nothing
 * else. The built foot also carries the short line beneath them
 * (`COPY.page.registeredNotYoursNote`), which is Adrian's chosen wording from
 * 2026-08-20. Approved copy is not dropped to match a drawing, so the line
 * stays at both widths. If the drawing is the later decision, delete the line
 * from the foot in `PiecePage.tsx` rather than hiding it here.
 */

import React from 'react';
import { espresso } from '../ceremony/tokens';

const C = espresso.palette;

/** the width at which the wide artboard takes over */
export const PIECE_DESK_MIN = 1180;

export const PieceDesktopStyles: React.FC = () => (
  <style>{`
    /* The frame itself. Under 768 this is the phone the journey was drawn as
       and nothing here applies. Between 768 and the desk breakpoint the card
       grows but the page keeps its phone layout: the drawing for that middle
       band does not exist, so widening the type there would be inventing one. */
    .collector-frame {
      position: relative;
      overflow: hidden;
      width: 100%;
      max-width: 390px;
      height: 844px;
      border-radius: 34px;
      background: ${C.ground};
      border: 1px solid ${C.hairStrong};
      box-shadow: 0 32px 64px -24px rgba(0,0,0,.7);
    }

    /* the piece page, and only the piece page, opens to the drawn desk size */
    @media (min-width: ${PIECE_DESK_MIN}px) {
      .collector-frame[data-wide="1"] {
        max-width: 1280px;
        height: 1020px;
        border-radius: 6px;
        border-color: rgba(237,233,226,.13);

        --pp-pad: 64px 40px 44px;
        --pp-text: center;
        --pp-measure: 460px;

        --pp-head-border: 0;
        --pp-head-justify: center;
        --pp-head-gap: 16px;

        --pp-status-size: 13.5px;
        --pp-status-top: 12px;

        --pp-quote-top: 36px;
        --pp-link-align: left;

        --pp-band-min: 150px;
        --pp-band-max: 320px;

        --pp-foot-push: auto;
        --pp-foot-border: 1px solid rgba(237,233,226,.13);
        --pp-foot-top: 4px;
        --pp-foot-items: stretch;
        --pp-foot-justify: space-between;
        --pp-foot-gap: 0px;
        --pp-foot-flex: 1 1 0%;
        --pp-foot-divider: none;
        --pp-foot-size: 15px;
      }
    }
  `}</style>
);
