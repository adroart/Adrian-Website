import fs from 'node:fs';
import path from 'node:path';
import { FULL_ARCHIVE } from '../data/mockData';
import { STORIES } from '../data/generatedStories';
import { LAUNCH_FLAGS } from '../launchFlags';
import { DEFAULT_SEO_IMAGE, getStaticSitemapEntries, resolveCanonicalUrl, resolveSeoConfig, SITE_ORIGIN } from '../utils/seoMetadata';
import { ulMetaDescription, ulMetaTitle } from '../utils/universalLanguage';
import { isLaserCutWoodArtwork } from '../utils/artworkFilters';
import type { Artwork } from '../types';

interface HtmlRoute {
  path: string;
  title: string;
  description: string;
  image: string;
  type: 'website' | 'article';
}

function cloudinaryOgImage(publicId: string): string {
  return `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${publicId}`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function upsertMetaByName(html: string, name: string, content: string): string {
  const escaped = escapeAttr(content);
  const re = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>`);
  if (re.test(html)) return html.replace(re, `<meta name="${name}" content="${escaped}" />`);
  return html.replace('</head>', `    <meta name="${name}" content="${escaped}" />\n  </head>`);
}

function upsertMetaByProperty(html: string, property: string, content: string): string {
  const escaped = escapeAttr(content);
  const re = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`);
  if (re.test(html)) return html.replace(re, `<meta property="${property}" content="${escaped}" />`);
  return html.replace('</head>', `    <meta property="${property}" content="${escaped}" />\n  </head>`);
}

function upsertCanonical(html: string, canonicalUrl: string): string {
  const escaped = escapeAttr(canonicalUrl);
  const re = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/;
  if (re.test(html)) return html.replace(re, `<link rel="canonical" href="${escaped}" />`);
  return html.replace('    <!-- Favicon', `    <link rel="canonical" href="${escaped}" />\n\n    <!-- Favicon`);
}

function setTitle(html: string, title: string): string {
  return html.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(title)}</title>`);
}

function routeHtml(template: string, route: HtmlRoute): string {
  const canonicalUrl = resolveCanonicalUrl(route.path);
  let html = template;

  html = setTitle(html, route.title);
  html = upsertMetaByName(html, 'description', route.description);
  html = upsertMetaByProperty(html, 'og:type', route.type);
  html = upsertMetaByProperty(html, 'og:title', route.title);
  html = upsertMetaByProperty(html, 'og:description', route.description);
  html = upsertMetaByProperty(html, 'og:image', route.image);
  html = upsertMetaByProperty(html, 'og:url', canonicalUrl);
  html = upsertMetaByName(html, 'twitter:title', route.title);
  html = upsertMetaByName(html, 'twitter:description', route.description);
  html = upsertMetaByName(html, 'twitter:image', route.image);
  html = upsertCanonical(html, canonicalUrl);

  return html;
}

function outputPathForRoute(routePath: string): string {
  if (routePath === '/') return path.join(process.cwd(), 'dist/index.html');
  return path.join(process.cwd(), 'dist', routePath.replace(/^\//, ''), 'index.html');
}

function writeRoute(template: string, route: HtmlRoute): void {
  const outputPath = outputPathForRoute(route.path);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, routeHtml(template, route), 'utf8');
}

function artworkDescription(art: Artwork): string {
  if (art.series === 'Universal Language') return ulMetaDescription(art);
  if (art.series === 'Mandala') {
    return `${art.title} by Adrian Rasmussen. Original sacred geometry mandala artwork in layered laser-cut wood${art.dimensions ? ` · ${art.dimensions}` : ''}.`;
  }
  if (isLaserCutWoodArtwork(art)) {
    return `${art.title} by Adrian Rasmussen. Layered laser-cut wood artwork${art.dimensions ? ` · ${art.dimensions}` : ''}.`;
  }
  return `${art.title} by Adrian Rasmussen · ${art.category}${art.dimensions ? ` · ${art.dimensions}` : ''}.`;
}

function artworkTitle(art: Artwork): string {
  if (art.series === 'Universal Language') return `${ulMetaTitle(art)} | Adrian Rasmussen`;
  return `${art.title} | Adrian Rasmussen`;
}

function buildRoutes(): HtmlRoute[] {
  const staticRoutes = getStaticSitemapEntries(LAUNCH_FLAGS).map(entry => {
    const config = resolveSeoConfig(entry.path);
    return {
      path: entry.path,
      title: config.title,
      description: config.description,
      image: config.image ?? DEFAULT_SEO_IMAGE,
      type: config.pageType === 'article' ? 'article' as const : 'website' as const,
    };
  });

  const artworkRoutes = FULL_ARCHIVE.map(art => ({
    path: `/creations/${art.id}`,
    title: artworkTitle(art),
    description: artworkDescription(art),
    image: cloudinaryOgImage(art.coverImage),
    type: 'website' as const,
  }));

  const storyRoutes = STORIES.map(story => ({
    path: `/writings/${story.slug}`,
    title: `${story.title} | Adrian Rasmussen`,
    description: story.subtitle || story.excerpt,
    image: story.image ? cloudinaryOgImage(story.image) : DEFAULT_SEO_IMAGE,
    type: 'article' as const,
  }));

  return [...staticRoutes, ...artworkRoutes, ...storyRoutes];
}

function main(): void {
  const templatePath = path.join(process.cwd(), 'dist/index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('dist/index.html does not exist. Run vite build before generating route HTML.');
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const routes = buildRoutes();
  for (const route of routes) writeRoute(template, route);

  console.log(`Static route HTML written for ${routes.length} routes.`);
}

main();
