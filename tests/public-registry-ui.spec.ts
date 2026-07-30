import { expect, test } from '@playwright/test';

const PUBLIC_CODE = 'AR-7KQ9M2WX';

const verifiedIdentity = {
  artworkId: 'MD-905',
  title: 'Server Verified Study',
  series: 'Studio Works',
  edition: { kind: 'numbered', number: 2, size: 7, label: 'Edition 2 of 7' },
  publicCode: PUBLIC_CODE,
  artistName: 'Adrian Rasmussen',
  plateStatus: 'active',
  publicProvenance: [
    { year: '2026', event: 'created', note: 'Bali studio' },
    { year: '2027', event: 'exhibited', note: 'Public collection' },
  ],
  creatorHistory: [
    {
      entryType: 'contributor',
      title: 'Mira Santoso',
      detail: 'Joined the final assembly.',
      role: 'Woodworker',
      occurredAt: '2026-04',
    },
  ],
};

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(hasOverflow).toBe(false);
}

async function mockIdentity(page: import('@playwright/test').Page) {
  await page.route(`**/api/registry/${PUBLIC_CODE}`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, identity: verifiedIdentity }),
    });
  });
}

test('a mismatched route is replaced with the canonical server identity route', async ({ page }) => {
  await mockIdentity(page);
  await page.route('**/api/works/MD-905', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      artwork: { id: 'MD-905', title: 'Editable Draft Title', series: 'Draft Series', editionSize: 99 },
    }),
  }));

  await page.goto(`/works/UL-100?instance=${PUBLIC_CODE}&edition=999&title=Tampered`);
  await expect(page).toHaveURL(`/works/MD-905?instance=${PUBLIC_CODE}&ref=qr`);
  const identity = page.getByTestId('public-registry-identity');
  await expect(identity).toBeVisible();
  await expect(identity.getByRole('heading', { level: 1 })).toHaveText('Server Verified Study');
  await expect(identity).toContainText('MD-905');
  await expect(identity).toContainText('Edition 2 of 7');
  await expect(identity).toContainText(PUBLIC_CODE);
  await expect(identity).toContainText('Adrian Rasmussen');
  await expect(identity).toContainText('Active');
  await expect(identity).toContainText('Bali studio');
  await expect(identity).toContainText('Creator history');
  await expect(identity).toContainText('Mira Santoso');
  await expect(identity).toContainText('Woodworker');
  await expect(identity).toContainText('Joined the final assembly.');
  await expect(identity).not.toContainText('999');
  await expect(page.getByTestId('catalog-artwork-record')).toHaveCount(0);
  await expect(page.getByTestId('draft-artwork-record')).toContainText('Editable Draft Title');
  await expect(page.getByText('Art of Living - 32')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test('a malformed instance shows an explicit invalid identity without registry or catalog fallback', async ({ page }) => {
  let registryRequests = 0;
  await page.route('**/api/registry/**', route => {
    registryRequests += 1;
    return route.abort();
  });

  await page.goto('/works/UL-100?instance=AR-I0O1BAD!&edition=999');
  const invalid = page.getByTestId('public-registry-invalid');
  await expect(invalid).toBeVisible();
  await expect(invalid).toContainText('invalid');
  await expect(page.getByTestId('catalog-artwork-record')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveCount(1);
  expect(registryRequests).toBe(0);
  await assertNoHorizontalOverflow(page);
});

test('a registry-only draft shows exact identity before its draft record', async ({ page }) => {
  await mockIdentity(page);
  await page.route('**/api/works/MD-905', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      artwork: { id: 'MD-905', title: 'Editable Draft Title', series: 'Draft Series', editionSize: 99 },
    }),
  }));

  await page.goto(`/works/MD-905?instance=${PUBLIC_CODE}&edition=88`);
  await expect(page.getByTestId('public-registry-identity')).toContainText('Server Verified Study');
  await expect(page.getByTestId('public-registry-identity')).toContainText('Edition 2 of 7');
  await expect(page.getByTestId('draft-artwork-record')).toContainText('Editable Draft Title');
  await expect(page.getByTestId('public-registry-identity')).not.toContainText('88');
  await assertNoHorizontalOverflow(page);
});

test('not found is final and does not offer retry', async ({ page }) => {
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'not_found' }),
  }));

  await page.goto(`/works/UL-100?instance=${PUBLIC_CODE}`);
  const state = page.getByTestId('public-registry-not-found');
  await expect(state).toBeVisible();
  await expect(state).toContainText('not found');
  await expect(state.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('temporary registry failure can be retried without query fallback', async ({ page }) => {
  let attempts = 0;
  await page.route(`**/api/registry/${PUBLIC_CODE}`, async route => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'registry_unavailable' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        identity: { ...verifiedIdentity, artworkId: 'UL-100' },
      }),
    });
  });

  await page.goto(`/works/UL-100?instance=${PUBLIC_CODE}&edition=999`);
  const failure = page.getByTestId('public-registry-unavailable');
  await expect(failure).toBeVisible();
  await expect(failure).not.toContainText('999');
  await failure.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('public-registry-identity')).toContainText('Edition 2 of 7');
  expect(attempts).toBe(2);
});
