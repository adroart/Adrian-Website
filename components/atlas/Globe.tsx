/**
 * Constellation-style 3D globe for the /atlas page.
 *
 * Self-contained. No data dependencies. Receives nodes from the parent, paints
 * them as soft bronze stars on a dark sphere via cobe, breathes them gently,
 * and reports selection back up.
 *
 * Visual brief: docs/atlas-style-notes.md. Tokens derived from src/index.css
 * (paper / wood / stone / bronze) but resolved here locally so the file stays
 * self-contained and never touches global CSS.
 *
 * Click-on-marker: cobe has no hit-testing. We mirror cobe's vertex transform
 * in JS (rotate by current phi/theta, scale to radius, project orthographic),
 * cull markers on the back hemisphere, then pick the screen-nearest marker
 * within an 18px threshold. This stays in sync because the auto-rotation drift
 * is tracked in a ref the click handler can read.
 */

import createGlobe from 'cobe';
import type { COBEOptions } from 'cobe';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// cobe's exposed type definitions omit `onRender` (a runtime-only callback),
// so we widen the options shape locally rather than touching node_modules.
type CobeOptionsWithRender = COBEOptions & {
  onRender?: (state: Record<string, number>) => void;
};

export interface GlobeNode {
  id: string;                       // unique key (e.g. `pieceId:editionNumber`)
  lat: number;
  lng: number;
  status: 'placed' | 'seeking';     // seeking = not yet anchored, render dimmer
  label?: string;                   // unused by Globe itself, passed through
}

export interface GlobeProps {
  nodes: GlobeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

// ─── Color tokens (derived, not imported, so this file stays self-contained)
// All in normalized RGB 0..1 for cobe shaders.
const BACKGROUND_RGB = '15, 13, 11';                  // near-black stone tone
const BASE_COLOR: [number, number, number] = [0.42, 0.40, 0.36];   // faint silver continents
const MARKER_COLOR: [number, number, number] = [0.77, 0.67, 0.49]; // bronze-400
const GLOW_COLOR: [number, number, number] = [0.27, 0.22, 0.14];   // bronze-900 halo

// Marker sizes in cobe units.
const PLACED_SIZE = 0.04;
const SEEKING_SIZE = 0.025;

// Auto-rotation in radians per frame; ~0.005 reads as a slow, quiet drift.
const ROTATION_SPEED = 0.005;

// Selection animation duration, ms.
const SELECT_ANIM_MS = 800;

// Click-pick threshold in CSS pixels.
const PICK_THRESHOLD_PX = 18;

/**
 * Project a (lat, lng) onto canvas-CSS-pixel coordinates given cobe's current
 * phi (longitude offset, radians) and theta (latitude tilt, radians).
 *
 * cobe orients the sphere with the prime meridian at phi=0; rotating phi spins
 * the globe west-to-east. Theta tilts the north pole toward the viewer.
 * Coordinate convention matches cobe's marker.location: [lat, lng] in degrees.
 *
 * Returns null if the point is on the back hemisphere (occluded).
 */
function projectMarker(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;

  // Unit sphere coords with lng=0 facing +Z. Apply phi as longitude rotation.
  const effectiveLng = lngR - phi;
  const cosLat = Math.cos(latR);
  let x = cosLat * Math.sin(effectiveLng);
  let y = Math.sin(latR);
  let z = cosLat * Math.cos(effectiveLng);

  // Tilt by theta around the X axis (rotates north pole toward viewer).
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const y2 = y * cosT - z * sinT;
  const z2 = y * sinT + z * cosT;
  y = y2;
  z = z2;

  if (z < 0) return null; // back hemisphere

  // Cobe draws the globe filling the canvas; radius is min(w,h)/2 in CSS px.
  const r = Math.min(width, height) / 2;
  return {
    x: width / 2 + x * r,
    y: height / 2 - y * r,
  };
}

/**
 * Great-circle distance on a unit sphere between two (lat, lng) pairs in deg.
 * Used for the phi/theta tween target.
 */
function shortestLngDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export default function Globe({
  nodes,
  selectedId,
  onSelect,
  className,
}: GlobeProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live size in CSS pixels.
  const [size, setSize] = useState({ width: 600, height: 600 });

  // Cobe state. We mutate refs from inside onRender (which runs every frame)
  // and from the click handler so the picker stays in sync with the render.
  const phiRef = useRef(0);
  const thetaRef = useRef(0.2); // gentle northern tilt
  const pausedRef = useRef(false);
  const tweenRef = useRef<{
    fromPhi: number;
    toPhi: number;
    fromTheta: number;
    toTheta: number;
    startedAt: number;
    duration: number;
  } | null>(null);

  // Track hover so we can pause rotation. (No tooltip — the side panel owns labels.)
  const [isHover, setIsHover] = useState(false);

  // ─── Resize observer
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        // Keep the globe square-ish: use the smaller dimension for both axes
        // so the sphere never stretches. Parent decides container shape.
        const d = Math.max(120, Math.min(cr.width, cr.height));
        setSize({ width: d, height: d });
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ─── Build cobe markers from props
  const markers = useMemo(
    () =>
      nodes.map(n => ({
        location: [n.lat, n.lng] as [number, number],
        size: n.status === 'placed' ? PLACED_SIZE : SEEKING_SIZE,
        // Seeking pieces get a softer bronze (lower-saturation, dimmer).
        // Cobe's per-marker `color` overrides the global markerColor.
        color:
          n.status === 'seeking'
            ? ([0.55, 0.48, 0.36] as [number, number, number])
            : undefined,
        id: n.id,
      })),
    [nodes],
  );

  // ─── Trigger a tween toward the selected node
  useEffect(() => {
    if (!selectedId) return;
    const target = nodes.find(n => n.id === selectedId);
    if (!target) return;

    const targetPhi = (target.lng * Math.PI) / 180;
    // cobe theta increases as the north pole tilts toward the viewer; to bring
    // a latitude into the equatorial sight line we set theta to its negative.
    const targetTheta = -(target.lat * Math.PI) / 180;

    const fromPhi = phiRef.current;
    // Walk phi the short way around the sphere.
    const dPhi = shortestLngDelta(fromPhi, targetPhi);
    tweenRef.current = {
      fromPhi,
      toPhi: fromPhi + dPhi,
      fromTheta: thetaRef.current,
      toTheta: targetTheta,
      startedAt: performance.now(),
      duration: SELECT_ANIM_MS,
    };
    pausedRef.current = true; // hold position once tween completes
  }, [selectedId, nodes]);

  // ─── Pause when user is hovering
  useEffect(() => {
    if (isHover) {
      pausedRef.current = true;
    } else if (!selectedId) {
      pausedRef.current = false;
    }
  }, [isHover, selectedId]);

  // ─── Create / recreate the globe whenever size or markers change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (size.width === 0 || size.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const startedAt = performance.now();

    const opts: CobeOptionsWithRender = {
      devicePixelRatio: dpr,
      width: size.width * dpr,
      height: size.height * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 3.2,
      baseColor: BASE_COLOR,
      markerColor: MARKER_COLOR,
      glowColor: GLOW_COLOR,
      markers,
      onRender: state => {
        const now = performance.now();

        // Tween toward selected target if active.
        const tween = tweenRef.current;
        if (tween) {
          const t = Math.min(1, (now - tween.startedAt) / tween.duration);
          // easeInOutCubic
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          phiRef.current = tween.fromPhi + (tween.toPhi - tween.fromPhi) * e;
          thetaRef.current =
            tween.fromTheta + (tween.toTheta - tween.fromTheta) * e;
          if (t >= 1) tweenRef.current = null;
        } else if (!pausedRef.current) {
          phiRef.current += ROTATION_SPEED;
        }

        state.phi = phiRef.current;
        state.theta = thetaRef.current;
        state.width = size.width * dpr;
        state.height = size.height * dpr;

        // Breathing pulse: ~3.5s sinusoidal modulation of mapBrightness so the
        // continents themselves seem to inhale. Subtle (±0.4 around 3.2).
        const breath =
          3.2 + Math.sin(((now - startedAt) / 1000) * (Math.PI * 2) / 3.5) * 0.4;
        state.mapBrightness = breath;
      },
    };
    const globe = createGlobe(canvas, opts as COBEOptions);

    return () => globe.destroy();
  }, [size.width, size.height, markers]);

  // ─── Click-on-marker (manual pick)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSelect || nodes.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      let best: { id: string; dist: number } | null = null;
      for (const n of nodes) {
        const p = projectMarker(
          n.lat,
          n.lng,
          phiRef.current,
          thetaRef.current,
          size.width,
          size.height,
        );
        if (!p) continue;
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < PICK_THRESHOLD_PX && (best === null || d < best.dist)) {
          best = { id: n.id, dist: d };
        }
      }
      if (best) onSelect(best.id);
    },
    [nodes, onSelect, size.width, size.height],
  );

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        background: `rgb(${BACKGROUND_RGB})`,
        // Soft inner vignette so the sphere's edge melts into the panel.
        boxShadow: `inset 0 0 80px 20px rgb(${BACKGROUND_RGB})`,
        overflow: 'hidden',
        fontFamily: '"Cormorant Garamond", serif',
      }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: size.width,
          height: size.height,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'block',
          margin: '0 auto',
          cursor: onSelect ? 'pointer' : 'default',
          contain: 'layout paint size',
        }}
        aria-label="Globe showing where each piece by Adrian Rasmussen has come to rest"
        role="img"
      />
    </div>
  );
}

/*
 * ── Mini usage example (do not import — this is just a sketch) ──────────────
 *
 * const demoNodes: GlobeNode[] = [
 *   { id: 'ul-01:1', lat: 38.7223, lng:  -9.1393, status: 'placed',  label: "Earth's Breath" },
 *   { id: 'ul-02:1', lat: -8.4095, lng: 115.1889, status: 'placed',  label: 'Universal Language 02' },
 *   { id: 'ul-03:1', lat: 35.6762, lng: 139.6503, status: 'placed',  label: 'Universal Language 03' },
 *   { id: 'ul-04:1', lat: 40.7128, lng: -74.0060, status: 'placed',  label: 'Universal Language 04' },
 *   { id: 'ul-05:1', lat: 48.8566, lng:   2.3522, status: 'placed',  label: 'Universal Language 05' },
 *   { id: 'ul-06:1', lat: 51.5074, lng:  -0.1278, status: 'placed',  label: 'Universal Language 06' },
 *   { id: 'ul-07:1', lat:-33.8688, lng: 151.2093, status: 'placed',  label: 'Universal Language 07' },
 *   { id: 'ul-08:1', lat: 19.4326, lng: -99.1332, status: 'placed',  label: 'Universal Language 08' },
 *   { id: 'ul-09:1', lat: 41.0082, lng:  28.9784, status: 'seeking', label: 'Universal Language 09' },
 *   { id: 'ul-10:1', lat: 55.7558, lng:  37.6173, status: 'seeking', label: 'Universal Language 10' },
 * ];
 *
 * function AtlasDemo() {
 *   const [sel, setSel] = React.useState<string | null>(null);
 *   return (
 *     <div style={{ width: 600, height: 600 }}>
 *       <Globe nodes={demoNodes} selectedId={sel} onSelect={setSel} />
 *     </div>
 *   );
 * }
 */
