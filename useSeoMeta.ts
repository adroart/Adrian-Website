import { useEffect } from 'react';
import { DEFAULT_SEO_IMAGE, resolveCanonicalUrl, resolveSeoConfig } from './utils/seoMetadata';

function setMeta(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) {
    el.content = content;
  }
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

export function useSeoMeta(pathname: string) {
  useEffect(() => {
    const config = resolveSeoConfig(pathname);
    const canonicalUrl = resolveCanonicalUrl(pathname);
    const image = config.image ?? DEFAULT_SEO_IMAGE;

    document.title = config.title;
    setMeta('meta[name="description"]', config.description);
    setMeta('meta[property="og:title"]', config.title);
    setMeta('meta[property="og:description"]', config.description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[name="twitter:title"]', config.title);
    setMeta('meta[name="twitter:description"]', config.description);
    setMeta('meta[name="twitter:image"]', image);
    setCanonical(canonicalUrl);
    setOgUrl(canonicalUrl);
  }, [pathname]);
}
