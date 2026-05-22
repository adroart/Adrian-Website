/**
 * Kinship layer for the Atlas.
 *
 * Two Universal Language pieces are kin when their I Ching hexagrams share
 * at least one trigram (upper or lower). The 64 cards arrange into 8 trigram
 * families on each axis, so most placed pieces will have a few kindred peers.
 *
 * These helpers are pure. The SVG overlay in `components/atlas/KinshipLayer`
 * mirrors the projection math from `components/atlas/Globe` so that arcs stay
 * pinned to the same phi/theta the globe is animating.
 */

import { CARD_BY_NUMBER } from '../data/oracleData';
import { ulCardNumber } from './universalLanguage';
import type { Artwork, CityCentroid, PublicAtlasState } from '../types';

/** Hard cap on rendered arcs. Past this the constellation reads as noise. */
export const MAX_KINSHIP_ARCS = 200;

/** A placed UL piece resolved to its hexagram, trigrams, and city centroid. */
export interface KinshipNode {
  key: string;              // matches the GlobeNode id (`pieceId:editionNumber`)
  pieceId: string;
  editionNumber?: number;
  title: string;
  hexagramNumber: number;
  upperTrigram: string;     // trigram name, used for the share-test
  lowerTrigram: string;
  lat: number;
  lng: number;
}

/** An undirected kinship edge between two placed UL pieces. */
export interface KinshipPair {
  aKey: string;
  bKey: string;
  /** Great-circle distance in radians (0..π). Lets the side panel rank "nearest kin". */
  distance: number;
}

export interface KinshipIndex {
  /** Lookup by piece key. */
  nodes: Map<string, KinshipNode>;
  /** All unique kinship pairs (aKey < bKey for stable ordering). */
  pairs: KinshipPair[];
  /** Pairs keyed by piece key, for fast per-selection lookup. */
  pairsByKey: Map<string, KinshipPair[]>;
  /** True if the raw pair list exceeded MAX_KINSHIP_ARCS and was truncated. */
  capped: boolean;
}

/**
 * Two pieces are kin if any trigram (upper or lower) on one matches any
 * trigram (upper or lower) on the other. Order independent.
 */
export function isKin(a: KinshipNode, b: KinshipNode): boolean {
  return (
    a.upperTrigram === b.upperTrigram ||
    a.upperTrigram === b.lowerTrigram ||
    a.lowerTrigram === b.upperTrigram ||
    a.lowerTrigram === b.lowerTrigram
  );
}

/**
 * Great-circle distance on a unit sphere between two (lat, lng) pairs in
 * degrees. Returns radians (0..π). Used to rank "nearest kin" and (in the
 * KinshipLayer) to pick a sensible control-point lift for the arc.
 */
export function greatCircleDistance(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const φ1 = (latA * Math.PI) / 180;
  const φ2 = (latB * Math.PI) / 180;
  const Δφ = ((latB - latA) * Math.PI) / 180;
  const Δλ = ((lngB - lngA) * Math.PI) / 180;
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Build the kinship index from the public atlas state.
 *
 * Filters to UL pieces that are (a) placed with a known city and (b) whose
 * coverImage resolves to a hexagram number in CARD_BY_NUMBER. Then walks the
 * O(N²) pair list. With ≤64 placed UL pieces the pair count stays manageable;
 * if the raw set ever exceeds MAX_KINSHIP_ARCS we keep the shortest arcs and
 * set `capped` so the page can surface a note.
 */
export function buildKinshipIndex(
  state: PublicAtlasState,
  citiesById: Map<string, CityCentroid>,
  archive: readonly Artwork[],
): KinshipIndex {
  const archiveById = new Map<string, Artwork>();
  for (const art of archive) archiveById.set(art.id, art);

  const nodes = new Map<string, KinshipNode>();
  for (const p of state.pieces) {
    if (p.series !== 'Universal Language') continue;
    if (p.status !== 'placed') continue;
    if (!p.cityId) continue;
    const city = citiesById.get(p.cityId);
    if (!city) continue;
    const art = archiveById.get(p.pieceId);
    if (!art) continue;
    const num = ulCardNumber(art.coverImage);
    if (num == null) continue;
    const card = CARD_BY_NUMBER.get(num);
    if (!card) continue;

    const key = `${p.pieceId}:${p.editionNumber ?? ''}`;
    nodes.set(key, {
      key,
      pieceId: p.pieceId,
      editionNumber: p.editionNumber,
      title: art.title,
      hexagramNumber: num,
      upperTrigram: card.iching.upper_trigram.name,
      lowerTrigram: card.iching.lower_trigram.name,
      lat: city.lat,
      lng: city.lng,
    });
  }

  const nodeList = Array.from(nodes.values());
  const rawPairs: KinshipPair[] = [];
  for (let i = 0; i < nodeList.length; i++) {
    for (let j = i + 1; j < nodeList.length; j++) {
      const a = nodeList[i];
      const b = nodeList[j];
      if (!isKin(a, b)) continue;
      // aKey < bKey for stable ordering. nodeList is index-ordered so i < j
      // already gives a deterministic pairing, but sort to be explicit.
      const [aKey, bKey] = a.key < b.key ? [a.key, b.key] : [b.key, a.key];
      rawPairs.push({
        aKey,
        bKey,
        distance: greatCircleDistance(a.lat, a.lng, b.lat, b.lng),
      });
    }
  }

  rawPairs.sort((x, y) => x.distance - y.distance);
  const capped = rawPairs.length > MAX_KINSHIP_ARCS;
  const pairs = capped ? rawPairs.slice(0, MAX_KINSHIP_ARCS) : rawPairs;

  const pairsByKey = new Map<string, KinshipPair[]>();
  for (const pair of pairs) {
    const arrA = pairsByKey.get(pair.aKey) ?? [];
    arrA.push(pair);
    pairsByKey.set(pair.aKey, arrA);
    const arrB = pairsByKey.get(pair.bKey) ?? [];
    arrB.push(pair);
    pairsByKey.set(pair.bKey, arrB);
  }

  return { nodes, pairs, pairsByKey, capped };
}

/* ─── Projection mirroring `components/atlas/Globe.tsx` ─────────────────── */

export interface ProjectedPoint {
  x: number;
  y: number;
  /** Depth in the camera frame, +1 = closest to viewer, -1 = behind sphere. */
  z: number;
}

/**
 * Project a (lat, lng) onto canvas CSS-pixel coordinates given cobe's current
 * phi (longitude offset, radians) and theta (latitude tilt, radians).
 *
 * Returns z as well so the arc renderer can lift its control point off the
 * sphere surface in screen space without re-doing the trig.
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

export interface ArcGeometry {
  /** SVG path "d" attribute for a quadratic Bezier from a to b. */
  d: string;
}

/**
 * Build the SVG path for a kinship arc between two endpoints.
 *
 * The control point sits at the screen-space midpoint of the chord, lifted
 * perpendicular to the chord (toward the chord-normal pointing away from the
 * sphere centre) by an amount proportional to the great-circle distance. Short
 * arcs barely curve; arcs that span half the world bow out noticeably.
 *
 * Returns null when either endpoint is on the back hemisphere — the arc is
 * silently dropped rather than drawn as a clipped chord.
 */
export function projectArc(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
  phi: number,
  theta: number,
  width: number,
  height: number,
): ArcGeometry | null {
  const a = projectPoint(latA, lngA, phi, theta, width, height);
  const b = projectPoint(latB, lngB, phi, theta, width, height);
  if (a.z < 0 || b.z < 0) return null;

  const r = Math.min(width, height) / 2;
  const cx = width / 2;
  const cy = height / 2;

  // Midpoint of the screen-space chord.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  // Vector from sphere centre to chord midpoint — the natural "outward"
  // direction. When endpoints straddle the visible centre this collapses to
  // near-zero, so fall back to a perpendicular of the chord.
  let nx = mx - cx;
  let ny = my - cy;
  let nLen = Math.hypot(nx, ny);
  if (nLen < 1) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    nx = -dy;
    ny = dx;
    nLen = Math.hypot(nx, ny) || 1;
  }
  nx /= nLen;
  ny /= nLen;

  // Lift scales with the chord length so cross-hemisphere arcs curve more
  // than neighbour-to-neighbour ones. Capped at ~28% of the globe radius so
  // arcs never wander into the surrounding hero whitespace.
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = Math.min(chord * 0.25, r * 0.28);

  const ctrlX = mx + nx * lift;
  const ctrlY = my + ny * lift;

  return {
    d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
  };
}
