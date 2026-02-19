import { useEffect } from 'react';

interface SeoConfig {
  title: string;
  description: string;
}

const SEO_BY_ROUTE: Record<string, SeoConfig> = {
  '/': {
    title: 'Adrian Rasmussen | Resonant Artifacts',
    description:
      'Multi-dimensional laser cut artwork, original paintings, and sacred geometry by Adrian Rasmussen. Created between Bali and California.',
  },
  '/creations': {
    title: 'Creations | Adrian Rasmussen',
    description:
      'Explore the full gallery of laser-cut sculptures, LED paintings, jewelry, oracle cards, and immersive installations by Adrian Rasmussen.',
  },
  '/writings': {
    title: 'Writings | Adrian Rasmussen',
    description:
      'Reflections on art, consciousness, tea, and craftsmanship by Adrian Rasmussen. Sharing experiences of growth and wisdom.',
  },
  '/about': {
    title: 'About | Adrian Rasmussen',
    description:
      'Adrian Rasmussen is an artist and craftsman creating multi-dimensional wooden sculptures, paintings, and spaces designed for presence. Working between Bali and California.',
  },
  '/inquire': {
    title: 'Inquire | Adrian Rasmussen',
    description:
      "Commission a piece or begin a conversation about acquiring original artwork from Adrian Rasmussen's studio in Bali.",
  },
  '/shop': {
    title: 'Shop | Adrian Rasmussen',
    description:
      'Browse available artworks ready to ship from Bali. Original laser-cut sculptures, paintings, teas, and accessories.',
  },
  '/cart': {
    title: 'Your Selection | Adrian Rasmussen',
    description: "Review your selected pieces from Adrian Rasmussen's studio.",
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
    const config = SEO_BY_ROUTE[pathname] ?? SEO_BY_ROUTE['/'];

    document.title = config.title;
    setMeta('meta[name="description"]', config.description);
    setMeta('meta[property="og:title"]', config.title);
    setMeta('meta[property="og:description"]', config.description);
    setMeta('meta[name="twitter:title"]', config.title);
    setMeta('meta[name="twitter:description"]', config.description);
  }, [pathname]);
}
