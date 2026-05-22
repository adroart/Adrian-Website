import type { Artwork } from '../types';

export function isLaserCutWoodArtwork(art: Artwork): boolean {
  const searchable = [
    art.material,
    art.description,
    art.longDescription,
    art.seriesDescription,
  ]
    .filter(Boolean)
    .join(' ');

  return /laser[-\s]?cut/i.test(searchable) && /wood/i.test(searchable);
}

export function mandalaAltText(title: string): string {
  return `${title} by Adrian Rasmussen. Original sacred geometry mandala artwork in layered laser-cut wood.`;
}

export function laserCutWoodAltText(title: string): string {
  return `${title} by Adrian Rasmussen. Layered laser-cut wood artwork with hand-finished surface work.`;
}
