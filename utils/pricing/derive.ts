/**
 * Bridge from a real artwork to pricing-engine inputs.
 *
 * Lets the internal calculator load any existing piece and price it, which is
 * the whole point of the tool: determining the prices of all the art. A piece
 * can carry explicit `pricingFactors`; otherwise we derive what we can from
 * the human-readable `dimensions`, `finish`, and `illuminated` fields it
 * already has, and fall back to sensible middles for the rest.
 */

import { Artwork } from '../../types';
import { InternalInputs, PricingConfig, LightingType } from './types';
import { cmToIn } from './engine';

/** Pull a diameter (in inches) out of a dimensions string like "23 in (58 cm) square". */
export function parseDiameterIn(dimensions?: string): number | null {
  if (!dimensions) return null;
  const inMatch = dimensions.match(/([\d.]+)\s*in\b/i);
  if (inMatch) return parseFloat(inMatch[1]);
  const cmMatch = dimensions.match(/([\d.]+)\s*cm\b/i);
  if (cmMatch) return Math.round(cmToIn(parseFloat(cmMatch[1])));
  const bare = dimensions.match(/([\d.]+)/);
  return bare ? parseFloat(bare[1]) : null;
}

/** Match a piece's finish label to a configured finish id (case-insensitive). */
function finishIdFor(art: Artwork, config: PricingConfig): string {
  const label = (art.finish || '').toLowerCase();
  if (label) {
    const byLabel = config.finishes.find((f) => f.label.toLowerCase() === label);
    if (byLabel) return byLabel.id;
    if (label.includes('crystal')) {
      const c = config.finishes.find((f) => f.usesCrystals);
      if (c) return c.id;
    }
    if (label.includes('paint') || label.includes('gold') || label.includes('leaf')) {
      const p = config.finishes.find((f) => f.percent > 0 && !f.usesCrystals);
      if (p) return p.id;
    }
  }
  return config.finishes[0]?.id ?? 'natural';
}

/**
 * Build a full set of calculator inputs for a piece, layering explicit
 * pricingFactors over derived values over defaults.
 */
export function inputsFromArtwork(art: Artwork, config: PricingConfig): InternalInputs {
  const f = art.pricingFactors ?? {};
  const diameterIn = f.diameterIn ?? parseDiameterIn(art.dimensions) ?? 24;
  const lightingType: LightingType =
    f.lightingType ?? (art.illuminated ? 'simple' : 'none');

  return {
    diameterIn,
    layerCount: f.layerCount ?? 5,
    finishId: f.finishId ?? finishIdFor(art, config),
    crystalBudget: 0,
    lightingType,
    hasFrame: f.hasFrame ?? false,
    frameCostOverride: null,
    hasClimateProtection: f.hasClimateProtection ?? false,
    climateCostOverride: null,
    hasProjectionMapping: false,
    designAdjustment: 0,
  };
}
