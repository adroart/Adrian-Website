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
    title: 'Adrian Rasmussen | Technician of the Sacred',
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

export function useSeoMeta(pathname: string) {
  useEffect(() => {
    // Match dynamic routes to their parent config
    let routeKey = pathname;
    if (pathname.startsWith('/writings/') && pathname !== '/writings') {
      routeKey = '/writings';
    } else if (pathname.startsWith('/creations/') && pathname !== '/creations') {
      routeKey = '/creations';
    } else if (pathname.startsWith('/series/')) {
      routeKey = '/creations';
    }
    const config = SEO_BY_ROUTE[routeKey] ?? SEO_BY_ROUTE['/'];

    document.title = config.title;
    setMeta('meta[name="description"]', config.description);
    setMeta('meta[property="og:title"]', config.title);
    setMeta('meta[property="og:description"]', config.description);
    setMeta('meta[name="twitter:title"]', config.title);
    setMeta('meta[name="twitter:description"]', config.description);
  }, [pathname]);
}
