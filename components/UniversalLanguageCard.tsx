
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import { OracleQREntrance } from './OracleQREntrance';

/* ─── Image lookup (same map as index page) ──────────────────────────────── */

const UL_PIECES = FULL_ARCHIVE.filter(a => a.series === 'Universal Language');

const UL_IMAGE_BY_NUMBER = new Map<number, string>(
  UL_PIECES
    .map(a => {
      const num = parseInt(a.coverImage.split('_')[0], 10);
      return [num, a.coverImage] as [number, string];
    })
    .filter(([num]) => !isNaN(num))
);

// Maps card number → purchasable artwork piece
const UL_PIECE_BY_NUMBER = new Map<number, typeof UL_PIECES[number]>(
  UL_PIECES
    .map(a => {
      const num = parseInt(a.coverImage.split('_')[0], 10);
      return [num, a] as [number, typeof UL_PIECES[number]];
    })
    .filter(([num]) => !isNaN(num))
);


function cardImageUrl(number: number, size: number): string {
  const publicId = UL_IMAGE_BY_NUMBER.get(number);
  if (!publicId) return img('adrian-website/placeholders/oracle-card-3', { w: size, h: size });
  return img(publicId, { w: size, h: size, crop: 'fill', gravity: 'center', format: 'webp' });
}

/* ─── Section label ──────────────────────────────────────────────────────── */

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mt-7 mb-2 first:mt-0 md:mt-10 md:mb-3">
    {children}
  </p>
);

/* ─── Main component ─────────────────────────────────────────────────────── */

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cardNum = parseInt(number ?? '', 10);
  const card = CARD_BY_NUMBER.get(cardNum);

  // Show entrance animation when arriving via a physical QR scan
  const [showEntrance, setShowEntrance] = useState(() => searchParams.get('ref') === 'qr');

  const handleEntranceDone = () => {
    setShowEntrance(false);
    // Clean the ref param from the URL so back/refresh won't retrigger it
    setSearchParams(prev => { prev.delete('ref'); return prev; }, { replace: true });
  };

  // Sorted list for prev/next
  const sortedNums = ALL_CARDS.map(c => c.number);
  const currentIndex = sortedNums.indexOf(cardNum);
  const prevNum = currentIndex > 0 ? sortedNums[currentIndex - 1] : null;
  const nextNum = currentIndex < sortedNums.length - 1 ? sortedNums[currentIndex + 1] : null;

  useEffect(() => { window.scrollTo(0, 0); }, [cardNum]);

  // Per-card meta tags
  const cardImage = card ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${UL_IMAGE_BY_NUMBER.get(cardNum) ?? 'adrian-website/placeholders/oracle-card-3'}` : undefined;
  useMetaTags({
    title: card ? `${card.card_name} · Card ${cardNum} · Universal Language Oracle` : undefined,
    description: card ? `${card.iching.hexagram_name} · ${card.gene_keys.shadow} / ${card.gene_keys.gift} / ${card.gene_keys.siddhi}. Card ${cardNum} of 64 in the Universal Language Oracle by Adrian Rasmussen.` : undefined,
    image: cardImage,
  });

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevNum !== null) navigate(`/oracle/universal-language/${prevNum}`);
      if (e.key === 'ArrowRight' && nextNum !== null) navigate(`/oracle/universal-language/${nextNum}`);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevNum, nextNum, navigate]);

  if (!card) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-xl text-wood-500 italic mb-4">Card {number} not found.</p>
          <Link to="/oracle/universal-language" className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 border-b border-bronze-600/40 pb-px">
            Back to the oracle
          </Link>
        </div>
      </div>
    );
  }

  const gkParagraphs = card.gene_keys.description.split('\n\n').filter(Boolean);
  const siblings = card.codon_ring_siblings;

  return (
    <>
    {showEntrance && <OracleQREntrance card={card} onDone={handleEntranceDone} />}
    <div className="min-h-screen bg-paper-50 text-wood-900">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-20 pb-16 md:pt-32 md:pb-24">

        {/* ── Breadcrumb ───────────────────────────────────────────────── */}
        <nav className="flex items-center flex-wrap gap-x-2 gap-y-1 font-label text-[10px] uppercase tracking-[0.25em] text-wood-400 mb-8 md:mb-12">
          <Link to="/creations/oracle-cards" className="hover:text-wood-700 transition-colors">Oracle</Link>
          <span className="text-wood-300">/</span>
          <Link to="/oracle/universal-language" className="hover:text-wood-700 transition-colors">
            Universal Language
          </Link>
          <span className="text-wood-300 hidden sm:inline">/</span>
          <span className="text-wood-500 hidden sm:inline">{card.ring_name}</span>
          <span className="text-wood-300">/</span>
          <span className="text-wood-700">Card {card.number}</span>
        </nav>

        {/* ── Card header ──────────────────────────────────────────────── */}
        <div className="flex items-baseline flex-wrap gap-y-1 justify-between mb-2">
          <span className="font-label text-[11px] uppercase tracking-[0.1em] text-bronze-700">
            {card.number} / 64
          </span>
          <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600">
            {card.ring_name}
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl text-wood-900 font-medium leading-[1.1] mb-2">
          {card.card_name}
        </h1>
        <p className="font-serif text-lg sm:text-xl text-wood-700 mb-7 md:mb-10">
          {card.iching.hexagram_name}
        </p>

        {/* ── Card image ───────────────────────────────────────────────── */}
        <div className="mb-8 md:mb-10">
          <img
            src={cardImageUrl(card.number, 720)}
            alt={`${card.card_name} — Card ${card.number}, Universal Language Oracle`}
            className="w-full aspect-square object-cover"
            loading="eager"
          />
        </div>

        {/* ── Trigram bar ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-5 md:py-7 border-t border-b border-wood-200 mb-3">
          {/* Upper */}
          <div className="flex items-center gap-4">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-1">Upper</p>
              <span className="text-4xl text-wood-700 leading-none block">{card.iching.upper_trigram.symbol}</span>
            </div>
            <div>
              <p className="font-serif text-base text-wood-900 font-medium">{card.iching.upper_trigram.name}</p>
              <p className="font-serif text-base text-wood-700 leading-relaxed">{card.iching.upper_trigram.nature}</p>
            </div>
          </div>

          <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 text-center sm:text-left sm:px-4">over</p>

          {/* Lower */}
          <div className="flex items-center gap-4">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-1">Lower</p>
              <span className="text-4xl text-wood-700 leading-none block">{card.iching.lower_trigram.symbol}</span>
            </div>
            <div>
              <p className="font-serif text-base text-wood-900 font-medium">{card.iching.lower_trigram.name}</p>
              <p className="font-serif text-base text-wood-700 leading-relaxed">{card.iching.lower_trigram.nature}</p>
            </div>
          </div>
        </div>

        {/* ── I Ching ──────────────────────────────────────────────────── */}
        <SectionLabel>I Ching</SectionLabel>
        <div className="border-l border-wood-200 pl-4 mb-2">
          <p className="font-serif text-base italic text-wood-600 leading-[1.85]">
            {card.iching.essence}
          </p>
        </div>

        {/* ── Element ──────────────────────────────────────────────────── */}
        <SectionLabel>Element</SectionLabel>
        <p className="font-serif text-base italic text-wood-700 mb-2">{card.element}</p>

        {/* ── Nature ───────────────────────────────────────────────────── */}
        <SectionLabel>Nature</SectionLabel>
        <p className="font-serif text-base italic text-wood-600 leading-[1.8] mb-2">{card.nature}</p>

        {/* ── Gene Keys ────────────────────────────────────────────────── */}
        <SectionLabel>Gene Keys</SectionLabel>

        {/* Spectrum bar */}
        <div className="flex border border-wood-200 mb-4 md:mb-5 overflow-hidden">
          <div className="flex-1 px-2 sm:px-4 py-3 sm:py-4 border-r border-wood-200 text-center">
            <p className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-1.5">Shadow</p>
            <p className="font-serif text-sm sm:text-lg text-wood-600 font-medium">{card.gene_keys.shadow}</p>
          </div>
          <div className="flex-1 px-2 sm:px-4 py-3 sm:py-4 border-r border-wood-200 text-center bg-bronze-50">
            <p className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-bronze-700 mb-1.5">Gift</p>
            <p className="font-serif text-sm sm:text-lg text-bronze-700 font-medium">{card.gene_keys.gift}</p>
          </div>
          <div className="flex-1 px-2 sm:px-4 py-3 sm:py-4 text-center">
            <p className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-1.5">Siddhi</p>
            <p className="font-serif text-sm sm:text-lg text-wood-500 font-medium">{card.gene_keys.siddhi}</p>
          </div>
        </div>

        {/* Gene Keys description */}
        <div className="space-y-3 mb-3">
          {gkParagraphs.map((p, i) => (
            <p key={i} className="font-serif text-base text-wood-700 leading-[1.85]">{p}</p>
          ))}
        </div>
        <p className="font-label text-[11px] uppercase tracking-[0.08em] text-wood-600 mb-2">
          Gene Keys text based on the work of Richard Rudd ·{' '}
          <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" className="hover:text-bronze-600 transition-colors border-b border-wood-300 hover:border-bronze-600 pb-px">
            genekeys.com
          </a>
        </p>

        {/* ── Metadata row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-5 md:py-7 border-t border-b border-wood-200 mt-7 md:mt-10">
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-2">Codon Ring</p>
            <p className="font-serif text-base text-wood-900">{card.ring_name}</p>
            {siblings.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {siblings.map(n => {
                  const sibling = CARD_BY_NUMBER.get(n);
                  return sibling ? (
                    <Link
                      key={n}
                      to={`/oracle/universal-language/${n}`}
                      className="block font-serif text-sm text-bronze-700 hover:text-bronze-500 transition-colors"
                    >
                      {n}. {sibling.card_name}
                    </Link>
                  ) : null;
                })}
              </div>
            )}
          </div>
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-2">Tarot</p>
            <p className="font-serif text-base text-wood-900">{card.ring_tarot}</p>
          </div>
        </div>

        {/* ── Human Design ─────────────────────────────────────────────── */}
        <SectionLabel>Human Design</SectionLabel>
        <p className="font-serif text-base text-wood-900 font-medium mb-2">
          Gate {card.human_design.gate} · {card.human_design.keyword}
        </p>
        <p className="font-serif text-base text-wood-700 leading-[1.85] mb-2">
          {card.human_design.description}
        </p>

        {/* ── Color Inspiration ─────────────────────────────────────────── */}
        <SectionLabel>Color Inspiration</SectionLabel>
        <div className="bg-wood-100 px-4 sm:px-6 py-4 sm:py-5 mb-2">
          <p className="font-serif text-base italic text-wood-600 leading-[1.8]">
            {card.color_inspiration}
          </p>
        </div>

        {/* ── Traditional Colors ────────────────────────────────────────── */}
        <SectionLabel>Traditional Trigram Colors</SectionLabel>
        <p className="font-serif text-base text-wood-600 leading-[1.8]">
          {card.traditional_colors}
        </p>

        {/* ── Acquire the piece ─────────────────────────────────────────── */}
        {(() => {
          const piece = UL_PIECE_BY_NUMBER.get(card.number);
          if (!piece) return null;
          return (
            <div className="mt-8 pt-6 md:mt-12 md:pt-8 border-t border-wood-200">
              <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-4">
                The original artwork
              </p>
              <Link
                to={`/creations/${piece.id}`}
                className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-16 h-16 flex-shrink-0 overflow-hidden border border-wood-200">
                  <img
                    src={img(piece.coverImage, { w: 128, h: 128 })}
                    alt={piece.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="font-serif text-base text-wood-900 font-medium group-hover:text-bronze-600 transition-colors">
                    {piece.title}
                  </p>
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 mt-0.5">
                    {piece.availability === 'SOLD' ? 'Sold' : piece.availability === 'READY_TO_SHIP' ? 'Ready to ship' : 'Made to order'}
                    {piece.dimensions ? ` · ${piece.dimensions}` : ''}
                  </p>
                </div>
              </Link>
            </div>
          );
        })()}

        {/* ── Prev / Next navigation ────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-10 pt-6 md:mt-16 md:pt-8 border-t border-wood-200">
          {prevNum !== null ? (
            <Link
              to={`/oracle/universal-language/${prevNum}`}
              className="group flex flex-col gap-1 max-w-[40%]"
            >
              <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 group-hover:text-wood-800 transition-colors">← Prev</span>
              <span className="font-serif text-xs sm:text-sm text-wood-700 group-hover:text-bronze-600 transition-colors line-clamp-1">
                {prevNum}. {CARD_BY_NUMBER.get(prevNum)?.card_name}
              </span>
            </Link>
          ) : <span />}

          <Link
            to="/oracle/universal-language"
            className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 hover:text-wood-800 transition-colors flex-shrink-0 px-2"
          >
            All 64
          </Link>

          {nextNum !== null ? (
            <Link
              to={`/oracle/universal-language/${nextNum}`}
              className="group flex flex-col gap-1 items-end max-w-[40%]"
            >
              <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 group-hover:text-wood-800 transition-colors">Next →</span>
              <span className="font-serif text-xs sm:text-sm text-wood-700 group-hover:text-bronze-600 transition-colors line-clamp-1">
                {nextNum}. {CARD_BY_NUMBER.get(nextNum)?.card_name}
              </span>
            </Link>
          ) : <span />}
        </div>

      </div>
    </div>
    </>
  );
};

export default UniversalLanguageCard;
