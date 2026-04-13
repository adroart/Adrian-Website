
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import { OracleQREntrance } from './OracleQREntrance';

/* ─── Image lookup ───────────────────────────────────────────────────────── */

const UL_PIECES = FULL_ARCHIVE.filter(a => a.series === 'Universal Language');

const UL_IMAGE_BY_NUMBER = new Map<number, string>(
  UL_PIECES
    .map(a => {
      const num = parseInt(a.coverImage.split('_')[0], 10);
      return [num, a.coverImage] as [number, string];
    })
    .filter(([num]) => !isNaN(num))
);

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
  <p className="font-label text-[11px] uppercase tracking-[0.25em] text-bronze-600 mt-14 mb-4">
    {children}
  </p>
);

/* ─── Chapter break — visual separator between knowledge domains ─────────── */

const ChapterBreak: React.FC = () => (
  <div className="border-t border-wood-200 mt-10" />
);

/* ─── Scroll progress bar ────────────────────────────────────────────────── */

const ScrollProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-wood-100">
      <div
        className="h-full bg-bronze-400 transition-[width] duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────────────────── */

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cardNum = parseInt(number ?? '', 10);
  const card = CARD_BY_NUMBER.get(cardNum);

  const [showEntrance, setShowEntrance] = useState(() => searchParams.get('ref') === 'qr');

  const handleEntranceDone = () => {
    setShowEntrance(false);
    setSearchParams(prev => { prev.delete('ref'); return prev; }, { replace: true });
  };

  const sortedNums = ALL_CARDS.map(c => c.number);
  const currentIndex = sortedNums.indexOf(cardNum);
  const prevNum = currentIndex > 0 ? sortedNums[currentIndex - 1] : null;
  const nextNum = currentIndex < sortedNums.length - 1 ? sortedNums[currentIndex + 1] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cardNum]);

  const cardImage = card
    ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${UL_IMAGE_BY_NUMBER.get(cardNum) ?? 'adrian-website/placeholders/oracle-card-3'}`
    : undefined;

  useMetaTags({
    title: card ? `${card.card_name} · Card ${cardNum} · Universal Language Oracle` : undefined,
    description: card
      ? `${card.iching.hexagram_name} · ${card.gene_keys.shadow} / ${card.gene_keys.gift} / ${card.gene_keys.siddhi}. Card ${cardNum} of 64 in the Universal Language Oracle by Adrian Rasmussen.`
      : undefined,
    image: cardImage,
  });

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
          <p className="font-serif text-xl text-wood-700 italic mb-4">Card {number} not found.</p>
          <Link to="/oracle/universal-language" className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 border-b border-bronze-600/40 pb-px">
            Back to the oracle
          </Link>
        </div>
      </div>
    );
  }

  const gkParagraphs = card.gene_keys.description.split('\n\n').filter(Boolean);
  const siblings = card.codon_ring_siblings;
  const piece = UL_PIECE_BY_NUMBER.get(card.number);

  return (
    <>
      {showEntrance && <OracleQREntrance card={card} onDone={handleEntranceDone} />}

      {/* ── Scroll progress bar ─────────────────────────────────────────── */}
      <ScrollProgress />

      {/* ── Sticky bottom navigation (mobile only) ──────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-paper-50/95 border-t border-wood-200 backdrop-blur-sm">
        <div className="flex items-stretch h-14">
          {prevNum !== null ? (
            <Link
              to={`/oracle/universal-language/${prevNum}`}
              className="flex items-center gap-2 px-3 flex-1 min-w-0 hover:bg-wood-50 transition-colors"
            >
              {UL_IMAGE_BY_NUMBER.get(prevNum) && (
                <img src={cardImageUrl(prevNum, 80)} alt="" className="w-9 h-9 object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-label text-[9px] uppercase tracking-[0.12em] text-wood-500">← Prev</p>
                <p className="font-sans text-xs text-wood-700 leading-tight truncate">
                  {CARD_BY_NUMBER.get(prevNum)?.card_name}
                </p>
              </div>
            </Link>
          ) : <div className="flex-1" />}

          <Link
            to="/oracle/universal-language"
            className="flex items-center justify-center px-4 border-x border-wood-200 flex-shrink-0 font-label text-[10px] uppercase tracking-[0.2em] text-wood-600 hover:text-wood-900 transition-colors"
          >
            All 64
          </Link>

          {nextNum !== null ? (
            <Link
              to={`/oracle/universal-language/${nextNum}`}
              className="flex items-center justify-end gap-2 px-3 flex-1 min-w-0 hover:bg-wood-50 transition-colors"
            >
              <div className="min-w-0 text-right">
                <p className="font-label text-[9px] uppercase tracking-[0.12em] text-wood-500">Next →</p>
                <p className="font-sans text-xs text-wood-700 leading-tight truncate">
                  {CARD_BY_NUMBER.get(nextNum)?.card_name}
                </p>
              </div>
              {UL_IMAGE_BY_NUMBER.get(nextNum) && (
                <img src={cardImageUrl(nextNum, 80)} alt="" className="w-9 h-9 object-cover flex-shrink-0" />
              )}
            </Link>
          ) : <div className="flex-1" />}
        </div>
      </div>

      {/* ── Main content — extra bottom padding clears sticky nav on mobile */}
      <div className="min-h-screen bg-paper-50 text-wood-900 pb-14 md:pb-0">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 pt-14 pb-16 md:pt-32 md:pb-24">

          {/* ── Breadcrumb ─────────────────────────────────────────────── */}
          <nav className="mb-8 md:mb-12">
            {/* Mobile: single back link */}
            <Link
              to="/oracle/universal-language"
              className="md:hidden font-label text-[11px] uppercase tracking-[0.25em] text-wood-500 hover:text-wood-700 transition-colors"
            >
              ← Universal Language
            </Link>
            {/* Desktop: full breadcrumb */}
            <div className="hidden md:flex items-center flex-wrap gap-x-2 gap-y-1 font-label text-[10px] uppercase tracking-[0.25em] text-wood-400">
              <Link to="/creations/oracle-cards" className="hover:text-wood-700 transition-colors">Oracle</Link>
              <span className="text-wood-300">/</span>
              <Link to="/oracle/universal-language" className="hover:text-wood-700 transition-colors">
                Universal Language
              </Link>
              <span className="text-wood-300">/</span>
              <span className="text-wood-500">{card.ring_name}</span>
              <span className="text-wood-300">/</span>
              <span className="text-wood-700">Card {card.number}</span>
            </div>
          </nav>

          {/* ── Card header ────────────────────────────────────────────── */}
          <div className="flex items-baseline justify-between mb-4">
            <span className="font-label text-sm uppercase tracking-[0.15em] text-bronze-600">
              Card {card.number} / 64
            </span>
            <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-500">
              {card.ring_name}
            </span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-wood-900 font-medium leading-[1.1] mb-2">
            {card.card_name}
          </h1>
          <p className="font-serif text-xl text-wood-700 mb-7 md:mb-10">
            {card.iching.hexagram_name}
          </p>

          {/* ── Card image ─────────────────────────────────────────────── */}
          <div className="mb-10">
            <div className="w-full aspect-square">
              <img
                src={cardImageUrl(card.number, 720)}
                alt={`${card.card_name} — Card ${card.number}, Universal Language Oracle`}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 text-center mt-3">
              Card {card.number} · {card.card_name}
            </p>
          </div>

          {/* ── Trigram bar ────────────────────────────────────────────── */}
          <div className="bg-paper-100/60 border-t border-b border-wood-200 mb-5 py-6 md:py-7">

            <div className="grid grid-cols-2 divide-x divide-wood-200">
              <div className="pr-6 flex flex-col items-center">
                <span className="text-[5.5rem] text-bronze-500 leading-none block mb-2">{card.iching.upper_trigram.symbol}</span>
                <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-3">Upper</p>
                <p className="font-serif text-lg text-wood-900 font-medium leading-snug mb-2 text-center">
                  {card.iching.upper_trigram.name}
                </p>
                <p className="font-sans text-xs text-wood-500 leading-[1.75] text-left">
                  {card.iching.upper_trigram.nature}
                </p>
              </div>
              <div className="pl-6 flex flex-col items-center">
                <span className="text-[5.5rem] text-bronze-500 leading-none block mb-2">{card.iching.lower_trigram.symbol}</span>
                <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-3">Lower</p>
                <p className="font-serif text-lg text-wood-900 font-medium leading-snug mb-2 text-center">
                  {card.iching.lower_trigram.name}
                </p>
                <p className="font-sans text-xs text-wood-500 leading-[1.75] text-left">
                  {card.iching.lower_trigram.nature}
                </p>
              </div>
            </div>
          </div>

          {/* ── I Ching ────────────────────────────────────────────────── */}
          <SectionLabel>I Ching</SectionLabel>
          <p className="font-sans text-base text-wood-700 leading-[1.95] mb-10">
            {card.iching.essence}
          </p>

          {/* ── Element + Nature ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-2">Element</p>
              <p className="font-sans text-sm text-wood-700 leading-[1.7]">{card.element}</p>
            </div>
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-2">Nature</p>
              <p className="font-sans text-sm text-wood-600 leading-[1.7]">{card.nature}</p>
            </div>
          </div>

          {/* ── Gene Keys chapter break ─────────────────────────────────── */}
          <ChapterBreak />

          {/* ── Gene Keys ──────────────────────────────────────────────── */}
          <SectionLabel>Gene Keys</SectionLabel>

          {/* Spectrum bar */}
          <div className="flex border border-wood-200 mb-5 overflow-hidden bg-gradient-to-r from-wood-50 via-bronze-50 to-wood-50">
            <div className="flex-1 px-3 py-4 border-r border-wood-200 text-center">
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-stone-600 mb-1.5">Shadow</p>
              <p className="font-sans text-base sm:text-lg text-stone-600 font-medium">{card.gene_keys.shadow}</p>
            </div>
            <div className="flex-[1.2] relative px-3 py-4 border-r border-wood-200 text-center">
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-bronze-700 mb-1.5">Gift</p>
              <p className="font-sans text-base sm:text-lg text-bronze-700 font-medium">{card.gene_keys.gift}</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-bronze-400" />
            </div>
            <div className="flex-1 px-3 py-4 text-center">
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-1.5">Siddhi</p>
              <p className="font-sans text-base sm:text-lg text-wood-600 font-medium">{card.gene_keys.siddhi}</p>
            </div>
          </div>

          {/* Gene Keys description */}
          <div className="space-y-7 mb-8">
            {gkParagraphs.map((p, i) => (
              <p key={i} className="font-sans text-base text-wood-700 leading-[1.95]">{p}</p>
            ))}
          </div>
          <p className="font-sans text-sm text-wood-500 pt-4 border-t border-wood-100 mb-5 leading-[1.7]">
            Gene Keys text based on the work of Richard Rudd,{' '}
            <a
              href="https://genekeys.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-wood-300/60 hover:text-wood-700 hover:border-wood-400 transition-colors pb-px"
            >
              genekeys.com
            </a>
          </p>

          {/* ── Human Design chapter break ─────────────────────────────── */}
          <ChapterBreak />

          {/* ── Human Design ───────────────────────────────────────────── */}
          <SectionLabel>Human Design</SectionLabel>
          <div className="mb-3">
            <span className="inline-flex items-center gap-3 font-label text-[11px] uppercase tracking-[0.12em] text-wood-900 border-b border-wood-300 pb-1 mb-3">
              Gate {card.human_design.gate} · {card.human_design.keyword}
            </span>
          </div>
          <p className="font-sans text-base text-wood-700 leading-[1.85] mb-5">
            {card.human_design.description}
          </p>

          {/* ── Metadata row ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-7 border-t border-b border-wood-200 mt-5">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-2">Codon Ring</p>
              <p className="font-sans text-base text-wood-900">{card.ring_name}</p>
              {card.ring_description && (
                <p className="font-sans text-sm text-wood-600 leading-[1.7] mt-1 mb-2">
                  {card.ring_description}
                </p>
              )}
              {siblings.length > 0 && (
                <div className="mt-2 space-y-2">
                  {siblings.map(n => {
                    const sibling = CARD_BY_NUMBER.get(n);
                    return sibling ? (
                      <Link
                        key={n}
                        to={`/oracle/universal-language/${n}`}
                        className="flex items-center gap-2 py-1 group"
                      >
                        {UL_IMAGE_BY_NUMBER.get(n) && (
                          <img
                            src={cardImageUrl(n, 80)}
                            alt=""
                            className="w-8 h-8 object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                          />
                        )}
                        <span className="font-sans text-sm text-bronze-700 group-hover:text-bronze-600 transition-colors">
                          {n}. {sibling.card_name}
                        </span>
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 mb-2">Tarot</p>
              <p className="font-sans text-base text-wood-900">{card.ring_tarot}</p>
            </div>
          </div>

          {/* ── Traditional Trigram Colors (traditional first) ──────────── */}
          <SectionLabel>Traditional Trigram Colors</SectionLabel>
          <div className="bg-paper-100 px-4 py-4 mb-5">
            <p className="font-sans text-base text-wood-600 leading-[1.8]">
              {card.traditional_colors}
            </p>
          </div>

          {/* ── Color Inspiration ───────────────────────────────────────── */}
          <SectionLabel>Color Inspiration</SectionLabel>
          <div className="border-l-2 border-bronze-400/50 pl-5 py-1 mb-5">
            <p className="font-sans text-base text-wood-600 leading-[1.8]">
              {card.color_inspiration}
            </p>
          </div>

          {/* ── Acquire the piece ───────────────────────────────────────── */}
          {piece && (
            <div className="mt-12 pt-8 border-t border-wood-200">
              <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-4">
                The original artwork
              </p>
              <Link
                to={`/creations/${piece.id}`}
                className="group flex items-center gap-4 border border-wood-200 p-5 hover:border-wood-300 transition-colors"
              >
                <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                  <img
                    src={img(piece.coverImage, { w: 160, h: 160 })}
                    alt={piece.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-base text-wood-900 font-medium group-hover:text-bronze-600 transition-colors">
                    {piece.title} →
                  </p>
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 mt-0.5">
                    {piece.availability === 'SOLD'
                      ? 'Sold'
                      : piece.availability === 'READY_TO_SHIP'
                      ? 'Ready to ship'
                      : 'Made to order'}
                    {piece.dimensions ? ` · ${piece.dimensions}` : ''}
                  </p>
                </div>
              </Link>
            </div>
          )}

          {/* ── Prev / Next navigation (desktop) ───────────────────────── */}
          <div className="hidden md:flex items-center justify-between mt-16 pt-8 border-t border-wood-200">
            {prevNum !== null ? (
              <Link
                to={`/oracle/universal-language/${prevNum}`}
                className="group flex flex-col gap-1 max-w-[44%]"
              >
                <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 group-hover:text-wood-800 transition-colors">← Prev</span>
                <span className="font-sans text-sm text-wood-700 group-hover:text-bronze-600 transition-colors">
                  {prevNum}. {CARD_BY_NUMBER.get(prevNum)?.card_name}
                </span>
              </Link>
            ) : <span />}

            <Link
              to="/oracle/universal-language"
              className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 hover:text-wood-800 transition-colors flex-shrink-0 border-x border-wood-300 px-4 py-1"
            >
              All 64
            </Link>

            {nextNum !== null ? (
              <Link
                to={`/oracle/universal-language/${nextNum}`}
                className="group flex flex-col gap-1 items-end max-w-[44%]"
              >
                <span className="font-label text-[11px] uppercase tracking-[0.1em] text-wood-600 group-hover:text-wood-800 transition-colors">Next →</span>
                <span className="font-sans text-sm text-wood-700 group-hover:text-bronze-600 transition-colors">
                  {nextNum}. {CARD_BY_NUMBER.get(nextNum)?.card_name}
                </span>
              </Link>
            ) : <span />}
          </div>

          {/* ── Keyboard nav hint (desktop only) ───────────────────────── */}
          <div className="hidden md:flex justify-center mt-6">
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400">
              ← → keys to navigate
            </p>
          </div>

        </div>
      </div>
    </>
  );
};

export default UniversalLanguageCard;
