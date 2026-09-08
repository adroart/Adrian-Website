import { test, expect, type Page } from '@playwright/test';

/**
 * /atlas used to hard-bounce to mandalacodes.com/atlas (AtlasExternalRedirect,
 * window.location.replace). The record and the globe stay on mandalacodes;
 * this site now shows a quiet local page instead of leaving immediately.
 * playwright.config.ts runs this file against both the desktop ("chromium")
 * and "Mobile Chrome" projects, so no manual project loop is needed here.
 */

const fixtureWithTwoAtRest = {
  schemaVersion: 3,
  generatedAt: '2026-09-08T12:00:00.000Z',
  chainTips: {},
  lights: [
    {
      artworkId: 'PAINT-003', title: 'Quiet Current', series: null, year: null,
      identity: [{
        publicCode: null, editionLabel: null, status: 'unregistered', ordinal: null,
        city: null, brightness: 0.24, markerSize: 1,
      }],
    },
    {
      artworkId: 'SIG-014', title: 'Amphibian Dream', series: 'Signature Works', year: 2025,
      identity: [{
        publicCode: 'AR-DREAM001', editionLabel: 'Original', status: 'private', ordinal: 2,
        city: null, brightness: 1, markerSize: 1,
      }],
    },
    {
      artworkId: 'UL-001', title: 'The Creative', series: 'Universal Language', year: 2024,
      identity: [{
        publicCode: 'AR-CREATIVE', editionLabel: 'Original', status: 'registered', ordinal: 1,
        city: { id: 'denpasar', label: 'Denpasar, Indonesia', country: 'Indonesia', lat: -8.65, lng: 115.22 },
        brightness: 1, markerSize: 1,
      }],
    },
  ],
  facets: {
    series: ['Signature Works', 'Universal Language'],
    years: [2024, 2025],
    places: [{ id: 'denpasar', label: 'Denpasar, Indonesia' }],
  },
} as const;

const fixtureWithNoneAtRest = {
  schemaVersion: 3,
  generatedAt: '2026-09-08T12:00:00.000Z',
  chainTips: {},
  lights: [
    {
      artworkId: 'PAINT-003', title: 'Quiet Current', series: null, year: null,
      identity: [{
        publicCode: null, editionLabel: null, status: 'unregistered', ordinal: null,
        city: null, brightness: 0.24, markerSize: 1,
      }],
    },
  ],
  facets: { series: [], years: [], places: [] },
} as const;

function routeAtlasApi(page: Page, state: unknown) {
  return page.route('**/api/atlas', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'private, no-store' },
    body: JSON.stringify({ ok: true, state }),
  }));
}

/** Assert no horizontal overflow (scrollWidth <= innerWidth + 2px tolerance). */
async function assertNoOverflow(page: Page) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflowing, 'Page must not have horizontal overflow').toBe(false);
}

/** Assert no "Something went wrong" error boundary text. */
async function assertNoErrorBoundary(page: Page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText, 'No error boundary should render').not.toContain('Something went wrong');
}

/** Assert no 404 / "page not found" text. */
async function assertNo404Text(page: Page) {
  const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
  expect(bodyText, '/atlas must not read as a missing page').not.toContain('page not found');
}

function attachErrorListeners(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('VITE') || text.includes('favicon') || text.includes('chrome-extension')) return;
    errors.push(`[console error] ${text}`);
  });
  page.on('pageerror', (err) => errors.push(`[page error] ${err.message}`));
  return errors;
}

test('/atlas loads locally, stays on this origin, and shows the atlas link', async ({ page, baseURL }) => {
  const errors = attachErrorListeners(page);
  await routeAtlasApi(page, fixtureWithTwoAtRest);

  await page.goto('/atlas', { waitUntil: 'networkidle' });

  // The regression this whole task exists to fix: the old page bounced to
  // mandalacodes.com with window.location.replace before a human could read
  // anything. If that ever came back, the origin below would flip.
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  expect(page.url()).toContain('/atlas');

  await expect(page.getByRole('heading', { name: 'Atlas', exact: true })).toBeVisible();
  await expect(page.getByText(/come to rest on a shared map/)).toBeVisible();

  const link = page.getByRole('link', { name: 'See the atlas' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://mandalacodes.com/atlas');

  // No globe, no filters, no table: the collector-field controls must not
  // be on this page.
  await expect(page.getByRole('combobox', { name: 'Series' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Place' })).toHaveCount(0);

  await assertNoOverflow(page);
  await assertNoErrorBoundary(page);
  await assertNo404Text(page);
  expect(errors, `Unexpected console/page errors: ${errors}`).toHaveLength(0);
});

test('the resting count reads the real ledger', async ({ page }) => {
  await routeAtlasApi(page, fixtureWithTwoAtRest);
  await page.goto('/atlas', { waitUntil: 'networkidle' });
  // Two identities in the fixture above carry a non-'unregistered' status.
  await expect(page.getByText('2 pieces have come to rest.')).toBeVisible();
});

test('says so plainly when nothing has come to rest', async ({ page }) => {
  await routeAtlasApi(page, fixtureWithNoneAtRest);
  await page.goto('/atlas', { waitUntil: 'networkidle' });
  await expect(page.getByText('No piece has come to rest yet.')).toBeVisible();
});

test('the old /atlas/* sub-paths still bounce to mandalacodes.com', async ({ page }) => {
  // AtlasExternalRedirect fires window.location.replace, which Playwright's
  // page.goto surfaces as a real cross-origin navigation. mandalacodes.com is
  // a real external site, so the request is stubbed with a harmless response
  // rather than actually fetched, but the navigation itself is left to
  // happen for real so page.url() reflects where the browser actually went.
  await page.route('https://mandalacodes.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>stub</title>',
  }));
  await page.goto('/atlas/some-deep-link', { waitUntil: 'commit' }).catch(() => null);
  await expect.poll(() => page.url()).toContain('mandalacodes.com/atlas');
});
