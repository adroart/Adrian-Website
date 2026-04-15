
import React, { useState, useMemo, useEffect } from 'react';
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
  onFlip: () => void;
  onFlipBack: () => void;
}> = ({ card, isFlipped, onFlip, onFlipBack }) => {
  const navigate = useNavigate();
  return (
  <div
    className={`[perspective:600px] relative select-none ${isFlipped ? 'z-10' : ''}`}
    onClick={() => { if (!isFlipped) onFlip(); }}
  >
    <div
      className={`relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${
        isFlipped ? '[transform:rotateY(180deg)]' : 'cursor-pointer'
      }`}
    >
      {/* BACK face — absolute, fills the front face dimensions */}
      <div className="absolute inset-0 [backface-visibility:hidden] bg-paper-50 flex flex-col items-center justify-center gap-1.5">
        <div className="w-[38%] text-stone-900 dark:text-white/90">
          <HexagramSVG
            upper={card.iching.upper_trigram.symbol}
            lower={card.iching.lower_trigram.symbol}
          />
        </div>
        <span className="font-label font-bold text-xs lg:text-sm text-stone-900 dark:text-white/90 leading-none">
          {card.number}
        </span>
      </div>

      {/* FRONT face — in-flow, defines tile height naturally */}
      <div
        className="relative w-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#e0d8cc] dark:bg-[#3b2f26] cursor-pointer"
        onClick={e => { e.stopPropagation(); onFlipBack(); }}
      >
        {/* Art — square image with equal padding on l/r/top */}
        <div
          className="pt-[6px] px-[6px]"
          onClick={e => { e.stopPropagation(); navigate(`/oracle/universal-language/${card.number}`, { state: { ritual: true } }); }}
        >
          <img
            src={cardImageUrl(card.number, 320)}
            alt={`${card.card_name} — Card ${card.number}, Universal Language Oracle`}
            className="w-full aspect-square object-cover block cursor-pointer"
            loading="lazy"
          />
        </div>

        {/* Bottom strip — two labeled actions split by a divider */}
        <div className="h-[16px] flex items-center pt-[2px]">
          <button
            className="flex-1 flex items-center justify-center font-label text-[8px] sm:text-[9px] uppercase tracking-[0.15em] text-wood-700 hover:text-wood-900 font-black transition-colors leading-none"
            onClick={e => { e.stopPropagation(); onFlipBack(); }}
            aria-label="Flip back"
          >
            Back
          </button>
          <span className="w-px h-[8px] bg-wood-400 shrink-0" />
          <button
            className="flex-1 flex items-center justify-center font-label text-[8px] sm:text-[9px] uppercase tracking-[0.15em] text-wood-700 hover:text-wood-900 font-black transition-colors leading-none"
            onClick={e => { e.stopPropagation(); navigate(`/oracle/universal-language/${card.number}`, { state: { ritual: true } }); }}
            aria-label={`Read ${card.card_name}`}
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
        <span className="font-label text-[10px] uppercase tracking-[0.12em] text-bronze-600/70 flex-shrink-0">
          {String(card.number).padStart(2, '0')}
        </span>
        <h3 className="font-sans text-base text-wood-900 font-medium leading-tight group-hover:text-bronze-600 transition-colors duration-200">
          {card.card_name}
        </h3>
      </div>
      <p className="font-sans text-sm text-wood-500 leading-snug mb-2">
        {card.iching.hexagram_name}
      </p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-label text-[10px] uppercase tracking-[0.08em] text-wood-500">{card.gene_keys.shadow}</span>
        <span className="text-wood-300 text-[10px]">·</span>
        <span className="font-label text-[10px] uppercase tracking-[0.08em] text-bronze-600">{card.gene_keys.gift}</span>
        <span className="text-wood-300 text-[10px]">·</span>
        <span className="font-label text-[10px] uppercase tracking-[0.08em] text-wood-500">{card.gene_keys.siddhi}</span>
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
        <h2 className="font-serif text-xl text-wood-900 font-medium">{ring_name}</h2>
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600/70">{tarot}</span>
      </div>
      <p className="font-sans text-sm text-wood-500 max-w-xl leading-[1.65]">{description}</p>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
      {cards.map(card => <RingCardTile key={card.number} card={card} />)}
    </div>
  </div>
);

/* ─── Search bar ─────────────────────────────────────────────────────────── */

const SearchBar: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="relative flex-1">
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search cards..."
      className="w-full bg-transparent border border-wood-300 focus:border-bronze-500 text-wood-900 placeholder-wood-400 font-sans text-sm px-4 py-2.5 outline-none transition-colors duration-200"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 font-label text-[10px] uppercase tracking-widest text-wood-400 hover:text-wood-700 transition-colors"
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
  const btnBase = 'font-label text-[10px] uppercase tracking-[0.2em] px-4 py-2.5 border transition-colors duration-200';
  const active = 'bg-wood-900 text-paper-50 border-wood-900 z-10 relative';
  const inactive = 'text-wood-500 border-wood-300 hover:text-wood-900 hover:border-wood-500 bg-transparent';

  return (
    <div className="flex items-center">
      <button
        onClick={() => { onGridMode('cards'); onViewMode('grid'); }}
        className={`${btnBase} ${viewMode === 'grid' && gridMode === 'cards' ? active : inactive}`}
        title="View hexagram symbols"
      >
        I Ching
      </button>
      <button
        onClick={() => { onGridMode('artwork'); onViewMode('grid'); }}
        className={`${btnBase} -ml-px ${viewMode === 'grid' && gridMode === 'artwork' ? active : inactive}`}
        title="View the paintings"
      >
        Artwork
      </button>
      <button
        onClick={() => onViewMode('rings')}
        className={`${btnBase} -ml-px ${viewMode === 'rings' ? active : inactive}`}
        title="Browse by Codon Ring"
      >
        By Ring
      </button>
    </div>
  );
};

/* ─── Empty state ────────────────────────────────────────────────────────── */

const EmptyState: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="border-t border-wood-200 pt-16 text-center py-24">
    <p className="font-serif text-xl text-wood-500 mb-4">No cards match that search.</p>
    <button
      onClick={onClear}
      className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 transition-colors border-b border-bronze-600/40 pb-px"
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
          loading="eager"
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

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleGridMode = (mode: GridMode) => {
    setGridMode(mode);
    if (mode === 'artwork') {
      setFlippedCards(new Set(ALL_CARDS.map(c => c.number)));
    } else {
      setFlippedCards(new Set());
    }
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
        <nav className="flex flex-wrap items-center gap-2 gap-y-1 font-label text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.25em] text-wood-400 mb-8 sm:mb-12">
          <Link to="/creations" className="hover:text-wood-700 transition-colors">Creations</Link>
          <span className="text-wood-300">/</span>
          <span className="text-wood-700">Universal Language</span>
        </nav>

        <div className="relative">
          <div
            aria-hidden
            className="md:hidden absolute -inset-x-6 -inset-y-6 -z-10 bg-paper-50/75 dark:bg-stone-950/75 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_82%)]"
          />

          {/* Hero row: text left, card preview right */}
          <div className="flex items-start gap-8 lg:gap-12 mb-10">
            <div className="flex-1 min-w-0">
              <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-5">
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
                <div className="flex items-center gap-4 font-label text-[10px] uppercase tracking-[0.2em] text-wood-400">
                  <button
                    onClick={() => { handleGridMode('cards'); setViewMode('grid'); }}
                    className="hover:text-wood-700 transition-colors"
                  >
                    {ALL_CARDS.length} Cards
                  </button>
                  <span className="text-wood-300">·</span>
                  <button
                    onClick={() => setViewMode('rings')}
                    className="hover:text-wood-700 transition-colors"
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
      <div className="sticky top-0 z-20 bg-paper-50/95 backdrop-blur-sm border-b border-wood-200">
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
          <div className="px-6 pb-3 max-w-7xl mx-auto">
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400">
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
              <p className="pt-5 pb-3 font-label text-[10px] uppercase tracking-[0.2em] text-wood-400">
                {gridInstruction}
              </p>
              <div className="-mx-6 px-[5px] sm:mx-0 sm:px-0">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-[3px]">
                  {filteredCards.map(card => (
                    <CardThumbnail
                      key={card.number}
                      card={card}
                      isFlipped={flippedCards.has(card.number)}
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
          className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 hover:text-wood-700 transition-colors"
        >
          ← Creations
        </Link>
        <button
          onClick={handleRandom}
          className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 transition-colors font-semibold border-b border-bronze-600/40 hover:border-bronze-500 pb-px"
        >
          Draw at Random →
        </button>
      </div>

    </div>
  );
};

export default UniversalLanguageIndex;
