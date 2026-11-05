import { test, expect } from './fixtures';
import { onRequest } from '../functions/qr/[number].js';

const PUBLIC_CODE = 'AR-7KQ9M2WX';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200, contentType: 'application/json', body: 'null',
  }));
});

test('gallery links reach an actual catalog piece', async ({ page }) => {
  await page.goto('/creations/multidimensional-art/universal-language');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Universal Language');
  const piece = page.locator('a[href="/creations/art-of-living-32"]').first();
  await expect(piece).toBeVisible();
  await piece.click();
  await expect(page).toHaveURL('/creations/art-of-living-32');
  await expect(page.getByRole('heading', { name: 'Art of Living - 32', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('permanent QR handler preserves identity and the production record corrects tampered context', async ({ page, baseURL }) => {
  // Execute the real redirect handler, with an in-memory lookup instead of D1.
  // This qualifies handler + built UI, not Cloudflare deployment or live data.
  await page.route(`**/qr/${PUBLIC_CODE}`, async route => {
    const response = await onRequest({
      params: { number: PUBLIC_CODE },
      request: new Request(route.request().url()),
      env: { DB: { prepare: () => ({ bind: (code: string) => {
        expect(code).toBe(PUBLIC_CODE);
        return { first: async () => ({ piece_id: 'MD-905' }) };
      } }) } },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${baseURL}/works/MD-905?instance=${PUBLIC_CODE}&ref=qr`);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: '' });
  });
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    json: { ok: true, identity: {
      artworkId: 'MD-905', title: 'Synthetic Registered Study', series: 'Studio Works',
      edition: { kind: 'numbered', number: 2, size: 7, label: 'Edition 2 of 7' },
      publicCode: PUBLIC_CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
      publicProvenance: [], creatorHistory: [],
    } },
  }));
  await page.route('**/api/works/MD-905', route => route.fulfill({
    json: { ok: true, artwork: { id: 'MD-905', title: 'Synthetic Registered Study', series: 'Studio Works', editionSize: 7 } },
  }));
  await page.goto(`/qr/${PUBLIC_CODE}`);
  const canonicalPath = `/works/MD-905?instance=${PUBLIC_CODE}&ref=qr`;
  await expect(page).toHaveURL(canonicalPath);
  const identity = page.getByTestId('public-registry-identity');
  await expect(identity.getByRole('heading', { level: 1 })).toHaveText('Synthetic Registered Study');
  await expect(identity).toContainText('Edition 2 of 7');
  await expect(identity).toContainText(PUBLIC_CODE);

  await page.goto(`/works/UL-100?instance=${PUBLIC_CODE}&edition=999&title=Tampered`);
  await expect(page).toHaveURL(canonicalPath);
  await expect(identity).toContainText('Synthetic Registered Study');
  await expect(identity).not.toContainText('999');
  await expect(page.getByTestId('catalog-artwork-record')).toHaveCount(0);
  await expect(page.getByTestId('collector-page-inset')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /claim|bind|register/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('collector design preview stays unavailable in a production build', async ({ page }) => {
  await page.goto('/collector?frame=full');
  await expect(page.getByRole('heading', { name: 'Page Not Found', exact: true })).toBeVisible();
  await expect(page.getByTestId('collector-page-inset')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});
