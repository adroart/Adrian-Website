/**
 * Kinship utilities for the Atlas globe.
 *
 * Kinship rule (UL only): two Universal Language pieces are kin when their
 * I Ching hexagrams share at least one trigram (upper or lower). This gives
 * the I Ching architecture spatial expression — pieces that share geometric
 * DNA appear connected on the world.
 *
 * Pure functions, no DOM, no React. The visual layer (KinshipLayer.tsx)
 * consumes these.
 */

import { CARD_BY_NUMBER } from '../data/oracleData';

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface KinshipNode {
  key: string;          // unique key (pieceId:editionNumber)
  pieceId: string;
  editionNumber?: number;
  title: string;
  lat: number;
  lng: number;
  cardNumber: number;   // 1..64 hexagram number
  trigrams: string[];   // [upperSymbol, lowerSymbol] — unique entries kept
}

export interface KinshipPair {
  a: string;            // node key
  b: string;            // node key — always lexicographically > a after dedup
}

/* ─── Trigram lookup ───────────────────────────────────────────────────── */

/**
 * For a UL hexagram number 1..64, return the unique trigram symbols it uses.
 * (Some hexagrams have the same trigram on top and bottom — return one entry.)
 * Returns null if the card cannot be found.
 */
export function trigramsFor(cardNumber: number): string[] | null {
  const card = CARD_BY_NUMBER.get(cardNumber);
  if (!card) return null;
  const upper = card.iching.upper_trigram.symbol;
  const lower = card.iching.lower_trigram.symbol;
  if (upper === lower) return [upper];
  return [upper, lower];
}

/* ─── Kinship index ────────────────────────────────────────────────────── */

/**
 * True when two nodes share at least one trigram. Order-independent.
 */
export function isKin(a: KinshipNode, b: KinshipNode): boolean {
  if (a.key === b.key) return false;
  for (const t of a.trigrams) {
    if (b.trigrams.includes(t)) return true;
  }
  return false;
}

/**
 * Build a deduplicated list of kinship pairs from a set of placed UL nodes.
 *
 * Only placed nodes go in. Pairs are emitted with `a < b` (string compare)
 * so the same pair never appears twice. O(n^2) in node count, fine for n=64.
 *
 * If the index would exceed `maxPairs`, the list is truncated and the caller
 * is told via the `capped` flag in the result.
 */
export function buildKinshipIndex(
  nodes: KinshipNode[],
  maxPairs = 200,
): { pairs: KinshipPair[]; capped: boolean; total: number } {
  const pairs: KinshipPair[] = [];
  let total = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (!isKin(a, b)) continue;
      total++;
      if (pairs.length >= maxPairs) continue;
      // Lexicographic ordering so the pair is canonical regardless of input order.
      if (a.key < b.key) pairs.push({ a: a.key, b: b.key });
      else pairs.push({ a: b.key, b: a.key });
    }
  }
  return { pairs, capped: total > maxPairs, total };
}

/* ─── Projection (mirrors Globe.tsx) ───────────────────────────────────── */

/**
 * Result of projecting one (lat, lng) onto the globe canvas.
 * `z` is the depth in unit-sphere coords after rotation; z < 0 means the back
 * hemisphere (occluded).
 */
export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Project a (lat, lng) onto canvas-CSS-pixel coordinates given cobe's current
 * phi (longitude offset, radians) and theta (latitude tilt, radians).
 *
 * Mirrors the math in components/atlas/Globe.tsx → projectMarker, but returns
 * z as well so the arc layer can decide what to skip and how to lift the
 * Bezier control point.
 */
export function projectPoint(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
  width: number,
  height: number,
): ProjectedPoint {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;

  const effectiveLng = lngR - phi;
  const cosLat = Math.cos(latR);
  let x = cosLat * Math.sin(effectiveLng);
  let y = Math.sin(latR);
  let z = cosLat * Math.cos(effectiveLng);

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const y2 = y * cosT - z * sinT;
  const z2 = y * sinT + z * cosT;
  y = y2;
  z = z2;

  const r = Math.min(width, height) / 2;
  return {
    x: width / 2 + x * r,
    y: height / 2 - y * r,
    z,
  };
}

/* ─── Arc geometry ─────────────────────────────────────────────────────── */

/**
 * Compute screen-space control point for a quadratic Bezier arc between two
 * projected points. The control point lifts the midpoint off the sphere in
 * screen space so the arc visually arcs above the surface rather than cutting
 * straight through the planet.
 *
 * Lift magnitude scales with chord length (longer arcs lift more, capped by
 * radius / 2) so neighbouring kin and antipodal kin both feel natural.
 */
export function arcControlPoint(
  a: ProjectedPoint,
  b: ProjectedPoint,
  radius: number,
): { x: number; y: number } {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  // Lift is proportional to chord length: short kin barely curve, antipodal kin curl high.
  const lift = Math.min(radius * 0.5, chord * 0.35);
  // Direction: from the globe center toward the midpoint, normalized.
  const cx = radius; // assuming canvas is square and globe is centered
  const cy = radius;
  let dx = midX - cx;
  let dy = midY - cy;
  const dlen = Math.hypot(dx, dy);
  if (dlen < 1) {
    // Midpoint near center — lift straight up toward the viewer (screen up).
    dx = 0;
    dy = -1;
  } else {
    dx /= dlen;
    dy /= dlen;
  }
  return {
    x: midX + dx * lift,
    y: midY + dy * lift,
  };
}

/* ─── Great-circle distance ────────────────────────────────────────────── */

/**
 * Great-circle distance between two (lat, lng) pairs in degrees. Returns the
 * angular distance in radians; multiply by Earth's radius for a real-world
 * distance. We only use this for sorting nearest kin in the side panel, so
 * the unit is immaterial as long as it's monotonic.
 */
export function greatCircleDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
