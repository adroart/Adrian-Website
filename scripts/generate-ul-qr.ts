/**
 * Universal Language QR Plaque Generator
 *
 * Design principles:
 *  - Generous white space above and below the hexagram — it should breathe
 *  - Clear typographic hierarchy: hexagram name (label) → card name (hero) → keywords (whisper)
 *  - Hexagram lines are precise and narrow — a sigil, not a banner
 *  - QR is large enough to scan reliably from any phone distance
 *  - Card number sits quietly at the bottom like a print edition mark
 *  - No decorative noise — the content is the design
 *
 * Usage:
 *   npm run generate:qr
 *
 * Edit BASE_URL when canonical paths change, then re-run.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

import { CARD_BY_NUMBER } from '../data/oracleData';
import { hexagramLines } from './trigram-lines';
import { slugify } from './slugify';

// ── URL config — edit here when canonical paths change ────────────────────────

const BASE_URL = 'https://adrianrasmussen.com';

const URLS = {
  // Short redirect — hosted on your domain, never depends on a third party.
  // /qr/:number → /oracle/universal-language/:number?ref=qr (via functions/qr/[number].js)
  // Update that one file if the destination ever changes; no reprinting needed.
  oracleCard:        (n: number) => `${BASE_URL}/qr/${n}`,
  oracleDeckLanding:              `${BASE_URL}/oracle/universal-language`,
};

// ── Plaque dimensions ─────────────────────────────────────────────────────────
// 85×130 mm — portrait card, generous proportions, wider than typical label

const W  = 85;   // mm
const H  = 130;  // mm
const CX = W / 2;

// ── Hexagram geometry ─────────────────────────────────────────────────────────
// Lines are narrow and centred — approximately 30% of plaque width.
// No gap between upper and lower trigrams; all 6 lines read as one unified symbol.

const HEX_LINE_W = 26;   // width of each bar
const HEX_LINE_H = 3;    // height of each bar
const HEX_GAP_H  = 2.2;  // vertical gap between bars
const HEX_YIN_GAP = 4;   // centre gap in a broken (yin) line
const HEX_TOP    = 13;
const HEX_HEIGHT = 6 * HEX_LINE_H + 5 * HEX_GAP_H;   // ≈ 29mm
const HEX_BOTTOM = HEX_TOP + HEX_HEIGHT;               // ≈ 42mm

// ── Colour palette ────────────────────────────────────────────────────────────

const PAPER  = '#f5f0e8';  // warm off-white background
const INK    = '#2c2c2c';  // hexagram bars, QR dark modules, card name
const BRONZE = '#8b6914';  // hexagram name (accent/label)
const WOOD   = '#5a4a35';  // keywords, number
const MUTED  = '#a09070';  // lightest text (reserved for scan label if used)

// ── Typography helpers ────────────────────────────────────────────────────────
// Usable text width ≈ 68mm (85mm card – 8.5mm padding each side).
// All font sizes are in SVG mm units (= pt at 1:1 viewBox scale).

// Strip the Chinese transliteration parenthetical from hexagram names.
// "Difficulty at the Beginning (Chun)" → "DIFFICULTY AT THE BEGINNING"
function cleanHexName(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/, '').trim().toUpperCase();
}

// Adaptive size + letter-spacing for hexagram name (Cinzel uppercase).
// Cinzel uppercase average char width ≈ 0.62 × font-size; letter-spacing adds on top.
// Longest cleaned name = 29 chars ("WORK ON WHAT HAS BEEN SPOILED").
function hexNameStyle(name: string): { fontSize: number; letterSpacing: number } {
  const len = name.length;
  if (len <= 14) return { fontSize: 4,   letterSpacing: 1.2 };
  if (len <= 18) return { fontSize: 3.8, letterSpacing: 0.8 };
  if (len <= 22) return { fontSize: 3.5, letterSpacing: 0.5 };
  if (len <= 26) return { fontSize: 3.2, letterSpacing: 0.25 };
  return              { fontSize: 3,   letterSpacing: 0.1  };
}

// Adaptive size for card name (Cormorant Garamond italic).
// Longest name = 26 chars ("Messengers of the Infinite").
function cardNameFontSize(name: string): number {
  const len = name.length;
  if (len <= 12) return 9;
  if (len <= 16) return 8;
  if (len <= 20) return 7;
  if (len <= 24) return 6;
  return 5.5;
}

// Approximate single-line visual height at a given font size.
// Cormorant Garamond italic: total visual height ≈ 0.88 × em.
function cardNameHeight(fontSize: number): number {
  return fontSize * 0.88;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function r(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function drawHexagram(linesTopToBottom: boolean[]): string {
  const x0  = CX - HEX_LINE_W / 2;
  const seg  = (HEX_LINE_W - HEX_YIN_GAP) / 2;
  let out = '';
  let y   = HEX_TOP;

  for (const isYang of linesTopToBottom) {
    if (isYang) {
      out += `<rect x="${r(x0)}" y="${r(y)}" width="${r(HEX_LINE_W)}" height="${r(HEX_LINE_H)}" fill="${INK}"/>`;
    } else {
      out += `<rect x="${r(x0)}" y="${r(y)}" width="${r(seg)}" height="${r(HEX_LINE_H)}" fill="${INK}"/>`;
      out += `<rect x="${r(x0 + seg + HEX_YIN_GAP)}" y="${r(y)}" width="${r(seg)}" height="${r(HEX_LINE_H)}" fill="${INK}"/>`;
    }
    y += HEX_LINE_H + HEX_GAP_H;
  }
  return out;
}

function embedQR(qrSvgStr: string, x: number, y: number, size: number): string {
  const vbMatch    = qrSvgStr.match(/viewBox="([^"]+)"/);
  const innerMatch = qrSvgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const viewBox    = vbMatch ? vbMatch[1] : '0 0 37 37';
  const inner      = innerMatch ? innerMatch[1].trim() : '';
  return (
    `<svg x="${r(x)}" y="${r(y)}" width="${r(size)}" height="${r(size)}" ` +
    `viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
  );
}

// ── Plaque builder ────────────────────────────────────────────────────────────

interface PlaqueOpts {
  hexagram:     boolean[];
  hexagramName: string;
  cardName:     string;
  keywords:     string;
  number:       number | null;
  qrUrl:        string;
}

async function buildPlaque(opts: PlaqueOpts): Promise<string> {
  const { hexagram, hexagramName, cardName, keywords, number, qrUrl } = opts;

  // ── Adaptive layout ───────────────────────────────────────────────────────
  // Computed top-to-bottom, each section's y = top of its bounding box.
  // dominant-baseline="hanging" means text renders downward from y.

  const cleanedHexName   = cleanHexName(hexagramName);
  const hexStyle         = hexNameStyle(cleanedHexName);
  const cnFontSize       = cardNameFontSize(cardName);
  const cnHeight         = cardNameHeight(cnFontSize);

  const hexNameY   = HEX_BOTTOM + 9;                    // I Ching name label
  const hexNameH   = hexStyle.fontSize * 0.75;          // approx cap height
  const cardNameY  = hexNameY + hexNameH + 5;            // Oracle card name (hero)
  const keywordsY  = cardNameY + cnHeight + 4;           // Shadow · Gift · Siddhi
  const keywordsH  = 3 * 0.75;                          // approx 2.25mm

  // QR code — centred, large enough for reliable scanning
  const qrSize     = 36;
  const qrX        = CX - qrSize / 2;
  const qrY        = keywordsY + keywordsH + 10;         // generous breath before QR

  // Card number — quiet, bottom, like an edition mark
  const numberY    = qrY + qrSize + 6;

  // ── QR generation ─────────────────────────────────────────────────────────
  const qrSvgStr = await QRCode.toString(qrUrl, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'L',
    color: { dark: INK, light: PAPER },
  });

  const hexSvg = drawHexagram(hexagram);
  const qrSvg  = embedQR(qrSvgStr, qrX, qrY, qrSize);

  const numberEl = number !== null
    ? `<text x="${CX}" y="${r(numberY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Cinzel, Palatino, serif"
    font-size="4" letter-spacing="2" fill="${MUTED}">${number}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">

  <rect width="${W}" height="${H}" fill="${PAPER}"/>

  ${hexSvg}

  <text x="${CX}" y="${r(hexNameY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Cinzel, Palatino, serif"
    font-size="${hexStyle.fontSize}" letter-spacing="${hexStyle.letterSpacing}" fill="${BRONZE}">${escXml(cleanedHexName)}</text>

  <text x="${CX}" y="${r(cardNameY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="'Cormorant Garamond', Garamond, Georgia, serif"
    font-size="${cnFontSize}" font-style="italic" fill="${INK}">${escXml(cardName)}</text>

  <text x="${CX}" y="${r(keywordsY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Lato, Helvetica, sans-serif"
    font-size="3" letter-spacing="0.3" fill="${WOOD}">${escXml(keywords)}</text>

  ${qrSvg}

  ${numberEl}

</svg>`;
}

// ── Index HTML builder ────────────────────────────────────────────────────────

function buildIndex(cards: Array<{ number: number; filename: string; cardName: string }>): string {
  const items = cards.map(({ number, filename, cardName }) => `
    <div class="item">
      <a href="oracle/${filename}" target="_blank">
        <img src="oracle/${filename}" alt="Card ${number}">
      </a>
      <div class="label">${number} — ${cardName}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Universal Language — Oracle Plaques</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111009; font-family: sans-serif; padding: 32px; }
    h1 { color: #f5f0e8; font-size: 15px; font-weight: 400; letter-spacing: 0.2em;
         text-transform: uppercase; margin-bottom: 6px; }
    p  { color: #6b5d48; font-size: 11px; margin-bottom: 32px; letter-spacing: 0.05em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; }
    .item { text-align: center; }
    .item a { display: block; }
    .item img { width: 100%; display: block; background: #f5f0e8;
                border: 1px solid #1e1a14; transition: border-color 0.2s; }
    .item a:hover img { border-color: #8b6914; }
    .label { color: #6b5d48; font-size: 10px; margin-top: 6px; letter-spacing: 0.04em; }
  </style>
</head>
<body>
  <h1>Universal Language · Oracle Plaques</h1>
  <p>64 cards · 85 × 130 mm · Click any plaque to open the full SVG</p>
  <div class="grid">${items}
  </div>
</body>
</html>`;
}

// ── Card QR builder ───────────────────────────────────────────────────────────
// 2050×2050 transparent SVG canvas, QR centred at 235×235.
// Light modules are transparent so the QR drops cleanly onto any background.

const CARD_CANVAS = 2050;
const CARD_QR     = 235;
const CARD_QR_X   = (CARD_CANVAS - CARD_QR) / 2;  // 907.5
const CARD_QR_Y   = (CARD_CANVAS - CARD_QR) / 2;  // 907.5

async function buildCardQR(qrUrl: string): Promise<string> {
  const qrSvgStr = await QRCode.toString(qrUrl, {
    type:                 'svg',
    margin:               0,
    errorCorrectionLevel: 'L',
    color: { dark: INK, light: '#00000000' },
  });

  const qrEmbedded = embedQR(qrSvgStr, CARD_QR_X, CARD_QR_Y, CARD_QR);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_CANVAS} ${CARD_CANVAS}" width="${CARD_CANVAS}" height="${CARD_CANVAS}">
  ${qrEmbedded}
</svg>`;
}

// ── Multi-layer QR builder ────────────────────────────────────────────────────
// Single SVG file with 64 Inkscape-compatible layers.
// Each layer is named "01 · Earth's Breath", "02 · …", etc.
// Layers are stacked — toggle visibility per card in Illustrator / Inkscape / Figma.

async function buildMultiLayerQR(): Promise<string> {
  const layers: string[] = [];

  for (let n = 1; n <= 64; n++) {
    const card = CARD_BY_NUMBER.get(n);
    if (!card) continue;

    const qrSvgStr = await QRCode.toString(URLS.oracleCard(n), {
      type:                 'svg',
      margin:               0,
      errorCorrectionLevel: 'L',
      color: { dark: INK, light: '#00000000' },
    });

    const qrEmbedded = embedQR(qrSvgStr, CARD_QR_X, CARD_QR_Y, CARD_QR);
    const nn         = String(n).padStart(2, '0');
    const label      = escXml(`${nn} · ${card.card_name}`);

    layers.push(
      `  <g inkscape:groupmode="layer" inkscape:label="${label}" id="layer-${nn}" style="display:inline">` +
      `\n    ${qrEmbedded}\n  </g>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     viewBox="0 0 ${CARD_CANVAS} ${CARD_CANVAS}" width="${CARD_CANVAS}" height="${CARD_CANVAS}">

${layers.join('\n\n')}

</svg>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outRoot   = join(scriptDir, 'output', 'ul-qr-plaques');
  const oracleDir = join(outRoot, 'oracle');
  const mktDir    = join(outRoot, 'marketing');
  const cardsDir  = join(outRoot, 'cards');
  mkdirSync(oracleDir, { recursive: true });
  mkdirSync(mktDir,    { recursive: true });
  mkdirSync(cardsDir,  { recursive: true });

  const indexEntries: Array<{ number: number; filename: string; cardName: string }> = [];
  let count = 0;

  for (let n = 1; n <= 64; n++) {
    const card = CARD_BY_NUMBER.get(n);
    if (!card) { console.warn(`  SKIP — no oracle card for #${n}`); continue; }

    const lines    = hexagramLines(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
    const keywords = `${card.gene_keys.shadow}  ·  ${card.gene_keys.gift}  ·  ${card.gene_keys.siddhi}`;

    const svg = await buildPlaque({
      hexagram:     lines,
      hexagramName: card.iching.hexagram_name,
      cardName:     card.card_name,
      keywords,
      number:       n,
      qrUrl:        URLS.oracleCard(n),
    });

    const nn       = String(n).padStart(2, '0');
    const filename = `oracle-${nn}-${slugify(card.card_name)}.svg`;
    writeFileSync(join(oracleDir, filename), svg, 'utf8');
    indexEntries.push({ number: n, filename, cardName: card.card_name });
    count++;

    if (n % 16 === 0) process.stdout.write(`  ${n}/64\n`);
  }

  // Marketing plaque — oracle deck landing
  const card1   = CARD_BY_NUMBER.get(1)!;
  const allYang = hexagramLines(card1.iching.upper_trigram.symbol, card1.iching.lower_trigram.symbol);
  const mktSvg  = await buildPlaque({
    hexagram:     allYang,
    hexagramName: 'Universal Language',
    cardName:     'The Oracle Deck',
    keywords:     '',
    number:       null,
    qrUrl:        URLS.oracleDeckLanding,
  });
  writeFileSync(join(mktDir, 'oracle-deck-landing.svg'), mktSvg, 'utf8');

  writeFileSync(join(outRoot, 'index.html'), buildIndex(indexEntries), 'utf8');

  // Card QR layer files — 2050×2050 transparent SVG, QR centred at 235×235
  let cardCount = 0;
  for (let n = 1; n <= 64; n++) {
    const card = CARD_BY_NUMBER.get(n);
    if (!card) continue;

    const svg      = await buildCardQR(URLS.oracleCard(n));
    const nn       = String(n).padStart(2, '0');
    const filename = `${nn}-${slugify(card.card_name)}.svg`;
    writeFileSync(join(cardsDir, filename), svg, 'utf8');
    cardCount++;
  }

  // Multi-layer file — all 64 QRs in one SVG, one named layer per card
  const multiSvg = await buildMultiLayerQR();
  writeFileSync(join(cardsDir, 'all-64-layers.svg'), multiSvg, 'utf8');

  console.log(`\nGenerated:`);
  console.log(`  ${count} oracle plaques  →  ${oracleDir}`);
  console.log(`  1 marketing plaque  →  ${mktDir}`);
  console.log(`  ${cardCount} card QR layers   →  ${cardsDir}`);
  console.log(`  1 multi-layer file   →  ${join(cardsDir, 'all-64-layers.svg')}`);
  console.log(`  Preview  →  ${join(outRoot, 'index.html')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
