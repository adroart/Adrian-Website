/**
 * Kinship layer for the Atlas globe.
 *
 * Renders quiet bronze arcs between Universal Language pieces that share a
 * trigram. Sits as an absolutely positioned SVG over the cobe canvas, sized
 * to match the globe container, and animates with a private rAF loop whose
 * rotation behaviour mirrors `components/atlas/Globe.tsx` exactly:
 *
 *   - auto-rotate phi by ROTATION_SPEED per frame
 *   - on `selectedId`, tween phi/theta toward the target node over 800ms
 *     with the same easeInOutCubic
 *   - the same coordinate frame, so back-hemisphere endpoints cull cleanly
 *
 * We can't share Globe's internal refs (constraint: never touch Globe.tsx),
 * so we re-derive an identical clock here. Globe and this layer remain in
 * sync as long as the constants below match Globe's. If Globe's rotation
 * model changes, update both files together.
 *
 * Per-frame work mutates SVG path `d` attributes via refs rather than React
 * state, so the 60fps loop never enters reconciliation. React only re-renders
 * when the structural pair list or selection changes.
 */

import { useEffect, useMemo, useRef } from 'react';
import { projectArc, type KinshipIndex } from '../../utils/kinship';

/* ─── Constants — must match Globe.tsx ───────────────────────────────────── */
const ROTATION_SPEED = 0.005;
const SELECT_ANIM_MS = 800;
const INITIAL_THETA = 0.2;

/* ─── Visual tokens ──────────────────────────────────────────────────────── */
// Bronze, kept dim. Matches the bronze-400 marker color used by Globe but
// expressed as a CSS rgb() string so SVG stroke can consume it directly.
const ARC_STROKE = 'rgb(196, 170, 124)';
const OPACITY_DEFAULT = 0.15;
const OPACITY_SELECTED = 0.6;
const OPACITY_FADED = 0.05;
const STROKE_DEFAULT = 1;
const STROKE_SELECTED = 1.5;

interface PairKey {
  aKey: string;
  bKey: string;
  /** Pair identifier built once: `${aKey}|${bKey}`. Used as the React key. */
  id: string;
}

export interface KinshipLayerProps {
  /** Built once per atlas load by `buildKinshipIndex`. */
  index: KinshipIndex;
  /** Pixel size of the surface — should match the cobe canvas. */
  width: number;
  height: number;
  /**
   * Currently selected piece key, or null. When non-null, the selected node's
   * arcs brighten and all other arcs fade. The same `selectedId` is also
   * being passed to Globe — that's how the layer stays visually in sync with
   * the globe's own selection tween.
   */
  selectedId: string | null;
  /** Master toggle. When false, no arcs render (selection still ignored). */
  visible: boolean;
}

export default function KinshipLayer({
  index,
  width,
  height,
  selectedId,
  visible,
}: KinshipLayerProps) {
  /* ─── Stable pair list ────────────────────────────────────────────────── */
  const pairKeys: PairKey[] = useMemo(
    () =>
      index.pairs.map(p => ({
        aKey: p.aKey,
        bKey: p.bKey,
        id: `${p.aKey}|${p.bKey}`,
      })),
    [index.pairs],
  );

  /* ─── Refs to the live SVG <path> nodes ──────────────────────────────── */
  // path refs and per-pair selection state get mutated by the rAF loop, never
  // through React state, so this stays a single mount + per-frame attribute
  // writes (cheap) instead of per-frame reconciliation.
  const pathRefs = useRef<Map<string, SVGPathElement | null>>(new Map());

  /* ─── Mirror Globe's phi/theta clock ─────────────────────────────────── */
  const phiRef = useRef(0);
  const thetaRef = useRef(INITIAL_THETA);
  const pausedRef = useRef(false);
  const tweenRef = useRef<{
    fromPhi: number;
    toPhi: number;
    fromTheta: number;
    toTheta: number;
    startedAt: number;
    duration: number;
  } | null>(null);

  /* When selection changes, tween toward that node — same target math as Globe. */
  useEffect(() => {
    if (!selectedId) {
      pausedRef.current = false;
      return;
    }
    const node = index.nodes.get(selectedId);
    if (!node) return;
    const targetPhi = (node.lng * Math.PI) / 180;
    const targetTheta = -(node.lat * Math.PI) / 180;
    const fromPhi = phiRef.current;
    // shortest-arc lng delta — matches Globe's shortestLngDelta
    let dPhi = targetPhi - fromPhi;
    while (dPhi > Math.PI) dPhi -= 2 * Math.PI;
    while (dPhi < -Math.PI) dPhi += 2 * Math.PI;
    tweenRef.current = {
      fromPhi,
      toPhi: fromPhi + dPhi,
      fromTheta: thetaRef.current,
      toTheta: targetTheta,
      startedAt: performance.now(),
      duration: SELECT_ANIM_MS,
    };
    pausedRef.current = true;
  }, [selectedId, index.nodes]);

  /* ─── rAF loop ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (width === 0 || height === 0) return;
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const tween = tweenRef.current;
      if (tween) {
        const t = Math.min(1, (now - tween.startedAt) / tween.duration);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        phiRef.current = tween.fromPhi + (tween.toPhi - tween.fromPhi) * e;
        thetaRef.current = tween.fromTheta + (tween.toTheta - tween.fromTheta) * e;
        if (t >= 1) tweenRef.current = null;
      } else if (!pausedRef.current) {
        phiRef.current += ROTATION_SPEED;
      }

      // Skip drawing entirely if hidden — still keep the clock running so the
      // first paint after re-enable lands in sync.
      if (visible || selectedId) {
        const phi = phiRef.current;
        const theta = thetaRef.current;

        for (const pair of pairKeys) {
          const path = pathRefs.current.get(pair.id);
          if (!path) continue;
          // Toggle which arcs are drawn at all this frame.
          const isSelectedArc =
            selectedId !== null &&
            (pair.aKey === selectedId || pair.bKey === selectedId);
          if (!visible && !isSelectedArc) {
            path.setAttribute('d', '');
            continue;
          }

          const a = index.nodes.get(pair.aKey);
          const b = index.nodes.get(pair.bKey);
          if (!a || !b) {
            path.setAttribute('d', '');
            continue;
          }
          const arc = projectArc(a.lat, a.lng, b.lat, b.lng, phi, theta, width, height);
          if (!arc) {
            path.setAttribute('d', '');
            continue;
          }
          path.setAttribute('d', arc.d);

          let opacity = OPACITY_DEFAULT;
          let stroke = STROKE_DEFAULT;
          if (selectedId !== null) {
            if (isSelectedArc) {
              opacity = OPACITY_SELECTED;
              stroke = STROKE_SELECTED;
            } else {
              opacity = OPACITY_FADED;
            }
          }
          path.setAttribute('opacity', String(opacity));
          path.setAttribute('stroke-width', String(stroke));
        }
      } else {
        // Layer fully hidden: clear any leftover geometry once.
        for (const pair of pairKeys) {
          const path = pathRefs.current.get(pair.id);
          if (path) path.setAttribute('d', '');
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pairKeys, index.nodes, width, height, visible, selectedId]);

  /* ─── Render ─────────────────────────────────────────────────────────── */
  // SVG is sized to the same square box the canvas uses, centered the same
  // way the canvas is (margin auto). Pointer-events off so it never steals
  // the canvas click handler.
  if (width === 0 || height === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        transform: 'translateX(-50%)',
        width,
        height,
        pointerEvents: 'none',
        // Below the canvas in z-order would hide arcs behind the dark sphere;
        // sitting above with low opacity lets the markers still read through.
      }}
    >
      {pairKeys.map(pair => (
        <path
          key={pair.id}
          ref={el => {
            if (el) pathRefs.current.set(pair.id, el);
            else pathRefs.current.delete(pair.id);
          }}
          d=""
          fill="none"
          stroke={ARC_STROKE}
          strokeWidth={STROKE_DEFAULT}
          strokeLinecap="round"
          opacity={OPACITY_DEFAULT}
        />
      ))}
    </svg>
  );
}

