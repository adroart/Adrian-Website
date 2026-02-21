
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

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

// Hook: triggers CSS class when element enters viewport
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// Wrapper that animates children into view on scroll
const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({
  children,
  className = '',
  delay = 0,
}) => {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-block ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const About: React.FC = () => {
  return (
    <>
      {/* Inline styles for scroll-reveal animation (no extra CSS file needed) */}
      <style>{`
        .reveal-block {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .reveal-block.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        /* TODO_REPLACE annotation styling */
        .todo-replace {
          position: relative;
        }
        .todo-replace-badge {
          position: absolute;
          top: -14px;
          right: -10px;
          background: #f59e0b;
          color: #1c1917;
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 2px;
          white-space: nowrap;
          z-index: 10;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .todo-replace-outline {
          outline: 2px dashed #f59e0b;
          outline-offset: 12px;
        }
      `}</style>

      <section className="bg-paper-50 min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }}
        />

        {/* ─── HERO: 4.1 What I Create ────────────────────────────────────── */}
        <div className="relative pt-40 pb-32 px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-6 font-bold">
                Technician of the Sacred
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-serif text-6xl md:text-8xl lg:text-[104px] text-wood-900 leading-[0.93] font-medium mb-10">
                Adrian<br />Rasmussen
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <div className="space-y-6 font-serif text-2xl md:text-3xl text-wood-700 leading-[1.45] font-light max-w-2xl">
                <p>
                  I create art and spaces of presence and connection. Multidimensional wooden sculptures
                  with original paintings, light, and crystals. Jewelry. Oracle cards. Tea houses. Stages.
                  Immersive installations you can walk into.
                </p>
                <p>
                  Some pieces are intimate enough to hold. Others transform entire environments. They've
                  found their way into homes and spaces across dozens of countries. I work globally but
                  spend most of my time between Bali and California.
                </p>
                <p>
                  The art is not the point. The connection between people is the point. The art holds a
                  space which all of us rest inside. It is there as a confirmation, as a feeling, as a
                  recognition.
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ─── 4.2 THE ROOT (text left / image right) ──────────────────── */}
        <div className="px-6 py-28">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <Reveal>
              <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-6 font-bold">
                The Root
              </span>
              <div className="space-y-5 font-serif text-lg text-wood-700 leading-relaxed">
                <p>
                  In my earliest years of school, I sat with the founder of Mount Madonna who had taken
                  a vow of silence. He was from India but had decided to bring his wisdom to the West.
                  People still flew from India to see him.
                </p>
                <p>
                  I had the opportunity to ask questions. He would respond on a chalkboard. But the feeling
                  of sitting next to him was enough. The feeling of being seen. The feeling of presence.
                  Truth that comes through direct connection to the Divine was the only question that
                  mattered. And there was no answer. Except to sit and enjoy the Divinity.
                </p>
                <p>
                  Those years taught me the value of just being. Centered in yourself. Unconditionally
                  being there with someone.
                </p>
                <p>
                  This is what inspires me to create and what I wish for people to feel in the presence
                  of my creations.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="aspect-[3/4] relative overflow-hidden bg-wood-200">
                <img
                  src="https://picsum.photos/800/1200?random=about1"
                  className="w-full h-full object-cover grayscale opacity-90 hover:grayscale-0 hover:opacity-100 transition-all duration-[1.5s]"
                  alt="Adrian Rasmussen portrait"
                  loading="lazy"
                />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ─── PULL QUOTE ───────────────────────────────────────────────── */}
        <Reveal>
          <div className="px-6 py-20 border-y border-wood-100 bg-paper-100">
            <div className="max-w-3xl mx-auto text-center">
              <p className="font-serif text-3xl md:text-4xl text-wood-800 font-light leading-[1.3] italic">
                <span className="ml-[-0.4em]">"</span>The art is not the point.<br />The connection between people is the point."
              </p>
            </div>
          </div>
        </Reveal>

        {/* ─── 4.3 THE PATH (image left / text right) ──────────────────── */}
        <div className="px-6 py-28">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <Reveal delay={120}>
              <div className="aspect-[3/4] relative overflow-hidden bg-wood-200 md:order-first order-last">
                <img
                  src="https://picsum.photos/800/1200?random=about2"
                  className="w-full h-full object-cover grayscale opacity-90 hover:grayscale-0 hover:opacity-100 transition-all duration-[1.5s]"
                  alt="Tea ceremony and travels"
                  loading="lazy"
                />
              </div>
            </Reveal>
            <Reveal>
              <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-6 font-bold">
                The Path
              </span>
              <div className="space-y-5 font-serif text-lg text-wood-700 leading-relaxed">
                <p>
                  I've been creating since before I can remember. Graffiti culture shaped my eye.
                  I painted thousands of one-of-a-kind hats, moved to canvas, and followed the work
                  wherever it led. Then I discovered laser cutting and everything started to come together.
                  Painting, digital design, airbrush, lapidary, jewelry, 3D printing. Many skills becoming
                  one expression.
                </p>
                <p>
                  My tea journey came early. My father introduced it when I was young, and it never left.
                  In 2009, I began exploring Asia. China, Japan, Thailand, Taiwan, Bali. Learning from
                  guides. Qigong, Tai Chi, meditation, tea ceremony. The tea and the art have always
                  effortlessly intertwined in creating spaces to experience communion.
                </p>
                <p>
                  Along the way, I discovered new tools. LEDs, airbrushing, projection mapping. I set up
                  several studios built between Santa Cruz and Bali. The forms keep evolving. The intention
                  stays the same. Art is the journey, bringing the formless into form in communion with
                  something bigger than any one.
                </p>
                <p>
                  Wherever I go, the same thing happens. Creatives gather. Spaces get built. People start
                  creating together. That's been true since 2002 and it's true now.
                </p>
              </div>
              <div className="mt-10">
                <Link
                  to="/creations"
                  className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
                >
                  See the work
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ─── 4.4 CONNECTION + 4.6 THE TEAM ────────────────────────────── */}
        <Reveal>
          <div className="px-6 py-20 bg-wood-800">
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
              <div>
                <span className="font-mono text-xs text-bronze-400 uppercase tracking-widest block mb-6 font-bold">
                  Connection
                </span>
                <div className="space-y-5 font-serif text-xl text-paper-100 leading-relaxed font-light">
                  <p>
                    Bringing people together in cocreation has always inspired me.
                  </p>
                  <p>
                    In Santa Cruz, I co-founded the Hide Gallery, which won Best Art Gallery. I helped
                    launch First Friday, which grew from a handful of galleries into something the whole
                    city came out for. I worked with the city and ArtSpace to bring the Tannery Lofts into
                    being, housing for artists. Ten Burning Man festivals. The 150-foot stage for Arise.
                    Ceremonies, parties, shows.
                  </p>
                  <p>
                    Now I design tea houses and spaces where people can gather. The art, the space, the
                    ceremony. All in service of what happens between people when presence is held. The tea
                    and the art have always been intertwined. We sit in these spaces and connect to the
                    elements, the room, the sounds, the sensations, the connection with all that is around us.
                  </p>
                </div>
                <div className="mt-10">
                  <Link
                    to="/inquire"
                    className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-bronze-400 hover:text-bronze-300 font-bold border-b border-bronze-400 hover:border-bronze-300 pb-1 transition-colors"
                  >
                    Work together
                  </Link>
                </div>
              </div>
              <div className="md:border-l border-wood-600 md:pl-16">
                <span className="font-mono text-xs text-bronze-400 uppercase tracking-widest block mb-6 font-bold">
                  The Team
                </span>
                <div className="space-y-5 font-serif text-xl text-paper-100 leading-relaxed font-light">
                  <p>
                    I don't work alone. Many have walked this path with me. Learning, discovering, creating.
                    We work hand in hand to bring these arts into form and share them with the planet.
                  </p>
                  <p className="text-bronze-300 italic">
                    A family from different origins. One mother. Earth.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ─── 4.5 CREATION AS PRACTICE (text + image side by side) ────── */}
        <div className="px-6 py-28">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <Reveal>
              <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-6 font-bold">
                Creation as Practice
              </span>
              <div className="space-y-5 font-serif text-xl text-wood-800 leading-relaxed font-light">
                <p>
                  Creating is how I grow. My inner journey. A celebration of creation itself.
                </p>
                <p>
                  Through the process of creation I find deeper alignment with what is true to me.
                  The more I create, the more authentic I become. And by expressing what is true for me,
                  perhaps others feel permission to do the same.
                </p>
                <p>
                  When my mind leaves during creation, something else arrives. A current. I let go as much
                  as I can and trust in my skills to bring forth what wants to come through.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="aspect-square relative overflow-hidden bg-wood-200">
                <img
                  src="https://picsum.photos/800/800?random=about3"
                  className="w-full h-full object-cover grayscale opacity-90 hover:grayscale-0 hover:opacity-100 transition-all duration-[1.5s]"
                  alt="Creation in the studio"
                  loading="lazy"
                />
              </div>
            </Reveal>
          </div>
        </div>

        {/* ─── PULL QUOTE 2 ─────────────────────────────────────────────── */}
        <Reveal>
          <div className="px-6 py-20 border-y border-wood-100 bg-paper-100">
            <div className="max-w-3xl mx-auto text-center">
              <p className="font-serif text-3xl md:text-4xl text-wood-800 font-light leading-[1.3] italic">
                <span className="ml-[-0.4em]">"</span>By expressing what is true for me,<br />perhaps others feel permission to do the same."
              </p>
            </div>
          </div>
        </Reveal>

        {/* ─── 4.7 WHAT ART CAN MEAN ────────────────────────────────────── */}
        {/* TODO_REPLACE: Paused. Needs rework. Story has inaccuracies that need to be corrected from Adrian's actual memory of the experience. Do not publish as written. Adrian to retell this story from memory with accurate details, then we refine. */}
        <div className="px-6 py-28 bg-wood-900">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <span className="font-mono text-xs text-bronze-400 uppercase tracking-widest block mb-10 font-bold">
                What Art Can Mean
              </span>
            </Reveal>
            <Reveal delay={80}>
              <div className="relative todo-replace">
                <span className="todo-replace-badge">⚠ Replace this story</span>
                <div className="todo-replace-outline">
                  <blockquote className="font-serif text-2xl md:text-3xl text-paper-50 leading-[1.5] font-light max-w-3xl mb-10 border-l-2 border-bronze-400/60 pl-6">
                    <span className="ml-[-0.5em]">"</span>A young man was gazing into one of my projection-mapped pieces at a festival. He sat
                    there a long time. When he finally stood, he told me what had happened."
                  </blockquote>
                  <div className="font-serif text-lg text-paper-200 leading-relaxed max-w-2xl space-y-5">
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
              </div>
            </Reveal>
          </div>
        </div>

        {/* ─── 4.8 CLOSE / GO DEEPER ────────────────────────────────────── */}
        <div className="px-6 py-32 text-center">
          <Reveal>
            <p className="font-serif text-xl text-wood-500 italic mb-10 max-w-xl mx-auto leading-relaxed">
              The Writings hold more. The philosophy behind the work. The glowing crystal.
              The geometry. The path from formless to form.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <Link
                to="/writings"
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
              >
                Explore the writings
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
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
