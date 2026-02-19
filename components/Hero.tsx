
import React, { useRef, useState, useEffect } from 'react';
import { View } from '../types';

interface HeroProps {
  setView: (view: View) => void;
}

const Hero: React.FC<HeroProps> = ({ setView }) => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Safety check: verify ref.current exists before accessing properties
    if (videoRef.current) {
        videoRef.current.playbackRate = 0.8;
    }

    const handleScroll = () => {
      if (window.scrollY < window.innerHeight * 1.2) {
        setScrollY(window.scrollY);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const videoTranslateY = scrollY * 0.35;
  const textScale = 1 + (scrollY * 0.00008);
  const textTranslateY = scrollY * -0.15;
  const opacity = Math.max(0, 1 - (scrollY / (window.innerHeight * 0.85)));

  return (
    <section className="relative w-full h-[105vh] flex flex-col bg-wood-900 overflow-hidden group">
      <div 
        className="absolute inset-0 z-0 will-change-transform"
        style={{ transform: `translateY(${videoTranslateY}px)` }}
      >
          <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={() => setIsVideoLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-1000 ${isVideoLoaded ? 'opacity-60' : 'opacity-0'}`}
              poster="https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=2500&auto=format&fit=crop"
          >
              <source src="https://video.wixstatic.com/video/e5e2db_603cdbb883e847db9a1f47fd9bb39e26/720p/mp4/file.mp4" type="video/mp4" />
          </video>
          
          {!isVideoLoaded && (
              <img 
                  src="https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=2500&auto=format&fit=crop" 
                  className="absolute inset-0 w-full h-full object-cover opacity-50"
                  alt="Atmospheric texture"
              />
          )}
          {/* Subtle Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent pointer-events-none"></div>
      </div>

      <div className="absolute inset-0 bg-wood-900/10 z-1 pointer-events-none mix-blend-multiply"></div>

      <div 
        className="absolute bottom-40 md:bottom-[28vh] left-0 w-full z-20 px-6 py-10 md:px-16 flex flex-col items-center md:items-start text-center md:text-left will-change-transform transition-opacity duration-300"
        style={{ 
            transform: `translateY(${textTranslateY}px) scale(${textScale})`,
            opacity: opacity 
        }}
      >
          <div className="animate-fade-in max-w-4xl">
              <span className="font-mono text-xs text-bronze-400 uppercase tracking-[0.4em] mb-6 block opacity-80">
                  Resonant Artifacts
              </span>
              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-paper-50 tracking-tight leading-[0.9] mb-8 drop-shadow-2xl font-medium">
                  Bringing the <br/>formless into form.
              </h1>
              <div className="h-px w-24 bg-bronze-500/50 mb-8 md:hidden mx-auto"></div>
              <p className="font-serif text-lg md:text-2xl text-paper-100 font-light leading-relaxed tracking-wide opacity-90 drop-shadow-lg max-w-xl border-l-0 md:border-l border-bronze-500/30 md:pl-6">
                  Precision laser craft meeting organic silence. <br/>
                  Creating windows to the infinite.
              </p>
          </div>
      </div>

      <div 
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 transition-opacity duration-500"
        style={{ opacity: opacity * 0.6 }}
      >
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-paper-100/60 ml-[0.5em]">Enter</span>
          <div className="w-px h-16 bg-gradient-to-b from-paper-100/40 to-transparent"></div>
      </div>
    </section>
  );
};

export default Hero;
