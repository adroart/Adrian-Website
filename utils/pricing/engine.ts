/**
 * Pricing engine — pure functions, no React, no I/O.
 *
 * The whole point of keeping this separate is that it can be reasoned about
 * and tested on its own, and that the internal calculator and the customer
 * explorer compute prices the exact same way. Every number it needs comes
 * from a PricingConfig (see ./config.ts), so nothing here is hard-coded.
 */

import {
  PricingConfig,
  InternalInputs,
  PriceBreakdown,
  PriceLine,
  SizeTieredCost,
  LayerTier,
  CustomerInputs,
  CustomerRange,
  SavedQuote,
} from './types';

const CM_PER_IN = 2.54;

export const inToCm = (inches: number): number => inches * CM_PER_IN;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;

/** Round to the nearest `step` dollars (defaults to whole dollars). */
export function roundToNearest(value: number, step: number): number {
  if (!step || step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

/**
 * Base price for any diameter, interpolated smoothly along the anchor curve.
 * Below the smallest anchor or above the largest, the nearest anchor holds
 * (we clamp rather than extrapolate into nonsense).
 */
export function interpolateSize(diameterIn: number, config: PricingConfig): number {
  const anchors = [...config.sizeAnchors].sort((a, b) => a.diameterIn - b.diameterIn);
  if (anchors.length === 0) return 0;
  if (diameterIn <= anchors[0].diameterIn) return anchors[0].price;
  const last = anchors[anchors.length - 1];
  if (diameterIn >= last.diameterIn) return last.price;

  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    if (diameterIn >= lo.diameterIn && diameterIn <= hi.diameterIn) {
      const span = hi.diameterIn - lo.diameterIn;
      const t = span === 0 ? 0 : (diameterIn - lo.diameterIn) / span;
      return lo.price + t * (hi.price - lo.price);
    }
  }
  return last.price;
}

/** The multiplier for an exact layer count, using the configured tier bands. */
export function getLayerMultiplier(layerCount: number, config: PricingConfig): number {
  const tiers = config.layerTiers;
  if (tiers.length === 0) return 1;
  const match = tiers.find((t) => layerCount >= t.minLayers && layerCount <= t.maxLayers);
  return (match ?? tiers[tiers.length - 1]).multiplier;
}

/** Midpoint of the size-tiered range that contains this diameter. */
export function tieredMidpoint(tiers: SizeTieredCost[], diameterIn: number): number {
  const t = tierFor(tiers, diameterIn);
  return t ? (t.min + t.max) / 2 : 0;
}

/** The size-tier row that applies to this diameter (or the last as a fallback). */
export function tierFor(tiers: SizeTieredCost[], diameterIn: number): SizeTieredCost | null {
  if (!tiers || tiers.length === 0) return null;
  const match = tiers.find((t) => diameterIn >= t.minSizeIn && diameterIn <= t.maxSizeIn);
  return match ?? tiers[tiers.length - 1];
}

/**
 * The full anatomy of a price. The order mirrors how a piece is actually
 * built up: size, then layers, then finish, then the physical add-ons, then
 * the design value only Adrian can name, then margin for the asking price.
 */
export function calculatePricing(inputs: InternalInputs, config: PricingConfig): PriceBreakdown {
  const sizeBase = interpolateSize(inputs.diameterIn, config);
  const layerMultiplier = getLayerMultiplier(inputs.layerCount, config);
  const afterLayers = sizeBase * layerMultiplier;

  const finish = config.finishes.find((f) => f.id === inputs.finishId) ?? config.finishes[0];
  const finishAddition = afterLayers * (finish?.percent ?? 0);

  const crystalAddition = finish?.usesCrystals ? Math.max(0, inputs.crystalBudget || 0) : 0;

  const lightingOption = config.lighting.find((l) => l.id === inputs.lightingType);
  const lighting =
    lightingOption && inputs.lightingType !== 'none'
      ? tieredMidpoint(lightingOption.tiers, inputs.diameterIn)
      : 0;

  const frame = inputs.hasFrame
    ? inputs.frameCostOverride != null
      ? inputs.frameCostOverride
      : tieredMidpoint(config.frameRanges, inputs.diameterIn)
    : 0;

  const climate = inputs.hasClimateProtection
    ? inputs.climateCostOverride != null
      ? inputs.climateCostOverride
      : tieredMidpoint(config.climateRanges, inputs.diameterIn)
    : 0;

  const productionBaseline =
    afterLayers + finishAddition + crystalAddition + lighting + frame + climate;

  const designAdjustment = Math.max(0, inputs.designAdjustment || 0);
  const total = productionBaseline + designAdjustment;

  const suggestedRetail = roundToNearest(total, config.roundTo);
  const quote = roundToNearest(suggestedRetail * (1 + config.marginPercent), config.roundTo);

  const lines: PriceLine[] = [
    { label: 'Size', detail: `${formatDiameter(inputs.diameterIn, config)} base`, amount: sizeBase },
    {
      label: 'Layers',
      detail: `${inputs.layerCount} layer${inputs.layerCount === 1 ? '' : 's'} · ×${layerMultiplier.toFixed(2)}`,
      amount: afterLayers - sizeBase,
    },
  ];
  if (finishAddition > 0) {
    lines.push({
      label: 'Finish',
      detail: `${finish?.label ?? ''} · +${Math.round((finish?.percent ?? 0) * 100)}%`,
      amount: finishAddition,
    });
  }
  if (crystalAddition > 0) lines.push({ label: 'Crystals', detail: 'Budget', amount: crystalAddition });
  if (lighting > 0) lines.push({ label: 'Lighting', detail: lightingOption?.label, amount: lighting });
  if (frame > 0) lines.push({ label: 'Frame', amount: frame });
  if (climate > 0) lines.push({ label: 'Climate protection', amount: climate });

  return {
    lines,
    sizeBase,
    layerMultiplier,
    afterLayers,
    finishAddition,
    crystalAddition,
    lighting,
    frame,
    climate,
    productionBaseline,
    designAdjustment,
    total,
    suggestedRetail,
    quote,
    projectionNote: inputs.hasProjectionMapping ? config.projectionStartingPrice : null,
  };
}

/** Format a diameter in the unit the config is currently set to. */
export function formatDiameter(diameterIn: number, config: PricingConfig): string {
  if (config.measurementUnit === 'metric') {
    return `${Math.round(inToCm(diameterIn))} cm`;
  }
  return `${Math.round(diameterIn)}"`;
}

/** Format whole-dollar money. Mirrors utils/formatPrice but rounds first. */
export function formatMoney(value: number): string {
  return '$' + Math.round(value).toLocaleString('en-US');
}

// ----- Customer-facing translation -------------------------------------------

const SIZE_CATEGORY_MIDPOINT_IN: Record<CustomerInputs['sizeCategory'], number> = {
  small: 9, // 6–12"
  medium: 18, // 12–24"
  large: 30, // 24–36"
  statement: 44, // 36"+
};

const COMPLEXITY_LAYERS: Record<CustomerInputs['complexity'], number> = {
  simple: 2,
  layered: 5,
  intricate: 9,
};

/**
 * Translate the simplified customer choices into a production baseline, then
 * return a range. The low end is the baseline; the high end leaves room for
 * creative investment. No design adjustment, no crystals, no margin — those
 * belong to the conversation, not the doorway.
 */
export function customerRange(inputs: CustomerInputs, config: PricingConfig): CustomerRange {
  const internal: InternalInputs = {
    diameterIn: SIZE_CATEGORY_MIDPOINT_IN[inputs.sizeCategory],
    layerCount: COMPLEXITY_LAYERS[inputs.complexity],
    finishId: inputs.finishId,
    crystalBudget: 0,
    lightingType: inputs.illumination,
    hasFrame: false,
    frameCostOverride: null,
    hasClimateProtection: false,
    climateCostOverride: null,
    hasProjectionMapping: false,
    designAdjustment: 0,
  };
  const baseline = calculatePricing(internal, config).productionBaseline;
  return {
    low: roundToNearest(baseline, config.roundTo),
    high: roundToNearest(baseline * (1 + config.designSpreadPercent), config.roundTo),
  };
}

// ----- Calibration ------------------------------------------------------------

export interface CalibrationInsight {
  /** How many saved quotes have an actual price to compare against. */
  calibratedCount: number;
  /** Average absolute distance between suggested and actual, as a percent. */
  meanAbsVariancePct: number;
  /** Median of actual / suggested. >1 means the formula tends to run low. */
  medianRatio: number;
  /** (medianRatio - 1) as a percent: how far, and which way, the formula leans. */
  biasPct: number;
}

/**
 * Compare what the formula suggested against what was actually charged across
 * the saved pieces. Returns null until there are at least three calibrated
 * quotes — fewer than that is anecdote, not signal. The medianRatio is the
 * factor to scale the size base by to recenter the model on reality.
 */
export function calibrationInsights(quotes: SavedQuote[]): CalibrationInsight | null {
  const pairs = quotes
    .filter((q) => q.actualPrice != null && q.actualPrice > 0 && q.suggestedRetail > 0)
    .map((q) => ({
      ratio: (q.actualPrice as number) / q.suggestedRetail,
      absVar: Math.abs((q.actualPrice as number) - q.suggestedRetail) / q.suggestedRetail,
    }));
  if (pairs.length < 3) return null;

  const ratios = pairs.map((p) => p.ratio).sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const medianRatio =
    ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];
  const meanAbs = pairs.reduce((s, p) => s + p.absVar, 0) / pairs.length;

  return {
    calibratedCount: pairs.length,
    meanAbsVariancePct: Math.round(meanAbs * 100),
    medianRatio,
    biasPct: Math.round((medianRatio - 1) * 100),
  };
}
