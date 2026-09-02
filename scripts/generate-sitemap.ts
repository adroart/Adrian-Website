/**
 * Generates public/sitemap.xml from static routes + dynamic data.
 * Run via: tsx scripts/generate-sitemap.ts
 * Or: npm run sitemap
 */
import fs from 'fs';
import path from 'path';

const SITE_ORIGIN = 'https://adrianrasmussen.com';
const today = new Date().toISOString().split('T')[0];

interface UrlEntry {
  loc: string;
  lastmod: string;
  priority: string;
}

function url(loc: string, priority: string, lastmod = today): UrlEntry {
  return { loc: `${SITE_ORIGIN}${loc}`, lastmod, priority };
}

// Static routes
const staticRoutes: UrlEntry[] = [
  url('/', '1.0'),
  url('/creations', '0.9'),
  url('/writings', '0.9'),
  url('/about', '0.9'),
  url('/shop', '0.9'),
  url('/inquire', '0.9'),
  url('/oracle/universal-language', '0.9'),
  url('/creations/multidimensional-art', '0.9'),
  url('/creations/multidimensional-art/universal-language', '0.9'),
  url('/creations/multidimensional-art/mandala', '0.9'),
  url('/creations/multidimensional-art/light-codes', '0.9'),
  url('/creations/multidimensional-art/signature-pieces', '0.9'),
  url('/creations/illuminated-works', '0.9'),
  url('/privacy', '0.7'),
  url('/terms', '0.7'),
];

// Oracle card routes 1-64
const oracleRoutes: UrlEntry[] = Array.from({ length: 64 }, (_, i) =>
  url(`/oracle/universal-language/${i + 1}`, '0.8')
);

function buildXml(entries: UrlEntry[]): string {
  const urlBlocks = entries
    .map(
      entry =>
        `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <priority>${entry.priority}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlBlocks}
</urlset>
`;
}

async function main() {
  let artworkRoutes: UrlEntry[] = [];
  let storyRoutes: UrlEntry[] = [];

  try {
    const { FULL_ARCHIVE, STORIES } = await import('../data/mockData');
    const { pieceSlug } = await import('../utils/pieceSlug');
    // Canonical slug only. The legacy /creations/<ID> URLs still resolve and still
    // carry correct OG tags, but they redirect, so listing them here would advertise
    // 173 redirects to the crawler instead of 173 pages.
    artworkRoutes = (FULL_ARCHIVE as Array<{ id: string; title: string }>).map(artwork =>
      url(`/creations/${pieceSlug(artwork)}`, '0.8')
    );
    storyRoutes = (STORIES as Array<{ slug: string; date?: string }>).map(story =>
      url(`/writings/${story.slug}`, '0.7', story.date || today)
    );
    console.log(`Loaded ${artworkRoutes.length} artworks and ${storyRoutes.length} stories.`);
  } catch (err) {
    console.warn('Could not load mockData - generating static routes only.', err instanceof Error ? err.message : err);
  }

  const allUrls: UrlEntry[] = [
    ...staticRoutes,
    ...oracleRoutes,
    ...artworkRoutes,
    ...storyRoutes,
  ];

  const outputPath = path.join(process.cwd(), 'public/sitemap.xml');
  fs.writeFileSync(outputPath, buildXml(allUrls), 'utf-8');
  console.log(`Sitemap written to ${outputPath} (${allUrls.length} URLs).`);
}

main().catch(err => { console.error(err); process.exit(1); });
