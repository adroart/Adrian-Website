import { useEffect } from 'react';
import { SITE } from '../constants';
import { img } from '../utils/media';

const DEFAULT_TITLE = 'Adrian Rasmussen | Bringing the Formless into Form';
const DEFAULT_DESCRIPTION =
  'Multidimensional art, sacred geometry sculptures, and immersive installations by Adrian Rasmussen.';
const DEFAULT_IMAGE = `${SITE.origin}${img('adrian-website/placeholders/hero-wide-1', { w: 1200, h: 630, format: 'jpg' })}`;

interface MetaTagOptions {
  title?: string;
  description?: string;
  image?: string;
}

function setMeta(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement | null;
  }
  if (el) {
    el.setAttribute('content', content);
  }
}

/**
 * Updates document title and Open Graph / Twitter meta tags.
 * Restores defaults on unmount.
 */
export function useMetaTags({ title, description, image }: MetaTagOptions) {
  useEffect(() => {
    const pageTitle = title ? `${title} | Adrian Rasmussen` : DEFAULT_TITLE;
    const pageDesc = description || DEFAULT_DESCRIPTION;
    const pageImage = image || DEFAULT_IMAGE;

    document.title = pageTitle;
    setMeta('description', pageDesc);
    setMeta('og:title', pageTitle);
    setMeta('og:description', pageDesc);
    setMeta('og:image', pageImage);
    setMeta('twitter:title', pageTitle);
    setMeta('twitter:description', pageDesc);
    setMeta('twitter:image', pageImage);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('description', DEFAULT_DESCRIPTION);
      setMeta('og:title', DEFAULT_TITLE);
      setMeta('og:description', DEFAULT_DESCRIPTION);
      setMeta('og:image', DEFAULT_IMAGE);
      setMeta('twitter:title', DEFAULT_TITLE);
      setMeta('twitter:description', DEFAULT_DESCRIPTION);
      setMeta('twitter:image', DEFAULT_IMAGE);
    };
  }, [title, description, image]);
}
