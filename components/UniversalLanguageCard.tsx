
import React, { useEffect, useState, useRef, useContext, createContext, useCallback } from 'react';
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


/* ─── Trigram / hexagram SVG — pure vector, no Unicode emoji ─────────────── */

// lines = [top, middle, bottom], true = yang (solid), false = yin (broken)
const TRIGRAM_LINES: Record<string, [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],  // Heaven
  '☱': [false, true,  true ],  // Lake
  '☲': [true,  false, true ],  // Fire
  '☳': [false, false, true ],  // Thunder
  '☴': [true,  true,  false],  // Wind
  '☵': [false, true,  false],  // Water
  '☶': [true,  false, false],  // Mountain
  '☷': [false, false, false],  // Earth
};

const TrigramSVG: React.FC<{
  symbol: string;
  color?: string;
  width?: number;
  height?: number;
}> = ({ symbol, color = 'currentColor', width = 64, height = 44 }) => {
  const lines = TRIGRAM_LINES[symbol];
  if (!lines) return null;
  const lh = Math.max(2, Math.round(height * 0.2));
  const gap = Math.round(width * 0.14);
  const hw = (width - gap) / 2;
  const yMid = Math.round((height - lh) / 2);
  const positions = [0, yMid, height - lh];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      {lines.map((solid, i) =>
        solid ? (
          <rect key={i} x={0} y={positions[i]} width={width} height={lh} rx={1} fill={color} />
        ) : (
          <React.Fragment key={i}>
            <rect x={0}        y={positions[i]} width={hw} height={lh} rx={1} fill={color} />
            <rect x={hw + gap} y={positions[i]} width={hw} height={lh} rx={1} fill={color} />
          </React.Fragment>
        )
      )}
    </svg>
  );
};

// Hexagram = 6 lines with uniform spacing (upper trigram lines 1–3, lower lines 4–6)
const HexagramSVG: React.FC<{
  upper: string;
  lower: string;
  color?: string;
  width?: number;
}> = ({ upper, lower, color = 'currentColor', width = 64 }) => {
  const lh      = Math.max(2, Math.round(width * 0.1));
  const step    = Math.round(width * 0.18);
  const totalH  = lh + step * 5;
  const gap     = Math.round(width * 0.14);
  const hw      = (width - gap) / 2;

  const allLines = [...(TRIGRAM_LINES[upper] ?? [true, true, true]),
                    ...(TRIGRAM_LINES[lower] ?? [true, true, true])];

  return (
    <svg width={width} height={totalH} viewBox={`0 0 ${width} ${totalH}`} fill="none" aria-hidden="true">
      {allLines.map((solid, i) => {
        const y = i * step;
        return solid ? (
          <rect key={i} x={0} y={y} width={width} height={lh} rx={1} fill={color} />
        ) : (
          <React.Fragment key={i}>
            <rect x={0}        y={y} width={hw} height={lh} rx={1} fill={color} />
            <rect x={hw + gap} y={y} width={hw} height={lh} rx={1} fill={color} />
          </React.Fragment>
        );
      })}
    </svg>
  );
};

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

const CLOUDINARY_BASE = 'https://res.cloudinary.com/dobbosnda/image/upload';

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  makeFont: (size: number) => string,
): void {
  let size = maxSize;
  ctx.font = makeFont(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4;
    ctx.font = makeFont(size);
  }
}

async function generateStoryBlob(
  number: number,
  cardName: string,
  keywords: string,
): Promise<Blob> {
  const publicId = UL_IMAGE_BY_NUMBER.get(number);
  if (!publicId) throw new Error('no image for card ' + number);

  // Load fonts explicitly before drawing so Canvas picks them up reliably
  await Promise.all([
    document.fonts.load('400 88px "Cormorant Garamond"'),
    document.fonts.load('italic 400 32px "Cormorant Garamond"'),
    document.fonts.load('300 32px "Karla"'),
    document.fonts.load('400 32px "Karla"'),
  ]).catch(() => {});

  // Load card image with CORS so Canvas can read pixels
  const imgUrl = `${CLOUDINARY_BASE}/f_jpg,q_auto,w_1080,h_1080,c_fill,g_center/${publicId}`;
  const cardImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload  = () => resolve(i);
    i.onerror = reject;
    i.src = imgUrl;
  });

  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Dark background
  ctx.fillStyle = '#262321';
  ctx.fillRect(0, 0, W, H);

  // Card image — sits 80px from top
  ctx.drawImage(cardImg, 0, 80, W, W);

  // Gradient fade: image blends into background
  const grad = ctx.createLinearGradient(0, 940, 0, 1180);
  grad.addColorStop(0, 'rgba(38,35,33,0)');
  grad.addColorStop(1, 'rgba(38,35,33,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 940, W, 240);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;

  // "UNIVERSAL LANGUAGE ORACLE" label
  ctx.fillStyle = '#8b7355';
  ctx.font = '300 26px "Karla", sans-serif';
  ctx.fillText('UNIVERSAL LANGUAGE ORACLE', cx, 1230);

  // Card name — scale down for long names
  ctx.fillStyle = '#f5f0e8';
  fitText(ctx, cardName, 960, 88, 52, s => `400 ${s}px "Cormorant Garamond", serif`);
  ctx.fillText(cardName, cx, 1335);

  // Code label
  ctx.fillStyle = '#524330';
  ctx.font = '300 30px "Karla", sans-serif';
  ctx.fillText(`Code ${String(number).padStart(2, '0')}`, cx, 1410);

  // Keywords: shadow · gift · siddhi
  ctx.fillStyle = '#b0966b';
  fitText(ctx, keywords, 900, 34, 24, s => `400 ${s}px "Karla", sans-serif`);
  ctx.fillText(keywords, cx, 1490);

  // Thin rule
  ctx.strokeStyle = '#3d3530';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(380, 1555);
  ctx.lineTo(700, 1555);
  ctx.stroke();

  // Reading invitation
  ctx.fillStyle = '#524330';
  ctx.font = 'italic 400 30px "Cormorant Garamond", serif';
  ctx.fillText('Open the reading and receive what it holds.', cx, 1620);

  // URL
  ctx.fillStyle = '#3d3530';
  ctx.font = '300 24px "Karla", sans-serif';
  ctx.fillText('adrianrasmussen.com/oracle', cx, 1680);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.92)
  );
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

/* ─── Reduced motion hook ────────────────────────────────────────────────── */

function usePrefersReducedMotion(): boolean {
  const [prm, setPrm] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrm(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, []);
  return prm;
}

/* ─── Expand context — page-wide accordion registry ───────────────────────── */
/* Tracks every Expand / GeneKeyCard on the page so that:
   · section-level Expand-all / Collapse-all controls can drive them in concert
   · deep-links (?open=…  or #id) can force a specific block open + scroll to it
   · the reference strip can open-and-scroll a closed target
   · reader's section mode persists in sessionStorage across prev/next card nav.      */

type SectionKey = 'iching' | 'genekeys' | 'humandesign' | 'connections';

interface ExpandRegistration {
  id: string;
  section: SectionKey;
  defaultOpen: boolean;
  lock?: boolean; // ignored by setSectionMode (used for Reflection)
}

interface ExpandContextValue {
  isOpen: (id: string, section: SectionKey, defaultOpen: boolean) => boolean;
  toggle: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  setSectionMode: (section: SectionKey, mode: 'open' | 'closed') => void;
  sectionMode: Partial<Record<SectionKey, 'open' | 'closed'>>;
  register: (reg: ExpandRegistration) => () => void;
  reducedMotion: boolean;
}

const ExpandContext = createContext<ExpandContextValue | null>(null);

function useExpand(): ExpandContextValue {
  const ctx = useContext(ExpandContext);
  if (!ctx) throw new Error('Expand components must be used inside ExpandProvider');
  return ctx;
}

const ExpandProvider: React.FC<{ storageKey: string; children: React.ReactNode }> = ({ storageKey, children }) => {
  const reducedMotion = usePrefersReducedMotion();
  const registry = useRef(new Map<string, ExpandRegistration>());

  const readMode = useCallback((): Partial<Record<SectionKey, 'open' | 'closed'>> => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.sessionStorage.getItem(storageKey + ':mode');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, [storageKey]);

  const [sectionMode, setSectionModeState] = useState<Partial<Record<SectionKey, 'open' | 'closed'>>>(() => readMode());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // When the card changes, clear per-id overrides but rehydrate the persisted section mode.
  useEffect(() => {
    setOverrides({});
    setSectionModeState(readMode());
  }, [storageKey, readMode]);

  const persistMode = (next: Partial<Record<SectionKey, 'open' | 'closed'>>) => {
    try { window.sessionStorage.setItem(storageKey + ':mode', JSON.stringify(next)); } catch {}
  };

  const isOpen = useCallback((id: string, section: SectionKey, defaultOpen: boolean): boolean => {
    if (id in overrides) return overrides[id];
    const mode = sectionMode[section];
    if (mode === 'open') return true;
    if (mode === 'closed') {
      // Locked items (Reflection) stay open even under Collapse-all.
      const reg = registry.current.get(id);
      if (reg?.lock) return true;
      return false;
    }
    return defaultOpen;
  }, [overrides, sectionMode]);

  const setOpen = useCallback((id: string, open: boolean) => {
    setOverrides(o => ({ ...o, [id]: open }));
  }, []);

  const toggle = useCallback((id: string) => {
    setOverrides(o => {
      const reg = registry.current.get(id);
      const section = reg?.section ?? 'iching';
      const current = (id in o)
        ? o[id]
        : sectionMode[section] === 'open' ? true
        : sectionMode[section] === 'closed' ? (reg?.lock ? true : false)
        : reg?.defaultOpen ?? false;
      return { ...o, [id]: !current };
    });
  }, [sectionMode]);

  const setSectionMode = useCallback((section: SectionKey, mode: 'open' | 'closed') => {
    setSectionModeState(prev => {
      const next = { ...prev, [section]: mode };
      persistMode(next);
      return next;
    });
    // Clear per-id overrides within that section so the mode takes hold uniformly.
    setOverrides(o => {
      const next = { ...o };
      registry.current.forEach(reg => { if (reg.section === section) delete next[reg.id]; });
      return next;
    });
  }, []);

  const register = useCallback((reg: ExpandRegistration) => {
    registry.current.set(reg.id, reg);
    return () => { registry.current.delete(reg.id); };
  }, []);

  const value: ExpandContextValue = {
    isOpen, toggle, setOpen, setSectionMode, sectionMode, register, reducedMotion,
  };
  return <ExpandContext.Provider value={value}>{children}</ExpandContext.Provider>;
};

/* ─── Sticky mobile section label — shows the current section name as the
       reader scrolls, so when accordions push content down they still know
       where they are in the four-part architecture. Mobile only.          */

const SECTION_LABELS: Record<Exclude<Screen, 'field'>, string> = {
  iching:      'I Ching',
  genekeys:    'Gene Keys',
  humandesign: 'Human Design',
  connections: 'Connections',
};

function useCurrentSection(): Exclude<Screen, 'field'> | null {
  const [current, setCurrent] = useState<Exclude<Screen, 'field'> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const ids: Exclude<Screen, 'field'>[] = ['iching', 'genekeys', 'humandesign', 'connections'];
    const visibility = new Map<string, number>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => visibility.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      // Pick the most-visible section; clear if none are visible.
      let bestId: string | null = null;
      let bestVal = 0;
      visibility.forEach((v, id) => { if (v > bestVal) { bestVal = v; bestId = id; } });
      setCurrent(bestVal > 0 ? (bestId as Exclude<Screen, 'field'>) : null);
    }, { rootMargin: '-80px 0px -55% 0px', threshold: [0, 0.15, 0.5, 1] });
    ids.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return current;
}

const StickyMobileSectionLabel: React.FC<{ cardNumber: number; hexName: string }> = ({ cardNumber, hexName }) => {
  const current = useCurrentSection();
  if (!current) return null;
  return (
    <div
      aria-hidden="true"
      className="md:hidden fixed left-0 right-0 z-30 h-8 flex items-center px-5 bg-paper-50/95 dark:bg-stone-950/95 backdrop-blur-sm border-b border-wood-200/60 dark:border-stone-800/60 pointer-events-none dark-preserve"
      style={{ top: 'var(--nav-height, 56px)' }}
    >
      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 dark:text-stone-400">
        {SECTION_LABELS[current]} · Code {cardNumber} · {hexName}
      </span>
    </div>
  );
};

/* ─── Bridge — expose the Expand context up to the parent component so the
       main component (which hosts the Provider) can drive it without being
       split into an inner sub-component. Mounts null, only sets a ref.  ─── */

const ExpandBridge: React.FC<{ bind: (ctx: ExpandContextValue) => void }> = ({ bind }) => {
  const ctx = useExpand();
  useEffect(() => { bind(ctx); }, [bind, ctx]);
  return null;
};


/* ─── Collapsible section primitive ───────────────────────────────────────── */
/* Registers itself with the ExpandProvider by `id` so section-mode +
   deep-links can drive it. Preview text fades to transparent via a mask so it
   never looks truncated; chevron is a + rotating 45° to match GeneKeyCard.   */

const Expand: React.FC<{
  id: string;
  section: SectionKey;
  defaultOpen?: boolean;
  lock?: boolean;
  label: string;
  subtitle?: string;
  preview: React.ReactNode;
  children: React.ReactNode;
  borderColor: string;
  labelColor: string;
  innerPx?: string;
  previewMask?: 'light' | 'dark' | 'none';
}> = ({ id, section, defaultOpen = false, lock = false, label, subtitle, preview, children, borderColor, labelColor, innerPx = '', previewMask = 'none' }) => {
  const ctx = useExpand();
  const open = ctx.isOpen(id, section, defaultOpen);

  useEffect(() => ctx.register({ id, section, defaultOpen, lock }), [ctx, id, section, defaultOpen, lock]);

  const maskStyle = !open && previewMask !== 'none'
    ? {
        WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
        maskImage:       'linear-gradient(to bottom, black 55%, transparent 100%)',
      }
    : undefined;

  return (
    <div id={id} className={`border-t ${borderColor} pt-4 pb-5 ${innerPx} scroll-mt-24`}>
      <button
        type="button"
        onClick={() => ctx.toggle(id)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="w-full text-left min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze-400 rounded-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className={`font-label text-[11px] uppercase tracking-[0.2em] ${labelColor} mb-1`}>{label}</p>
            {subtitle && <p className="font-label text-[11px] text-stone-400 mb-2">{subtitle}</p>}
            {!open && (
              <div
                className={previewMask !== 'none' ? 'max-h-[8.6em] overflow-hidden' : ''}
                style={maskStyle}
              >{preview}</div>
            )}
          </div>
          <span
            className={`text-lg ${labelColor} flex-shrink-0 leading-none mt-1 ${ctx.reducedMotion ? '' : 'transition-transform duration-200'}`}
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            aria-hidden="true"
          >+</span>
        </div>
      </button>
      {open && (
        <div id={`${id}-panel`} className="mt-4 space-y-4">{children}</div>
      )}
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

const GeneKeyCard: React.FC<{
  tone: GeneKeyTone;
  level: ExpandedGeneKeyLevel;
  id: string;
  section?: SectionKey;
  defaultOpen?: boolean;
}> = ({ tone, level, id, section = 'genekeys', defaultOpen = false }) => {
  const ctx = useExpand();
  const open = ctx.isOpen(id, section, defaultOpen);
  useEffect(() => ctx.register({ id, section, defaultOpen }), [ctx, id, section, defaultOpen]);

  const cfg = TONE_CONFIG[tone];
  const paragraphs = (open ? level.expanded.text : level.collapsed.text).split('\n\n').filter(Boolean);

  return (
    // Entire card is the click target for expand/collapse.
    // Text nodes stop propagation so users can still select and copy text.
    <div
      id={id}
      className={`rounded-2xl border ${cfg.cardBorder} ${cfg.cardBg} mb-4 overflow-hidden ${CARD_SHADOW_LIGHT} cursor-pointer scroll-mt-24`}
      onClick={() => ctx.toggle(id)}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.toggle(id); } }}
    >
      {/* Tone accent bar — 3px colored rule at card top */}
      <div className={`h-[3px] w-full ${cfg.topBar}`} />

      <div className="px-6 py-6">
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className={`font-label text-[11px] uppercase tracking-[0.2em] flex-shrink-0 ${cfg.labelColor}`}>{cfg.label}</span>
            <span className={`font-sans text-xl font-medium ${cfg.nameColor}`}>{level.name}</span>
          </div>
          <span
            className={`text-lg flex-shrink-0 leading-none ${cfg.moreColor} ${ctx.reducedMotion ? '' : 'transition-transform duration-200'}`}
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            aria-hidden="true"
          >+</span>
        </div>
        {/* Contemplation title — non-text, stays clickable */}
        <p className={`font-label text-[11px] uppercase tracking-[0.15em] ${cfg.moreColor} mb-5`}>{level.contemplation_title}</p>
        {/* Text content — stop propagation only when open so expanded text stays selectable;
            when collapsed, clicks fall through to the card toggle. */}
        <div className="space-y-4 mb-3" onClick={open ? e => e.stopPropagation() : undefined}>
          {paragraphs.map((p, i) => (
            <p key={i} className={`font-sans text-[15px] ${cfg.bodyColor} leading-[1.9] ${open ? 'select-text cursor-text' : ''}`}>{p}</p>
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
                <p className="font-sans text-[15px] text-stone-600 leading-[1.9] select-text cursor-text">{level.repressive_nature.description}</p>
              </div>
            )}
            {level.reactive_nature && (
              <div className="border-l border-stone-300 pl-3">
                <p className="font-label text-[11px] uppercase tracking-[0.15em] text-stone-500 mb-1">
                  Reactive · {level.reactive_nature.label}
                </p>
                <p className="font-sans text-[15px] text-stone-600 leading-[1.9] select-text cursor-text">{level.reactive_nature.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Synthesis tone card — same tone palette as GeneKeyCard, simpler data.
       Used for synthesis rows where we have plain strings, not expanded levels. */

const SynthesisToneCard: React.FC<{
  tone: GeneKeyTone;
  id: string;
  name: string;
  text: string;
  extras?: { label: string; text: string }[];
  defaultOpen?: boolean;
}> = ({ tone, id, name, text, extras = [], defaultOpen = false }) => {
  const ctx = useExpand();
  const open = ctx.isOpen(id, 'genekeys', defaultOpen);
  useEffect(() => ctx.register({ id, section: 'genekeys', defaultOpen }), [ctx, id, defaultOpen]);
  const cfg = TONE_CONFIG[tone];
  const paragraphs = text.split('\n\n').filter(Boolean);
  const previewPara = paragraphs[0] ?? '';

  return (
    <div
      id={id}
      className={`rounded-2xl border ${cfg.cardBorder} ${cfg.cardBg} mb-4 overflow-hidden ${CARD_SHADOW_LIGHT} cursor-pointer scroll-mt-24`}
      onClick={() => ctx.toggle(id)}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.toggle(id); } }}
    >
      <div className={`h-[3px] w-full ${cfg.topBar}`} />
      <div className="px-6 py-6">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className={`font-label text-[11px] uppercase tracking-[0.2em] flex-shrink-0 ${cfg.labelColor}`}>{cfg.label}</span>
            <span className={`font-sans text-xl font-medium ${cfg.nameColor}`}>{name}</span>
          </div>
          <span
            className={`text-lg flex-shrink-0 leading-none ${cfg.moreColor} ${ctx.reducedMotion ? '' : 'transition-transform duration-200'}`}
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            aria-hidden="true"
          >+</span>
        </div>
        <div className="space-y-4" onClick={open ? e => e.stopPropagation() : undefined}>
          {open ? (
            <>
              {paragraphs.map((p, i) => (
                <p key={i} className={`font-sans text-[15px] ${cfg.bodyColor} leading-[1.9] select-text cursor-text`}>{p}</p>
              ))}
              {extras.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-stone-300/60">
                  {extras.map((ex, i) => (
                    <div key={i} className="border-l border-stone-300 pl-3">
                      <p className={`font-label text-[11px] uppercase tracking-[0.15em] ${cfg.labelColor} mb-1`}>{ex.label}</p>
                      {ex.text.split('\n\n').filter(Boolean).map((p, j) => (
                        <p key={j} className={`font-sans text-[15px] ${cfg.bodyColor} leading-[1.9] select-text cursor-text ${j > 0 ? 'mt-3' : ''}`}>{p}</p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p
              className={`font-sans text-[15px] ${cfg.bodyColor} leading-[1.9] max-h-[8.6em] overflow-hidden`}
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
                maskImage:       'linear-gradient(to bottom, black 55%, transparent 100%)',
              }}
            >{previewPara}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Generic expandable card — full-card-click, matches Gene Keys UX ────── */

const ExpandCard: React.FC<{
  id: string;
  section: SectionKey;
  label: string;
  title?: string;
  text: string;
  variant: 'dark' | 'light';
  accent?: string;
  defaultOpen?: boolean;
  footer?: React.ReactNode;
}> = ({ id, section, label, title, text, variant, accent, defaultOpen = false, footer }) => {
  const ctx = useExpand();
  const open = ctx.isOpen(id, section, defaultOpen);
  useEffect(() => ctx.register({ id, section, defaultOpen }), [ctx, id, section, defaultOpen]);

  const isDark = variant === 'dark';
  const paragraphs = text.split('\n\n').filter(Boolean);
  const preview = paragraphs[0] ?? '';

  return (
    <div
      id={id}
      className={`rounded-2xl border overflow-hidden cursor-pointer scroll-mt-24 ${
        isDark
          ? `border-stone-700/40 ${CARD_SHADOW}`
          : `border-wood-200 ${CARD_SHADOW_LIGHT} bg-[#fafaf8] dark:bg-[#1d1b18]`
      }`}
      style={isDark ? { background: 'rgba(22, 20, 18, 0.6)' } : undefined}
      onClick={() => ctx.toggle(id)}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.toggle(id); } }}
    >
      {accent && <div className={`h-[3px] w-full ${accent}`} />}
      <div className="px-6 py-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <span className={`font-label text-[11px] uppercase tracking-[0.2em] ${isDark ? 'text-stone-500' : 'text-wood-400'}`}>{label}</span>
            {title && <p className={`font-sans text-xl font-medium mt-0.5 ${isDark ? 'text-stone-100' : 'text-wood-900'}`}>{title}</p>}
          </div>
          <span
            className={`text-lg flex-shrink-0 leading-none mt-0.5 ${isDark ? 'text-stone-500' : 'text-wood-400'} ${ctx.reducedMotion ? '' : 'transition-transform duration-200'}`}
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            aria-hidden="true"
          >+</span>
        </div>
        <div onClick={open ? e => e.stopPropagation() : undefined}>
          {open ? (
            <div className="space-y-4">
              {paragraphs.map((p, i) => (
                <p key={i} className={`font-sans text-[15px] leading-[1.9] select-text cursor-text ${isDark ? 'text-stone-200' : 'text-wood-700'}`}>{p}</p>
              ))}
              {footer}
            </div>
          ) : (
            <p
              className={`font-sans text-[15px] leading-[1.9] max-h-[8.6em] overflow-hidden ${isDark ? 'text-stone-300' : 'text-wood-600'}`}
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
                maskImage:       'linear-gradient(to bottom, black 55%, transparent 100%)',
              }}
            >{preview}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Card link ──────────────────────────────────────────────────────────── */

const EssenceBlock: React.FC<{ essence: string }> = ({ essence }) => {
  const paras = essence.split('\n\n').filter(Boolean);
  return (
    <div className="mt-6 rounded-xl border border-wood-200/70 bg-paper-100 shadow-[0_2px_12px_rgba(60,44,22,0.06)] px-6 py-7">
      <div className="space-y-5">
        {paras.map((p, i) => (
          <p key={i} className="font-sans text-[15px] text-wood-800 leading-[1.9]">{p}</p>
        ))}
      </div>
    </div>
  );
};

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

/* ─── Keyword row — dots only between words on the same visual line ──────── */

const KeywordRow: React.FC<{ kws: string[]; onClick: () => void }> = ({ kws, onClick }) => {
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  // Default all dots visible — hidden after first measurement where needed
  const [sameLine, setSameLine] = useState<boolean[]>(() => kws.map(() => true));

  const measure = useCallback(() => {
    const els = spanRefs.current;
    if (els.length < kws.length) return;
    const tops = els.map(el => el?.getBoundingClientRect().top ?? -1);
    setSameLine(tops.map((top, i) => i < tops.length - 1 && Math.abs(top - tops[i + 1]) < 2));
  }, [kws]);

  useEffect(() => {
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    if (containerRef.current) ro.observe(containerRef.current);
    requestAnimationFrame(measure);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      className="mt-2 flex flex-wrap items-baseline justify-center gap-y-0 text-center cursor-pointer group"
    >
      {kws.map((k, i) => (
        <React.Fragment key={i}>
          <span
            ref={el => { spanRefs.current[i] = el; }}
            className="whitespace-nowrap font-serif text-xl leading-snug text-wood-400 dark:text-wood-500 group-hover:text-bronze-600 transition-colors"
          >
            {k}
          </span>
          {i < kws.length - 1 && (
            <span
              className="font-serif text-xl leading-snug group-hover:text-bronze-600 transition-colors select-none"
              style={{ color: sameLine[i] ? undefined : 'transparent', marginLeft: '0.375rem', marginRight: '0.375rem' }}
              aria-hidden="true"
            >·</span>
          )}
        </React.Fragment>
      ))}
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

  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [shareOpen,      setShareOpen]      = useState(false);
  const [storyLoading,   setStoryLoading]   = useState(false);
  const [ichingOpen,     setIchingOpen]     = useState<'hex' | 'upper' | 'lower'>('hex');
  const ichingRef    = useRef<HTMLDivElement>(null);

  const [showQREntrance, setShowQREntrance] = useState(
    () => new URLSearchParams(window.location.search).get('ref') === 'qr'
  );
  // Ritual entrance plays on every landing (direct URL, internal nav, or ritual
  // state) unless the visitor arrived via a QR scan, which has its own entrance.
  const [showIndexEntrance, setShowIndexEntrance] = useState(
    () => new URLSearchParams(window.location.search).get('ref') !== 'qr'
  );
  // Bridge — lets `go()` and the deep-link effect reach into the Expand
  // registry below the Provider without splitting this component in two.
  const expandRef = useRef<ExpandContextValue | null>(null);

  const go = (id: string) => {
    // If the target is a registered Expand/GeneKeyCard, make sure it's open
    // before scrolling so readers don't land on a closed accordion.
    expandRef.current?.setOpen(id, true);
    // A tiny rAF gives React time to render the open state before scroll.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const sortedNums  = ALL_CARDS.map(c => c.number);
  const currentIdx  = sortedNums.indexOf(cardNum);
  const prevCardNum = currentIdx > 0 ? sortedNums[currentIdx - 1] : null;
  const nextCardNum = currentIdx < sortedNums.length - 1 ? sortedNums[currentIdx + 1] : null;

  useEffect(() => {
    setLightboxOpen(false);
    setShareOpen(false);
    storyFileRef.current = null;
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

  // Deep-link: ?open=<id> or #<id> opens that specific Expand and scrolls to it.
  // Run after a short delay so child Expand components have registered themselves.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params   = new URLSearchParams(window.location.search);
    const fromQs   = params.get('open');
    const fromHash = window.location.hash.replace(/^#/, '') || null;
    const targetId = fromQs || fromHash;
    if (!targetId) return;
    const t = setTimeout(() => {
      expandRef.current?.setOpen(targetId, true);
      requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, 280);
    return () => clearTimeout(t);
  }, [cardNum]);

  const shareUrl  = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = card ? `${card.card_name} · Code ${card.number} · Universal Language Oracle by Adrian Rasmussen` : '';

  // Pre-generate the story image as soon as the share sheet opens so tapping
  // Instagram is instant — no visible loading delay.
  const storyFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!shareOpen || !card) return;
    if (storyFileRef.current) return;
    const keywords = `${card.gene_keys.shadow} · ${card.gene_keys.gift} · ${card.gene_keys.siddhi}`;
    generateStoryBlob(card.number, card.card_name, keywords)
      .then(blob => {
        storyFileRef.current = new File([blob], `universal-language-code-${card.number}.jpg`, { type: 'image/jpeg' });
      })
      .catch(() => {});
  }, [shareOpen, card]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstagramShare = async () => {
    const file = storyFileRef.current;
    if (file && 'canShare' in navigator && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: shareText, url: shareUrl }); } catch {}
    } else {
      // Desktop or unsupported — fall back to download
      handleStoryDownload();
    }
  };

  const handleStoryDownload = async () => {
    if (!card) return;
    setStoryLoading(true);
    try {
      const keywords = `${card.gene_keys.shadow} · ${card.gene_keys.gift} · ${card.gene_keys.siddhi}`;
      const blob      = storyFileRef.current ?? await generateStoryBlob(card.number, card.card_name, keywords);
      const objectUrl = URL.createObjectURL(blob);
      const a         = document.createElement('a');
      a.href          = objectUrl;
      a.download      = `universal-language-code-${card.number}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore — nothing to fall back to without a URL
    } finally {
      setStoryLoading(false);
    }
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
          <p className="font-sans text-[15px] text-wood-400 mb-8 leading-[1.9]">The oracle holds 64 expressions. This one may be waiting for you elsewhere.</p>
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
    <ExpandProvider storageKey={`ul-card-${cardNum}`}>
      <ExpandBridge bind={ctx => { expandRef.current = ctx; }} />
      <StickyMobileSectionLabel cardNumber={card.number} hexName={card.iching.hexagram_name} />
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
            <div className="border-t border-b border-wood-200/60">
              <div className="flex divide-x divide-wood-200/40">
                {/* Acquire */}
                <Link
                  to={piece ? `/creations/${piece.id}` : '/inquire'}
                  className="group flex-1 flex items-center justify-between gap-4 px-4 py-3 bg-paper-50 hover:bg-paper-100 transition-colors duration-200"
                >
                  <div>
                    <p className="font-serif text-[15px] text-wood-900 group-hover:text-bronze-600 transition-colors duration-200 leading-tight">
                      Acquire
                    </p>
                    <p className="font-label text-[11px] uppercase tracking-[0.25em] text-wood-500 mt-0.5">
                      Physical piece
                    </p>
                  </div>
                  {piece?.availability === 'SOLD' && (
                    <span className="font-label text-[10px] uppercase tracking-[0.2em] ml-auto flex-shrink-0 text-wood-400">
                      Sold
                    </span>
                  )}
                  {piece?.availability === 'READY_TO_SHIP' && (
                    <span className="font-label text-[10px] uppercase tracking-[0.2em] ml-auto flex-shrink-0 text-bronze-500 group-hover:text-bronze-400 transition-colors duration-200">
                      Available
                    </span>
                  )}
                </Link>

                {/* Hexagram symbol */}
                {synthesis?.reference?.hexagram_symbol && (
                  <div className="flex items-center justify-center px-4 py-3 bg-paper-50">
                    <HexagramSVG upper={card.iching.upper_trigram.symbol} lower={card.iching.lower_trigram.symbol} color="#a09070" width={40} />
                  </div>
                )}

                {/* Share */}
                <button
                  onClick={() => setShareOpen(v => !v)}
                  className="group flex-1 flex items-center justify-end px-4 py-3 bg-paper-50 hover:bg-paper-100 transition-colors duration-200"
                  aria-expanded={shareOpen}
                >
                  <div className="text-right">
                    <p className="font-serif text-[15px] text-wood-900 group-hover:text-bronze-600 transition-colors duration-200 leading-tight">
                      Share
                    </p>
                    <p className="font-label text-[11px] uppercase tracking-[0.25em] text-wood-500 mt-0.5">
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

                    {/* Instagram Stories — opens native share sheet with image on mobile,
                        falls back to download on desktop */}
                    <button
                      onClick={handleInstagramShare}
                      disabled={storyLoading}
                      className="flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors text-left disabled:opacity-50"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0">
                        <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                      </svg>
                      <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600">
                        {storyLoading ? 'Saving...' : 'Instagram Story'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:max-w-2xl md:mx-auto px-4 pt-8 pb-0 bg-paper-50">
            {/* Title block — card container */}
            <div className="rounded-2xl border border-wood-200/70 shadow-[0_4px_24px_rgba(60,44,22,0.09),0_1px_3px_rgba(60,44,22,0.05)] overflow-hidden">
              {/* Bronze accent top bar */}
              <div className="h-[3px] w-full bg-bronze-400" />
              <div className="px-6 pt-6 pb-5">
                {/* Title row */}
                <div className="text-center">
                  <h1 className="font-serif text-[32px] text-wood-900 leading-[1.1] tracking-[-0.01em] whitespace-nowrap">{card.card_name}</h1>
                </div>
                {/* Keywords subtitle */}
                {(() => {
                  const kws = synthesis?.keywords ?? expanded?.keywords ?? [];
                  return kws.length > 0 ? (
                    <>
                      <div className="mt-3 h-px bg-wood-400/30" />
                      <KeywordRow kws={kws} onClick={() => go('genekeys')} />
                    </>
                  ) : null;
                })()}
              </div>{/* end card inner px */}
            </div>{/* end card container */}
          </div>

          <div className="max-w-3xl mx-auto px-4 pt-6 pb-14 bg-paper-50">

            {synthesis?.essence && (
              <EssenceBlock essence={synthesis.essence} />
            )}


            {/* Reference strip — hero + context composition.
                Rhythm: tight label-value pairs inside sections, generous space
                between hero and metadata. Two containers instead of five. */}
            {synthesis?.reference && (
              <div className="mt-10 mb-6 max-w-md mx-auto">

                {/* I Ching — thin row at top, sets entry.
                    Type: Lato 10/caps label + Cormorant 17 title. */}
                <button
                  onClick={() => go('iching')}
                  className="group w-full flex items-baseline gap-4 text-left pb-4 border-b border-wood-200/70 hover:border-bronze-400/70 transition-colors"
                >
                  <HexagramSVG upper={card.iching.upper_trigram.symbol} lower={card.iching.lower_trigram.symbol} color="#a09070" width={24} />
                  <span className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 self-center">I Ching</span>
                  <span className="font-serif text-[17px] text-wood-900 leading-none group-hover:text-bronze-600 transition-colors flex-1 truncate">{card.iching.hexagram_name}</span>
                  <span className="text-[11px] text-wood-400 group-hover:text-wood-600 transition-colors self-center">→</span>
                </button>

                {/* Gene Keys — the reading. Three equal-weight serif values
                    in an asymmetric label-gutter composition. Gift tinted
                    bronze for emphasis without size change. */}
                <button
                  onClick={() => go('genekeys')}
                  className="group block w-full text-left mt-6 mb-6"
                >
                  <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-bronze-400/30 group-hover:border-bronze-500/70 transition-colors">
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-bronze-600">Gene Keys</p>
                    <span className="text-[11px] text-bronze-400 group-hover:text-bronze-600 transition-colors">→</span>
                  </div>

                  <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 items-baseline">
                    <span className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-400">Shadow</span>
                    <span className="font-serif text-[17px] text-wood-700 leading-none tracking-[-0.005em]">{card.gene_keys.shadow}</span>

                    <span className="font-label text-[10px] uppercase tracking-[0.22em] text-bronze-600">Gift</span>
                    <span className="font-serif text-[17px] text-bronze-700 leading-none font-medium tracking-[-0.005em] group-hover:text-bronze-800 transition-colors">{card.gene_keys.gift}</span>

                    <span className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-400">Siddhi</span>
                    <span className="font-serif text-[17px] text-wood-700 leading-none tracking-[-0.005em]">{card.gene_keys.siddhi}</span>
                  </div>
                </button>

                {/* Metadata panel — tabular label/value rows. Context text in
                    italic Cormorant differentiates from Lato caps labels. */}
                <div className="rounded-2xl border border-wood-200/80 bg-paper-50 overflow-hidden">

                  {/* Human Design */}
                  <button
                    onClick={() => go('humandesign')}
                    className="group w-full flex items-baseline gap-4 px-5 py-4 text-left hover:bg-paper-100/60 transition-colors"
                  >
                    <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 w-[88px] shrink-0 self-center">Human Design</span>
                    <div className="flex-1 min-w-0 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
                      <span className="font-serif text-[17px] text-wood-900 leading-none group-hover:text-bronze-600 transition-colors">{synthesis.reference.hd_center}</span>
                      <span className="font-serif italic text-[13px] text-wood-500 leading-none">{synthesis.reference.hd_circuit} · {synthesis.reference.hd_harmonic_gate}</span>
                    </div>
                    <span className="text-[11px] text-wood-400 group-hover:text-wood-600 transition-colors self-center">→</span>
                  </button>

                  <div className="border-t border-wood-200/40" />

                  {/* Tarot */}
                  <button
                    onClick={() => go('connections')}
                    className="group w-full flex items-baseline gap-4 px-5 py-4 text-left hover:bg-paper-100/60 transition-colors"
                  >
                    <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 w-[88px] shrink-0 self-center">Tarot</span>
                    <div className="flex-1 min-w-0 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
                      <span className="font-serif text-[17px] text-wood-900 leading-none group-hover:text-bronze-600 transition-colors">{synthesis.reference.tarot_card}</span>
                      <span className="font-serif italic text-[13px] text-wood-500 leading-none">{synthesis.reference.astrology} · {synthesis.reference.hebrew_letter}</span>
                    </div>
                    <span className="text-[11px] text-wood-400 group-hover:text-wood-600 transition-colors self-center">→</span>
                  </button>

                  <div className="border-t border-wood-200/40" />

                  {/* Body */}
                  <button
                    onClick={() => go('connections')}
                    className="group w-full flex items-baseline gap-4 px-5 py-4 text-left hover:bg-paper-100/60 transition-colors"
                  >
                    <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 w-[88px] shrink-0 self-center">Body</span>
                    <div className="flex-1 min-w-0 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
                      <span className="font-serif text-[17px] text-wood-900 leading-none group-hover:text-bronze-600 transition-colors">{synthesis.reference.body_physiology}</span>
                      {synthesis.reference.body_amino_acid && (
                        <span className="font-serif italic text-[13px] text-wood-500 leading-none">{synthesis.reference.body_amino_acid}</span>
                      )}
                      {synthesis.reference.programming_partner && (
                        <span className="font-serif italic text-[13px] text-wood-500 leading-none">Partner {synthesis.reference.programming_partner}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-wood-400 group-hover:text-wood-600 transition-colors self-center">→</span>
                  </button>

                </div>
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
          <div className="max-w-2xl mx-auto px-3 pt-12 pb-14 space-y-4">


            <p className="font-sans text-[15px] text-stone-300 leading-[1.9] px-1">
              The oldest of the three systems. Reads the energetic pattern of this moment through 64 hexagrams — combinations of heaven and earth.
            </p>

            {/* Island 1 — Interactive hexagram + trigram selector */}
            <div ref={ichingRef} className={`rounded-2xl border border-stone-700/50 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(28, 25, 23, 0.7)' }}>

              {/* Row 1: Full hexagram */}
              <button
                onClick={() => setIchingOpen('hex')}
                className={`group w-full flex items-center gap-4 px-6 py-5 text-left transition-colors ${ichingOpen === 'hex' ? 'bg-bronze-500/[0.08]' : 'hover:bg-white/[0.03]'}`}
              >
                <HexagramSVG upper={card.iching.upper_trigram.symbol} lower={card.iching.lower_trigram.symbol} color={ichingOpen === 'hex' ? 'rgba(180,130,70,0.9)' : 'rgba(180,130,70,0.5)'} width={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-label text-[11px] uppercase tracking-[0.22em] text-stone-300 mb-0.5">Hexagram {card.number}</p>
                  <h2 className={`font-serif text-2xl leading-[1.2] transition-colors ${ichingOpen === 'hex' ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'}`}>{card.iching.hexagram_name}</h2>
                </div>
                <span className={`text-sm transition-colors flex-shrink-0 ${ichingOpen === 'hex' ? 'text-bronze-400' : 'text-stone-400 group-hover:text-stone-200'}`}>→</span>
              </button>

              <div className="border-t border-stone-700/50" />

              {/* Row 2: Upper + Lower side by side */}
              <div className="flex divide-x divide-stone-700/50">
                <button
                  onClick={() => setIchingOpen('upper')}
                  className={`group flex-1 flex items-center gap-3 px-5 py-4 text-left transition-colors ${ichingOpen === 'upper' ? 'bg-bronze-500/[0.08]' : 'hover:bg-white/[0.03]'}`}
                >
                  <TrigramSVG symbol={card.iching.upper_trigram.symbol} color={ichingOpen === 'upper' ? '#c9a05a' : '#6b5a40'} width={28} height={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-0.5">Upper</p>
                    <p className={`font-serif text-[15px] leading-tight truncate transition-colors ${ichingOpen === 'upper' ? 'text-stone-200' : 'text-stone-300 group-hover:text-stone-100'}`}>{card.iching.upper_trigram.name}</p>
                  </div>
                </button>
                <button
                  onClick={() => setIchingOpen('lower')}
                  className={`group flex-1 flex items-center gap-3 px-5 py-4 text-left transition-colors ${ichingOpen === 'lower' ? 'bg-bronze-500/[0.08]' : 'hover:bg-white/[0.03]'}`}
                >
                  <TrigramSVG symbol={card.iching.lower_trigram.symbol} color={ichingOpen === 'lower' ? '#c9a05a' : '#6b5a40'} width={28} height={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-0.5">Lower</p>
                    <p className={`font-serif text-[15px] leading-tight truncate transition-colors ${ichingOpen === 'lower' ? 'text-stone-200' : 'text-stone-300 group-hover:text-stone-100'}`}>{card.iching.lower_trigram.name}</p>
                  </div>
                </button>
              </div>

              {/* Reading zone — always visible, updates on tap */}
              <div className="border-t border-stone-700/50 px-6 py-5">
                <p className="font-label text-[11px] uppercase tracking-[0.22em] text-bronze-400 mb-3">
                  {ichingOpen === 'hex'
                    ? `Hexagram ${card.number} · ${card.iching.hexagram_name}`
                    : ichingOpen === 'upper'
                    ? `Upper · ${card.iching.upper_trigram.name}`
                    : `Lower · ${card.iching.lower_trigram.name}`}
                </p>
                <p className="font-sans text-[15px] text-stone-300 leading-[1.9]">
                  {ichingOpen === 'hex'
                    ? (synthesis?.synthesis.iching.trigram_combination ?? card.iching.essence)
                    : ichingOpen === 'upper'
                    ? card.iching.upper_trigram.nature
                    : card.iching.lower_trigram.nature}
                </p>
              </div>
            </div>

            {/* Island 2 — Oracle reading + classical text (below trigrams) */}
            {synthesis && (
              <div className={`rounded-2xl border border-stone-700/40 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                {/* The reading — collapsed by default, click label or preview to expand */}
                <Expand
                  id="iching-reading"
                  section="iching"
                  label="The reading"
                  subtitle="the oracle's reading for this configuration"
                  borderColor="border-stone-700/40"
                  labelColor="text-stone-400"
                  innerPx="px-6"
                  previewMask="dark"
                  preview={(() => {
                    const first = synthesis.synthesis.iching.reading.split('\n\n').filter(Boolean)[0] ?? '';
                    return <p className="font-sans text-[15px] text-stone-300 leading-[1.9]">{first}</p>;
                  })()}
                >
                  {synthesis.synthesis.iching.reading.split('\n\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="font-sans text-[15px] text-stone-200 leading-[1.9]">{p}</p>
                  ))}
                </Expand>

                {/* Classical Judgement + Image — reference, collapsed by default */}
                {(synthesis.synthesis.iching.judgement_lines.length > 0 || synthesis.synthesis.iching.image_lines.length > 0) && (
                  <Expand
                    id="iching-classical"
                    section="iching"
                    label="The classical text"
                    subtitle="Wilhelm translation"
                    borderColor="border-stone-700/40"
                    labelColor="text-stone-400"
                    innerPx="px-6"
                    previewMask="dark"
                    preview={(() => {
                      const firstLine = synthesis.synthesis.iching.judgement_lines[0]
                        ?? synthesis.synthesis.iching.image_lines[0]
                        ?? '';
                      return <p className="font-sans text-[15px] text-stone-400 leading-[1.9]">{firstLine}</p>;
                    })()}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {synthesis.synthesis.iching.judgement_lines.length > 0 && (
                        <div>
                          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">Judgement</p>
                          {synthesis.synthesis.iching.judgement_lines.map((line, i) => (
                            <p key={i} className="font-sans text-[15px] text-stone-300 leading-[1.9]">{line}</p>
                          ))}
                        </div>
                      )}
                      {synthesis.synthesis.iching.image_lines.length > 0 && (
                        <div>
                          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3">Image</p>
                          {synthesis.synthesis.iching.image_lines.map((line, i) => (
                            <p key={i} className="font-sans text-[15px] text-stone-300 leading-[1.9]">{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </Expand>
                )}
              </div>
            )}

            {/* Island 3 — Wisdom group (only when no synthesis) */}
            {!synthesis && expanded && (
              <div className={`rounded-2xl border border-stone-700/40 overflow-hidden ${CARD_SHADOW}`} style={{ background: 'rgba(22, 20, 18, 0.6)' }}>
                <Expand
                  id="iching-overview"
                  section="iching"
                  defaultOpen
                  label="Overview"
                  borderColor="border-stone-700/40" labelColor="text-stone-400"
                  innerPx="px-6"
                  previewMask="dark"
                  preview={<p className="font-sans text-[15px] text-stone-200 leading-[1.9]">{expanded.i_ching.trigrams.overview.text}</p>}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Outer</p>
                      <p className="font-sans text-[15px] text-stone-300 leading-[1.9]">{expanded.i_ching.trigrams.outer.context.text}</p>
                    </div>
                    <div>
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Inner</p>
                      <p className="font-sans text-[15px] text-stone-300 leading-[1.9]">{expanded.i_ching.trigrams.inner.context.text}</p>
                    </div>
                  </div>
                  <p className="font-sans text-[15px] text-stone-300 leading-[1.9] mt-4">
                    {expanded.i_ching.trigrams.family_dynamic.text}
                  </p>
                </Expand>
                <Expand
                  id="iching-judgment"
                  section="iching"
                  label="The Judgment"
                  subtitle="the oracle's ruling on this moment"
                  borderColor="border-stone-700/40" labelColor="text-stone-400"
                  innerPx="px-6"
                  previewMask="dark"
                  preview={(() => {
                    const lines = expanded.i_ching.image_of_the_situation.text.split('\n').filter(Boolean);
                    const headline = lines[0];
                    const stages = lines[1]?.replace(/\.$/, '').split(',').map(s => s.trim()).filter(Boolean) ?? [];
                    const fom = expanded.i_ching.image_of_the_situation.fields_of_meaning ?? '';
                    const timeCycleSentences = fom.split('. ').filter(s => s.includes('Time Cycle') || s.includes('four stages'));
                    const timeCycleText = timeCycleSentences.join('. ').replace(/\.?$/, '.');
                    return (
                      <div className="space-y-5">
                        <p className="font-sans text-[15px] text-stone-100 leading-[1.9]">{headline}</p>
                        {stages.length > 0 && (
                          <div>
                            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-stone-600 mb-2">The four stages of the time cycle</p>
                            <div className="flex gap-3 flex-wrap">
                              {stages.map((s, i) => (
                                <span key={i} className="font-sans text-[15px] text-stone-300 border border-stone-700/50 rounded px-3 py-1">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {timeCycleText && (
                          <p className="font-sans text-[15px] text-stone-400 leading-[1.9]">{timeCycleText}</p>
                        )}
                      </div>
                    );
                  })()}
                >
                  <p className="font-sans text-[15px] text-stone-300 leading-[1.9] mb-5">{expanded.i_ching.image_of_the_situation.fields_of_meaning}</p>
                  <div className="space-y-2 border-t border-stone-700/30 pt-4">
                    {expanded.i_ching.image_tradition.text.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="font-sans text-[15px] text-stone-300 leading-[1.9]">{line}</p>
                    ))}
                  </div>
                </Expand>
                <Expand
                  id="iching-patterns"
                  section="iching"
                  label="Patterns of Wisdom"
                  borderColor="border-stone-700/40" labelColor="text-stone-400"
                  innerPx="px-6"
                  previewMask="dark"
                  preview={<p className="font-sans text-[15px] text-stone-400 leading-[1.9]">{expanded.i_ching.patterns_of_wisdom.nature_image}</p>}
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
                  <p className="font-sans text-[15px] text-stone-100 leading-[1.9]">{expanded.i_ching.reflection.text}</p>
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
          <div className="max-w-2xl mx-auto px-3 pt-12 pb-14 space-y-4">


            <p className="font-sans text-[15px] text-wood-600 leading-[1.9] px-1">
              A spectrum of transformation. The shadow is the pattern you move through. The gift is what opens on the other side. The siddhi is the highest expression, rare but real.
            </p>

            {/* Island 1 — Header */}
            <div className={`rounded-2xl border border-wood-200 bg-white px-6 py-6 ${CARD_SHADOW_LIGHT}`}>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-2">
                Gene Key {card.number} · Gate {card.human_design.gate}
              </p>
              <h2 className="font-serif text-3xl text-wood-900 font-semibold leading-[1.2] mb-3">The {card.gene_keys.gift} Key</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-sans text-[15px] text-stone-500">{card.gene_keys.shadow}</span>
                <span className="text-wood-300" aria-hidden="true">·</span>
                <span className="font-sans text-[15px] text-bronze-600 font-medium">{card.gene_keys.gift}</span>
                <span className="text-wood-300" aria-hidden="true">·</span>
                <span className="font-sans text-[15px] text-wood-600">{card.gene_keys.siddhi}</span>
              </div>
            </div>

            {/* Islands 2–4 — three tone cards (Shadow / Gift / Siddhi).
                Gift opens by default as the primary reading; Repressive, Reactive
                and Programming Partner are tucked inside their parent tone. */}
            {synthesis ? (
              <>
                <SynthesisToneCard
                  tone="shadow"
                  id="genekey-shadow"
                  name={card.gene_keys.shadow}
                  text={synthesis.synthesis.gene_keys.shadow}
                  extras={[
                    { label: 'Repressive', text: synthesis.synthesis.gene_keys.repressive },
                    { label: 'Reactive',   text: synthesis.synthesis.gene_keys.reactive   },
                  ]}
                />
                <SynthesisToneCard
                  tone="gift"
                  id="genekey-gift"
                  name={card.gene_keys.gift}
                  text={synthesis.synthesis.gene_keys.gift}
                  extras={[
                    { label: 'Programming Partner', text: synthesis.synthesis.gene_keys.programming_partner },
                  ]}
                />
                <SynthesisToneCard
                  tone="siddhi"
                  id="genekey-siddhi"
                  name={card.gene_keys.siddhi}
                  text={synthesis.synthesis.gene_keys.siddhi}
                />
                <p className="font-label text-[11px] text-wood-400 px-1 leading-[1.9]">
                  Gene Keys text based on the work of Richard Rudd, visit him to dive deeper in wisdom and experiences at{' '}
                  <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-wood-600 transition-colors">genekeys.com</a>
                </p>
              </>
            ) : expanded ? (
              <>
                <GeneKeyCard tone="shadow" level={expanded.gene_keys.shadow} id="genekey-shadow" />
                <GeneKeyCard tone="gift"   level={expanded.gene_keys.gift}   id="genekey-gift" />
                <GeneKeyCard tone="siddhi" level={expanded.gene_keys.siddhi} id="genekey-siddhi" />
                <p className="font-label text-[11px] text-wood-400 px-1 leading-[1.9]">
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
          <div className="max-w-2xl mx-auto px-3 pt-12 pb-14 space-y-4">


            <p className="font-sans text-[15px] text-stone-300 leading-[1.9] px-1">
              Human Design maps the gate this card activates in your body graph. The Gate is the quality. The Channel shows how it connects. The Circuit shows the larger pattern it belongs to.
            </p>

            {/* Header */}
            <div className={`rounded-2xl border border-stone-700/50 px-6 py-6 ${CARD_SHADOW}`} style={{ background: 'rgba(28, 25, 23, 0.7)' }}>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-2">Human Design · Gate {card.human_design.gate}</p>
              <h2 className="font-serif text-3xl text-stone-100 font-semibold leading-[1.2] mb-1">{card.human_design.keyword}</h2>
            </div>

            {/* Description (only when no synthesis) */}
            {!synthesis && (
              <ExpandCard
                id="hd-description"
                section="humandesign"
                label="Description"
                title={card.human_design.keyword}
                text={card.human_design.description + (card.traditional_colors ? '\n\n' + card.traditional_colors : '')}
                variant="dark"
              />
            )}

            {/* Synthesis HD reading — three separate cards (Gate / Channel / Circuit) */}
            {synthesis && (
              <>
                <ExpandCard
                  id="hd-gate"
                  section="humandesign"
                  label="The Gate"
                  title={synthesis.reference?.hd_keyword ?? card.human_design.keyword}
                  text={synthesis.synthesis.human_design.gate}
                  variant="dark"
                />
                <ExpandCard
                  id="hd-channel"
                  section="humandesign"
                  label="The Channel"
                  title={synthesis.reference?.hd_harmonic_gate ? `Gate ${card.human_design.gate} · ${synthesis.reference.hd_harmonic_gate}` : undefined}
                  text={synthesis.synthesis.human_design.channel}
                  variant="dark"
                />
                <ExpandCard
                  id="hd-circuit"
                  section="humandesign"
                  label="The Circuit"
                  title={synthesis.reference?.hd_circuit ?? undefined}
                  text={synthesis.synthesis.human_design.circuit}
                  variant="dark"
                />
              </>
            )}

            {/* Tarot — codon ring connection */}
            {card.ring_tarot && (
              <ExpandCard
                id="hd-ring-tarot"
                section="humandesign"
                label={card.ring_name}
                title={card.ring_tarot}
                text={card.ring_description ?? ''}
                variant="dark"
                accent="bg-bronze-400"
              />
            )}

          </div>
        </section>

        {/* ════════════ CONNECTIONS ═════════════════════════════════════ */}
        <section id="connections" className={`${SCREEN_BG.connections} scroll-mt-16`}>
          <div className="max-w-2xl mx-auto px-3 pt-12 pb-14 space-y-4">

            {expanded ? (
              <>
                {/* Paired Hexagram */}
                {pairCard && (
                  <div className={`rounded-2xl border border-wood-200 overflow-hidden bg-[#fafaf8] dark:bg-[#1d1b18] ${CARD_SHADOW_LIGHT}`}>
                    <div className="px-5 pt-5 pb-3">
                      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">Paired Hexagram</p>
                      <p className="font-sans text-[15px] text-wood-600 leading-[1.9] mb-3">{expanded.i_ching.hexagrams_in_pairs.context.text}</p>
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
                      <p className="font-sans text-[15px] text-wood-600 leading-[1.9] mb-3">{expanded.gene_keys.programming_partner.relationship_context}</p>
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
                    <p className="font-sans text-[15px] text-wood-600 leading-[1.9] mb-4">{expanded.gene_keys.codon_ring.relationship_context}</p>
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
                <p className="font-sans text-[15px] text-wood-500 leading-[1.9]">Connection data will be available soon.</p>
              </div>
            )}

            {/* Tarot resonance */}
            {synthesis && (
              <ExpandCard
                id="connections-tarot"
                section="connections"
                label={`Tarot · ${card.ring_name}`}
                title={synthesis.reference?.tarot_card ?? card.ring_tarot}
                text={synthesis.synthesis.tarot.ring_role + '\n\n' + synthesis.synthesis.tarot.tarot_resonance}
                variant="light"
              />
            )}

            {/* Body — physiology and amino acid as separate expandable cards */}
            {synthesis && (
              <>
                <ExpandCard
                  id="connections-physiology"
                  section="connections"
                  label="Body · Physiology"
                  title={synthesis.reference?.body_physiology ?? undefined}
                  text={synthesis.synthesis.body.physiology}
                  variant="light"
                />
                <ExpandCard
                  id="connections-amino-acid"
                  section="connections"
                  label="Body · Amino Acid"
                  title={synthesis.reference?.body_amino_acid ?? undefined}
                  text={synthesis.synthesis.body.amino_acid}
                  variant="light"
                />
              </>
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
                  <div className="flex-shrink-0">
                    <HexagramSVG upper={c.iching.upper_trigram.symbol} lower={c.iching.lower_trigram.symbol} color="#c9a05a" width={28} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-label text-[10px] uppercase tracking-[0.14em] text-wood-400 leading-none">← Prev</p>
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
            <span className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-400 mt-[3px]">All 64</span>
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
                  <p className="font-label text-[10px] uppercase tracking-[0.14em] text-wood-400 leading-none">Next →</p>
                  <p className="font-sans text-[11px] text-wood-700 leading-tight truncate mt-[3px]">{c?.card_name}</p>
                </div>
                {c && (
                  <div className="flex-shrink-0">
                    <HexagramSVG upper={c.iching.upper_trigram.symbol} lower={c.iching.lower_trigram.symbol} color="#c9a05a" width={28} />
                  </div>
                )}
              </Link>
            );
          })() : <div className="flex-1" />}

        </div>
      </div>
    </ExpandProvider>
  );
};

export default UniversalLanguageCard;
