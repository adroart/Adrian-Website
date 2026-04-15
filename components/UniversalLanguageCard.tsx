
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { getExpandedCard, type ExpandedGeneKeyLevel } from '../data/expandedOracleData';
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
  preview: React.ReactNode;
  children: React.ReactNode;
  borderColor: string;
  labelColor: string;
  innerPx?: string;
}> = ({ label, preview, children, borderColor, labelColor, innerPx = '' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-t ${borderColor} pt-4 pb-5 ${innerPx}`}>
      <button className="w-full text-left" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`font-label text-[11px] uppercase tracking-[0.2em] ${labelColor} mb-2`}>{label}</p>
            <div>{preview}</div>
          </div>
          <span
            className={`text-lg ${labelColor} flex-shrink-0 transition-transform duration-200 leading-none mt-1`}
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            aria-hidden="true"
          >+</span>
        </div>
      </button>
      {open && <div className="mt-6 space-y-4">{children}</div>}
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
  const card     = CARD_BY_NUMBER.get(cardNum);
  const expanded = getExpandedCard(cardNum);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied,       setCopied]       = useState(false);

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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

          {/* Image + info block — full-bleed on mobile, contained on desktop */}
          <div className="md:max-w-2xl md:mx-auto">
            <figure
              className="w-full aspect-square cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              role="button" tabIndex={0} aria-label="Enlarge image"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true); } }}
            >
              <img src={cardImageUrl(card.number, 900)} alt={imageAlt} className="w-full h-full object-cover" loading="eager" />
            </figure>

            {/* Info block — title box connected to painting link + share strip */}
            <div className="border-t border-b border-wood-200/60">
              {/* Title + keywords */}
              <div className="card-grain bg-paper-100 px-5 py-6 border-b border-wood-200/40">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 mb-2">Code {card.number}</p>
                <p className="font-serif text-2xl text-wood-900 font-semibold leading-[1.2] mb-4">{card.card_name}</p>
                {/* Keywords — pill chips as tuning frequencies */}
                {expanded?.keywords && expanded.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {expanded.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="font-sans text-xs text-wood-600 bg-paper-50 border border-wood-200/80 rounded-full px-3 py-1 leading-none"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Painting link */}
              {piece && (
                <Link
                  to={`/creations/${piece.id}`}
                  className="group flex items-center justify-between gap-3 px-5 py-3.5 bg-paper-50 hover:bg-paper-100 transition-colors border-b border-wood-200/40"
                >
                  <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 group-hover:text-wood-800 transition-colors">
                    View the original painting
                  </span>
                  <span className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-500 group-hover:text-bronze-400 transition-colors flex-shrink-0">
                    {piece.availability === 'SOLD' ? 'Sold' : piece.availability === 'READY_TO_SHIP' ? 'Available' : 'To order'} →
                  </span>
                </Link>
              )}
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center px-5 py-3 bg-paper-50 hover:bg-paper-100 transition-colors"
              >
                <span className={`font-label text-[11px] uppercase tracking-[0.2em] transition-colors ${copied ? 'text-bronze-600' : 'text-wood-400 hover:text-wood-700'}`}>
                  {copied ? 'Link copied' : 'Share this card'}
                </span>
              </button>
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-4 pb-14">

            {/* Island — Section nav (each row jumps to its section) */}
            <div className="rounded-2xl overflow-hidden border border-wood-200/40 mb-3 divide-y divide-wood-200/50 shadow-[0_4px_16px_rgba(60,44,22,0.09)]">
              <button onClick={() => go('iching')} className="group w-full flex items-center justify-between gap-4 border-l-[3px] border-stone-400 bg-stone-50 hover:bg-stone-100 px-5 py-4 text-left transition-colors">
                <div className="min-w-0">
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-0.5">I Ching</p>
                  <p className="font-sans text-xs text-stone-400 mb-1.5">{card.iching.hexagram_name}</p>
                  <p className="font-sans text-[15px] text-wood-800 leading-[1.7] line-clamp-2">{ichingHighlight}</p>
                </div>
                <span className="text-stone-400 group-hover:text-stone-600 transition-colors flex-shrink-0 text-sm">→</span>
              </button>
              {/* Gene Keys — header + 3 state cells (Shadow / Gift / Siddhi)
                  matching the section's bronze accent. Each cell jumps to its
                  gene-key card. Header → top of Gene Keys section. */}
              <div className="border-l-[3px] border-bronze-400 bg-bronze-50">
                <button
                  onClick={() => go('genekeys')}
                  className="group w-full flex items-center justify-between gap-4 px-5 pt-4 pb-2 text-left hover:bg-bronze-100/60 transition-colors"
                >
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-500">Gene Keys</p>
                  <span className="text-bronze-400 group-hover:text-bronze-600 transition-colors flex-shrink-0 text-sm">→</span>
                </button>
                <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1">
                  <button
                    onClick={() => go('genekey-shadow')}
                    className="group rounded-lg border border-stone-300/60 bg-[#eae8e5] dark:bg-[#2a2825] px-2.5 py-2.5 text-left hover:border-stone-400 transition-colors"
                  >
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-stone-500 mb-1">Shadow</p>
                    <p className="font-sans text-xs text-stone-800 leading-[1.4] line-clamp-2 group-hover:text-stone-900 transition-colors">{card.gene_keys.shadow}</p>
                  </button>
                  <button
                    onClick={() => go('genekey-gift')}
                    className="group rounded-lg border border-bronze-300/60 bg-[#faf5ee] dark:bg-[#2a231a] px-2.5 py-2.5 text-left hover:border-bronze-400 transition-colors"
                  >
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-bronze-600 mb-1">Gift</p>
                    <p className="font-sans text-xs text-wood-800 font-medium leading-[1.4] line-clamp-2 group-hover:text-bronze-700 transition-colors">{card.gene_keys.gift}</p>
                  </button>
                  <button
                    onClick={() => go('genekey-siddhi')}
                    className="group rounded-lg border border-wood-300/60 bg-[#f8f6f2] dark:bg-[#23201d] px-2.5 py-2.5 text-left hover:border-wood-400 transition-colors"
                  >
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 mb-1">Siddhi</p>
                    <p className="font-sans text-xs text-wood-900 leading-[1.4] line-clamp-2 group-hover:text-wood-700 transition-colors">{card.gene_keys.siddhi}</p>
                  </button>
                </div>
              </div>
              {/* Human Design + Tarot — single row, divided */}
              <div className="flex border-l-[3px] border-wood-400 bg-wood-50 divide-x divide-wood-200/60">
                <button onClick={() => go('humandesign')} className="group flex-1 flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-wood-100/60 transition-colors">
                  <div className="min-w-0">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 mb-1.5">Human Design · Gate {card.human_design.gate}</p>
                    <p className="font-sans text-[15px] text-wood-800 leading-[1.7]">{card.human_design.keyword}</p>
                  </div>
                  <span className="text-wood-400 group-hover:text-wood-600 transition-colors flex-shrink-0 text-sm">→</span>
                </button>
                {card.ring_tarot && (
                  <button onClick={() => go('connections')} className="group flex-1 flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-wood-100/60 transition-colors">
                    <div className="min-w-0">
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-1.5">Tarot · {card.ring_name}</p>
                      <p className="font-sans text-[15px] text-wood-800 leading-[1.7]">{card.ring_tarot}</p>
                    </div>
                    <span className="text-wood-300 group-hover:text-wood-600 transition-colors flex-shrink-0 text-sm">→</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inquire — commission a piece like this one */}
            <button
              onClick={() => navigate('/inquire', { state: { piece: `${card.card_name} - ${card.number}` } })}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-wood-200/60 bg-paper-100 hover:bg-paper-50 hover:border-wood-300 transition-all mb-3 group shadow-[0_2px_8px_rgba(60,44,22,0.06)]"
            >
              <div className="text-left">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 mb-1">Commission a piece</p>
                <p className="font-sans text-sm text-wood-700 group-hover:text-wood-900 transition-colors">Inquire about a work inspired by this card</p>
              </div>
              <span className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-500 group-hover:text-bronze-400 transition-colors flex-shrink-0">Inquire →</span>
            </button>

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
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-12 pb-14 space-y-4">

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

            {/* Island 2 — Wisdom group (all three Expands in one card) */}
            {expanded && (
              <div className={`rounded-2xl border border-stone-700/40 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <Expand
                  label="Overview"
                  borderColor="border-stone-700/40" labelColor="text-stone-500"
                  innerPx="px-6"
                  preview={<p className="font-sans text-sm text-stone-400 leading-[1.8] line-clamp-2">{expanded.i_ching.trigrams.overview.text}</p>}
                >
                  <p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{expanded.i_ching.trigrams.overview.text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
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
                  label="Image of the Situation"
                  borderColor="border-stone-700/40" labelColor="text-stone-500"
                  innerPx="px-6"
                  preview={<p className="font-sans text-sm text-stone-400 leading-[1.8] line-clamp-2">{expanded.i_ching.image_of_the_situation.text.split('\n')[0]}</p>}
                >
                  <blockquote className="pl-1">
                    {expanded.i_ching.image_of_the_situation.text.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="font-serif text-xl text-stone-100 leading-[1.8]">{line}</p>
                    ))}
                  </blockquote>
                  <div className="space-y-2 mt-5">
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

            {/* Island 3 — Reflection (always visible, bronze accent) */}
            {expanded && (
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
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-12 pb-14 space-y-4">

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

            {/* Islands 2–4 — Shadow, Gift, Siddhi */}
            {expanded ? (
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
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-12 pb-14 space-y-4">

            {/* Header */}
            <div className={`rounded-2xl border border-stone-700/50 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(28, 25, 23, 0.7)' }}>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">Human Design · Gate {card.human_design.gate}</p>
              <h2 className="font-serif text-3xl text-stone-100 font-semibold leading-[1.2] mb-1">{card.human_design.keyword}</h2>
            </div>

            {/* Description */}
            <div className={`rounded-2xl border border-stone-700/40 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
              <p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{card.human_design.description}</p>
              {card.traditional_colors && (
                <p className="font-sans text-sm text-stone-400 leading-[1.8] mt-5 pt-5 border-t border-stone-700/50">
                  {card.traditional_colors}
                </p>
              )}
            </div>

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
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-12 pb-14 space-y-4">

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


          </div>
        </section>

      </div>

      {/* ── Sticky bottom nav ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-paper-50/95 border-t border-wood-200 backdrop-blur-sm">
        <div className="flex items-stretch h-14">
          {/* Left icon — flush to edge */}
          {(() => { const c = prevCardNum !== null ? CARD_BY_NUMBER.get(prevCardNum) : null; return c ? (
            <div className="flex flex-col items-center justify-center flex-shrink-0 w-10 pl-2">
              <span className="text-2xl font-bold text-bronze-400 block leading-none" style={{transform:'scaleX(1.6)', display:'block'}}>{c.iching.upper_trigram.symbol}</span>
              <span className="text-2xl font-bold text-bronze-400 block leading-none -mt-2" style={{transform:'scaleX(1.6)', display:'block'}}>{c.iching.lower_trigram.symbol}</span>
            </div>
          ) : <div className="w-10" />; })()}

          {prevCardNum !== null ? (
            <Link
              to={`/oracle/universal-language/${prevCardNum}`}
              className="flex items-center gap-3 px-3 flex-1 min-w-0 hover:bg-wood-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-label text-[9px] uppercase tracking-[0.12em] text-wood-500">← Prev</p>
                <p className="font-sans text-xs text-wood-700 leading-tight truncate">
                  {CARD_BY_NUMBER.get(prevCardNum)?.card_name}
                </p>
              </div>
            </Link>
          ) : <div className="flex-1" />}

          <Link
            to="/oracle/universal-language"
            className="flex flex-col items-center justify-center px-5 border-x border-wood-200 flex-shrink-0 hover:bg-wood-50 transition-colors"
          >
            <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500">{card.number}</span>
            <span className="font-label text-[9px] uppercase tracking-[0.12em] text-wood-300 mt-0.5">All 64</span>
          </Link>

          {nextCardNum !== null ? (
            <Link
              to={`/oracle/universal-language/${nextCardNum}`}
              className="flex items-center justify-end gap-3 px-3 flex-1 min-w-0 hover:bg-wood-50 transition-colors"
            >
              <div className="min-w-0 text-right">
                <p className="font-label text-[9px] uppercase tracking-[0.12em] text-wood-500">Next →</p>
                <p className="font-sans text-xs text-wood-700 leading-tight truncate">
                  {CARD_BY_NUMBER.get(nextCardNum)?.card_name}
                </p>
              </div>
            </Link>
          ) : <div className="flex-1" />}

          {/* Right icon — flush to edge */}
          {(() => { const c = nextCardNum !== null ? CARD_BY_NUMBER.get(nextCardNum) : null; return c ? (
            <div className="flex flex-col items-center justify-center flex-shrink-0 w-10 pr-2">
              <span className="text-2xl font-bold text-bronze-400 block leading-none" style={{transform:'scaleX(1.6)', display:'block'}}>{c.iching.upper_trigram.symbol}</span>
              <span className="text-2xl font-bold text-bronze-400 block leading-none -mt-2" style={{transform:'scaleX(1.6)', display:'block'}}>{c.iching.lower_trigram.symbol}</span>
            </div>
          ) : <div className="w-10" />; })()}
        </div>
      </div>
    </>
  );
};

export default UniversalLanguageCard;
