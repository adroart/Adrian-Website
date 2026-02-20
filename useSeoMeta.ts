import { useEffect } from 'react';

interface SeoConfig {
  title: string;
  description: string;
}

const SEO_BY_ROUTE: Record<string, SeoConfig> = {
  '/': {
    title: 'Adrian Rasmussen | Bringing the Formless into Form',
    description:
      'Multidimensional art, sculptures, and immersive installations. From intimate talismans to immersive installations. Created between Bali and California.',
  },
  '/creations': {
    title: 'Creations | Adrian Rasmussen',
    description:
      'Multidimensional sculptures, jewelry, oracle cards, tables, installations, and spaces. Find what calls to you.',
  },
  '/writings': {
    title: 'Writings | Adrian Rasmussen',
    description:
      'Sharing the experiences of growth and wisdom. Living Knowledge, practice, and the path.',
  },
  '/about': {
    title: 'About | Adrian Rasmussen',
    description:
      'Technician of the Sacred. Multidimensional artist working between studios in Bali and Santa Cruz, California.',
  },
  '/inquire': {
    title: 'Inquire | Adrian Rasmussen',
    description:
      'Commission a piece. From personal talismans to immersive installations.',
  },
  '/shop': {
    title: 'Shop | Adrian Rasmussen',
    description:
      'Ready-to-ship artwork. Multidimensional sculptures, Light Codes, jewelry, and more.',
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
