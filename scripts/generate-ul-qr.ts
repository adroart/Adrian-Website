/**
 * Universal Language QR Plaque Generator
 *
 * Generates print-ready SVG oracle plaques for all 64 Universal Language cards,
 * plus two marketing plaques for landing pages.
 *
 * Each plaque (90×120 mm) contains:
 *   - I Ching hexagram drawn from trigram data (6 SVG bars, no font dependency)
 *   - Hexagram name
 *   - Oracle card name (Gene Keys title)
 *   - Gene Keys shadow · gift · siddhi keywords
 *   - QR code (error-correction level H — survives up to 30% damage)
 *   - Card number (N / 64)
 *   - Scan label
 *
 * Usage:
 *   npm run generate:qr
 *
 * Edit BASE_URL / URLS below when canonical paths change, then re-run.
 * An index.html preview is written alongside the SVGs for easy browser review.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

import { CARD_BY_NUMBER, ALL_CARDS } from '../data/oracleData';
import { hexagramLines } from './trigram-lines';
import { slugify } from './slugify';

// ── URL config — edit here when canonical paths change ────────────────────────

const BASE_URL = 'https://adrianrasmussen.com';

const URLS = {
  oracleCard:        (n: number) => `${BASE_URL}/oracle/universal-language/${n}`,
  oracleDeckLanding:              `${BASE_URL}/oracle/universal-language`,
};

// ── Plaque dimensions (viewBox units ≈ mm at 1:1) ────────────────────────────

const W  = 90;
const H  = 120;
const CX = W / 2;

// Hexagram geometry
const HEX_TOP    = 7;
const HEX_LINE_H = 2.5;
const HEX_GAP_H  = 1.5;
const TRIG_GAP   = 3;
// Total height: 6×2.5 + 5×1.5 + 3 = 25.5
const HEX_BOTTOM = HEX_TOP + 6 * HEX_LINE_H + 5 * HEX_GAP_H + TRIG_GAP;

// Text layout (dominant-baseline: hanging, so y = top of text block)
const HEX_NAME_Y  = HEX_BOTTOM + 3.5;   // I Ching hexagram name
const CARD_NAME_Y = HEX_NAME_Y + 6 + 2; // Oracle card name (Gene Keys title)
const KEYWORDS_Y  = CARD_NAME_Y + 8 + 2; // Shadow · Gift · Siddhi
const QR_SIZE     = 32;
const QR_Y        = KEYWORDS_Y + 4.5 + 5; // top of QR block
const QR_X        = CX - QR_SIZE / 2;
const NUMBER_Y    = QR_Y + QR_SIZE + 3;   // N / 64
const LABEL_Y     = NUMBER_Y + 6.5 + 2;   // "Scan for the full reading"

// ── Colour palette ────────────────────────────────────────────────────────────

const PAPER  = '#f5f0e8';  // warm off-white background
const INK    = '#2c2c2c';  // hexagram lines, QR dark modules, main text
const BRONZE = '#8b6914';  // hexagram name accent
const WOOD   = '#4a3f2f';  // number + keywords
const MUTED  = '#8b7355';  // scan label

// ── SVG drawing helpers ───────────────────────────────────────────────────────

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

function yangLine(x: number, y: number, w: number, h: number): string {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${INK}"/>`;
}

function yinLine(x: number, y: number, w: number, h: number): string {
  const seg = (w - 4) / 2;
  return (
    `<rect x="${r(x)}" y="${r(y)}" width="${r(seg)}" height="${r(h)}" fill="${INK}"/>` +
    `<rect x="${r(x + seg + 4)}" y="${r(y)}" width="${r(seg)}" height="${r(h)}" fill="${INK}"/>`
  );
}

function drawHexagram(linesTopToBottom: boolean[]): string {
  const lineW = 32;
  const x0    = CX - lineW / 2;
  let svg = '';
  let y   = HEX_TOP;

  for (let i = 0; i < 6; i++) {
    if (i === 3) y += TRIG_GAP;
    svg += linesTopToBottom[i]
      ? yangLine(x0, y, lineW, HEX_LINE_H)
      : yinLine(x0, y, lineW, HEX_LINE_H);
    y += HEX_LINE_H + HEX_GAP_H;
  }
  return svg;
}

/** Embeds the qrcode SVG output as a nested <svg> element at the QR position. */
function embedQR(qrSvgStr: string): string {
  const vbMatch    = qrSvgStr.match(/viewBox="([^"]+)"/);
  const innerMatch = qrSvgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const viewBox    = vbMatch ? vbMatch[1] : '0 0 37 37';
  const inner      = innerMatch ? innerMatch[1].trim() : '';
  return (
    `<svg x="${r(QR_X)}" y="${r(QR_Y)}" width="${QR_SIZE}" height="${QR_SIZE}" ` +
    `viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
  );
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Plaque builder ────────────────────────────────────────────────────────────

interface PlaqueOpts {
  hexagram:     boolean[];
  hexagramName: string;
  cardName:     string;
  keywords:     string;   // e.g. "Fantasy · Anticipation · Emanation"
  number:       number | null;
  qrUrl:        string;
  scanLabel:    string;
}

async function buildPlaque(opts: PlaqueOpts): Promise<string> {
  const { hexagram, hexagramName, cardName, keywords, number, qrUrl, scanLabel } = opts;

  const qrSvgStr = await QRCode.toString(qrUrl, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'H',   // highest: survives up to 30% damage
    color: { dark: INK, light: PAPER },
  });

  const hexSvg = drawHexagram(hexagram);
  const qrSvg  = embedQR(qrSvgStr);

  const numberEl = number !== null
    ? `<text x="${CX}" y="${r(NUMBER_Y)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Cinzel, Palatino, serif"
    font-size="5" letter-spacing="1" fill="${WOOD}">${number} / 64</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${PAPER}"/>

  <!-- Hexagram (6 bars derived from trigram line data — no font dependency) -->
  ${hexSvg}

  <!-- I Ching hexagram name -->
  <text x="${CX}" y="${r(HEX_NAME_Y)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Cinzel, Palatino, serif"
    font-size="4.5" letter-spacing="0.5" fill="${BRONZE}">${escXml(hexagramName.toUpperCase())}</text>

  <!-- Oracle card name (Gene Keys title) -->
  <text x="${CX}" y="${r(CARD_NAME_Y)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="'Cormorant Garamond', Garamond, Georgia, serif"
    font-size="6.5" font-style="italic" fill="${INK}">${escXml(cardName)}</text>

  <!-- Gene Keys: Shadow · Gift · Siddhi -->
  <text x="${CX}" y="${r(KEYWORDS_Y)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Lato, Helvetica, sans-serif"
    font-size="3.2" letter-spacing="0.4" fill="${WOOD}">${escXml(keywords)}</text>

  <!-- QR code (error-correction H) -->
  ${qrSvg}

  <!-- Card number -->
  ${numberEl}

  <!-- Scan label -->
  <text x="${CX}" y="${r(LABEL_Y)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Lato, Helvetica, sans-serif"
    font-size="3.5" letter-spacing="0.3" fill="${MUTED}">${escXml(scanLabel)}</text>

</svg>`;
}

// ── Index HTML builder ────────────────────────────────────────────────────────

function buildIndex(cards: Array<{ number: number; filename: string; cardName: string }>): string {
  const items = cards.map(({ number, filename, cardName }) => `
    <div class="item">
      <a href="oracle/${filename}" target="_blank">
        <img src="oracle/${filename}" alt="Card ${number}">
      </a>
      <div class="label">${number} / 64 — ${cardName}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Universal Language Oracle Plaques</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1a1612; font-family: sans-serif; padding: 24px; }
    h1 { color: #f5f0e8; font-size: 18px; font-weight: 400; letter-spacing: 0.15em;
         text-transform: uppercase; margin-bottom: 8px; }
    p  { color: #8b7355; font-size: 12px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .item { text-align: center; }
    .item img { width: 100%; border: 1px solid #333; display: block; background: #f5f0e8; }
    .item img:hover { border-color: #8b6914; }
    .label { color: #8b7355; font-size: 10px; margin-top: 5px; line-height: 1.4; }
    a { text-decoration: none; }
  </style>
</head>
<body>
  <h1>Universal Language — Oracle Plaques</h1>
  <p>64 cards · Click any plaque to open the full SVG · Print-ready at 90×120 mm</p>
  <div class="grid">${items}
  </div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outRoot   = join(scriptDir, 'output', 'ul-qr-plaques');
  const oracleDir = join(outRoot, 'oracle');
  const mktDir    = join(outRoot, 'marketing');
  mkdirSync(oracleDir, { recursive: true });
  mkdirSync(mktDir,    { recursive: true });

  const indexEntries: Array<{ number: number; filename: string; cardName: string }> = [];
  let count = 0;

  for (let n = 1; n <= 64; n++) {
    const card = CARD_BY_NUMBER.get(n);
    if (!card) { console.warn(`  SKIP — no oracle card for #${n}`); continue; }

    const lines    = hexagramLines(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
    const keywords = `${card.gene_keys.shadow} · ${card.gene_keys.gift} · ${card.gene_keys.siddhi}`;

    const svg = await buildPlaque({
      hexagram:     lines,
      hexagramName: card.iching.hexagram_name,
      cardName:     card.card_name,
      keywords,
      number:       n,
      qrUrl:        URLS.oracleCard(n),
      scanLabel:    'Scan for the full reading',
    });

    const nn       = String(n).padStart(2, '0');
    const filename = `oracle-${nn}-${slugify(card.card_name)}.svg`;
    writeFileSync(join(oracleDir, filename), svg, 'utf8');
    indexEntries.push({ number: n, filename, cardName: card.card_name });
    count++;

    if (n % 16 === 0) process.stdout.write(`  ${n}/64\n`);
  }

  // Marketing: oracle deck landing
  const card1   = CARD_BY_NUMBER.get(1)!;
  const allYang = hexagramLines(card1.iching.upper_trigram.symbol, card1.iching.lower_trigram.symbol);

  const mktSvg = await buildPlaque({
    hexagram:     allYang,
    hexagramName: 'Universal Language',
    cardName:     'The Oracle Deck',
    keywords:     '',
    number:       null,
    qrUrl:        URLS.oracleDeckLanding,
    scanLabel:    'adrianrasmussen.com',
  });
  writeFileSync(join(mktDir, 'oracle-deck-landing.svg'), mktSvg, 'utf8');

  // Preview index
  writeFileSync(join(outRoot, 'index.html'), buildIndex(indexEntries), 'utf8');

  console.log(`\nGenerated:`);
  console.log(`  ${count} oracle plaques → ${oracleDir}`);
  console.log(`  1 marketing plaque → ${mktDir}`);
  console.log(`  Preview → ${join(outRoot, 'index.html')}`);
  console.log(`  Total: ${count + 1} SVG files`);
}

main().catch(err => { console.error(err); process.exit(1); });
