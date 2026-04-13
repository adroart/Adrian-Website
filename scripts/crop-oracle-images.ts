/**
 * Oracle Image Cropper
 *
 * Crops 183px from all four sides of each image and saves with the
 * canonical slug name (e.g. 2.jpg → 02-beyond-the-shell.jpg).
 *
 * Usage:
 *   npm run crop:oracle
 */

import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

import { CARD_BY_NUMBER } from '../data/oracleData';
import { slugify } from './slugify';

// ── Config ────────────────────────────────────────────────────────────────────

const CROP   = 183;  // pixels to remove from each side
const SRC    = '/Users/adrianrasmussen/Documents/Files/1 Projects/Oracle Cards/Universal Langauge/Oracle Set/new images';
const OUT    = join(SRC, 'cropped');

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });

  const files = readdirSync(SRC).filter(f => /\.(jpe?g|png|tiff?)$/i.test(f) && f !== 'cropped');

  let done = 0;
  const errors: string[] = [];

  for (const file of files) {
    const num = parseInt(basename(file).replace(/\.[^.]+$/, ''), 10);
    if (isNaN(num)) { console.warn(`  SKIP — can't parse number from "${file}"`); continue; }

    const card = CARD_BY_NUMBER.get(num);
    if (!card) { console.warn(`  SKIP — no card data for #${num} ("${file}")`); continue; }

    const nn       = String(num).padStart(2, '0');
    const outName  = `${nn}-${slugify(card.card_name)}.jpg`;
    const srcPath  = join(SRC, file);
    const outPath  = join(OUT, outName);

    try {
      const meta   = await sharp(srcPath).metadata();
      const width  = meta.width!;
      const height = meta.height!;

      if (width <= CROP * 2 || height <= CROP * 2) {
        throw new Error(`Image too small to crop (${width}×${height})`);
      }

      await sharp(srcPath)
        .extract({
          left:   CROP,
          top:    CROP,
          width:  width  - CROP * 2,
          height: height - CROP * 2,
        })
        .jpeg({ quality: 100, mozjpeg: false })
        .toFile(outPath);

      console.log(`  ✓  ${file.padEnd(10)} →  ${outName}`);
      done++;

    } catch (e: any) {
      console.error(`  ✗  ${file}: ${e.message}`);
      errors.push(`${file}: ${e.message}`);
    }
  }

  console.log(`\n${done} cropped  →  ${OUT}`);
  if (errors.length) console.error(`\n${errors.length} errors:\n` + errors.join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
