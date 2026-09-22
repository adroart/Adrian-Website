import { Artwork } from '../types';

/**
 * Helpers for the Universal Language art series on this site.
 *
 * The companion *oracle deck* of the same 64 pieces lives at
 * mandalacodes.com. Both come from the same hand, and the SEO copy here
 * acknowledges that without leaning on oracle data, so the art-series
 * pages remain stand-alone fine-art pages while still pointing the
 * curious toward the deeper project.
 */

/**
 * Parse the card number from a Universal Language coverImage public ID.
 * Images are named like "32_x9qxas" or "adrian-website/creations/universal-language/art-of-living-32".
 * Returns null if the number cannot be determined.
 */
export function ulCardNumber(coverImage: string): number | null {
  // Pattern 1: "32_x9qxas" - number is before the first underscore
  const shortMatch = coverImage.match(/^(\d+)_/);
  if (shortMatch) return parseInt(shortMatch[1], 10);

  // Pattern 2: ends with "-32" - number is after the last hyphen
  const longMatch = coverImage.match(/-(\d+)$/);
  if (longMatch) return parseInt(longMatch[1], 10);

  return null;
}

/** A sculpture and its companion card join by number, never by their titles. */
export function companionCardUrl(art: Pick<Artwork, 'series' | 'coverImage'>): string | null {
  const number = ulCardNumber(art.coverImage);
  return art.series === 'Universal Language' && number !== null && number >= 1 && number <= 64
    ? `https://mandalacodes.com/universal-language/${number}`
    : null;
}

/** External navigation has no React router state. Accept only this piece's card. */
export function contextualCardReturn(
  art: Pick<Artwork, 'series' | 'coverImage'>,
  search: string,
  legacyOrigin?: unknown,
): string | null {
  const destination = companionCardUrl(art);
  if (!destination) return null;
  const number = ulCardNumber(art.coverImage);
  const params = new URLSearchParams(search);
  if (params.getAll('from').length === 1 && params.get('from') === 'mandalacodes'
    && params.getAll('card').length === 1 && params.get('card') === String(number)) {
    return destination;
  }
  if (typeof legacyOrigin !== 'string') return null;
  try {
    const origin = new URL(legacyOrigin, 'https://mandalacodes.com');
    if (origin.origin !== 'https://mandalacodes.com' || origin.username || origin.password
      || ![`/universal-language/${number}`, `/oracle/universal-language/${number}`].includes(origin.pathname)) return null;
    const target = new URL(destination);
    const system = origin.searchParams.get('system');
    if (system && /^[a-z-]{1,40}$/.test(system)) target.searchParams.set('system', system);
    return target.href;
  } catch { return null; }
}

/**
 * SEO-optimised alt text for a Universal Language artwork.
 * Pattern: "[Piece Name], Universal Language [Number]. Original multi-dimensional wooden sculpture by Adrian Rasmussen."
 */
export function ulAltText(art: Artwork, number?: number | null): string {
  const num = number ?? ulCardNumber(art.coverImage);
  const numberPart = num != null ? ` ${num}` : '';
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
  return `${cleanTitle}, Universal Language${numberPart}. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`;
}

/**
 * SEO-optimised meta description for a Universal Language piece page.
 *
 * Cross-links to the companion oracle deck at mandalacodes without
 * embedding oracle data here, so this site can stay a clean art-series
 * presentation. Two SEO surfaces, one creator, one body of work.
 */
export function ulMetaDescription(art: Artwork, number?: number | null): string {
  const num = number ?? ulCardNumber(art.coverImage);
  const numberPart = num != null ? ` (number ${num} of 64)` : '';
  return `Original multi-dimensional wooden sculpture${numberPart} by Adrian Rasmussen, from the Universal Language series. The companion oracle deck of the same 64 pieces lives at mandalacodes.com.`;
}

/**
 * SEO-optimised page title for a Universal Language piece.
 * The useMetaTags hook appends "| Adrian Rasmussen" automatically.
 */
export function ulMetaTitle(art: Artwork): string {
  return `${art.title} · Universal Language · Mandala Art`;
}
