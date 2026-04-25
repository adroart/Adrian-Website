import { Artwork } from '../types';
import { CARD_BY_NUMBER } from '../data/oracleData';

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
 * Pulls hexagram and Gene Key data from oracleData when available.
 */
export function ulMetaDescription(art: Artwork): string {
  const num = ulCardNumber(art.coverImage);
  if (num != null) {
    const card = CARD_BY_NUMBER.get(num);
    if (card) {
      return `Original multi-dimensional wooden sculpture, connected to ${card.iching.hexagram_name} (Hexagram ${num}) of the I Ching and Gene Key ${num}: ${card.gene_keys.gift}. One of 64 sculptures by Adrian Rasmussen.`;
    }
  }
  return `Original multi-dimensional wooden sculpture. One of 64 works in the Universal Language series by Adrian Rasmussen, each connected to a hexagram of the I Ching and a corresponding Gene Key.`;
}

/**
 * SEO-optimised page title for a Universal Language piece.
 * The useMetaTags hook appends "| Adrian Rasmussen" automatically.
 */
export function ulMetaTitle(art: Artwork): string {
  return `${art.title} · Universal Language · Mandala Art`;
}
