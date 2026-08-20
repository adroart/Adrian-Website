/**
 * The ceremony kit's theme: every palette, type-stack, and paper-layer value
 * the ceremony surfaces draw with, gathered into one object so a whole surface
 * can be re-dressed by passing a different theme.
 *
 * Today there is exactly one theme, `espresso`, lifted verbatim from the
 * Claude Design project `Collector Piece Page.dc.html`. The collector journey
 * and the artist-side registration ceremony both wear it. The parameterization
 * exists so a sibling theme could be passed in later; it does not invent any
 * value the collector's `tokens.ts` did not already define.
 *
 * These are NOT the site's design tokens. The paper/wood/stone/bronze palette
 * in `src/index.css` dresses the public site; the ceremony surfaces are their
 * own dark, metallic room, and the design doc specifies them in raw hex.
 */

import type { CSSProperties } from 'react';

/** the espresso room's inks, grounds, brass, and hairlines */
export type CeremonyPalette = {
  /** the page behind the phone, and the deepest ground */
  void: string;
  /** the screen's own ground */
  ground: string;
  /** a raised sheet sitting on the ground (the explainer, the letter) */
  sheet: string;

  /** primary ink */
  ink: string;
  /** body ink, one step back */
  inkBody: string;
  /** quiet ink: captions, labels, anything secondary */
  inkQuiet: string;
  /** the quietest: placeholder text inside a field */
  inkGhost: string;
  /** warmed ink, for something the caretaker placed */
  inkWarm: string;
  /** the ink on brass */
  inkBrass: string;

  /** brass. Appears ONLY on something you can act on, and never shifts with
   *  season. This is the law that keeps every screen legible. */
  brass: string;
  brassLit: string;
  brassEdge: string;
  /** the light itself: the star, the orbit bodies, the map lights */
  light: string;

  /** the one error tone. Cells go this colour and nothing else changes. */
  wrong: string;
  wrongEdge: string;

  /** hairlines, in the three weights the design uses */
  hair: string;
  hairMid: string;
  hairStrong: string;
};

/** the three type stacks, plus the mono the code cells fall back to */
export type CeremonyFonts = {
  /** titles and display only, never under 20px */
  display: string;
  /** all body, captions, meta */
  body: string;
  /** UPPERCASE eyebrows and labels only */
  label: string;
  /** the code cells and the lock readout */
  mono: string;
};

/**
 * The whole theme: the palette, the type stacks, and the laid-paper layers
 * every ceremony screen carries.
 */
export type CeremonyTheme = {
  palette: CeremonyPalette;
  fonts: CeremonyFonts;

  /** laid paper, layer one: the woven grain */
  grain: string;
  /** laid paper, layer two: the dot tooth */
  tooth: string;
  /** laid paper, layer three: per-screen vignettes, keyed by the design doc's
   *  own screen ids, so each screen keeps the light it was drawn with */
  vignettes: Record<string, string>;
  /** the warm wash the setup screens carry under the vignette */
  setupWash: string;

  /** brass glass: one even film for the thing you are about to do, a hairline,
   *  and a half pixel of light along the top. The button, settled. */
  brassGlass: CSSProperties;
  /** the track a two-way choice sits in */
  trackGlass: CSSProperties;
};

/* ------------------------------------------------------------------ *
 * The espresso theme, verbatim from the design file
 * ------------------------------------------------------------------ */

const palette: CeremonyPalette = {
  void: '#0d0b09',
  ground: '#1d1714',
  sheet: '#211a16',

  ink: '#ede9e2',
  inkBody: '#c4beb4',
  inkQuiet: '#8d867c',
  inkGhost: '#6f6a62',
  inkWarm: '#f2e3c4',
  inkBrass: '#f4e9d6',

  brass: '#d4b88a',
  brassLit: '#e2c99f',
  brassEdge: '#5a4a30',
  light: '#f0d79a',

  wrong: '#e0a08a',
  wrongEdge: 'rgba(196,90,60,.55)',

  hair: 'rgba(237,233,226,.07)',
  hairMid: 'rgba(237,233,226,.09)',
  hairStrong: 'rgba(237,233,226,.13)',
};

/** Type: Cormorant Garamond at 20px and up only, Lora for body, Karla for
 *  uppercase labels only. All three are already installed via @fontsource.
 *  The design doc specifies IBM Plex Mono for the code cells, which is not
 *  installed; it falls back to the platform's own mono until that is decided. */
const fonts: CeremonyFonts = {
  display: "'Cormorant Garamond', Georgia, serif",
  body: "'Lora', Georgia, serif",
  label: "'Karla', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export const espresso: CeremonyTheme = {
  palette,
  fonts,

  grain:
    'repeating-linear-gradient(92deg,rgba(0,0,0,.2) 0 1px,transparent 1px 4px),' +
    'repeating-linear-gradient(2deg,rgba(240,215,154,.03) 0 1px,transparent 1px 9px)',

  tooth: 'radial-gradient(rgba(240,215,154,.05) .6px,transparent .7px)',

  vignettes: {
    a: 'radial-gradient(105% 78% at 28% 24%,rgba(58,48,40,.5) 0%,rgba(29,23,20,0) 66%),linear-gradient(168deg,rgba(0,0,0,.2) 0%,transparent 46%,rgba(0,0,0,.3) 100%)',
    b: 'radial-gradient(95% 70% at 74% 34%,rgba(58,48,40,.46) 0%,rgba(29,23,20,0) 64%),linear-gradient(196deg,rgba(0,0,0,.16) 0%,transparent 52%,rgba(0,0,0,.28) 100%)',
    c: 'radial-gradient(100% 62% at 50% 8%,rgba(74,60,44,.5) 0%,rgba(29,23,20,0) 62%),linear-gradient(180deg,rgba(0,0,0,.12) 0%,transparent 40%,rgba(0,0,0,.3) 100%)',
    d: 'radial-gradient(96% 60% at 50% 84%,rgba(58,48,40,.4) 0%,rgba(29,23,20,0) 62%),linear-gradient(180deg,rgba(0,0,0,.24) 0%,transparent 44%,rgba(0,0,0,.24) 100%)',
    e: 'radial-gradient(90% 58% at 50% 22%,rgba(58,48,40,.42) 0%,rgba(29,23,20,0) 62%),linear-gradient(180deg,rgba(0,0,0,.2) 0%,transparent 46%,rgba(0,0,0,.28) 100%)',
    f: 'radial-gradient(95% 62% at 30% 26%,rgba(58,48,40,.44) 0%,rgba(29,23,20,0) 64%),linear-gradient(190deg,rgba(0,0,0,.18) 0%,transparent 50%,rgba(0,0,0,.28) 100%)',
    g: 'radial-gradient(92% 58% at 50% 18%,rgba(58,48,40,.4) 0%,rgba(29,23,20,0) 62%),linear-gradient(180deg,rgba(0,0,0,.2) 0%,transparent 48%,rgba(0,0,0,.26) 100%)',
    h: 'radial-gradient(100% 70% at 50% 30%,rgba(58,48,40,.3) 0%,rgba(29,23,20,0) 66%),linear-gradient(180deg,rgba(0,0,0,.22) 0%,transparent 48%,rgba(0,0,0,.3) 100%)',
    i: 'radial-gradient(120% 62% at 50% 84%,rgba(58,48,40,.44) 0%,rgba(29,23,20,0) 62%),linear-gradient(0deg,rgba(0,0,0,.22) 0%,transparent 44%)',
    j: 'radial-gradient(88% 88% at 18% 68%,rgba(58,48,40,.44) 0%,rgba(29,23,20,0) 62%),linear-gradient(112deg,transparent 0%,rgba(0,0,0,.26) 100%)',
    k: 'radial-gradient(100% 66% at 66% 12%,rgba(60,49,40,.48) 0%,rgba(29,23,20,0) 60%),linear-gradient(184deg,transparent 38%,rgba(0,0,0,.3) 100%)',
    l: 'radial-gradient(130% 84% at 42% 52%,rgba(56,46,38,.42) 0%,rgba(29,23,20,0) 70%),linear-gradient(76deg,rgba(0,0,0,.22) 0%,transparent 58%)',
    m: 'radial-gradient(92% 74% at 84% 74%,rgba(58,48,40,.44) 0%,rgba(29,23,20,0) 62%),linear-gradient(248deg,rgba(0,0,0,.2) 0%,transparent 54%)',
    n: 'radial-gradient(110% 58% at 32% 6%,rgba(60,49,40,.5) 0%,rgba(29,23,20,0) 58%),linear-gradient(8deg,rgba(0,0,0,.24) 0%,transparent 48%)',
    o: 'radial-gradient(118% 72% at 12% 40%,rgba(58,48,40,.46) 0%,rgba(29,23,20,0) 64%),linear-gradient(148deg,transparent 42%,rgba(0,0,0,.26) 100%)',
    p: 'radial-gradient(96% 68% at 50% 22%,rgba(60,49,40,.44) 0%,rgba(29,23,20,0) 62%),linear-gradient(216deg,rgba(0,0,0,.18) 0%,transparent 50%,rgba(0,0,0,.22) 100%)',
    q: 'radial-gradient(124% 80% at 78% 56%,rgba(56,46,38,.42) 0%,rgba(29,23,20,0) 66%),linear-gradient(24deg,rgba(0,0,0,.2) 0%,transparent 52%)',
    r: 'radial-gradient(84% 96% at 58% 46%,rgba(56,46,38,.4) 0%,rgba(29,23,20,0) 68%),linear-gradient(292deg,rgba(0,0,0,.22) 0%,transparent 56%)',
  },

  setupWash:
    'radial-gradient(78% 30% at 22% 46%,rgba(212,184,138,.07) 0%,transparent 72%)',

  /* OPEN, from the design doc's own note: blur costs frames on old phones, so
     a flat fallback still needs drawing before this ships. */
  brassGlass: {
    background: 'rgba(212,170,110,.13)',
    backdropFilter: 'blur(24px) saturate(145%)',
    boxShadow:
      'inset 0 .5px 0 rgba(255,244,220,.18), inset 0 0 0 1px rgba(226,190,134,.11)',
    color: palette.inkBrass,
  },

  trackGlass: {
    background: 'rgba(52,43,34,.34)',
    backdropFilter: 'blur(30px) saturate(140%)',
    boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.06)',
  },
};

export default espresso;
