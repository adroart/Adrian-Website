
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { getExpandedCard, type ExpandedCard, type ExpandedGeneKeyLevel } from '../data/expandedOracleData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import { OracleQREntrance } from './OracleQREntrance';
import { OracleCardEntrance } from './OracleCardEntrance';

/* ─── Screen order ───────────────────────────────────────────────────────── */

type Screen = 'field' | 'iching' | 'genekeys' | 'connections';

const SCREEN_ORDER: Screen[] = ['field', 'iching', 'genekeys', 'connections'];

const SCREEN_LABELS: Record<Screen, string> = {
  field:       'Field',
  iching:      'I Ching',
  genekeys:    'GK · HD',
  connections: 'Connections',
};

const SCREEN_FULL: Record<Screen, string> = {
  field:       'The Field',
  iching:      'I Ching',
  genekeys:    'Gene Keys + Human Design',
  connections:  'Connections',
};

/* ─── Per-screen palette ─────────────────────────────────────────────────── */
// Each screen has its own BG + text color system. Never mix stone-* on warm bgs.

const SCREEN_BG: Record<Screen, string> = {
  field:       'bg-paper-50',
  iching:      'bg-stone-900',
  genekeys:    'bg-wood-900',
  connections: 'bg-stone-950',
};

// Text on dark screens: I Ching/Connections = cool stone palette, GK/HD = warm paper palette
function screenText(screen: Screen, tier: 'primary' | 'secondary' | 'label' | 'muted'): string {
  if (screen === 'genekeys') {
    return { primary: 'text-paper-100', secondary: 'text-paper-300', label: 'text-wood-400', muted: 'text-wood-600' }[tier];
  }
  return {
    primary:   'text-stone-100',
    secondary: 'text-stone-300',
    label:     'text-stone-400',
    muted:     'text-stone-600',
  }[tier];
}

function screenBorder(screen: Screen): string {
  if (screen === 'genekeys')    return 'border-wood-700';
  if (screen === 'connections') return 'border-stone-800';
  return 'border-stone-700';
}

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
}> = ({ label, preview, children, borderColor, labelColor }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-t ${borderColor} pt-6 pb-6`}>
      <button className="w-full text-left" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`font-label text-[10px] uppercase tracking-[0.25em] ${labelColor} mb-2`}>{label}</p>
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

/* ─── Gene Key level — left-border accent only, no background box ─────────── */

type GeneKeyTone = 'shadow' | 'gift' | 'siddhi';

// On wood-900 bg: stone accent contrasts cool vs warm; bronze = gift; wood-lighter = siddhi
const TONE_ACCENT: Record<GeneKeyTone, { label: string; border: string; labelColor: string; accentText: string }> = {
  shadow: { label: 'Shadow', border: 'border-stone-500',  labelColor: 'text-stone-400',  accentText: 'text-stone-300'  },
  gift:   { label: 'Gift',   border: 'border-bronze-500', labelColor: 'text-bronze-400', accentText: 'text-bronze-300' },
  siddhi: { label: 'Siddhi', border: 'border-wood-400',   labelColor: 'text-wood-300',   accentText: 'text-wood-200'   },
};

const GeneKeyCard: React.FC<{ tone: GeneKeyTone; level: ExpandedGeneKeyLevel }> = ({ tone, level }) => {
  const [open, setOpen] = useState(false);
  const cfg = TONE_ACCENT[tone];
  const paragraphs = (open ? level.expanded.text : level.collapsed.text).split('\n\n').filter(Boolean);

  return (
    <div className={`border-l-[3px] ${cfg.border} pl-5 py-1 mb-8`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`font-label text-[10px] uppercase tracking-[0.25em] ${cfg.labelColor}`}>{cfg.label}</span>
        <span className={`font-sans text-xl font-medium ${cfg.accentText}`}>{level.name}</span>
      </div>
      <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 mb-4">{level.contemplation_title}</p>
      <div className="space-y-4 mb-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="font-sans text-[15px] text-paper-200 leading-[1.9]">{p}</p>
        ))}
      </div>
      <button
        onClick={() => setOpen(v => !v)}
        className={`font-label text-[10px] uppercase tracking-[0.2em] ${cfg.labelColor} hover:opacity-70 transition-opacity`}
        aria-expanded={open}
      >
        {open ? '− Less' : '+ More'}
      </button>
      {tone === 'shadow' && open && (level.repressive_nature || level.reactive_nature) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {level.repressive_nature && (
            <div className="border-l border-stone-600 pl-3">
              <p className="font-label text-[10px] uppercase tracking-[0.15em] text-stone-400 mb-1">
                Repressive · {level.repressive_nature.label}
              </p>
              <p className="font-sans text-sm text-paper-300 leading-[1.7]">{level.repressive_nature.description}</p>
            </div>
          )}
          {level.reactive_nature && (
            <div className="border-l border-bronze-600 pl-3">
              <p className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-400 mb-1">
                Reactive · {level.reactive_nature.label}
              </p>
              <p className="font-sans text-sm text-paper-300 leading-[1.7]">{level.reactive_nature.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Card link (Connections) ────────────────────────────────────────────── */

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
      className="group w-full flex items-center gap-4 p-4 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 transition-all text-left"
    >
      <img
        src={cardImageUrl(number, 120)}
        alt=""
        className="w-16 h-16 object-cover flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity rounded"
      />
      <div className="flex-1 min-w-0">
        {label && <p className="font-label text-[10px] uppercase tracking-[0.15em] text-stone-500 mb-0.5">{label}</p>}
        <p className="font-sans text-base text-stone-200 group-hover:text-bronze-400 transition-colors">{sibling.card_name}</p>
        {context && <p className="font-sans text-xs text-stone-400 mt-1 leading-[1.65] line-clamp-2">{context}</p>}
      </div>
      <span className="text-stone-600 group-hover:text-bronze-400 transition-colors flex-shrink-0">→</span>
    </button>
  );
};

/* ─── Screen slide footer ────────────────────────────────────────────────── */

const ScreenFooter: React.FC<{
  next: Screen | null;
  prev: Screen | null;
  onNext: () => void;
  onPrev: () => void;
  screen: Screen;
}> = ({ next, prev, onNext, onPrev, screen }) => {
  const bd = screenBorder(screen);
  const lbl = screenText(screen, 'label');
  const sec = screenText(screen, 'secondary');

  return (
    <div className={`mt-16 border-t ${bd} pt-6 pb-2`}>
      <div className="flex items-center justify-between">
        {prev ? (
          <button onClick={onPrev} className="group flex flex-col gap-0.5 text-left">
            <span className={`font-label text-[10px] uppercase tracking-[0.15em] ${lbl}`}>← Back</span>
            <span className={`font-sans text-sm ${sec} group-hover:text-bronze-400 transition-colors`}>
              {SCREEN_FULL[prev]}
            </span>
          </button>
        ) : <span />}
        {next ? (
          <button onClick={onNext} className="group flex flex-col gap-0.5 items-end text-right">
            <span className={`font-label text-[10px] uppercase tracking-[0.15em] ${lbl}`}>Continue →</span>
            <span className={`font-sans text-sm ${sec} group-hover:text-bronze-400 transition-colors`}>
              {SCREEN_FULL[next]}
            </span>
          </button>
        ) : <span />}
      </div>
    </div>
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

  const [screen,       setScreen]       = useState<Screen>('field');
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [visible,      setVisible]      = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied,       setCopied]       = useState(false);

  const [showQREntrance, setShowQREntrance] = useState(
    () => new URLSearchParams(window.location.search).get('ref') === 'qr'
  );
  const [showIndexEntrance, setShowIndexEntrance] = useState(
    () => (location.state as { ritual?: boolean } | null)?.ritual === true
  );

  const sortedNums = ALL_CARDS.map(c => c.number);
  const currentIdx = sortedNums.indexOf(cardNum);
  const prevCardNum = currentIdx > 0 ? sortedNums[currentIdx - 1] : null;
  const nextCardNum = currentIdx < sortedNums.length - 1 ? sortedNums[currentIdx + 1] : null;

  const screenIdx  = SCREEN_ORDER.indexOf(screen);
  const nextScreen = screenIdx < SCREEN_ORDER.length - 1 ? SCREEN_ORDER[screenIdx + 1] : null;
  const prevScreen = screenIdx > 0 ? SCREEN_ORDER[screenIdx - 1] : null;

  const goTo = useCallback((s: Screen) => {
    if (s === screen) return;
    setScreenHistory(h => [...h, screen]);
    setVisible(false);
    setTimeout(() => {
      setScreen(s);
      window.scrollTo(0, 0);
      setVisible(true);
    }, 180);
  }, [screen]);

  const goBack = useCallback(() => {
    if (screenHistory.length > 0) {
      const prev = screenHistory[screenHistory.length - 1];
      setScreenHistory(h => h.slice(0, -1));
      setVisible(false);
      setTimeout(() => {
        setScreen(prev);
        window.scrollTo(0, 0);
        setVisible(true);
      }, 180);
    }
    // If no history, caller decides (navigate to oracle index)
  }, [screenHistory]);

  useEffect(() => {
    setScreen('field');
    setScreenHistory([]);
    setVisible(true);
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
          <Link to="/oracle/universal-language" className="font-label text-xs uppercase tracking-[0.25em] text-bronze-600 border-b border-bronze-600/40 pb-px">
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
  const gkHighlight     = expanded?.gene_keys?.gift?.contemplation_title ?? card.gene_keys.gift;

  const isDark = screen !== 'field';
  const bd = screenBorder(screen);

  // Top bar "back" behavior
  const topBarBack = screenHistory.length > 0
    ? { label: `← ${SCREEN_LABELS[screenHistory[screenHistory.length - 1]]}`, action: goBack }
    : { label: '← Oracle', action: () => navigate('/oracle/universal-language') };

  return (
    <>
      {showQREntrance    && <OracleQREntrance   card={card} onDone={() => setShowQREntrance(false)} />}
      {showIndexEntrance && <OracleCardEntrance card={card} onDone={() => setShowIndexEntrance(false)} />}
      {lightboxOpen      && <Lightbox src={cardImageUrl(card.number, 1200)} alt={imageAlt} onClose={() => setLightboxOpen(false)} />}

      {/* ── Persistent top bar ───────────────────────────────────────────── */}
      <div className={`fixed top-0 left-0 right-0 z-[60] h-11 flex items-center justify-between px-5 backdrop-blur-sm transition-colors duration-300 ${isDark ? 'bg-black/50 border-b border-white/10' : 'bg-paper-50/90 border-b border-wood-100'}`}>
        <button
          onClick={topBarBack.action}
          className={`font-label text-[10px] uppercase tracking-[0.2em] transition-colors ${isDark ? 'text-stone-300 hover:text-white' : 'text-wood-400 hover:text-wood-700'}`}
        >
          {topBarBack.label}
        </button>
        <span className={`font-label text-[10px] uppercase tracking-[0.2em] ${isDark ? 'text-stone-500' : 'text-wood-300'}`}>
          {screen === 'field' ? `Code ${cardNum}` : SCREEN_LABELS[screen]}
        </span>
        <div className="flex items-center gap-4">
          {prevCardNum !== null && (
            <button
              onClick={() => navigate(`/oracle/universal-language/${prevCardNum}`, { state: { ritual: true } })}
              className={`font-label text-[11px] transition-colors ${isDark ? 'text-stone-400 hover:text-white' : 'text-wood-300 hover:text-wood-700'}`}
              aria-label="Previous card"
            >←</button>
          )}
          {nextCardNum !== null && (
            <button
              onClick={() => navigate(`/oracle/universal-language/${nextCardNum}`, { state: { ritual: true } })}
              className={`font-label text-[11px] transition-colors ${isDark ? 'text-stone-400 hover:text-white' : 'text-wood-300 hover:text-wood-700'}`}
              aria-label="Next card"
            >→</button>
          )}
        </div>
      </div>

      {/* ── Screen ───────────────────────────────────────────────────────── */}
      <div
        className={`min-h-screen ${SCREEN_BG[screen]} pt-11 pb-20 transition-colors duration-300`}
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 180ms ease, transform 180ms ease' }}
      >

        {/* ════════════ FIELD ════════════════════════════════════════════ */}
        {screen === 'field' && (
          <div className="max-w-2xl mx-auto">
            {/* Image */}
            <figure
              className="w-full aspect-square cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              role="button" tabIndex={0} aria-label="Enlarge image"
              onKeyDown={e => e.key === 'Enter' && setLightboxOpen(true)}
            >
              <img src={cardImageUrl(card.number, 900)} alt={imageAlt} className="w-full h-full object-cover" loading="eager" />
            </figure>

            {/* Painting link — directly below image */}
            {piece && (
              <Link
                to={`/creations/${piece.id}`}
                className="group flex items-center gap-3 bg-stone-950 px-5 py-3 hover:bg-stone-900 transition-colors"
              >
                <span className="flex-1 font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 group-hover:text-bronze-400 transition-colors">
                  View the original painting
                </span>
                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-stone-600 group-hover:text-bronze-500 transition-colors flex-shrink-0">
                  {piece.availability === 'SOLD' ? 'Sold' : piece.availability === 'READY_TO_SHIP' ? 'Available' : 'To order'} →
                </span>
              </Link>
            )}

            <div className="px-5 sm:px-6 pt-8">
              {/* Identity */}
              <h1 className="font-serif text-5xl sm:text-6xl text-wood-900 font-medium leading-[1.05] mb-3">
                {card.card_name}
              </h1>
              <div className="flex items-center justify-between mb-8">
                <p className="font-sans text-base text-wood-600">{card.iching.hexagram_name}</p>
                <button
                  onClick={handleShare}
                  className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-300 hover:text-wood-600 transition-colors"
                >
                  {copied ? 'Copied' : 'Share'}
                </button>
              </div>

              {/* Spectrum */}
              <div className="flex items-center gap-4 flex-wrap mb-8">
                <span className="font-sans text-base text-stone-500">{card.gene_keys.shadow}</span>
                <span className="text-wood-200" aria-hidden="true">·</span>
                <span className="font-sans text-base text-bronze-600 font-medium">{card.gene_keys.gift}</span>
                <span className="text-wood-200" aria-hidden="true">·</span>
                <span className="font-sans text-base text-wood-600">{card.gene_keys.siddhi}</span>
              </div>

              {/* Keywords */}
              {expanded?.keywords && expanded.keywords.length > 0 && (
                <p className="font-sans text-sm text-wood-400 leading-[1.9] mb-10">
                  {expanded.keywords.join(' · ')}
                </p>
              )}

              {/* Highlights */}
              <div className="space-y-3 mb-10">
                <div className="border-l-[3px] border-stone-300 bg-stone-50 px-5 py-4 rounded-r-lg">
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-2">I Ching</p>
                  <p className="font-sans text-[15px] text-wood-800 leading-[1.85]">{ichingHighlight}</p>
                </div>
                <div className="border-l-[3px] border-bronze-400 bg-bronze-50 px-5 py-4 rounded-r-lg">
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-500 mb-2">Gene Keys</p>
                  <p className="font-sans text-[15px] text-wood-800 leading-[1.85]">{gkHighlight}</p>
                </div>
                <div className="border-l-[3px] border-wood-400 bg-wood-50 px-5 py-4 rounded-r-lg">
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 mb-2">Human Design · Gate {card.human_design.gate}</p>
                  <p className="font-sans text-[15px] text-wood-800 leading-[1.85]">{card.human_design.keyword}</p>
                </div>
              </div>

              {/* Dive deeper */}
              <div className="mb-8">
                <p className="font-label text-[10px] uppercase tracking-[0.25em] text-wood-300 mb-4">Dive deeper</p>
                <div className="space-y-2">
                  {([
                    { id: 'iching'      as const, label: 'I Ching',                 desc: 'Hexagram · Trigrams · Reflection'       },
                    { id: 'genekeys'    as const, label: 'Gene Keys + Human Design', desc: 'Shadow · Gift · Siddhi · Gate'           },
                    { id: 'connections' as const, label: 'Connections',              desc: 'Paired card · Codon ring · Partners'     },
                  ]).map(item => (
                    <button
                      key={item.id}
                      onClick={() => goTo(item.id)}
                      className="group w-full flex items-center justify-between px-5 py-4 rounded-xl bg-wood-900 hover:bg-wood-800 transition-colors text-left"
                    >
                      <div>
                        <p className="font-sans text-base text-paper-100 group-hover:text-bronze-300 transition-colors">{item.label}</p>
                        <p className="font-label text-[10px] uppercase tracking-[0.1em] text-wood-500 mt-0.5">{item.desc}</p>
                      </div>
                      <span className="text-wood-500 group-hover:text-bronze-400 transition-colors text-lg ml-4">→</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Creator voice */}
              {expanded?.creator_voice?.personal_reading ? (
                <div className="rounded-xl bg-stone-100 px-5 py-8 mb-10">
                  <p className="font-label text-[10px] uppercase tracking-[0.25em] text-wood-400 mb-6">From the creator</p>
                  <div className="space-y-5">
                    {expanded.creator_voice.personal_reading.split('\n\n').filter(Boolean).map((p, i) => (
                      <p key={i} className="font-sans text-[15px] text-wood-800 leading-[2]">{p}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ════════════ I CHING ══════════════════════════════════════════ */}
        {screen === 'iching' && (
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-8 pb-8">
            <div className="mb-10">
              <p className="font-label text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-2">Hexagram {card.number}</p>
              <h2 className="font-serif text-4xl text-stone-100 font-medium leading-tight mb-1">{card.iching.hexagram_name}</h2>
              <p className="font-sans text-sm text-stone-400">{card.card_name}</p>
            </div>

            {/* Trigrams */}
            {(() => {
              const doubled = card.iching.upper_trigram.symbol === card.iching.lower_trigram.symbol;
              return (
                <div className="space-y-5 mb-2">
                  <div className="flex items-start gap-5">
                    <div className="text-center w-10 flex-shrink-0">
                      <span className="text-3xl text-bronze-400 leading-none block">{card.iching.upper_trigram.symbol}</span>
                      <p className="font-label text-[9px] text-stone-500 mt-1">{card.iching.upper_trigram.name}</p>
                    </div>
                    <p className="font-sans text-sm text-stone-200 leading-[1.8] pt-1">{card.iching.upper_trigram.nature}</p>
                  </div>
                  <div className="flex items-start gap-5">
                    <div className="text-center w-10 flex-shrink-0">
                      <span className="text-3xl text-bronze-500 leading-none block">{card.iching.lower_trigram.symbol}</span>
                      <p className="font-label text-[9px] text-stone-500 mt-1">{card.iching.lower_trigram.name}</p>
                    </div>
                    {doubled
                      ? <p className="font-sans text-sm text-stone-500 pt-2">Same as above</p>
                      : <p className="font-sans text-sm text-stone-200 leading-[1.8] pt-1">{card.iching.lower_trigram.nature}</p>
                    }
                  </div>
                </div>
              );
            })()}

            {expanded ? (
              <div>
                <Expand
                  label="Overview"
                  borderColor={bd} labelColor="text-stone-400"
                  preview={<p className="font-sans text-sm text-stone-300 leading-[1.8] line-clamp-2">{expanded.i_ching.trigrams.overview.text}</p>}
                >
                  <p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{expanded.i_ching.trigrams.overview.text}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2">Outer</p>
                      <p className="font-sans text-sm text-stone-200 leading-[1.75]">{expanded.i_ching.trigrams.outer.context.text}</p>
                    </div>
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-2">Inner</p>
                      <p className="font-sans text-sm text-stone-200 leading-[1.75]">{expanded.i_ching.trigrams.inner.context.text}</p>
                    </div>
                  </div>
                  <p className="font-sans text-sm text-stone-300 leading-[1.8] border-l-2 border-stone-700 pl-4 py-1 mt-4">
                    {expanded.i_ching.trigrams.family_dynamic.text}
                  </p>
                </Expand>

                <Expand
                  label="Image of the Situation"
                  borderColor={bd} labelColor="text-stone-400"
                  preview={<p className="font-sans text-sm text-stone-300 leading-[1.8] line-clamp-2">{expanded.i_ching.image_of_the_situation.text.split('\n')[0]}</p>}
                >
                  <blockquote className="border-l-[3px] border-bronze-500 pl-5 py-1">
                    {expanded.i_ching.image_of_the_situation.text.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="font-serif text-xl text-stone-100 leading-[1.7]">{line}</p>
                    ))}
                  </blockquote>
                  <div className="space-y-2 mt-5">
                    {expanded.i_ching.image_tradition.text.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="font-sans text-sm text-stone-200 leading-[1.9]">{line}</p>
                    ))}
                  </div>
                </Expand>

                <Expand
                  label="Patterns of Wisdom"
                  borderColor={bd} labelColor="text-stone-400"
                  preview={<p className="font-sans text-sm text-stone-300 leading-[1.8]">{expanded.i_ching.patterns_of_wisdom.nature_image}</p>}
                >
                  <p className="font-sans text-sm text-stone-200 mb-1">{expanded.i_ching.patterns_of_wisdom.nature_image}</p>
                  <p className="font-sans text-sm text-stone-200 mb-5">{expanded.i_ching.patterns_of_wisdom.guidance}</p>
                  <p className="font-sans text-sm text-stone-200 leading-[1.85]">{expanded.i_ching.patterns_of_wisdom.context.text}</p>
                </Expand>

                {/* Reflection — always visible */}
                <div className={`border-t ${bd} pt-8 pb-6`}>
                  <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-400 mb-5">Reflection</p>
                  <p className="font-serif text-xl text-stone-100 leading-[1.9]">{expanded.i_ching.reflection.text}</p>
                </div>

                {/* Paired hexagram */}
                {pairCard && (
                  <div className={`border-t ${bd} pt-8 pb-6`}>
                    <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4">Paired Hexagram</p>
                    <p className="font-sans text-sm text-stone-300 leading-[1.8] mb-5">{expanded.i_ching.hexagrams_in_pairs.context.text}</p>
                    <CardLink
                      number={expanded.i_ching.hexagrams_in_pairs.pair_hexagram}
                      label={`Code ${expanded.i_ching.hexagrams_in_pairs.pair_hexagram}`}
                      onClick={() => navigate(`/oracle/universal-language/${expanded.i_ching.hexagrams_in_pairs.pair_hexagram}`, { state: { ritual: true } })}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className={`border-t ${bd} pt-6`}>
                <p className="font-sans text-[15px] text-stone-200 leading-[1.95]">{card.iching.essence}</p>
              </div>
            )}

            <ScreenFooter screen={screen} next={nextScreen} prev={prevScreen} onNext={() => nextScreen && goTo(nextScreen)} onPrev={() => prevScreen && goTo(prevScreen)} />
          </div>
        )}

        {/* ════════════ GENE KEYS + HUMAN DESIGN ════════════════════════ */}
        {screen === 'genekeys' && (
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-8 pb-8">
            <div className="mb-10">
              <p className="font-label text-[10px] uppercase tracking-[0.3em] text-wood-400 mb-2">
                Gene Key {card.number} · Gate {card.human_design.gate}
              </p>
              <h2 className="font-serif text-4xl text-paper-100 font-medium leading-tight mb-3">{card.card_name}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-sans text-sm text-stone-400">{card.gene_keys.shadow}</span>
                <span className="text-wood-600" aria-hidden="true">·</span>
                <span className="font-sans text-sm text-bronze-400">{card.gene_keys.gift}</span>
                <span className="text-wood-600" aria-hidden="true">·</span>
                <span className="font-sans text-sm text-wood-300">{card.gene_keys.siddhi}</span>
              </div>
            </div>

            {expanded ? (
              <div>
                <GeneKeyCard tone="shadow" level={expanded.gene_keys.shadow} />
                <GeneKeyCard tone="gift"   level={expanded.gene_keys.gift} />
                <GeneKeyCard tone="siddhi" level={expanded.gene_keys.siddhi} />

                {/* Human Design — warm accent panel */}
                <div className={`border-t ${bd} pt-8 pb-6`}>
                  <p className="font-label text-[10px] uppercase tracking-[0.3em] text-wood-400 mb-5">Human Design</p>
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 mb-1">Gate {card.human_design.gate}</p>
                  <p className="font-sans text-2xl text-paper-100 font-medium mb-4">{card.human_design.keyword}</p>
                  <p className="font-sans text-[15px] text-paper-200 leading-[1.85] mb-4">{card.human_design.description}</p>
                  {card.traditional_colors && (
                    <p className="font-sans text-sm text-paper-300 leading-[1.8] border-l-2 border-wood-600 pl-4 py-1">
                      {card.traditional_colors}
                    </p>
                  )}
                </div>

                {/* Programming partner */}
                {expanded.gene_keys.programming_partner && (
                  <div className={`border-t ${bd} pt-8 pb-6`}>
                    <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 mb-5">Programming Partner</p>
                    <button
                      onClick={() => navigate(`/oracle/universal-language/${expanded.gene_keys.programming_partner!.number}`, { state: { ritual: true } })}
                      className="group flex items-center gap-3 mb-4"
                    >
                      {UL_IMAGE_BY_NUMBER.get(expanded.gene_keys.programming_partner.number) && (
                        <img src={cardImageUrl(expanded.gene_keys.programming_partner.number, 80)} alt="" className="w-10 h-10 object-cover opacity-60 group-hover:opacity-100 transition-opacity rounded" />
                      )}
                      <span className="font-sans text-base text-paper-200 group-hover:text-bronze-400 transition-colors">
                        {expanded.gene_keys.programming_partner.number}. {expanded.gene_keys.programming_partner.name} →
                      </span>
                    </button>
                    <p className="font-sans text-sm text-paper-300 leading-[1.75]">{expanded.gene_keys.programming_partner.relationship_context}</p>
                  </div>
                )}

                {/* Codon Ring */}
                {siblings.length > 0 && (
                  <div className={`border-t ${bd} pt-8 pb-6`}>
                    <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 mb-1">{expanded.gene_keys.codon_ring.name}</p>
                    <p className="font-sans text-sm text-paper-300 leading-[1.75] mb-5">{expanded.gene_keys.codon_ring.relationship_context}</p>
                    <div className="space-y-3">
                      {siblings.map(n => {
                        const sibling = CARD_BY_NUMBER.get(n);
                        return sibling ? (
                          <button key={n} onClick={() => navigate(`/oracle/universal-language/${n}`, { state: { ritual: true } })} className="group flex items-center gap-3">
                            {UL_IMAGE_BY_NUMBER.get(n) && <img src={cardImageUrl(n, 80)} alt="" className="w-8 h-8 object-cover opacity-50 group-hover:opacity-100 transition-opacity rounded" />}
                            <span className="font-sans text-sm text-paper-300 group-hover:text-bronze-400 transition-colors">{n}. {sibling.card_name}</span>
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <p className={`font-label text-[10px] text-wood-600 pt-6 border-t ${bd} leading-[1.7]`}>
                  Gene Keys text based on the work of Richard Rudd,{' '}
                  <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-wood-400 transition-colors">genekeys.com</a>
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {card.gene_keys.description.split('\n\n').filter(Boolean).map((p, i) => (
                  <p key={i} className="font-sans text-[15px] text-paper-200 leading-[1.95]">{p}</p>
                ))}
                <div className={`border-t ${bd} pt-6`}>
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 mb-1">Gate {card.human_design.gate}</p>
                  <p className="font-sans text-2xl text-paper-100 font-medium mb-4">{card.human_design.keyword}</p>
                  <p className="font-sans text-[15px] text-paper-200 leading-[1.85]">{card.human_design.description}</p>
                </div>
              </div>
            )}

            <ScreenFooter screen={screen} next={nextScreen} prev={prevScreen} onNext={() => nextScreen && goTo(nextScreen)} onPrev={() => prevScreen && goTo(prevScreen)} />
          </div>
        )}

        {/* ════════════ CONNECTIONS ══════════════════════════════════════ */}
        {screen === 'connections' && (
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-8 pb-8">
            <div className="mb-10">
              <p className="font-label text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-2">Connections</p>
              <h2 className="font-serif text-4xl text-stone-100 font-medium">{card.card_name}</h2>
            </div>

            {expanded && pairCard && (
              <div className="mb-8">
                <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4">Paired Hexagram</p>
                <p className="font-sans text-sm text-stone-300 leading-[1.8] mb-4">{expanded.i_ching.hexagrams_in_pairs.context.text}</p>
                <CardLink
                  number={expanded.i_ching.hexagrams_in_pairs.pair_hexagram}
                  label={`Code ${expanded.i_ching.hexagrams_in_pairs.pair_hexagram}`}
                  onClick={() => navigate(`/oracle/universal-language/${expanded.i_ching.hexagrams_in_pairs.pair_hexagram}`, { state: { ritual: true } })}
                />
              </div>
            )}

            {expanded?.gene_keys?.programming_partner && (
              <div className="mb-8">
                <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4">Programming Partner</p>
                <CardLink
                  number={expanded.gene_keys.programming_partner.number}
                  label={`Code ${expanded.gene_keys.programming_partner.number}`}
                  context={expanded.gene_keys.programming_partner.relationship_context}
                  onClick={() => navigate(`/oracle/universal-language/${expanded.gene_keys.programming_partner!.number}`, { state: { ritual: true } })}
                />
              </div>
            )}

            {siblings.length > 0 && (
              <div className="mb-8">
                <p className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-1">
                  {expanded?.gene_keys?.codon_ring?.name ?? card.ring_name}
                </p>
                {(expanded?.gene_keys?.codon_ring?.relationship_context ?? card.ring_description) && (
                  <p className="font-sans text-sm text-stone-300 leading-[1.75] mb-5">
                    {expanded?.gene_keys?.codon_ring?.relationship_context ?? card.ring_description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {siblings.map(n => {
                    const sibling = CARD_BY_NUMBER.get(n);
                    return sibling ? (
                      <button
                        key={n}
                        onClick={() => navigate(`/oracle/universal-language/${n}`, { state: { ritual: true } })}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 transition-all text-left"
                      >
                        {UL_IMAGE_BY_NUMBER.get(n) && (
                          <img src={cardImageUrl(n, 80)} alt="" className="w-10 h-10 object-cover flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity rounded" />
                        )}
                        <div className="min-w-0">
                          <p className="font-label text-[9px] text-stone-500">{n}</p>
                          <p className="font-sans text-xs text-stone-200 group-hover:text-bronze-400 transition-colors truncate">{sibling.card_name}</p>
                        </div>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Prev / next card */}
            <div className={`border-t ${bd} pt-8 pb-2 flex items-center justify-between`}>
              {prevCardNum !== null ? (
                <button onClick={() => navigate(`/oracle/universal-language/${prevCardNum}`, { state: { ritual: true } })} className="group flex flex-col gap-1">
                  <span className="font-label text-[10px] uppercase tracking-[0.1em] text-stone-500 group-hover:text-stone-300 transition-colors">← Prev card</span>
                  <span className="font-sans text-sm text-stone-300 group-hover:text-bronze-400 transition-colors">{CARD_BY_NUMBER.get(prevCardNum)?.card_name}</span>
                </button>
              ) : <span />}
              {nextCardNum !== null ? (
                <button onClick={() => navigate(`/oracle/universal-language/${nextCardNum}`, { state: { ritual: true } })} className="group flex flex-col gap-1 items-end">
                  <span className="font-label text-[10px] uppercase tracking-[0.1em] text-stone-500 group-hover:text-stone-300 transition-colors">Next card →</span>
                  <span className="font-sans text-sm text-stone-300 group-hover:text-bronze-400 transition-colors">{CARD_BY_NUMBER.get(nextCardNum)?.card_name}</span>
                </button>
              ) : <span />}
            </div>

            <ScreenFooter screen={screen} next={nextScreen} prev={prevScreen} onNext={() => nextScreen && goTo(nextScreen)} onPrev={() => prevScreen && goTo(prevScreen)} />
          </div>
        )}
      </div>

      {/* ── Persistent bottom nav ─────────────────────────────────────────── */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-[60] backdrop-blur-sm border-t transition-colors duration-300 ${isDark ? 'bg-stone-950/95 border-white/10' : 'bg-paper-50/95 border-wood-100'}`}
        aria-label="Card sections"
      >
        <div className="flex items-stretch h-16 max-w-2xl mx-auto">
          {SCREEN_ORDER.map(item => {
            const active = screen === item;
            return (
              <button
                key={item}
                onClick={() => goTo(item)}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-colors ${
                  active
                    ? isDark ? 'text-bronze-400' : 'text-wood-900'
                    : isDark ? 'text-stone-600 hover:text-stone-300' : 'text-wood-300 hover:text-wood-600'
                }`}
              >
                <span className={`font-label text-[10px] uppercase tracking-[0.12em] ${active ? 'font-medium' : ''}`}>
                  {SCREEN_LABELS[item]}
                </span>
                <span className={`h-0.5 rounded-full transition-all duration-200 ${active ? (isDark ? 'bg-bronze-400 w-5' : 'bg-wood-900 w-5') : 'w-0'}`} />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default UniversalLanguageCard;
