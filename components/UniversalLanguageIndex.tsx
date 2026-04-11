
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CODON_RINGS, ALL_CARDS, type OracleCard } from '../data/oracleData';

/* ─── Card Tile ──────────────────────────────────────────────────────────── */

const CardTile: React.FC<{ card: OracleCard }> = ({ card }) => (
  <Link
    to={`/creations/oracle-cards/universal-language/${card.number}`}
    className="group block border border-stone-800 hover:border-bronze-500/60 transition-colors duration-300 p-5 relative"
  >
    {/* Card number */}
    <span className="block font-label text-[10px] uppercase tracking-[0.25em] text-bronze-500/70 mb-2">
      {String(card.number).padStart(2, '0')}
    </span>

    {/* Card name */}
    <h3 className="font-serif text-lg text-paper-200 font-medium leading-tight mb-1 group-hover:text-bronze-400 transition-colors duration-300">
      {card.card_name}
    </h3>

    {/* Hexagram */}
    <p className="font-serif text-sm italic text-stone-500 mb-4 leading-snug">
      {card.iching.hexagram_name}
    </p>

    {/* Trigram symbols */}
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xl text-stone-500 leading-none">{card.iching.upper_trigram.symbol}</span>
      <span className="text-[10px] text-stone-700 uppercase tracking-widest">over</span>
      <span className="text-xl text-stone-500 leading-none">{card.iching.lower_trigram.symbol}</span>
    </div>

    {/* Shadow · Gift · Siddhi */}
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-label text-[10px] uppercase tracking-[0.15em] text-stone-600">
        {card.gene_keys.shadow}
      </span>
      <span className="text-stone-700 text-[10px]">·</span>
      <span className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-500/80">
        {card.gene_keys.gift}
      </span>
      <span className="text-stone-700 text-[10px]">·</span>
      <span className="font-label text-[10px] uppercase tracking-[0.15em] text-stone-500">
        {card.gene_keys.siddhi}
      </span>
    </div>

    {/* Hover indicator */}
    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <span className="font-label text-[9px] uppercase tracking-[0.2em] text-bronze-500/60">Open →</span>
    </div>
  </Link>
);

/* ─── Ring Section ───────────────────────────────────────────────────────── */

const RingSection: React.FC<{
  ring_name: string;
  tarot: string;
  description: string;
  cards: OracleCard[];
}> = ({ ring_name, tarot, description, cards }) => (
  <div className="border-t border-stone-800 pt-10 pb-4">
    {/* Ring header */}
    <div className="mb-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
        <h2 className="font-serif text-2xl text-paper-200 font-medium">{ring_name}</h2>
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-500/60">{tarot}</span>
      </div>
      <p className="font-serif text-sm italic text-stone-500 max-w-lg leading-[1.65]">{description}</p>
    </div>

    {/* Cards grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <CardTile key={card.number} card={card} />
      ))}
    </div>
  </div>
);

/* ─── Search / Filter Bar ────────────────────────────────────────────────── */

const SearchBar: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <div className="relative">
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search by card name, hexagram, or keyword..."
      className="w-full bg-transparent border border-stone-800 focus:border-bronze-500/50 text-paper-200 placeholder-stone-600 font-serif text-sm px-4 py-3 outline-none transition-colors duration-200"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400 transition-colors text-xs font-label uppercase tracking-widest"
      >
        Clear
      </button>
    )}
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────── */

const UniversalLanguageIndex: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const filteredRings = useMemo(() => {
    if (!query.trim()) return CODON_RINGS;

    const q = query.toLowerCase();
    return CODON_RINGS
      .map(ring => ({
        ...ring,
        cards: ring.cards.filter(card =>
          card.card_name.toLowerCase().includes(q) ||
          card.iching.hexagram_name.toLowerCase().includes(q) ||
          card.gene_keys.shadow.toLowerCase().includes(q) ||
          card.gene_keys.gift.toLowerCase().includes(q) ||
          card.gene_keys.siddhi.toLowerCase().includes(q) ||
          card.element.toLowerCase().includes(q) ||
          ring.ring_name.toLowerCase().includes(q) ||
          String(card.number) === q.trim()
        ),
      }))
      .filter(ring => ring.cards.length > 0);
  }, [query]);

  const totalShown = filteredRings.reduce((n, r) => n + r.cards.length, 0);

  // Random card
  const handleRandom = () => {
    const card = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    navigate(`/creations/oracle-cards/universal-language/${card.number}`);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-paper-200">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-32 pb-16 max-w-7xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.25em] text-stone-600 mb-12">
          <Link to="/creations" className="hover:text-stone-400 transition-colors">Creations</Link>
          <span>/</span>
          <Link to="/creations/oracle-cards" className="hover:text-stone-400 transition-colors">Oracle Cards</Link>
          <span>/</span>
          <span className="text-stone-400">Universal Language</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end mb-16">
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-500/70 mb-4">
              The Oracle
            </p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-paper-100 font-medium leading-[0.95] mb-6">
              Universal<br />Language
            </h1>
            <p className="font-serif text-lg text-stone-400 max-w-xl leading-[1.7] font-light">
              Sixty-four expressions of the cycle of changes. Each card carries a hexagram from the
              I Ching, a Gene Key, and a gate from Human Design. Nothing needs to be understood to
              speak with them.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 lg:items-end">
            <button
              onClick={handleRandom}
              className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-stone-400 hover:text-bronze-400 border border-stone-800 hover:border-bronze-500/40 px-5 py-3 transition-colors duration-200"
            >
              Draw a Card
            </button>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-700">
              {ALL_CARDS.length} cards · {CODON_RINGS.length} codon rings
            </span>
          </div>
        </div>

        {/* Search */}
        <SearchBar value={query} onChange={setQuery} />
        {query && (
          <p className="mt-3 font-label text-[10px] uppercase tracking-[0.2em] text-stone-600">
            {totalShown} {totalShown === 1 ? 'card' : 'cards'} found
          </p>
        )}
      </div>

      {/* ── Rings / Cards ─────────────────────────────────────────────────── */}
      <div className="px-6 pb-32 max-w-7xl mx-auto">
        {filteredRings.length > 0 ? (
          <div className="space-y-6">
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
          <div className="border-t border-stone-800 pt-16 text-center">
            <p className="font-serif text-lg text-stone-600 italic">No cards match that search.</p>
            <button
              onClick={() => setQuery('')}
              className="mt-4 font-label text-[10px] uppercase tracking-[0.2em] text-bronze-500/60 hover:text-bronze-400 transition-colors"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {/* ── Footer nav ────────────────────────────────────────────────────── */}
      <div className="border-t border-stone-800 px-6 py-10 max-w-7xl mx-auto flex items-center justify-between">
        <Link
          to="/creations/oracle-cards"
          className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-600 hover:text-stone-400 transition-colors"
        >
          ← Oracle Cards
        </Link>
        <button
          onClick={handleRandom}
          className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-500/60 hover:text-bronze-400 transition-colors"
        >
          Draw a random card →
        </button>
      </div>

    </div>
  );
};

export default UniversalLanguageIndex;
