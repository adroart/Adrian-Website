/**
 * Lightweight currency display for the customer Pricing Explorer.
 *
 * Rates are static, approximate, and clearly labeled as such in the UI — this
 * is to orient an international visitor, not to quote a binding price (the
 * final figure is always settled in conversation). No network, no dependency.
 * Adjust the rates here when they drift.
 */

export interface Currency {
  code: string;
  symbol: string;
  /** Units of this currency per 1 USD. */
  rate: number;
  locale: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', rate: 1, locale: 'en-US' },
  { code: 'EUR', symbol: '€', rate: 0.92, locale: 'de-DE' },
  { code: 'GBP', symbol: '£', rate: 0.79, locale: 'en-GB' },
  { code: 'AUD', symbol: 'A$', rate: 1.52, locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', rate: 1.36, locale: 'en-CA' },
];

export function currencyFor(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Convert a USD amount and round to a clean figure for a range estimate. */
export function convertFromUsd(usd: number, code: string): number {
  const converted = usd * currencyFor(code).rate;
  // Round to a tidy step that scales with magnitude.
  const step = converted >= 1000 ? 50 : 10;
  return Math.round(converted / step) * step;
}

/** Format a USD amount in the chosen currency, whole units, no decimals. */
export function formatInCurrency(usd: number, code: string): string {
  const c = currencyFor(code);
  const value = convertFromUsd(usd, code);
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency',
      currency: c.code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${c.symbol}${value.toLocaleString('en-US')}`;
  }
}
