/**
 * Trigram line patterns and hexagram composition helpers.
 *
 * Each trigram is stored top-to-bottom as [top, middle, bottom].
 * `true` = yang (solid line), `false` = yin (broken line).
 *
 * Used by OracleCardEntrance and OracleQREntrance to render the six-line
 * hexagram for a given card. OracleGateway renders a different (compressed,
 * orbital) hexagram set with its own historical line ordering and is not
 * migrated to this helper.
 */

export const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],  // Qian / Heaven
  '☷': [false, false, false],  // Kun  / Earth
  '☳': [true,  false, false],  // Zhen / Thunder
  '☴': [false, true,  true ],  // Xun  / Wind
  '☵': [false, true,  false],  // Kan  / Water
  '☲': [true,  false, true ],  // Li   / Fire
  '☶': [false, false, true ],  // Gen  / Mountain
  '☱': [true,  true,  false],  // Dui  / Lake
};

/**
 * Returns six booleans rendered top-to-bottom for a hexagram, given its
 * upper and lower trigram symbols.
 */
export function getHexagramLines(upper: string, lower: string): boolean[] {
  const u = TRIGRAM_LINES[upper] ?? [true, true, true];
  const l = TRIGRAM_LINES[lower] ?? [true, true, true];
  return [u[2], u[1], u[0], l[2], l[1], l[0]];
}
