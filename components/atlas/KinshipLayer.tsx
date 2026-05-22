/**
 * Kinship arc overlay for the Atlas globe.
 *
 * Renders quiet bronze quadratic-Bezier arcs between kin pairs (UL pieces
 * whose hexagrams share at least one trigram). The layer sits above the cobe
 * canvas, syncs to the same phi/theta via the Globe's `onFrame` callback, and
 * culls arcs whose endpoints are on the back hemisphere.
 *
 * Visual brief: docs/atlas-style-notes.md. Bronze whisper, no labels, no
 * animation beyond rotation sync. Selection brightens kin of the selected
 * node; everything else dims.
 *
 * Constraints (from prompt):
 * - Plain SVG. No new dependencies.
 * - Recompute projections only on phi/theta change (driven by Globe's onRender).
 * - One requestAnimationFrame loop, throttled via a shared ref.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  arcControlPoint,
  projectPoint,
  type KinshipNode,
  type KinshipPair,
  type ProjectedPoint,
} from '../../utils/kinship';

/* ─── Public types ─────────────────────────────────────────────────────── */

/** State pushed by Globe on every render frame via the `onFrame` callback. */
export interface KinshipFrameState {
  phi: number;
  theta: number;
  width: number;
  height: number;
}

export interface KinshipLayerProps {
  /** UL nodes that have been placed (other series are excluded upstream). */
  nodes: KinshipNode[];
  /** Pre-computed kinship pairs from buildKinshipIndex. */
  pairs: KinshipPair[];
  /** Selected piece key (pieceId:editionNumber) — highlight its kin. */
  selectedKey: string | null;
  /** True when the user has turned threads off in the filter bar. */
  enabled: boolean;
  /**
   * Ref the parent gives to Globe's `onFrame` so each frame's projection
   * state is delivered to this layer without re-rendering React.
   */
  frameRef: React.MutableRefObject<KinshipFrameState | null>;
}

/* ─── Visual constants ─────────────────────────────────────────────────── */

// Bronze stroke, derived from src/index.css 'bronze' tokens. RGB values match
// the marker color in Globe.tsx so arcs and stars feel like one palette.
const STROKE_RGB = '196, 171, 125';

// Default whisper opacity. When threads are enabled but no selection, every
// arc shows at this opacity. Tuned by eye — solid lines read as highways;
// 0.15 reads as background field.
const DEFAULT_OPACITY = 0.15;

// On selection: arcs touching the selected node brighten, others fade away.
const SELECTED_OPACITY = 0.6;
const DIMMED_OPACITY = 0.05;

const DEFAULT_WIDTH = 1;
const SELECTED_WIDTH = 1.5;

/* ─── Component ────────────────────────────────────────────────────────── */

const KinshipLayer: React.FC<KinshipLayerProps> = ({
  nodes,
  pairs,
  selectedKey,
  enabled,
  frameRef,
}) => {
  // Mirror frame state in a React state so the SVG re-renders on rotation.
  // We update via rAF, not on every Globe onRender (cobe runs ~60fps), so we
  // throttle to one paint per browser frame even if Globe pushes more.
  const [frame, setFrame] = useState<KinshipFrameState | null>(null);
  const rafRef = useRef<number | null>(null);

  // Index of node-by-key for projection lookup.
  const nodeByKey = useMemo(() => {
    const m = new Map<string, KinshipNode>();
    for (const n of nodes) m.set(n.key, n);
    return m;
  }, [nodes]);

  // Set of keys that are kin to the currently selected node. Empty when no
  // selection. Used to decide which arcs brighten and which fade.
  const selectedKinKeys = useMemo(() => {
    if (!selectedKey) return null;
    const kin = new Set<string>();
    for (const p of pairs) {
      if (p.a === selectedKey) kin.add(p.b);
      else if (p.b === selectedKey) kin.add(p.a);
    }
    return kin;
  }, [pairs, selectedKey]);

  // ─── rAF loop synced to Globe's frame ref
  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const next = frameRef.current;
      if (next) {
        // Only update if something meaningful changed. Compare by primitives
        // to avoid React re-renders when phi drifts by floating-point noise.
        setFrame((prev) => {
          if (
            prev &&
            prev.phi === next.phi &&
            prev.theta === next.theta &&
            prev.width === next.width &&
            prev.height === next.height
          ) {
            return prev;
          }
          return { ...next };
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [frameRef]);

  // ─── Project pairs into screen-space arcs
  const arcs = useMemo(() => {
    if (!frame) return [];
    const { phi, theta, width, height } = frame;
    if (width <= 0 || height <= 0) return [];

    type ArcGeom = {
      key: string;
      d: string;
      involvesSelection: boolean;
    };
    const out: ArcGeom[] = [];

    // Project every node once, cache by key.
    const projected = new Map<string, ProjectedPoint>();
    for (const n of nodes) {
      projected.set(n.key, projectPoint(n.lat, n.lng, phi, theta, width, height));
    }

    const radius = Math.min(width, height) / 2;

    for (const pair of pairs) {
      const pa = projected.get(pair.a);
      const pb = projected.get(pair.b);
      if (!pa || !pb) continue;
      // Cull when either endpoint is on the back hemisphere.
      if (pa.z < 0 || pb.z < 0) continue;

      const ctrl = arcControlPoint(pa, pb, radius);
      const d = `M ${pa.x.toFixed(2)} ${pa.y.toFixed(2)} Q ${ctrl.x.toFixed(2)} ${ctrl.y.toFixed(2)} ${pb.x.toFixed(2)} ${pb.y.toFixed(2)}`;
      const involvesSelection =
        selectedKey !== null &&
        (pair.a === selectedKey || pair.b === selectedKey);
      out.push({ key: `${pair.a}|${pair.b}`, d, involvesSelection });
    }

    return out;
  }, [frame, nodes, pairs, selectedKey]);

  // Nothing to paint until we have a frame.
  if (!frame) return null;

  // Globe centers a square canvas inside its wrapper. We mirror that by
  // sizing the SVG to the same square and centering it horizontally; the
  // wrapper handles vertical placement via its own layout.
  const { width, height } = frame;

  // When threads disabled globally and no selection: render nothing.
  // When threads disabled but selection present: only show selected node's kin.
  const showAllArcs = enabled;
  const visibleArcs = showAllArcs
    ? arcs
    : arcs.filter((a) => a.involvesSelection);

  if (visibleArcs.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // Position absolute over the canvas. The canvas inside Globe.tsx has
      // `margin: 0 auto` and matches these dimensions, so absolute-center
      // horizontally and pin to top works.
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        // SVG should not paint over the side panel or labels — globe wrapper
        // already has overflow hidden, so we don't need clip-path here.
      }}
      aria-hidden
    >
      {visibleArcs.map((arc) => {
        let opacity = DEFAULT_OPACITY;
        let strokeWidth = DEFAULT_WIDTH;
        if (selectedKey) {
          if (arc.involvesSelection) {
            opacity = SELECTED_OPACITY;
            strokeWidth = SELECTED_WIDTH;
          } else {
            opacity = DIMMED_OPACITY;
          }
        }
        return (
          <path
            key={arc.key}
            d={arc.d}
            stroke={`rgba(${STROKE_RGB}, ${opacity})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </svg>
  );
};

export default KinshipLayer;
