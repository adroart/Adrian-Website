/**
 * I Ching coin-casting engine — the traditional three-coin method.
 *
 * A reading is six tosses, building a hexagram bottom-to-top. Each toss of
 * three coins yields a value 6, 7, 8 or 9:
 *
 *   6  old yin    ⚋ ✕   broken, moving   → becomes yang in the changed hexagram
 *   7  young yang ⚊      solid,  stable
 *   8  young yin  ⚋      broken, stable
 *   9  old yang   ⚊ ○   solid,  moving   → becomes yin  in the changed hexagram
 *
 * Three coins, heads = 3 / tails = 2, summed. The probabilities below
 * (1/8, 3/8, 3/8, 1/8) reproduce the classical odds exactly, so a cast here
 * behaves the same as three real coins on a table.
 *
 * The "moving lines" are the lines you read in the line statements. Flip
 * every moving line and you get the second, changed hexagram — the shape the
 * present moment is turning into.
 */

import { ALL_CARDS } from '../data/oracleData';

/** Trigram line patterns, top-to-bottom. true = yang (solid). */
const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true, true, true],
  '☱': [false, true, true],
  '☲': [true, false, true],
  '☳': [false, false, true],
  '☴': [true, true, false],
  '☵': [false, true, false],
  '☶': [true, false, false],
  '☷': [false, false, false],
};

export type CoinValue = 6 | 7 | 8 | 9;

/** A single cast line. `position` is 1 (bottom) to 6 (top). */
export interface CastLine {
  /** 1 = bottom line, 6 = top line. */
  position: number;
  /** Raw three-coin sum: 6, 7, 8, or 9. */
  value: CoinValue;
  /** Whether the line is yang (solid) in the *primary* hexagram. */
  yang: boolean;
  /** A moving line (old yin or old yang) — these are the lines you read. */
  moving: boolean;
}

export interface CastResult {
  /** Six lines, index 0 = bottom (position 1), index 5 = top (position 6). */
  lines: CastLine[];
  /** Card number 1–64 of the primary hexagram. */
  primaryNumber: number;
  /**
   * Card number 1–64 of the changed hexagram, or null when nothing moves
   * (no moving lines means the present moment is not in transition).
   */
  changedNumber: number | null;
  /** Positions (1–6) of the moving lines, ascending. Empty when none move. */
  movingPositions: number[];
}

/**
 * Six booleans for a hexagram, bottom-to-top, from upper + lower trigram
 * symbols. Bottom-to-top is the casting order (line 1 is cast first).
 */
function hexagramBitsBottomUp(upper: string, lower: string): boolean[] {
  const u = TRIGRAM_LINES[upper] ?? [true, true, true];
  const l = TRIGRAM_LINES[lower] ?? [true, true, true];
  // top-to-bottom is [u0,u1,u2,l0,l1,l2]; bottom-up reverses that.
  return [l[2], l[1], l[0], u[2], u[1], u[0]];
}

/**
 * Lookup from a bottom-up six-bit yang pattern (e.g. "111111") to the
 * Universal Language card number that carries that hexagram. Built once from
 * the oracle data, so it always tracks the real card set.
 */
const BITS_TO_NUMBER: Map<string, number> = (() => {
  const map = new Map<string, number>();
  for (const card of ALL_CARDS) {
    const bits = hexagramBitsBottomUp(
      card.iching.upper_trigram.symbol,
      card.iching.lower_trigram.symbol,
    );
    map.set(bits.map((b) => (b ? '1' : '0')).join(''), card.number);
  }
  return map;
})();

/** The card number for an arbitrary six-line yang pattern (bottom-up). */
export function numberFromBits(bits: boolean[]): number | null {
  return BITS_TO_NUMBER.get(bits.map((b) => (b ? '1' : '0')).join('')) ?? null;
}

/** The six bottom-up yang bits for a given card number. */
export function bitsForCard(cardNumber: number): boolean[] | null {
  const card = ALL_CARDS.find((c) => c.number === cardNumber);
  if (!card) return null;
  return hexagramBitsBottomUp(
    card.iching.upper_trigram.symbol,
    card.iching.lower_trigram.symbol,
  );
}

/** One toss of three coins. Heads = 3, tails = 2; the sum is 6–9. */
function tossThreeCoins(): CoinValue {
  let sum = 0;
  for (let i = 0; i < 3; i++) sum += Math.random() < 0.5 ? 2 : 3;
  return sum as CoinValue;
}

/**
 * A full six-line cast that is *constrained* to a known primary hexagram.
 *
 * On a card page the primary hexagram is already fixed (it is the card you
 * are looking at). A free cast of six coins would usually land on a
 * different hexagram. So instead we cast only the thing that is genuinely
 * undetermined: which of this hexagram's lines are moving.
 *
 * For each line we toss three coins. If the toss is "old" (6 or 9) the line
 * moves. The line's yin/yang in the primary hexagram is taken from the card,
 * not from the toss, so the primary hexagram is preserved while the moving
 * pattern stays a true 1/4-per-line draw.
 */
export function castForHexagram(primaryNumber: number): CastResult {
  const primaryBits = bitsForCard(primaryNumber);
  if (!primaryBits) {
    throw new Error(`No hexagram found for card number ${primaryNumber}`);
  }

  const lines: CastLine[] = primaryBits.map((yang, i) => {
    const toss = tossThreeCoins();
    const moving = toss === 6 || toss === 9;
    // Report the toss value consistent with the line's actual yin/yang:
    // a moving yang line reads as 9, a moving yin line as 6; stable lines 7/8.
    const value: CoinValue = moving ? (yang ? 9 : 6) : yang ? 7 : 8;
    return { position: i + 1, value, yang, moving };
  });

  return finalizeCast(lines, primaryNumber);
}

/**
 * A free six-coin cast with no fixed primary hexagram. Reserved for the
 * future "draw a reading" surface; not used by the card-page panel.
 */
export function castFree(): CastResult {
  const lines: CastLine[] = [];
  for (let i = 0; i < 6; i++) {
    const value = tossThreeCoins();
    const yang = value === 7 || value === 9;
    const moving = value === 6 || value === 9;
    lines.push({ position: i + 1, value, yang, moving });
  }
  const primaryNumber = numberFromBits(lines.map((l) => l.yang)) ?? 1;
  return finalizeCast(lines, primaryNumber);
}

/** Shared tail of both cast paths: derive the changed hexagram. */
function finalizeCast(lines: CastLine[], primaryNumber: number): CastResult {
  const movingPositions = lines.filter((l) => l.moving).map((l) => l.position);

  let changedNumber: number | null = null;
  if (movingPositions.length > 0) {
    // Flip every moving line, keep stable lines, look up the result.
    const changedBits = lines.map((l) => (l.moving ? !l.yang : l.yang));
    changedNumber = numberFromBits(changedBits);
  }

  return { lines, primaryNumber, changedNumber, movingPositions };
}

/** Human-readable name for a coin value, for labels and aria text. */
export function coinValueName(value: CoinValue): string {
  switch (value) {
    case 6:
      return 'old yin';
    case 7:
      return 'young yang';
    case 8:
      return 'young yin';
    case 9:
      return 'old yang';
  }
}
