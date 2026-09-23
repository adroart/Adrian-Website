import { expect, test } from './fixtures';

const CODE = 'AR-7KQ9M2WX';
const PATH = `/works/MD-905?instance=${CODE}&ref=qr`;
const identity = {
  artworkId: 'MD-905', title: 'Server Verified Study', series: 'Studio Works',
  edition: { kind: 'numbered', number: 2, size: 7, label: 'Edition 2 of 7' },
  publicCode: CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
  publicProvenance: [], creatorHistory: [],
};

async function openCollector(page: import('@playwright/test').Page, certificateStatus: 'loading' | 'error' | 'content') {
  await page.route('**/api/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route(`**/api/registry/${CODE}`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, identity }),
  }));
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(null),
  }));
  let releaseCertificate!: () => void;
  const certificateGate = new Promise<void>(resolve => { releaseCertificate = resolve; });
  await page.route('**/api/certificates/**', async route => {
    if (certificateStatus === 'loading') await certificateGate;
    if (certificateStatus === 'error') return route.fulfill({ status: 500, body: '{}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, certificate: { ...identity, materials: ['Synthetic cedar'], dimensions: null } }),
    });
  });
  await page.goto('/');
  await page.evaluate(async path => {
    const flags = await Function('return import("/launchFlags.ts")')();
    flags.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, PATH);
  await page.getByRole('button', { name: 'Piece information' }).click();
  if (certificateStatus === 'error') await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  if (certificateStatus === 'content') await expect(page.getByText('Synthetic cedar')).toBeVisible();
  if (certificateStatus === 'loading') await expect(page.getByText('Synthetic cedar')).toHaveCount(0);
  return releaseCertificate;
}

for (const state of ['loading', 'error', 'content'] as const) {
  test(`piece information header clears the fixed navigation in the ${state} state`, async ({ page }, testInfo) => {
    const releaseCertificate = await openCollector(page, state);
    const title = page.getByText('Piece information', { exact: true });
    const back = page.getByRole('button', { name: 'Back', exact: true });
    await expect(title).toBeVisible();
    await expect(back).toBeVisible();

    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('nav')!.getBoundingClientRect();
      const titleNode = [...document.querySelectorAll('*')].find(node => node.textContent === 'Piece information')!;
      const title = titleNode.getBoundingClientRect();
      const back = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === 'Back')!.getBoundingClientRect();
      return { navBottom: nav.bottom, titleTop: title.top, backTop: back.top, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.navBottom);
    expect(geometry.backTop).toBeGreaterThanOrEqual(geometry.navBottom);
    expect(geometry.overflow).toBeLessThanOrEqual(2);
    if (state === 'content') {
      await page.screenshot({ path: `/tmp/collector-header-${testInfo.project.name.replace(' ', '-').toLowerCase()}.png` });
    }
    if (state === 'loading') {
      const response = page.waitForResponse(r => r.url().includes('/api/certificates/'));
      releaseCertificate();
      await response;
    }
    await back.click();
    await expect(page.getByRole('button', { name: 'Piece information' })).toBeVisible();
  });
}
