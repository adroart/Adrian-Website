import { expect, test, type Page } from './fixtures';

const CODE = 'AR-7KQ9M2WX';
const PATH = `/works/MD-905?instance=${CODE}&ref=qr`;
const NOTE = 'May this public creator note travel with the piece.\n<img src=x onerror="window.creatorNoteExecuted=true">';
const PRIVATE = 'PRIVATE_LEDGER_SENTINEL';
const identity = {
  artworkId: 'MD-905', title: 'Public note study', series: 'Studio Works',
  edition: { kind: 'unique', number: null, size: null, label: 'Unique work' },
  publicCode: CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
  publicProvenance: [], creatorHistory: [],
};
type State = 'ready' | 'empty' | 'loading' | 'error' | 'wrong-artwork' | 'wrong-code';

async function open(page: Page, signedIn: boolean, state: State = 'ready') {
  let privateReads = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  const json = (route: any, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/auth/get-session', route => json(route, signedIn ? {
    user: { id: 'public-reader', email: 'reader@example.test', emailVerified: true },
    session: { id: 'reader-session' },
  } : null));
  await page.route('**/api/auth/sync-user', route => json(route, {}));
  await page.route(`**/api/registry/${CODE}`, route => json(route, { ok: true, identity }));
  await page.route(`**/api/lineage/${CODE}`, route => json(route, {
    ok: true, artwork: { pieceId: identity.artworkId, publicCode: CODE }, events: [],
  }));
  await page.route('**/api/keeper/piece?**', route => json(route, {
    ok: true, kept: true, byYou: false, keeperPieceId: 'kp-not-yours',
  }));
  await page.route('**/api/keeper/certificate-ledger?**', route => {
    privateReads += 1;
    return json(route, { ok: true, priceHistory: [{ amountMinor: 9876500, currency: 'USD', privateNotes: PRIVATE }] });
  });
  await page.route('**/api/certificates/**', async route => {
    if (state === 'loading') await gate;
    if (state === 'error') return json(route, { ok: false }, 503);
    return json(route, { ok: true, certificate: {
      ...identity,
      artworkId: state === 'wrong-artwork' ? 'MD-906' : identity.artworkId,
      publicCode: state === 'wrong-code' ? 'AR-8KQ9M2WY' : CODE,
      materials: ['Synthetic cedar'],
      publicLedger: state === 'empty' ? [] : [
        { id: 'public-note', createdAt: '2026-09-01T00:00:00.000Z', message: NOTE },
        { id: 'no-public-message', createdAt: '2026-09-01T00:00:00.000Z', privateNotes: PRIVATE, amountMinor: 9876500 },
      ],
      privateNotes: PRIVATE,
      priceHistory: [{ amountMinor: 9876500, currency: 'USD' }],
    } });
  });
  await page.goto('/');
  await page.evaluate(async path => {
    const flags = await Function('return import("/launchFlags.ts")')();
    flags.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, PATH);
  await page.getByRole('button', { name: 'Piece information' }).click();
  return { release, privateReads: () => privateReads };
}

async function privateFactsAbsent(page: Page, reads: () => number) {
  await expect(page.getByText(PRIVATE)).toHaveCount(0);
  await expect(page.getByText(/98,765|9876500/)).toHaveCount(0);
  expect(reads()).toBe(0);
}

for (const signedIn of [false, true]) {
  test(`public creator notes remain literal and readable for a ${signedIn ? 'signed-in nonkeeper' : 'signed-out reader'}`, async ({ page }, testInfo) => {
    const fx = await open(page, signedIn);
    await expect(page.getByText('Synthetic cedar', { exact: true })).toBeVisible();
    const notes = page.getByRole('region', { name: 'Creator notes' });
    await expect(notes).toBeVisible();
    expect(await notes.locator('p').textContent()).toBe(NOTE);
    await expect(notes.locator('img,script')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).creatorNoteExecuted)).toBeUndefined();
    await privateFactsAbsent(page, fx.privateReads);
    await notes.scrollIntoViewIfNeeded();
    const bounds = await notes.boundingBox();
    expect(bounds).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    if (!signedIn) await page.screenshot({ path: testInfo.outputPath('public-creator-note.png'), fullPage: true });
  });
}

for (const state of ['empty', 'loading', 'error', 'wrong-artwork', 'wrong-code'] as const) {
  test(`public creator notes stay absent for ${state} certificate state`, async ({ page }) => {
    const fx = await open(page, false, state);
    if (state === 'empty') await expect(page.getByText('Synthetic cedar', { exact: true })).toBeVisible();
    if (['error', 'wrong-artwork', 'wrong-code'].includes(state)) {
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
      await expect(page.getByText('Synthetic cedar', { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText('Piece information', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Creator notes' })).toHaveCount(0);
    await expect(page.getByText(NOTE)).toHaveCount(0);
    await privateFactsAbsent(page, fx.privateReads);
    if (state === 'loading') {
      const response = page.waitForResponse(r => r.url().includes('/api/certificates/'));
      fx.release();
      await response;
      await expect(page.getByRole('region', { name: 'Creator notes' })).toBeVisible();
    }
  });
}
