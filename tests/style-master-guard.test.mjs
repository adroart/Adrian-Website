// Guard for the master style file (src/master.css).
//
// The site reads every colour, size, space, radius, shadow and button from
// src/master.css. This test keeps it that way:
//   1. master.css defines the scales and the five button variants.
//   2. No other stylesheet defines a .btn variant.
//   3. Hard-coded colours, Tailwind palette colours (red-700, bg-white ...), raw
//      font sizes, raw font stacks and hand-built button sizes outside
//      master.css may only go DOWN. The ceilings below are today's counts
//      (2026-11-19). When you migrate a file, lower the ceiling to the new
//      count so nobody can quietly add one back.
//
// Run alone: node --test tests/style-master-guard.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MASTER = 'src/master.css';

// Ceilings. Lower these as files migrate; never raise them.
// On main before the master file: raw colours 658, palette 85, font sizes 684,
// font stacks 87, control sizes 89, hand-built buttons 116. Most of what is left
// sits in the collector, ceremony and walkthrough screens (see the PR body).
const CEILING = {
  rawColours: 403,
  paletteColours: 4,
  rawFontSizes: 199,
  rawFontFamilies: 6,
  buttonSizes: 65,
  handBuiltButtons: 87,
};

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.claude', 'tests', 'scripts', 'public', 'functions', 'workers', 'migrations', 'data', 'docs', 'todo', 'test-results', 'playwright-report']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (/\.(tsx|ts|css)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(path.relative(ROOT, full));
    }
  }
  return out;
}

const files = walk(ROOT).filter((file) => file !== MASTER);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// A colour literal: #rgb, #rgba, #rrggbb, #rrggbbaa, or rgb()/rgba() with digits.
// rgb(var(--admin-ink-rgb) / 14%) is a token and does not count.
const RAW_COLOUR = /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\brgba?\(\s*\d/g;
// A Tailwind built-in palette colour. The site's palette is paper / wood / stone /
// bronze plus the roles (ink, danger, surface-card ...), all defined in master.css.
const PALETTE = /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|shadow|accent|caret)-(?:white|black|(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral)-\d{2,3})(?![\w-])/g;
// A raw font size: text-[13px] in markup, font-size: 13px in CSS, fontSize: 13 inline.
// var(--text-*) and the named classes (text-sm, text-card-title ...) do not count.
const RAW_FONT_SIZE = /\btext-\[\d*\.?\d+(?:px|rem|em)\]|font-size:\s*\d*\.?\d+(?:px|rem|em)|fontSize:\s*['"]?\d*\.?\d+(?:px|rem)?['"]?(?=\s*[,}])/g;
// A font named outright instead of var(--font-display / body / label / tabular).
const RAW_FONT_FAMILY = /font-family:\s*(?!var\(|inherit)['"A-Za-z][^;}]*|fontFamily:\s*['"](?!var\()[^'"]*['"]/g;
// A fixed control size: min-h-11 / min-h-[44px] / h-11 in markup, min-height: 44px in CSS.
const BUTTON_SIZE = /\bmin-h-(?:9|10|11|12|14|\[\d+px\])(?![\w-])|\bh-(?:10|11|12)(?![\w-])|min-height:\s*\d+px/g;
// A button assembled from utilities: label font + uppercase + its own padding in one class string, any order.
const HAND_BUILT = /["'`](?=[^"'`\n]*\bfont-label\b)(?=[^"'`\n]*\buppercase\b)(?=[^"'`\n]*\bp[xy]-[\d[])[^"'`\n]*["'`]/g;

function count(re) {
  let total = 0;
  const byFile = [];
  for (const file of files) {
    const n = (read(file).match(re) || []).length;
    if (n) byFile.push([file, n]);
    total += n;
  }
  byFile.sort((a, b) => b[1] - a[1]);
  return { total, top: byFile.slice(0, 8).map(([f, n]) => `${n}  ${f}`).join('\n') };
}

describe('master style file', () => {
  const master = read(MASTER);

  it('owns the scales: spacing, control heights, radii, shadows, type', () => {
    for (const token of ['--space-1: 4px', '--space-2: 8px', '--space-3: 12px', '--space-4: 16px', '--space-6: 24px', '--space-8: 32px', '--space-12: 48px',
      '--control-h-sm: 28px', '--control-h: 32px', '--control-h-touch: 44px',
      '--radius-none', '--radius-round', '--shadow-raise', '--shadow-overlay',
      '--text-label', '--text-meta', '--text-body', '--text-heading']) {
      assert.ok(master.includes(token), `master.css is missing ${token}`);
    }
    assert.match(master, /@media \(pointer: coarse\)\s*{\s*:root\s*{\s*--control-h-sm: var\(--control-h-touch\);\s*--control-h: var\(--control-h-touch\);/,
      '44px controls must be scoped to touch screens');
  });

  it('owns the type roles, the colour roles and the surfaces', () => {
    for (const token of [
      '--text-page-title', '--text-section-heading', '--text-card-title', '--text-body', '--text-small',
      '--text-nav', '--text-admin-table', '--text-button',
      '--ink:', '--ink-muted:', '--link:', '--accent:', '--danger:', '--ink-on-dark:',
      '--surface-page:', '--surface-band:', '--surface-card:', '--surface-panel:', '--surface-admin:', '--surface-invoice:',
      '--line:', '--line-strong:',
      '--leading-prose', '--duration-fast', '--ease-standard', '--border-width',
    ]) {
      assert.ok(master.includes(token), `master.css is missing ${token}`);
    }
    // Tailwind's size names point at master tokens, so text-sm and friends follow this file.
    for (const size of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']) {
      assert.match(master, new RegExp(`--text-${size}:\\s*var\\(--text-`), `text-${size} must point at a master type token`);
    }
  });

  it('owns the colour ramps, including bronze-800', () => {
    for (const ramp of ['paper', 'wood', 'stone', 'bronze']) {
      assert.match(master, new RegExp(`--color-${ramp}-50:`), `master.css is missing the ${ramp} ramp`);
    }
    assert.equal((master.match(/--color-bronze-800:/g) || []).length, 3, 'bronze-800 must be defined for light, dark and the .invoice-light island');
  });

  it('is the only place a button variant is defined', () => {
    for (const variant of ['btn', 'btn-primary', 'btn-outline', 'btn-ghost', 'btn-icon', 'tab', 'chip', 'btn-sm']) {
      assert.match(master, new RegExp(`\\.${variant}\\s*[{,:]`), `master.css is missing .${variant}`);
    }
    const offenders = files.filter((f) => f.endsWith('.css') && /(^|[\s,}])\.(btn(-[a-z]+)?|chip|tab)\s*[{,:]/m.test(read(f)));
    assert.deepEqual(offenders, [], 'button variants may only be defined in src/master.css');
  });

  it('no stylesheet besides index.css skips the master file', () => {
    assert.match(read('src/index.css'), /@import "\.\/master\.css";/);
  });

  for (const [name, re] of [['rawColours', RAW_COLOUR], ['paletteColours', PALETTE], ['rawFontSizes', RAW_FONT_SIZE], ['rawFontFamilies', RAW_FONT_FAMILY], ['buttonSizes', BUTTON_SIZE], ['handBuiltButtons', HAND_BUILT]]) {
    it(`${name} outside master.css do not go up (ceiling ${CEILING[name]})`, () => {
      const { total, top } = count(re);
      assert.ok(total <= CEILING[name],
        `${name}: ${total} found, ceiling ${CEILING[name]}. Use a token or a .btn variant from src/master.css instead.\nMost in:\n${top}`);
    });
  }
});
