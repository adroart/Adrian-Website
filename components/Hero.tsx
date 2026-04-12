
import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { img } from '../utils/cloudinary';

// Detect touch/low-end devices — disable parallax to save battery and avoid jank
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const Hero: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.playbackRate = 0.8;
    }

    // Skip parallax on touch devices — barely visible on small screens, wastes battery
    if (isTouchDevice) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const h = window.innerHeight || 800;
        if (window.scrollY < h * 1.2) {
          setScrollY(window.scrollY);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const videoTranslateY = scrollY * 0.35;
  const textScale = 1 + (scrollY * 0.00008);
  const textTranslateY = scrollY * -0.15;

  const winHeight = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 1000;
  const opacity = Math.max(0, 1 - (scrollY / (winHeight * 0.85)));
  const safeOpacity = isNaN(opacity) ? 1 : opacity;

  // #9 Scroll to first content section
  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
  };

  return (
    <section className="relative w-full h-[105vh] flex flex-col bg-wood-900 overflow-hidden group dark-preserve">
      <div
        className="absolute inset-0 z-0 will-change-transform"
        style={{ transform: `translateY(${videoTranslateY}px)` }}
      >
          {/* #20 Decorative video gets aria-hidden */}
          <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              poster={img('adrian-website/placeholders/hero-poster', { w: 1920 })}
              className="w-full h-full object-cover opacity-60"
          >
              <source src="https://res.cloudinary.com/dobbosnda/video/upload/f_auto,q_auto/adrian-website/site/hero/studio-creation-process" type="video/mp4" />
          </video>
          {/* Fallback background if video fails to load */}
          <div className="absolute inset-0 bg-gradient-to-br from-wood-900 via-stone-900 to-wood-800 -z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/55 to-stone-950/25 pointer-events-none"></div>
      </div>

      <div className="absolute inset-0 bg-wood-900/10 z-1 pointer-events-none mix-blend-multiply"></div>

      <div
        className="absolute bottom-40 md:bottom-[28vh] left-0 w-full z-20 px-6 py-10 md:px-16 flex flex-col items-center md:items-start text-center md:text-left will-change-transform transition-opacity duration-300"
        style={{
            transform: `translateY(${textTranslateY}px) scale(${textScale})`,
            opacity: safeOpacity
        }}
      >
          <div className="animate-fade-in max-w-4xl">
              <span className="font-label text-xs text-bronze-400 uppercase tracking-[0.2em] mb-4 block">
                  Resonant Artifacts
              </span>
              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-paper-50 tracking-tight leading-[0.92] mb-8 drop-shadow-2xl font-medium">
                  Bringing the <br/>formless into form.
              </h1>
              <div className="h-px w-24 bg-bronze-500/50 mb-8 md:hidden mx-auto"></div>
              <p className="font-sans text-lg md:text-2xl text-paper-100 font-light leading-[1.7] tracking-wide drop-shadow-lg max-w-xl border-l-0 md:border-l border-bronze-500/30 md:pl-6">
                  From intimate talismans to immersive spaces.<br/>
                  Woven from light, geometry, and intention.
              </p>
              {/* #4 CTA visible on all screen sizes (was md:hidden) */}
              <div className="mt-8">
                  <Link
                      to="/creations"
                      className="inline-block font-label text-xs uppercase tracking-[0.2em] text-paper-50 border border-paper-50/70 hover:border-bronze-400 hover:text-bronze-300 px-6 py-3 transition-colors duration-300"
                  >
                      Explore the Work
                  </Link>
              </div>
          </div>
      </div>

      {/* #9 "Enter" indicator — enlarged touch target + gentle bounce */}
      <button
        onClick={scrollToContent}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 transition-opacity duration-500 cursor-pointer group/enter p-4 min-w-[48px] min-h-[48px]"
        style={{ opacity: safeOpacity * 0.6 }}
        aria-label="Scroll to content"
      >
          <span className="font-label text-[11px] uppercase tracking-[0.2em] text-paper-50 ml-[0.5em] group-hover/enter:text-paper-100 transition-colors">Enter</span>
          <div className="w-px h-16 bg-gradient-to-b from-paper-100/40 to-transparent animate-hero-bounce"></div>
      </button>
    </section>
  );
};

export default Hero;
