#!/usr/bin/env node
/**
 * Regenerate the embedded HANDBOOK_SOURCE constant in
 * functions/api/_lib/successorHandbook.js from the source document
 * docs/registry-custodian-guide.md.
 *
 * Cloudflare Pages Functions cannot read docs/ at runtime, so the markdown is
 * embedded as a JSON string literal between the HANDBOOK_SOURCE_START and
 * HANDBOOK_SOURCE_END markers. Run this after every edit to the guide:
 *
 *   node scripts/generate-successor-handbook.mjs
 *
 * tests/successor-handbook.test.ts fails if the guide and the constant drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const guidePath = join(root, 'docs', 'registry-custodian-guide.md');
const modulePath = join(root, 'functions', 'api', '_lib', 'successorHandbook.js');

const guide = readFileSync(guidePath, 'utf8');
const moduleSource = readFileSync(modulePath, 'utf8');

const pattern = /(\/\* HANDBOOK_SOURCE_START[^\n]*\*\/\n)[\s\S]*?(\n\/\* HANDBOOK_SOURCE_END \*\/)/;
if (!pattern.test(moduleSource)) {
  process.stderr.write('HANDBOOK_SOURCE markers not found in successorHandbook.js\n');
  process.exit(1);
}
const replacement = `export const HANDBOOK_SOURCE = ${JSON.stringify(guide)};`;
const updated = moduleSource.replace(
  pattern,
  (match, start, end) => `${start}${replacement}${end}`,
);
if (updated === moduleSource) {
  process.stdout.write('HANDBOOK_SOURCE already current.\n');
} else {
  writeFileSync(modulePath, updated, 'utf8');
  process.stdout.write('HANDBOOK_SOURCE regenerated from docs/registry-custodian-guide.md.\n');
}
