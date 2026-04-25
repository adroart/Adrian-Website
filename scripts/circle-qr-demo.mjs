import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

const url = 'https://www.adrianrasmussen.com';
const size = 720;
const ringWidth = 28;
const innerPad = 36;

const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
const modules = qr.modules;
const count = modules.size;
const data = modules.data;

const cx = size / 2;
const cy = size / 2;
const ringOuter = size / 2 - 4;
const ringInner = ringOuter - ringWidth;

const qrArea = ringInner * 2 - innerPad * 2;
const qrOrigin = cx - qrArea / 2;
const cell = qrArea / count;
const dotR = cell * 0.42;

const isFinder = (x, y) => {
  return (
    (x < 7 && y < 7) ||
    (x >= count - 7 && y < 7) ||
    (x < 7 && y >= count - 7)
  );
};

const logoRadius = qrArea * 0.16;

const inLogo = (px, py) => {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy) < logoRadius + cell * 0.5;
};

const dots = [];
for (let y = 0; y < count; y++) {
  for (let x = 0; x < count; x++) {
    if (!data[y * count + x]) continue;
    if (isFinder(x, y)) continue;
    const px = qrOrigin + x * cell + cell / 2;
    const py = qrOrigin + y * cell + cell / 2;
    if (inLogo(px, py)) continue;
    dots.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${dotR.toFixed(2)}"/>`);
  }
}

const finder = (gx, gy) => {
  const fx = qrOrigin + gx * cell + (cell * 7) / 2;
  const fy = qrOrigin + gy * cell + (cell * 7) / 2;
  const outer = cell * 3.5;
  const inner = cell * 1.5;
  const stroke = cell;
  return `
    <circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="${(outer - stroke / 2).toFixed(2)}" fill="none" stroke="#1a1a1a" stroke-width="${stroke.toFixed(2)}"/>
    <circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="${inner.toFixed(2)}" fill="#1a1a1a"/>
  `;
};

const ticks = [];
const tickCount = 60;
for (let i = 0; i < tickCount; i++) {
  const angle = (i / tickCount) * Math.PI * 2;
  const r1 = ringOuter - ringWidth * 0.2;
  const r2 = ringOuter - ringWidth * 0.6;
  const x1 = cx + Math.cos(angle) * r1;
  const y1 = cy + Math.sin(angle) * r1;
  const x2 = cx + Math.cos(angle) * r2;
  const y2 = cy + Math.sin(angle) * r2;
  ticks.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#fafaf7" stroke-width="1.2" opacity="0.55"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="paper" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#fdfbf5"/>
      <stop offset="70%" stop-color="#f3ecdd"/>
      <stop offset="100%" stop-color="#e6dcc6"/>
    </radialGradient>
    <linearGradient id="bronze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9a6a3e"/>
      <stop offset="50%" stop-color="#c89968"/>
      <stop offset="100%" stop-color="#7e5430"/>
    </linearGradient>
    <linearGradient id="bronzeInner" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5a3a1f"/>
      <stop offset="100%" stop-color="#8a5e35"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
      <feOffset dx="0" dy="3" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${size}" height="${size}" fill="#1a1410"/>

  <circle cx="${cx}" cy="${cy}" r="${ringOuter}" fill="url(#bronze)" filter="url(#softShadow)"/>
  <circle cx="${cx}" cy="${cy}" r="${ringInner + 2}" fill="url(#paper)"/>

  <g>${ticks.join('\n  ')}</g>

  <circle cx="${cx}" cy="${cy}" r="${ringInner + 1}" fill="none" stroke="url(#bronzeInner)" stroke-width="1.5" opacity="0.6"/>

  <g fill="#1a1a1a">
    ${dots.join('\n    ')}
  </g>

  <g>
    ${finder(0, 0)}
    ${finder(count - 7, 0)}
    ${finder(0, count - 7)}
  </g>

  <g>
    <circle cx="${cx}" cy="${cy}" r="${logoRadius}" fill="url(#paper)" stroke="url(#bronze)" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${logoRadius - 8}" fill="none" stroke="#7e5430" stroke-width="0.8" opacity="0.5"/>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="Cinzel, serif" font-size="36" font-weight="500" fill="#3a2618" letter-spacing="2">AR</text>
  </g>
</svg>`;

writeFileSync('scripts/circle-qr-demo.svg', svg);
console.log('Wrote scripts/circle-qr-demo.svg');
