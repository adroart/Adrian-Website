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
  /** Plate 1 — "The Gate". The felt drive itself. */
  gate: string;
  /** Plate 2 — "The Centre" (bridge) / formerly "The Channel". Where the drive
   * lives in the body. Old synthesis files used this slot for channel prose;
   * bridge overlay puts centre_field here. */
  channel: string;
  /** Plate 3 — "The Channel" (bridge) / formerly "The Circuit". What the drive
   * reaches for, what completes it. Old synthesis files used this slot for
   * circuit prose; bridge overlay puts the channel field here. */
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

const modules = import.meta.glob<{ default: CardSynthesis }>('../oracle/synthesis/key_*.json');

/* Bridge-section overlays. When per-section files exist in
 * oracle/sections/<section>/NN.json they OVERRIDE the old synthesis for that
 * section. ICHING, RELATIONS, BODY still come from the old synthesis until
 * those sections get their own bridge rewrite. */
type KeysSection = {
  number: number;
  shadow_name: string;
  gift_name: string;
  siddhi_name: string;
  shadow: string;
  repressive: string;
  reactive: string;
  gift: string;
  siddhi: string;
};
type DesignSection = {
  number: number;
  gate_number: number;
  gate_keyword: string;
  centre: string;
  channel_keywords: string[];
  gate: string;
  centre_field: string;
  channel: string;
};

const keysModules = import.meta.glob<{ default: KeysSection }>('../oracle/sections/keys/*.json');
const designModules = import.meta.glob<{ default: DesignSection }>('../oracle/sections/design/*.json');

const synthesisCache = new Map<number, CardSynthesis | undefined>();

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export async function getSynthesis(cardNumber: number): Promise<CardSynthesis | undefined> {
  if (synthesisCache.has(cardNumber)) return synthesisCache.get(cardNumber);

  const loader = modules[`../oracle/synthesis/key_${cardNumber}.json`];
  if (!loader) {
    synthesisCache.set(cardNumber, undefined);
    return undefined;
  }

  const base = (await loader()).default;

  // Clone so we don't mutate the imported module's object.
  const merged: CardSynthesis = {
    ...base,
    synthesis: { ...base.synthesis },
  };

  // KEYS overlay
  const keysPath = `../oracle/sections/keys/${pad2(cardNumber)}.json`;
  const keysLoader = keysModules[keysPath];
  if (keysLoader) {
    const keys = (await keysLoader()).default;
    merged.synthesis.gene_keys = {
      shadow: keys.shadow,
      repressive: keys.repressive,
      reactive: keys.reactive,
      gift: keys.gift,
      siddhi: keys.siddhi,
      // programming_partner comes from the old synthesis for now; RELATIONS
      // will replace it when that section is bridge-rewritten.
      programming_partner: base.synthesis.gene_keys?.programming_partner ?? '',
    };
  }

  // DESIGN overlay. Bridge schema (gate / centre_field / channel) maps to the
  // three card plates in reading order:
  //   Plate 1 "The Gate"    ← bridge.gate         (the drive)
  //   Plate 2 "The Centre"  ← bridge.centre_field (where it lives)
  //   Plate 3 "The Channel" ← bridge.channel      (what it reaches for)
  // The card UI labels were updated from "Gate / Channel / Circuit" to match.
  const designPath = `../oracle/sections/design/${pad2(cardNumber)}.json`;
  const designLoader = designModules[designPath];
  if (designLoader) {
    const design = (await designLoader()).default;
    merged.synthesis.human_design = {
      gate: design.gate,
      channel: design.centre_field,  // plate 2 slot
      circuit: design.channel,        // plate 3 slot
    };
  }

  synthesisCache.set(cardNumber, merged);
  return merged;
}
