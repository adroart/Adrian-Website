/**
 * I Ching changing-line statements — 384 entries (64 hexagrams x 6 lines).
 *
 * IMPORTANT: these are the CHANGING-LINE statements. They are NOT the
 * hexagram Judgement or Image — those live in synthesisData.ts as
 * judgement_lines / image_lines. When a coin-cast produces a moving line,
 * the casting panel reads the text for that line position from THIS file.
 *
 * TODO: Adrian — every line text below is an empty placeholder awaiting
 * your own translation / interpretation, written in the site voice
 * (mystical, non-prescriptive, no em dashes). Fill them in via the
 * /cast-content command, hexagram by hexagram. Until a field is filled,
 * getLineText returns an empty string and the UI shows a quiet
 * placeholder — the feature works fully with empty data.
 *
 * Index convention: lines[0] = line 1 (bottom) ... lines[5] = line 6 (top).
 */

export interface HexagramLineTexts {
  /** Six changing-line statements, index 0 = line 1 (bottom) to index 5 = line 6 (top). */
  lines: [string, string, string, string, string, string];
}

/** Changing-line statements keyed by hexagram / card number (1-64). */
export const ICHING_LINES: Record<number, HexagramLineTexts> = {
  1: {
    lines: [
      '', // TODO: Adrian — hexagram 1, line 1
      '', // TODO: Adrian — hexagram 1, line 2
      '', // TODO: Adrian — hexagram 1, line 3
      '', // TODO: Adrian — hexagram 1, line 4
      '', // TODO: Adrian — hexagram 1, line 5
      '', // TODO: Adrian — hexagram 1, line 6
    ],
  },
  2: {
    lines: [
      '', // TODO: Adrian — hexagram 2, line 1
      '', // TODO: Adrian — hexagram 2, line 2
      '', // TODO: Adrian — hexagram 2, line 3
      '', // TODO: Adrian — hexagram 2, line 4
      '', // TODO: Adrian — hexagram 2, line 5
      '', // TODO: Adrian — hexagram 2, line 6
    ],
  },
  3: {
    lines: [
      '', // TODO: Adrian — hexagram 3, line 1
      '', // TODO: Adrian — hexagram 3, line 2
      '', // TODO: Adrian — hexagram 3, line 3
      '', // TODO: Adrian — hexagram 3, line 4
      '', // TODO: Adrian — hexagram 3, line 5
      '', // TODO: Adrian — hexagram 3, line 6
    ],
  },
  4: {
    lines: [
      '', // TODO: Adrian — hexagram 4, line 1
      '', // TODO: Adrian — hexagram 4, line 2
      '', // TODO: Adrian — hexagram 4, line 3
      '', // TODO: Adrian — hexagram 4, line 4
      '', // TODO: Adrian — hexagram 4, line 5
      '', // TODO: Adrian — hexagram 4, line 6
    ],
  },
  5: {
    lines: [
      '', // TODO: Adrian — hexagram 5, line 1
      '', // TODO: Adrian — hexagram 5, line 2
      '', // TODO: Adrian — hexagram 5, line 3
      '', // TODO: Adrian — hexagram 5, line 4
      '', // TODO: Adrian — hexagram 5, line 5
      '', // TODO: Adrian — hexagram 5, line 6
    ],
  },
  6: {
    lines: [
      '', // TODO: Adrian — hexagram 6, line 1
      '', // TODO: Adrian — hexagram 6, line 2
      '', // TODO: Adrian — hexagram 6, line 3
      '', // TODO: Adrian — hexagram 6, line 4
      '', // TODO: Adrian — hexagram 6, line 5
      '', // TODO: Adrian — hexagram 6, line 6
    ],
  },
  7: {
    lines: [
      '', // TODO: Adrian — hexagram 7, line 1
      '', // TODO: Adrian — hexagram 7, line 2
      '', // TODO: Adrian — hexagram 7, line 3
      '', // TODO: Adrian — hexagram 7, line 4
      '', // TODO: Adrian — hexagram 7, line 5
      '', // TODO: Adrian — hexagram 7, line 6
    ],
  },
  8: {
    lines: [
      '', // TODO: Adrian — hexagram 8, line 1
      '', // TODO: Adrian — hexagram 8, line 2
      '', // TODO: Adrian — hexagram 8, line 3
      '', // TODO: Adrian — hexagram 8, line 4
      '', // TODO: Adrian — hexagram 8, line 5
      '', // TODO: Adrian — hexagram 8, line 6
    ],
  },
  9: {
    lines: [
      '', // TODO: Adrian — hexagram 9, line 1
      '', // TODO: Adrian — hexagram 9, line 2
      '', // TODO: Adrian — hexagram 9, line 3
      '', // TODO: Adrian — hexagram 9, line 4
      '', // TODO: Adrian — hexagram 9, line 5
      '', // TODO: Adrian — hexagram 9, line 6
    ],
  },
  10: {
    lines: [
      '', // TODO: Adrian — hexagram 10, line 1
      '', // TODO: Adrian — hexagram 10, line 2
      '', // TODO: Adrian — hexagram 10, line 3
      '', // TODO: Adrian — hexagram 10, line 4
      '', // TODO: Adrian — hexagram 10, line 5
      '', // TODO: Adrian — hexagram 10, line 6
    ],
  },
  11: {
    lines: [
      '', // TODO: Adrian — hexagram 11, line 1
      '', // TODO: Adrian — hexagram 11, line 2
      '', // TODO: Adrian — hexagram 11, line 3
      '', // TODO: Adrian — hexagram 11, line 4
      '', // TODO: Adrian — hexagram 11, line 5
      '', // TODO: Adrian — hexagram 11, line 6
    ],
  },
  12: {
    lines: [
      '', // TODO: Adrian — hexagram 12, line 1
      '', // TODO: Adrian — hexagram 12, line 2
      '', // TODO: Adrian — hexagram 12, line 3
      '', // TODO: Adrian — hexagram 12, line 4
      '', // TODO: Adrian — hexagram 12, line 5
      '', // TODO: Adrian — hexagram 12, line 6
    ],
  },
  13: {
    lines: [
      '', // TODO: Adrian — hexagram 13, line 1
      '', // TODO: Adrian — hexagram 13, line 2
      '', // TODO: Adrian — hexagram 13, line 3
      '', // TODO: Adrian — hexagram 13, line 4
      '', // TODO: Adrian — hexagram 13, line 5
      '', // TODO: Adrian — hexagram 13, line 6
    ],
  },
  14: {
    lines: [
      '', // TODO: Adrian — hexagram 14, line 1
      '', // TODO: Adrian — hexagram 14, line 2
      '', // TODO: Adrian — hexagram 14, line 3
      '', // TODO: Adrian — hexagram 14, line 4
      '', // TODO: Adrian — hexagram 14, line 5
      '', // TODO: Adrian — hexagram 14, line 6
    ],
  },
  15: {
    lines: [
      '', // TODO: Adrian — hexagram 15, line 1
      '', // TODO: Adrian — hexagram 15, line 2
      '', // TODO: Adrian — hexagram 15, line 3
      '', // TODO: Adrian — hexagram 15, line 4
      '', // TODO: Adrian — hexagram 15, line 5
      '', // TODO: Adrian — hexagram 15, line 6
    ],
  },
  16: {
    lines: [
      '', // TODO: Adrian — hexagram 16, line 1
      '', // TODO: Adrian — hexagram 16, line 2
      '', // TODO: Adrian — hexagram 16, line 3
      '', // TODO: Adrian — hexagram 16, line 4
      '', // TODO: Adrian — hexagram 16, line 5
      '', // TODO: Adrian — hexagram 16, line 6
    ],
  },
  17: {
    lines: [
      '', // TODO: Adrian — hexagram 17, line 1
      '', // TODO: Adrian — hexagram 17, line 2
      '', // TODO: Adrian — hexagram 17, line 3
      '', // TODO: Adrian — hexagram 17, line 4
      '', // TODO: Adrian — hexagram 17, line 5
      '', // TODO: Adrian — hexagram 17, line 6
    ],
  },
  18: {
    lines: [
      '', // TODO: Adrian — hexagram 18, line 1
      '', // TODO: Adrian — hexagram 18, line 2
      '', // TODO: Adrian — hexagram 18, line 3
      '', // TODO: Adrian — hexagram 18, line 4
      '', // TODO: Adrian — hexagram 18, line 5
      '', // TODO: Adrian — hexagram 18, line 6
    ],
  },
  19: {
    lines: [
      '', // TODO: Adrian — hexagram 19, line 1
      '', // TODO: Adrian — hexagram 19, line 2
      '', // TODO: Adrian — hexagram 19, line 3
      '', // TODO: Adrian — hexagram 19, line 4
      '', // TODO: Adrian — hexagram 19, line 5
      '', // TODO: Adrian — hexagram 19, line 6
    ],
  },
  20: {
    lines: [
      '', // TODO: Adrian — hexagram 20, line 1
      '', // TODO: Adrian — hexagram 20, line 2
      '', // TODO: Adrian — hexagram 20, line 3
      '', // TODO: Adrian — hexagram 20, line 4
      '', // TODO: Adrian — hexagram 20, line 5
      '', // TODO: Adrian — hexagram 20, line 6
    ],
  },
  21: {
    lines: [
      '', // TODO: Adrian — hexagram 21, line 1
      '', // TODO: Adrian — hexagram 21, line 2
      '', // TODO: Adrian — hexagram 21, line 3
      '', // TODO: Adrian — hexagram 21, line 4
      '', // TODO: Adrian — hexagram 21, line 5
      '', // TODO: Adrian — hexagram 21, line 6
    ],
  },
  22: {
    lines: [
      '', // TODO: Adrian — hexagram 22, line 1
      '', // TODO: Adrian — hexagram 22, line 2
      '', // TODO: Adrian — hexagram 22, line 3
      '', // TODO: Adrian — hexagram 22, line 4
      '', // TODO: Adrian — hexagram 22, line 5
      '', // TODO: Adrian — hexagram 22, line 6
    ],
  },
  23: {
    lines: [
      '', // TODO: Adrian — hexagram 23, line 1
      '', // TODO: Adrian — hexagram 23, line 2
      '', // TODO: Adrian — hexagram 23, line 3
      '', // TODO: Adrian — hexagram 23, line 4
      '', // TODO: Adrian — hexagram 23, line 5
      '', // TODO: Adrian — hexagram 23, line 6
    ],
  },
  24: {
    lines: [
      '', // TODO: Adrian — hexagram 24, line 1
      '', // TODO: Adrian — hexagram 24, line 2
      '', // TODO: Adrian — hexagram 24, line 3
      '', // TODO: Adrian — hexagram 24, line 4
      '', // TODO: Adrian — hexagram 24, line 5
      '', // TODO: Adrian — hexagram 24, line 6
    ],
  },
  25: {
    lines: [
      '', // TODO: Adrian — hexagram 25, line 1
      '', // TODO: Adrian — hexagram 25, line 2
      '', // TODO: Adrian — hexagram 25, line 3
      '', // TODO: Adrian — hexagram 25, line 4
      '', // TODO: Adrian — hexagram 25, line 5
      '', // TODO: Adrian — hexagram 25, line 6
    ],
  },
  26: {
    lines: [
      '', // TODO: Adrian — hexagram 26, line 1
      '', // TODO: Adrian — hexagram 26, line 2
      '', // TODO: Adrian — hexagram 26, line 3
      '', // TODO: Adrian — hexagram 26, line 4
      '', // TODO: Adrian — hexagram 26, line 5
      '', // TODO: Adrian — hexagram 26, line 6
    ],
  },
  27: {
    lines: [
      '', // TODO: Adrian — hexagram 27, line 1
      '', // TODO: Adrian — hexagram 27, line 2
      '', // TODO: Adrian — hexagram 27, line 3
      '', // TODO: Adrian — hexagram 27, line 4
      '', // TODO: Adrian — hexagram 27, line 5
      '', // TODO: Adrian — hexagram 27, line 6
    ],
  },
  28: {
    lines: [
      '', // TODO: Adrian — hexagram 28, line 1
      '', // TODO: Adrian — hexagram 28, line 2
      '', // TODO: Adrian — hexagram 28, line 3
      '', // TODO: Adrian — hexagram 28, line 4
      '', // TODO: Adrian — hexagram 28, line 5
      '', // TODO: Adrian — hexagram 28, line 6
    ],
  },
  29: {
    lines: [
      '', // TODO: Adrian — hexagram 29, line 1
      '', // TODO: Adrian — hexagram 29, line 2
      '', // TODO: Adrian — hexagram 29, line 3
      '', // TODO: Adrian — hexagram 29, line 4
      '', // TODO: Adrian — hexagram 29, line 5
      '', // TODO: Adrian — hexagram 29, line 6
    ],
  },
  30: {
    lines: [
      '', // TODO: Adrian — hexagram 30, line 1
      '', // TODO: Adrian — hexagram 30, line 2
      '', // TODO: Adrian — hexagram 30, line 3
      '', // TODO: Adrian — hexagram 30, line 4
      '', // TODO: Adrian — hexagram 30, line 5
      '', // TODO: Adrian — hexagram 30, line 6
    ],
  },
  31: {
    lines: [
      '', // TODO: Adrian — hexagram 31, line 1
      '', // TODO: Adrian — hexagram 31, line 2
      '', // TODO: Adrian — hexagram 31, line 3
      '', // TODO: Adrian — hexagram 31, line 4
      '', // TODO: Adrian — hexagram 31, line 5
      '', // TODO: Adrian — hexagram 31, line 6
    ],
  },
  32: {
    lines: [
      '', // TODO: Adrian — hexagram 32, line 1
      '', // TODO: Adrian — hexagram 32, line 2
      '', // TODO: Adrian — hexagram 32, line 3
      '', // TODO: Adrian — hexagram 32, line 4
      '', // TODO: Adrian — hexagram 32, line 5
      '', // TODO: Adrian — hexagram 32, line 6
    ],
  },
  33: {
    lines: [
      '', // TODO: Adrian — hexagram 33, line 1
      '', // TODO: Adrian — hexagram 33, line 2
      '', // TODO: Adrian — hexagram 33, line 3
      '', // TODO: Adrian — hexagram 33, line 4
      '', // TODO: Adrian — hexagram 33, line 5
      '', // TODO: Adrian — hexagram 33, line 6
    ],
  },
  34: {
    lines: [
      '', // TODO: Adrian — hexagram 34, line 1
      '', // TODO: Adrian — hexagram 34, line 2
      '', // TODO: Adrian — hexagram 34, line 3
      '', // TODO: Adrian — hexagram 34, line 4
      '', // TODO: Adrian — hexagram 34, line 5
      '', // TODO: Adrian — hexagram 34, line 6
    ],
  },
  35: {
    lines: [
      '', // TODO: Adrian — hexagram 35, line 1
      '', // TODO: Adrian — hexagram 35, line 2
      '', // TODO: Adrian — hexagram 35, line 3
      '', // TODO: Adrian — hexagram 35, line 4
      '', // TODO: Adrian — hexagram 35, line 5
      '', // TODO: Adrian — hexagram 35, line 6
    ],
  },
  36: {
    lines: [
      '', // TODO: Adrian — hexagram 36, line 1
      '', // TODO: Adrian — hexagram 36, line 2
      '', // TODO: Adrian — hexagram 36, line 3
      '', // TODO: Adrian — hexagram 36, line 4
      '', // TODO: Adrian — hexagram 36, line 5
      '', // TODO: Adrian — hexagram 36, line 6
    ],
  },
  37: {
    lines: [
      '', // TODO: Adrian — hexagram 37, line 1
      '', // TODO: Adrian — hexagram 37, line 2
      '', // TODO: Adrian — hexagram 37, line 3
      '', // TODO: Adrian — hexagram 37, line 4
      '', // TODO: Adrian — hexagram 37, line 5
      '', // TODO: Adrian — hexagram 37, line 6
    ],
  },
  38: {
    lines: [
      '', // TODO: Adrian — hexagram 38, line 1
      '', // TODO: Adrian — hexagram 38, line 2
      '', // TODO: Adrian — hexagram 38, line 3
      '', // TODO: Adrian — hexagram 38, line 4
      '', // TODO: Adrian — hexagram 38, line 5
      '', // TODO: Adrian — hexagram 38, line 6
    ],
  },
  39: {
    lines: [
      '', // TODO: Adrian — hexagram 39, line 1
      '', // TODO: Adrian — hexagram 39, line 2
      '', // TODO: Adrian — hexagram 39, line 3
      '', // TODO: Adrian — hexagram 39, line 4
      '', // TODO: Adrian — hexagram 39, line 5
      '', // TODO: Adrian — hexagram 39, line 6
    ],
  },
  40: {
    lines: [
      '', // TODO: Adrian — hexagram 40, line 1
      '', // TODO: Adrian — hexagram 40, line 2
      '', // TODO: Adrian — hexagram 40, line 3
      '', // TODO: Adrian — hexagram 40, line 4
      '', // TODO: Adrian — hexagram 40, line 5
      '', // TODO: Adrian — hexagram 40, line 6
    ],
  },
  41: {
    lines: [
      '', // TODO: Adrian — hexagram 41, line 1
      '', // TODO: Adrian — hexagram 41, line 2
      '', // TODO: Adrian — hexagram 41, line 3
      '', // TODO: Adrian — hexagram 41, line 4
      '', // TODO: Adrian — hexagram 41, line 5
      '', // TODO: Adrian — hexagram 41, line 6
    ],
  },
  42: {
    lines: [
      '', // TODO: Adrian — hexagram 42, line 1
      '', // TODO: Adrian — hexagram 42, line 2
      '', // TODO: Adrian — hexagram 42, line 3
      '', // TODO: Adrian — hexagram 42, line 4
      '', // TODO: Adrian — hexagram 42, line 5
      '', // TODO: Adrian — hexagram 42, line 6
    ],
  },
  43: {
    lines: [
      '', // TODO: Adrian — hexagram 43, line 1
      '', // TODO: Adrian — hexagram 43, line 2
      '', // TODO: Adrian — hexagram 43, line 3
      '', // TODO: Adrian — hexagram 43, line 4
      '', // TODO: Adrian — hexagram 43, line 5
      '', // TODO: Adrian — hexagram 43, line 6
    ],
  },
  44: {
    lines: [
      '', // TODO: Adrian — hexagram 44, line 1
      '', // TODO: Adrian — hexagram 44, line 2
      '', // TODO: Adrian — hexagram 44, line 3
      '', // TODO: Adrian — hexagram 44, line 4
      '', // TODO: Adrian — hexagram 44, line 5
      '', // TODO: Adrian — hexagram 44, line 6
    ],
  },
  45: {
    lines: [
      '', // TODO: Adrian — hexagram 45, line 1
      '', // TODO: Adrian — hexagram 45, line 2
      '', // TODO: Adrian — hexagram 45, line 3
      '', // TODO: Adrian — hexagram 45, line 4
      '', // TODO: Adrian — hexagram 45, line 5
      '', // TODO: Adrian — hexagram 45, line 6
    ],
  },
  46: {
    lines: [
      '', // TODO: Adrian — hexagram 46, line 1
      '', // TODO: Adrian — hexagram 46, line 2
      '', // TODO: Adrian — hexagram 46, line 3
      '', // TODO: Adrian — hexagram 46, line 4
      '', // TODO: Adrian — hexagram 46, line 5
      '', // TODO: Adrian — hexagram 46, line 6
    ],
  },
  47: {
    lines: [
      '', // TODO: Adrian — hexagram 47, line 1
      '', // TODO: Adrian — hexagram 47, line 2
      '', // TODO: Adrian — hexagram 47, line 3
      '', // TODO: Adrian — hexagram 47, line 4
      '', // TODO: Adrian — hexagram 47, line 5
      '', // TODO: Adrian — hexagram 47, line 6
    ],
  },
  48: {
    lines: [
      '', // TODO: Adrian — hexagram 48, line 1
      '', // TODO: Adrian — hexagram 48, line 2
      '', // TODO: Adrian — hexagram 48, line 3
      '', // TODO: Adrian — hexagram 48, line 4
      '', // TODO: Adrian — hexagram 48, line 5
      '', // TODO: Adrian — hexagram 48, line 6
    ],
  },
  49: {
    lines: [
      '', // TODO: Adrian — hexagram 49, line 1
      '', // TODO: Adrian — hexagram 49, line 2
      '', // TODO: Adrian — hexagram 49, line 3
      '', // TODO: Adrian — hexagram 49, line 4
      '', // TODO: Adrian — hexagram 49, line 5
      '', // TODO: Adrian — hexagram 49, line 6
    ],
  },
  50: {
    lines: [
      '', // TODO: Adrian — hexagram 50, line 1
      '', // TODO: Adrian — hexagram 50, line 2
      '', // TODO: Adrian — hexagram 50, line 3
      '', // TODO: Adrian — hexagram 50, line 4
      '', // TODO: Adrian — hexagram 50, line 5
      '', // TODO: Adrian — hexagram 50, line 6
    ],
  },
  51: {
    lines: [
      '', // TODO: Adrian — hexagram 51, line 1
      '', // TODO: Adrian — hexagram 51, line 2
      '', // TODO: Adrian — hexagram 51, line 3
      '', // TODO: Adrian — hexagram 51, line 4
      '', // TODO: Adrian — hexagram 51, line 5
      '', // TODO: Adrian — hexagram 51, line 6
    ],
  },
  52: {
    lines: [
      '', // TODO: Adrian — hexagram 52, line 1
      '', // TODO: Adrian — hexagram 52, line 2
      '', // TODO: Adrian — hexagram 52, line 3
      '', // TODO: Adrian — hexagram 52, line 4
      '', // TODO: Adrian — hexagram 52, line 5
      '', // TODO: Adrian — hexagram 52, line 6
    ],
  },
  53: {
    lines: [
      '', // TODO: Adrian — hexagram 53, line 1
      '', // TODO: Adrian — hexagram 53, line 2
      '', // TODO: Adrian — hexagram 53, line 3
      '', // TODO: Adrian — hexagram 53, line 4
      '', // TODO: Adrian — hexagram 53, line 5
      '', // TODO: Adrian — hexagram 53, line 6
    ],
  },
  54: {
    lines: [
      '', // TODO: Adrian — hexagram 54, line 1
      '', // TODO: Adrian — hexagram 54, line 2
      '', // TODO: Adrian — hexagram 54, line 3
      '', // TODO: Adrian — hexagram 54, line 4
      '', // TODO: Adrian — hexagram 54, line 5
      '', // TODO: Adrian — hexagram 54, line 6
    ],
  },
  55: {
    lines: [
      '', // TODO: Adrian — hexagram 55, line 1
      '', // TODO: Adrian — hexagram 55, line 2
      '', // TODO: Adrian — hexagram 55, line 3
      '', // TODO: Adrian — hexagram 55, line 4
      '', // TODO: Adrian — hexagram 55, line 5
      '', // TODO: Adrian — hexagram 55, line 6
    ],
  },
  56: {
    lines: [
      '', // TODO: Adrian — hexagram 56, line 1
      '', // TODO: Adrian — hexagram 56, line 2
      '', // TODO: Adrian — hexagram 56, line 3
      '', // TODO: Adrian — hexagram 56, line 4
      '', // TODO: Adrian — hexagram 56, line 5
      '', // TODO: Adrian — hexagram 56, line 6
    ],
  },
  57: {
    lines: [
      '', // TODO: Adrian — hexagram 57, line 1
      '', // TODO: Adrian — hexagram 57, line 2
      '', // TODO: Adrian — hexagram 57, line 3
      '', // TODO: Adrian — hexagram 57, line 4
      '', // TODO: Adrian — hexagram 57, line 5
      '', // TODO: Adrian — hexagram 57, line 6
    ],
  },
  58: {
    lines: [
      '', // TODO: Adrian — hexagram 58, line 1
      '', // TODO: Adrian — hexagram 58, line 2
      '', // TODO: Adrian — hexagram 58, line 3
      '', // TODO: Adrian — hexagram 58, line 4
      '', // TODO: Adrian — hexagram 58, line 5
      '', // TODO: Adrian — hexagram 58, line 6
    ],
  },
  59: {
    lines: [
      '', // TODO: Adrian — hexagram 59, line 1
      '', // TODO: Adrian — hexagram 59, line 2
      '', // TODO: Adrian — hexagram 59, line 3
      '', // TODO: Adrian — hexagram 59, line 4
      '', // TODO: Adrian — hexagram 59, line 5
      '', // TODO: Adrian — hexagram 59, line 6
    ],
  },
  60: {
    lines: [
      '', // TODO: Adrian — hexagram 60, line 1
      '', // TODO: Adrian — hexagram 60, line 2
      '', // TODO: Adrian — hexagram 60, line 3
      '', // TODO: Adrian — hexagram 60, line 4
      '', // TODO: Adrian — hexagram 60, line 5
      '', // TODO: Adrian — hexagram 60, line 6
    ],
  },
  61: {
    lines: [
      '', // TODO: Adrian — hexagram 61, line 1
      '', // TODO: Adrian — hexagram 61, line 2
      '', // TODO: Adrian — hexagram 61, line 3
      '', // TODO: Adrian — hexagram 61, line 4
      '', // TODO: Adrian — hexagram 61, line 5
      '', // TODO: Adrian — hexagram 61, line 6
    ],
  },
  62: {
    lines: [
      '', // TODO: Adrian — hexagram 62, line 1
      '', // TODO: Adrian — hexagram 62, line 2
      '', // TODO: Adrian — hexagram 62, line 3
      '', // TODO: Adrian — hexagram 62, line 4
      '', // TODO: Adrian — hexagram 62, line 5
      '', // TODO: Adrian — hexagram 62, line 6
    ],
  },
  63: {
    lines: [
      '', // TODO: Adrian — hexagram 63, line 1
      '', // TODO: Adrian — hexagram 63, line 2
      '', // TODO: Adrian — hexagram 63, line 3
      '', // TODO: Adrian — hexagram 63, line 4
      '', // TODO: Adrian — hexagram 63, line 5
      '', // TODO: Adrian — hexagram 63, line 6
    ],
  },
  64: {
    lines: [
      '', // TODO: Adrian — hexagram 64, line 1
      '', // TODO: Adrian — hexagram 64, line 2
      '', // TODO: Adrian — hexagram 64, line 3
      '', // TODO: Adrian — hexagram 64, line 4
      '', // TODO: Adrian — hexagram 64, line 5
      '', // TODO: Adrian — hexagram 64, line 6
    ],
  },
};

/**
 * The changing-line statement for a given hexagram and line position.
 *
 * @param hexNumber  Hexagram / card number, 1-64.
 * @param position   Line position, 1 (bottom) to 6 (top).
 * @returns The line text, or an empty string when not yet written or out of range.
 */
export function getLineText(hexNumber: number, position: number): string {
  if (position < 1 || position > 6) return '';
  return ICHING_LINES[hexNumber]?.lines[position - 1] ?? '';
}
