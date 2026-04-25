/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface SynthesisReference {
  binary: string;
  hexagram_symbol: string;
  tarot_card: string;
  hebrew_letter: string;
  hebrew_meaning: string;
  path: string;
  path_connects: string;
  astrology: string;
  queen_scale_color: string;
  hd_gate: number;
  hd_keyword: string;
  hd_center: string;
  hd_circuit: string;
  hd_harmonic_gate: string;
  body_physiology: string;
  body_amino_acid: string;
  programming_partner: number | null;
}

export interface SynthesisIching {
  trigram_combination: string;
  reading: string;
  judgement_lines: string[];
  image_lines: string[];
}

export interface SynthesisGeneKeys {
  shadow: string;
  repressive: string;
  reactive: string;
  gift: string;
  siddhi: string;
  programming_partner: string;
}

export interface SynthesisTarot {
  ring_role: string;
  tarot_resonance: string;
}

export interface SynthesisHumanDesign {
  gate: string;
  channel: string;
  circuit: string;
}

export interface SynthesisBody {
  physiology: string;
  amino_acid: string;
}

export interface CardSynthesis {
  number: number;
  card_name: string;
  ring_name: string;
  keywords?: string[];
  essence?: string;
  reference?: SynthesisReference;
  synthesis: {
    iching: SynthesisIching;
    gene_keys: SynthesisGeneKeys;
    tarot: SynthesisTarot;
    human_design: SynthesisHumanDesign;
    body: SynthesisBody;
  };
}

/* ─── Auto-discovery ─────────────────────────────────────────────────────── */
// Vite glob import - picks up every key_N.json in oracle/synthesis/ automatically.
// No manual registration needed. Drop a new file in the folder and it's live.

const modules = import.meta.glob('../oracle/synthesis/key_*.json', { eager: true });

const ALL_SYNTHESIS: CardSynthesis[] = Object.values(modules) as CardSynthesis[];

const SYNTHESIS_BY_NUMBER = new Map<number, CardSynthesis>(
  ALL_SYNTHESIS.map(s => [s.number, s])
);

export function getSynthesis(cardNumber: number): CardSynthesis | undefined {
  return SYNTHESIS_BY_NUMBER.get(cardNumber);
}
