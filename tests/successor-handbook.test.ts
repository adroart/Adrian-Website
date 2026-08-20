import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  HANDBOOK_SOURCE,
  SUCCESSOR_HANDBOOK_FILENAME,
  renderHandbookMarkdown,
  renderSuccessorHandbookHtml,
} from '../functions/api/_lib/successorHandbook.js';
import { buildPieceRecordsArchive, crc32 } from '../functions/api/_lib/recordArchive.js';

/* ── Minimal STORE-zip reader (record-archive.test.ts shape) ────────── */

function readStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.byteLength - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054B50, 'EOCD signature');
  const entryCount = view.getUint16(eocd + 8, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, Uint8Array>();
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014B50, 'central signature');
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc, `crc for ${name}`);
    entries.set(name, data.slice());
    offset += 46 + nameLength;
  }
  return entries;
}

/** Secret-shaped strings, in the spirit of the pieceRecord.js strip-pass. */
const SECRET_SHAPES = [
  // A base64 run long enough to be a 32-byte key.
  /[A-Za-z0-9+/]{40,}={0,2}/,
  // A 64-hex digest or key.
  /\b[a-f0-9]{64}\b/i,
  // An Ownership Code shape (four dashed groups from the no-lookalike alphabet).
  /\b[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}\b/,
  // An email address or an internal identifier prefix.
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\b(?:kp|tp|dream|consent|auth)-/i,
];

describe('the successor handbook', () => {
  it('embeds exactly the current custodian guide markdown', () => {
    const guide = readFileSync(
      new URL('../docs/registry-custodian-guide.md', import.meta.url), 'utf8',
    );
    assert.equal(
      HANDBOOK_SOURCE,
      guide,
      'HANDBOOK_SOURCE drifted from docs/registry-custodian-guide.md; '
      + 'run node scripts/generate-successor-handbook.mjs',
    );
  });

  it('renders the guide as one complete quiet page', () => {
    const html = renderSuccessorHandbookHtml();
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<title>The Successor&#x27;s Handbook · Adrian Rasmussen<\/title>|<title>The Successor's Handbook · Adrian Rasmussen<\/title>/);
    assert.match(html, /<h1>The Successor&#x27;s Handbook<\/h1>|<h1>The Successor's Handbook<\/h1>/);
    for (const heading of [
      'What this is', 'The two levels of custody', 'The passkey',
      'How to restore everything from nothing',
      'How to reveal an Ownership Code for a collector who lost theirs',
      'What must never be done', 'Whom to contact',
    ]) {
      assert.ok(html.includes(`<h2>${heading}</h2>`), heading);
    }
    assert.ok(html.includes('<h3>Level one, hold it</h3>'));
    assert.ok(html.includes('<h3>Level two, run it</h3>'));
    // The passkey placeholders Adrian fills in by hand survive rendering.
    assert.match(html, /Written and sealed at: _+/);
    // The restore commands render as code blocks.
    assert.match(html, /<pre><code>npm run ledger -- verify registry-ledger\.jsonl<\/code><\/pre>/);
    assert.match(html, /restore-sql registry-private-recovery\.json/);
    // Design rules: no em dashes anywhere.
    assert.doesNotMatch(html, /—/);
  });

  it('is deterministic', () => {
    assert.equal(renderSuccessorHandbookHtml(), renderSuccessorHandbookHtml());
  });

  it('is fully self-contained, with no external resource references', () => {
    const html = renderSuccessorHandbookHtml();
    assert.doesNotMatch(html, /https?:\/\//i);
    assert.doesNotMatch(html, /<link/i);
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /<img/i);
    assert.doesNotMatch(html, /\bsrc\s*=/i);
    assert.doesNotMatch(html, /\bhref\s*=/i);
    assert.doesNotMatch(html, /@import/i);
    assert.doesNotMatch(html, /url\(/i);
  });

  it('contains no secret-shaped strings', () => {
    const html = renderSuccessorHandbookHtml();
    for (const shape of SECRET_SHAPES) {
      const match = shape.exec(html);
      assert.equal(match, null, `secret-shaped content: ${String(match?.[0])}`);
    }
  });

  it('converts the markdown subset faithfully', () => {
    const html = renderHandbookMarkdown([
      '# Title',
      '',
      'A paragraph with **bold words** and a `code span`.',
      'It continues on a second line.',
      '',
      '- First item',
      '  wrapping onward',
      '- Second item with `AR-XXXXXXXX`',
      '',
      '1. Step one',
      '2. Step two',
      '',
      '```',
      'npm run ledger -- verify <file> & "quotes"',
      '```',
    ].join('\n'));
    assert.equal(html, [
      '<h1>Title</h1>',
      '<p>A paragraph with <strong>bold words</strong> and a <code>code span</code>. '
        + 'It continues on a second line.</p>',
      '<ul>',
      '<li>First item wrapping onward</li>',
      '<li>Second item with <code>AR-XXXXXXXX</code></li>',
      '</ul>',
      '<ol>',
      '<li>Step one</li>',
      '<li>Step two</li>',
      '</ol>',
      '<pre><code>npm run ledger -- verify &lt;file&gt; &amp; &quot;quotes&quot;</code></pre>',
    ].join('\n'));
  });

  it('travels at the root of the piece-records archive zip', async () => {
    // A stub env with no published records: the archive still carries the
    // index front door and the handbook.
    const env = {
      DB: {
        prepare: () => ({
          async all() { return { results: [] }; },
        }),
      },
      ARTWORK_REGISTRY_BACKUP: { async get() { return null; } },
    };
    const { bytes } = await buildPieceRecordsArchive(env);
    const entries = readStoredZip(bytes);
    assert.deepEqual([...entries.keys()].sort(), [
      'records/index.html',
      SUCCESSOR_HANDBOOK_FILENAME,
    ]);
    const archived = new TextDecoder().decode(entries.get(SUCCESSOR_HANDBOOK_FILENAME)!);
    assert.equal(archived, renderSuccessorHandbookHtml());
  });
});
