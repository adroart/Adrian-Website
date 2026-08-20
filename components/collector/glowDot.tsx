/**
 * The glowing dot: the piece's presence, not a vector.
 *
 * Adrian, 2026-08-20: "the center should be the glowing dot not a vector..
 * the dot is your interactions with the art." This is a pure radial glow,
 * layered radial-gradient circles in brass and warm tones from the espresso
 * palette (`tokens.ts`) — a bright small core with a soft falloff halo, and
 * nothing else. No SVG, no strokes, no vector outline of any kind; unlike
 * `drawings.tsx`'s CAD motifs, there is no path here to draw.
 *
 * `warmth` (0 to 1) is fed by the piece's own interactions rather than being
 * a fixed decoration: how much lineage it carries, how many letters it has
 * been sent, how long it has been tended. The caller (PiecePage) owns that
 * mapping; this component only turns the number into light.
 */

import React from 'react';

type Props = {
  /** the dot's own footprint, including its full halo reach */
  size?: number;
  /** 0 to 1: how brightly and how far the halo reaches. Fed by the piece's
   *  own interactions; it never reads as a score, only as light. */
  warmth?: number;
  /** a very slow, gentle pulse, `glowDotBreathe` in ceremony/styles.tsx.
   *  Off entirely under prefers-reduced-motion. */
  breathing?: boolean;
};

/** clamp warmth into [0, 1] so a caller's rough number never overdrives the glass */
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const GlowDot: React.FC<Props> = ({ size = 128, warmth = 0.7, breathing = false }) => {
  const w = clamp01(warmth);
  const haloOpacity = 0.12 + 0.24 * w;
  const haloReach = 0.58 + 0.34 * w;
  const coreOpacity = 0.72 + 0.28 * w;

  return (
    <div
      aria-hidden
      className={breathing ? 'glow-dot-breathe' : undefined}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {/* the soft falloff halo: a wide, gentle wash, brass and warm tones
          layered thin so nothing reads as a hard edge */}
      <span
        style={{
          position: 'absolute',
          width: `${haloReach * 100}%`,
          height: `${haloReach * 100}%`,
          borderRadius: '50%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          filter: 'blur(3px)',
          background:
            `radial-gradient(circle,` +
            ` rgba(240,215,154,${haloOpacity}) 0%,` +
            ` rgba(240,215,154,${haloOpacity * 0.42}) 32%,` +
            ` rgba(212,184,138,${haloOpacity * 0.16}) 58%,` +
            ` transparent 80%)`,
        }}
      />
      {/* the bright small core: the dot itself, the piece's presence */}
      <span
        style={{
          position: 'absolute',
          width: '20%',
          height: '20%',
          borderRadius: '50%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: coreOpacity,
          background:
            'radial-gradient(circle at 38% 32%,' +
            ' #fffaf0 0%, #fdf3d9 18%,' +
            ' rgba(240,215,154,.72) 40%,' +
            ' rgba(240,215,154,.3) 62%,' +
            ' rgba(240,215,154,.07) 82%,' +
            ' transparent 96%)',
        }}
      />
    </div>
  );
};
