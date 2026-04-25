
import React, { useEffect } from 'react';
import { CARD_BY_NUMBER, ALL_CARDS } from '../data/oracleData';

/* ─── Sample content — card 32, Art of Living ────────────────────────────── */

const SAMPLE = CARD_BY_NUMBER.get(32) ?? ALL_CARDS[0];
const PREV   = CARD_BY_NUMBER.get(SAMPLE.number - 1) ?? null;
const NEXT   = CARD_BY_NUMBER.get(SAMPLE.number + 1) ?? null;
const GK_P   = SAMPLE.gene_keys.description.split('\n\n').filter(Boolean)[0] ?? '';

/* ─── Google Fonts — all preview families ────────────────────────────────── */

const FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&' +
  'family=Bricolage+Grotesque:opsz,wght@12..96,200..800&' +
  'family=Crimson+Pro:wght@400;500;600&' +
  'family=DM+Sans:wght@300;400;500&' +
  'family=EB+Garamond:ital,wght@0,400;0,500;1,400&' +
  'family=Fraunces:opsz,wght@9..144,100..900&' +
  'family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&' +
  'family=Instrument+Serif:ital@0;1&' +
  'family=Italiana&' +
  'family=Jost:wght@300;400;500;600&' +
  'family=Karla:wght@300;400;500&' +
  'family=Lora:ital,wght@0,400;0,500;1,400&' +
  'family=Newsreader:opsz,wght@6..72,300..800&' +
  'family=Raleway:wght@200;300;400;500&' +
  'family=Source+Serif+4:opsz,wght@8..60,300..900&' +
  'family=Space+Grotesk:wght@300;400;500&' +
  'family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&' +
  'display=swap';

/* ─── Font system definitions ────────────────────────────────────────────── */

interface System {
  id: number;
  name: string;
  stack: string;
  personality: string;
  headingFamily: string;
  headingWeight: number;
  headingVariation?: string;
  bodyFamily: string;
  bodyWeight: number;
  bodyVariation?: string;
  labelFamily: string;
  labelWeight: number;
}

const SYSTEMS: System[] = [
  {
    id: 8,
    name: 'Keep the Crown',
    stack: 'Cormorant Garamond · Bricolage Grotesque · Jost',
    personality:
      'The title is sacred geometry. The body is earth and hands. You kept what you loved and grounded everything beneath it.',
    headingFamily: '"Cormorant Garamond", serif',
    headingWeight: 500,
    bodyFamily: '"Bricolage Grotesque", sans-serif',
    bodyWeight: 300,
    bodyVariation: '"opsz" 12',
    labelFamily: '"Jost", sans-serif',
    labelWeight: 400,
  },
  {
    id: 9,
    name: 'The Editorial Standard',
    stack: 'Cormorant Garamond · Newsreader · Jost',
    personality:
      'You take the oracle seriously enough to make it effortless to read. The title is beautiful. Nothing below it fights for attention.',
    headingFamily: '"Cormorant Garamond", serif',
    headingWeight: 500,
    bodyFamily: '"Newsreader", serif',
    bodyWeight: 400,
    bodyVariation: '"opsz" 12',
    labelFamily: '"Jost", sans-serif',
    labelWeight: 400,
  },
  {
    id: 10,
    name: 'The Screen Bodoni',
    stack: 'Bodoni Moda · Source Serif 4 · Space Grotesk',
    personality:
      'Same high-contrast drama as Cormorant but engineered for screens. The hairlines hold at every size. Precise, mathematical, and strangely alive.',
    headingFamily: '"Bodoni Moda", serif',
    headingWeight: 600,
    headingVariation: '"opsz" 96',
    bodyFamily: '"Source Serif 4", serif',
    bodyWeight: 350,
    bodyVariation: '"opsz" 12',
    labelFamily: '"Space Grotesk", sans-serif',
    labelWeight: 400,
  },
  {
    id: 11,
    name: 'Instrument',
    stack: 'Instrument Serif · Instrument Sans · Instrument Sans',
    personality:
      'One of the most awarded type systems of the last two years. Warm, precise, contemporary. Used on sites that win design awards, and genuinely deserve them.',
    headingFamily: '"Instrument Serif", serif',
    headingWeight: 400,
    bodyFamily: '"Instrument Sans", sans-serif',
    bodyWeight: 400,
    labelFamily: '"Instrument Sans", sans-serif',
    labelWeight: 600,
  },
  {
    id: 12,
    name: 'The Complete Voice',
    stack: 'Spectral · Spectral · DM Sans',
    personality:
      'One serif family (display, body, footnote) all by the same hand. The whole site speaks as one person from beginning to end. Very few sites do this well.',
    headingFamily: '"Spectral", serif',
    headingWeight: 600,
    bodyFamily: '"Spectral", serif',
    bodyWeight: 400,
    labelFamily: '"DM Sans", sans-serif',
    labelWeight: 400,
  },
  {
    id: 13,
    name: 'One Bloodline',
    stack: 'Cormorant Garamond · EB Garamond · Raleway',
    personality:
      'Two branches of the same 500-year-old Garamond tradition. Cormorant for the display moment, EB Garamond for reading. Raleway at hairline weight for labels creates a tension that feels architectural.',
    headingFamily: '"Cormorant Garamond", serif',
    headingWeight: 500,
    bodyFamily: '"EB Garamond", serif',
    bodyWeight: 400,
    labelFamily: '"Raleway", sans-serif',
    labelWeight: 300,
  },
  {
    id: 14,
    name: 'The Sacred Object',
    stack: 'Italiana · Crimson Pro · Jost',
    personality:
      'Italiana is the rarest display serif in this list. Almost nobody uses it. It has swash-influenced capitals and an Art Deco sacred quality that exists nowhere else in the mystical/oracle space. Completely original identity.',
    headingFamily: '"Italiana", serif',
    headingWeight: 400,
    bodyFamily: '"Crimson Pro", serif',
    bodyWeight: 400,
    labelFamily: '"Jost", sans-serif',
    labelWeight: 400,
  },
  {
    id: 15,
    name: 'The Warm Archive',
    stack: 'Cormorant Garamond · Lora · Karla',
    personality:
      'Cormorant for the title you love. Lora for body, a humanist serif with ball terminals and warmth that matches the earth palette exactly. Karla softens the label register so nothing feels cold.',
    headingFamily: '"Cormorant Garamond", serif',
    headingWeight: 500,
    bodyFamily: '"Lora", serif',
    bodyWeight: 400,
    labelFamily: '"Karla", sans-serif',
    labelWeight: 400,
  },
  {
    id: 16,
    name: 'The Made Thing',
    stack: 'Fraunces · Bricolage Grotesque · Jost',
    personality:
      'Two typefaces that feel handmade. Fraunces with its optical "wonkiness" at display weight, Bricolage with its organic proportions at body weight. Together they say: I built this myself and I meant every decision.',
    headingFamily: '"Fraunces", serif',
    headingWeight: 800,
    headingVariation: '"opsz" 144',
    bodyFamily: '"Bricolage Grotesque", sans-serif',
    bodyWeight: 300,
    bodyVariation: '"opsz" 12',
    labelFamily: '"Jost", sans-serif',
    labelWeight: 400,
  },
  {
    id: 17,
    name: 'Voltage',
    stack: 'Bodoni Moda · Bricolage Grotesque · Jost',
    personality:
      'The most unexpected pairing in the list. Bodoni Moda is razor-precise. Mathematical hairlines, exact geometry. Bricolage Grotesque is organic and irregular. The collision is the point. It says: I hold opposites without resolving them.',
    headingFamily: '"Bodoni Moda", serif',
    headingWeight: 700,
    headingVariation: '"opsz" 96',
    bodyFamily: '"Bricolage Grotesque", sans-serif',
    bodyWeight: 300,
    bodyVariation: '"opsz" 12',
    labelFamily: '"Jost", sans-serif',
    labelWeight: 400,
  },
];

/* ─── Single system preview ──────────────────────────────────────────────── */

const Preview: React.FC<{ s: System }> = ({ s }) => {
  const heading = (px: number): React.CSSProperties => ({
    fontFamily: s.headingFamily,
    fontWeight: s.headingWeight,
    fontSize: px,
    fontVariationSettings: s.headingVariation,
    lineHeight: 1.08,
  });

  const body = (px: number, lh = 1.85): React.CSSProperties => ({
    fontFamily: s.bodyFamily,
    fontWeight: s.bodyWeight,
    fontSize: px,
    fontVariationSettings: s.bodyVariation,
    lineHeight: lh,
  });

  const label = (px: number, tracking = '0.22em'): React.CSSProperties => ({
    fontFamily: s.labelFamily,
    fontWeight: s.labelWeight,
    fontSize: px,
    letterSpacing: tracking,
    textTransform: 'uppercase' as const,
    lineHeight: 1.2,
  });

  return (
    <div className="border-t-2 border-wood-300 pt-10 pb-14">

      {/* Option header */}
      <div className="mb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
          <span style={label(9, '0.3em')} className="text-bronze-600">
            Option {s.id}
          </span>
          <span
            style={{ fontFamily: s.headingFamily, fontWeight: s.headingWeight, fontSize: 26, fontVariationSettings: s.headingVariation, lineHeight: 1.1 }}
            className="text-wood-900"
          >
            {s.name}
          </span>
        </div>
        <p style={{ fontFamily: s.labelFamily, fontWeight: s.labelWeight, fontSize: 11, letterSpacing: '0.04em' }} className="text-wood-500 mb-2">
          {s.stack}
        </p>
        <p style={{ fontFamily: s.bodyFamily, fontWeight: s.bodyWeight, fontSize: 14, lineHeight: 1.65, fontVariationSettings: s.bodyVariation }} className="text-wood-600 max-w-lg">
          {s.personality}
        </p>
      </div>

      {/* Card preview */}
      <div className="border border-wood-200 bg-paper-50 p-6 sm:p-8 max-w-lg">

        {/* Breadcrumb */}
        <div style={label(9, '0.25em')} className="text-wood-500 mb-6">
          ← Universal Language
        </div>

        {/* Card number + ring name */}
        <div className="flex justify-between items-baseline mb-2">
          <span style={label(10, '0.1em')} className="text-bronze-700">
            {SAMPLE.number} / 64
          </span>
          <span style={label(10, '0.1em')} className="text-wood-600">
            {SAMPLE.ring_name}
          </span>
        </div>

        {/* Card name — the make-or-break moment */}
        <h2 style={heading(38)} className="text-wood-900 mb-2">
          {SAMPLE.card_name}
        </h2>

        {/* Hexagram subtitle */}
        <p style={{ ...body(18), lineHeight: 1.35 }} className="text-wood-700 mb-7">
          {SAMPLE.iching.hexagram_name}
        </p>

        {/* Gene Keys label */}
        <p style={label(10, '0.25em')} className="text-bronze-600 mb-3">
          Gene Keys
        </p>

        {/* Spectrum bar */}
        <div className="flex border border-wood-200 mb-5 bg-gradient-to-r from-wood-50 via-bronze-50 to-wood-50 overflow-hidden">
          <div className="flex-1 px-2 py-3 border-r border-wood-200 text-center">
            <p style={label(8)} className="text-stone-600 mb-1">Shadow</p>
            <p style={{ ...body(13), lineHeight: 1.2, fontWeight: 500 }} className="text-stone-600">
              {SAMPLE.gene_keys.shadow}
            </p>
          </div>
          <div className="flex-[1.2] relative px-2 py-3 border-r border-wood-200 text-center">
            <p style={label(8)} className="text-bronze-700 mb-1">Gift</p>
            <p style={{ ...body(13), lineHeight: 1.2, fontWeight: 500 }} className="text-bronze-700">
              {SAMPLE.gene_keys.gift}
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-bronze-400" />
          </div>
          <div className="flex-1 px-2 py-3 text-center">
            <p style={label(8)} className="text-wood-500 mb-1">Siddhi</p>
            <p style={{ ...body(13), lineHeight: 1.2, fontWeight: 500 }} className="text-wood-500">
              {SAMPLE.gene_keys.siddhi}
            </p>
          </div>
        </div>

        {/* I Ching essence — short prose */}
        <div className="border-l-2 border-bronze-300/60 pl-4 mb-5">
          <p style={body(15)} className="text-wood-600">
            {SAMPLE.iching.essence}
          </p>
        </div>

        {/* Gene Keys paragraph — the main readability test */}
        <p style={body(15)} className="text-wood-700 mb-6">
          {GK_P}
        </p>

        {/* Attribution footnote */}
        <p style={{ fontFamily: s.bodyFamily, fontWeight: s.bodyWeight, fontSize: 12, fontVariationSettings: s.bodyVariation, lineHeight: 1.5 }} className="text-wood-400 mb-5">
          Gene Keys text based on the work of Richard Rudd, genekeys.com
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-wood-200">
          {PREV && (
            <div>
              <p style={label(9)} className="text-wood-500 mb-0.5">← Prev</p>
              <p style={{ ...body(13), lineHeight: 1.3 }} className="text-wood-700">
                {PREV.number}. {PREV.card_name}
              </p>
            </div>
          )}
          <p style={{ ...label(9, '0.2em'), border: '1px solid', padding: '3px 10px' }} className="text-wood-600 border-wood-300">
            All 64
          </p>
          {NEXT && (
            <div className="text-right">
              <p style={label(9)} className="text-wood-500 mb-0.5">Next →</p>
              <p style={{ ...body(13), lineHeight: 1.3 }} className="text-wood-700">
                {NEXT.number}. {NEXT.card_name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Main ───────────────────────────────────────────────────────────────── */

const FontPreview: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-24 pb-32">

        <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-5">
          Round Two
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl text-wood-900 font-medium leading-[1.1] mb-4">
          Ten Font Systems
        </h1>
        <p className="font-sans text-base text-wood-600 leading-[1.8] mb-2">
          Each preview shows the full oracle card structure in that system. Heading, hexagram subtitle, I Ching quote, Gene Keys paragraph, spectrum bar, and navigation.
          Options 8 and 9 keep your Cormorant title. Options 16 and 17 are the most unexpected pairings.
        </p>
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 mb-0">
          Card {SAMPLE.number} · {SAMPLE.card_name} · {SAMPLE.iching.hexagram_name}
        </p>

        {SYSTEMS.map(s => <Preview key={s.id} s={s} />)}

        <div className="border-t border-wood-200 pt-8 mt-4">
          <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-300">
            Preview page · not linked from the site
          </p>
        </div>

      </div>
    </div>
  );
};

export default FontPreview;
