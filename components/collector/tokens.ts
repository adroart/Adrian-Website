/**
 * The collector journey's tokens: the espresso theme of the shared ceremony
 * kit, re-exported under the names every collector screen already imports.
 *
 * The actual values live in `components/ceremony/tokens.ts`, lifted verbatim
 * from the Claude Design project `Collector Piece Page.dc.html`. They moved
 * there so the artist-side registration ceremony can wear the same room; this
 * file applies the espresso theme and changes nothing about it. A single edit
 * to the theme still re-tunes every screen.
 *
 * These are NOT the site's design tokens. The paper/wood/stone/bronze palette
 * in `src/index.css` dresses the public site; the collector surface is its own
 * dark, metallic room, and the design doc specifies it in raw hex.
 */

import { espresso } from '../ceremony/tokens';

export type { CeremonyPalette, CeremonyFonts, CeremonyTheme } from '../ceremony/tokens';
export { espresso };

/** the espresso palette: grounds, inks, brass, the one error tone, hairlines */
export const C = espresso.palette;

/** Cormorant Garamond at 20px and up only, Lora for body, Karla for uppercase
 *  labels only, and the mono the code cells fall back to */
export const F = espresso.fonts;

/** laid paper, layer one: the woven grain */
export const GRAIN = espresso.grain;

/** laid paper, layer two: the dot tooth */
export const TOOTH = espresso.tooth;

/** Per-screen vignettes, copied from the design doc so each screen keeps the
 *  light it was drawn with. Keyed by the design doc's own screen ids. */
export const VIGNETTE = espresso.vignettes;

/** the warm wash the setup screens carry under the vignette */
export const SETUP_WASH = espresso.setupWash;

/** Brass glass: one even film for the thing you are about to do, a hairline,
 *  and a half pixel of light along the top. The button, settled. */
export const BRASS_GLASS = espresso.brassGlass;

/** the track a two-way choice sits in */
export const TRACK_GLASS = espresso.trackGlass;
