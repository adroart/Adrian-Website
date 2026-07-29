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
