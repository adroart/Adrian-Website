
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { img } from '../utils/cloudinary';

const PERSON_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Adrian Rasmussen',
  url: 'https://adrianrasmussen.com',
  jobTitle: 'Multidimensional Artist',
  description: 'Technician of the Sacred. Multidimensional artist working between studios in Bali and Santa Cruz, California.',
  sameAs: ['https://www.instagram.com/adrianrasmussen'],
  knowsAbout: ['Sculpture', 'Installation Art', 'Laser Cutting', 'Projection Mapping', 'Tea Ceremony'],
  workLocation: [
    { '@type': 'Place', name: 'Bali, Indonesia' },
    { '@type': 'Place', name: 'Santa Cruz, California' },
  ],
};

/* ─── SECTION MAP for side-nav ──────────────────────────────────────── */
const SECTIONS = [
  { id: 'about-hero',        label: 'Intro' },
  { id: 'about-root',        label: 'The Root' },
  { id: 'about-path',        label: 'The Path' },
  { id: 'about-connection',  label: 'Connection' },
  { id: 'about-team',        label: 'The Team' },
  { id: 'about-practice',    label: 'Practice' },
  { id: 'about-meaning',     label: 'Meaning' },
  { id: 'about-close',       label: 'Go Deeper' },
];

/* ─── HOOKS ─────────────────────────────────────────────────────────── */

// #14 — reading progress bar
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

// #1 — active section for side-nav dots
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

// #8 — scroll-reveal with variable animation direction
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

// #9 — parallax on scroll
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

// #14 — progress bar
const ProgressBar: React.FC = () => {
  const pct = useScrollProgress();
  return (
    <div className="fixed top-0 left-0 w-full h-[2px] z-50 pointer-events-none">
      <div className="h-full bg-bronze-400 transition-[width] duration-100 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
};

// #1 — sticky side navigation
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


// #16 — animated section tag with extending line
const Tag: React.FC<{ light?: boolean; centered?: boolean; children: React.ReactNode }> = ({ light, centered, children }) => (
  <div className={`flex items-center gap-3 mb-8 ${centered ? 'justify-center' : ''}`}>
    {centered && <span className="about-tag-line block h-px flex-1 max-w-[48px]" style={{ background: light ? 'rgba(196,170,124,0.45)' : 'rgba(138,116,78,0.45)' }} />}
    <span className={`font-label text-xs uppercase tracking-[0.2em] font-semibold ${light ? 'text-bronze-400' : 'text-bronze-600'}`}>{children}</span>
    <span className="about-tag-line block h-px flex-1 max-w-[48px]" style={{ background: light ? 'rgba(196,170,124,0.45)' : 'rgba(138,116,78,0.45)' }} />
  </div>
);

// #12 — large typographic divider
const GlyphDivider: React.FC<{ glyph?: string }> = ({ glyph = '&' }) => (
  <Reveal dir="scale">
    <div className="flex items-center justify-center py-10 select-none overflow-hidden" aria-hidden="true">
      <span className="font-serif leading-none font-light" style={{ fontSize: 'clamp(120px, 18vw, 200px)', color: 'rgba(167,143,107,0.09)' }}>
        {glyph}
      </span>
    </div>
  </Reveal>
);

// #18 — full-bleed photo interstitial with parallax
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

// #9 — parallax-wrapped image (inside overflow-hidden container)
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

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────── */
const About: React.FC = () => {
  return (
    <>
      <style>{`
        /* ── #8 Varied reveal animations ── */
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

        /* ── #3 Drop caps ── */
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

        /* ── #17 Paragraph opacity gradient (clears on reveal) ── */
        .pg-1 { opacity: 1; }
        .pg-2 { opacity: 0.75; transition: opacity 1s ease 0.5s; }
        .pg-3 { opacity: 0.6;  transition: opacity 1s ease 0.7s; }
        .pg-4 { opacity: 0.5;  transition: opacity 1s ease 0.9s; }
        .reveal-block.is-visible .pg-2,
        .reveal-block.is-visible .pg-3,
        .reveal-block.is-visible .pg-4 { opacity: 1; }

        /* ── #16 Tag line animation ── */
        .about-tag-line {
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.25s;
        }
        .reveal-block.is-visible .about-tag-line { transform: scaleX(1); }

        /* ── #11 Timeline ── */
        .timeline-track {
          position: relative;
          padding-left: 28px;
        }
        .timeline-track::before {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 0;
          width: 1px;
          background: linear-gradient(to bottom, rgba(196,170,124,0.5), rgba(196,170,124,0.05));
        }
        .timeline-node {
          position: relative;
          padding-bottom: 44px;
        }
        .timeline-node::before {
          content: '';
          position: absolute;
          left: -32px;
          top: 8px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ab9266;
          box-shadow: 0 0 0 3px rgba(171,146,102,0.18);
        }
        .timeline-node:last-child { padding-bottom: 0; }

        /* ── #7 Margin annotation ── */
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

        /* TODO_REPLACE styles removed — #88 */
      `}</style>

      {/* #14 — Reading progress bar */}
      <ProgressBar />

      {/* #1 — Sticky side navigation */}
      <SideNav />

      <section className="bg-paper-50 min-h-screen">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }} />

        {/* ══ HERO ══════════════════════════════════════════════════════════ */}
        <div id="about-hero" className="relative pt-40 pb-20 px-6 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <Tag>Technician of the Sacred</Tag>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-serif text-6xl md:text-8xl lg:text-[104px] text-wood-900 leading-[0.93] font-medium mb-16">
                Adrian<br />Rasmussen
              </h1>
            </Reveal>

            {/* #4 — Three-column layout for hero paragraphs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              <Reveal delay={160} dir="up">
                {/* #2 — paragraph width varies per column */}
                <p className="font-serif text-xl md:text-2xl text-wood-700 leading-[1.45] font-light">
                  I create art and spaces of presence and connection. Multidimensional wooden sculptures
                  with original paintings, light, and crystals. Jewelry. Oracle cards. Tea houses. Stages.
                  Immersive installations you can walk into.
                </p>
              </Reveal>
              <Reveal delay={260} dir="up">
                <p className="font-serif text-xl md:text-2xl text-wood-700 leading-[1.45] font-light">
                  Some pieces are intimate enough to hold. Others transform entire environments. They've
                  found their way into homes and spaces across dozens of countries. I work globally but
                  spend most of my time between Bali and California.
                </p>
              </Reveal>
              <Reveal delay={360} dir="up">
                <p className="font-serif text-xl md:text-2xl text-wood-600 leading-[1.45] font-light italic">
                  The art is not the point. The connection between people is the point. The art holds a
                  space which all of us rest inside. It is there as a confirmation, as a feeling, as a
                  recognition.
                </p>
              </Reveal>
            </div>
          </div>
        </div>

        {/* #12 — Typographic glyph divider */}
        <GlyphDivider glyph="&" />

        {/* ══ THE ROOT ══════════════════════════════════════════════════════ */}
        {/* #13 — wider max-w container for this section */}
        <div id="about-root" className="px-6 py-20">
          {/* #15 — Asymmetric 60/40 grid (text-heavy side wider) */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 md:gap-20 items-start">

            <Reveal dir="left">
              {/* #7 — margin annotation wrapper */}
              <div className="with-margin-note">
                <Tag>The Root</Tag>
                {/* #3 drop cap, #17 opacity gradient, #2 varied widths, #6 spacing */}
                <div className="space-y-8">
                  <p className="drop-cap pg-1 font-serif text-lg text-wood-700 leading-[1.7]">
                    In my earliest years of school, I sat with the founder of Mount Madonna who had taken
                    a vow of silence. He was from India but had decided to bring his wisdom to the West.
                    People still flew from India to see him.
                  </p>
                  <p className="pg-2 font-serif text-lg text-wood-700 leading-[1.7] max-w-lg">
                    I had the opportunity to ask questions. He would respond on a chalkboard. But the feeling
                    of sitting next to him was enough. The feeling of being seen. The feeling of presence.
                    Truth that comes through direct connection to the Divine was the only question that
                    mattered. And there was no answer. Except to sit and enjoy the Divinity.
                  </p>
                  <p className="pg-3 font-serif text-lg text-wood-700 leading-[1.7]">
                    Those years taught me the value of just being. Centered in yourself. Unconditionally
                    being there with someone.
                  </p>
                  <p className="pg-4 font-serif text-lg text-wood-700 leading-[1.7] max-w-md">
                    This is what inspires me to create and what I wish for people to feel in the presence
                    of my creations.
                  </p>
                </div>
                {/* #7 — margin annotation (desktop only via CSS) */}
                <div className="margin-note" style={{ top: '130px' }}>
                  "The feeling of being seen. The feeling of presence."
                </div>
              </div>
            </Reveal>

            {/* #9 — parallax image */}
            <Reveal dir="right" delay={140}>
              <div className="aspect-[3/4] relative overflow-hidden bg-wood-200 md:sticky md:top-24">
                <ParallaxImg src={img('adrian-website/site/about/adrian-portrait', { w: 800, h: 1200 })} alt="Adrian Rasmussen portrait" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* #18 — Full-bleed photo interstitial */}
        <Interstitial src={img('adrian-website/site/about/studio-atmosphere', { w: 1600, h: 900 })} alt="Studio atmosphere" />

        {/* ══ THE PATH — timeline layout ════════════════════════════════════ */}
        {/* #13 — narrow container for contrast with surrounding sections */}
        <div id="about-path" className="px-6 py-28">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <Tag>The Path</Tag>
            </Reveal>

            {/* #11 — vertical timeline */}
            <div className="timeline-track">
              <Reveal dir="left" delay={60}>
                <div className="timeline-node">
                  {/* #3 drop cap on first timeline entry */}
                  <p className="drop-cap pg-1 font-serif text-lg text-wood-700 leading-[1.7]">
                    I've been creating since before I can remember. Graffiti culture shaped my eye.
                    I painted thousands of one-of-a-kind hats, moved to canvas, and followed the work
                    wherever it led. Then I discovered laser cutting and everything started to come together.
                    Painting, digital design, airbrush, lapidary, jewelry, 3D printing. Many skills becoming
                    one expression.
                  </p>
                </div>
              </Reveal>
              <Reveal dir="left" delay={100}>
                <div className="timeline-node">
                  <p className="pg-2 font-serif text-lg text-wood-700 leading-[1.7]">
                    My tea journey came early. My father introduced it when I was young, and it never left.
                    In 2009, I began exploring Asia. China, Japan, Thailand, Taiwan, Bali. Learning from
                    guides. Qigong, Tai Chi, meditation, tea ceremony. The tea and the art have always
                    effortlessly intertwined in creating spaces to experience communion.
                  </p>
                </div>
              </Reveal>
              <Reveal dir="left" delay={140}>
                <div className="timeline-node">
                  <p className="pg-3 font-serif text-lg text-wood-700 leading-[1.7]">
                    Along the way, I discovered new tools. LEDs, airbrushing, projection mapping. I set up
                    several studios built between Santa Cruz and Bali. The forms keep evolving. The intention
                    stays the same. Art is the journey, bringing the formless into form in communion with
                    something bigger than any one.
                  </p>
                </div>
              </Reveal>
              <Reveal dir="left" delay={180}>
                <div className="timeline-node">
                  <p className="pg-4 font-serif text-lg text-wood-700 leading-[1.7] italic">
                    Wherever I go, the same thing happens. Creatives gather. Spaces get built. People start
                    creating together. That's been true since 2002 and it's true now.
                  </p>
                </div>
              </Reveal>
            </div>

            <Reveal delay={220}>
              <div className="mt-10 pl-7">
                <Link
                  to="/creations"
                  className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                >
                  See the work
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* #12 — Section glyph divider */}
        <GlyphDivider glyph="§" />

        {/* ══ CONNECTION ════════════════════════════════════════════════════ */}
        {/* #10 — Connection is now its own full section, separated from The Team */}
        {/* #13 — full-bleed dark background, wider container */}
        <div id="about-connection" className="px-6 py-28 bg-wood-800 dark-preserve">
          <div className="max-w-5xl mx-auto">
            <Reveal dir="up">
              <Tag light>Connection</Tag>
            </Reveal>
            {/* #15 — Asymmetric 2/1 grid */}
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12 md:gap-20 items-start">
              <Reveal dir="left" delay={80}>
                <div className="space-y-8 font-serif text-xl text-paper-100 leading-[1.7] font-light">
                  <p className="drop-cap pg-1">
                    Bringing people together in cocreation has always inspired me.
                  </p>
                  <p className="pg-2">
                    In Santa Cruz, I co-founded the Hide Gallery, which won Best Art Gallery. I helped
                    launch First Friday, which grew from a handful of galleries into something the whole
                    city came out for. I worked with the city and ArtSpace to bring the Tannery Lofts into
                    being, housing for artists. Ten Burning Man festivals. The 150-foot stage for Arise.
                    Ceremonies, parties, shows.
                  </p>
                  <p className="pg-3">
                    Now I design tea houses and spaces where people can gather. The art, the space, the
                    ceremony. All in service of what happens between people when presence is held. The tea
                    and the art have always been intertwined. We sit in these spaces and connect to the
                    elements, the room, the sounds, the sensations, the connection with all that is around us.
                  </p>
                </div>
                <div className="mt-10">
                  <Link
                    to="/inquire"
                    className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-bronze-400 hover:text-bronze-300 font-semibold border-b border-bronze-400 hover:border-bronze-300 pb-1 transition-colors"
                  >
                    Work together
                  </Link>
                </div>
              </Reveal>

              <Reveal dir="right" delay={160}>
                <div className="aspect-[3/4] relative overflow-hidden bg-wood-700">
                  <ParallaxImg src={img('adrian-website/site/about/tea-ceremony', { w: 800, h: 1200 })} alt="Tea ceremony and travels" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ══ THE TEAM ══════════════════════════════════════════════════════ */}
        {/* #10 — Team is its own separate, darker band — centered and intimate */}
        <div id="about-team" className="px-6 py-24 bg-wood-900">
          <div className="max-w-xl mx-auto text-center">
            <Reveal dir="scale">
              <Tag light centered>The Team</Tag>
              <div className="space-y-7 font-serif text-xl text-paper-100 leading-[1.7] font-light">
                <p className="pg-1">
                  I don't work alone. Many have walked this path with me. Learning, discovering, creating.
                  We work hand in hand to bring these arts into form and share them with the planet.
                </p>
                <p className="pg-2 text-bronze-300 italic text-2xl leading-relaxed">
                  A family from different origins. One mother. Earth.
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* #18 — Second photo interstitial */}
        <Interstitial src={img('adrian-website/site/about/immersive-installation', { w: 1600, h: 900 })} alt="Immersive installation space" />

        {/* ══ CREATION AS PRACTICE ══════════════════════════════════════════ */}
        {/* #15 — Reversed asymmetric grid: image left (narrower), text right (wider) */}
        <div id="about-practice" className="px-6 py-28">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-12 md:gap-20 items-center">
            <Reveal dir="left" delay={120}>
              <div className="aspect-square relative overflow-hidden bg-wood-200">
                <ParallaxImg src={img('adrian-website/site/about/creation-in-studio', { w: 800, h: 800 })} alt="Creation in the studio" />
              </div>
            </Reveal>
            <Reveal dir="right">
              <Tag>Creation as Practice</Tag>
              <div className="space-y-8 font-serif text-xl text-wood-800 leading-[1.7] font-light">
                <p className="drop-cap pg-1">
                  Creating is how I grow. My inner journey. A celebration of creation itself.
                </p>
                {/* #2 — narrower max-w on second paragraph for visual variation */}
                <p className="pg-2 max-w-lg">
                  Through the process of creation I find deeper alignment with what is true to me.
                  The more I create, the more authentic I become. And by expressing what is true for me,
                  perhaps others feel permission to do the same.
                </p>
                <p className="pg-3">
                  When my mind leaves during creation, something else arrives. A current. I let go as much
                  as I can and trust in my skills to bring forth what wants to come through.
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* #7 — Pull quote as margin-style narrow annotation, not full-width bar */}
        <Reveal dir="scale">
          <div className="px-6 py-14">
            <div className="max-w-md mx-auto border-l-2 border-r-2 border-bronze-400/25 px-8 text-center">
              <p className="font-serif text-2xl md:text-3xl text-wood-700 font-light leading-[1.35] italic">
                <span className="ml-[-0.4em]">"</span>By expressing what is true for me,<br />
                perhaps others feel permission to do the same."
              </p>
            </div>
          </div>
        </Reveal>

        {/* #12 — Typographic glyph divider */}
        <GlyphDivider glyph="*" />

        {/* ══ WHAT ART CAN MEAN ═════════════════════════════════════════════ */}
        {/* #13 — full-bleed very dark section */}
        <div id="about-meaning" className="px-6 py-28 bg-wood-900 dark-preserve">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <Tag light>What Art Can Mean</Tag>
            </Reveal>
            <Reveal delay={80} dir="left">
              {/* #88 — removed TODO_REPLACE badge. Story content kept, styling cleaned. */}
              <div>
                  <blockquote className="font-serif text-2xl md:text-3xl text-paper-50 leading-[1.5] font-light max-w-3xl mb-10 border-l-2 border-bronze-400/60 pl-6">
                    <span className="ml-[-0.5em]">"</span>A young man was gazing into one of my projection-mapped pieces at a festival. He sat
                    there a long time. When he finally stood, he told me what had happened."
                  </blockquote>
                  <div className="font-serif text-lg text-paper-200 leading-[1.7] max-w-2xl space-y-6">
                    <p>
                      He had been carrying suicidal feelings. An unclarity about why life was worth living.
                      But sitting in the presence of the piece, something shifted. It allowed him to go inward
                      and discover his own truth. To release the perception that he needed to end his life.
                      He tapped into something that had always been there inside himself. The art was a
                      gateway. Through it, he felt connected to who he was again.
                    </p>
                    <p className="font-serif text-xl text-bronze-400 italic">
                      He did the work. The piece just held the space.
                    </p>
                  </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ══ CLOSE / GO DEEPER ═════════════════════════════════════════════ */}
        <div id="about-close" className="px-6 py-32 text-center">
          <Reveal dir="scale">
            <p className="font-serif text-xl text-wood-500 italic mb-10 max-w-xl mx-auto leading-[1.7]">
              The Writings hold more. The philosophy behind the work. The glowing crystal.
              The geometry. The path from formless to form.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <Link
                to="/writings"
                className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
              >
                Explore the writings
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
              >
                Acquire a piece
              </Link>
            </div>
          </Reveal>
        </div>

      </section>
    </>
  );
};

export default About;
