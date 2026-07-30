import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('navigates into and out of Stories without the global error screen', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    history.pushState({}, '', '/keystatic');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Return to Admin' })).toBeVisible();

  await page.getByRole('link', { name: 'Return to Admin' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/login)?$/);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('admin shell is keyboard reachable and has no serious accessibility violations', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/overview', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      attention: { plates: 2, draftViewings: 1, openInvoices: 1 },
    }),
  }));
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Studio overview' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
});

test('mobile admin menu fits the viewport and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/overview', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, attention: null }),
  }));
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Pricing' }).click();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test('opens Maintenance from Artwork and renders the private five-section detail accessibly', async ({ page }) => {
  await page.goto('/admin');
  if ((page.viewportSize()?.width || 0) < 768) {
    await page.getByRole('button', { name: 'Menu' }).click();
  }
  const navigation = page.getByRole('navigation', { name: 'Admin navigation' });
  await expect(navigation.getByText('Artwork', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: 'Maintenance' }).click();
  await expect(page).toHaveURL(/\/admin\/maintenance$/);
  await expect(page.getByRole('heading', { name: 'Maintenance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();

  for (const title of [
    'Current public truth',
    'Physical plate',
    'Private acquisition',
    'Current steward',
    'Maintenance history',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);

  await page.getByLabel('Title').fill('No artwork has this title');
  await page.getByRole('button', { name: 'Search Maintenance' }).click();
  await expect(page.getByRole('heading', { name: 'No matching artworks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current public truth' })).toBeHidden();
});

test('reviews, unlocks, creates, and corrects a private acquisition', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mutation flow runs once against the shared development mock.');

  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Record acquisition', exact: true }).click();
  await page.getByLabel('Amount paid').fill('125000');
  await page.getByLabel('Currency', { exact: true }).fill('IDR');
  await page.getByLabel('Private notes').fill('Private browser-flow check.');
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await expect(page.getByRole('heading', { name: 'Before' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'After' })).toBeVisible();
  await page.getByLabel('Reason for this change').fill('Record the verified acquisition.');

  const secret = page.getByLabel('Registry secret');
  if (await secret.isVisible().catch(() => false)) {
    await secret.fill('local-development-secret');
    await page.getByRole('button', { name: 'Unlock registry' }).click();
  }
  await expect(page.getByText('Private registry unlocked for saving.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.locator('.admin-alert').getByText('Acquisition recorded.')).toBeVisible();

  await page.getByRole('button', { name: 'Correct record' }).last().click();
  await page.getByLabel('Amount paid').fill('130000');
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await expect(page.getByText('125,000 smallest units · IDR', { exact: true })).toBeVisible();
  await expect(page.getByText('130,000 smallest units · IDR', { exact: true })).toBeVisible();
  await page.getByLabel('Reason for this change').fill('Correct the verified amount.');
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.locator('.admin-alert').getByText('Acquisition correction saved.')).toBeVisible();
});
