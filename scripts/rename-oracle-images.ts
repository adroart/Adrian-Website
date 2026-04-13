/**
 * Oracle Image Renamer
 *
 * Renames files matching Universal_NN.jpg → NN-card-name-slug.jpg
 * in place, no copying or cropping.
 *
 * Usage:
 *   npm run rename:oracle
 */

import { readdirSync, renameSync } from 'fs';
import { join } from 'path';

import { CARD_BY_NUMBER } from '../data/oracleData';
import { slugify } from './slugify';

const DIR = '/Users/adrianrasmussen/Documents/Files/1 Projects/Oracle Cards/Universal Langauge/Oracle Set/Final-bleed';

const files = readdirSync(DIR).filter(f => /\.(jpe?g|png|tiff?)$/i.test(f));

let done = 0;
const errors: string[] = [];

for (const file of files) {
  const match = file.match(/(\d+)/);
  if (!match) { console.warn(`  SKIP — no number found in "${file}"`); continue; }

  const num  = parseInt(match[1], 10);
  const card = CARD_BY_NUMBER.get(num);
  if (!card) { console.warn(`  SKIP — no card data for #${num}`); continue; }

  const nn      = String(num).padStart(2, '0');
  const newName = `${nn}-${slugify(card.card_name)}.jpg`;

  if (file === newName) { console.log(`  –  ${file} (already correct)`); done++; continue; }

  try {
    renameSync(join(DIR, file), join(DIR, newName));
    console.log(`  ✓  ${file.padEnd(22)} →  ${newName}`);
    done++;
  } catch (e: any) {
    console.error(`  ✗  ${file}: ${e.message}`);
    errors.push(`${file}: ${e.message}`);
  }
}

console.log(`\n${done} renamed in ${DIR}`);
if (errors.length) console.error(`\n${errors.length} errors:\n` + errors.join('\n'));
