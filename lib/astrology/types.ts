export type PlanetKey =
  | 'sun'
  | 'earth'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter';

export interface GateLine {
  gate: number;
  line: number;
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
