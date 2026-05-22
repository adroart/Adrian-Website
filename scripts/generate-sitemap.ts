/**
 * Generates public/sitemap.xml from static routes + dynamic data.
 * Run via: tsx scripts/generate-sitemap.ts
 * Or: npm run sitemap
 */
import fs from 'fs';
import path from 'path';
import { FULL_ARCHIVE, STORIES } from '../data/mockData';
import { LAUNCH_FLAGS } from '../launchFlags';
import { getStaticSitemapEntries, SITE_ORIGIN } from '../utils/seoMetadata';
import type { Artwork } from '../types';

const today = new Date().toISOString().split('T')[0];

interface UrlEntry {
  loc: string;
  lastmod: string;
  priority: string;
  images?: ImageEntry[];
}

interface ImageEntry {
  loc: string;
  title?: string;
  caption?: string;
}

function url(loc: string, priority: string, lastmod = today, images?: ImageEntry[]): UrlEntry {
  return { loc: `${SITE_ORIGIN}${loc}`, lastmod, priority, images };
}

function cloudinaryImage(publicId: string): string {
  return `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1600,c_fit/${publicId}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function imageCaption(artwork: Artwork): string {
  if (artwork.series === 'Mandala') {
    return `${artwork.title} by Adrian Rasmussen. Original sacred geometry mandala artwork in layered laser-cut wood.`;
  }
  if (artwork.series === 'Universal Language') {
    return `${artwork.title}. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`;
  }
  return `${artwork.title} by Adrian Rasmussen. ${artwork.category}.`;
}

const staticRoutes: UrlEntry[] = getStaticSitemapEntries(LAUNCH_FLAGS).map(route =>
  url(route.path, route.priority)
);

// Oracle card routes 1-64
const oracleRoutes: UrlEntry[] = Array.from({ length: 64 }, (_, i) =>
  url(`/oracle/universal-language/${i + 1}`, '0.8')
);

function buildXml(entries: UrlEntry[]): string {
  const urlBlocks = entries
    .map(
      entry => {
        const images = entry.images?.map(image => {
          const title = image.title ? `\n      <image:title>${escapeXml(image.title)}</image:title>` : '';
          const caption = image.caption ? `\n      <image:caption>${escapeXml(image.caption)}</image:caption>` : '';
          return `\n    <image:image>\n      <image:loc>${escapeXml(image.loc)}</image:loc>${title}${caption}\n    </image:image>`;
        }).join('') ?? '';

        return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <priority>${entry.priority}</priority>${images}\n  </url>`;
      }
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlBlocks}
</urlset>
`;
}

async function main() {
  let artworkRoutes: UrlEntry[] = [];
  let storyRoutes: UrlEntry[] = [];

  try {
    artworkRoutes = (FULL_ARCHIVE as Artwork[]).map(artwork =>
      url(
        `/creations/${artwork.id}`,
        '0.8',
        today,
        [
          {
            loc: cloudinaryImage(artwork.coverImage),
            title: artwork.title,
            caption: imageCaption(artwork),
          },
          ...artwork.images
            .filter(publicId => publicId !== artwork.coverImage)
            .slice(0, 4)
            .map(publicId => ({
              loc: cloudinaryImage(publicId),
              title: artwork.title,
              caption: imageCaption(artwork),
            })),
        ],
      )
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
