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

const UL = '/creations/multidimensional-art/universal-language';

/** A sphere as the engine returns it — we keep only number, name, and a taste. */
export interface EngineSphere {
  gate: number;
  sphere: string;
  cardName?: string;
  essence?: string;
  image?: string;
  thumb?: string;
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
 * Trim the engine's full essence down to a plain-voice taste (2-3 sentences),
 * so the curator starts from something art-shaped rather than the whole reading.
 * The curator edits this in the desk; it is never shipped raw.
 */
export function tasteFromEssence(essence?: string): string {
  if (!essence) return '';
  const sentences = essence.replace(/\s+/g, ' ').trim().split(/(?<=[.?!])\s+/);
  return sentences.slice(0, 3).join(' ');
}

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
    image: p.image,
    thumb: p.thumb,
  }));
  return { clientName: data.clientName || body.clientName || '', spheres };
}

/** Map one engine sphere to a draft ViewingPiece — art-first, esoterica dropped. */
export function sphereToPiece(s: EngineSphere): ViewingPiece {
  return {
    id: `code-${s.gate}`,
    code: s.gate,
    name: s.cardName || `Code ${s.gate}`,
    glance: tasteFromEssence(s.essence).split(/(?<=[.?!])\s+/)[0] || '',
    keywords: [],
    description: tasteFromEssence(s.essence),
    image: s.image,
    thumb: s.thumb,
    pieceUrl: UL,
    recommended: false,
  };
}
