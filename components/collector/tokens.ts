/**
 * The collector journey's espresso palette, lifted verbatim from the Claude
 * Design project `Collector Piece Page.dc.html`.
 *
 * These are NOT new design tokens. The site's own paper/wood/stone/bronze
 * palette in `src/index.css` dresses the public site; the collector surface is
 * its own dark, metallic room, and the design doc specifies it in raw hex. They
 * live here rather than inline so a single edit re-tunes every screen.
 *
 * Type: Cormorant Garamond at 20px and up only, Lora for body, Karla for
 * uppercase labels only. All three are already installed via @fontsource.
 */

export const C = {
  /** the page behind the phone, and the deepest ground */
  void: '#0d0b09',
  /** the screen's own ground */
  ground: '#1d1714',
  /** a raised sheet sitting on the ground (the explainer, the letter) */
  sheet: '#211a16',

  /** primary ink */
  ink: '#ede9e2',
  /** body ink, one step back */
  inkBody: '#c4beb4',
  /** quiet ink: captions, labels, anything secondary */
  inkQuiet: '#8d867c',
  /** the quietest: placeholder text inside a field */
  inkGhost: '#6f6a62',
  /** warmed ink, for something the caretaker placed */
  inkWarm: '#f2e3c4',
  /** the ink on brass */
  inkBrass: '#f4e9d6',

  /** brass. Appears ONLY on something you can act on, and never shifts with
   *  season. This is the law that keeps every screen legible. */
  brass: '#d4b88a',
  brassLit: '#e2c99f',
  brassEdge: '#5a4a30',
  /** the light itself: the star, the orbit bodies, the map lights */
  light: '#f0d79a',

  /** the one error tone. Cells go this colour and nothing else changes. */
  wrong: '#e0a08a',
  wrongEdge: 'rgba(196,90,60,.55)',

  /** hairlines, in the three weights the design uses */
  hair: 'rgba(237,233,226,.07)',
  hairMid: 'rgba(237,233,226,.09)',
  hairStrong: 'rgba(237,233,226,.13)',
} as const;

export const F = {
  /** Cormorant Garamond. Titles and display only, never under 20px. */
  display: "'Cormorant Garamond', Georgia, serif",
  /** Lora. All body, captions, meta. */
  body: "'Lora', Georgia, serif",
  /** Karla. UPPERCASE eyebrows and labels only. */
  label: "'Karla', system-ui, sans-serif",
  /** the code cells and the lock readout.
   *  The design doc specifies IBM Plex Mono, which is not installed here.
   *  Falls back to the platform's own mono until that is decided. */
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/**
 * The three background layers every collector screen carries, in order.
 * Laid paper, in the dark: a woven grain, a dot tooth, then a vignette that
 * moves per screen so no two screens light identically.
 */
export const GRAIN =
  'repeating-linear-gradient(92deg,rgba(0,0,0,.2) 0 1px,transparent 1px 4px),' +
  'repeating-linear-gradient(2deg,rgba(240,215,154,.03) 0 1px,transparent 1px 9px)';

export const TOOTH = 'radial-gradient(rgba(240,215,154,.05) .6px,transparent .7px)';

/** Per-screen vignettes, copied from the design doc so each screen keeps the
 *  light it was drawn with. Keyed by the design doc's own screen ids. */
export const VIGNETTE: Record<string, string> = {
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
};

/** the warm wash the setup screens carry under the vignette */
export const SETUP_WASH =
  'radial-gradient(78% 30% at 22% 46%,rgba(212,184,138,.07) 0%,transparent 72%)';

/**
 * Brass glass: one even film for the thing you are about to do, a hairline,
 * and a half pixel of light along the top. The button, settled.
 *
 * OPEN, from the design doc's own note: blur costs frames on old phones, so a
 * flat fallback still needs drawing before this ships.
 */
export const BRASS_GLASS: React.CSSProperties = {
  background: 'rgba(212,170,110,.13)',
  backdropFilter: 'blur(24px) saturate(145%)',
  boxShadow:
    'inset 0 .5px 0 rgba(255,244,220,.18), inset 0 0 0 1px rgba(226,190,134,.11)',
  color: C.inkBrass,
};

/** the track a two-way choice sits in */
export const TRACK_GLASS: React.CSSProperties = {
  background: 'rgba(52,43,34,.34)',
  backdropFilter: 'blur(30px) saturate(140%)',
  boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.06)',
};
