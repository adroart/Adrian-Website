
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import GalleryTileCard from './GalleryTileCard';
import { img } from '../utils/cloudinary';

/* ─── DECK DATA ────────────────────────────────────────────────────── */

interface OracleDeck {
  id: string;
  name: string;
  tagline: string;
  description: string[];
  cardCount: string;
  dimensions: string;
  material: string;
  image: string;
  sampleCardImage?: string;
  practice?: {
    heading: string;
    steps: string[];
    blessing: string;
    bringsTo: { label: string; items: string[] };
  };
}

const DECKS: OracleDeck[] = [
  {
    id: 'reflect',
    name: 'Reflect',
    tagline: 'A Journey of Self-Inquiry. 64 Questions of Light and Shadow.',
    description: [
      'In stillness, wisdom speaks. In reflection, truth emerges. In expression, nature is experienced.',
      'Reflect is for the moments when you need to turn inward. During tea, meditations, or ceremonies. In your personal journaling space. With friends, family, and coworkers. At your next workshop or retreat. Whenever you invite clarity.',
      'Each card brings to light what seeks attention. Hidden truths ready to emerge. Clarity and awareness. Pathways to integration.',
    ],
    cardCount: '64 Cards',
    dimensions: '3.5" x 5"',
    material: 'Heavyweight Card Stock',
    image: img('adrian-website/placeholders/oracle-card-1', { w: 900, h: 1100 }),
    practice: {
      heading: 'To Begin',
      steps: [
        'Create a space for reflection',
        'Take a breath and center',
        'Clarify an intention or question',
        'With presence, draw a card',
        'Allow your truth to emerge',
        'Answer alone or in a group',
      ],
      blessing: 'May each card be a light in the illumination of clarity and peace.',
      bringsTo: {
        label: 'Brings to light',
        items: [
          'What seeks attention',
          'Hidden truths ready to emerge',
          'Clarity and awareness',
          'Pathways to integration',
        ],
      },
    },
  },
  {
    id: 'connect',
    name: 'Connect',
    tagline: 'A Journey of Coming Together. 64 Cards of Connection and Discovery.',
    description: [
      'In circles, truth flows freely. In sharing, hearts open naturally. In listening, bonds strengthen.',
      'Connect is for the spaces between people. During social gatherings. Getting to know each other. In team building. At workshops and retreats. Around the tea table.',
      'Each card brings to life honest sharing, open hearts, community spirit, and playful moments. May each moment deepen our understanding and compassion.',
    ],
    cardCount: '64 Cards',
    dimensions: '3.5" x 5"',
    material: 'Heavyweight Card Stock',
    image: img('adrian-website/placeholders/oracle-card-2', { w: 900, h: 1100 }),
    practice: {
      heading: 'To Begin',
      steps: [
        'Gather in a circle',
        'Pick the first card',
        'Follow the card',
        'Pass the cards in a circle',
      ],
      blessing: 'May each moment deepen our understanding and compassion.',
      bringsTo: {
        label: 'Brings to life',
        items: [
          'Honest sharing',
          'Open hearts',
          'Community spirit',
          'Playful moments',
        ],
      },
    },
  },
  {
    id: 'universal-language',
    name: 'Universal Language',
    tagline: 'The sixty-four expressions of the cycle of changes, in the palm of your hand.',
    description: [
      'There is a language that all of us know. Elemental. Genetic. Interstellar. Patterns that navigate the experience of life through the passage of time. It existed before the I Ching, Gene Keys, or astrology gave it a name.',
      'The Universal Language oracle carries the same artwork as the wooden sculptures, each connected to a hexagram from the I Ching and a corresponding Gene Key. Pay close attention to which ones call out to you. When one speaks, there is a reason waiting in the oracle.',
      'Nothing needs to be understood to speak with these cards. Your presence and experience is how you commune with these frequencies and discover what they hold for you.',
    ],
    cardCount: '64 Cards',
    dimensions: '3.5" x 5"',
    material: 'Heavyweight Card Stock',
    image: img('adrian-website/placeholders/oracle-card-3', { w: 900, h: 1100 }),
  },
  {
    id: 'light-codes-oracle',
    name: 'Light Codes Oracle',
    tagline: 'Anchorings of unseen realms. Frequencies made portable.',
    description: [
      'After the Light Codes series emerged from dreamtime, it became clear that these patterns wanted to move beyond the studio wall. Some transmissions are meant to travel.',
      'Each card carries one of the Light Code glyphs. Frequency Foundations, Embodied Vibrations, Resonant Formations. Pull one before meditation, before ceremony, or when you need to shift the frequency of a moment.',
      'As you gaze into them you can find signs, sigils, and shapes that inspire things within. What will they awaken in you?',
    ],
    cardCount: '40 Cards',
    dimensions: '3.5" x 5"',
    material: 'Matte Laminate Card Stock',
    image: img('adrian-website/placeholders/oracle-card-4', { w: 900, h: 1100 }),
  },
];

/* ─── SECTION MAP for side-nav ──────────────────────────────────────── */

const SECTIONS = [
  { id: 'oracle-hero',     label: 'Intro' },
  ...DECKS.map(d => ({ id: `oracle-${d.id}`, label: d.name.replace(/^The /, '') })),
  { id: 'oracle-close',    label: 'Acquire' },
];

/* ─── HOOKS ─────────────────────────────────────────────────────────── */

function useScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setPct(total > 0 ? (top / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return pct;
}

function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { threshold: 0.35 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

type RevealDir = 'up' | 'left' | 'right' | 'scale' | 'fade';
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function useParallax(speed = 0.18) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tick = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
      el.style.transform = `translateY(${offset}px)`;
    };
    window.addEventListener('scroll', tick, { passive: true });
    tick();
    return () => window.removeEventListener('scroll', tick);
  }, [speed]);
  return ref;
}

/* ─── SMALL COMPONENTS ──────────────────────────────────────────────── */

const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  dir?: RevealDir;
}> = ({ children, className = '', delay = 0, dir = 'up' }) => {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal-block reveal-${dir} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const ProgressBar: React.FC = () => {
  const pct = useScrollProgress();
  return (
    <div className="fixed top-0 left-0 w-full h-[2px] z-50 pointer-events-none">
      <div className="h-full bg-bronze-400 transition-[width] duration-100 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
};

const SideNav: React.FC = () => {
  const active = useActiveSection();
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <nav className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-[14px]" aria-label="Page sections">
      {SECTIONS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button key={id} onClick={() => go(id)} className="group flex items-center gap-2.5 cursor-pointer" aria-label={`Jump to ${label}`}>
            <span className={`font-label text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'opacity-100 text-bronze-500' : 'opacity-0 text-wood-400 translate-x-2 group-hover:opacity-60 group-hover:translate-x-0'}`}>
              {label}
            </span>
            <span className={`block rounded-full transition-all duration-300 ${isActive ? 'w-2.5 h-2.5 bg-bronze-500 shadow-[0_0_0_2px_rgba(196,170,124,0.25)]' : 'w-1.5 h-1.5 bg-wood-300 group-hover:bg-bronze-400'}`} />
          </button>
        );
      })}
    </nav>
  );
};

const Tag: React.FC<{ light?: boolean; centered?: boolean; children: React.ReactNode }> = ({ light, centered, children }) => (
  <div className={`flex items-center gap-3 mb-8 ${centered ? 'justify-center' : ''}`}>
    {centered && <span className="oracle-tag-line block h-px flex-1 max-w-[48px]" style={{ background: light ? 'rgba(196,170,124,0.45)' : 'rgba(138,116,78,0.45)' }} />}
    <span className={`font-label text-xs uppercase tracking-[0.2em] font-semibold ${light ? 'text-bronze-400' : 'text-bronze-600'}`}>{children}</span>
    <span className="oracle-tag-line block h-px flex-1 max-w-[48px]" style={{ background: light ? 'rgba(196,170,124,0.45)' : 'rgba(138,116,78,0.45)' }} />
  </div>
);

const GlyphDivider: React.FC<{ glyph?: string }> = ({ glyph = '&' }) => (
  <Reveal dir="scale">
    <div className="flex items-center justify-center py-10 select-none overflow-hidden" aria-hidden="true">
      <span className="font-serif leading-none font-light" style={{ fontSize: 'clamp(120px, 18vw, 200px)', color: 'rgba(167,143,107,0.09)' }}>
        {glyph}
      </span>
    </div>
  </Reveal>
);

const Interstitial: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const ref = useParallax(0.12);
  return (
    <div className="relative overflow-hidden" style={{ height: 'clamp(320px, 55vh, 680px)' }}>
      <div ref={ref} className="absolute" style={{ inset: '-15% 0', height: '130%', width: '100%' }}>
        <img src={src} alt={alt} className="w-full h-full object-cover grayscale opacity-70" loading="lazy" />
      </div>
    </div>
  );
};

const ParallaxImg: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => {
  const ref = useParallax(0.09);
  return (
    <div ref={ref} className="absolute" style={{ inset: '-8% 0', height: '116%', width: '100%' }}>
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover grayscale opacity-90 hover:grayscale-0 hover:opacity-100 transition-all duration-[1.5s] ${className}`}
        loading="lazy"
      />
    </div>
  );
};

/* ─── DECK SECTION ──────────────────────────────────────────────────── */

const DeckSection: React.FC<{
  deck: OracleDeck;
  pieces: ReturnType<typeof useMemo>;
  index: number;
}> = ({ deck, pieces, index }) => {
  const isReversed = index % 2 === 1;
  const isDark = index % 3 === 2;

  return (
    <div
      id={`oracle-${deck.id}`}
      className={`px-6 ${isDark ? 'py-28 bg-wood-800 dark-preserve' : 'py-28'}`}
    >
      <div className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 md:gap-20 items-start ${isReversed ? 'md:grid-cols-[2fr_3fr]' : ''}`}>

        {/* Image side */}
        <Reveal dir={isReversed ? 'right' : 'left'} delay={140} className={isReversed ? 'md:order-2' : 'md:order-1'}>
          <div className={`aspect-[3/4] relative overflow-hidden ${isDark ? 'bg-wood-700' : 'bg-wood-200'} md:sticky md:top-24`}>
            <ParallaxImg src={deck.image} alt={`${deck.name} oracle deck`} />
          </div>
          {/* Sample card */}
          {deck.sampleCardImage && (
            <div className="mt-4 aspect-[2/3] w-1/2 relative overflow-hidden bg-wood-100 shadow-md ml-auto -mt-20 mr-4 z-10">
              <img src={deck.sampleCardImage} alt={`Sample card from ${deck.name}`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
        </Reveal>

        {/* Text side */}
        <Reveal dir={isReversed ? 'left' : 'right'} className={isReversed ? 'md:order-1' : 'md:order-2'}>
          <Tag light={isDark}>{deck.name}</Tag>

          <h2 className={`font-serif text-3xl md:text-4xl font-medium mb-6 leading-[1.15] ${isDark ? 'text-paper-50' : 'text-wood-900'}`}>
            {deck.tagline}
          </h2>

          <div className="space-y-6">
            {deck.description.map((p, i) => (
              <p key={i} className={`font-serif text-lg leading-[1.7] font-light ${isDark ? 'text-paper-200' : 'text-wood-700'} ${i === 0 ? 'drop-cap' : ''}`}>
                {p}
              </p>
            ))}
          </div>

          {/* Specs */}
          <div className={`mt-10 pt-6 border-t ${isDark ? 'border-wood-600' : 'border-wood-200'}`}>
            <div className={`font-serif text-sm ${isDark ? 'text-paper-300' : 'text-wood-500'}`}>
              {deck.cardCount} · {deck.dimensions} · {deck.material}
            </div>
          </div>

          {/* Practice steps (Reflect / Connect only) */}
          {deck.practice && (
            <div className={`mt-10 pt-8 border-t ${isDark ? 'border-wood-600' : 'border-wood-200'}`}>
              <span className={`font-label text-[11px] uppercase tracking-[0.2em] font-semibold block mb-6 ${isDark ? 'text-bronze-400' : 'text-bronze-600'}`}>
                {deck.practice.heading}
              </span>
              <ol className="space-y-3">
                {deck.practice.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`font-serif text-lg font-light flex-shrink-0 leading-none mt-0.5 ${isDark ? 'text-bronze-400' : 'text-bronze-500'}`}>{i + 1}</span>
                    <span className={`font-serif text-base font-light leading-[1.6] ${isDark ? 'text-paper-200' : 'text-wood-700'}`}>{step}</span>
                  </li>
                ))}
              </ol>
              <p className={`font-serif text-sm italic mt-6 leading-[1.7] ${isDark ? 'text-bronze-400' : 'text-bronze-500'}`}>
                {deck.practice.blessing}
              </p>
              <div className="mt-6">
                <span className={`font-label text-[11px] uppercase tracking-[0.2em] font-semibold block mb-3 ${isDark ? 'text-bronze-400' : 'text-bronze-600'}`}>
                  {deck.practice.bringsTo.label}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {deck.practice.bringsTo.items.map((item, i) => (
                    <span key={i} className={`font-serif text-sm font-light ${isDark ? 'text-paper-300' : 'text-wood-500'}`}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Inline pieces from this deck if any exist in archive */}
          {(pieces as any[]).length > 0 && (
            <div className="mt-10">
              <span className={`font-label text-[11px] uppercase tracking-[0.2em] font-semibold block mb-4 ${isDark ? 'text-bronze-400' : 'text-bronze-600'}`}>
                Available
              </span>
              <div className="space-y-3">
                {(pieces as any[]).map((art: any) => (
                  <Link
                    key={art.id}
                    to={`/creations/${art.id}`}
                    className="group flex items-center gap-4"
                  >
                    <div className="w-14 h-14 flex-shrink-0 overflow-hidden bg-wood-100">
                      <img src={art.coverImage} alt={art.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                    </div>
                    <div>
                      <span className={`font-serif text-base group-hover:text-bronze-600 transition-colors font-medium ${isDark ? 'text-paper-100' : 'text-wood-900'}`}>
                        {art.title}
                      </span>
                      {art.price && (
                        <span className={`block font-label text-[11px] uppercase tracking-[0.2em] mt-0.5 font-semibold ${isDark ? 'text-paper-400' : 'text-wood-400'}`}>
                          {art.availability === 'MADE_TO_ORDER' ? 'From ' : ''}${art.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
};

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────── */

const OracleCards: React.FC = () => {
  const oraclePieces = useMemo(
    () => FULL_ARCHIVE.filter(a => a.category === 'Oracle Cards'),
    []
  );

  // Distribute pieces across decks loosely by index
  const piecesByDeck = useMemo(() => {
    const map: Record<string, typeof oraclePieces> = {};
    DECKS.forEach((deck, di) => {
      map[deck.id] = oraclePieces.filter((_, pi) => pi % DECKS.length === di);
    });
    return map;
  }, [oraclePieces]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <style>{`
        .reveal-block {
          opacity: 0;
          transition: opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1);
        }
        .reveal-up    { transform: translateY(36px); }
        .reveal-left  { transform: translateX(-44px); }
        .reveal-right { transform: translateX(44px); }
        .reveal-scale { transform: scale(0.94); }
        .reveal-fade  { transform: none; }
        .reveal-block.is-visible {
          opacity: 1;
          transform: translateY(0) translateX(0) scale(1);
        }

        .drop-cap::first-letter {
          float: left;
          font-family: 'Cormorant Garamond', serif;
          font-size: 3.6em;
          line-height: 0.78;
          padding-right: 0.07em;
          padding-top: 0.04em;
          color: #ab9266;
          font-weight: 500;
        }

        .pg-1 { opacity: 1; }
        .pg-2 { opacity: 0.75; transition: opacity 1s ease 0.5s; }
        .pg-3 { opacity: 0.6;  transition: opacity 1s ease 0.7s; }
        .pg-4 { opacity: 0.5;  transition: opacity 1s ease 0.9s; }
        .reveal-block.is-visible .pg-2,
        .reveal-block.is-visible .pg-3,
        .reveal-block.is-visible .pg-4 { opacity: 1; }

        .oracle-tag-line {
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.25s;
        }
        .reveal-block.is-visible .oracle-tag-line { transform: scaleX(1); }

        @media (min-width: 1280px) {
          .with-margin-note { position: relative; }
          .margin-note {
            position: absolute;
            right: -200px;
            width: 168px;
            font-family: 'Cormorant Garamond', serif;
            font-size: 0.95rem;
            font-style: italic;
            color: #ab9266;
            line-height: 1.45;
            border-left: 1px solid rgba(196,170,124,0.4);
            padding-left: 11px;
            opacity: 0.85;
          }
        }
        @media (max-width: 1279px) {
          .margin-note { display: none; }
        }
      `}</style>

      <ProgressBar />
      <SideNav />

      <section className="bg-paper-50 min-h-screen">

        {/* ══ HERO ══════════════════════════════════════════════════════════ */}
        <div id="oracle-hero" className="relative pt-40 pb-20 px-6 overflow-hidden">
          <div className="max-w-6xl mx-auto">

            {/* Breadcrumb */}
            <Reveal>
              <div className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold mb-10">
                <Link to="/creations" className="hover:text-wood-900 transition-colors">Creations</Link>
                <span className="text-wood-300">/</span>
                <span className="text-wood-900">Oracle Cards</span>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <Tag>Tools for Reflection</Tag>
            </Reveal>

            <Reveal delay={120}>
              <h1 className="font-serif text-6xl md:text-8xl lg:text-[104px] text-wood-900 leading-[0.93] font-medium mb-16">
                Oracle<br />Cards
              </h1>
            </Reveal>

            {/* Three-column intro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              <Reveal delay={200} dir="up">
                <p className="font-serif text-xl md:text-2xl text-wood-700 leading-[1.45] font-light">
                  Four decks. Each one opens a different door. Reflect turns inward.
                  Connect brings people together. Universal Language speaks through the
                  sixty-four expressions of the cycle of changes. Light Codes carry
                  transmissions from unseen realms.
                </p>
              </Reveal>
              <Reveal delay={300} dir="up">
                <p className="font-serif text-xl md:text-2xl text-wood-700 leading-[1.45] font-light">
                  The artwork comes from the same place as the sculptures and the paintings.
                  The same geometry, the same frequencies, the same intention. Compressed
                  into something you can hold, carry, and share.
                </p>
              </Reveal>
              <Reveal delay={400} dir="up">
                <p className="font-serif text-xl md:text-2xl text-wood-600 leading-[1.45] font-light italic">
                  May each card be a light in the illumination of clarity and peace.
                </p>
              </Reveal>
            </div>
          </div>
        </div>

        <GlyphDivider glyph="&" />

        {/* ══ PHILOSOPHY ═══════════════════════════════════════════════════ */}
        <div className="px-6 py-20">
          <div className="max-w-3xl mx-auto">
            <Reveal dir="left">
              <div className="with-margin-note">
                <div className="space-y-8">
                  <p className="drop-cap pg-1 font-serif text-lg text-wood-700 leading-[1.7]">
                    Every ancient culture had its oracle. Bones, shells, coins, cards, dreams.
                    The form changes. The function does not. An oracle creates a pause. A moment
                    where the noise of the day recedes and something quieter can be heard.
                  </p>
                  <p className="pg-2 font-serif text-lg text-wood-700 leading-[1.7] max-w-lg">
                    I began creating oracle decks because the artwork wanted to be held. The
                    wooden sculptures live on walls. The jewelry lives on the body. But some of
                    these patterns and frequencies wanted to be shuffled, drawn, and sat with.
                    They wanted to participate in the daily practice.
                  </p>
                  <p className="pg-3 font-serif text-lg text-wood-700 leading-[1.7]">
                    Two of the decks, Reflect and Connect, are designed as companions. Reflect
                    turns inward, 64 questions of light and shadow for self-inquiry. Connect
                    turns outward, 64 cards of connection and discovery for the space between
                    people. The Universal Language and Light Codes oracles carry the artwork
                    and frequencies from those bodies of work into something you can hold
                    in your hand.
                  </p>
                </div>
                <div className="margin-note" style={{ top: '80px' }}>
                  "In stillness, wisdom speaks. In reflection, truth emerges."
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ══ DECK SECTIONS ════════════════════════════════════════════════ */}
        {DECKS.map((deck, i) => (
          <React.Fragment key={deck.id}>
            {i === 2 && (
              <Interstitial
                src={img('adrian-website/placeholders/hero-wide-1', { w: 1600, h: 900 })}
                alt="Oracle cards in a ceremony setting"
              />
            )}
            <DeckSection
              deck={deck}
              pieces={piecesByDeck[deck.id] || []}
              index={i}
            />
            {i < DECKS.length - 1 && i !== 1 && (
              <GlyphDivider glyph={['*', '&', '\u00A7'][i % 3]} />
            )}
          </React.Fragment>
        ))}

        {/* ══ BROWSE ALL / GALLERY ════════════════════════════════════════ */}
        {oraclePieces.length > 0 && (
          <div className="max-w-[1800px] mx-auto px-6 py-24">
            <Reveal>
              <div className="border-t border-wood-200 pt-16 mb-12">
                <h2 className="font-serif text-3xl text-wood-900 font-medium">From the collection</h2>
              </div>
            </Reveal>
            <div className="columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-4 lg:gap-5">
              {oraclePieces.map(art => (
                <GalleryTileCard key={art.id} art={art} />
              ))}
            </div>
          </div>
        )}

        {/* ══ CLOSE / ACQUIRE ═════════════════════════════════════════════ */}
        <div id="oracle-close" className="px-6 py-32 text-center bg-wood-100 border-t border-wood-200">
          <Reveal dir="scale">
            <p className="font-serif text-xl text-wood-500 italic mb-4 max-w-xl mx-auto leading-[1.7]">
              Each deck is printed in limited runs. When a run is complete, it may be some time
              before the next.
            </p>
            <p className="font-serif text-lg text-wood-600 font-light mb-10 max-w-lg mx-auto leading-[1.7]">
              If you are interested in a custom oracle deck created for your community,
              ceremony, or personal practice, that conversation begins here.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
              >
                Browse available decks
              </Link>
              <Link
                to="/inquire"
                className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
              >
                Custom deck inquiry
              </Link>
            </div>
          </Reveal>
        </div>

      </section>
    </>
  );
};

export default OracleCards;
