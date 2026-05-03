import { useEffect } from 'react';

interface SeoConfig {
  title: string;
  description: string;
}

const SEO_BY_ROUTE: Record<string, SeoConfig> = {
  '/': {
    title: 'Adrian Rasmussen | Bringing the Formless into Form',
    description:
      'Multidimensional art, sacred geometry sculptures, and immersive installations by Adrian Rasmussen. Created between studios in Bali and California.',
  },
  '/creations': {
    title: 'Creations | Adrian Rasmussen',
    description:
      'Explore multidimensional sculptures, sacred geometry art, laser cut pieces, jewelry, oracle cards, tables, and immersive installations by Adrian Rasmussen.',
  },
  '/creations/illuminated-works': {
    title: 'Illuminated Works | Adrian Rasmussen',
    description:
      'Layered wood sculpture with embedded light. Pieces that reveal a second life after dark.',
  },
  '/creations/multidimensional-art': {
    title: 'Multidimensional Art | Adrian Rasmussen',
    description:
      'Universal Language, Mandala, Light Codes, and Signature Pieces. Windows into the infinite.',
  },
  '/creations/multidimensional-art/universal-language': {
    title: 'Universal Language | Mandala Art by Adrian Rasmussen',
    description:
      'Sixty-four original airbrushed paintings on laser-cut wood. Each piece connected to a hexagram of the I Ching and a corresponding Gene Key. A complete mandala series by Adrian Rasmussen.',
  },
  '/oracle/universal-language': {
    title: 'Universal Language Oracle | Adrian Rasmussen',
    description:
      'Sixty-four cards. Each carrying a hexagram of the I Ching, a Gene Key, and a gate from Human Design. A complete system for working with the cycle of changes. By Adrian Rasmussen.',
  },
  '/oracle/the-systems': {
    title: 'The Three Systems | Adrian Rasmussen',
    description:
      'A lineage of changes. The I Ching, the Gene Keys, and Human Design, with respect to the originators and translators whose work the Universal Language Oracle stands inside of.',
  },
  '/writings': {
    title: 'Writings | Adrian Rasmussen',
    description:
      'Essays and presentations on sacred geometry, Ye Ming Zhu crystals, the creative practice, and the artistic path. Living Knowledge by Adrian Rasmussen.',
  },
  '/about': {
    title: 'About | Adrian Rasmussen',
    description:
      'Adrian Rasmussen is a multidimensional artist creating sacred geometry sculptures, installations, and spaces between studios in Bali and California.',
  },
  '/inquire': {
    title: 'Inquire | Adrian Rasmussen',
    description:
      'Commission a custom piece by Adrian Rasmussen. From personal sacred geometry talismans to large-scale installations and immersive environment designs.',
  },
  '/shop': {
    title: 'Shop | Adrian Rasmussen',
    description:
      'Shop ready-to-ship sacred geometry art, multidimensional sculptures, laser cut pieces, handcrafted jewelry, and unique creations by Adrian Rasmussen.',
  },
  '/welcome': {
    title: 'Adrian Rasmussen | Bringing the Formless into Form',
    description:
      'Multidimensional art between Bali and California. Explore creations, writings, and commissions.',
  },
  '/privacy': {
    title: 'Privacy Policy | Adrian Rasmussen',
    description: 'Privacy policy for adrianrasmussen.com.',
  },
  '/terms': {
    title: 'Terms of Service | Adrian Rasmussen',
    description: 'Terms of service for adrianrasmussen.com.',
  },
};

function setMeta(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) {
    el.content = content;
  }
}

const SUBCATEGORY_NAMES: Record<string, string> = {
  'universal-language': 'Universal Language',
  'mandala': 'Mandala',
  'light-codes': 'Light Codes',
  'signature-pieces': 'Signature Pieces',
};

function resolveConfig(pathname: string): SeoConfig {
  if (SEO_BY_ROUTE[pathname]) return SEO_BY_ROUTE[pathname];

  // Dynamic: /creations/multidimensional-art/:subcategory
  if (pathname.startsWith('/creations/multidimensional-art/')) {
    const slug = pathname.split('/').pop() ?? '';
    const name = SUBCATEGORY_NAMES[slug] ?? slug;
    return {
      title: `${name} | Multidimensional Art | Adrian Rasmussen`,
      description: `Explore the ${name} series. Multidimensional artworks by Adrian Rasmussen.`,
    };
  }

  return SEO_BY_ROUTE['/'];
}

function setCanonical(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

function setOgUrl(url: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', 'og:url');
    document.head.appendChild(meta);
  }
  meta.content = url;
}

const SITE_ORIGIN = 'https://adrianrasmussen.com';

function resolveCanonical(pathname: string): string {
  // Backwards-compat: /universal-language/:number paths canonicalize to /oracle/universal-language/:number
  if (/^\/universal-language\//.test(pathname)) {
    return `${SITE_ORIGIN}/oracle${pathname}`;
  }
  return `${SITE_ORIGIN}${pathname === '/' ? '' : pathname}`;
}

export function useSeoMeta(pathname: string) {
  useEffect(() => {
    const config = resolveConfig(pathname);
    const canonicalUrl = resolveCanonical(pathname);

    document.title = config.title;
    setMeta('meta[name="description"]', config.description);
    setMeta('meta[property="og:title"]', config.title);
    setMeta('meta[property="og:description"]', config.description);
    setMeta('meta[name="twitter:title"]', config.title);
    setMeta('meta[name="twitter:description"]', config.description);
    setCanonical(canonicalUrl);
    setOgUrl(canonicalUrl);
  }, [pathname]);
}
