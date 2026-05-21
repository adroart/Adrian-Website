export type PlanetKey =
  | 'sun'
  | 'earth'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter';

export interface GateLine {
  gate: number;        // 1..64
  line: number;        // 1..6
}

export type ProfileKey =
  | 'lifesWork'
  | 'evolution'
  | 'radiance'
  | 'purpose'
  | 'attraction'
  | 'iq'
  | 'eq'
  | 'sq'
  | 'core'
  | 'culture'
  | 'pearl';

export type ProfileSequence = 'activation' | 'venus' | 'pearl';

export interface HologeneticProfile {
  lifesWork: GateLine;
  evolution: GateLine;
  radiance: GateLine;
  purpose: GateLine;
  attraction: GateLine;
  iq: GateLine;
  eq: GateLine;
  sq: GateLine;
  core: GateLine;
  culture: GateLine;
  pearl: GateLine;
}

export interface DailyEnergy {
  gate: number;
  line: number;
  computedAt: string;  // ISO 8601 UTC
}
