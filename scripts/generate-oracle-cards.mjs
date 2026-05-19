/**
 * generate-oracle-cards.mjs
 *
 * The vault → card-JSON generator. Reads a vault `_hexagram-NN.md`, parses its
 * `## Synthesis` and `## Correlation` sections, and emits `oracle/generated/
 * NN.json` in the SCHEMA.md shape.
 *
 * This is the pipe: writing happens in the Obsidian vault; this compiles it
 * into the data the website renders. Run: node scripts/generate-oracle-cards.mjs [NN]
 * With no arg, generates every hexagram that has a written synthesis.
 *
 * Honest scope note: the vault Synthesis section is prose-formatted markdown,
 * so this parses by the section-heading + bold-label conventions the guide
 * set specifies. A card whose synthesis does not follow that template will
 * parse partially — the generator reports what it could not find.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const VAULT = path.resolve(
  REPO,
  '../../../../Obsidian Vault/oracle/hexagrams',
);
const OUT = path.join(REPO, 'oracle/generated');

/* ─── small markdown helpers ─────────────────────────────────────────────── */

// pull a `## Section` block (until the next `## ` at the same level)
function section(md, name) {
  const re = new RegExp(`(?:^|\\n)## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = md.match(re);
  return m ? m[1].trim() : '';
}
// pull a `### Sub` block within a section (until next `### ` or `## `)
function sub(md, name) {
  const re = new RegExp(`(?:^|\\n)### ${name}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`);
  const m = md.match(re);
  return m ? m[1].trim() : '';
}
// value after a `**Label:**` or `**Label.**` inline marker, to end of paragraph
function field(block, label) {
  const re = new RegExp(`\\*\\*${label}[:.]?\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n|\\n\\*\\*|$)`);
  const m = block.match(re);
  return m ? m[1].trim().replace(/\s*\n\s*/g, ' ') : '';
}
// frontmatter value
function fm(md, key) {
  const m = md.match(new RegExp(`(?:^|\\n)${key}:\\s*"?([^"\\n]+)"?`));
  return m ? m[1].trim() : '';
}

/* ─── parse one hexagram file ────────────────────────────────────────────── */

function generate(n) {
  const nn = String(n).padStart(2, '0');
  const file = path.join(VAULT, nn, `_hexagram-${nn}.md`);
  if (!fs.existsSync(file)) return { number: n, error: 'vault file not found' };
  const md = fs.readFileSync(file, 'utf-8');

  const synth = section(md, 'Synthesis');
  if (!synth || /cross-source assimilation goes here/.test(synth)) {
    return { number: n, error: 'synthesis not yet written' };
  }

  const glance = sub(synth, 'GLANCE');
  const iching = sub(synth, 'I-CHING VOICE');
  const gk = sub(synth, 'GENE KEYS VOICE');
  const hd = sub(synth, 'HUMAN DESIGN VOICE');
  const web = sub(synth, 'RELATIONS');

  // moving lines — list items under "#### The moving lines"
  const linesBlock = (iching.match(/#### The moving lines\n([\s\S]*)$/) || [, ''])[1];
  const lines = [...linesBlock.matchAll(/- \*\*Line (\d)[^\n]*\*\*([\s\S]*?)(?=\n- \*\*Line |\n*$)/g)]
    .map((m) => ({
      line: Number(m[1]),
      reading: m[2].trim()
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s*-{3,}\s*$/, '')   // drop a trailing section divider
        .trim(),
    }));

  const keywords = (field(glance, 'Keywords') || '')
    .split('·').map((s) => s.trim()).filter(Boolean);

  const card = {
    number: n,
    status: 'scaffold',
    glance: {
      card_name: field(glance, 'Card name'),
      anchor_line: field(glance, 'Essence'),
      keywords,
      reading: field(glance, 'Essence'), // brief reading; prose `reading` field if present
      invocation: (() => {
        const m = glance.match(/\*\*Invocation:\*\*\s*\n([\s\S]*?)(?=\n\n|$)/);
        return m ? m[1].replace(/^>\s?/gm, '').trim() : null;
      })(),
    },
    iching: {
      essence: field(iching, 'Essence'),
      intro: field(iching, 'Intro \\(the situation\\)'),
      interpretation: field(iching, 'Interpretation \\(the natural image\\)'),
      lines,
    },
    gene_keys: {
      essence: field(gk, 'Essence'),
      opening_line: field(gk, 'Opening line'),
      shadow: field(gk, 'Shadow [^*]*'),
      gift: field(gk, 'Gift [^*]*'),
      siddhi: field(gk, 'Siddhi [^*]*'),
    },
    human_design: {
      essence: field(hd, 'Essence'),
      gate: field(hd, 'The gate'),
      center: field(hd, 'The center [^*]*'),
      channel: field(hd, 'The channel [^*]*'),
    },
    relations: {
      essence: field(web, 'Essence'),
      programming_partner: field(web, 'Programming partner [^*]*'),
      channel_partner: field(web, 'Channel partner [^*]*'),
      codon_ring: field(web, 'Codon ring [^*]*'),
      correlation: parseCorrelation(section(md, 'Correlation')),
    },
    structure: {
      hexagram_name: fm(md, 'hexagram_name'),
      upper_trigram: fm(md, 'upper_trigram'),
      lower_trigram: fm(md, 'lower_trigram'),
      codon_ring: fm(md, 'codon_ring'),
      hd_center: fm(md, 'hd_center'),
    },
    meta: { generated_from: `vault: hexagrams/${nn}/_hexagram-${nn}.md`, generated_at: new Date().toISOString(), schema_version: '1.0' },
  };
  return card;
}

// the ## Correlation section -> a small structured block
function parseCorrelation(corr) {
  if (!corr) return null;
  const link = (re) => { const m = corr.match(re); return m ? m[1] : ''; };
  return {
    trigrams: {
      upper: link(/Upper:\s*\[\[[^|]+\|([^\]]+)\]\]/),
      lower: link(/Lower:\s*\[\[[^|]+\|([^\]]+)\]\]/),
    },
    immortals: [...corr.matchAll(/trigram [^*]+ carries \[\[[^|]+\|([^\]]+)\]\]/g)].map((m) => m[1]),
    tarot_arcana: link(/Major Arcana \*\*([^*]+)\*\*/),
  };
}

/* ─── run ────────────────────────────────────────────────────────────────── */

fs.mkdirSync(OUT, { recursive: true });
const arg = process.argv[2];
const targets = arg ? [Number(arg)] : Array.from({ length: 64 }, (_, i) => i + 1);

let written = 0;
const skipped = [];
for (const n of targets) {
  const card = generate(n);
  if (card.error) { skipped.push(`${n}: ${card.error}`); continue; }
  fs.writeFileSync(path.join(OUT, `${String(n).padStart(2, '0')}.json`), JSON.stringify(card, null, 2));
  written++;
}
console.log(`generated ${written} card JSON file(s) → oracle/generated/`);
if (skipped.length) {
  console.log('skipped:');
  skipped.forEach((s) => console.log('  ' + s));
}
