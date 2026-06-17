/**
 * Server-side helpers for the pricing model. Validation is intentionally
 * light: the only writer is the authenticated admin, so this guards against
 * malformed payloads and obvious shape errors, not adversarial input.
 */

/** Top-level array fields a complete PricingConfig is expected to carry. */
const CONFIG_ARRAY_FIELDS = [
  'sizeAnchors',
  'layerTiers',
  'finishes',
  'lighting',
  'frameRanges',
  'climateRanges',
];

/**
 * Returns an error string if the config is not a plausible model, else null.
 * We don't enforce every nested shape — the client owns the schema — but we
 * reject anything that clearly isn't a config object.
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return 'config must be an object';
  }
  for (const field of CONFIG_ARRAY_FIELDS) {
    if (!Array.isArray(config[field])) {
      return `config.${field} must be an array`;
    }
  }
  if (typeof config.marginPercent !== 'number' || config.marginPercent < 0) {
    return 'config.marginPercent must be a non-negative number';
  }
  return null;
}

export function serializeQuoteRow(row) {
  return {
    id: String(row.id),
    name: row.name,
    savedAt: new Date((row.created_at || 0) * 1000).toISOString(),
    inputs: safeParse(row.inputs_json, {}),
    suggestedRetail: Number(row.suggested_retail) || 0,
    quote: Number(row.quote) || 0,
    actualPrice: row.actual_price == null ? null : Number(row.actual_price),
  };
}

/** Coerce an inbound quote payload into the columns we store. */
export function normalizeQuoteInput(body) {
  return {
    name: typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '',
    inputs: body.inputs && typeof body.inputs === 'object' ? body.inputs : {},
    suggestedRetail: toMoney(body.suggestedRetail),
    quote: toMoney(body.quote),
    actualPrice: body.actualPrice == null ? null : toMoney(body.actualPrice),
  };
}

export function validateQuote(quote) {
  if (!quote.name) return 'name is required';
  return null;
}

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function safeParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
