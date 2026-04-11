/**
 * Maps the 8 Unicode trigram symbols to their yin/yang line patterns.
 * Lines are read bottom-up per I Ching convention.
 * true = yang (solid), false = yin (broken).
 */

type TrigramLines = [boolean, boolean, boolean]; // [bottom, middle, top]

export const TRIGRAM_LINES: Record<string, TrigramLines> = {
  '☰': [true,  true,  true ],  // Qian — Heaven
  '☷': [false, false, false],  // Kun  — Earth
  '☳': [true,  false, false],  // Zhen — Thunder
  '☴': [false, true,  true ],  // Xun  — Wind
  '☵': [false, true,  false],  // Kan  — Water
  '☲': [true,  false, true ],  // Li   — Fire
  '☶': [false, false, true ],  // Ken  — Mountain
  '☱': [true,  true,  false],  // Dui  — Lake
};

/**
 * Returns 6 boolean values ordered top-to-bottom for SVG rendering.
 * Upper trigram occupies the top 3 positions, lower the bottom 3.
 */
export function hexagramLines(
  upperSymbol: string,
  lowerSymbol: string,
): boolean[] {
  const upper = TRIGRAM_LINES[upperSymbol];
  const lower = TRIGRAM_LINES[lowerSymbol];
  if (!upper) throw new Error(`Unknown trigram symbol: "${upperSymbol}"`);
  if (!lower) throw new Error(`Unknown trigram symbol: "${lowerSymbol}"`);
  // Render top-to-bottom: upper[top→bottom], then lower[top→bottom]
  return [upper[2], upper[1], upper[0], lower[2], lower[1], lower[0]];
}
