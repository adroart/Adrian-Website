import { expect, test } from './fixtures';

test('finds an exact registered edition from the populated Artworks screen', async ({ page }) => {
  const seventh = {
    id: 'piece-edition-7', artworkId: 'UL-101', title: 'Crystal Creation - 36',
    editionNumber: 7, publicCode: 'AR-7KQ8M2WX', plateStatus: 'active',
  };
  const eighth = {
    ...seventh, id: 'piece-edition-8', editionNumber: 8,
    publicCode: 'AR-8KQ8M2WX', plateStatus: 'legacy',
  };
  const requests: Record<string, string>[] = [];
  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'studio-fixture', email: 'artist@example.test' } },
  }));
  await page.route('**/api/admin/maintenance*', route => {
    const filters = Object.fromEntries(new URL(route.request().url()).searchParams);
    requests.push(filters);
    return route.fulfill({ json: { ok: true, pieces: filters.publicCode ? [seventh] : [seventh, eighth] } });
  });
  await page.route('**/api/admin/artwork-workspace?*', route => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('keeperPieceId')).toBe(seventh.id);
    return route.fulfill({ json: { ok: true, workspace: {
      catalog: { artworkId: seventh.artworkId, title: seventh.title },
      edition: { kind: 'numbered', number: 7 }, selectionScope: 'exact_record', legacySaleVerificationPath: null,
      identity: { keeperPieceId: seventh.id, publicCode: seventh.publicCode, state: 'registered' },
      certificate: { state: 'complete', missingFields: [] },
      caretaker: { state: 'unclaimed' },
      salesRecord: null, invitation: null, plate: null, sale: null, nextAction: null, activity: [],
    } } });
  });

  await page.goto('/admin/artworks');
  await expect(page.getByRole('link', { name: 'Register artwork' })).toHaveAttribute('href', '/admin/register');
  await expect(page.getByRole('link', { name: 'Artwork tools' })).toHaveAttribute('href', '/admin/tools');
  const form = page.getByRole('search', { name: 'Find artwork' });
  const rows = page.getByRole('link', { name: /^Open record for Crystal Creation/ });
  await expect(rows).toHaveCount(2);
  await page.screenshot({ path: `/tmp/studio-artworks-list-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' });
  await expect(page.getByText('Open record', { exact: true })).toHaveCount(2);
  await expect(form.getByLabel('Title', { exact: true })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Clear' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  await form.getByLabel('Artwork ID').fill('UL-101');
  await form.getByLabel('Public code').fill('AR-7KQ8M2WX');
  await form.getByLabel('Edition number').fill('7');
  await form.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
  await expect(rows).toHaveCount(1);
  const result = page.getByRole('link', { name: /UL-101, Edition 7, AR-7KQ8M2WX/ });
  await expect(result).toHaveAttribute('href', '/admin/artworks/UL-101?instance=piece-edition-7');
  expect(requests).toEqual([{}, { artworkId: 'UL-101', publicCode: 'AR-7KQ8M2WX', editionNumber: '7' }]);

  await result.click();
  await expect(page).toHaveURL('/admin/artworks/UL-101?instance=piece-edition-7');
  await expect(page.getByRole('heading', { name: seventh.title })).toBeVisible();
  await expect(page.getByText('Edition 7 · UL-101 · AR-7KQ8M2WX', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: `/tmp/studio-artwork-workspace-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.goBack();
  await expect(form.getByLabel('Public code')).toHaveValue('AR-7KQ8M2WX');
  await expect(form.getByLabel('Artwork ID')).toHaveValue('UL-101');
  await expect(form.getByLabel('Edition number')).toHaveValue('7');
  await expect(rows).toHaveCount(1);

  await result.click();
  await page.getByRole('link', { name: 'Back to Artworks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
  await expect(form.getByLabel('Public code')).toHaveValue('AR-7KQ8M2WX');
  await expect(rows).toHaveCount(1);

  await form.getByRole('button', { name: 'Clear' }).click();
  await expect(rows).toHaveCount(2);
  await expect(form.getByLabel('Public code')).toHaveValue('');
  await expect(form.getByLabel('Title', { exact: true })).toBeFocused();
  await result.click();
  await expect(page).toHaveURL('/admin/artworks/UL-101?instance=piece-edition-7');
});
