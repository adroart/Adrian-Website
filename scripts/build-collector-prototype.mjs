/**
 * Builds the collector journey into ONE self contained HTML file.
 *
 * The same `components/collector/CollectorShell.tsx` the site serves at
 * /collector, bundled with React, its fonts inlined as data URIs, and no
 * network requests of any kind. It opens by double clicking it, and it can be
 * handed to anyone without a repo, a server, or a build.
 *
 *   node scripts/build-collector-prototype.mjs [outfile] [--fragment]
 *
 * `--fragment` emits the page content without the document skeleton, which is
 * what a published Artifact wants: it supplies its own doctype, head and body.
 *
 * Nothing in it is wired: no account, no database, no registry. The code that
 * opens the piece is sixteen ones; sixteen nines runs the wrong code state.
 */

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'scripts/collector-prototype');
const dist = resolve(root, '.proto-dist');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = resolve(root, args.find(a => !a.startsWith('--')) ?? 'collector-prototype.html');

await build({
  root: src,
  configFile: false,
  plugins: [react()],
  logLevel: 'warn',
  build: {
    outDir: dist,
    emptyOutDir: true,
    cssCodeSplit: false,
    // every asset inline: the file must make no network request at all
    assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

let html = readFileSync(resolve(dist, 'index.html'), 'utf8');

// fold the emitted bundle and stylesheet back into the document
html = html.replace(
  /<script type="module"[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/,
  (_m, file) => `<script type="module">\n${readFileSync(resolve(dist, file), 'utf8')}\n</script>`,
);
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/,
  (_m, file) => `<style>\n${readFileSync(resolve(dist, file), 'utf8')}\n</style>`,
);

const left = html.match(/(?:src|href)="\.?\/?assets\//);
if (left) throw new Error('an asset was left unlinked: ' + left[0]);

if (fragment) {
  // an Artifact supplies its own skeleton, so hand it the content alone
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
  const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
  // Vite hoists the module script into <head>, so carry style and script
  // blocks out of the head, then keep the body exactly as it is.
  const carry = s => [...s.matchAll(/<(style|script)\b[\s\S]*?<\/\1>/g)].map(m => m[0]);
  html = [`<title>${title}</title>`, ...carry(head), body.trim()].join('\n') + '\n';
  if (!/<script/.test(html)) throw new Error('the fragment lost its bundle');
}

writeFileSync(out, html);
rmSync(dist, { recursive: true, force: true });

console.log(
  `${out}  ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB, ` +
    `${fragment ? 'artifact fragment' : 'standalone document'}, no network requests`,
);
