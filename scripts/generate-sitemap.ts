/**
 * Generates public/sitemap.xml from canonical routes and checked-in content.
 * Run via: npm run sitemap [-- output.xml]
 * Dynamic, privately issued and redirected URLs do not belong in this index.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FULL_ARCHIVE, TRACKS } from '../data/mockData';
import { LAUNCH_FLAGS } from '../launchFlags';
import { piecePath } from '../utils/pieceSlug';
import { loadStories } from './story-source';

const SITE_ORIGIN = 'https://adrianrasmussen.com';
const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));

interface UrlEntry {
  loc: string;
  priority: string;
}

function url(route: string, priority: string): UrlEntry {
  return { loc: `${SITE_ORIGIN}${route}`, priority };
}

export function sitemapEntries(shopEnabled = LAUNCH_FLAGS.shopEnabled): UrlEntry[] {
  const staticRoutes: UrlEntry[] = [
    url('/', '1.0'),
    url('/creations', '0.9'),
    url('/writings', '0.9'),
    url('/about', '0.9'),
    ...(shopEnabled ? [url('/shop', '0.9')] : []),
    url('/poetry', '0.9'),
    url('/inquire', '0.9'),
    url('/oracle', '0.8'),
    url('/creations/multidimensional-art', '0.9'),
    url('/creations/multidimensional-art/universal-language', '0.9'),
    url('/creations/multidimensional-art/mandala', '0.9'),
    url('/creations/multidimensional-art/light-codes', '0.9'),
    url('/creations/multidimensional-art/signature-pieces', '0.9'),
    url('/creations/illuminated-works', '0.9'),
    url('/privacy', '0.7'),
    url('/terms', '0.7'),
  ];
  const artworkRoutes = FULL_ARCHIVE.map(artwork => url(piecePath(artwork), '0.8'));
  // Writings renders these files, not the superseded STORIES in mockData.
  const storyRoutes = loadStories(path.join(PROJECT_ROOT, 'content/stories')).map(story =>
    url(`/writings/${encodeURIComponent(story.slug)}`, '0.7'),
  );
  const poetryRoutes = TRACKS.map(track => url(`/poetry/${encodeURIComponent(track.slug)}`, '0.7'));
  const entries = [...staticRoutes, ...artworkRoutes, ...storyRoutes, ...poetryRoutes];
  const locations = new Set<string>();
  for (const entry of entries) {
    if (locations.has(entry.loc)) throw new Error(`Duplicate canonical sitemap URL: ${entry.loc}`);
    locations.add(entry.loc);
  }
  return entries;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

export function buildSitemap(entries = sitemapEntries()): string {
  // No lastmod is emitted: release dates and seasonal display dates do not
  // establish when a page was modified. Rebuilding must not invent a new date.
  const blocks = entries.map(entry =>
    `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <priority>${entry.priority}</priority>\n  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blocks}
</urlset>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = path.resolve(process.argv[2] || path.join(PROJECT_ROOT, 'public/sitemap.xml'));
  const entries = sitemapEntries();
  fs.writeFileSync(outputPath, buildSitemap(entries), 'utf-8');
  console.log(`Sitemap written to ${outputPath} (${entries.length} URLs).`);
}
