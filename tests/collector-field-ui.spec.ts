import { expect, test } from './fixtures';
const fixture = {
  schemaVersion: 3,
  generatedAt: '2026-08-09T12:00:00.000Z',
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

test('hydrated collector field changes its lens and stays readable and contained', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(async (fieldData) => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1">');
    document.body.innerHTML = '<main id="collector-field-harness"></main>';
    document.body.style.margin = '0';
    document.body.style.background = '#0f0d0b';
    const loadModule = (specifier: string) => import(/* @vite-ignore */ specifier);
    const ReactModule = await loadModule('/node_modules/.vite/deps/react.js');
    const React = ReactModule.default ?? ReactModule;
    const ReactDomClientModule = await loadModule('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = ReactDomClientModule.default ?? ReactDomClientModule;
    const { default: FieldExperience } = await loadModule('/components/collector/legacy/FieldExperience.tsx');
    createRoot(document.getElementById('collector-field-harness')!).render(
      React.createElement(FieldExperience, {
        status: 'ready', data: fieldData, onRetry: () => undefined,
        initialFilters: { series: 'Universal Language' },
      }),
    );
  }, fixture);

  await expect(page.getByRole('heading', { name: 'Collector field' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Series' })).toHaveValue('Universal Language');
  await expect(page.getByRole('list', { name: 'Browse every work' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('[data-field-match="false"]')).toHaveCount(4);
  await expect(page.locator('[data-field-match="false"]').first()).toBeVisible();

  await page.getByRole('combobox', { name: 'Series' }).selectOption('Signature Works');
  await expect(page.getByRole('combobox', { name: 'Series' })).toHaveValue('Signature Works');
  await expect(page.locator('[data-field-key="SIG-014::AR-DREAM001"][data-field-match="true"]')).toHaveCount(2);
  await expect(page.locator('[data-field-key="UL-001::AR-CREATIVE"][data-field-match="false"]')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Quiet Current/ })).toHaveAttribute('href', '/works/PAINT-003');

  const measurements = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    controls: [...document.querySelectorAll('select, button, a')].map((element) =>
      Math.round(element.getBoundingClientRect().height)),
    transitionSeconds: Number.parseFloat(
      getComputedStyle(document.querySelector('[data-field-match]')!).transitionDuration,
    ),
    recededLinkOpacity: getComputedStyle(
      document.querySelector('.collector-field__item[data-field-match="false"] a')!,
    ).opacity,
    mapLabelPixels: Number.parseFloat(
      getComputedStyle(document.querySelector('.collector-field__map-label')!).fontSize,
    ) * (document.querySelector('.collector-field__map')!.getBoundingClientRect().width / 1000),
  }));
  expect(measurements.viewport).toBe(page.viewportSize()?.width);
  expect(measurements.scroll).toBeLessThanOrEqual(measurements.viewport);
  expect(measurements.controls.every((height) => height >= 44)).toBe(true);
  expect(measurements.transitionSeconds).toBeLessThanOrEqual(0.00001);
  expect(measurements.recededLinkOpacity).toBe('1');
  expect(measurements.mapLabelPixels).toBeGreaterThanOrEqual(12);
  if (process.env.COLLECTOR_FIELD_SCREENSHOTS) {
    await page.screenshot({ path: testInfo.outputPath('collector-field.png'), fullPage: true });
  }
});

test('the canonical collector field page loads the public projection', async ({ page }) => {
  await page.route('**/api/atlas', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'private, no-store' },
    body: JSON.stringify({ ok: true, state: fixture }),
  }));
  await page.goto('/');
  await page.evaluate(async () => {
    document.body.innerHTML = '<main id="collector-field-page-harness"></main>';
    const loadModule = (specifier: string) => import(/* @vite-ignore */ specifier);
    const ReactModule = await loadModule('/node_modules/.vite/deps/react.js');
    const React = ReactModule.default ?? ReactModule;
    const ReactDomClientModule = await loadModule('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = ReactDomClientModule.default ?? ReactDomClientModule;
    const { default: CollectorFieldPage } = await loadModule('/components/collector/legacy/CollectorFieldPage.tsx');
    createRoot(document.getElementById('collector-field-page-harness')!).render(
      React.createElement(CollectorFieldPage),
    );
  });

  await expect(page.getByTestId('collector-field-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collector field' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Browse every work' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Place' }).selectOption('denpasar');
  await expect(page.locator('[data-field-key="UL-001::AR-CREATIVE"][data-field-match="true"]')).toHaveCount(2);
  await expect(page.locator('[data-field-key="SIG-014::AR-DREAM001"][data-field-match="false"]')).toHaveCount(2);
});
