import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

const url = 'https://adrianrasmussen.com';
const size = 900;
const frameInset = 15;
const frameStroke = 4;

const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
const modules = qr.modules;
const count = modules.size;
const data = modules.data;

const cx = size / 2;
const cy = size / 2;
const ringOuter = size / 2 - frameInset;
const ringInner = ringOuter - frameStroke;

// Size QR so its diagonal fits inside ringInner with a small margin (so finders never clip)
const qrFitMargin = 18;
const qrDiagonal = (ringInner - qrFitMargin) * 2;
const qrArea = qrDiagonal / Math.SQRT2;
const cell = qrArea / count;
const qrOrigin = cx - qrArea / 2;

const isFinder = (x, y) =>
  (x < 7 && y < 7) ||
  (x >= count - 7 && y < 7) ||
  (x < 7 && y >= count - 7);

// Bottom-right "fourth finder" position — same module location pattern, mirrored
const isFourthFinderModule = (x, y) => x >= count - 7 && y >= count - 7;

const logoRadius = qrArea * 0.14;
const distFromCenter = (px, py) => {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
};
const inLogo = (px, py) => distFromCenter(px, py) < logoRadius + cell * 0.4;

// Real QR data dots (skip all 4 finder areas — bottom-right will be drawn as fake)
const dots = [];
for (let y = 0; y < count; y++) {
  for (let x = 0; x < count; x++) {
    if (!data[y * count + x]) continue;
    if (isFinder(x, y)) continue;
    if (isFourthFinderModule(x, y)) continue;
    const px = qrOrigin + x * cell + cell / 2;
    const py = qrOrigin + y * cell + cell / 2;
    if (inLogo(px, py)) continue;
    dots.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(cell * 0.4).toFixed(2)}"/>`);
  }
}

// Camouflage — extend the QR's grid outward in all directions, filling random cells
// at ~50% density (matching the QR's fill density) so the dot field feels continuous.
let seed = 1337;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 0xffffffff;
  return seed / 0xffffffff;
};

const camoOuter = ringInner - cell;
// Compute extended grid range: how many cells out from QR origin we need to fill the disc
const cellsOut = Math.ceil(camoOuter / cell) + 2;
const gridStart = -cellsOut;
const gridEnd = count + cellsOut;

const camouflage = [];
for (let y = gridStart; y < gridEnd; y++) {
  for (let x = gridStart; x < gridEnd; x++) {
    // Skip cells inside the real QR grid — those are handled by the real data
    if (x >= 0 && x < count && y >= 0 && y < count) continue;
    const px = qrOrigin + x * cell + cell / 2;
    const py = qrOrigin + y * cell + cell / 2;
    // Must be inside the disc
    if (distFromCenter(px, py) > camoOuter) continue;
    // Skip center medallion area
    if (inLogo(px, py)) continue;
    // ~50% fill density to match QR
    if (rand() > 0.5) continue;
    camouflage.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(cell * 0.4).toFixed(2)}"/>`);
  }
}

// Real finder pattern (true 1:1:3:1:1 ratio)
const realFinder = (gx, gy) => {
  const fx = qrOrigin + gx * cell + (cell * 7) / 2;
  const fy = qrOrigin + gy * cell + (cell * 7) / 2;
  const outer = cell * 3.5;
  const inner = cell * 1.5;
  const stroke = cell * 1.05;
  return `
    <circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="${(outer - stroke / 2).toFixed(2)}" fill="none" stroke="#1a1410" stroke-width="${stroke.toFixed(2)}"/>
    <circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="${inner.toFixed(2)}" fill="#1a1410"/>
  `;
};

// Fake fourth finder — visually identical, but outer ring has a tiny gap in the diagonal direction
// (away from the QR center, so it points outward — invisible to the eye, breaks scanner pattern)
const fakeFinder = (gx, gy) => {
  const fx = qrOrigin + gx * cell + (cell * 7) / 2;
  const fy = qrOrigin + gy * cell + (cell * 7) / 2;
  const outer = cell * 3.5;
  const inner = cell * 1.5;
  const stroke = cell * 1.05;
  const r = outer - stroke / 2;
  // Arc from angle a1 around to a2, leaving a small gap at the outward diagonal (45°)
  const gapCenter = Math.PI * 0.25; // outward toward bottom-right
  const gapHalf = 0.05; // very small gap, ~5.7° each side
  const a1 = gapCenter + gapHalf;
  const a2 = gapCenter - gapHalf + Math.PI * 2;
  const x1 = fx + Math.cos(a1) * r;
  const y1 = fy + Math.sin(a1) * r;
  const x2 = fx + Math.cos(a2) * r;
  const y2 = fy + Math.sin(a2) * r;
  const arc = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  return `
    <path d="${arc}" fill="none" stroke="#1a1410" stroke-width="${stroke.toFixed(2)}" stroke-linecap="butt"/>
    <circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="${inner.toFixed(2)}" fill="#1a1410"/>
  `;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1f1813"/>
      <stop offset="100%" stop-color="#0d0a07"/>
    </radialGradient>
    <radialGradient id="paper" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#fefaf0"/>
      <stop offset="60%" stop-color="#f4ecd8"/>
      <stop offset="100%" stop-color="#e3d7bb"/>
    </radialGradient>
    <linearGradient id="bronze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a87445"/>
      <stop offset="50%" stop-color="#dcb079"/>
      <stop offset="100%" stop-color="#5e3d20"/>
    </linearGradient>
    <radialGradient id="logoBg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fffaef"/>
      <stop offset="100%" stop-color="#e6d6b4"/>
    </radialGradient>
  </defs>

  <rect width="${size}" height="${size}" fill="url(#bg)"/>

  <!-- Paper disc -->
  <circle cx="${cx}" cy="${cy}" r="${ringInner + 1}" fill="url(#paper)"/>

  <!-- Camouflage scatter dots -->
  <g fill="#1a1410">
    ${camouflage.join('\n    ')}
  </g>

  <!-- Real QR data dots -->
  <g fill="#1a1410">
    ${dots.join('\n    ')}
  </g>

  <!-- Three real finders + one fake (visually identical) -->
  <g>
    ${realFinder(0, 0)}
    ${realFinder(count - 7, 0)}
    ${realFinder(0, count - 7)}
    ${fakeFinder(count - 7, count - 7)}
  </g>

  <!-- Center medallion (clipped to its own circle) -->
  <g>
    <circle cx="${cx}" cy="${cy}" r="${logoRadius.toFixed(2)}" fill="url(#logoBg)" stroke="url(#bronze)" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${cy}" r="${(logoRadius - 6).toFixed(2)}" fill="none" stroke="#8e5e34" stroke-width="0.8" opacity="0.6"/>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="Cinzel, serif" font-size="42" font-weight="500" fill="#3a2410" letter-spacing="3">AR</text>
  </g>

  <!-- Thin bronze frame, 15px from edge -->
  <circle cx="${cx}" cy="${cy}" r="${(ringInner + frameStroke / 2).toFixed(2)}" fill="none" stroke="url(#bronze)" stroke-width="${frameStroke}"/>
</svg>`;

writeFileSync('scripts/circle-qr-demo.svg', svg);
console.log('Wrote scripts/circle-qr-demo.svg');
