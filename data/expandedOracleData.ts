
import card1 from '../oracle/cards/1.json';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface ExpandedGeneKeyText {
  voice: string;
  text: string;
}

export interface ExpandedGeneKeyLevel {
  name: string;
  contemplation_title: string;
  collapsed: ExpandedGeneKeyText;
  expanded: ExpandedGeneKeyText;
  repressive_nature?: { label: string; description: string };
  reactive_nature?: { label: string; description: string };
}

export interface ExpandedTrigram {
  trigram_name: string;
  symbol: string;
  glyph: string;
  action: string;
  family_role: string;
  nature_image: string;
  context: ExpandedGeneKeyText;
}

export interface ExpandedCard {
  keywords: string[];
  card: {
    number: number;
    name: string;
    subtitle: string;
  };
  gene_keys: {
    attribution: string;
    link: string;
    programming_partner: {
      number: number;
      name: string;
      relationship_context: string;
    };
    codon_ring: {
      name: string;
      amino_acid: string;
      sibling_keys: number[];
      relationship_context: string;
    };
    physiology: string;
    tarot_major_arcana: string;
    shadow: ExpandedGeneKeyLevel;
    gift: ExpandedGeneKeyLevel;
    siddhi: ExpandedGeneKeyLevel;
  };
  i_ching: {
    attribution: string;
    hexagram: {
      number: number;
      chinese_name: string;
      english_name: string;
      traditional_name: string;
    };
    trigrams: {
      overview: ExpandedGeneKeyText;
      outer: ExpandedTrigram;
      inner: ExpandedTrigram;
      family_dynamic: ExpandedGeneKeyText;
    };
    image_of_the_situation: { voice: string; text: string; fields_of_meaning: string };
    patterns_of_wisdom: {
      voice: string;
      nature_image: string;
      guidance: string;
      context: ExpandedGeneKeyText;
    };
    image_tradition: ExpandedGeneKeyText;
    hexagrams_in_pairs: {
      pair_hexagram: number;
      pair_name: string;
      voice: string;
      text: string;
      context: ExpandedGeneKeyText;
    };
    reflection: ExpandedGeneKeyText;
  };
  human_design: {
    gate: number;
    keyword: string;
    description: string;
  };
  creator_voice: {
    status: string;
    note: string;
    personal_reading: string | null;
    painting_notes: string | null;
  };
}

/* ─── Registry ───────────────────────────────────────────────────────────── */
// Add new cards here as their expanded readings are written.

const EXPANDED_CARDS: Record<number, ExpandedCard> = {
  1: card1 as unknown as ExpandedCard,
};

export function getExpandedCard(number: number): ExpandedCard | null {
  return EXPANDED_CARDS[number] ?? null;
}
