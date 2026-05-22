
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CODON_RINGS, ALL_CARDS, CARD_BY_NUMBER, type OracleCard } from '../data/oracleData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';

type ViewMode = 'grid' | 'rings';
type GridMode = 'cards' | 'artwork';

/* ─── Card image lookup ──────────────────────────────────────────────────── */

const UL_IMAGE_BY_NUMBER = new Map<number, string>(
  FULL_ARCHIVE
    .filter(a => a.series === 'Universal Language')
    .map(a => {
      const num = parseInt(a.coverImage.split('_')[0], 10);
      return [num, a.coverImage] as [number, string];
    })
    .filter(([num]) => !isNaN(num))
);


function cardImageUrl(number: number, size: number): string {
  const publicId = UL_IMAGE_BY_NUMBER.get(number);
  if (!publicId) return img('adrian-website/placeholders/oracle-card-3', { w: size, h: size });
  return img(publicId, { w: size, h: size, crop: 'fill', gravity: 'center', format: 'webp' });
}

/* ─── Hexagram SVG renderer ─────────────────────────────────────────────── */
// Unicode trigram chars → [top, mid, bot] solid (true) or broken (false).
// Each trigram has 3 lines displayed top-to-bottom.
const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],  // Qian / Heaven
  '☷': [false, false, false],  // Kun  / Earth
  '☳': [false, false, true ],  // Zhen / Thunder
  '☵': [false, true,  false],  // Kan  / Water
  '☶': [true,  false, false],  // Gen  / Mountain
  '☴': [true,  true,  false],  // Xun  / Wind
  '☲': [true,  false, true ],  // Li   / Fire
  '☱': [false, true,  true ],  // Dui  / Lake
};

// Draws a full hexagram (6 lines) as SVG with precise coordinates.
const HexagramSVG: React.FC<{ upper: string; lower: string }> = ({ upper, lower }) => {
  const uLines = TRIGRAM_LINES[upper] ?? [true, true, true];
  const lLines = TRIGRAM_LINES[lower] ?? [true, true, true];
  const lines = [...uLines, ...lLines]; // 6 lines, top → bottom

  const lineH = 4;
  const lineGap = 4;
  const W = 40;
  const brokenGap = 8;
  const halfW = (W - brokenGap) / 2; // 16

  return (
    <svg viewBox="0 0 40 46" width="100%" height="100%" aria-hidden>
      {lines.map((solid, i) => {
        const y = 1 + i * (lineH + lineGap);
        return solid ? (
          <rect key={i} x={0} y={y} width={W} height={lineH} fill="currentColor" />
        ) : (
          <g key={i}>
            <rect x={0}                y={y} width={halfW} height={lineH} fill="currentColor" />
            <rect x={halfW + brokenGap} y={y} width={halfW} height={lineH} fill="currentColor" />
          </g>
        );
      })}
    </svg>
  );
};

/* ─── Flip card tile (grid view) ─────────────────────────────────────────── */

const CardThumbnail: React.FC<{
  card: OracleCard;
  isFlipped: boolean;
  artworkMode: boolean;
  onFlip: () => void;
  onFlipBack: () => void;
}> = ({ card, isFlipped, artworkMode, onFlip, onFlipBack }) => {
  const navigate = useNavigate();
  const goRead = () => navigate(`/oracle/universal-language/${card.number}`, { state: { ritual: true } });

  // Artwork mode renders the front face flat - no 3D layer per tile.
  if (artworkMode) {
    return (
      <div className="relative w-full aspect-square bg-[#e0d8cc] select-none">
        <button
          type="button"
          onClick={goRead}
          aria-label={`Read ${card.card_name}, Card ${card.number}`}
          className="absolute inset-0 cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
        >
          <img
            src={cardImageUrl(card.number, 320)}
            alt={`${card.card_name}, Universal Language ${card.number}`}
            className="w-full h-full object-cover block"
            loading="lazy"
            decoding="async"
          />
        </button>
      </div>
    );
  }

  // Both faces share the same shape: square image area + 44px action strip beneath.
  // Strip sits OUTSIDE the image - nothing ever covers the art.
  return (
    <div className={`[perspective:600px] relative select-none ${isFlipped ? 'z-10' : ''}`}>
      <div
        className={`relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* BACK face - hexagram only, no card background. Page background shows through. */}
        <button
          type="button"
          onClick={onFlip}
          aria-label={`Reveal Card ${card.number}: ${card.iching.hexagram_name}`}
          className="absolute inset-0 [backface-visibility:hidden] bg-transparent flex flex-col items-center justify-center gap-2 cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
        >
          <span className="w-[55%] max-w-[62px] text-wood-900">
            <HexagramSVG
              upper={card.iching.upper_trigram.symbol}
              lower={card.iching.lower_trigram.symbol}
            />
          </span>
          <span className="font-label font-bold text-[14px] text-wood-900 leading-none">
            {card.number}
          </span>
        </button>

        {/* FRONT face - art square (uncovered) + action strip beneath */}
        <div className="relative w-full [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
          {/* Art - clean, nothing overlaid */}
          <button
            type="button"
            onClick={goRead}
            aria-label={`Read ${card.card_name}, Card ${card.number}`}
            className="block w-full aspect-square bg-[#e0d8cc] cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
          >
            <img
              src={cardImageUrl(card.number, 320)}
              alt={`${card.card_name}, Universal Language ${card.number}`}
              className="w-full h-full object-cover block"
              loading="lazy"
              decoding="async"
            />
          </button>

          {/* Action strip - BELOW the image, never overlaps */}
          <div className="h-11 flex items-stretch bg-paper-100">
            <button
              type="button"
              onClick={onFlipBack}
              aria-label={`Flip Card ${card.number} back to hexagram`}
              className="flex-1 flex items-center justify-center font-label text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-wood-700 hover:text-wood-900 font-semibold transition-colors leading-none cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
            >
              Back
            </button>
            <span aria-hidden className="w-px self-center h-3 bg-wood-400" />
            <button
              type="button"
              onClick={goRead}
              aria-label={`Read ${card.card_name}, Card ${card.number}`}
              className="flex-1 flex items-center justify-center font-label text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-bronze-700 hover:text-wood-900 font-semibold transition-colors leading-none cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
            >
              Read
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Ring card tile (rings view) ────────────────────────────────────────── */

const RingCardTile: React.FC<{ card: OracleCard }> = ({ card }) => (
  <Link
    to={`/oracle/universal-language/${card.number}`}
    state={{ ritual: true }}
    className="group block"
  >
    {/* Image */}
    <div className="relative aspect-square overflow-hidden mb-3">
      <img
        src={cardImageUrl(card.number, 400)}
        alt={`${card.card_name}, Card ${card.number}, Universal Language Oracle`}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    </div>

    {/* Info below image */}
    <div className="px-0.5">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-label text-[11px] uppercase tracking-[0.1em] text-bronze-700 flex-shrink-0">
          {String(card.number).padStart(2, '0')}
        </span>
        <h4 className="font-sans text-base text-wood-900 font-medium leading-tight group-hover:text-bronze-700 transition-colors duration-200">
          {card.card_name}
        </h4>
      </div>
      <p className="font-sans text-sm text-wood-700 leading-snug mb-2">
        {card.iching.hexagram_name}
      </p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-label text-[11px] uppercase tracking-[0.08em] text-wood-600">{card.gene_keys.shadow}</span>
        <span aria-hidden className="text-wood-400 text-[11px]">·</span>
        <span className="font-label text-[11px] uppercase tracking-[0.08em] text-bronze-700">{card.gene_keys.gift}</span>
        <span aria-hidden className="text-wood-400 text-[11px]">·</span>
        <span className="font-label text-[11px] uppercase tracking-[0.08em] text-wood-600">{card.gene_keys.siddhi}</span>
      </div>
    </div>
  </Link>
);

/* ─── Ring section (rings view) ──────────────────────────────────────────── */

const RingSection: React.FC<{
  ring_name: string;
  tarot: string;
  description: string;
  cards: OracleCard[];
}> = ({ ring_name, tarot, description, cards }) => (
  <div className="border-t border-wood-200 pt-10 pb-6">
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
        <h3 className="font-serif text-xl text-wood-900 font-medium">{ring_name}</h3>
        <span className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-700">{tarot}</span>
      </div>
      <p className="font-sans text-sm text-wood-700 max-w-xl leading-[1.65]">{description}</p>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
      {cards.map(card => <RingCardTile key={card.number} card={card} />)}
    </div>
  </div>
);

/* ─── Search bar ─────────────────────────────────────────────────────────── */

const SearchBar: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="relative flex-1">
    <label htmlFor="ul-search" className="sr-only">Search cards</label>
    <input
      id="ul-search"
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
      placeholder="Search cards..."
      aria-label="Search cards"
      className="w-full bg-transparent border border-wood-400 focus:border-bronze-700 text-wood-900 placeholder-wood-600 font-sans text-sm px-4 py-2.5 min-h-[44px] outline-none focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors duration-200"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-3 top-1/2 -translate-y-1/2 font-label text-[11px] uppercase tracking-widest text-wood-700 hover:text-wood-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        Clear
      </button>
    )}
  </div>
);

/* ─── Grid mode toggle ───────────────────────────────────────────────────── */

const GridToggle: React.FC<{
  gridMode: GridMode;
  viewMode: ViewMode;
  onGridMode: (m: GridMode) => void;
  onViewMode: (v: ViewMode) => void;
}> = ({ gridMode, viewMode, onGridMode, onViewMode }) => {
  const btnBase = 'font-label text-[11px] uppercase tracking-[0.18em] px-4 min-h-[44px] border transition-colors duration-200 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2';
  const active = 'bg-wood-900 text-paper-50 border-wood-900 z-10 relative';
  const inactive = 'text-wood-700 border-wood-400 hover:text-wood-900 hover:border-wood-700 bg-transparent';

  const isCards = viewMode === 'grid' && gridMode === 'cards';
  const isArtwork = viewMode === 'grid' && gridMode === 'artwork';
  const isRings = viewMode === 'rings';

  return (
    <div role="group" aria-label="View mode" className="flex items-center">
      <button
        type="button"
        aria-pressed={isCards}
        onClick={() => { onGridMode('cards'); onViewMode('grid'); }}
        className={`${btnBase} ${isCards ? active : inactive}`}
      >
        I Ching
      </button>
      <button
        type="button"
        aria-pressed={isArtwork}
        onClick={() => { onGridMode('artwork'); onViewMode('grid'); }}
        className={`${btnBase} -ml-px ${isArtwork ? active : inactive}`}
      >
        Artwork
      </button>
      <button
        type="button"
        aria-pressed={isRings}
        onClick={() => onViewMode('rings')}
        className={`${btnBase} -ml-px ${isRings ? active : inactive}`}
      >
        By Ring
      </button>
    </div>
  );
};

/* ─── Empty state ────────────────────────────────────────────────────────── */

const EmptyState: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="border-t border-wood-200 pt-16 text-center py-24">
    <p className="font-serif text-xl text-wood-700 mb-4">No cards match that search.</p>
    <button
      onClick={onClear}
      className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-700 hover:text-wood-900 transition-colors border-b border-bronze-700/50 pb-px"
    >
      Clear search
    </button>
  </div>
);

/* ─── Featured row: today, this year, your grid ──────────────────────────── */

// Stable string hash → 1..64. Same input always returns the same card.
function hashTo64(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((Math.abs(h) % 64) + 1);
}

function cardForToday(now = new Date()): OracleCard {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return CARD_BY_NUMBER.get(hashTo64(`day:${y}-${m}-${d}`))!;
}

function cardForYear(now = new Date()): OracleCard {
  return CARD_BY_NUMBER.get(hashTo64(`year:${now.getFullYear()}`))!;
}

const FeaturedTile: React.FC<{
  eyebrow: string;
  number: number;
  numberAlign: 'left' | 'right';
  title: string;
  meta?: string;
  to: string;
}> = ({ eyebrow, number, numberAlign, title, meta, to }) => {
  const navigate = useNavigate();
  const onClick = () => navigate(to, { state: { ritual: true } });
  const numStr = String(number).padStart(2, '0');

  // Eyebrow row: "CARD OF THE DAY · 28" or "34 · CARD OF THE YEAR"
  const eyebrowRow = numberAlign === 'left'
    ? <><span>{eyebrow}</span><span aria-hidden className="mx-2 text-bronze-700/60">·</span><span className="text-wood-900 font-bold">{numStr}</span></>
    : <><span className="text-wood-900 font-bold">{numStr}</span><span aria-hidden className="mx-2 text-bronze-700/60">·</span><span>{eyebrow}</span></>;

  const justify = numberAlign === 'left' ? 'justify-start' : 'justify-end';
  const textAlign = numberAlign === 'left' ? 'text-left' : 'text-right';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${eyebrow}, number ${number}: ${title}`}
      className={`group ${textAlign} px-5 py-4 transition-colors duration-200 hover:bg-paper-100 cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]`}
    >
      <p className={`flex items-baseline ${justify} font-label text-[10px] uppercase tracking-[0.2em] text-bronze-700`}>
        {eyebrowRow}
      </p>
      <div className={`flex items-baseline ${justify} gap-3 mt-1.5`}>
        <p className="font-serif text-lg sm:text-xl text-wood-900 font-medium leading-tight">
          {title}
        </p>
      </div>
      {meta && (
        <p className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 mt-1">
          {meta}
        </p>
      )}
      <p className={`flex ${justify} mt-3`}>
        <span
          aria-hidden
          className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-700 group-hover:text-wood-900 transition-colors"
        >
          Enter →
        </span>
      </p>
    </button>
  );
};

const FeaturedRow: React.FC = () => {
  const now = new Date();
  const today = cardForToday(now);
  const year = cardForYear(now);

  const dateLabel = now.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const yearLabel = String(now.getFullYear());

  return (
    <section
      aria-label="Featured readings"
      className="px-6 pt-10 pb-2 max-w-7xl mx-auto"
    >
      <div className="border border-wood-200 bg-paper-100/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-wood-200 divide-y sm:divide-y-0">
          <FeaturedTile
            eyebrow="Card of the Day"
            number={today.number}
            numberAlign="left"
            title={today.card_name}
            meta={dateLabel}
            to={`/oracle/universal-language/${today.number}`}
          />
          <FeaturedTile
            eyebrow="Card of the Year"
            number={year.number}
            numberAlign="right"
            title={year.card_name}
            meta={yearLabel}
            to={`/oracle/universal-language/${year.number}`}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          disabled
          aria-label="Your astrology grid, link your birthday to the oracle, coming soon"
          className="flex flex-col items-center text-center border border-wood-400 px-6 py-3 cursor-not-allowed opacity-80"
        >
          <span className="font-label text-xs uppercase tracking-[0.22em] text-wood-700">
            Your Astrology Grid
          </span>
          <span className="font-sans text-[12px] text-wood-500 leading-snug mt-1">
            Link your birthday to the oracle · coming soon
          </span>
        </button>
      </div>
    </section>
  );
};

/* ─── Main component ─────────────────────────────────────────────────────── */

const UniversalLanguageIndex: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridMode, setGridMode] = useState<GridMode>('cards');
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  const handleGridMode = (mode: GridMode) => {
    setGridMode(mode);
    setFlippedCards(new Set());
  };

  const flipCard = (number: number) => {
    setFlippedCards(prev => new Set([...prev, number]));
  };

  const flipCardBack = (number: number) => {
    setFlippedCards(prev => { const next = new Set(prev); next.delete(number); return next; });
  };

  const matchCard = (card: OracleCard, q: string): boolean => {
    const lq = q.toLowerCase();
    return (
      card.card_name.toLowerCase().includes(lq) ||
      card.iching.hexagram_name.toLowerCase().includes(lq) ||
      card.gene_keys.shadow.toLowerCase().includes(lq) ||
      card.gene_keys.gift.toLowerCase().includes(lq) ||
      card.gene_keys.siddhi.toLowerCase().includes(lq) ||
      card.element.toLowerCase().includes(lq) ||
      card.ring_name.toLowerCase().includes(lq) ||
      String(card.number) === lq.trim()
    );
  };

  const filteredCards = useMemo(() => {
    if (!query.trim()) return ALL_CARDS;
    return ALL_CARDS.filter(c => matchCard(c, query));
  }, [query]);

  const filteredRings = useMemo(() => {
    if (!query.trim()) return CODON_RINGS;
    return CODON_RINGS
      .map(ring => ({ ...ring, cards: ring.cards.filter(c => matchCard(c, query)) }))
      .filter(ring => ring.cards.length > 0);
  }, [query]);

  const totalShown = viewMode === 'grid'
    ? filteredCards.length
    : filteredRings.reduce((n, r) => n + r.cards.length, 0);

  const handleRandom = () => {
    const card = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    navigate(`/oracle/universal-language/${card.number}`, { state: { ritual: true } });
  };

  const gridInstruction = gridMode === 'cards'
    ? 'Tap a card to reveal it, then Read to enter'
    : 'Tap any card to enter';

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      {/* Top padding clears the fixed nav (--nav-height) + breathing room so the
          breadcrumb never tucks under the bar. */}
      <div className="relative px-6 pb-6 max-w-2xl mx-auto text-center pt-[calc(var(--nav-height)+2rem)] md:pt-[calc(var(--nav-height)+2.5rem)]">

        {/* Faint warm center glow — registers only as "the center is warmer" */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(138,116,78,0.10),transparent_70%)]"
        />

        {/* Breadcrumb — recedes to the lightest thing on the page */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap justify-center items-center gap-2 gap-y-1 font-label text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] text-wood-400 mb-7 sm:mb-8">
          <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
          <span aria-hidden className="text-wood-400">/</span>
          <span className="text-wood-500">Universal Language</span>
        </nav>

        {/* Title — single tone, carved feel */}
        <h1 className="font-serif text-5xl md:text-7xl text-wood-900 font-medium leading-[0.95] tracking-[-0.01em]">
          Universal Language
        </h1>
        <p className="font-serif italic text-xl md:text-2xl text-wood-500 font-light mt-2">
          Sixty-Four Expressions
        </p>

        {/* One thin divider rule */}
        <div aria-hidden className="w-12 h-px bg-bronze-600/30 mx-auto my-6" />

        {/* Opening invocation — the intention the deck is read through.
            Line breaks fall on clause boundaries so each line is a whole thought;
            the sm: break only engages once the column is wide enough to need it. */}
        <div className="font-serif italic text-lg md:text-xl text-wood-800 leading-[1.6] max-w-2xl mx-auto space-y-3">
          <p>
            <span aria-hidden className="text-bronze-600 not-italic mr-1.5">❧</span>
            Let this oracle be an instrument of attunement to the light within,
            <br className="hidden sm:inline" />{' '}
            as we move through the unfolding of this mystery.
          </p>
          <p>
            Let it nurture harmony, clarity, and compassion
            <br className="hidden sm:inline" />{' '}
            in thought, word, and action.
          </p>
          <p>
            Let us move beyond thoughts and in through the heart,
            <br className="hidden sm:inline" />{' '}
            in devotion and celebration of the perfection of this moment.
          </p>
        </div>

        {/* Single centered CTA */}
        <div className="flex justify-center mt-7">
          <button
            onClick={handleRandom}
            className="inline-flex items-center justify-center px-8 py-3.5 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold transition-all duration-200 hover:bg-bronze-600 motion-safe:hover:-translate-y-0.5 hover:shadow-lg hover:shadow-bronze-600/20"
          >
            Draw at Random
          </button>
        </div>
      </div>

      {/* Soft fade from hero into the deck — descend, don't hit a toolbar */}
      <div aria-hidden className="h-8 -mb-8 bg-gradient-to-b from-transparent to-paper-50" />

      {/* ── Featured: today, this year, your grid ─────────────────────────── */}
      <FeaturedRow />

      {/* ── Sticky search + tabs ───────────────────────────────────────────── */}
      <div className="sticky top-[var(--nav-height)] z-20 bg-paper-50 border-b border-wood-200">
        <div className="px-6 py-3 max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <SearchBar value={query} onChange={setQuery} />
          <GridToggle
            gridMode={gridMode}
            viewMode={viewMode}
            onGridMode={handleGridMode}
            onViewMode={setViewMode}
          />
        </div>
        {query && (
          <div className="px-6 pb-3 max-w-7xl mx-auto" aria-live="polite">
            <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700">
              {totalShown} {totalShown === 1 ? 'card' : 'cards'} found
            </p>
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-6 pb-32 max-w-7xl mx-auto">

        {/* Grid view */}
        {viewMode === 'grid' && (
          filteredCards.length > 0 ? (
            <>
              {/* First-time instruction */}
              <h2 className="sr-only">All cards</h2>
              <p className="pt-3 pb-3 font-label text-[11px] uppercase tracking-[0.18em] text-wood-600">
                {gridInstruction}
              </p>
              <div className="-mx-6 px-[5px] sm:mx-0 sm:px-0">
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-[3px]">
                  {filteredCards.map(card => (
                    <CardThumbnail
                      key={card.number}
                      card={card}
                      isFlipped={flippedCards.has(card.number)}
                      artworkMode={gridMode === 'artwork'}
                      onFlip={() => flipCard(card.number)}
                      onFlipBack={() => flipCardBack(card.number)}
                    />
                  ))}
                </div>
              </div>
              {/* The convergence of systems — said once, after the full deck */}
              {!query && (
                <p className="font-sans text-[14px] text-wood-500 max-w-md mx-auto text-center leading-[1.7] font-light tracking-wide mt-12">
                  Each card carries a hexagram from the I Ching, a Gene Key, and a gate from Human Design.
                  Nothing needs to be understood to speak with them.
                </p>
              )}
            </>
          ) : (
            <EmptyState onClear={() => setQuery('')} />
          )
        )}

        {/* Rings view */}
        {viewMode === 'rings' && (
          filteredRings.length > 0 ? (
            <div className="space-y-2">
              <h2 className="sr-only">Cards by codon ring</h2>
              {filteredRings.map(ring => (
                <RingSection
                  key={ring.ring_name}
                  ring_name={ring.ring_name}
                  tarot={ring.tarot}
                  description={ring.description}
                  cards={ring.cards}
                />
              ))}
            </div>
          ) : (
            <EmptyState onClear={() => setQuery('')} />
          )
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="border-t border-wood-200 px-6 py-10 max-w-7xl mx-auto flex items-center justify-between">
        <Link
          to="/creations"
          className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 hover:text-wood-900 transition-colors"
        >
          ← Creations
        </Link>
        <button
          onClick={handleRandom}
          className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-700 hover:text-wood-900 transition-colors font-semibold border-b border-bronze-700/50 hover:border-wood-900 pb-px"
        >
          Draw at Random →
        </button>
      </div>

    </div>
  );
};

export default UniversalLanguageIndex;
