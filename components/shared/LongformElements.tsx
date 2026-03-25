
import React from 'react';
import { useParallax } from '../../hooks/useParallax';
import Reveal from './Reveal';

/** Animated section tag with extending line. Uses `.tag-line` CSS class. */
export const Tag: React.FC<{ light?: boolean; centered?: boolean; children: React.ReactNode }> = ({ light, centered, children }) => (
    <div className={`flex items-center gap-3 mb-8 ${centered ? 'justify-center' : ''}`}>
        {centered && <span className={`tag-line block h-px flex-1 max-w-[48px] ${light ? 'bg-bronze-400/45' : 'bg-bronze-600/45'}`} />}
        <span className={`font-label text-xs uppercase tracking-[0.2em] font-semibold ${light ? 'text-bronze-400' : 'text-bronze-600'}`}>{children}</span>
        <span className={`tag-line block h-px flex-1 max-w-[48px] ${light ? 'bg-bronze-400/45' : 'bg-bronze-600/45'}`} />
    </div>
);

/** Large typographic divider with a centered oversized glyph. */
export const GlyphDivider: React.FC<{ glyph?: string }> = ({ glyph = '&' }) => (
    <Reveal dir="scale">
        <div className="flex items-center justify-center py-10 select-none overflow-hidden" aria-hidden="true">
            <span className="font-serif leading-none font-light text-bronze-500/[0.09]" style={{ fontSize: 'clamp(120px, 18vw, 200px)' }}>
                {glyph}
            </span>
        </div>
    </Reveal>
);

/** Full-bleed photo interstitial with parallax effect. */
export const Interstitial: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    const ref = useParallax(0.12);
    return (
        <div className="relative overflow-hidden" style={{ height: 'clamp(320px, 55vh, 680px)' }}>
            <div ref={ref} className="absolute" style={{ inset: '-15% 0', height: '130%', width: '100%' }}>
                <img src={src} alt={alt} className="w-full h-full object-cover grayscale opacity-70" loading="lazy" />
            </div>
        </div>
    );
};

/** Parallax-wrapped image for use inside an overflow-hidden container. */
export const ParallaxImg: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => {
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
