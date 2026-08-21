/**
 * How the journey is displayed, and the difference between looking at it and
 * using it.
 *
 * TWO FRAMES, and only one of them is the product.
 *
 *   card — the review vehicle. A 390 by 844 phone floating on a dark page,
 *          with the harness underneath it. This is how the journey is checked
 *          against the design file: the artboard, at the artboard's size,
 *          honestly. It is not how anyone uses the thing.
 *
 *   full — the journey IS the page. It fills whatever screen it is opened on,
 *          no border, no corner radius, no shadow, nothing floating. A
 *          collector scanning the plate on a phone gets their whole screen; on
 *          a desk they get the whole window. This is the product.
 *
 * The card was the only mode until now, which is why the built journey read as
 * a demo: a phone-shaped card in the middle of a 1440 window is a picture of an
 * app, not an app.
 *
 * WHAT CHANGES WITH SCREEN SIZE
 *
 * The design file draws 174 screens at 390 by 844 and exactly one at 1280 by
 * 1020: the piece page. So there are two rules, not one.
 *
 *   The piece page has a drawing at both sizes and uses it. Past 1180 the head
 *   loses its rule and centres, the light spans the width and caps at 320 tall,
 *   and the rows and foot hold a 460 measure. Its content caps at the drawn
 *   1280 and centres, so a 2560 monitor gets more ground, never a wider
 *   drawing.
 *
 *   Every other screen has no desk drawing. Stretching a line of type across
 *   1900 is not that drawing made bigger, it is a different and worse one. So
 *   the ground fills the screen and the words hold a 520 measure inside it,
 *   centred. That is the same rule the one desk drawing states, applied where
 *   no drawing exists rather than inventing a layout nobody approved.
 *
 * HOW IT IS APPLIED
 *
 * Every value here is a CSS custom property whose FALLBACK, written at each use
 * site, is the phone value the screen already had. Below 1180 nothing here is
 * defined, every site falls back, and the phone renders exactly as before.
 * Media queries cannot override inline styles without `!important` and this
 * surface is inline-styled throughout, so custom properties are what let one
 * page serve both sizes instead of two copies drifting apart.
 *
 * ONE KNOWN DEVIATION from the wide artboard, kept deliberately: its foot
 * carries the two doors and nothing else, while the built foot also carries the
 * short line beneath them (`COPY.page.registeredNotYoursNote`), Adrian's chosen
 * wording from 2026-08-20. Approved copy is not dropped to match a drawing. If
 * the drawing is the later decision, remove the line in `PiecePage.tsx` rather
 * than hiding it here.
 */

import React from 'react';
import { espresso } from '../ceremony/tokens';

const C = espresso.palette;

/** the width at which the wide artboard, and the desk measure, take over */
export const DESK_MIN = 1180;

/** the drawn width of the piece page; its content never exceeds it */
export const PIECE_DRAWN_WIDTH = 1280;

/** the measure the undrawn screens hold at desk width */
export const DESK_MEASURE = 520;

export const CollectorDisplay: React.FC = () => (
  <style>{`
    /* ── the card: the review vehicle ─────────────────────────────────
       The phone, at the size it was drawn. Everything about this mode is
       scaffolding for looking at the journey, and none of it ships. */
    .collector-stage { display: flex; flex-direction: column; align-items: center; }
    .collector-stage[data-frame="card"] { padding: 28px 16px 64px }

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

    /* ── full: the journey is the page ────────────────────────────────
       No frame at all. The ground is the screen. */
    .collector-stage[data-frame="full"] { padding: 0 }
    .collector-frame[data-frame="full"] {
      max-width: none;
      height: 100dvh;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }

    @media (min-width: ${DESK_MIN}px) {
      /* Screens with no desk drawing: ground fills, words hold a measure.
         Withheld from the piece page, which has a drawing of its own. */
      .collector-frame[data-frame="full"][data-wide="0"] {
        --cc-measure: ${DESK_MEASURE}px;
        --cc-pad-desk: 1;
      }

      /* The piece page, at the size it was drawn. Applies in BOTH frames:
         in the card the frame itself becomes 1280 by 1020; in full the
         ground fills the screen and the content caps at the drawn width. */
      .collector-frame[data-wide="1"] {
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

      /* the card grows to the artboard; the full page holds it to the
         artboard's width and gives the rest back as ground */
      .collector-frame[data-frame="card"][data-wide="1"] {
        max-width: ${PIECE_DRAWN_WIDTH}px;
        height: 1020px;
        border-radius: 6px;
        border-color: rgba(237,233,226,.13);
      }
      .collector-frame[data-frame="full"][data-wide="1"] {
        --pp-frame-max: ${PIECE_DRAWN_WIDTH}px;
      }
    }
  `}</style>
);
