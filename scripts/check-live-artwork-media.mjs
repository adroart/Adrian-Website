/** Check real image delivery without relying on the gallery's stubbed browser tests. */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../data/mockData.ts', import.meta.url), 'utf8');
const ids = [...new Set([...source.matchAll(/\b(?:coverImage|image):\s*'([^']+)'/g)].map((match) => match[1]))].sort();
if (ids.length < 170) throw new Error(`Artwork inventory unexpectedly small: ${ids.length}`);

const origin = new URL(process.env.MEDIA_CHECK_ORIGIN ?? 'https://adrianrasmussen.com');
const widths = (process.env.MEDIA_CHECK_WIDTHS ?? '600').split(',').map(Number);
if (widths.some((width) => !Number.isInteger(width) || width < 1)) {
  throw new Error('MEDIA_CHECK_WIDTHS must be comma-separated positive integers');
}

const urls = ids.flatMap((id) => widths.map((width) =>
  new URL(`/media/image/${id.split('/').map(encodeURIComponent).join('/')}?w=${width}&format=webp`, origin),
));
const failures = [];
let next = 0;

async function check(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/webp,image/jpeg,image/png' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type')?.split(';')[0];
    const bytes = new Uint8Array(await response.arrayBuffer());
    const jpeg = contentType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8;
    const png = contentType === 'image/png' && bytes[0] === 0x89 && bytes[1] === 0x50;
    const webp = contentType === 'image/webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (bytes.length < 100 || !(jpeg || png || webp)) {
      throw new Error(`image body is empty or invalid (${contentType})`);
    }
  } catch (error) {
    failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function worker() {
  while (next < urls.length) await check(urls[next++]);
}

await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
console.log(`Checked ${urls.length} live artwork images across ${ids.length} catalog IDs.`);
if (failures.length) {
  console.error(`${failures.length} image requests failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
}
