/**
 * Post-build: give every public route its own <head>.
 *
 * The app sets titles and OG tags from React, after hydration. Google runs that;
 * Facebook, Instagram, WhatsApp, iMessage, Pinterest, Slack and X do not. Before this
 * script existed, all 259 URLs in the sitemap shared one title, one description, and one
 * og:image that pointed at a file named `placeholders/hero-wide-1` — so every share of
 * every artwork rendered as the same anonymous card.
 *
 * The mechanism is the one already proven by generate-og-pages.ts: write a flat .html
 * file per route into dist/. Cloudflare Pages' HTML extension stripping serves
 * dist/creations/amphibian-dream.html for /creations/amphibian-dream, and static file
 * matching runs BEFORE the _redirects catch-all, so the crawler gets the right tags on
 * the first byte with no JavaScript. The file carries the same bundle as index.html, so
 * React hydrates and takes over exactly as before.
 *
 * Run after `vite build` (wired into the `build` script in package.json).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { FULL_ARCHIVE, CREATION_CATEGORIES, MULTIDIMENSIONAL_CATEGORIES } from '../data/mockData';
import { STORIES } from '../data/generatedStories';
import { pieceSlug } from '../utils/pieceSlug';
import type { Artwork } from '../types';

const DIST = join(process.cwd(), 'dist');
const SITE = 'https://adrianrasmussen.com';
const CLD = 'https://res.cloudinary.com/dobbosnda/image/upload';

/** 1200x630 social card crop. */
const og = (publicId: string) => `${CLD}/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${publicId}`;
/** Square crop — Pinterest and WhatsApp both prefer it for a single object. */
const ogSquare = (publicId: string) => `${CLD}/f_auto,q_auto,w_1200,h_1200,c_fill,g_auto/${publicId}`;

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Trim to a whole word under `max`, appending an ellipsis only if we actually cut. */
function clamp(text: string, max = 155): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max - 1);
    return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
}

interface Route {
    /** Path without leading slash. '' means the site root. */
    path: string;
    title: string;
    description: string;
    image: string;
    /** 'website' for indexes, 'article' for writings, 'product' for a purchasable piece. */
    ogType?: string;
    /** Extra JSON-LD blocks, already objects. */
    schema?: unknown[];
}

/* ─── Build the route list from the real catalog ─────────────────────────── */

const routes: Route[] = [];

/* Home. The placeholder OG image is replaced with an actual piece — the site's
   own front door was sharing as a stock crop of a file called "placeholder". */
const homeHero = FULL_ARCHIVE.find(a => a.featured && a.coverImage) ?? FULL_ARCHIVE[0];
routes.push({
    path: '',
    title: 'Adrian Rasmussen | Bringing the Formless into Form',
    description:
        'Multi-dimensional wooden sculptures, sacred geometry, and immersive installations. ' +
        'Original work from the studio, made to order or ready to ship.',
    image: og(homeHero.coverImage),
});

/* Static pages. */
const STATIC: Array<[string, string, string]> = [
    [
        'creations',
        'Creations | Adrian Rasmussen',
        'Multi-dimensional wooden sculptures, illuminated works, jewelry and objects. Browse the full body of work, filter by what is ready to ship.',
    ],
    [
        'about',
        'About | Adrian Rasmussen',
        'I create art and spaces of presence and connection. Multi-dimensional wooden sculptures with original paintings, light, and crystals.',
    ],
    [
        'inquire',
        'Commissions | Adrian Rasmussen',
        'I take on a small number of commissions each year. Personal pieces for a home or altar, and spatial work that transforms a whole environment.',
    ],
    [
        'writings',
        'Writings | Adrian Rasmussen',
        'Essays and field notes from the studio. On sacred geometry, material, ceremony, and the practice of making.',
    ],
    [
        'poetry',
        'Poetry | Adrian Rasmussen',
        'Poems given voice through music. Written in notebooks, in margins, in the quiet after ceremony.',
    ],
    [
        'oracle',
        'The Oracle | Adrian Rasmussen',
        'The 64 Universal Language pieces also live as an oracle deck at mandalacodes.com. One creator, two doors into the same work.',
    ],
];
for (const [path, title, description] of STATIC) {
    routes.push({ path, title, description, image: og(homeHero.coverImage) });
}

/* Category and subcategory indexes. */
for (const cat of CREATION_CATEGORIES as Array<{ slug?: string; name?: string; title?: string; description?: string; image?: string; hidden?: boolean }>) {
    if (cat.hidden || !cat.slug) continue;
    const name = cat.title ?? cat.name ?? cat.slug;
    routes.push({
        path: `creations/${cat.slug}`,
        title: `${name} | Adrian Rasmussen`,
        description: clamp(cat.description ?? `${name} by Adrian Rasmussen. Original multi-dimensional work from the studio.`),
        image: cat.image ? og(cat.image) : og(homeHero.coverImage),
    });
}
for (const sub of MULTIDIMENSIONAL_CATEGORIES as Array<{ slug?: string; name?: string; title?: string; description?: string; image?: string; hidden?: boolean }>) {
    if (sub.hidden || !sub.slug) continue;
    const name = sub.title ?? sub.name ?? sub.slug;
    routes.push({
        path: `creations/multidimensional-art/${sub.slug}`,
        title: `${name} | Adrian Rasmussen`,
        description: clamp(sub.description ?? `${name}. Original multi-dimensional wooden sculptures by Adrian Rasmussen.`),
        image: sub.image ? og(sub.image) : og(homeHero.coverImage),
    });
}

/* Every piece — under its canonical slug, and again under its legacy catalog id so
   links shared before the slug change still arrive with the right card. */
function pieceRoute(art: Artwork, path: string, canonicalPath: string): Route {
    const priced = typeof art.price === 'number' && art.price > 0;
    const sold = art.availability === 'SOLD';
    const detail = [art.dimensions, art.material, art.year].filter(Boolean).join(' · ');

    const schema: unknown[] = [
        {
            '@context': 'https://schema.org',
            '@type': 'VisualArtwork',
            name: art.title,
            description: clamp(art.description, 300),
            url: `${SITE}${canonicalPath}`,
            image: ogSquare(art.coverImage),
            creator: { '@type': 'Person', name: 'Adrian Rasmussen', url: `${SITE}/about` },
            ...(art.year && { dateCreated: art.year }),
            ...(art.material && { artMedium: art.material }),
            ...(art.dimensions && { size: art.dimensions }),
            ...(art.series && { isPartOf: { '@type': 'Collection', name: `${art.series} Series` } }),
            ...(priced && {
                offers: {
                    '@type': 'Offer',
                    price: art.price,
                    priceCurrency: 'USD',
                    availability: sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
                    url: `${SITE}${canonicalPath}`,
                    seller: { '@type': 'Person', name: 'Adrian Rasmussen' },
                },
            }),
        },
    ];

    return {
        path,
        title: `${art.title} | Adrian Rasmussen`,
        description: clamp(
            art.description ||
                `${art.title}. ${detail || 'Original multi-dimensional work by Adrian Rasmussen.'}`,
        ),
        image: ogSquare(art.coverImage),
        ogType: priced && !sold ? 'product' : 'website',
        schema,
    };
}

for (const art of FULL_ARCHIVE) {
    if (!art.coverImage) continue;
    const slug = pieceSlug(art);
    const canonical = `/creations/${slug}`;
    routes.push(pieceRoute(art, `creations/${slug}`, canonical));
    // Legacy id URL: same card, but canonical still points at the slug.
    if (art.id.toLowerCase() !== slug) {
        routes.push(pieceRoute(art, `creations/${art.id}`, canonical));
    }
}

/* Writings. */
for (const story of STORIES) {
    if (!story.slug) continue;
    routes.push({
        path: `writings/${story.slug}`,
        title: `${story.title} | Adrian Rasmussen`,
        description: clamp(story.excerpt ?? story.subtitle ?? story.title),
        image: story.image ? og(story.image) : og(homeHero.coverImage),
        ogType: 'article',
        schema: [
            {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: story.title,
                description: clamp(story.excerpt ?? story.title, 300),
                url: `${SITE}/writings/${story.slug}`,
                ...(story.image && { image: og(story.image) }),
                ...(story.date && { datePublished: story.date }),
                author: { '@type': 'Person', name: 'Adrian Rasmussen', url: `${SITE}/about` },
                publisher: { '@type': 'Person', name: 'Adrian Rasmussen' },
            },
        ],
    });
}

/* ─── Emit ───────────────────────────────────────────────────────────────── */

const templatePath = join(DIST, 'index.html');
if (!existsSync(templatePath)) {
    console.error('✗ prerender-meta: dist/index.html not found. Run vite build first.');
    process.exit(1);
}
const template = readFileSync(templatePath, 'utf-8');

function render(route: Route): string {
    const canonical = `${SITE}/${route.path}`.replace(/\/$/, '') || SITE;
    const title = esc(route.title);
    const description = esc(route.description);
    const image = esc(route.image);

    let html = template;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    html = html.replace(
        /(<meta name="description"\s+content=")[^"]*(")/,
        `$1${description}$2`,
    );
    html = html.replace(/(<meta property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`);
    html = html.replace(
        /(<meta property="og:description"\s+content=")[^"]*(")/,
        `$1${description}$2`,
    );
    html = html.replace(/(<meta property="og:image"\s+content=")[^"]*(")/, `$1${image}$2`);
    html = html.replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/, `$1${title}$2`);
    html = html.replace(
        /(<meta name="twitter:description"\s+content=")[^"]*(")/,
        `$1${description}$2`,
    );
    html = html.replace(/(<meta name="twitter:image"\s+content=")[^"]*(")/, `$1${image}$2`);

    if (route.ogType) {
        html = html.replace(/(<meta property="og:type"\s+content=")[^"]*(")/, `$1${route.ogType}$2`);
    }

    // Square crops need honest dimensions or Slack and WhatsApp letterbox them.
    if (route.image.includes('h_1200')) {
        html = html
            .replace(/(<meta property="og:image:width"\s+content=")[^"]*(")/, '$11200$2')
            .replace(/(<meta property="og:image:height"\s+content=")[^"]*(")/, '$11200$2');
    }

    const head: string[] = [`    <meta property="og:url" content="${esc(canonical)}" />`,
                           `    <link rel="canonical" href="${esc(canonical)}" />`];
    for (const block of route.schema ?? []) {
        head.push(
            `    <script type="application/ld+json">\n${JSON.stringify(block, null, 2).replace(
                /</g,
                '\\u003c',
            )}\n    </script>`,
        );
    }
    html = html.replace('</head>', `${head.join('\n')}\n  </head>`);

    return html;
}

let written = 0;
for (const route of routes) {
    const rel = route.path === '' ? 'index.html' : `${route.path}.html`;
    const out = join(DIST, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, render(route), 'utf-8');
    written++;
}

const pieces = routes.filter(r => r.ogType === 'product').length;
console.log(
    `✓ prerender-meta: ${written} routes with their own head ` +
        `(${pieces} purchasable pieces carry Product/Offer schema)`,
);
