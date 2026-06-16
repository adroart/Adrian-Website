/**
 * The editable pricing model.
 *
 * DEFAULT_CONFIG holds the starting values from the pricing plan. They are
 * estimates, meant to be tuned against real pieces — every one of them is
 * adjustable in the calculator's Settings tab, and changes persist to the
 * browser via localStorage. loadConfig() always merges saved values over the
 * defaults, so new fields added here appear for existing users without
 * wiping their tuning.
 */

import { PricingConfig } from './types';

export const DEFAULT_CONFIG: PricingConfig = {
  measurementUnit: 'imperial',
  marginPercent: 0.15,
  roundTo: 25,
  designSpreadPercent: 0.5,
  projectionStartingPrice: 1500,

  sizeAnchors: [
    { diameterIn: 6, price: 50 },
    { diameterIn: 8, price: 75 },
    { diameterIn: 10, price: 100 },
    { diameterIn: 12, price: 140 },
    { diameterIn: 16, price: 200 },
    { diameterIn: 20, price: 300 },
    { diameterIn: 24, price: 450 },
    { diameterIn: 30, price: 650 },
    { diameterIn: 36, price: 900 },
    { diameterIn: 42, price: 1200 },
    { diameterIn: 48, price: 1600 },
    { diameterIn: 60, price: 2200 },
  ],

  layerTiers: [
    { minLayers: 1, maxLayers: 2, multiplier: 1.0 },
    { minLayers: 3, maxLayers: 4, multiplier: 1.3 },
    { minLayers: 5, maxLayers: 6, multiplier: 1.6 },
    { minLayers: 7, maxLayers: 8, multiplier: 2.0 },
    { minLayers: 9, maxLayers: 20, multiplier: 2.5 },
  ],

  finishes: [
    { id: 'natural', label: 'Natural', percent: 0 },
    { id: 'painted', label: 'Painted', percent: 0.8 },
    { id: 'painted-crystals', label: 'Painted with Crystals', percent: 1.0, usesCrystals: true },
  ],

  lighting: [
    { id: 'none', label: 'None', tiers: [] },
    {
      id: 'simple',
      label: 'Simple LEDs',
      tiers: [
        { minSizeIn: 6, maxSizeIn: 12, min: 30, max: 50 },
        { minSizeIn: 13, maxSizeIn: 24, min: 60, max: 100 },
        { minSizeIn: 25, maxSizeIn: 36, min: 100, max: 175 },
        { minSizeIn: 37, maxSizeIn: 60, min: 150, max: 275 },
      ],
    },
    {
      id: 'custom',
      label: 'Custom programming',
      tiers: [
        { minSizeIn: 6, maxSizeIn: 12, min: 75, max: 125 },
        { minSizeIn: 13, maxSizeIn: 24, min: 150, max: 250 },
        { minSizeIn: 25, maxSizeIn: 36, min: 250, max: 400 },
        { minSizeIn: 37, maxSizeIn: 60, min: 400, max: 600 },
      ],
    },
    {
      id: 'full',
      label: 'Full programmed',
      tiers: [
        { minSizeIn: 6, maxSizeIn: 12, min: 150, max: 250 },
        { minSizeIn: 13, maxSizeIn: 24, min: 300, max: 500 },
        { minSizeIn: 25, maxSizeIn: 36, min: 500, max: 800 },
        { minSizeIn: 37, maxSizeIn: 60, min: 800, max: 1200 },
      ],
    },
  ],

  frameRanges: [
    { minSizeIn: 6, maxSizeIn: 12, min: 40, max: 80 },
    { minSizeIn: 13, maxSizeIn: 20, min: 75, max: 150 },
    { minSizeIn: 21, maxSizeIn: 30, min: 120, max: 250 },
    { minSizeIn: 31, maxSizeIn: 42, min: 200, max: 400 },
    { minSizeIn: 43, maxSizeIn: 60, min: 350, max: 700 },
  ],

  climateRanges: [
    { minSizeIn: 6, maxSizeIn: 12, min: 20, max: 40 },
    { minSizeIn: 13, maxSizeIn: 20, min: 40, max: 75 },
    { minSizeIn: 21, maxSizeIn: 30, min: 70, max: 120 },
    { minSizeIn: 31, maxSizeIn: 42, min: 100, max: 180 },
    { minSizeIn: 43, maxSizeIn: 60, min: 160, max: 280 },
  ],

  crateRanges: [
    { minSizeIn: 6, maxSizeIn: 12, min: 30, max: 60 },
    { minSizeIn: 13, maxSizeIn: 20, min: 60, max: 120 },
    { minSizeIn: 21, maxSizeIn: 30, min: 120, max: 220 },
    { minSizeIn: 31, maxSizeIn: 42, min: 220, max: 400 },
    { minSizeIn: 43, maxSizeIn: 60, min: 400, max: 700 },
  ],
};

const STORAGE_KEY = 'tots-pricing-config-v1';
const QUOTES_KEY = 'tots-pricing-quotes-v1';

/** A deep-ish clone so callers can edit freely without touching defaults. */
export function cloneDefaultConfig(): PricingConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/** Load the saved config, merged over the current defaults. Never throws. */
export function loadConfig(): PricingConfig {
  if (typeof window === 'undefined') return cloneDefaultConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultConfig();
    const saved = JSON.parse(raw);
    // Shallow-merge top level, but let saved arrays fully replace defaults
    // (they are the user's tuned tables). Scalars fall back to defaults.
    return { ...cloneDefaultConfig(), ...saved };
  } catch {
    return cloneDefaultConfig();
  }
}

export function saveConfig(config: PricingConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* storage full or blocked — tuning just won't persist this session */
  }
}

export function resetConfig(): PricingConfig {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return cloneDefaultConfig();
}

// ----- Saved quotes (calibration history) ------------------------------------

import { SavedQuote } from './types';

export function loadQuotes(): SavedQuote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUOTES_KEY);
    return raw ? (JSON.parse(raw) as SavedQuote[]) : [];
  } catch {
    return [];
  }
}

export function saveQuotes(quotes: SavedQuote[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
  } catch {
    /* ignore */
  }
}
