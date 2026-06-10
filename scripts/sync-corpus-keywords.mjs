/**
 * Regenerates components/viewing/corpusKeywords.ts from the mandalacodes oracle
 * corpus — the single source of truth for the energy keywords of each of the 64
 * codes. Run this whenever the corpus keywords change in mandalacodes.
 *
 *   node scripts/sync-corpus-keywords.mjs
 *
 * Why this exists: viewing content (the sample, and any future baked fixture)
 * must NEVER hand-type keywords — those drift into generic prose fragments that
 * do not speak to the energy of the symbol. Keywords come from the reading or
 * they do not appear. This script is the only sanctioned way they enter this
 * repo; the generated file is committed so the build needs no cross-repo path.
 *
 * The corpus lives in a sibling repo. If the path moves, update CORPUS_PATH.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = resolve(here, '../../mandalacodes/data/oracle-corpus.json');
const OUT_PATH = resolve(here, '../components/viewing/corpusKeywords.ts');

const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));
const cards = corpus.cards || corpus;

const byCode = {};
for (const card of cards) {
  const n = card.gate ?? card.number ?? card.code;
  if (n == null || !Array.isArray(card.keywords) || card.keywords.length === 0) continue;
  byCode[n] = card.keywords;
}

const codes = Object.keys(byCode).map(Number).sort((a, b) => a - b);
if (codes.length !== 64) {
  console.error(`Expected 64 codes with keywords, found ${codes.length}. Aborting.`);
  process.exit(1);
}

const body = codes
  .map((n) => `  ${n}: ${JSON.stringify(byCode[n])},`)
  .join('\n');

const file = `/**
 * GENERATED FILE — do not edit by hand.
 * Source: mandalacodes/data/oracle-corpus.json (the canonical readings).
 * Regenerate: node scripts/sync-corpus-keywords.mjs
 *
 * The energy keywords of each of the 64 codes, keyed by code number. Viewing
 * content reads keywords from here by code so they always match the reading and
 * can never drift into hand-typed prose fragments.
 */
export const CORPUS_KEYWORDS: Record<number, string[]> = {
${body}
};

/** Keywords for a code, or [] if the code is unknown. */
export const keywordsForCode = (code: number): string[] => CORPUS_KEYWORDS[code] ?? [];
`;

writeFileSync(OUT_PATH, file);
console.log(`Wrote ${OUT_PATH} with ${codes.length} codes.`);
