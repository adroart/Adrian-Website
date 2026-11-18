import { expect, test } from './fixtures';

test('unlocks the registry in Review sale and preserves the confirmation when access expires', async ({ page }) => {
  let unlocked = false;
  let rejectedConfirmation = false;
  const confirmations: unknown[] = [];
  const endpoint = '**/api/admin/collector-sales/invoices/1';
  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('**/api/admin/registry-unlock', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, unlocked } });
    unlocked = route.request().postDataJSON().secret === 'fixture-secret';
    return route.fulfill({ status: unlocked ? 200 : 401, json: { ok: unlocked } });
  });
  await page.route(endpoint, route => {
    const confirmation = route.request().method() === 'POST';
    if (confirmation && !rejectedConfirmation) {
      rejectedConfirmation = true;
      unlocked = false;
    }
    if (!unlocked) return route.fulfill({ status: 403, json: { ok: false, error: 'registry_locked' } });
    if (confirmation) {
      confirmations.push(route.request().postDataJSON());
      return route.fulfill({ json: {
        ok: true, result: { saleId: 'sale-1', artworkRecordId: 'record-1', keeperPieceId: 'piece-1' },
      } });
    }
    return route.fulfill({ json: {
      ok: true, linkedSale: null, invoiceChangedSinceLink: false,
      invoice: {
        number: 'AR-2026-001', title: 'Crystal Creation', description: '58 cm · edition 7',
        buyerName: 'Synthetic collector', buyerEmail: 'buyer@example.test',
        currency: 'USD', totalCents: 143000, paidDate: '2026-11-17', revision: 'a'.repeat(64),
        shipping: '', lineItems: [],
      },
    } });
  });

  await page.goto('/admin/collector-sales/invoices/1');
  const secret = page.getByLabel('Registry secret');
  const unlock = page.getByRole('button', { name: 'Unlock registry' });
  const confirm = page.getByRole('button', { name: 'Confirm and link sale' });
  await expect(confirm).toHaveCount(0);
  await expect(secret).toBeFocused();
  await secret.fill('wrong');
  await unlock.click();
  await expect(page.getByRole('alert')).toContainText('Check the registry secret');
  await secret.fill('fixture-secret');
  await unlock.click();
  await expect(secret).toHaveCount(0);
  const artwork = page.getByRole('combobox', { name: 'Artwork', exact: true });
  await artwork.selectOption('UL-101');
  await page.getByLabel('Edition type').selectOption('numbered');
  await page.getByLabel('Edition number').fill('7');
  await page.getByLabel('Artwork price, excluding shipping (optional)').fill('1250');
  await page.getByLabel('This invoice covers one artwork.').check();
  await confirm.click();

  await expect(secret).toBeFocused();
  await expect(confirm).toBeDisabled();
  expect(confirmations).toHaveLength(0);
  await secret.fill('fixture-secret');
  await unlock.click();
  await expect(artwork).toHaveValue('UL-101');
  await expect(page.getByLabel('Edition number')).toHaveValue('7');
  await expect(page.getByLabel('Artwork price, excluding shipping (optional)')).toHaveValue('1250');
  await expect(page.getByLabel('This invoice covers one artwork.')).toBeChecked();
  await confirm.click();
  await expect(page.getByRole('link', { name: 'Open verified sale' })).toHaveAttribute('href', '/admin/collector-sales?saleId=sale-1');
  expect(confirmations).toEqual([{
    revision: 'a'.repeat(64), artworkId: 'UL-101', edition: { kind: 'numbered', number: 7 },
    saleDate: '2026-11-17', artworkPriceCents: 125000, singleArtwork: true,
  }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
