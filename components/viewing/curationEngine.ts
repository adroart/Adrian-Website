/**
 * The desk's bridge to the Mandala Codes recommendation engine, and the mapper
 * that turns the engine's LookbookData into the art-first ViewingData the client
 * artifact renders.
 *
 * The seam (your framing): meaning on Mandala Codes, money on Adrian Rasmussen.
 * This module pulls only the meaning, and deliberately DROPS the esoteric fields
 * (gift / shadow / siddhi / sphere) so the default artifact stays art-first. The
 * keywords + plain description are what the curator works with; the full reading
 * lives behind "Go deeper" on the piece page.
 */
import type { ViewingPiece } from './viewingTypes';

/** A sphere as the engine returns it — number, name, full essence + keywords. */
export interface EngineSphere {
  gate: number;
  sphere: string;
  cardName?: string;
  essence?: string;
  keywords?: string[];
  image?: string;
  thumb?: string;
}

const UL_DEEP = 'https://mandalacodes.com/universal-language';

/** The "Go deeper" link for a code — the full card on Mandala Codes. */
export function deepLink(code: number): string {
  return `${UL_DEEP}/${code}`;
}

export interface EngineResult {
  clientName: string;
  spheres: EngineSphere[];
}

/** A {gate, line} pair as the engine input wants it. */
export interface GateLine {
  gate: number;
  line: number;
}

/** The 11 spheres, in reading order, for the manual-entry path. */
export const SPHERE_KEYS = [
  'lifesWork',
  'evolution',
  'radiance',
  'purpose',
  'attraction',
  'iq',
  'eq',
  'sq',
  'core',
  'culture',
  'pearl',
] as const;
export type SphereKey = (typeof SPHERE_KEYS)[number];

/**
 * Call the recommendation engine. Returns the spheres (meaning only) or throws.
 * baseUrl lets the desk hit production Mandala Codes or a local dev instance.
 */
export async function fetchChart(
  baseUrl: string,
  body: { clientName?: string; profile?: Record<string, GateLine>; utcBirth?: string },
  token?: string,
): Promise<EngineResult> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/oracle/recommendation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `engine error ${res.status}`);
  const spheres: EngineSphere[] = (data.pieces || []).map((p: any) => ({
    gate: p.gate,
    sphere: p.sphere,
    cardName: p.cardName,
    essence: p.essence,
    keywords: Array.isArray(p.keywords) ? p.keywords : [],
    image: p.image,
    thumb: p.thumb,
  }));
  return { clientName: data.clientName || body.clientName || '', spheres };
}

/**
 * Map one engine sphere to a draft ViewingPiece — art-first, esoterica dropped.
 * Auto-filled from the engine: the glance is the first sentence, the description
 * is the FULL essence (more room to feel the piece), keywords are the real
 * corpus set, and "Go deeper" points to the full card on Mandala Codes. All
 * editable in the desk, but pre-filled so the curator rarely needs to.
 */
export function sphereToPiece(s: EngineSphere): ViewingPiece {
  const essence = (s.essence || '').replace(/\s+/g, ' ').trim();
  const firstSentence = essence.split(/(?<=[.?!])\s+/)[0] || '';
  return {
    id: `code-${s.gate}`,
    code: s.gate,
    name: s.cardName || `Code ${s.gate}`,
    glance: firstSentence,
    keywords: s.keywords || [],
    description: essence,
    image: s.image,
    thumb: s.thumb,
    pieceUrl: deepLink(s.gate),
    recommended: false,
  };
}
