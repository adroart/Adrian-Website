
import React from 'react';
import { Link } from 'react-router-dom';
import { img } from '../utils/cloudinary';
import Reveal from './shared/Reveal';
import ProgressBar from './shared/ProgressBar';
import SideNav from './shared/SideNav';
import { Tag, GlyphDivider, Interstitial, ParallaxImg } from './shared/LongformElements';

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


/* ─── MAIN COMPONENT ─────────────────────────────────────────────────── */
const About: React.FC = () => {
  return (
    <>
      <style>{`
        /* ── #11 Timeline (About-specific) ── */
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
      `}</style>

      {/* #14 — Reading progress bar */}
      <ProgressBar />

      {/* #1 — Sticky side navigation */}
      <SideNav sections={SECTIONS} />

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
                <ParallaxImg src={img('adrian_kgcw5r', { w: 800, h: 1200 })} alt="Adrian Rasmussen portrait" />
              </div>
            </Reveal>
          </div>
        </div>

        {/* #18 — Full-bleed video interstitial */}
        <div className="relative overflow-hidden" style={{ height: 'clamp(320px, 55vh, 680px)' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            className="w-full h-full object-cover grayscale opacity-70"
          >
            <source src="https://res.cloudinary.com/dobbosnda/video/upload/f_auto,q_auto/1659598159715_vc8cqr" type="video/mp4" />
          </video>
        </div>

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
                    Begin a conversation
                  </Link>
                </div>
              </Reveal>

              <Reveal dir="right" delay={160}>
                <div className="aspect-[3/4] relative overflow-hidden bg-wood-700">
                  <ParallaxImg src={img('gather_shmnqb', { w: 800, h: 1200 })} alt="Gathering and connection" />
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
        <Interstitial src={img('innerearth_zxtjmw', { w: 1600, h: 900 })} alt="Immersive installation space" />

        {/* ══ CREATION AS PRACTICE ══════════════════════════════════════════ */}
        {/* #15 — Reversed asymmetric grid: image left (narrower), text right (wider) */}
        <div id="about-practice" className="px-6 py-28">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-12 md:gap-20 items-center">
            <Reveal dir="left" delay={120}>
              <div className="aspect-square relative overflow-hidden bg-wood-200">
                <ParallaxImg src={img('adriancreation_onklg1', { w: 800 })} alt="Adrian Rasmussen in the creation process" />
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
