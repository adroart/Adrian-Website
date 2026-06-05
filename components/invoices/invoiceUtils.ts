import type { InvoiceLineItem, InvoiceScheduleItem, PaymentTermMode } from './invoiceTypes';

const DEFAULT_CURRENCY = 'USD';

export const PAYMENT_TERM_LABELS: Record<PaymentTermMode, string> = {
  single: 'One payment',
  two_part: 'Half now, half before shipping',
  three_part: 'Design, ready to cut, ready to ship',
};

export function parseMoneyToCents(value: string | number): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return 0;
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

export function centsToInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function formatMoney(cents: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(Math.max(0, cents) / 100);
}

export function lineItemsTotal(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + Math.max(0, Math.round(item.amountCents || 0)), 0);
}

export function splitAmount(totalCents: number, parts: number): number[] {
  const total = Math.max(0, Math.round(totalCents));
  const safeParts = Math.max(1, Math.round(parts));
  const base = Math.floor(total / safeParts);
  const result = Array.from({ length: safeParts }, () => base);
  result[result.length - 1] += total - base * safeParts;
  return result;
}

export function buildPaymentSchedule(totalCents: number, mode: PaymentTermMode): InvoiceScheduleItem[] {
  if (mode === 'single') {
    return [
      {
        label: 'Full payment',
        description: 'Due to begin the work.',
        dueTiming: 'Due today',
        amountCents: totalCents,
      },
    ];
  }

  if (mode === 'two_part') {
    const [deposit, final] = splitAmount(totalCents, 2);
    return [
      {
        label: 'Deposit',
        description: 'Due up front to begin the commission.',
        dueTiming: 'Due today',
        amountCents: deposit,
      },
      {
        label: 'Completion payment',
        description: 'Due when the work is finished, before shipping.',
        dueTiming: 'Before shipping',
        amountCents: final,
      },
    ];
  }

  const [design, cut, ship] = splitAmount(totalCents, 3);
  return [
    {
      label: 'Design deposit',
      description: 'Due up front before design development begins.',
      dueTiming: 'Due today',
      amountCents: design,
    },
    {
      label: 'Ready to cut',
      description: 'Due when the design is approved and ready to cut.',
      dueTiming: 'Before cutting',
      amountCents: cut,
    },
    {
      label: 'Ready to ship',
      description: 'Due when the work is complete, before shipping.',
      dueTiming: 'Before shipping',
      amountCents: ship,
    },
  ];
}

export function inferPaymentTermMode(schedule: InvoiceScheduleItem[]): PaymentTermMode {
  if (schedule.length >= 3) return 'three_part';
  if (schedule.length === 2) return 'two_part';
  return 'single';
}

export function publicInvoiceUrl(path: string): string {
  if (!path) return '';
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

export function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    wise: 'Wise',
    crypto: 'Crypto',
    bank: 'Bank transfer',
    payment_link: 'Payment link',
    paypal: 'PayPal',
    custom: 'Custom',
  };
  return labels[method] || 'Payment';
}
