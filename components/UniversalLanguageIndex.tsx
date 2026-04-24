
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CODON_RINGS, ALL_CARDS, type OracleCard } from '../data/oracleData';
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

  // Artwork mode renders the front face flat — no 3D layer per tile.
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
  // Strip sits OUTSIDE the image — nothing ever covers the art.
  return (
    <div className={`[perspective:600px] relative select-none ${isFlipped ? 'z-10' : ''}`}>
      <div
        className={`relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* BACK face — hexagram only, no card background. Page background shows through. */}
        <button
          type="button"
          onClick={onFlip}
          aria-label={`Reveal Card ${card.number}: ${card.iching.hexagram_name}`}
          className="absolute inset-0 [backface-visibility:hidden] bg-transparent flex flex-col items-center justify-center gap-1.5 cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
        >
          <span className="w-[42%] max-w-[48px] text-wood-900">
            <HexagramSVG
              upper={card.iching.upper_trigram.symbol}
              lower={card.iching.lower_trigram.symbol}
            />
          </span>
          <span className="font-label font-bold text-[11px] text-wood-900 leading-none">
            {card.number}
          </span>
        </button>

        {/* FRONT face — art square (uncovered) + action strip beneath */}
        <div className="relative w-full [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
          {/* Art — clean, nothing overlaid */}
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

          {/* Action strip — BELOW the image, never overlaps */}
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
        alt={`${card.card_name} — Card ${card.number}, Universal Language Oracle`}
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

/* ─── Hero card preview (desktop only) ───────────────────────────────────── */

const HERO_PREVIEW_NUMBERS = [1, 8, 22, 32, 48, 64];

const HeroPreview: React.FC = () => (
  <div className="hidden lg:grid grid-cols-3 gap-1.5 w-56 xl:w-64 shrink-0 self-start mt-2">
    {HERO_PREVIEW_NUMBERS.map(num => (
      <div key={num} className="aspect-square overflow-hidden opacity-75">
        <img
          src={cardImageUrl(num, 160)}
          alt=""
          aria-hidden
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    ))}
  </div>
);

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
      <div className="px-6 pt-32 pb-10 max-w-7xl mx-auto">

        {/* Breadcrumb — Oracle middle node removed */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 gap-y-1 font-label text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] text-wood-700 mb-8 sm:mb-12">
          <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
          <span aria-hidden className="text-wood-400">/</span>
          <span className="text-wood-900">Universal Language</span>
        </nav>

        <div className="relative">
          <div
            aria-hidden
            className="md:hidden absolute -inset-x-6 -inset-y-6 -z-10 bg-paper-50/75 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_82%)]"
          />

          {/* Hero row: text left, card preview right */}
          <div className="flex items-start gap-8 lg:gap-12 mb-10">
            <div className="flex-1 min-w-0">
              <p className="font-label text-[11px] uppercase tracking-[0.25em] text-bronze-700 mb-5">
                Universal Language Oracle
              </p>
              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-wood-900 font-medium leading-[0.93] mb-6">
                Sixty-Four<br />
                <span className="text-wood-500 font-light">Expressions</span>
              </h1>
              <p className="font-sans text-lg text-wood-600 max-w-xl leading-[1.7] font-light mb-8">
                Each card carries a hexagram from the I Ching, a Gene Key, and a gate from Human Design.
                Nothing needs to be understood to speak with them.
              </p>

              {/* Primary CTA + clickable stats */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button
                  onClick={handleRandom}
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] hover:bg-bronze-600 transition-colors duration-200 font-semibold"
                >
                  Draw at Random
                </button>
                <div className="flex items-center gap-4 font-label text-[11px] uppercase tracking-[0.18em] text-wood-700">
                  <button
                    onClick={() => { handleGridMode('cards'); setViewMode('grid'); }}
                    className="hover:text-wood-900 transition-colors"
                  >
                    {ALL_CARDS.length} Cards
                  </button>
                  <span aria-hidden className="text-wood-400">·</span>
                  <button
                    onClick={() => setViewMode('rings')}
                    className="hover:text-wood-900 transition-colors"
                  >
                    {CODON_RINGS.length} Codon Rings
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop card preview grid */}
            <HeroPreview />
          </div>
        </div>
      </div>

      {/* ── Sticky search + tabs ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-paper-50 border-b border-wood-200">
        <div className="px-6 py-4 max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
              <p className="pt-5 pb-3 font-label text-[11px] uppercase tracking-[0.18em] text-wood-600">
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
