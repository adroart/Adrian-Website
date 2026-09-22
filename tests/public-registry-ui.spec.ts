import { expect, test } from './fixtures';

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

async function typography(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      family: style.fontFamily,
      size: Number.parseFloat(style.fontSize),
      spacing: Number.parseFloat(style.letterSpacing) || 0,
    };
  });
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

// The permanent-record probe (a HEAD request) is not what any of these
// specs are testing, and it should never reach the live network. Absent by
// default keeps the link hidden; individual tests can override with a more
// specific route to assert on the present case.
async function stubRecordProbeAbsent(page: import('@playwright/test').Page) {
  await page.route('**/api/records/**', route => route.fulfill({ status: 404 }));
}

test.beforeEach(async ({ page }) => {
  await stubRecordProbeAbsent(page);
});

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
  await expect(page.getByTestId('draft-artwork-record')).toContainText('Server Verified Study');
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
  await expect(page.getByTestId('draft-artwork-record')).toContainText('Server Verified Study');
  await expect(page.getByTestId('public-registry-identity')).not.toContainText('88');
  await assertNoHorizontalOverflow(page);
});

test('a digital-only identity is labeled as a registered artwork record, not a generated plate', async ({ page }) => {
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, identity: { ...verifiedIdentity, plateStatus: 'registered' } }),
  }));
  await page.route('**/api/works/MD-905', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      artwork: { id: 'MD-905', title: 'Editable Draft Title', series: 'Draft Series', editionSize: 99 },
    }),
  }));

  await page.goto(`/works/MD-905?instance=${PUBLIC_CODE}`);
  const identity = page.getByTestId('public-registry-identity');
  await expect(identity).toContainText('Registered artwork record');
  await expect(identity).not.toContainText('Generated');
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

test('a scanned arrival is immediately complete without sign-in, timers, or private facts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      identity: { ...verifiedIdentity, artworkId: 'UL-100', title: 'Art of Living - 32' },
    }),
  }));
  await page.route('**/api/certificates/UL-100?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      certificate: {
        artworkId: 'UL-100',
        edition: { kind: 'numbered', number: 3, size: 11 },
        publicCode: PUBLIC_CODE,
        materials: ['Teak'],
        origin: 'Bali, Indonesia',
        certificateWording: 'Recorded as an authentic artwork instance.',
      },
    }),
  }));
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: 'null',
  }));
  await page.route('**/api/book?id=UL-100', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      entry: { materialsStory: 'Static material story that certificate suppression must hide.' },
    }),
  }));

  await page.goto('/');
  await page.evaluate(async (path) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    const loadCatalog = Function('return import("/data/mockData.ts")');
    const catalog = await loadCatalog();
    const artwork = catalog.FULL_ARCHIVE.find((entry: { id: string }) => entry.id === 'UL-100');
    artwork.provenance = [{ year: '1999', event: 'exhibited', note: 'Static catalog provenance' }];
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/works/UL-100?instance=${PUBLIC_CODE}&ref=qr`);

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1, h2, h3').first()).toHaveJSProperty('tagName', 'H1');
  await expect(page.getByTestId('collector-arrival')).toContainText('Art of Living - 32');
  await expect(page.getByTestId('collector-arrival').locator('img')).toHaveAttribute(
    'alt',
    'Art of Living, Universal Language 32. Original multi-dimensional wooden sculpture by Adrian Rasmussen.',
  );
  await expect(page.getByTestId('collector-arrival')).not.toContainText('Laser Cut Wood, Acrylic');
  await expect(page.getByTestId('collector-arrival')).not.toContainText('Made in 2024');
  await expect(page.getByTestId('public-registry-identity')).toContainText('Art of Living - 32');
  await expect(page.getByTestId('catalog-artwork-record')).toBeVisible();
  await expect(page.getByTestId('catalog-artwork-record').locator('img')).toHaveAttribute(
    'alt',
    'Art of Living, Universal Language 32. Original multi-dimensional wooden sculpture by Adrian Rasmussen.',
  );
  await expect(page.getByTestId('public-certificate')).toContainText('Teak');
  await expect(page.getByTestId('public-certificate')).toContainText('Bali, Indonesia');
  await expect(page.getByTestId('public-certificate')).toContainText('Edition 3 of 11');
  await expect(page.getByTestId('public-certificate')).not.toContainText('Edition 2 of 7');
  await expect(page.getByTestId('public-certificate')).toContainText(PUBLIC_CODE);
  await expect(page.getByTestId('public-certificate')).not.toContainText('Makers');
  const certificateFactType = await typography(page.locator('.collector-certificate-fact dd').first());
  expect(certificateFactType.family).toContain('Lora');
  expect(certificateFactType.size).toBeGreaterThanOrEqual(16);
  await expect(page.locator('body')).not.toContainText('Static catalog provenance');
  await expect(page.locator('body')).not.toContainText('Static material story');
  const registerDoor = page.getByRole('button', { name: 'Register and certify this piece' });
  await expect(registerDoor).toBeVisible();
  const doorCopyType = await typography(registerDoor.locator('.collector-door-copy'));
  expect(doorCopyType.family).toContain('Lora');
  expect(doorCopyType.size).toBeGreaterThanOrEqual(16);
  const buttonType = await typography(registerDoor);
  expect(buttonType.size).toBeGreaterThanOrEqual(12);
  expect(buttonType.spacing).toBeLessThanOrEqual(buttonType.size * 0.12);
  await expect(page.getByRole('button', { name: 'Begin your dream' })).toBeVisible();
  await expect(page.locator('[inert]')).toHaveCount(0);
  await expect(page.getByTestId('arrival-record')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('body')).not.toContainText('collector@example.com');
  await expect(page.locator('body')).not.toContainText('1990-06-12');
  await assertNoHorizontalOverflow(page);
  await registerDoor.focus();
  await expect(registerDoor).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Register this piece to you' })).toBeVisible();
  const openingCopyType = await typography(page.locator('.collector-screen .collector-copy').first());
  expect(openingCopyType.family).toContain('Lora');
  expect(openingCopyType.size).toBeGreaterThanOrEqual(16);
});

test('a failed certificate can retry while exact instance facts and the record remain available', async ({ page }) => {
  let certificateAttempts = 0;
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      identity: { ...verifiedIdentity, artworkId: 'UL-100', title: 'Art of Living - 32' },
    }),
  }));
  await page.route('**/api/certificates/UL-100?**', route => {
    certificateAttempts += 1;
    return route.fulfill({
      status: certificateAttempts === 1 ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(certificateAttempts === 1
        ? { ok: false, error: 'certificate_failed' }
        : {
            ok: true,
            certificate: {
              artworkId: 'UL-100',
              edition: { kind: 'numbered', number: 4, size: 12 },
              publicCode: PUBLIC_CODE,
              materials: ['Teak'],
            },
          }),
    });
  });
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, body: 'null' }));

  await page.goto('/');
  await page.evaluate(async (path) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/works/UL-100?instance=${PUBLIC_CODE}&ref=qr`);

  const certificate = page.getByTestId('public-certificate');
  await expect(certificate).toContainText('could not be verified');
  await expect(certificate).not.toContainText('Edition 2 of 7');
  await expect(certificate).not.toContainText(PUBLIC_CODE);
  await expect(page.getByTestId('public-registry-identity')).toBeVisible();
  const attemptsBeforeRetry = certificateAttempts;
  await certificate.getByRole('button', { name: 'Try again' }).click();
  await expect(certificate).toContainText('Teak');
  await expect(certificate).toContainText('UL-100');
  await expect(certificate).toContainText('Edition 4 of 12');
  await expect(certificate).toContainText(PUBLIC_CODE);
  expect(certificateAttempts).toBe(attemptsBeforeRetry + 1);
});

test('a mismatched certificate response cannot replace exact instance authority', async ({ page }) => {
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      identity: { ...verifiedIdentity, artworkId: 'UL-100', title: 'Art of Living - 32' },
    }),
  }));
  await page.route('**/api/certificates/UL-100?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      certificate: {
        artworkId: 'MD-905',
        edition: { kind: 'numbered', number: 9, size: 9 },
        publicCode: 'AR-WRONG123',
        materials: ['Untrusted material'],
      },
    }),
  }));
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, body: 'null' }));

  await page.goto('/');
  await page.evaluate(async (path) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/works/UL-100?instance=${PUBLIC_CODE}&ref=qr`);

  const certificate = page.getByTestId('public-certificate');
  await expect(certificate).toContainText('could not be verified');
  await expect(certificate).not.toContainText('AR-WRONG123');
  await expect(certificate).not.toContainText('Untrusted material');
  await expect(certificate).not.toContainText(PUBLIC_CODE);
  await expect(page.getByTestId('public-registry-identity')).toContainText(PUBLIC_CODE);
});
