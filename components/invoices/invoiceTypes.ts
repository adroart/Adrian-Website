export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
export type PaymentMethod = 'wise' | 'crypto' | 'bank' | 'payment_link' | 'paypal' | 'custom';
export type PaymentTermMode = 'single' | 'two_part' | 'three_part';

export interface PaymentPreset {
  id: number;
  label: string;
  method: PaymentMethod;
  currency: string;
  instructions: string;
  details: string;
  url: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** A selectable option on a line item (e.g. a size), priced per choice. */
export interface InvoiceLineItemVariant {
  label: string;        // e.g. "58 cm"
  amountCents: number;  // the price if this variant is chosen
}

export interface InvoiceLineItem {
  description: string;
  terms: string;
  amountCents: number;
  /**
   * Optional buyer-selectable options (sizes). When present, the public invoice
   * shows a selector and the chosen variant's price drives the live total. The
   * stored amountCents is the default (first variant) for variant-less rendering
   * and for any consumer that ignores variants.
   */
  variants?: InvoiceLineItemVariant[];
}

export interface InvoiceScheduleItem {
  label: string;
  description: string;
  amountCents: number;
  dueTiming: string;
}

export interface InvoicePaymentOption {
  id?: number | null;
  label: string;
  method: PaymentMethod | string;
  currency: string;
  instructions: string;
  details: string;
  url: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  publicToken: string;
  publicUrlPath: string;
  status: InvoiceStatus;
  clientName: string;
  clientEmail: string;
  clientLocation: string;
  jobTitle: string;
  jobDescription: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  paymentSchedule: InvoiceScheduleItem[];
  currentStepIndex: number;
  subtotalCents: number;
  shippingText: string;
  totalCents: number;
  dueTodayCents: number;
  paymentPresetId: number | null;
  paymentPresetIds: number[];
  paymentSnapshot: InvoicePaymentOption | Record<string, never>;
  paymentOptions: InvoicePaymentOption[];
  notes: string;
  /**
   * When true, the buyer chooses on the public invoice between paying in full
   * or in 2 payments; the schedule recomputes live from the chosen size + plan.
   */
  offerPaymentChoice?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  sentAt?: string | null;
  paidAt?: string | null;
}

export interface InvoiceDraft {
  status: InvoiceStatus;
  clientName: string;
  clientEmail: string;
  clientLocation: string;
  jobTitle: string;
  jobDescription: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  paymentSchedule: InvoiceScheduleItem[];
  currentStepIndex: number;
  shippingText: string;
  paymentPresetIds: number[];
  notes: string;
  offerPaymentChoice?: boolean;
}
