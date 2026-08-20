/**
 * The CAD drawings.
 *
 * Every drawing is authored as ordered stroke paths, first stroke first, as a
 * human would draw it. Never a flat export: the motion layer dash-offsets each
 * path in turn, and a flattened drawing kills that silently.
 *
 * The rules, from the drawing manifest and the wording record's design rules:
 *   Outline only. fill="none". Uniform thin stroke, never varied for emphasis.
 *   vector-effect="non-scaling-stroke" so the hairline holds at any size.
 *   pathLength={1} on every path so the motion layer needs no measuring.
 *   Maximum eight paths. Anything needing more is too complex a motif.
 *   No text, no shading, no hatching, no arrowheads, no dimension lines.
 *   A real object from this system, never a generic symbol.
 *
 * Seven motifs serve all 46 screens. A drawing repeats when the subject
 * repeats; there are not 46 drawings and there never will be.
 *
 * NOTE, and it is a real divergence to settle: the gaps manifest proposes
 * viewBox 0 0 240 240, while every drawing in the Claude Design file is
 * 0 0 100 100. The design file wins here because it is the look source and
 * every screen's sizing was drawn against it.
 */

import React from 'react';
import { C } from './tokens';

export type Motif = 'piece' | 'underside' | 'vault' | 'map' | 'letter' | 'garden' | 'hands' | 'globe' | 'globelit' | 'none';

type Props = {
  motif: Motif;
  size?: number;
  /** lit drawings sit brighter and heavier: the piece page's own head */
  lit?: boolean;
  /** draw the strokes on in order, once, on entry */
  draw?: boolean;
  label?: string;
};

/** Paths in drawing order, per motif. */
const PATHS: Record<Exclude<Motif, 'none'>, React.ReactNode[]> = {
  /* the piece: the outer rhombus, the inner rhombus, the axes, the core */
  piece: [
    <path key="1" d="M50 8 L86 50 L50 92 L14 50 Z" pathLength={1} />,
    <path key="2" d="M50 24 L72 50 L50 76 L28 50 Z" pathLength={1} />,
    <path key="3" d="M14 50 L86 50 M50 8 L50 92" pathLength={1} />,
    <circle key="4" cx="50" cy="50" r="9" pathLength={1} />,
  ],

  /* the underside, code visible: the plate, and the two rules the code sits on */
  underside: [
    <path key="1" d="M16 26 L84 26 L84 74 L16 74 Z" pathLength={1} />,
    <path key="2" d="M28 44 L72 44" pathLength={1} />,
    <path key="3" d="M28 58 L58 58" pathLength={1} />,
  ],

  /* the vault: the door, its seam, the ring that turns */
  vault: [
    <path key="1" d="M18 18 L82 18 L82 82 L18 82 Z" pathLength={1} />,
    <path key="2" d="M18 50 L82 50" pathLength={1} />,
    <circle key="3" cx="50" cy="50" r="18" pathLength={1} />,
    <path key="4" d="M50 32 L50 24 M50 68 L50 76" pathLength={1} />,
  ],

  /* the map: the frame, the equator, two parallels, one light's place */
  map: [
    <path key="1" d="M10 26 L90 26 L90 74 L10 74 Z" pathLength={1} />,
    <path key="2" d="M10 50 L90 50" pathLength={1} />,
    <path key="3" d="M10 38 L90 38 M10 62 L90 62" pathLength={1} />,
    <path key="4" d="M34 26 L34 74 M58 26 L58 74" pathLength={1} />,
  ],

  /* the sealed letter: the envelope, its fold, the seal */
  letter: [
    <path key="1" d="M14 30 L86 30 L86 76 L14 76 Z" pathLength={1} />,
    <path key="2" d="M14 30 L50 56 L86 30" pathLength={1} />,
    <circle key="3" cx="50" cy="56" r="7" pathLength={1} />,
  ],

  /* the garden: the ground line, and three things growing from it */
  garden: [
    <path key="1" d="M12 78 L88 78" pathLength={1} />,
    <path key="2" d="M32 78 L32 48 M32 58 L22 50 M32 58 L42 50" pathLength={1} />,
    <path key="3" d="M56 78 L56 38 M56 52 L44 42 M56 52 L68 42" pathLength={1} />,
    <circle key="4" cx="74" cy="60" r="8" pathLength={1} />,
  ],

  /* the two hands: one letting go, one taking up, and what passes between */
  hands: [
    <path key="1" d="M14 62 C20 50 30 44 42 46 L42 60 L18 72 Z" pathLength={1} />,
    <path key="2" d="M86 62 C80 50 70 44 58 46 L58 60 L82 72 Z" pathLength={1} />,
    <circle key="3" cx="50" cy="40" r="9" pathLength={1} />,
  ],

  /* the globe: the sphere, the meridian, the equator, two parallels */
  globe: [
    <circle key="1" cx="50" cy="50" r="38" pathLength={1} />,
    <path key="2" d="M50 12 C30 30 30 70 50 88 C70 70 70 30 50 12 Z" pathLength={1} />,
    <path key="3" d="M12 50 L88 50" pathLength={1} />,
    <path key="4" d="M20 30 L80 30 M20 70 L80 70" pathLength={1} />,
  ],

  /* the globe, one point lit. The lit point is ink, not brass: it is not
     something you act on. */
  globelit: [
    <circle key="1" cx="50" cy="50" r="38" pathLength={1} />,
    <path key="2" d="M50 12 C30 30 30 70 50 88 C70 70 70 30 50 12 Z" pathLength={1} />,
    <path key="3" d="M12 50 L88 50" pathLength={1} />,
    <path key="4" d="M20 30 L80 30 M20 70 L80 70" pathLength={1} />,
    <circle key="5" cx="68" cy="34" r="3.2" fill={C.ink} stroke="none" pathLength={1} />,
  ],
};

export const Drawing: React.FC<Props> = ({ motif, size = 104, lit = false, draw = false, label }) => {
  if (motif === 'none') return null;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={draw ? 'cad-draw' : undefined}
      style={{ overflow: 'visible' }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      <g
        fill="none"
        stroke={lit ? C.ink : C.inkBody}
        strokeWidth={lit ? 1.55 : 1.15}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        {PATHS[motif]}
      </g>
    </svg>
  );
};
