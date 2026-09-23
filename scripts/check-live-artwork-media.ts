/** Check real production image delivery. Browser specs intentionally stub /media. */
import sharp from 'sharp';
import { CREATION_CATEGORIES, FULL_ARCHIVE, MULTIDIMENSIONAL_CATEGORIES } from '../data/mockData';

const origin = new URL(process.env.MEDIA_CHECK_ORIGIN ?? 'https://adrianrasmussen.com');
const widths = (process.env.MEDIA_CHECK_WIDTHS ?? '600').split(',').map(Number);
if (widths.some((width) => !Number.isInteger(width) || width < 1)) {
  throw new Error('MEDIA_CHECK_WIDTHS must be comma-separated positive integers');
}

const ids = [...new Set([
  ...FULL_ARCHIVE.map((art) => art.coverImage),
  ...CREATION_CATEGORIES.filter((category) => !category.hidden).map((category) => category.image),
  ...MULTIDIMENSIONAL_CATEGORIES.map((category) => category.image),
])].filter(Boolean).sort();
if (ids.length < 170) throw new Error(`Artwork inventory unexpectedly small: ${ids.length}`);

const urls = ids.flatMap((id) => widths.map((width) =>
  new URL(`/media/image/${id.split('/').map(encodeURIComponent).join('/')}?w=${width}`, origin),
));
const failures: string[] = [];
let next = 0;

async function check(url: URL) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/webp,image/jpeg,image/*;q=0.8' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) throw new Error(`unexpected content type ${contentType}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error('image could not be decoded');
  } catch (error) {
    failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function worker() {
  while (next < urls.length) await check(urls[next++]);
}

await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
console.log(`Checked ${urls.length} live artwork images across ${ids.length} artwork and category IDs.`);
if (failures.length) {
  console.error(`${failures.length} image requests failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
}
