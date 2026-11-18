import { expect, test } from './fixtures';
import { buildPaymentSchedule } from '../components/invoices/invoiceUtils';

test('sales controls keep Save primary and selection visible through hover', async ({ page }, testInfo) => {
  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'controls-fixture', email: 'controls@example.test' } },
  }));
  const invoice = {
    id: 2, publicToken: 'controls-fixture', publicUrlPath: '/invoice/controls-fixture',
    invoiceNumber: 'AR-2026-002', status: 'draft', clientName: 'Fixture Buyer', clientEmail: '',
    clientLocation: '', jobTitle: 'Doorways Of The Unknown', jobDescription: '90 cm · original',
    currency: 'USD', lineItems: [{ description: 'Artwork', terms: '90 cm · original', amountCents: 300000 }],
    paymentSchedule: buildPaymentSchedule(300000, 'single'), currentStepIndex: 0,
    subtotalCents: 300000, totalCents: 300000, dueTodayCents: 300000, shippingText: 'Fixture estimate',
    paymentPresetIds: [1], paymentPresetId: 1, paymentSnapshot: {}, paymentOptions: [],
    notes: '', offerPaymentChoice: false,
  };
  await page.route('**/api/admin/invoices?*', route => route.fulfill({ json: { ok: true, invoices: [invoice] } }));
  await page.route('**/api/admin/invoices/2', route => route.fulfill({ json: { ok: true, invoice } }));
  await page.route('**/api/admin/payment-presets', route => route.fulfill({
    json: { ok: true, presets: [{
      id: 1, label: 'Fixture transfer', method: 'bank', currency: 'USD',
      instructions: 'Synthetic fixture only.', details: '', url: '', isDefault: true, isActive: true,
    }] },
  }));
  await page.goto('/admin/invoices?invoiceId=2');
  const save = page.getByRole('button', { name: 'Save', exact: true });
  const share = page.getByRole('button', { name: 'Send / copy link', exact: true });
  await expect(save).toBeVisible();
  const primary = await save.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    height: element.getBoundingClientRect().height,
    transform: getComputedStyle(element).textTransform,
  }));
  expect(primary.height).toBeGreaterThanOrEqual(44);
  expect(primary.transform).toBe('none');
  expect(primary.background).not.toBe(await share.evaluate(element => getComputedStyle(element).backgroundColor));
  await expect(page.getByRole('button', { name: 'Fixture transfer' })).toBeVisible();
  const card = page.locator('.studio-sales-payment-list > div').first();
  expect((await card.boundingBox())?.width).toBeGreaterThanOrEqual(220);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('invoice.png'), animations: 'disabled' });

  await page.route('**/api/pricing/config', route => route.fulfill({ json: { ok: true, config: null } }));
  await page.route('**/api/pricing/quotes', route => route.fulfill({ json: { ok: true, quotes: [] } }));
  await page.goto('/admin/pricing');
  const calculator = page.getByRole('button', { name: 'calculator', exact: true });
  await expect(calculator).toHaveAttribute('aria-current', 'page');
  const selectedFill = 'rgba(212, 184, 138, 0.13)';
  await expect(calculator).toHaveCSS('background-color', selectedFill);
  await calculator.hover();
  await expect(calculator).toHaveCSS('background-color', selectedFill);
  const frame = page.getByRole('button', { name: 'Frame Off', exact: false });
  await expect(frame).toBeVisible();
  const off = await frame.evaluate(element => getComputedStyle(element).backgroundColor);
  await frame.click();
  const enabled = page.getByRole('button', { name: 'Frame On', exact: false });
  await expect(enabled).toHaveCSS('background-color', selectedFill);
  expect(selectedFill).not.toBe(off);
  await enabled.hover();
  await expect(enabled).toHaveCSS('background-color', selectedFill);
  await page.getByRole('button', { name: 'settings', exact: true }).click();
  const settings = page.getByRole('button', { name: 'settings', exact: true });
  await expect(settings).toHaveAttribute('aria-current', 'page');
  await expect(settings).toHaveCSS('background-color', selectedFill);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pricing.png'), animations: 'disabled' });
});
