export const SITE_ORIGIN = 'https://adrianrasmussen.com';

export const DEFAULT_SEO_IMAGE =
  'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/adrian-website/placeholders/hero-wide-1';

export const FORBIDDEN_SITE_TERMS = ['wall' + ' art'];

export type SeoPageType =
  | 'website'
  | 'collection'
  | 'artwork'
  | 'article'
  | 'policy';

export interface RouteLaunchFlags {
  shopEnabled: boolean;
}

export interface SeoRouteConfig {
  path: string;
  title: string;
  description: string;
  image?: string;
  pageType: SeoPageType;
  sitemap?: boolean;
  priority?: string;
  launchFlag?: keyof RouteLaunchFlags;
}

export interface SitemapRouteEntry {
  path: string;
  priority: string;
}

const DEFAULT_PRIORITY = '0.8';

export const STATIC_SEO_ROUTES: SeoRouteConfig[] = [
  {
    path: '/',
    title: 'Adrian Rasmussen | Bringing the Formless into Form',
    description:
      'Multidimensional art, sacred geometry sculptures, and immersive installations by Adrian Rasmussen. Created between studios in Bali and California.',
    image: DEFAULT_SEO_IMAGE,
    pageType: 'website',
    priority: '1.0',
  },
  {
    path: '/creations',
    title: 'Creations | Adrian Rasmussen',
    description:
      'Explore multidimensional sculptures, sacred geometry art, laser-cut wood art, jewelry, objects, and immersive installations by Adrian Rasmussen.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/creations/laser-cut-wood-art',
    title: 'Laser-Cut Wood Art | Adrian Rasmussen',
    description:
      'Layered laser-cut wood art by Adrian Rasmussen, including sacred geometry, mandalas, light codes, and multi-dimensional wooden sculptures made in Bali.',
    image:
      'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/Mandala-1_tyujra',
    pageType: 'collection',
    priority: '0.95',
  },
  {
    path: '/creations/illuminated-works',
    title: 'Illuminated Works | Adrian Rasmussen',
    description:
      'Layered wood sculpture with embedded light. Pieces that reveal a second life after dark.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/creations/multidimensional-art',
    title: 'Multidimensional Art | Adrian Rasmussen',
    description:
      'Layered sculpture in wood, crystal, and light. Universal Language, Mandala, Light Codes, and Signature Pieces by Adrian Rasmussen.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/creations/multidimensional-art/universal-language',
    title: 'Universal Language | Multi-Dimensional Wooden Sculptures',
    description:
      'Sixty-four original multi-dimensional wooden sculptures by Adrian Rasmussen, each connected to a hexagram of the I Ching and a Gene Key.',
    image:
      'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/48_ttflpq',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/creations/multidimensional-art/mandala',
    title: 'Mandala Art | Adrian Rasmussen',
    description:
      'Original mandala art by Adrian Rasmussen, created as layered laser-cut wood sculptures with sacred geometry, hand-finished color, and contemplative form.',
    image:
      'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/Mandala-1_tyujra',
    pageType: 'collection',
    priority: '0.95',
  },
  {
    path: '/creations/multidimensional-art/light-codes',
    title: 'Light Codes | Adrian Rasmussen',
    description:
      'Frequencies anchored in matter. Light Codes by Adrian Rasmussen span Frequency Foundations, Embodied Vibrations, and Resonant Formations.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/creations/multidimensional-art/signature-pieces',
    title: 'Signature Pieces | Adrian Rasmussen',
    description:
      'Singular layered wood sculptures by Adrian Rasmussen, each outside a named series and shaped by its own reason for existing.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/oracle/universal-language',
    title: 'Universal Language Oracle | Adrian Rasmussen',
    description:
      'Sixty-four cards. Each carrying a hexagram of the I Ching, a Gene Key, and a gate from Human Design. A complete system for working with the cycle of changes.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/oracle/the-systems',
    title: 'The Three Systems | Adrian Rasmussen',
    description:
      'A lineage of changes. The I Ching, the Gene Keys, and Human Design, with respect to the originators and translators whose work the Universal Language Oracle stands inside of.',
    pageType: 'article',
    priority: '0.8',
  },
  {
    path: '/writings',
    title: 'Writings | Adrian Rasmussen',
    description:
      'Essays and presentations on sacred geometry, Ye Ming Zhu crystals, the creative practice, and the artistic path. Living Knowledge by Adrian Rasmussen.',
    pageType: 'collection',
    priority: '0.9',
  },
  {
    path: '/about',
    title: 'About | Adrian Rasmussen',
    description:
      'Adrian Rasmussen is a multidimensional artist creating sacred geometry sculptures, installations, and spaces between studios in Bali and California.',
    pageType: 'website',
    priority: '0.9',
  },
  {
    path: '/inquire',
    title: 'Inquire | Adrian Rasmussen',
    description:
      'Commission a custom piece by Adrian Rasmussen. From personal sacred geometry talismans to large-scale installations and immersive environment designs.',
    pageType: 'website',
    priority: '0.9',
  },
  {
    path: '/shop',
    title: 'Shop | Adrian Rasmussen',
    description:
      'Shop ready-to-ship sacred geometry art, multidimensional sculptures, laser-cut wood pieces, handcrafted jewelry, and unique creations by Adrian Rasmussen.',
    pageType: 'collection',
    priority: '0.9',
    launchFlag: 'shopEnabled',
  },
  {
    path: '/welcome',
    title: 'Adrian Rasmussen | Bringing the Formless into Form',
    description:
      'Multidimensional art between Bali and California. Explore creations, writings, and commissions.',
    pageType: 'website',
    sitemap: false,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Adrian Rasmussen',
    description: 'Privacy policy for adrianrasmussen.com.',
    pageType: 'policy',
    priority: '0.7',
  },
  {
    path: '/terms',
    title: 'Terms of Service | Adrian Rasmussen',
    description: 'Terms of service for adrianrasmussen.com.',
    pageType: 'policy',
    priority: '0.7',
  },
];

const SEO_BY_ROUTE = new Map(STATIC_SEO_ROUTES.map(route => [route.path, route]));

const SUBCATEGORY_NAMES: Record<string, string> = {
  'universal-language': 'Universal Language',
  mandala: 'Mandala',
  'light-codes': 'Light Codes',
  'signature-pieces': 'Signature Pieces',
};

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function resolveSeoConfig(pathname: string): SeoRouteConfig {
  const normalized = normalizePath(pathname);
  const exact = SEO_BY_ROUTE.get(normalized);
  if (exact) return exact;

  if (normalized.startsWith('/creations/multidimensional-art/')) {
    const slug = normalized.split('/').pop() ?? '';
    const name = SUBCATEGORY_NAMES[slug] ?? slug;
    return {
      path: normalized,
      title: `${name} | Multidimensional Art | Adrian Rasmussen`,
      description: `Explore the ${name} series. Multidimensional artworks by Adrian Rasmussen.`,
      pageType: 'collection',
      priority: DEFAULT_PRIORITY,
    };
  }

  return STATIC_SEO_ROUTES[0];
}

export function resolveCanonicalUrl(pathname: string): string {
  const normalized = normalizePath(pathname);

  if (/^\/universal-language\//.test(normalized)) {
    return `${SITE_ORIGIN}/oracle${normalized}`;
  }

  return `${SITE_ORIGIN}${normalized === '/' ? '' : normalized}`;
}

export function getStaticSitemapEntries(flags: RouteLaunchFlags): SitemapRouteEntry[] {
  return STATIC_SEO_ROUTES
    .filter(route => route.sitemap !== false)
    .filter(route => !route.launchFlag || flags[route.launchFlag])
    .map(route => ({
      path: route.path,
      priority: route.priority ?? DEFAULT_PRIORITY,
    }));
}
