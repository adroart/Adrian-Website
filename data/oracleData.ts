
import rawData from '../oracle/oracle_cards_complete.json';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface OracleTrigram {
  symbol: string;
  name: string;
  nature: string;
}

export interface OracleIChing {
  hexagram_name: string;
  essence: string;
  upper_trigram: OracleTrigram;
  lower_trigram: OracleTrigram;
}

export interface OracleGeneKeys {
  shadow: string;
  gift: string;
  siddhi: string;
  description: string;
}

export interface OracleHumanDesign {
  gate: number;
  keyword: string;
  description: string;
}

export interface OracleCard {
  number: number;
  card_name: string;
  iching: OracleIChing;
  element: string;
  traditional_colors: string;
  nature: string;
  gene_keys: OracleGeneKeys;
  codon_ring_siblings: number[];
  human_design: OracleHumanDesign;
  color_inspiration: string;
  // Enriched with ring context
  ring_name: string;
  ring_tarot: string;
  ring_description: string;
}

export interface CodonRing {
  ring_name: string;
  tarot: string;
  description: string;
  cards: OracleCard[];
}

/* ─── Processed Data ─────────────────────────────────────────────────────── */

const raw = rawData as {
  meta: { title: string; version: string; author: string; description: string };
  codon_rings: Array<{
    ring_name: string;
    tarot: string;
    description: string;
    cards: Array<{
      number: number;
      card_name: string;
      iching: OracleIChing;
      element: string;
      traditional_colors: string;
      nature: string;
      gene_keys: OracleGeneKeys;
      codon_ring_siblings: number[];
      human_design: OracleHumanDesign;
      color_inspiration: string;
    }>;
  }>;
};

export const ORACLE_META = raw.meta;

export const CODON_RINGS: CodonRing[] = raw.codon_rings.map(ring => ({
  ring_name: ring.ring_name,
  tarot: ring.tarot,
  description: ring.description,
  cards: ring.cards.map(card => ({
    ...card,
    ring_name: ring.ring_name,
    ring_tarot: ring.tarot,
    ring_description: ring.description,
  })),
}));

/** All 64 cards sorted numerically 1–64. */
export const ALL_CARDS: OracleCard[] = CODON_RINGS
  .flatMap(ring => ring.cards)
  .sort((a, b) => a.number - b.number);

/** Fast lookup by card number. */
export const CARD_BY_NUMBER = new Map<number, OracleCard>(
  ALL_CARDS.map(card => [card.number, card])
);
