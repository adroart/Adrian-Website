import { test, expect } from './fixtures';

test('one configurator carries reviewed choices to an inquiry without shipping promises', async ({ page }, testInfo) => {
  await page.route('**/api/**', r => r.fulfill({ json: null }));
  await page.goto('/creations/art-of-living-32');
  const wizard = page.getByTestId('piece-configurator');
  await expect(wizard).toBeVisible();
  await expect(wizard).toHaveCount(1);
  await wizard.locator('label').filter({ has: page.locator('input[value="58 cm"]') }).click();
  await wizard.getByRole('button', { name: /Continue to (options|review)/ }).click();
  const review = wizard.getByTestId('configuration-review');
  await expect(review).toBeInViewport();
  await wizard.locator('label').filter({ hasText: 'Add crystals' }).click();
  await expect(wizard.getByLabel('Add crystals')).toBeChecked();
  await expect(wizard.getByText('$1,141', { exact: true })).toBeVisible();
  await expect(wizard).not.toContainText(/48 hours|1 to 3 weeks|2 to 3 weeks/);
  await expect(wizard.getByRole('button', { name: /Add to Cart/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /checkout/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('configurator-review.png'), animations: 'disabled' });
  await wizard.getByRole('link', { name: 'Request to Purchase', exact: true }).click();
  await expect(page.locator('form').getByText(/^Size\s*58 cm$/)).toBeVisible();
  await expect(page.locator('form').getByText('$1,141', { exact: true })).toBeVisible();
  await expect(page.locator('main form')).toContainText('Crystals (+$30)');
});
