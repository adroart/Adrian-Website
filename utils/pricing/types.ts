/**
 * Pricing model types — the shared vocabulary for the internal pricing
 * calculator (/admin/pricing) and the customer-facing Pricing Explorer.
 *
 * One model, two surfaces. Everything here is data: change a value in the
 * config and both tools move together. See ./engine.ts for the math and
 * ./config.ts for the editable defaults.
 */

export type MeasurementUnit = 'imperial' | 'metric';

/** A point on the size price curve. Diameters between anchors interpolate. */
export interface SizeAnchor {
  /** Diameter in inches (always stored imperial; the UI converts for display). */
  diameterIn: number;
  /** Base price at this diameter, before any other factor. */
  price: number;
}

/** A layer-count band and the multiplier it applies to the size base. */
export interface LayerTier {
  minLayers: number;
  maxLayers: number;
  multiplier: number;
}

/** A finish choice. The percent is applied to the post-layer subtotal. */
export interface FinishOption {
  id: string;
  label: string;
  /** Fraction of the post-layer subtotal added for this finish (0.8 = +80%). */
  percent: number;
  /** When true, the manual crystal budget is added on top as a flat amount. */
  usesCrystals?: boolean;
}

/** A size band with a low/high cost estimate. Used for lighting, frame, climate. */
export interface SizeTieredCost {
  minSizeIn: number;
  maxSizeIn: number;
  min: number;
  max: number;
}

export type LightingType = 'none' | 'simple' | 'custom' | 'full';

export interface LightingOption {
  id: LightingType;
  label: string;
  /** Size-tiered cost ranges. `none` carries empty/zero tiers. */
  tiers: SizeTieredCost[];
}

/** The complete, fully adjustable pricing model. Persisted to localStorage. */
export interface PricingConfig {
  measurementUnit: MeasurementUnit;
  /** Negotiation margin added on top of suggested retail (0.15 = +15%). */
  marginPercent: number;
  /** Round suggested retail and quote to the nearest this many dollars. */
  roundTo: number;
  /** Customer-facing high end = baseline + this fraction (0.5 = +50%). */
  designSpreadPercent: number;
  /** Projection mapping is quoted separately. This is the "starting at" figure. */
  projectionStartingPrice: number;
  sizeAnchors: SizeAnchor[];
  layerTiers: LayerTier[];
  finishes: FinishOption[];
  lighting: LightingOption[];
  frameRanges: SizeTieredCost[];
  climateRanges: SizeTieredCost[];
}

/** Everything the internal calculator needs to price a single piece. */
export interface InternalInputs {
  diameterIn: number;
  layerCount: number;
  finishId: string;
  crystalBudget: number;
  lightingType: LightingType;
  hasFrame: boolean;
  frameCostOverride: number | null;
  hasClimateProtection: boolean;
  climateCostOverride: number | null;
  hasProjectionMapping: boolean;
  /** The intangible creative weight. No formula touches this. */
  designAdjustment: number;
}

export interface PriceLine {
  label: string;
  detail?: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  sizeBase: number;
  layerMultiplier: number;
  afterLayers: number;
  finishAddition: number;
  crystalAddition: number;
  lighting: number;
  frame: number;
  climate: number;
  productionBaseline: number;
  designAdjustment: number;
  total: number;
  suggestedRetail: number;
  quote: number;
  /** Starting price to surface when projection mapping is toggled, else null. */
  projectionNote: number | null;
}

/** What the customer-facing explorer collects, and the range it returns. */
export interface CustomerInputs {
  sizeCategory: 'small' | 'medium' | 'large' | 'statement';
  complexity: 'simple' | 'layered' | 'intricate';
  finishId: string;
  illumination: LightingType;
}

export interface CustomerRange {
  low: number;
  high: number;
}

/** A priced piece saved for calibration — predicted vs. what was charged. */
export interface SavedQuote {
  id: string;
  name: string;
  savedAt: string;
  inputs: InternalInputs;
  suggestedRetail: number;
  quote: number;
  /** What Adrian actually charged, for comparing the formula against reality. */
  actualPrice: number | null;
}
