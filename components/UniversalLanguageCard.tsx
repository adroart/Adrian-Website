
import React, { useEffect, useState, useRef, useContext, createContext, useCallback } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { getExpandedCard, type ExpandedGeneKeyLevel } from '../data/expandedOracleData';
import { getSynthesis } from '../data/synthesisData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import { OracleCardEntrance } from './OracleCardEntrance';
import SystemOverlay, { type SystemKey } from './SystemOverlay';
import { HEXAGRAM_CHINESE } from '../data/hexagramChinese';

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

// Dark-section card shadows (I Ching) - 1px white top edge simulates light source
const CARD_SHADOW      = 'shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.55)]';
const CARD_SHADOW_DEEP = 'shadow-[0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.7)]';
// Light-section card shadows (Gene Keys) - warm paper drop shadow
const CARD_SHADOW_LIGHT = 'shadow-[0_4px_16px_rgba(60,44,22,0.1),0_1px_3px_rgba(60,44,22,0.06)]';


/* ─── Trigram / hexagram SVG - pure vector, no Unicode emoji ─────────────── */

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

/* ─── Gene Keys dragonfly glyph ─────────────────────────────────────────── */
/* Heraldic dragonfly silhouette inspired by Japanese kamon "tombo" crests.
 * Top-down view: round head, tapering abdomen, two pairs of elongated
 * almond wings sweeping out from the thorax. Solid fill with currentColor.
 * Used as the Gene Keys hero on the section header and inside the overlay. */
const DragonflySVG: React.FC<{ width?: number; color?: string }> = ({
  width = 72,
  color = 'currentColor',
}) => (
  <svg
    width={width}
    height={width}
    viewBox="0 0 100 100"
    fill={color}
    aria-hidden="true"
  >
    {/* Head — small disc */}
    <circle cx="50" cy="14" r="4.4" />

    {/* Abdomen — long body tapering to a fine tail */}
    <path d="M 47.8 19 L 52.2 19 L 51.5 84 Q 50 87.5 48.5 84 Z" />

    {/* Forewings — upper pair, swept slightly up-and-out */}
    <ellipse cx="25" cy="28" rx="23" ry="4.2" transform="rotate(-4 25 28)" />
    <ellipse cx="75" cy="28" rx="23" ry="4.2" transform="rotate(4 75 28)" />

    {/* Hindwings — lower pair, slightly shorter, swept down-and-out */}
    <ellipse cx="28" cy="41" rx="20" ry="3.8" transform="rotate(7 28 41)" />
    <ellipse cx="72" cy="41" rx="20" ry="3.8" transform="rotate(-7 72 41)" />
  </svg>
);

/* ─── Human Design "Gate N" hero ────────────────────────────────────────── */
/* Display-serif treatment of the gate number. Used as the hero on the
 * Human Design section header and inside the Human Design system overlay. */
const GateHero: React.FC<{ gate: number; size?: 'sm' | 'lg' }> = ({ gate, size = 'sm' }) => {
  const numCls = size === 'lg'
    ? 'font-serif text-[64px] sm:text-[72px] leading-none tracking-[-0.01em]'
    : 'font-serif text-[44px] sm:text-[52px] leading-none tracking-[-0.01em]';
  const labelCls = size === 'lg'
    ? 'font-label text-[11px] uppercase tracking-[0.32em] mb-2'
    : 'font-label text-[10px] uppercase tracking-[0.32em] mb-1.5';
  return (
    <div className="flex flex-col items-center text-current">
      <span className={`${labelCls} opacity-70`}>Gate</span>
      <span className={numCls}>{gate}</span>
    </div>
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

  // Card image - sits 80px from top
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

  // Card name - scale down for long names
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

/* ─── Expand context - page-wide accordion registry ───────────────────────── */
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

/* ─── Bridge - expose the Expand context up to the parent component so the
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

/* ─── PlateExpand — museum-plate styled accordion row ────────────────────────
   Used by the four detail sections (I Ching, Gene Keys, Human Design,
   Connections). No card chrome, no rounded-2xl, no nested borders. Single
   hairline top border separates rows. 88px label column, serif body text,
   whole-row click target, + that rotates 45°. Variant 'dark' renders on
   stone-900 backgrounds; 'light' on paper. */

const PLATE_TYPE = {
  dark: {
    border:    'border-stone-700/60',
    rule:      'border-stone-700/40',
    label:     'text-stone-500',
    caption:   'text-stone-500',
    primary:   'text-stone-100',
    body:      'text-stone-300',
    bodyOpen:  'text-stone-200',
    chevron:   'text-stone-500',
    chevronOn: 'text-bronze-400',
    rowHover:  'hover:bg-white/[0.025]',
    rowFocus:  'focus-visible:bg-white/[0.04]',
    maskGrad:  'linear-gradient(to bottom, black 55%, transparent 100%)',
  },
  light: {
    border:    'border-wood-200/50',
    rule:      'border-wood-200/40',
    label:     'text-wood-500',
    caption:   'text-wood-400',
    primary:   'text-wood-900',
    body:      'text-wood-700',
    bodyOpen:  'text-wood-800',
    chevron:   'text-wood-400',
    chevronOn: 'text-bronze-600',
    rowHover:  'hover:bg-wood-500/[0.04]',
    rowFocus:  'focus-visible:bg-wood-500/[0.06]',
    maskGrad:  'linear-gradient(to bottom, black 55%, transparent 100%)',
  },
} as const;

const PlateExpand: React.FC<{
  id: string;
  section: SectionKey;
  variant: 'dark' | 'light';
  label: string;
  caption?: string;
  preview: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  meta?: React.ReactNode;
}> = ({ id, section, variant, label, caption, preview, children, defaultOpen = false, meta }) => {
  const ctx = useExpand();
  const open = ctx.isOpen(id, section, defaultOpen);
  useEffect(() => ctx.register({ id, section, defaultOpen }), [ctx, id, section, defaultOpen]);

  const t = PLATE_TYPE[variant];

  const previewNode = typeof preview === 'string'
    ? <p className={`font-serif text-[14px] ${t.body} leading-[1.55] sm:leading-[1.6]`}>{preview}</p>
    : preview;

  return (
    <div
      id={id}
      className={`scroll-mt-24 border-t ${t.border} -mx-4 sm:-mx-7`}
    >
      <button
        type="button"
        onClick={() => ctx.toggle(id)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className={`group block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 sm:items-start w-full text-left py-5 sm:py-6 px-4 sm:px-7 transition-colors focus-visible:outline-none ${open ? '' : t.rowHover} ${t.rowFocus}`}
      >
        <div className="flex items-start justify-between gap-3 sm:block sm:self-start sm:pt-1 mb-3 sm:mb-0">
          <div className="min-w-0">
            <p className={`font-label text-[10px] uppercase tracking-[0.22em] ${t.label}`}>{label}</p>
            <div className={`mt-1 h-px ${ctx.reducedMotion ? '!transition-none' : 'transition-[width,background-color] duration-300 ease-out'} ${open ? 'w-full bg-bronze-500' : 'w-0 bg-bronze-500/40 group-hover:w-8 group-hover:bg-bronze-500/80'}`} aria-hidden="true" />
            {caption && <p className={`font-sans text-[14px] sm:text-[15px] ${t.caption} mt-1.5 leading-[1.45]`}>{caption}</p>}
          </div>
        </div>
        <div className="min-w-0">
          {!open && (
            <div
              className="max-h-[7.4em] overflow-hidden"
              style={{ WebkitMaskImage: t.maskGrad, maskImage: t.maskGrad }}
            >{previewNode}</div>
          )}
          {open && meta}
        </div>
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 pb-6 sm:pb-7 px-4 sm:px-7"
          style={!ctx.reducedMotion ? { animation: 'plate-expand 200ms ease-out' } : undefined}
        >
          <div className="hidden sm:block" />
          <div className="min-w-0 space-y-4 select-text cursor-text">{children}</div>
        </div>
      )}
    </div>
  );
};

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

/* ─── Gene Key level - floating island with tone-specific personality ─────── */

type GeneKeyTone = 'shadow' | 'gift' | 'siddhi';

/* Plate-style tone palette — light section, paper backgrounds.
   Tone is encoded purely through the label color (museum plate aesthetic).
   Body and primary use the wood scale uniformly so the section reads as
   one editorial composition rather than three competing cards. */

const PLATE_TONE: Record<GeneKeyTone, {
  label:      string;
  labelColor: string;
  primaryColor: string;
}> = {
  shadow: { label: 'Shadow', labelColor: 'text-stone-500',  primaryColor: 'text-wood-800' },
  gift:   { label: 'Gift',   labelColor: 'text-bronze-600', primaryColor: 'text-wood-900' },
  siddhi: { label: 'Siddhi', labelColor: 'text-wood-500',   primaryColor: 'text-wood-900' },
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

  const t = PLATE_TONE[tone];
  const paragraphs = (open ? level.expanded.text : level.collapsed.text).split('\n\n').filter(Boolean);

  return (
    <div
      id={id}
      className="scroll-mt-24 border-t border-wood-200/50 -mx-4 sm:-mx-7"
    >
      <button
        type="button"
        onClick={() => ctx.toggle(id)}
        aria-expanded={open}
        className={`group block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 sm:items-start w-full text-left py-5 sm:py-6 px-4 sm:px-7 transition-colors focus-visible:outline-none focus-visible:bg-wood-500/[0.06] ${open ? '' : 'hover:bg-wood-500/[0.04]'}`}
      >
        <div className="flex items-start justify-between gap-3 sm:block sm:self-start sm:pt-1 mb-3 sm:mb-0">
          <div className="min-w-0">
            <p className={`font-label text-[10px] uppercase tracking-[0.22em] ${t.labelColor}`}>{t.label}</p>
            <div className={`mt-1 h-px ${ctx.reducedMotion ? '!transition-none' : 'transition-[width,background-color] duration-300 ease-out'} ${open ? 'w-full bg-bronze-500' : 'w-0 bg-bronze-500/40 group-hover:w-8 group-hover:bg-bronze-500/80'}`} aria-hidden="true" />
            <p className="font-sans text-[14px] sm:text-[15px] text-wood-500 mt-1.5 leading-[1.45]">{level.contemplation_title}</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className={`font-serif text-[17px] ${t.primaryColor} leading-[1.3] tracking-[-0.005em] mb-2`}>{level.name}</p>
          {!open && (
            <div
              className="max-h-[7.4em] overflow-hidden"
              style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)' }}
            >
              <p className="font-sans text-[15px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{paragraphs[0]}</p>
            </div>
          )}
        </div>
      </button>
      {open && (
        <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 pb-6 sm:pb-7 px-4 sm:px-7" style={!ctx.reducedMotion ? { animation: 'plate-expand 200ms ease-out' } : undefined}>
          <div className="hidden sm:block" />
          <div className="min-w-0 space-y-4 select-text cursor-text">
            {paragraphs.map((p, i) => (
              <p key={i} className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{p}</p>
            ))}
            {tone === 'shadow' && (level.repressive_nature || level.reactive_nature) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 pt-5 border-t border-wood-200/40 mt-2">
                {level.repressive_nature && (
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-2">
                      Repressive · {level.repressive_nature.label}
                    </p>
                    <p className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{level.repressive_nature.description}</p>
                  </div>
                )}
                {level.reactive_nature && (
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-2">
                      Reactive · {level.reactive_nature.label}
                    </p>
                    <p className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{level.reactive_nature.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* Synthesis tone plate — plain-string variant with optional extras.
   Same museum-plate composition as GeneKeyCard. */

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
  const t = PLATE_TONE[tone];
  const paragraphs = text.split('\n\n').filter(Boolean);
  const previewPara = paragraphs[0] ?? '';

  return (
    <div
      id={id}
      className="scroll-mt-24 border-t border-wood-200/50 -mx-4 sm:-mx-7"
    >
      <button
        type="button"
        onClick={() => ctx.toggle(id)}
        aria-expanded={open}
        className={`group block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 sm:items-start w-full text-left py-5 sm:py-6 px-4 sm:px-7 transition-colors focus-visible:outline-none focus-visible:bg-wood-500/[0.06] ${open ? '' : 'hover:bg-wood-500/[0.04]'}`}
      >
        <div className="flex items-start justify-between gap-3 sm:block sm:self-start sm:pt-1 mb-3 sm:mb-0">
          <div className="min-w-0">
            <p className={`font-label text-[10px] uppercase tracking-[0.22em] ${t.labelColor}`}>{t.label}</p>
            <div className={`mt-1 h-px ${ctx.reducedMotion ? '!transition-none' : 'transition-[width,background-color] duration-300 ease-out'} ${open ? 'w-full bg-bronze-500' : 'w-0 bg-bronze-500/40 group-hover:w-8 group-hover:bg-bronze-500/80'}`} aria-hidden="true" />
          </div>
        </div>
        <div className="min-w-0">
          <p className={`font-serif text-[17px] ${t.primaryColor} leading-[1.3] tracking-[-0.005em] mb-2`}>{name}</p>
          {!open && (
            <div
              className="max-h-[7.4em] overflow-hidden"
              style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)' }}
            >
              <p className="font-serif text-[14px] text-wood-700 leading-[1.55] sm:leading-[1.6]">{previewPara}</p>
            </div>
          )}
        </div>
      </button>
      {open && (
        <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 pb-6 sm:pb-7 px-4 sm:px-7" style={!ctx.reducedMotion ? { animation: 'plate-expand 200ms ease-out' } : undefined}>
          <div className="hidden sm:block" />
          <div className="min-w-0 space-y-4 select-text cursor-text">
            {paragraphs.map((p, i) => (
              <p key={i} className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{p}</p>
            ))}
            {extras.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 pt-5 border-t border-wood-200/40 mt-2">
                {extras.map((ex, i) => (
                  <div key={i}>
                    <p className={`font-label text-[10px] uppercase tracking-[0.22em] ${t.labelColor} mb-2`}>{ex.label}</p>
                    {ex.text.split('\n\n').filter(Boolean).map((p, j) => (
                      <p key={j} className={`font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65] ${j > 0 ? 'mt-2' : ''}`}>{p}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Generic expandable card - full-card-click, matches Gene Keys UX ────── */

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
      className="group w-full flex items-center gap-4 py-3 text-left transition-colors hover:bg-wood-500/[0.04] focus-visible:outline-none focus-visible:bg-wood-500/[0.06]"
    >
      <img
        src={cardImageUrl(number, 120)}
        alt=""
        className="w-14 h-14 object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
      />
      <div className="flex-1 min-w-0">
        {label && <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mb-1">{label}</p>}
        <p className="font-serif text-[17px] text-wood-900 leading-[1.3] tracking-[-0.005em] group-hover:text-bronze-700 transition-colors">{sibling.card_name}</p>
        <p className="font-serif text-[14px] text-wood-600 leading-[1.55] sm:leading-[1.6] mt-0.5">{sibling.iching.hexagram_name}</p>
        {context && <p className="font-serif text-[14px] text-wood-500 mt-1 leading-[1.55] sm:leading-[1.6] line-clamp-2">{context}</p>}
      </div>
      <span className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-400 group-hover:text-bronze-600 transition-colors flex-shrink-0">Open</span>
    </button>
  );
};

/* ─── Keyword row - dots only between words on the same visual line ──────── */

const KeywordRow: React.FC<{ kws: string[]; onClick: () => void }> = ({ kws, onClick }) => {
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  // Default all dots visible - hidden after first measurement where needed
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
  const [systemOverlay, setSystemOverlay] = useState<SystemKey | null>(null);

  // Ritual entrance plays on every landing, including QR scans — the visitor
  // taps to begin the reading rather than having it auto-load.
  const [showIndexEntrance, setShowIndexEntrance] = useState(true);
  // Bridge - lets `go()` and the deep-link effect reach into the Expand
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
  // Instagram is instant - no visible loading delay.
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
      // Desktop or unsupported - fall back to download
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
      // ignore - nothing to fall back to without a URL
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
  const imageAlt = `${card.card_name}, Universal Language ${card.number}. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`;

  const ichingHighlight = expanded?.i_ching?.reflection?.text ?? card.iching.essence;

  return (
    <ExpandProvider storageKey={`ul-card-${cardNum}`}>
      <ExpandBridge bind={ctx => { expandRef.current = ctx; }} />
      {showIndexEntrance && <OracleCardEntrance card={card} onDone={() => setShowIndexEntrance(false)} />}
      {lightboxOpen      && <Lightbox src={cardImageUrl(card.number, 1200)} alt={imageAlt} onClose={() => setLightboxOpen(false)} />}
      <SystemOverlay
        open={systemOverlay !== null}
        systemKey={systemOverlay ?? 'iching'}
        glyph={
          systemOverlay === 'genekeys' ? (
            <DragonflySVG width={132} color="currentColor" />
          ) : systemOverlay === 'humandesign' ? (
            <GateHero gate={card.human_design.gate} size="lg" />
          ) : (
            <HexagramSVG
              upper={card.iching.upper_trigram.symbol}
              lower={card.iching.lower_trigram.symbol}
              color="currentColor"
              width={132}
            />
          )
        }
        onClose={() => setSystemOverlay(null)}
      />


      {/* ── Single scrolling page - four color-blocked sections ──────────── */}
      {/* Top padding follows the live nav height (Navigation.tsx writes
          --nav-height on every resize/scroll change) so the first pixel of
          the card image is never tucked under the fixed nav. The +12px buffer
          is intentional breathing room. */}
      <div className="pb-14" style={{ paddingTop: 'calc(var(--nav-height, 56px) + 12px)' }}>

        {/* ════════════ FIELD ════════════════════════════════════════════ */}
        <section id="field" className={`${SCREEN_BG.field} scroll-mt-16`}>

          {/* Image - full-bleed on mobile, contained on desktop */}
          <div className="md:max-w-2xl md:mx-auto">
            <figure
              className="w-full aspect-square cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              role="button" tabIndex={0} aria-label="Enlarge image"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true); } }}
            >
              <img src={cardImageUrl(card.number, 900)} alt={imageAlt} className="w-full h-full object-cover" loading="eager" />
            </figure>

            {/* Order + Share - two-up row directly below image */}
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

              {/* Share sheet - expands below */}
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

                    {/* Instagram Stories - opens native share sheet with image on mobile,
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
            {/* Title block - card container */}
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


            {/* Reference strip - museum specimen plate.
                Five systems as peers, each a facet of one energy.
                No per-row containers; hairline dividers. Hover underline
                communicates interactivity without arrows on every row.
                Label column fixed so values align vertically. */}
            {synthesis?.reference && (() => {
              // Codon ring siblings (other cards that share this card's ring
              // via the tarot arcana). These ARE the ring relationship shown
              // in the Tarot row.
              const siblingNums = (card.codon_ring_siblings ?? []).filter(n => n !== card.number);
              const siblingCards = siblingNums
                .map(n => CARD_BY_NUMBER.get(n))
                .filter((c): c is NonNullable<typeof c> => !!c);

              // Pair partner: the I Ching / Gene Keys structural pair
              // (hexagram 1↔2, 3↔50, etc.). Same relationship, named in each
              // system's own vocabulary.
              const pairNum = synthesis.reference.programming_partner;
              const pair = typeof pairNum === 'number' ? CARD_BY_NUMBER.get(pairNum) : undefined;

              // Row is a clickable div (role="button") whose click navigates
              // to the section. Partner/sibling Links inside use stopPropagation
              // so they open the linked card instead of bubbling to the row.
              const rowCls = 'group grid grid-cols-[88px_1fr] gap-x-5 px-3 -mx-3 py-4 border-t border-wood-200/50 w-full rounded-md cursor-pointer hover:bg-bronze-500/[0.05] focus-visible:outline-none focus-visible:bg-bronze-500/[0.08] focus-visible:ring-1 focus-visible:ring-bronze-400/40 transition-colors';
              const labelCls = 'font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 self-center';
              const primaryCls = 'font-serif text-[17px] text-wood-900 leading-[1.3] tracking-[-0.005em] decoration-bronze-400/40 decoration-1 underline-offset-[5px] group-hover:underline group-focus-visible:underline';
              const contextCls = 'font-serif text-[14px] text-wood-600 leading-[1.5] mt-1.5';
              const contextEmphCls = 'font-serif text-[14px] text-wood-700';
              const partnerLinkCls = 'font-serif text-[14px] text-wood-700 underline decoration-bronze-400/50 decoration-1 underline-offset-[3px] hover:text-bronze-700 hover:decoration-bronze-500 focus-visible:outline-none focus-visible:text-bronze-700 focus-visible:decoration-bronze-500 transition-colors';
              // Keyboard handler for role="button" divs
              const keyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
              };
              // Stop partner link clicks from bubbling to the row
              const stop = (e: React.MouseEvent) => e.stopPropagation();

              return (
                <div className="mt-10 mb-6 max-w-md mx-auto">
                  <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-400 mb-3 pb-3 border-b border-wood-200/50">
                    This energy, seen through
                  </p>

                  {/* I Ching - whole row clicks scroll to the I Ching section.
                      Paired hexagram link stops propagation to open that card. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => go('iching')}
                    onKeyDown={keyActivate(() => go('iching'))}
                    className={rowCls}
                    aria-label={`Go to I Ching reading for ${card.iching.hexagram_name}`}
                  >
                    <span className={labelCls}>I Ching</span>
                    <div className="min-w-0">
                      <span className={primaryCls}>{card.iching.hexagram_name}</span>
                      <p className={contextCls}>
                        Hexagram {card.number} · {card.iching.upper_trigram.name} over {card.iching.lower_trigram.name}
                        {pair && (
                          <> · paired with{' '}
                            <Link
                              to={`/oracle/universal-language/${pair.number}`}
                              state={{ ritual: true }}
                              onClick={stop}
                              className={partnerLinkCls}
                              aria-label={`Open Code ${pair.number}, ${pair.card_name}`}
                            >
                              Hexagram {pair.number} · {pair.iching.hexagram_name}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Gene Keys - whole row scrolls to the Gene Keys section. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => go('genekeys')}
                    onKeyDown={keyActivate(() => go('genekeys'))}
                    className={rowCls}
                    aria-label={`Go to Gene Keys reading: Shadow ${card.gene_keys.shadow}, Gift ${card.gene_keys.gift}, Siddhi ${card.gene_keys.siddhi}`}
                  >
                    <span className={labelCls}>Gene Keys</span>
                    <div className="min-w-0">
                      <span className="inline-flex items-baseline flex-wrap gap-x-2 gap-y-1">
                        <span className="font-serif text-[17px] text-wood-700 leading-[1.3] tracking-[-0.005em] decoration-bronze-400/40 decoration-1 underline-offset-[5px] group-hover:underline group-focus-visible:underline">{card.gene_keys.shadow}</span>
                        <span className="text-wood-300" aria-hidden="true">·</span>
                        <span className="font-serif text-[17px] text-bronze-700 leading-[1.3] tracking-[-0.005em] font-medium decoration-bronze-500/60 decoration-1 underline-offset-[5px] group-hover:underline group-focus-visible:underline">{card.gene_keys.gift}</span>
                        <span className="text-wood-300" aria-hidden="true">·</span>
                        <span className="font-serif text-[17px] text-wood-700 leading-[1.3] tracking-[-0.005em] decoration-bronze-400/40 decoration-1 underline-offset-[5px] group-hover:underline group-focus-visible:underline">{card.gene_keys.siddhi}</span>
                      </span>
                      <p className={contextCls}>
                        Shadow, Gift, Siddhi · three frequencies of one theme
                      </p>
                    </div>
                  </div>

                  {/* Human Design */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => go('humandesign')}
                    onKeyDown={keyActivate(() => go('humandesign'))}
                    className={rowCls}
                    aria-label={`Go to Human Design reading: ${synthesis.reference.hd_center} Center`}
                  >
                    <span className={labelCls}>Human Design</span>
                    <div className="min-w-0">
                      <span className={primaryCls}>{synthesis.reference.hd_center} Center</span>
                      <p className={contextCls}>
                        Gate {synthesis.reference.hd_gate} · {synthesis.reference.hd_circuit} · paired with {synthesis.reference.hd_harmonic_gate}
                      </p>
                    </div>
                  </div>

                  {/* Tarot - arcana = ring. Sibling links open those cards. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => go('connections')}
                    onKeyDown={keyActivate(() => go('connections'))}
                    className={rowCls}
                    aria-label={`Go to Tarot reading: ${synthesis.reference.tarot_card}, ${card.ring_name}`}
                  >
                    <span className={labelCls}>Tarot</span>
                    <div className="min-w-0">
                      <span className={primaryCls}>{synthesis.reference.tarot_card}</span>
                      <p className={contextCls}>
                        {card.ring_name}
                        {siblingCards.length > 0 && (
                          siblingCards.length <= 3
                            ? <>, with {siblingCards.map((c, i) => (
                                <React.Fragment key={c.number}>
                                  {i > 0 && (i === siblingCards.length - 1 ? ' and ' : ', ')}
                                  <Link
                                    to={`/oracle/universal-language/${c.number}`}
                                    state={{ ritual: true }}
                                    onClick={stop}
                                    className={partnerLinkCls}
                                    aria-label={`Open Code ${c.number}, ${c.card_name}`}
                                  >
                                    Code {c.number} · {c.card_name}
                                  </Link>
                                </React.Fragment>
                              ))}</>
                            : <>, shared with {siblingCards.length} other keys</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Body - physiology + amino acid */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => go('connections')}
                    onKeyDown={keyActivate(() => go('connections'))}
                    className={rowCls + ' border-b border-wood-200/50'}
                    aria-label={`Go to Body reading: ${synthesis.reference.body_physiology}`}
                  >
                    <span className={labelCls}>Body</span>
                    <div className="min-w-0">
                      <span className={primaryCls}>{synthesis.reference.body_physiology}</span>
                      {synthesis.reference.body_amino_acid && (
                        <p className={contextCls}>
                          Amino acid · <span className={contextEmphCls}>{synthesis.reference.body_amino_acid}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}




            {/* Island 3 - Creator voice (conditional) */}
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
          <div className="max-w-2xl mx-auto px-4 sm:px-7 pt-12 sm:pt-16 pb-16 sm:pb-20">

            {/* Plate header — hexagram glyph is the trigger to the system overlay */}
            <header className="mb-10 sm:mb-12 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => setSystemOverlay('iching')}
                className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-8 focus-visible:ring-offset-stone-900 rounded-sm"
                aria-label="About the I Ching"
              >
                <span
                  className="font-chinese-serif text-[64px] sm:text-[72px] leading-none text-bronze-400/85 group-hover:text-bronze-300 transition-colors mb-5 sm:mb-6"
                  title={HEXAGRAM_CHINESE[card.number]?.pinyin}
                >
                  {HEXAGRAM_CHINESE[card.number]?.char ?? card.number}
                </span>
                <p className="font-label text-[11px] uppercase tracking-[0.32em] text-bronze-400/90 group-hover:text-bronze-300 transition-colors pb-1.5 border-b border-bronze-500/30 group-hover:border-bronze-400/60">
                  I Ching
                </p>
              </button>
            </header>

            {/* Interactive hexagram + trigram selector — open hairline rows, no card */}
            <div ref={ichingRef} className="border-t border-stone-700/60 -mx-4 sm:-mx-7">
              {/* HEX row — matches the UPPER/LOWER format below but taller:
                    label · hexagram glyph · name + formula (two lines) · meta */}
              <button
                type="button"
                onClick={() => setIchingOpen('hex')}
                className={`group flex sm:grid sm:grid-cols-[88px_1fr_auto] sm:gap-x-5 items-center gap-3 w-full text-left py-5 sm:py-6 px-4 sm:px-7 border-b border-stone-700/60 transition-colors focus-visible:outline-none focus-visible:bg-bronze-500/[0.08] ${ichingOpen === 'hex' ? 'bg-bronze-500/[0.06]' : 'hover:bg-white/[0.025]'}`}
                aria-pressed={ichingOpen === 'hex'}
                aria-label={`Read ${card.iching.hexagram_name}, ${card.iching.upper_trigram.name} over ${card.iching.lower_trigram.name}`}
              >
                <span className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 sm:self-center flex-shrink-0">Guà {card.number}</span>
                <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-4">
                  <HexagramSVG
                    upper={card.iching.upper_trigram.symbol}
                    lower={card.iching.lower_trigram.symbol}
                    color={ichingOpen === 'hex' ? 'rgba(201,160,90,0.95)' : 'rgba(180,130,70,0.55)'}
                    width={32}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className={`font-serif text-[18px] leading-[1.25] tracking-[-0.005em] truncate transition-colors ${ichingOpen === 'hex' ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'}`}>
                      {card.iching.hexagram_name}
                    </span>
                    <span className={`font-serif text-[14px] leading-[1.35] mt-0.5 truncate transition-colors ${ichingOpen === 'hex' ? 'text-stone-400' : 'text-stone-500 group-hover:text-stone-400'}`}>
                      {card.iching.upper_trigram.name.replace(/\s*\([^)]*\)\s*/g, '').trim()} over {card.iching.lower_trigram.name.replace(/\s*\([^)]*\)\s*/g, '').trim()}
                    </span>
                  </div>
                </div>
                <span className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 sm:self-center flex-shrink-0">Hexagram</span>
              </button>

              <button
                type="button"
                onClick={() => setIchingOpen('upper')}
                className={`group flex sm:grid sm:grid-cols-[88px_1fr_auto] sm:gap-x-5 items-center gap-3 w-full text-left py-3.5 sm:py-4 px-4 sm:px-7 border-b border-stone-700/60 transition-colors focus-visible:outline-none focus-visible:bg-bronze-500/[0.08] ${ichingOpen === 'upper' ? 'bg-bronze-500/[0.06]' : 'hover:bg-white/[0.025]'}`}
                aria-pressed={ichingOpen === 'upper'}
              >
                <span className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 sm:self-center flex-shrink-0">Upper</span>
                <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-4">
                  <TrigramSVG symbol={card.iching.upper_trigram.symbol} color={ichingOpen === 'upper' ? '#c9a05a' : '#6b5a40'} width={24} height={16} />
                  <span className={`font-serif text-[17px] leading-[1.3] truncate transition-colors ${ichingOpen === 'upper' ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'}`}>{card.iching.upper_trigram.name}</span>
                </div>
                <span className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 flex-shrink-0">Trigram</span>
              </button>

              <button
                type="button"
                onClick={() => setIchingOpen('lower')}
                className={`group flex sm:grid sm:grid-cols-[88px_1fr_auto] sm:gap-x-5 items-center gap-3 w-full text-left py-3.5 sm:py-4 px-4 sm:px-7 border-b border-stone-700/60 transition-colors focus-visible:outline-none focus-visible:bg-bronze-500/[0.08] ${ichingOpen === 'lower' ? 'bg-bronze-500/[0.06]' : 'hover:bg-white/[0.025]'}`}
                aria-pressed={ichingOpen === 'lower'}
              >
                <span className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 sm:self-center flex-shrink-0">Lower</span>
                <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-4">
                  <TrigramSVG symbol={card.iching.lower_trigram.symbol} color={ichingOpen === 'lower' ? '#c9a05a' : '#6b5a40'} width={24} height={16} />
                  <span className={`font-serif text-[17px] leading-[1.3] truncate transition-colors ${ichingOpen === 'lower' ? 'text-stone-100' : 'text-stone-300 group-hover:text-stone-100'}`}>{card.iching.lower_trigram.name}</span>
                </div>
                <span className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 flex-shrink-0">Trigram</span>
              </button>

              {/* Reading zone — updates on tap */}
              <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 py-6 sm:py-7 px-4 sm:px-7 border-b border-stone-700/60">
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-bronze-400/80 sm:self-start sm:pt-1 mb-2 sm:mb-0">
                  {ichingOpen === 'hex'
                    ? 'Combination'
                    : ichingOpen === 'upper'
                    ? 'Upper nature'
                    : 'Lower nature'}
                </p>
                <p className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">
                  {ichingOpen === 'hex'
                    ? (synthesis?.synthesis.iching.trigram_combination ?? card.iching.essence)
                    : ichingOpen === 'upper'
                    ? card.iching.upper_trigram.nature
                    : card.iching.lower_trigram.nature}
                </p>
              </div>
            </div>

            {/* Synthesis: reading + classical text */}
            {synthesis && (
              <>
                <PlateExpand
                  id="iching-reading"
                  section="iching"
                  variant="dark"
                  label="The reading"
                  caption="for this configuration"
                  preview={synthesis.synthesis.iching.reading.split('\n\n').filter(Boolean)[0] ?? ''}
                >
                  {synthesis.synthesis.iching.reading.split('\n\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{p}</p>
                  ))}
                </PlateExpand>

                {(synthesis.synthesis.iching.judgement_lines.length > 0 || synthesis.synthesis.iching.image_lines.length > 0) && (
                  <PlateExpand
                    id="iching-classical"
                    section="iching"
                    variant="dark"
                    label="Classical text"
                    caption="Wilhelm translation"
                    preview={synthesis.synthesis.iching.judgement_lines[0] ?? synthesis.synthesis.iching.image_lines[0] ?? ''}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
                      {synthesis.synthesis.iching.judgement_lines.length > 0 && (
                        <div>
                          <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500">The Judgement</p>
                          <p className="font-sans text-[14px] sm:text-[15px] text-stone-500 leading-[1.45] mt-1 mb-3">the oracle's reading of this moment</p>
                          <div className="space-y-2">
                            {synthesis.synthesis.iching.judgement_lines.map((line, i) => (
                              <p key={i} className="font-sans text-[15px] text-stone-200 leading-[1.65] sm:leading-[1.7]">{line}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {synthesis.synthesis.iching.image_lines.length > 0 && (
                        <div>
                          <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500">The Image</p>
                          <p className="font-sans text-[14px] sm:text-[15px] text-stone-500 leading-[1.45] mt-1 mb-3">a picture from nature that mirrors the energy</p>
                          <div className="space-y-2">
                            {synthesis.synthesis.iching.image_lines.map((line, i) => (
                              <p key={i} className="font-sans text-[15px] text-stone-200 leading-[1.65] sm:leading-[1.7]">{line}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </PlateExpand>
                )}
              </>
            )}

            {/* Wisdom group (only when no synthesis) */}
            {!synthesis && expanded && (
              <>
                <PlateExpand
                  id="iching-overview"
                  section="iching"
                  variant="dark"
                  defaultOpen
                  label="Overview"
                  preview={expanded.i_ching.trigrams.overview.text}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-2">Outer</p>
                      <p className="font-sans text-[16px] text-stone-200 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.trigrams.outer.context.text}</p>
                    </div>
                    <div>
                      <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-2">Inner</p>
                      <p className="font-sans text-[16px] text-stone-200 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.trigrams.inner.context.text}</p>
                    </div>
                  </div>
                  <p className="font-sans text-[16px] text-stone-200 leading-[1.65] sm:leading-[1.7] mt-2">
                    {expanded.i_ching.trigrams.family_dynamic.text}
                  </p>
                </PlateExpand>

                <PlateExpand
                  id="iching-judgment"
                  section="iching"
                  variant="dark"
                  label="The Judgement"
                  caption="the oracle's reading of this moment"
                  preview={expanded.i_ching.image_of_the_situation.text.split('\n').filter(Boolean)[0] ?? ''}
                >
                  {(() => {
                    const lines = expanded.i_ching.image_of_the_situation.text.split('\n').filter(Boolean);
                    const headline = lines[0];
                    const stages = lines[1]?.replace(/\.$/, '').split(',').map(s => s.trim()).filter(Boolean) ?? [];
                    return (
                      <>
                        {headline && <p className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{headline}</p>}
                        {stages.length > 0 && (
                          <div>
                            <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-3">Four stages of the time cycle</p>
                            <div className="flex gap-x-6 gap-y-1 flex-wrap">
                              {stages.map((s, i) => (
                                <span key={i} className="font-serif text-[17px] text-stone-300">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="font-sans text-[16px] text-stone-200 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.image_of_the_situation.fields_of_meaning}</p>
                        <div className="pt-5 border-t border-stone-700/40 space-y-2">
                          {expanded.i_ching.image_tradition.text.split('\n').filter(Boolean).map((line, i) => (
                            <p key={i} className="font-sans text-[15px] text-stone-300 leading-[1.65]">{line}</p>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </PlateExpand>

                <PlateExpand
                  id="iching-patterns"
                  section="iching"
                  variant="dark"
                  label="Patterns of Wisdom"
                  preview={expanded.i_ching.patterns_of_wisdom.nature_image}
                >
                  <p className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.patterns_of_wisdom.nature_image}</p>
                  <p className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.patterns_of_wisdom.guidance}</p>
                  <p className="font-sans text-[16px] text-stone-200 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.patterns_of_wisdom.context.text}</p>
                </PlateExpand>
              </>
            )}

            {/* Reflection (only when no synthesis) */}
            {!synthesis && expanded && (
              <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-bronze-700/40 py-6 sm:py-7 mt-2">
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-bronze-400 sm:self-start sm:pt-1 mb-2 sm:mb-0">Reflection</p>
                <p className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{expanded.i_ching.reflection.text}</p>
              </div>
            )}

            {/* Fallback if no expanded data */}
            {!expanded && (
              <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-stone-700/60 py-6 sm:py-7">
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-stone-500 sm:self-start sm:pt-1 mb-2 sm:mb-0">Essence</p>
                <p className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{card.iching.essence}</p>
              </div>
            )}

          </div>
        </section>

        {/* ════════════ GENE KEYS + CONNECTIONS ════════════════════════ */}
        <section id="genekeys" className={`${SCREEN_BG.genekeys} scroll-mt-16`}>
          <div className="max-w-2xl mx-auto px-4 sm:px-7 pt-12 sm:pt-16 pb-16 sm:pb-20">

            {/* Plate header — hexagram glyph is the trigger to the system overlay */}
            <header className="mb-10 sm:mb-12 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => setSystemOverlay('genekeys')}
                className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-600/50 focus-visible:ring-offset-8 focus-visible:ring-offset-stone-50 rounded-sm"
                aria-label="About the Gene Keys"
              >
                <div className="text-bronze-700/80 group-hover:text-bronze-700 transition-colors mb-5">
                  <DragonflySVG width={72} color="currentColor" />
                </div>
                <p className="font-label text-[11px] uppercase tracking-[0.32em] text-bronze-700/85 group-hover:text-bronze-700 transition-colors pb-1.5 border-b border-bronze-600/30 group-hover:border-bronze-600/60">
                  Gene Keys
                </p>
              </button>
              <h2 className="font-serif text-[28px] sm:text-[32px] leading-[1.1] sm:leading-[1.15] text-wood-900 tracking-[-0.005em] mt-7 sm:mt-8">{card.gene_keys.gift} Key - {card.number}</h2>
              <div className="flex items-baseline justify-center gap-3 flex-wrap mt-5">
                <span className="font-serif text-[14px] text-stone-500">{card.gene_keys.shadow}</span>
                <span className="text-wood-300" aria-hidden="true">·</span>
                <span className="font-serif text-[14px] text-bronze-700">{card.gene_keys.gift}</span>
                <span className="text-wood-300" aria-hidden="true">·</span>
                <span className="font-serif text-[14px] text-wood-700">{card.gene_keys.siddhi}</span>
              </div>
            </header>

            {/* Three tone plates (Shadow / Gift / Siddhi). Gift opens by default
                as the primary reading; Repressive/Reactive/Programming Partner
                are tucked inside their parent tone. */}
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
              </>
            ) : expanded ? (
              <>
                <GeneKeyCard tone="shadow" level={expanded.gene_keys.shadow} id="genekey-shadow" />
                <GeneKeyCard tone="gift"   level={expanded.gene_keys.gift}   id="genekey-gift" />
                <GeneKeyCard tone="siddhi" level={expanded.gene_keys.siddhi} id="genekey-siddhi" />
              </>
            ) : (
              <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-wood-200/50 py-6 sm:py-7">
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 sm:self-start sm:pt-1 mb-3 sm:mb-0">Description</p>
                <div className="space-y-4">
                  {card.gene_keys.description.split('\n\n').filter(Boolean).map((p, i) => (
                    <p key={i} className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{p}</p>
                  ))}
                </div>
              </div>
            )}

            {(synthesis || expanded) && (
              <p className="font-serif text-[14px] text-wood-500 italic leading-[1.5] mt-10 pt-7 border-t border-wood-200/50">
                Gene Keys text based on the work of Richard Rudd. Visit him to dive deeper at{' '}
                <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" className="underline decoration-wood-300 underline-offset-[3px] hover:text-bronze-700 hover:decoration-bronze-500 transition-colors">genekeys.com</a>.
              </p>
            )}

          </div>
        </section>

        {/* ════════════ HUMAN DESIGN ════════════════════════════════════ */}
        {/* dark-preserve: intentionally-dark section stays dark in dark mode. */}
        <section id="humandesign" className={`${SCREEN_BG.humandesign} scroll-mt-16 dark-preserve`}>
          <div className="max-w-2xl mx-auto px-4 sm:px-7 pt-12 sm:pt-16 pb-16 sm:pb-20">

            {/* Plate header — hexagram glyph is the trigger to the system overlay */}
            <header className="mb-10 sm:mb-12 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => setSystemOverlay('humandesign')}
                className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50 focus-visible:ring-offset-8 focus-visible:ring-offset-stone-900 rounded-sm"
                aria-label={`About Human Design, Gate ${card.human_design.gate}`}
              >
                <div className="text-bronze-400/95 group-hover:text-bronze-300 transition-colors mb-5">
                  <GateHero gate={card.human_design.gate} size="sm" />
                </div>
                <p className="font-label text-[11px] uppercase tracking-[0.32em] text-bronze-400/90 group-hover:text-bronze-300 transition-colors pb-1.5 border-b border-bronze-500/30 group-hover:border-bronze-400/60">
                  Human Design
                </p>
              </button>
              <h2 className="font-serif text-[28px] sm:text-[32px] leading-[1.1] sm:leading-[1.15] text-stone-100 tracking-[-0.005em] mt-7 sm:mt-8">{card.human_design.keyword}</h2>
            </header>

            {/* Description (only when no synthesis) */}
            {!synthesis && (() => {
              const text = card.human_design.description + (card.traditional_colors ? '\n\n' + card.traditional_colors : '');
              const paragraphs = text.split('\n\n').filter(Boolean);
              return (
                <PlateExpand
                  id="hd-description"
                  section="humandesign"
                  variant="dark"
                  label="Description"
                  caption={card.human_design.keyword}
                  preview={paragraphs[0] ?? ''}
                >
                  {paragraphs.map((p, i) => (
                    <p key={i} className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{p}</p>
                  ))}
                </PlateExpand>
              );
            })()}

            {/* Synthesis HD reading — three plates (Gate / Channel / Circuit) */}
            {synthesis && (
              <>
                {(() => {
                  const paragraphs = synthesis.synthesis.human_design.gate.split('\n\n').filter(Boolean);
                  return (
                    <PlateExpand
                      id="hd-gate"
                      section="humandesign"
                      variant="dark"
                      label="The Gate"
                      caption={synthesis.reference?.hd_keyword ?? card.human_design.keyword}
                      preview={paragraphs[0] ?? ''}
                    >
                      {paragraphs.map((p, i) => (
                        <p key={i} className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{p}</p>
                      ))}
                    </PlateExpand>
                  );
                })()}
                {(() => {
                  const paragraphs = synthesis.synthesis.human_design.channel.split('\n\n').filter(Boolean);
                  const cap = synthesis.reference?.hd_harmonic_gate ? `Gate ${card.human_design.gate} · ${synthesis.reference.hd_harmonic_gate}` : undefined;
                  return (
                    <PlateExpand
                      id="hd-channel"
                      section="humandesign"
                      variant="dark"
                      label="The Channel"
                      caption={cap}
                      preview={paragraphs[0] ?? ''}
                    >
                      {paragraphs.map((p, i) => (
                        <p key={i} className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{p}</p>
                      ))}
                    </PlateExpand>
                  );
                })()}
                {(() => {
                  const paragraphs = synthesis.synthesis.human_design.circuit.split('\n\n').filter(Boolean);
                  return (
                    <PlateExpand
                      id="hd-circuit"
                      section="humandesign"
                      variant="dark"
                      label="The Circuit"
                      caption={synthesis.reference?.hd_circuit ?? undefined}
                      preview={paragraphs[0] ?? ''}
                    >
                      {paragraphs.map((p, i) => (
                        <p key={i} className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{p}</p>
                      ))}
                    </PlateExpand>
                  );
                })()}
              </>
            )}

            {/* Codon-ring tarot connection */}
            {card.ring_tarot && (() => {
              const paragraphs = (card.ring_description ?? '').split('\n\n').filter(Boolean);
              return (
                <PlateExpand
                  id="hd-ring-tarot"
                  section="humandesign"
                  variant="dark"
                  label={card.ring_name}
                  caption={card.ring_tarot}
                  preview={paragraphs[0] ?? ''}
                >
                  {paragraphs.map((p, i) => (
                    <p key={i} className="font-sans text-[16px] text-stone-100 leading-[1.65] sm:leading-[1.7]">{p}</p>
                  ))}
                </PlateExpand>
              );
            })()}

          </div>
        </section>

        {/* ════════════ CONNECTIONS ═════════════════════════════════════ */}
        <section id="connections" className={`${SCREEN_BG.connections} scroll-mt-16`}>
          <div className="max-w-2xl mx-auto px-4 sm:px-7 pt-12 sm:pt-16 pb-16 sm:pb-20">

            {/* Plate header */}
            <header className="mb-8 sm:mb-10">
              <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500 mb-3">Connections</p>
              <h2 className="font-serif text-[28px] leading-[1.1] sm:leading-[1.15] text-wood-900 tracking-[-0.005em]">Threads in the weave</h2>
              <p className="font-serif text-[14px] sm:text-[15px] text-wood-600 leading-[1.5] mt-3 max-w-prose">
                Each code lives in a wider pattern. Pairs that mirror it, partners that balance it, and the ring of related codons it belongs to.
              </p>
            </header>

            {expanded ? (
              <>
                {/* Paired Hexagram */}
                {pairCard && (
                  <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-wood-200/50 py-6 sm:py-7">
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 sm:self-start sm:pt-1 mb-3 sm:mb-0">Paired Hexagram</p>
                    <div className="space-y-4 min-w-0">
                      <p className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{expanded.i_ching.hexagrams_in_pairs.context.text}</p>
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
                  <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-wood-200/50 py-6 sm:py-7">
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 sm:self-start sm:pt-1 mb-3 sm:mb-0">Programming Partner</p>
                    <div className="space-y-4 min-w-0">
                      <p className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{expanded.gene_keys.programming_partner.relationship_context}</p>
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
                  <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-wood-200/50 py-6 sm:py-7">
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 sm:self-start sm:pt-1 mb-3 sm:mb-0">{expanded.gene_keys.codon_ring.name}</p>
                    <div className="min-w-0">
                      <p className="font-serif text-[14px] text-wood-600 leading-[1.5] mb-6">{expanded.gene_keys.codon_ring.relationship_context}</p>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-x-2 gap-y-3">
                        {siblings.map(n => {
                          const sibling = CARD_BY_NUMBER.get(n);
                          return sibling ? (
                            <button
                              key={n}
                              onClick={() => navigate(`/oracle/universal-language/${n}`, { state: { ritual: true } })}
                              className="group flex flex-col items-center text-center transition-colors"
                            >
                              {UL_IMAGE_BY_NUMBER.get(n) && (
                                <img src={cardImageUrl(n, 80)} alt="" className="w-full aspect-square object-cover opacity-75 group-hover:opacity-100 transition-opacity" />
                              )}
                              <p className="font-label text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-wood-500 mt-1">{n}</p>
                              <p className="font-serif text-[12px] sm:text-[13px] text-wood-700 leading-tight truncate w-full">{sibling.card_name}</p>
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="block sm:grid sm:grid-cols-[88px_1fr] sm:gap-x-5 border-t border-wood-200/50 py-6 sm:py-7">
                <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 sm:self-start sm:pt-1 mb-2 sm:mb-0">Soon</p>
                <p className="font-sans text-[16px] text-wood-500 leading-[1.7]">Connection data will be available soon.</p>
              </div>
            )}

            {/* Tarot resonance */}
            {synthesis && (() => {
              const text = synthesis.synthesis.tarot.ring_role + '\n\n' + synthesis.synthesis.tarot.tarot_resonance;
              const paragraphs = text.split('\n\n').filter(Boolean);
              return (
                <PlateExpand
                  id="connections-tarot"
                  section="connections"
                  variant="light"
                  label={`Tarot · ${card.ring_name}`}
                  caption={synthesis.reference?.tarot_card ?? card.ring_tarot}
                  preview={paragraphs[0] ?? ''}
                >
                  {paragraphs.map((p, i) => (
                    <p key={i} className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{p}</p>
                  ))}
                </PlateExpand>
              );
            })()}

            {/* Body — physiology and amino acid as separate plates */}
            {synthesis && (
              <>
                {(() => {
                  const paragraphs = synthesis.synthesis.body.physiology.split('\n\n').filter(Boolean);
                  return (
                    <PlateExpand
                      id="connections-physiology"
                      section="connections"
                      variant="light"
                      label="Body · Physiology"
                      caption={synthesis.reference?.body_physiology ?? undefined}
                      preview={paragraphs[0] ?? ''}
                    >
                      {paragraphs.map((p, i) => (
                        <p key={i} className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{p}</p>
                      ))}
                    </PlateExpand>
                  );
                })()}
                {(() => {
                  const paragraphs = synthesis.synthesis.body.amino_acid.split('\n\n').filter(Boolean);
                  return (
                    <PlateExpand
                      id="connections-amino-acid"
                      section="connections"
                      variant="light"
                      label="Body · Amino Acid"
                      caption={synthesis.reference?.body_amino_acid ?? undefined}
                      preview={paragraphs[0] ?? ''}
                    >
                      {paragraphs.map((p, i) => (
                        <p key={i} className="font-sans text-[16px] text-wood-700 leading-[1.6] sm:leading-[1.65]">{p}</p>
                      ))}
                    </PlateExpand>
                  );
                })()}
              </>
            )}


          </div>
        </section>

      </div>

      {/* ── Sticky bottom nav ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-paper-50/95 border-t border-wood-200 backdrop-blur-sm">
        <div className="flex items-stretch h-11">

          {/* Prev - icon inside the link */}
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

          {/* Next - icon inside the link */}
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
