
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CODON_RINGS, ALL_CARDS, type OracleCard } from '../data/oracleData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';

type ViewMode = 'grid' | 'rings';

/* ─── Card image lookup ──────────────────────────────────────────────────── */
// UL pieces in FULL_ARCHIVE have coverImages like "32_x9qxas".
// The number before the underscore matches the oracle card number.

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
  return img(publicId, { w: size, h: size, crop: 'fill', gravity: 'center' });
}

/* ─── Thumbnail tile (grid view) ─────────────────────────────────────────── */

const CardThumbnail: React.FC<{ card: OracleCard }> = ({ card }) => (
  <Link
    to={`/creations/oracle-cards/universal-language/${card.number}`}
    className="group block"
  >
    <div className="relative aspect-square overflow-hidden">
      <img
        src={cardImageUrl(card.number, 320)}
        alt={`${card.card_name} — Card ${card.number}`}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      {/* Hover overlay — hexagram + number, centered */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/88 transition-colors duration-300 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center" style={{ gap: '0.5em', fontSize: 'clamp(22px, 3.8vw, 40px)', transform: 'translateY(8%)' }}>
          {/* Two trigrams merged into one hexagram.
              flex+align-items:center ensures pixel-perfect alignment; scaleX widens. */}
          <div className="select-none text-white/90 flex flex-col items-center" style={{ lineHeight: 1, transform: 'scaleX(1.78)', transformOrigin: 'center' }}>
            <span>{card.iching.upper_trigram.symbol}</span>
            <span style={{ marginTop: '-0.37em' }}>{card.iching.lower_trigram.symbol}</span>
          </div>
          {/* Number — Cinzel, strong, centered below */}
          <span className="font-display text-white/80 select-none text-center" style={{ fontSize: '0.65em' }}>
            {card.number}
          </span>
        </div>
      </div>
    </div>

    {/* Title below — number + name */}
    <p className="pt-1.5 font-serif text-sm text-wood-600 group-hover:text-bronze-600 transition-colors duration-200 leading-snug line-clamp-1">
      <span className="text-bronze-600/70 mr-1">{card.number}.</span>{card.card_name}
    </p>
  </Link>
);

/* ─── Ring card tile (rings view) ────────────────────────────────────────── */

const RingCardTile: React.FC<{ card: OracleCard }> = ({ card }) => (
  <Link
    to={`/creations/oracle-cards/universal-language/${card.number}`}
    className="group flex gap-4 border border-wood-200 hover:border-bronze-500/60 transition-colors duration-300 p-4"
  >
    {/* Thumbnail */}
    <div className="flex-shrink-0 w-14 h-14 overflow-hidden border border-wood-200 group-hover:border-bronze-400/40 transition-colors duration-300">
      <img
        src={cardImageUrl(card.number, 112)}
        alt=""
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    </div>

    {/* Text */}
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="font-label text-[11px] uppercase tracking-[0.1em] text-bronze-600/70 flex-shrink-0">
          {String(card.number).padStart(2, '0')}
        </span>
        <h3 className="font-serif text-base text-wood-900 font-medium leading-tight group-hover:text-bronze-600 transition-colors duration-200 truncate">
          {card.card_name}
        </h3>
      </div>
      <p className="font-serif text-sm text-wood-600 leading-snug mb-2 line-clamp-1">
        {card.iching.hexagram_name}
      </p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-label text-[11px] uppercase tracking-[0.08em] text-wood-600">{card.gene_keys.shadow}</span>
        <span className="text-wood-300 text-[11px]">·</span>
        <span className="font-label text-[11px] uppercase tracking-[0.08em] text-bronze-700">{card.gene_keys.gift}</span>
        <span className="text-wood-300 text-[11px]">·</span>
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
        <h2 className="font-serif text-xl text-wood-900 font-medium">{ring_name}</h2>
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600/70">{tarot}</span>
      </div>
      <p className="font-serif text-sm italic text-wood-500 max-w-xl leading-[1.65]">{description}</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
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
      placeholder="Search by name, hexagram, keyword, or number..."
      className="w-full bg-transparent border border-wood-300 focus:border-bronze-500 text-wood-900 placeholder-wood-400 font-serif text-sm px-4 py-2.5 outline-none transition-colors duration-200"
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

/* ─── View toggle ────────────────────────────────────────────────────────── */

const ViewToggle: React.FC<{ view: ViewMode; onChange: (v: ViewMode) => void }> = ({ view, onChange }) => (
  <div className="flex items-center">
    {(['grid', 'rings'] as ViewMode[]).map((v, i) => (
      <button
        key={v}
        onClick={() => onChange(v)}
        className={`font-label text-[10px] uppercase tracking-[0.2em] px-4 py-2.5 border transition-colors duration-200 ${i === 1 ? '-ml-px' : ''} ${
          view === v
            ? 'bg-wood-900 text-paper-50 border-wood-900 z-10 relative'
            : 'text-wood-500 border-wood-300 hover:text-wood-900 hover:border-wood-500 bg-transparent'
        }`}
      >
        {v === 'grid' ? 'All 64' : 'By Ring'}
      </button>
    ))}
  </div>
);

/* ─── Empty state ────────────────────────────────────────────────────────── */

const EmptyState: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="border-t border-wood-200 pt-16 text-center py-24">
    <p className="font-serif text-xl text-wood-500 italic mb-4">No cards match that search.</p>
    <button
      onClick={onClear}
      className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-500 transition-colors border-b border-bronze-600/40 pb-px"
    >
      Clear search
    </button>
  </div>
);

/* ─── Main component ─────────────────────────────────────────────────────── */

const UniversalLanguageIndex: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('grid');
  const [query, setQuery] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

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

  const totalShown = view === 'grid'
    ? filteredCards.length
    : filteredRings.reduce((n, r) => n + r.cards.length, 0);

  const handleRandom = () => {
    const card = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    navigate(`/creations/oracle-cards/universal-language/${card.number}`);
  };

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-32 pb-12 max-w-7xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.25em] text-wood-400 mb-12">
          <Link to="/creations" className="hover:text-wood-700 transition-colors">Creations</Link>
          <span className="text-wood-300">/</span>
          <span className="text-wood-700">Oracle Cards</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end mb-10">
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-5">
              Universal Language Oracle
            </p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-[88px] text-wood-900 font-medium leading-[0.93] mb-6">
              Sixty-Four<br />
              <span className="text-wood-500 font-light italic">Expressions</span>
            </h1>
            <p className="font-serif text-lg text-wood-600 max-w-xl leading-[1.7] font-light">
              Each card carries a hexagram from the I Ching, a Gene Key, and a gate from Human Design.
              Nothing needs to be understood to speak with them.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-4">
            <button
              onClick={handleRandom}
              className="inline-flex items-center gap-3 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors duration-200 font-semibold"
            >
              Draw a Card
            </button>
            <div className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 space-y-1 text-right">
              <div>{ALL_CARDS.length} Cards</div>
              <div>{CODON_RINGS.length} Codon Rings</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-wood-200 pt-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <SearchBar value={query} onChange={setQuery} />
          <ViewToggle view={view} onChange={setView} />
        </div>

        {query && (
          <p className="mt-3 font-label text-[10px] uppercase tracking-[0.2em] text-wood-400">
            {totalShown} {totalShown === 1 ? 'card' : 'cards'} found
          </p>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-6 pb-32 max-w-7xl mx-auto">

        {/* Grid view */}
        {view === 'grid' && (
          filteredCards.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2 sm:gap-3">
              {filteredCards.map(card => (
                <CardThumbnail key={card.number} card={card} />
              ))}
            </div>
          ) : (
            <EmptyState onClear={() => setQuery('')} />
          )
        )}

        {/* Rings view */}
        {view === 'rings' && (
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
          Draw a random card →
        </button>
      </div>

    </div>
  );
};

export default UniversalLanguageIndex;
