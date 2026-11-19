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
  await page.goto('/creations/UL-102?from=mandalacodes&card=48');
  await expect(page.getByRole('heading', { name: 'Doorways Of The Unknown - 48', exact: true })).toBeVisible();
  await page.locator('label').filter({ has: page.locator('input[value="90 cm"]') }).click();
  await expect(page.locator('input[value="90 cm"]')).toBeChecked();
  await page.getByRole('button', { name: /Continue to (options|review)/ }).click();
  await page.getByRole('link', { name: 'Request to Purchase', exact: true }).first().click();
  await expect(page).toHaveURL(/\/inquire$/);
  await expect(page.getByRole('heading', { name: 'Inquire', exact: true })).toBeVisible();
  const purchaseForm = page.locator('form').filter({ has: page.getByLabel('Name', { exact: true }) });
  await expect(purchaseForm.getByText('Doorways Of The Unknown - 48', { exact: true })).toBeVisible();
  await expect(purchaseForm.getByText(/^Size\s*90 cm$/)).toBeVisible();
  await expect(purchaseForm.getByText(/^Availability\s*Ready to ship$/)).toBeVisible();
  await expect(purchaseForm.getByText('$3,000', { exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Synthetic Collector');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('synthetic@example.test');
  await page.getByRole('textbox', { name: /Shipping destination/ }).fill('Toronto, Canada M5V');
  await page.locator('textarea[name="vision"]').fill('Synthetic request only.');
  await purchaseForm.screenshot({ path: testInfo.outputPath('synthetic-purchase-form.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: 'Send purchase request' }).first().click();
  await expect(page.getByText('Synthetic studio delivery unavailable.')).toBeVisible();
  const fallback = await page.locator('a[href^="mailto:hello@adrianrasmussen.com?subject="]').getAttribute('href');
  expect(new URL(fallback!).searchParams.get('body')).toContain('Source: Mandala Codes · Card 48');
  await expect(page.getByRole('heading', { name: 'Purchase request received.' })).toHaveCount(0);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Collector');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('synthetic@example.test');
  await expect(page.getByRole('textbox', { name: /Shipping destination/ })).toHaveValue('Toronto, Canada M5V');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    name: 'Synthetic Collector', email: 'synthetic@example.test',
    inquiryType: 'purchase', pieceId: 'UL-102', location: 'Toronto, Canada M5V', pieceTitle: 'Doorways Of The Unknown - 48',
    purchaseSize: '90 cm', purchaseAvailability: 'Ready to ship',
    source: 'mandalacodes', cardNumber: 48,
    purchaseAddOns: [], vision: 'Synthetic request only.',
  });
  expect(String(bodies[0].purchasePrice).replace(/[^0-9.]/g, '')).toMatch(/^3000(?:\.00)?$/);
  await page.getByRole('button', { name: 'Send purchase request' }).first().click();
  await expect(page.getByRole('heading', { name: 'Purchase request received.' })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  await expect(page.getByRole('button', { name: /claim|bind|checkout/i })).toHaveCount(0);
  await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('synthetic-purchase-request.png'), fullPage: true });
});

test('commissioning a similar piece keeps its catalog ID and drops a mismatched card', async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await page.route('**/api/inquire', async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/creations/doorways-of-the-unknown-48?from=mandalacodes&card=49');
  await page.getByRole('button', { name: /Continue to (options|review)/ }).click();
  await page.getByRole('link', { name: 'Or commission a similar piece' }).click();
  await expect(page).toHaveURL(/\/inquire$/);
  await expect(page.locator('textarea[name="vision"]')).toHaveValue('I\'m interested in a piece similar to "Doorways Of The Unknown - 48".');
  await page.getByLabel('Name', { exact: true }).fill('Synthetic Collector');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('synthetic@example.test');
  await page.locator('form').getByRole('button', { name: 'Start the conversation', exact: true }).first().click();
  await expect.poll(() => body?.pieceId).toBe('UL-102');
  expect(body).toMatchObject({ pieceTitle: 'Doorways Of The Unknown - 48', commissionType: 'personal' });
  expect(body).not.toHaveProperty('source');
  expect(body).not.toHaveProperty('cardNumber');
});
