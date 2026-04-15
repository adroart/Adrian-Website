
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { getExpandedCard, type ExpandedGeneKeyLevel } from '../data/expandedOracleData';
import { getSynthesis } from '../data/synthesisData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import { OracleQREntrance } from './OracleQREntrance';
import { OracleCardEntrance } from './OracleCardEntrance';

/* ─── Sections ───────────────────────────────────────────────────────────── */

type Screen = 'field' | 'iching' | 'genekeys' | 'humandesign' | 'connections';

/* ─── Per-section palette ─────────────────────────────────────────────────── */

// Alternating light / dark / light / dark / light
const SCREEN_BG: Record<Screen, string> = {
  field:       'bg-paper-50',
  iching:      'bg-stone-900',
  genekeys:    'bg-stone-50',
  humandesign: 'bg-stone-900',
  connections: 'bg-stone-50',
};

const DARK_SECTIONS: Screen[] = ['iching', 'humandesign'];

function isDarkSection(s: Screen): boolean {
  return DARK_SECTIONS.includes(s);
}

function screenText(screen: Screen, tier: 'primary' | 'secondary' | 'label' | 'muted'): string {
  if (!isDarkSection(screen)) {
    return { primary: 'text-wood-900', secondary: 'text-wood-700', label: 'text-wood-500', muted: 'text-wood-400' }[tier];
  }
  return { primary: 'text-stone-100', secondary: 'text-stone-300', label: 'text-stone-400', muted: 'text-stone-400' }[tier];
}

function screenBorder(screen: Screen): string {
  if (!isDarkSection(screen)) return 'border-wood-200';
  return 'border-stone-700';
}

// Dark-section card shadows (I Ching) — 1px white top edge simulates light source
const CARD_SHADOW      = 'shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.55)]';
const CARD_SHADOW_DEEP = 'shadow-[0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.7)]';
// Light-section card shadows (Gene Keys) — warm paper drop shadow
const CARD_SHADOW_LIGHT = 'shadow-[0_4px_16px_rgba(60,44,22,0.1),0_1px_3px_rgba(60,44,22,0.06)]';

/* ─── Reference bar lookups ──────────────────────────────────────────────── */

const ASTRO_SYMBOLS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

const HEBREW_CHARS: Record<string, string> = {
  Aleph: 'א', Beth: 'ב', Gimel: 'ג', Daleth: 'ד', He: 'ה', Vau: 'ו',
  Zayin: 'ז', Cheth: 'ח', Teth: 'ט', Yod: 'י', Kaph: 'כ', Lamed: 'ל',
  Mem: 'מ', Nun: 'נ', Samech: 'ס', Ayin: 'ע', Pe: 'פ', Tzaddi: 'צ',
  Qoph: 'ק', Resh: 'ר', Shin: 'ש', Tau: 'ת',
};

/* ─── Reference strip SVG icons ─────────────────────────────────────────── */

const IconHexagram = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconGate = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconPath = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h18M3 6l9-3 9 3M3 18l9 3 9-3"/>
  </svg>
);
const IconBody = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>
  </svg>
);

/* ─── Image helpers ──────────────────────────────────────────────────────── */

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

/* ─── Lightbox ───────────────────────────────────────────────────────────── */

const Lightbox: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-stone-950/96 flex items-center justify-center cursor-zoom-out"
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Full image. Click to close."
    >
      <img src={src} alt={alt} className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
};

/* ─── Collapsible section ────────────────────────────────────────────────── */

const Expand: React.FC<{
  label: string;
  subtitle?: string;
  preview: React.ReactNode;
  children: React.ReactNode;
  borderColor: string;
  labelColor: string;
  innerPx?: string;
}> = ({ label, subtitle, preview, children, borderColor, labelColor, innerPx = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-t ${borderColor} pt-4 pb-5 ${innerPx}`}>
      <button className="w-full text-left" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`font-label text-[11px] uppercase tracking-[0.2em] ${labelColor} mb-1`}>{label}</p>
            {subtitle && <p className="font-sans text-[11px] italic text-stone-600 mb-2">{subtitle}</p>}
            {!open && <div>{preview}</div>}
          </div>
          <span
            className={`text-lg ${labelColor} flex-shrink-0 transition-transform duration-200 leading-none mt-1`}
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            aria-hidden="true"
          >+</span>
        </div>
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
};

/* ─── Gene Key level — floating island with tone-specific personality ─────── */

type GeneKeyTone = 'shadow' | 'gift' | 'siddhi';

const TONE_CONFIG: Record<GeneKeyTone, {
  label:      string;
  // Background uses a tailwind class with a dark: variant so the card flips
  // in dark mode (inline hex styles don't respond to .dark, but the text
  // tokens inside do — keeping them in sync prevents invisible text).
  cardBg:     string;
  cardBorder: string;
  topBar:     string;
  labelColor: string;
  nameColor:  string;
  bodyColor:  string;
  moreColor:  string;
}> = {
  shadow: {
    label:      'Shadow',
    // Cool stone — grounded, heavy, the beginning. Dark: cool midnight stone.
    cardBg:     'bg-[#eae8e5] dark:bg-[#2a2825]',
    cardBorder: 'border-stone-300/70',
    topBar:     'bg-stone-400',
    labelColor: 'text-stone-500',
    nameColor:  'text-stone-800',
    bodyColor:  'text-stone-700',
    moreColor:  'text-stone-500',
  },
  gift: {
    label:      'Gift',
    // Warm amber cream — transformative warmth. Dark: deep ember.
    cardBg:     'bg-[#faf5ee] dark:bg-[#2a231a]',
    cardBorder: 'border-bronze-300/50',
    topBar:     'bg-bronze-500',
    labelColor: 'text-bronze-600',
    nameColor:  'text-wood-800',
    bodyColor:  'text-wood-700',
    moreColor:  'text-bronze-500',
  },
  siddhi: {
    label:      'Siddhi',
    // Warm ivory — luminous, the most open. Dark: deep warm charcoal.
    cardBg:     'bg-[#f8f6f2] dark:bg-[#23201d]',
    cardBorder: 'border-wood-300/50',
    topBar:     'bg-wood-400',
    labelColor: 'text-wood-500',
    nameColor:  'text-wood-900',
    bodyColor:  'text-wood-800',
    moreColor:  'text-wood-500',
  },
};

const GeneKeyCard: React.FC<{ tone: GeneKeyTone; level: ExpandedGeneKeyLevel; id?: string }> = ({ tone, level, id }) => {
  const [open, setOpen] = useState(false);
  const cfg = TONE_CONFIG[tone];
  const paragraphs = (open ? level.expanded.text : level.collapsed.text).split('\n\n').filter(Boolean);

  return (
    // Entire card is the click target for expand/collapse.
    // Text nodes stop propagation so users can still select and copy text.
    <div
      id={id}
      className={`rounded-2xl border ${cfg.cardBorder} ${cfg.cardBg} mb-4 overflow-hidden ${CARD_SHADOW_LIGHT} cursor-pointer`}
      onClick={() => setOpen(v => !v)}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
    >
      {/* Tone accent bar — 3px colored rule at card top */}
      <div className={`h-[3px] w-full ${cfg.topBar}`} />

      <div className="px-6 py-6">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className={`font-label text-[11px] uppercase tracking-[0.2em] flex-shrink-0 ${cfg.labelColor}`}>{cfg.label}</span>
            <span className={`font-sans text-xl font-medium ${cfg.nameColor}`}>{level.name}</span>
          </div>
          <span className={`font-label text-[11px] flex-shrink-0 ${cfg.moreColor}`} aria-hidden="true">
            {open ? '−' : '+'}
          </span>
        </div>
        {/* Contemplation title — non-text, stays clickable */}
        <p className={`font-label text-[11px] uppercase tracking-[0.15em] ${cfg.moreColor} mb-5`}>{level.contemplation_title}</p>
        {/* Text content — stops propagation so selection/copy still works */}
        <div className="space-y-4 mb-3" onClick={e => e.stopPropagation()}>
          {paragraphs.map((p, i) => (
            <p key={i} className={`font-sans text-[15px] ${cfg.bodyColor} leading-[1.9] select-text cursor-text`}>{p}</p>
          ))}
        </div>
        {tone === 'shadow' && open && (level.repressive_nature || level.reactive_nature) && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-stone-300/60"
            onClick={e => e.stopPropagation()}
          >
            {level.repressive_nature && (
              <div className="border-l border-stone-300 pl-3">
                <p className="font-label text-[11px] uppercase tracking-[0.15em] text-stone-500 mb-1">
                  Repressive · {level.repressive_nature.label}
                </p>
                <p className="font-sans text-sm text-stone-600 leading-[1.8] select-text cursor-text">{level.repressive_nature.description}</p>
              </div>
            )}
            {level.reactive_nature && (
              <div className="border-l border-stone-300 pl-3">
                <p className="font-label text-[11px] uppercase tracking-[0.15em] text-stone-500 mb-1">
                  Reactive · {level.reactive_nature.label}
                </p>
                <p className="font-sans text-sm text-stone-600 leading-[1.8] select-text cursor-text">{level.reactive_nature.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Card link ──────────────────────────────────────────────────────────── */

const CardLink: React.FC<{
  number: number;
  label?: string;
  onClick: () => void;
  context?: string;
}> = ({ number, label, onClick, context }) => {
  const sibling = CARD_BY_NUMBER.get(number);
  if (!sibling) return null;
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-paper-50 border border-wood-200 hover:border-wood-300 transition-all text-left shadow-[0_2px_8px_rgba(60,44,22,0.07)]"
    >
      <img
        src={cardImageUrl(number, 120)}
        alt=""
        className="w-16 h-16 object-cover flex-shrink-0 rounded-lg"
      />
      <div className="flex-1 min-w-0">
        {label && <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 mb-0.5">{label}</p>}
        <p className="font-sans text-sm text-wood-900 font-medium group-hover:text-bronze-600 transition-colors">{sibling.card_name}</p>
        <p className="font-sans text-xs text-wood-500 mt-0.5">{sibling.iching.hexagram_name}</p>
        {context && <p className="font-sans text-xs text-wood-400 mt-1 leading-[1.65] line-clamp-2">{context}</p>}
      </div>
      <span className="text-wood-300 group-hover:text-bronze-500 transition-colors flex-shrink-0 text-sm">→</span>
    </button>
  );
};

/* ─── Main component ─────────────────────────────────────────────────────── */

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();

  const cardNum  = parseInt(number ?? '', 10);
  const card      = CARD_BY_NUMBER.get(cardNum);
  const expanded  = getExpandedCard(cardNum);
  const synthesis = getSynthesis(cardNum);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [shareOpen,    setShareOpen]    = useState(false);

  const [showQREntrance, setShowQREntrance] = useState(
    () => new URLSearchParams(window.location.search).get('ref') === 'qr'
  );
  const [showIndexEntrance, setShowIndexEntrance] = useState(
    () => (location.state as { ritual?: boolean } | null)?.ritual === true
  );

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const sortedNums  = ALL_CARDS.map(c => c.number);
  const currentIdx  = sortedNums.indexOf(cardNum);
  const prevCardNum = currentIdx > 0 ? sortedNums[currentIdx - 1] : null;
  const nextCardNum = currentIdx < sortedNums.length - 1 ? sortedNums[currentIdx + 1] : null;

  useEffect(() => {
    setLightboxOpen(false);
    window.scrollTo(0, 0);
  }, [cardNum]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  && prevCardNum !== null) navigate(`/oracle/universal-language/${prevCardNum}`,  { state: { ritual: true } });
      if (e.key === 'ArrowRight' && nextCardNum !== null) navigate(`/oracle/universal-language/${nextCardNum}`, { state: { ritual: true } });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevCardNum, nextCardNum, navigate]);

  const shareUrl  = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = card ? `${card.card_name} · Code ${card.number} · Universal Language Oracle by Adrian Rasmussen` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try { await navigator.share({ title: shareText, url: shareUrl }); } catch {}
  };

  useMetaTags({
    title: card ? `${card.card_name} · Code ${cardNum} · Universal Language Oracle` : undefined,
    description: card
      ? `${card.iching.hexagram_name} · ${card.gene_keys.shadow} / ${card.gene_keys.gift} / ${card.gene_keys.siddhi}. Universal Language Oracle by Adrian Rasmussen.`
      : undefined,
    image: card
      ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${UL_IMAGE_BY_NUMBER.get(cardNum) ?? 'adrian-website/placeholders/oracle-card-3'}`
      : undefined,
  });

  if (!card) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-serif text-2xl text-wood-600 mb-4">This card has not yet arrived.</p>
          <p className="font-sans text-sm text-wood-400 mb-8 leading-[1.8]">The oracle holds 64 expressions. This one may be waiting for you elsewhere.</p>
          <Link to="/oracle/universal-language" className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 border-b border-bronze-600/40 pb-px">
            Return to the oracle
          </Link>
        </div>
      </div>
    );
  }

  const piece    = UL_PIECE_BY_NUMBER.get(card.number);
  const pairCard = expanded ? CARD_BY_NUMBER.get(expanded.i_ching.hexagrams_in_pairs.pair_hexagram) : undefined;
  const siblings = card.codon_ring_siblings;
  const imageAlt = `${card.card_name}, Universal Language ${card.number}. Original airbrushed painting on laser-cut wood by Adrian Rasmussen.`;

  const ichingHighlight = expanded?.i_ching?.reflection?.text ?? card.iching.essence;

  return (
    <>
      {showQREntrance    && <OracleQREntrance   card={card} onDone={() => setShowQREntrance(false)} />}
      {showIndexEntrance && <OracleCardEntrance card={card} onDone={() => setShowIndexEntrance(false)} />}
      {lightboxOpen      && <Lightbox src={cardImageUrl(card.number, 1200)} alt={imageAlt} onClose={() => setLightboxOpen(false)} />}

      {/* ── Single scrolling page — four color-blocked sections ──────────── */}
      {/* pt-20 (80px) clears the fixed Navigation (≈72px when not scrolled, ≈40px when scrolled) so the image isn't overlapped. */}
      <div className="pt-20 pb-14">

        {/* ════════════ FIELD ════════════════════════════════════════════ */}
        <section id="field" className={`${SCREEN_BG.field} scroll-mt-16`}>

          {/* Image — full-bleed on mobile, contained on desktop */}
          <div className="md:max-w-2xl md:mx-auto">
            <figure
              className="w-full aspect-square cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              role="button" tabIndex={0} aria-label="Enlarge image"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true); } }}
            >
              <img src={cardImageUrl(card.number, 900)} alt={imageAlt} className="w-full h-full object-cover" loading="eager" />
            </figure>

            {/* Order + Share — two-up row directly below image */}
            <div className="border-t border-wood-200/60">
              <div className="flex divide-x divide-wood-200/40">
                {/* Collect */}
                <Link
                  to={piece ? `/creations/${piece.id}` : '/inquire'}
                  className="group flex-1 flex items-center justify-between gap-4 px-5 py-4 bg-paper-50 hover:bg-paper-100 transition-colors duration-200"
                >
                  <div>
                    <p className="font-serif text-[16px] text-wood-900 group-hover:text-bronze-600 transition-colors duration-200 leading-tight">
                      Collect
                    </p>
                    <p className="font-label text-[9px] uppercase tracking-[0.2em] text-wood-400 mt-0.5">
                      Original art
                    </p>
                  </div>
                  {piece?.availability === 'SOLD' && (
                    <span className="font-label text-[9px] uppercase tracking-[0.2em] ml-auto flex-shrink-0 text-wood-400">
                      Sold
                    </span>
                  )}
                  {piece?.availability === 'READY_TO_SHIP' && (
                    <span className="font-label text-[9px] uppercase tracking-[0.2em] ml-auto flex-shrink-0 text-bronze-500 group-hover:text-bronze-400 transition-colors duration-200">
                      Available
                    </span>
                  )}
                </Link>

                {/* Share */}
                <button
                  onClick={() => setShareOpen(v => !v)}
                  className="group flex-1 flex items-center justify-end px-5 py-4 bg-paper-50 hover:bg-paper-100 transition-colors duration-200"
                  aria-expanded={shareOpen}
                >
                  <div className="text-right">
                    <p className="font-serif text-[16px] text-wood-900 group-hover:text-bronze-600 transition-colors duration-200 leading-tight">
                      Share
                    </p>
                    <p className="font-label text-[9px] uppercase tracking-[0.2em] text-wood-400 mt-0.5">
                      This card
                    </p>
                  </div>
                </button>
              </div>

              {/* Share sheet — expands below */}
              {shareOpen && (
                <div className="border-t border-wood-200/40 bg-paper-100 px-5 py-4">
                  <div className="grid grid-cols-2 gap-2">

                    {/* Copy link */}
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors text-left"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <span className={`font-label text-[11px] uppercase tracking-[0.15em] transition-colors ${copied ? 'text-bronze-600' : 'text-wood-600'}`}>
                        {copied ? 'Copied!' : 'Copy link'}
                      </span>
                    </button>

                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-[#25D366] flex-shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                      </svg>
                      <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600">WhatsApp</span>
                    </a>

                    {/* Telegram */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-[#2AABEE] flex-shrink-0">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600">Telegram</span>
                    </a>

                    {/* X / Twitter */}
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-wood-700 flex-shrink-0">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600">X / Twitter</span>
                    </a>

                    {/* Email */}
                    <a
                      href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent('I wanted to share this oracle card with you:\n\n' + shareUrl)}`}
                      className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                      <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600">Email</span>
                    </a>

                    {/* Native share — only shown where supported (mobile) */}
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        onClick={handleNativeShare}
                        className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors text-left"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0">
                          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600">More options</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:max-w-2xl md:mx-auto px-2 sm:px-6 pt-8 pb-0">
            {/* Info box */}
            <div className="rounded-t-2xl border-x border-t border-wood-200/60 bg-paper-50 px-5 pt-5 pb-6">
              {/* Title row — name left, number + hexagram right */}
              <div className="flex items-end justify-between gap-4 mb-5">
                <h1 className="font-serif text-[44px] text-wood-900 leading-[1.0] flex-1 min-w-0">{card.card_name}</h1>
                <div className="flex items-end gap-2.5 flex-shrink-0 pb-0.5">
                  <span className="font-serif text-xl text-wood-400 leading-none mb-0.5">{card.number}</span>
                  {synthesis?.reference?.hexagram_symbol && (
                    <span className="text-[46px] text-wood-700 leading-none">{synthesis.reference.hexagram_symbol}</span>
                  )}
                </div>
              </div>

              {/* Keywords — flowing editorial text */}
              {(() => {
                const kws = synthesis?.keywords ?? expanded?.keywords ?? [];
                return kws.length > 0 ? (
                  <p className="font-sans text-[12px] text-wood-500 leading-[1.9] tracking-[0.04em]">
                    {kws.join('  ·  ')}
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-1 sm:px-3 pt-0 pb-14">

            {/* Reference strip — section-grouped metadata, each row links to its section */}
            {synthesis?.reference && (
              <div className="rounded-b-2xl overflow-hidden border-x border-b border-wood-200/60 divide-y divide-wood-200/40 shadow-[0_4px_16px_rgba(60,44,22,0.09)] mb-3">
                {/* I Ching — hexagram identity */}
                <button onClick={() => go('iching')} className="group w-full flex items-center justify-between gap-4 border-l-[3px] border-stone-400 bg-stone-50/70 hover:bg-stone-100 px-5 py-5 text-left transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <IconHexagram />
                    <span className="font-label text-[11px] uppercase tracking-[0.18em] text-stone-400">I Ching</span>
                    <span className="text-stone-300" aria-hidden="true">·</span>
                    <span className="text-[19px] text-stone-500 leading-none">{synthesis.reference.hexagram_symbol}</span>
                    <span className="font-sans text-[15px] text-stone-600">{card.iching.hexagram_name}</span>
                    <span className="text-stone-300" aria-hidden="true">·</span>
                    <span className="font-mono text-sm text-stone-400 tracking-widest">{synthesis.reference.binary}</span>
                  </div>
                  <span className="text-stone-300 group-hover:text-stone-500 transition-colors flex-shrink-0">→</span>
                </button>

                {/* Gene Keys — shadow, gift, siddhi */}
                <button onClick={() => go('genekeys')} className="group w-full flex items-center justify-between gap-4 border-l-[3px] border-bronze-400 bg-bronze-50/70 hover:bg-bronze-100 px-5 py-5 text-left transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22V12M12 12L4 7M12 12l8-5M4 7V17l8 5 8-5V7L12 2 4 7z"/></svg>
                    <span className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-500">Gene Keys</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-stone-600">{card.gene_keys.shadow}</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-bronze-600 font-medium">{card.gene_keys.gift}</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-600">{card.gene_keys.siddhi}</span>
                  </div>
                  <span className="text-bronze-300 group-hover:text-bronze-500 transition-colors flex-shrink-0">→</span>
                </button>

                {/* Human Design — center, circuit, harmonic */}
                <button onClick={() => go('humandesign')} className="group w-full flex items-center justify-between gap-4 border-l-[3px] border-wood-400 bg-wood-50/70 hover:bg-wood-100 px-5 py-5 text-left transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <IconGate />
                    <span className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-400">Human Design</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-700">{synthesis.reference.hd_center} Center</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-600">{synthesis.reference.hd_circuit}</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-500">{synthesis.reference.hd_harmonic_gate}</span>
                  </div>
                  <span className="text-wood-300 group-hover:text-wood-500 transition-colors flex-shrink-0">→</span>
                </button>

                {/* Tarot / Kabbalah — card, path, astrology, Hebrew */}
                <button onClick={() => go('connections')} className="group w-full flex items-center justify-between gap-4 border-l-[3px] border-wood-400 bg-wood-50/70 hover:bg-wood-100 px-5 py-5 text-left transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <IconPath />
                    <span className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-500">Tarot</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-700">{synthesis.reference.tarot_card}</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-600">{synthesis.reference.astrology}</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-[15px] text-wood-600">{HEBREW_CHARS[synthesis.reference.hebrew_letter] ?? ''} {synthesis.reference.hebrew_letter}</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-sm text-wood-400">Path {synthesis.reference.path}</span>
                  </div>
                  <span className="text-wood-300 group-hover:text-wood-500 transition-colors flex-shrink-0">→</span>
                </button>

                {/* Body — physiology, amino acid, programming partner */}
                <button onClick={() => go('connections')} className="group w-full flex items-center justify-between gap-4 border-l-[3px] border-stone-300 bg-paper-100/80 hover:bg-paper-100 px-5 py-5 text-left transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <IconBody />
                    <span className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-400">Body</span>
                    <span className="text-wood-300" aria-hidden="true">·</span>
                    <span className="font-sans text-sm text-wood-700">{synthesis.reference.body_physiology}</span>
                    {synthesis.reference.body_amino_acid && (
                      <>
                        <span className="text-wood-300" aria-hidden="true">·</span>
                        <span className="font-sans text-sm text-wood-600">{synthesis.reference.body_amino_acid}</span>
                      </>
                    )}
                    {synthesis.reference.programming_partner && (
                      <>
                        <span className="text-wood-300" aria-hidden="true">·</span>
                        <span className="font-sans text-xs text-wood-400">Partner Key {synthesis.reference.programming_partner}</span>
                      </>
                    )}
                  </div>
                  <span className="text-wood-300 group-hover:text-wood-500 transition-colors flex-shrink-0">→</span>
                </button>
              </div>
            )}




            {/* Island 3 — Creator voice (conditional) */}
            {expanded?.creator_voice?.personal_reading ? (
              <div className="card-grain rounded-2xl bg-stone-100 border border-wood-200/30 px-5 py-8 shadow-[inset_0_1px_3px_rgba(60,44,22,0.06)]">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-6">From the creator</p>
                <div className="space-y-5">
                  {expanded.creator_voice.personal_reading.split('\n\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="font-sans text-[15px] text-wood-800 leading-[1.9]">{p}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ════════════ I CHING ══════════════════════════════════════════ */}
        {/* dark-preserve: intentionally-dark section stays dark in dark mode
            (without it, bg-stone-900 would remap to a light tone). */}
        <section id="iching" className={`${SCREEN_BG.iching} scroll-mt-16 dark-preserve`}>
          <div className="max-w-2xl mx-auto px-1 sm:px-3 pt-12 pb-14 space-y-4">

            {/* Island 1 — Header + Trigrams */}
            <div className={`rounded-2xl border border-stone-700/50 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(28, 25, 23, 0.7)' }}>
              <div className="mb-6">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">Hexagram {card.number}</p>
                <h2 className="font-serif text-3xl text-stone-100 font-semibold leading-[1.2] mb-1">{card.iching.hexagram_name}</h2>
                <p className="font-sans text-sm text-stone-500">{card.card_name}</p>
              </div>
              {/* Trigrams */}
              {(() => {
                const doubled = card.iching.upper_trigram.symbol === card.iching.lower_trigram.symbol;
                return (
                  <div className="space-y-4 border-t border-stone-700/50 pt-5">
                    <div className="flex items-start gap-5">
                      <div className="text-center w-10 flex-shrink-0">
                        <span className="text-3xl text-bronze-400 leading-none block">{card.iching.upper_trigram.symbol}</span>
                        <p className="font-label text-[11px] text-stone-400 mt-1">{card.iching.upper_trigram.name}</p>
                      </div>
                      <p className="font-sans text-sm text-stone-300 leading-[1.8] pt-1">{card.iching.upper_trigram.nature}</p>
                    </div>
                    <div className="flex items-start gap-5">
                      <div className="text-center w-10 flex-shrink-0">
                        <span className="text-3xl text-bronze-500 leading-none block">{card.iching.lower_trigram.symbol}</span>
                        <p className="font-label text-[11px] text-stone-400 mt-1">{card.iching.lower_trigram.name}</p>
                      </div>
                      {doubled
                        ? <p className="font-sans text-sm text-stone-400 pt-2">Same as above</p>
                        : <p className="font-sans text-sm text-stone-300 leading-[1.8] pt-1">{card.iching.lower_trigram.nature}</p>
                      }
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Island 2 — Synthesis reading (trigram combination + prose) */}
            {synthesis && (
              <div className={`rounded-2xl border border-stone-700/40 px-6 py-6 space-y-5 ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500">Reading</p>
                <p className="font-sans text-[15px] text-stone-300 leading-[1.9] italic">{synthesis.synthesis.iching.trigram_combination}</p>
                <div className="border-t border-stone-700/40 pt-5 space-y-4">
                  {synthesis.synthesis.iching.reading.split('\n\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="font-sans text-[15px] text-stone-200 leading-[1.9]">{p}</p>
                  ))}
                </div>
                {(synthesis.synthesis.iching.judgement_lines.length > 0 || synthesis.synthesis.iching.image_lines.length > 0) && (
                  <div className="border-t border-stone-700/40 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {synthesis.synthesis.iching.judgement_lines.length > 0 && (
                      <div>
                        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">Judgement</p>
                        {synthesis.synthesis.iching.judgement_lines.map((line, i) => (
                          <p key={i} className="font-serif text-[15px] text-stone-300 leading-[1.9]">{line}</p>
                        ))}
                      </div>
                    )}
                    {synthesis.synthesis.iching.image_lines.length > 0 && (
                      <div>
                        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">Image</p>
                        {synthesis.synthesis.iching.image_lines.map((line, i) => (
                          <p key={i} className="font-serif text-[15px] text-stone-300 leading-[1.9]">{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Island 3 — Wisdom group (only when no synthesis) */}
            {!synthesis && expanded && (
              <div className={`rounded-2xl border border-stone-700/40 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <Expand
                  label="Overview"
                  borderColor="border-stone-700/40" labelColor="text-stone-500"
                  innerPx="px-6"
                  preview={<p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{expanded.i_ching.trigrams.overview.text}</p>}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Outer</p>
                      <p className="font-sans text-sm text-stone-300 leading-[1.8]">{expanded.i_ching.trigrams.outer.context.text}</p>
                    </div>
                    <div>
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Inner</p>
                      <p className="font-sans text-sm text-stone-300 leading-[1.8]">{expanded.i_ching.trigrams.inner.context.text}</p>
                    </div>
                  </div>
                  <p className="font-sans text-sm text-stone-500 leading-[1.8] mt-4">
                    {expanded.i_ching.trigrams.family_dynamic.text}
                  </p>
                </Expand>
                <Expand
                  label="The Judgment"
                  subtitle="the oracle's ruling on this moment"
                  borderColor="border-stone-700/40" labelColor="text-stone-500"
                  innerPx="px-6"
                  preview={(() => {
                    const lines = expanded.i_ching.image_of_the_situation.text.split('\n').filter(Boolean);
                    const headline = lines[0];
                    const stages = lines[1]?.replace(/\.$/, '').split(',').map(s => s.trim()).filter(Boolean) ?? [];
                    const fom = expanded.i_ching.image_of_the_situation.fields_of_meaning ?? '';
                    const timeCycleSentences = fom.split('. ').filter(s => s.includes('Time Cycle') || s.includes('four stages'));
                    const timeCycleText = timeCycleSentences.join('. ').replace(/\.?$/, '.');
                    return (
                      <div className="space-y-5">
                        <p className="font-serif text-2xl text-stone-100 leading-[1.6]">{headline}</p>
                        {stages.length > 0 && (
                          <div>
                            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-stone-600 mb-2">The four stages of the time cycle</p>
                            <div className="flex gap-3 flex-wrap">
                              {stages.map((s, i) => (
                                <span key={i} className="font-serif text-base text-stone-300 border border-stone-700/50 rounded px-3 py-1">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {timeCycleText && (
                          <p className="font-sans text-[13px] text-stone-400 leading-[1.8]">{timeCycleText}</p>
                        )}
                      </div>
                    );
                  })()}
                >
                  <p className="font-sans text-[13px] text-stone-500 leading-[1.8] mb-5">{expanded.i_ching.image_of_the_situation.fields_of_meaning}</p>
                  <div className="space-y-2 border-t border-stone-700/30 pt-4">
                    {expanded.i_ching.image_tradition.text.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="font-sans text-[15px] text-stone-300 leading-[1.9]">{line}</p>
                    ))}
                  </div>
                </Expand>
                <Expand
                  label="Patterns of Wisdom"
                  borderColor="border-stone-700/40" labelColor="text-stone-500"
                  innerPx="px-6"
                  preview={<p className="font-sans text-sm text-stone-400 leading-[1.8]">{expanded.i_ching.patterns_of_wisdom.nature_image}</p>}
                >
                  <p className="font-sans text-[15px] text-stone-200 mb-1">{expanded.i_ching.patterns_of_wisdom.nature_image}</p>
                  <p className="font-sans text-[15px] text-stone-200 mb-5">{expanded.i_ching.patterns_of_wisdom.guidance}</p>
                  <p className="font-sans text-[15px] text-stone-300 leading-[1.9]">{expanded.i_ching.patterns_of_wisdom.context.text}</p>
                </Expand>
              </div>
            )}

            {/* Island 4 — Reflection (only when no synthesis) */}
            {!synthesis && expanded && (
              <div className={`rounded-2xl border border-bronze-800/40 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(30, 22, 12, 0.75)' }}>
                {/* Bronze accent bar */}
                <div className="h-[3px] w-full bg-bronze-400" />
                <div className="px-6 py-7">
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-500 mb-5">Reflection</p>
                  <p className="font-serif text-xl text-stone-100 leading-[1.9]">{expanded.i_ching.reflection.text}</p>
                </div>
              </div>
            )}

            {/* Fallback if no expanded data */}
            {!expanded && (
              <div className={`rounded-2xl border border-stone-700/40 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{card.iching.essence}</p>
              </div>
            )}

            {/* Paired hexagram lives in Connections section — not duplicated here */}
          </div>
        </section>

        {/* ════════════ GENE KEYS + CONNECTIONS ════════════════════════ */}
        <section id="genekeys" className={`${SCREEN_BG.genekeys} scroll-mt-16`}>
          <div className="max-w-2xl mx-auto px-1 sm:px-3 pt-12 pb-14 space-y-4">

            {/* Island 1 — Header */}
            <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 ${CARD_SHADOW_LIGHT}`}>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 mb-2">
                Gene Key {card.number} · Gate {card.human_design.gate}
              </p>
              <h2 className="font-serif text-3xl text-wood-900 font-semibold leading-[1.2] mb-3">{card.card_name}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-sans text-sm text-stone-500">{card.gene_keys.shadow}</span>
                <span className="text-wood-300" aria-hidden="true">·</span>
                <span className="font-sans text-sm text-bronze-600 font-medium">{card.gene_keys.gift}</span>
                <span className="text-wood-300" aria-hidden="true">·</span>
                <span className="font-sans text-sm text-wood-600">{card.gene_keys.siddhi}</span>
              </div>
            </div>

            {/* Islands 2–4 — synthesis readings, GeneKeyCards, or fallback description */}
            {synthesis ? (
              <>
                <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 space-y-6 ${CARD_SHADOW_LIGHT}`}>
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500">Reading</p>
                  {[
                    { label: 'Shadow', color: 'text-stone-500', text: synthesis.synthesis.gene_keys.shadow },
                    { label: 'Repressive', color: 'text-stone-400', text: synthesis.synthesis.gene_keys.repressive },
                    { label: 'Reactive', color: 'text-stone-400', text: synthesis.synthesis.gene_keys.reactive },
                    { label: 'Gift', color: 'text-bronze-600', text: synthesis.synthesis.gene_keys.gift },
                    { label: 'Siddhi', color: 'text-wood-600', text: synthesis.synthesis.gene_keys.siddhi },
                    { label: 'Programming Partner', color: 'text-wood-400', text: synthesis.synthesis.gene_keys.programming_partner },
                  ].map(({ label, color, text }) => (
                    <div key={label} className="border-t border-wood-100 pt-5 first:border-0 first:pt-0">
                      <p className={`font-label text-[11px] uppercase tracking-[0.2em] ${color} mb-3`}>{label}</p>
                      <div className="space-y-4">
                        {text.split('\n\n').filter(Boolean).map((p, i) => (
                          <p key={i} className="font-sans text-[15px] text-wood-800 leading-[1.9]">{p}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="font-label text-[11px] text-wood-400 px-1 leading-[1.8] italic">
                  Gene Keys text based on the work of Richard Rudd, visit him to dive deeper in wisdom and experiences at{' '}
                  <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-wood-600 transition-colors">genekeys.com</a>
                </p>
              </>
            ) : expanded ? (
              <>
                <GeneKeyCard tone="shadow" level={expanded.gene_keys.shadow} id="genekey-shadow" />
                <GeneKeyCard tone="gift"   level={expanded.gene_keys.gift}   id="genekey-gift" />
                <GeneKeyCard tone="siddhi" level={expanded.gene_keys.siddhi} id="genekey-siddhi" />
                <p className="font-label text-[11px] text-wood-400 px-1 leading-[1.8] italic">
                  Gene Keys text based on the work of Richard Rudd, visit him to dive deeper in wisdom and experiences at{' '}
                  <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-wood-600 transition-colors">genekeys.com</a>
                </p>
              </>
            ) : (
              <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 space-y-5 ${CARD_SHADOW_LIGHT}`}>
                {card.gene_keys.description.split('\n\n').filter(Boolean).map((p, i) => (
                  <p key={i} className="font-sans text-[15px] text-wood-800 leading-[1.9]">{p}</p>
                ))}
              </div>
            )}

          </div>
        </section>

        {/* ════════════ HUMAN DESIGN ════════════════════════════════════ */}
        {/* dark-preserve: intentionally-dark section stays dark in dark mode. */}
        <section id="humandesign" className={`${SCREEN_BG.humandesign} scroll-mt-16 dark-preserve`}>
          <div className="max-w-2xl mx-auto px-1 sm:px-3 pt-12 pb-14 space-y-4">

            {/* Header */}
            <div className={`rounded-2xl border border-stone-700/50 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(28, 25, 23, 0.7)' }}>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">Human Design · Gate {card.human_design.gate}</p>
              <h2 className="font-serif text-3xl text-stone-100 font-semibold leading-[1.2] mb-1">{card.human_design.keyword}</h2>
            </div>

            {/* Description (only when no synthesis) */}
            {!synthesis && (
              <div className={`rounded-2xl border border-stone-700/40 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{card.human_design.description}</p>
                {card.traditional_colors && (
                  <p className="font-sans text-sm text-stone-400 leading-[1.8] mt-5 pt-5 border-t border-stone-700/50">
                    {card.traditional_colors}
                  </p>
                )}
              </div>
            )}

            {/* Synthesis HD reading */}
            {synthesis && (
              <div className={`rounded-2xl border border-stone-700/40 px-6 py-6 space-y-5 ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500">Reading</p>
                {[
                  { label: 'The Gate', text: synthesis.synthesis.human_design.gate },
                  { label: 'The Channel', text: synthesis.synthesis.human_design.channel },
                  { label: 'The Circuit', text: synthesis.synthesis.human_design.circuit },
                ].map(({ label, text }) => (
                  <div key={label} className="border-t border-stone-700/40 pt-5 first:border-0 first:pt-0">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">{label}</p>
                    <div className="space-y-4">
                      {text.split('\n\n').filter(Boolean).map((p, i) => (
                        <p key={i} className="font-sans text-[15px] text-stone-200 leading-[1.9]">{p}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tarot — codon ring connection */}
            {card.ring_tarot && (
              <div className={`rounded-2xl border border-bronze-800/40 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(30, 22, 12, 0.75)' }}>
                <div className="h-[3px] w-full bg-bronze-400" />
                <div className="px-6 py-6">
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-500 mb-1">{card.ring_name}</p>
                  <p className="font-sans text-xl text-stone-100 font-medium mb-4">{card.ring_tarot}</p>
                  {card.ring_description && (
                    <p className="font-sans text-[15px] text-stone-300 leading-[1.9]">{card.ring_description}</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </section>

        {/* ════════════ CONNECTIONS ═════════════════════════════════════ */}
        <section id="connections" className={`${SCREEN_BG.connections} scroll-mt-16`}>
          <div className="max-w-2xl mx-auto px-1 sm:px-3 pt-12 pb-14 space-y-4">

            {expanded ? (
              <>
                {/* Paired Hexagram */}
                {pairCard && (
                  <div className={`rounded-2xl border border-wood-200 overflow-hidden bg-[#fafaf8] dark:bg-[#1d1b18] ${CARD_SHADOW_LIGHT}`}>
                    <div className="px-5 pt-5 pb-3">
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Paired Hexagram</p>
                      <p className="font-sans text-sm text-wood-600 leading-[1.8] mb-3">{expanded.i_ching.hexagrams_in_pairs.context.text}</p>
                    </div>
                    <div className="px-3 pb-3">
                      <CardLink
                        number={expanded.i_ching.hexagrams_in_pairs.pair_hexagram}
                        label={`Code ${expanded.i_ching.hexagrams_in_pairs.pair_hexagram}`}
                        onClick={() => navigate(`/oracle/universal-language/${expanded.i_ching.hexagrams_in_pairs.pair_hexagram}`, { state: { ritual: true } })}
                      />
                    </div>
                  </div>
                )}

                {/* Programming Partner */}
                {expanded.gene_keys.programming_partner && (
                  <div className={`rounded-2xl border border-wood-200 overflow-hidden bg-[#fafaf8] dark:bg-[#1d1b18] ${CARD_SHADOW_LIGHT}`}>
                    <div className="px-5 pt-5 pb-3">
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Programming Partner</p>
                      <p className="font-sans text-sm text-wood-600 leading-[1.8] mb-3">{expanded.gene_keys.programming_partner.relationship_context}</p>
                    </div>
                    <div className="px-3 pb-3">
                      <CardLink
                        number={expanded.gene_keys.programming_partner.number}
                        label={`Code ${expanded.gene_keys.programming_partner.number}`}
                        onClick={() => navigate(`/oracle/universal-language/${expanded.gene_keys.programming_partner!.number}`, { state: { ritual: true } })}
                      />
                    </div>
                  </div>
                )}

                {/* Codon Ring */}
                {siblings.length > 0 && (
                  <div className={`rounded-2xl border border-wood-200 px-5 py-5 bg-[#fafaf8] dark:bg-[#1d1b18] ${CARD_SHADOW_LIGHT}`}>
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-1">{expanded.gene_keys.codon_ring.name}</p>
                    <p className="font-sans text-sm text-wood-600 leading-[1.8] mb-4">{expanded.gene_keys.codon_ring.relationship_context}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {siblings.map(n => {
                        const sibling = CARD_BY_NUMBER.get(n);
                        return sibling ? (
                          <button
                            key={n}
                            onClick={() => navigate(`/oracle/universal-language/${n}`, { state: { ritual: true } })}
                            className="group flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-stone-50 border border-wood-200 hover:border-wood-300 transition-all text-left"
                          >
                            {UL_IMAGE_BY_NUMBER.get(n) && (
                              <img src={cardImageUrl(n, 80)} alt="" className="w-9 h-9 object-cover flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity rounded" />
                            )}
                            <div className="min-w-0">
                              <p className="font-label text-[11px] text-wood-400">{n}</p>
                              <p className="font-sans text-xs text-wood-700 group-hover:text-bronze-600 transition-colors truncate">{sibling.card_name}</p>
                            </div>
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 ${CARD_SHADOW_LIGHT}`}>
                <p className="font-sans text-sm text-wood-500 leading-[1.8]">Connection data will be available soon.</p>
              </div>
            )}

            {/* Tarot resonance */}
            {synthesis && (
              <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 space-y-5 ${CARD_SHADOW_LIGHT}`}>
                <div>
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-2">Tarot · {card.ring_name}</p>
                  <p className="font-sans text-sm text-wood-600 leading-[1.8]">{synthesis.synthesis.tarot.ring_role}</p>
                </div>
                <div className="border-t border-wood-100 pt-5 space-y-4">
                  {synthesis.synthesis.tarot.tarot_resonance.split('\n\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="font-serif text-[17px] text-wood-800 leading-[1.9]">{p}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Body */}
            {synthesis && (
              <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 space-y-5 ${CARD_SHADOW_LIGHT}`}>
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400">Body</p>
                <div>
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-3">Physiology</p>
                  <div className="space-y-4">
                    {synthesis.synthesis.body.physiology.split('\n\n').filter(Boolean).map((p, i) => (
                      <p key={i} className="font-sans text-[15px] text-wood-800 leading-[1.9]">{p}</p>
                    ))}
                  </div>
                </div>
                <div className="border-t border-wood-100 pt-5">
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-3">Amino Acid</p>
                  <div className="space-y-4">
                    {synthesis.synthesis.body.amino_acid.split('\n\n').filter(Boolean).map((p, i) => (
                      <p key={i} className="font-sans text-[15px] text-wood-800 leading-[1.9]">{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}


          </div>
        </section>

      </div>

      {/* ── Sticky bottom nav ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-paper-50/95 border-t border-wood-200 backdrop-blur-sm">
        <div className="flex items-stretch h-11">

          {/* Prev — icon inside the link */}
          {prevCardNum !== null ? (() => {
            const c = CARD_BY_NUMBER.get(prevCardNum);
            return (
              <Link
                to={`/oracle/universal-language/${prevCardNum}`}
                state={{ ritual: true }}
                className="flex items-center gap-2 px-2.5 flex-1 min-w-0 hover:bg-wood-50 transition-colors"
              >
                {c && (
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="text-[14px] text-bronze-400 block leading-none" style={{transform:'scaleX(1.5)'}}>{c.iching.upper_trigram.symbol}</span>
                    <span className="text-[14px] text-bronze-400 block leading-none -mt-[3px]" style={{transform:'scaleX(1.5)'}}>{c.iching.lower_trigram.symbol}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-label text-[8px] uppercase tracking-[0.14em] text-wood-400 leading-none">← Prev</p>
                  <p className="font-sans text-[11px] text-wood-700 leading-tight truncate mt-[3px]">{c?.card_name}</p>
                </div>
              </Link>
            );
          })() : <div className="flex-1" />}

          <Link
            to="/oracle/universal-language"
            className="flex flex-col items-center justify-center px-3.5 border-x border-wood-200 flex-shrink-0 hover:bg-wood-50 transition-colors"
          >
            <span className="font-serif text-[17px] font-semibold text-wood-700 leading-none">{card.number}</span>
            <span className="font-label text-[8px] uppercase tracking-[0.16em] text-wood-400 mt-[3px]">All 64</span>
          </Link>

          {/* Next — icon inside the link */}
          {nextCardNum !== null ? (() => {
            const c = CARD_BY_NUMBER.get(nextCardNum);
            return (
              <Link
                to={`/oracle/universal-language/${nextCardNum}`}
                state={{ ritual: true }}
                className="flex items-center justify-end gap-2 px-2.5 flex-1 min-w-0 hover:bg-wood-50 transition-colors"
              >
                <div className="min-w-0 text-right">
                  <p className="font-label text-[8px] uppercase tracking-[0.14em] text-wood-400 leading-none">Next →</p>
                  <p className="font-sans text-[11px] text-wood-700 leading-tight truncate mt-[3px]">{c?.card_name}</p>
                </div>
                {c && (
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="text-[14px] text-bronze-400 block leading-none" style={{transform:'scaleX(1.5)'}}>{c.iching.upper_trigram.symbol}</span>
                    <span className="text-[14px] text-bronze-400 block leading-none -mt-[3px]" style={{transform:'scaleX(1.5)'}}>{c.iching.lower_trigram.symbol}</span>
                  </div>
                )}
              </Link>
            );
          })() : <div className="flex-1" />}

        </div>
      </div>
    </>
  );
};

export default UniversalLanguageCard;
