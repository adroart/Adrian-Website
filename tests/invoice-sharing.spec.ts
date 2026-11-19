import { expect, test } from './fixtures';
import type { Invoice } from '../components/invoices/invoiceTypes';
import { buildPaymentSchedule } from '../components/invoices/invoiceUtils';

function fixture(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1, publicToken: 'fixture-invoice-token', publicUrlPath: '/invoice/fixture-invoice-token',
    invoiceNumber: 'AR-2026-001', status: 'draft',
    clientName: 'Example collector', clientEmail: 'collector@example.test', clientLocation: '',
    jobTitle: 'Example original', jobDescription: 'One work', currency: 'USD',
    lineItems: [{ description: 'Example original', terms: '', amountCents: 10000 }],
    paymentSchedule: buildPaymentSchedule(10000, 'two_part'), currentStepIndex: 0,
    subtotalCents: 10000, totalCents: 10000, dueTodayCents: 5000,
    shippingText: 'Shipping to be confirmed', paymentPresetIds: [1], paymentPresetId: 1,
    paymentSnapshot: {}, paymentOptions: [], notes: '', offerPaymentChoice: false,
    ...overrides,
  };
}

test('only shares saved edits and keeps draft preview behind studio authentication', async ({ page, context }) => {
  let saved = fixture();
  let rejectSave = true;
  let sends = 0;
  let adminPreviews = 0;
  let adminPreviewAllowed = true;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('**/api/admin/payment-presets', route => route.fulfill({
    json: { ok: true, presets: [{ id: 1, label: 'Bank', method: 'bank', currency: 'USD',
      instructions: 'Existing studio payment method', details: '', url: '', isDefault: true, isActive: true }] },
  }));
  await page.route('**/api/admin/invoices?*', route => route.fulfill({ json: { ok: true, invoices: [saved] } }));
  await context.route('**/api/admin/invoices/1', async route => {
    if (route.request().method() === 'PUT') {
      if (rejectSave) return route.fulfill({ status: 503, json: { ok: false, error: 'unavailable' } });
      saved = { ...saved, ...route.request().postDataJSON() };
    } else {
      adminPreviews++;
      if (!adminPreviewAllowed) return route.fulfill({ status: 401, json: { ok: false, error: 'unauthorized' } });
    }
    return route.fulfill({ json: { ok: true, invoice: saved } });
  });
  await page.route('**/api/admin/invoices/1/send', route => {
    sends++;
    saved = { ...saved, status: 'sent', sentAt: '2026-11-17T00:00:00.000Z' };
    return route.fulfill({ json: { ok: true, invoice: saved, publicUrlPath: saved.publicUrlPath } });
  });
  await page.route('**/api/invoices/fixture-invoice-token', route => route.fulfill({
    status: saved.status === 'draft' ? 404 : 200,
    json: saved.status === 'draft' ? { ok: false, error: 'not_found' } : { ok: true, invoice: saved },
  }));

  await page.goto('/admin/invoices?invoiceId=1');
  const send = page.getByRole('button', { name: 'Send / copy link' });
  const shipping = page.getByRole('textbox', { name: 'Shipping text' });
  await expect(shipping).toHaveValue(saved.shippingText);
  await expect(send).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: `/tmp/studio-invoice-editor-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' });
  const [preview] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'Preview saved invoice' }).click(),
  ]);
  await expect(preview.getByText('Shipping to be confirmed')).toBeVisible();
  expect(adminPreviews).toBe(1);
  adminPreviewAllowed = false;
  await preview.reload();
  await expect(preview.getByRole('heading', { name: 'Invoice not available' })).toBeVisible();
  await preview.close();
  await shipping.fill('Packing and delivery agreed');
  await expect(send).toBeDisabled();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await expect(send).toBeDisabled();
  expect(sends).toBe(0);
  rejectSave = false;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(send).toBeEnabled();
  await send.click();
  await expect.poll(() => sends).toBe(1);
  await page.goto('/invoice/fixture-invoice-token');
  await expect(page.getByText('Packing and delivery agreed')).toBeVisible();
});

test('keeps a partial invoice balance fixed and preserves the stored remaining milestone timing', async ({ page }) => {
  const saved = fixture({
    status: 'sent', amountPaidCents: 6000, offerPaymentChoice: true, totalCents: 12000,
    paymentSchedule: buildPaymentSchedule(12000, 'two_part'), dueTodayCents: 6000,
    lineItems: [{ description: 'Example original', terms: '', amountCents: 10000,
      variants: [{ label: 'Small', amountCents: 10000 }, { label: 'Large', amountCents: 12000 }] }],
  });
  await page.route('**/api/invoices/fixture-invoice-token', route => route.fulfill({ json: { ok: true, invoice: saved } }));
  await page.goto('/invoice/fixture-invoice-token');
  await expect(page.getByText('Step 2 · Before shipping', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print / save PDF' })).toHaveCSS('color', 'rgb(38, 35, 33)');
  await expect(page.getByText('Due today', { exact: true }).locator('..')).toContainText('$0');
  await expect(page.getByText('Balance due', { exact: true }).locator('..')).toContainText('$60');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.screenshot({ path: `/tmp/studio-invoice-balance-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  saved.currentStepIndex = 1;
  await page.reload();
  await expect(page.getByText('Due today', { exact: true }).locator('..')).toContainText('$60');
});

test('reviews saved terms in Pricing and reopens the fixed invoice without exposing the conversation', async ({ page, context }) => {
  const privateConversation = 'https://example.test/thread?private=same-conversation';
  const savedQuote = {
    id: '8', name: 'Existing sculpture', quote: 120, suggestedRetail: 155, actualPrice: null,
    artworkId: 'UL-102', configuration: '90 cm · 12 layers', savedAt: '2026-11-16T00:00:00Z',
    inputs: { diameterIn: 35.43, layerCount: 12 },
  };
  let agreement: Record<string, unknown> | undefined;
  const accepted = fixture({
    offerPaymentChoice: false, totalCents: 12000, subtotalCents: 12000, dueTodayCents: 6000,
    jobTitle: 'Existing sculpture', jobDescription: '90 cm · edition 2 of 8',
    lineItems: [{ description: 'Existing sculpture', terms: '90 cm · edition 2 of 8', amountCents: 12000 }],
    paymentSchedule: buildPaymentSchedule(12000, 'two_part'),
    sourceQuote: {
      id: 8, name: savedQuote.name, referenceName: savedQuote.name, artworkId: 'UL-102',
      configuration: '90 cm · edition 2 of 8', amountCents: 12000, currency: 'USD', termMode: 'two_part',
      conversation: '', conversationUrl: privateConversation, acceptedAt: '2026-11-17T00:00:00Z',
    },
  });

  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('**/api/pricing/config', route => route.fulfill({ json: { ok: true, config: null } }));
  await page.route('**/api/pricing/quotes', route => route.fulfill({
    json: { ok: true, quotes: [{ ...savedQuote, ...(agreement ? { invoiceId: 1 } : {}) }] },
  }));
  await page.route('**/api/pricing/quotes/8/accept', route => {
    agreement = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ok: true, invoiceId: 1 } });
  });
  await page.route('**/api/admin/payment-presets', route => route.fulfill({ json: { ok: true, presets: [] } }));
  await page.route('**/api/admin/invoices?*', route => route.fulfill({ json: { ok: true, invoices: [accepted] } }));
  await context.route('**/api/admin/invoices/1', route => route.fulfill({ json: { ok: true, invoice: accepted } }));

  await page.goto('/admin/pricing');
  await page.getByRole('button', { name: /^Reference/ }).click();
  await page.getByRole('button', { name: 'Review for invoice' }).click();
  await expect(page.getByLabel('Agreed artwork price (USD)')).toHaveValue('120');
  await page.getByLabel('Buyer name').fill('Example collector');
  await page.getByLabel('Agreed size, edition and configuration').fill('90 cm · edition 2 of 8');
  await page.getByLabel('Agreed payment plan').selectOption('two_part');
  await page.getByLabel('Original conversation (private)').fill(privateConversation);
  await page.getByRole('button', { name: 'Confirm agreement and create draft' }).click();

  await expect(page).toHaveURL(/\/admin\/invoices\?invoiceId=1$/);
  expect(agreement).toMatchObject({ amountCents: 12000, termMode: 'two_part', conversation: privateConversation });
  await expect(page.getByRole('heading', { name: 'Accepted quote' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in original channel' })).toHaveAttribute('href', privateConversation);
  await expect(page.getByRole('textbox', { name: 'Job title' })).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: 'Agreed shipping amount (USD)' })).toBeEnabled();
  const [preview] = await Promise.all([
    page.waitForEvent('popup'), page.getByRole('link', { name: 'Preview saved invoice' }).click(),
  ]);
  await expect(preview.getByRole('heading', { name: 'Existing sculpture' })).toBeVisible();
  expect(await preview.locator('body').innerHTML()).not.toContain(privateConversation);
  await preview.close();
  await page.getByRole('link', { name: 'Open source quote' }).click();
  await expect(page).toHaveURL(/\/admin\/pricing\?quoteId=8$/);
  await expect(page.getByRole('link', { name: 'Open exact invoice' })).toHaveAttribute('href', '/admin/invoices?invoiceId=1');
});
