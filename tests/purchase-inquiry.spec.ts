import { test, expect } from './fixtures';

test('selected artwork and size survive purchase inquiry failure and retry without implying ownership', async ({ page }, testInfo) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/inquire', async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: bodies.length === 1 ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(bodies.length === 1 ? { error: 'Synthetic studio delivery unavailable.' } : { ok: true }),
    });
  });
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.goto('/creations/UL-100');
  await expect(page.getByRole('heading', { name: 'Art of Living - 32', exact: true })).toBeVisible();
  await page.locator('label').filter({ has: page.locator('input[value="58 cm"]') }).click();
  await page.getByRole('button', { name: /Continue to (options|review)/ }).click();
  await page.getByRole('link', { name: 'Request to Purchase', exact: true }).first().click();
  await expect(page).toHaveURL(/\/inquire$/);
  await expect(page.getByText('58 cm', { exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Synthetic Collector');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('synthetic@example.test');
  await page.locator('textarea[name="vision"]').fill('Synthetic request only.');
  await page.getByRole('button', { name: 'Send purchase request' }).first().click();
  await expect(page.getByText('Synthetic studio delivery unavailable.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Purchase request received.' })).toHaveCount(0);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Collector');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('synthetic@example.test');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    name: 'Synthetic Collector', email: 'synthetic@example.test',
    inquiryType: 'purchase', pieceTitle: 'Art of Living - 32',
    purchaseSize: '58 cm', purchaseAvailability: 'Made to order',
    purchaseAddOns: [], vision: 'Synthetic request only.',
  });
  expect(String(bodies[0].purchasePrice).replace(/[^0-9.]/g, '')).toMatch(/^1111(?:\.00)?$/);
  await page.getByRole('button', { name: 'Send purchase request' }).first().click();
  await expect(page.getByRole('heading', { name: 'Purchase request received.' })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  await expect(page.getByRole('button', { name: /claim|bind|checkout/i })).toHaveCount(0);
  await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('synthetic-purchase-request.png'), fullPage: true });
});
