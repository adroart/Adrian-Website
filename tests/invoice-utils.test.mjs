import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateInvoiceNumber,
  normalizeInvoiceInput,
  normalizePaymentPresetInput,
  serializeInvoiceRow,
} from '../functions/api/_lib/invoices.js';

describe('invoice backend utilities', () => {
  it('normalizes reusable payment presets with safe public fields', () => {
    const preset = normalizePaymentPresetInput({
      label: ' Wise USD ',
      method: 'wise',
      currency: ' usd ',
      instructions: ' Pay through Wise. ',
      details: ' Include invoice number. ',
      url: ' https://wise.com/pay/example ',
      isDefault: true,
      isActive: true,
    });

    assert.deepEqual(preset, {
      label: 'Wise USD',
      method: 'wise',
      currency: 'USD',
      instructions: 'Pay through Wise.',
      details: 'Include invoice number.',
      url: 'https://wise.com/pay/example',
      isDefault: true,
      isActive: true,
    });
  });

  it('accepts crypto as a reusable payment method', () => {
    const preset = normalizePaymentPresetInput({
      label: 'Crypto',
      method: 'crypto',
      currency: 'USD',
      instructions: 'Pay with USDC or BTC.',
      details: 'Wallet details go here.',
      url: '',
    });

    assert.equal(preset.method, 'crypto');
  });

  it('builds invoice totals, due today, current step, and selectable payment options', () => {
    const invoice = normalizeInvoiceInput(
      {
        clientName: 'Collector Name',
        clientEmail: 'collector@example.com',
        clientLocation: 'Melbourne, Australia',
        invoiceNumber: 'AR-2026-014',
        jobTitle: 'Commissioned wooden sculpture',
        jobDescription: 'Design, production, finishing, packing, and shipment coordination.',
        currency: 'aud',
        lineItems: [
          { description: 'Design deposit', terms: 'Up front', amountCents: 150000 },
          { description: 'Design approved, ready to cut', terms: 'Milestone 2', amountCents: 200000 },
          { description: 'Finished, ready to ship', terms: 'Final', amountCents: 150000 },
        ],
        paymentSchedule: [
          { label: 'Design deposit', description: 'Due before design development begins', amountCents: 150000 },
          { label: 'Ready to cut', description: 'Due when design is approved', amountCents: 200000 },
          { label: 'Ready to ship', description: 'Due before release to carrier', amountCents: 150000 },
        ],
        currentStepIndex: 1,
        shippingText: 'To be confirmed',
        paymentPresetIds: [7, 8],
      },
      [
        {
          id: 7,
          label: 'Wise AUD',
          method: 'wise',
          currency: 'AUD',
          instructions: 'Pay through Wise.',
          details: 'Include invoice number.',
          url: 'https://wise.com/pay/example',
        },
        {
          id: 8,
          label: 'Bank transfer',
          method: 'bank',
          currency: 'AUD',
          instructions: 'Transfer to the account below.',
          details: 'BSB 000-000\nAccount 000000',
          url: '',
        },
      ],
    );

    assert.equal(invoice.currency, 'AUD');
    assert.equal(invoice.subtotalCents, 500000);
    assert.equal(invoice.totalCents, 500000);
    assert.equal(invoice.dueTodayCents, 200000);
    assert.equal(invoice.currentStep.label, 'Ready to cut');
    assert.equal(invoice.paymentPresetId, 7);
    assert.deepEqual(invoice.paymentPresetIds, [7, 8]);
    assert.equal(invoice.paymentSnapshot.label, 'Wise AUD');
    assert.equal(invoice.paymentOptions.length, 2);
    assert.equal(invoice.paymentOptions[1].label, 'Bank transfer');
    assert.equal(invoice.publicToken.length, 32);
  });

  it('generates the next invoice number for the same year', () => {
    assert.equal(generateInvoiceNumber('AR-2026-014', new Date('2026-06-05T00:00:00Z')), 'AR-2026-015');
    assert.equal(generateInvoiceNumber('AR-2025-099', new Date('2026-06-05T00:00:00Z')), 'AR-2026-001');
  });

  it('serializes invoice rows for public and admin responses', () => {
    const serialized = serializeInvoiceRow({
      id: 4,
      invoice_number: 'AR-2026-014',
      public_token: 'abc123',
      status: 'sent',
      client_name: 'Collector Name',
      client_email: 'collector@example.com',
      client_location: 'Melbourne, Australia',
      job_title: 'Commissioned wooden sculpture',
      job_description: 'Design, production, finishing, packing, and shipment coordination.',
      currency: 'AUD',
      subtotal_cents: 500000,
      shipping_text: 'To be confirmed',
      total_cents: 500000,
      due_today_cents: 150000,
      current_step_index: 0,
      payment_preset_id: 7,
      payment_preset_ids_json: JSON.stringify([7, 8]),
      payment_snapshot_json: JSON.stringify({ label: 'Wise AUD', method: 'wise' }),
      payment_options_json: JSON.stringify([
        { label: 'Wise AUD', method: 'wise' },
        { label: 'Bank transfer', method: 'bank' },
      ]),
      line_items_json: JSON.stringify([{ description: 'Design deposit', amountCents: 150000 }]),
      payment_schedule_json: JSON.stringify([{ label: 'Design deposit', amountCents: 150000 }]),
      notes: '',
      created_at: 1780639000,
      updated_at: 1780639600,
      sent_at: 1780639700,
      paid_at: null,
    });

    assert.equal(serialized.invoiceNumber, 'AR-2026-014');
    assert.equal(serialized.publicUrlPath, '/invoice/abc123');
    assert.equal(serialized.paymentSchedule[0].label, 'Design deposit');
    assert.equal(serialized.paymentOptions.length, 2);
    assert.equal(serialized.createdAt, '2026-06-05T05:56:40.000Z');
  });
});
