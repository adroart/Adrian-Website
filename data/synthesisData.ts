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

type IchingSection = {
  number: number;
  hexagram_name: string;
  combination: string;
  upper_nature: string;
  lower_nature: string;
  reading: string;
  judgement_lines: string[];
  image_lines: string[];
  lines: Array<{
    line: number;
    image: string;
    reading: string;
    becomes: { hexagram: number; name: string };
  }>;
};
type BodySection = {
  number: number;
  physiology: string;
  amino_acid: string;
  meta?: { organ?: string; amino_acid_name?: string; codon_ring?: string };
};

const keysModules = import.meta.glob<{ default: KeysSection }>('../oracle/sections/keys/*.json');
const designModules = import.meta.glob<{ default: DesignSection }>('../oracle/sections/design/*.json');
const ichingModules = import.meta.glob<{ default: IchingSection }>('../oracle/sections/iching/*.json');
const bodyModules = import.meta.glob<{ default: BodySection }>('../oracle/sections/body/*.json');

/* Main Reading data lives in oracle/generated/NN.json under glance.
 * Currently only UL 1 has this populated; other cards return undefined
 * until the invocation-writing pass commissions them. */
type GeneratedShape = {
  glance?: {
    invocation?: string;
    reading?: string;
    keywords?: string[];
  };
};
const generatedModules = import.meta.glob<{ default: GeneratedShape }>('../oracle/generated/*.json');

const synthesisCache = new Map<number, CardSynthesis | undefined>();
const invocationCache = new Map<number, string | undefined>();

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

  // ICHING overlay. Section file provides combination + main reading +
  // judgement_lines + image_lines + six moving lines. The card UI currently
  // reads trigram_combination / reading / judgement_lines / image_lines off the
  // shared synthesis shape, so we map directly. The six moving-line readings
  // are dropped on the overlay's `lines[]` for the trigram selector to render
  // (UI hookup pending; data is there).
  const ichingPath = `../oracle/sections/iching/${pad2(cardNumber)}.json`;
  const ichingLoader = ichingModules[ichingPath];
  if (ichingLoader) {
    const iching = (await ichingLoader()).default;
    merged.synthesis.iching = {
      trigram_combination: iching.combination,
      reading: iching.reading,
      judgement_lines: iching.judgement_lines ?? [],
      image_lines: iching.image_lines ?? [],
    };
    // Stash the extended ICHING data for any consumer that wants the moving
    // lines or per-trigram natures. Card UI can opt-in later.
    (merged as unknown as Record<string, unknown>).iching_extended = iching;
  }

  // BODY overlay. Section file provides physiology + amino_acid as locked
  // prose. The card UI already reads body.physiology / body.amino_acid.
  const bodyPath = `../oracle/sections/body/${pad2(cardNumber)}.json`;
  const bodyLoader = bodyModules[bodyPath];
  if (bodyLoader) {
    const body = (await bodyLoader()).default;
    merged.synthesis.body = {
      physiology: body.physiology,
      amino_acid: body.amino_acid,
    };
  }

  synthesisCache.set(cardNumber, merged);
  return merged;
}

/* ─── Invocation loader ──────────────────────────────────────────────────
   Returns the invocation prose for a given card, or undefined when the
   generated/NN.json file doesn't exist yet. Cached after first load. */
export async function getInvocation(cardNumber: number): Promise<string | undefined> {
  if (invocationCache.has(cardNumber)) return invocationCache.get(cardNumber);

  const loader = generatedModules[`../oracle/generated/${pad2(cardNumber)}.json`];
  if (!loader) {
    invocationCache.set(cardNumber, undefined);
    return undefined;
  }

  const data = (await loader()).default;
  const inv = data.glance?.invocation;
  invocationCache.set(cardNumber, inv);
  return inv;
}
