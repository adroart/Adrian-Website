import { expect, test, type Page } from './fixtures';

const CODE = 'AR-7KQ9M2WX';
const PATH = `/works/MD-905?instance=${CODE}&ref=qr`;
const SAMPLE = 'I saw it in the hallway of a house I was leaving…';
const SAMPLE_TWO = 'On the long wall, where the afternoon reaches it…';
const identity = {
  artworkId: 'MD-905', title: "Earth's Breath", series: 'Universal Language',
  edition: { kind: 'numbered', number: 3, size: 64, label: 'Edition 3 of 64' },
  publicCode: CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
  publicProvenance: [], creatorHistory: [],
};

async function json(route: any, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function common(page: Page, keeper = { byYou: true, authorHistory: false }) {
  await page.route('**/api/**', route => json(route, null));
  await page.route(`**/api/registry/${CODE}`, route => json(route, { ok: true, identity }));
  await page.route('**/api/auth/get-session', route => json(route, {
    user: { id: 'synthetic-user', email: 'keeper@example.test', emailVerified: true },
    session: { id: 'synthetic-session' },
  }));
  await page.route('**/api/auth/sync-user', route => json(route, { ok: true }));
  await page.route('**/api/keeper/piece?**', route => json(route, {
    ok: true, kept: true, keeperPieceId: 'kp-synthetic-1', currentDisplayLocation: null,
    stewardHistory: [], ...keeper,
  }));
  await page.route(`**/api/lineage/${CODE}`, route => json(route, {
    ok: true, artwork: { pieceId: 'MD-905', editionNumber: 3, publicCode: CODE }, events: [],
  }));
  await page.route('**/api/collector/dreams/public/**', route => json(route, { dream: null }));
}

async function open(page: Page) {
  await page.goto('/');
  await page.evaluate(async path => {
    const flags = await Function('return import("/launchFlags.ts")')();
    flags.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, PATH);
}

async function openGardenIndex(page: Page) {
  await page.getByRole('button', { name: 'Add to your piece Open', exact: true }).click();
  await page.getByRole('button', { name: 'See all of them' }).click();
}

async function expectNoSamples(page: Page) {
  await expect(page.getByText(SAMPLE)).toHaveCount(0);
  await expect(page.getByText(SAMPLE_TWO)).toHaveCount(0);
}

for (const state of ['empty', 'loading', 'failed'] as const) {
  test(`wired garden ${state} state never borrows preview answers`, async ({ page }) => {
    await common(page);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let waiting = false;
    await page.route('**/api/collector/dreams**', async route => {
      if (state === 'loading') { waiting = true; await gate; }
      if (state === 'failed') return json(route, { ok: false }, 500);
      return json(route, { keeperPieceId: 'kp-synthetic-1', current: null, history: [], markers: [] });
    });
    await open(page);
    if (state === 'loading') await expect.poll(() => waiting).toBe(true);
    await openGardenIndex(page);
    await expectNoSamples(page);
    if (state === 'loading') release();
  });
}

test('publishing the last historical seal stays empty after refetch and reload', async ({ page }) => {
  let published = false;
  let reads = 0;
  await common(page, { byYou: false, authorHistory: true });
  await page.route('**/api/collector/dreams**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toMatchObject({
        action: 'publish_historical', keeperPieceId: 'kp-synthetic-1', dreamId: 'dream-sealed-1',
      });
      published = true;
      return json(route, { ok: true });
    }
    reads += 1;
    return json(route, {
      keeperPieceId: 'kp-synthetic-1', current: null,
      history: published ? [] : [{
        id: 'dream-sealed-1', keeperPieceId: 'kp-synthetic-1', body: 'May the next caretaker listen deeply.',
        scope: 'planet', visibility: 'private', tier: 'seal', version: 1,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        sharedAt: null, revokedAt: null, fulfilledAt: null, archivedAt: null,
      }], markers: [],
    });
  });
  await open(page);
  await openGardenIndex(page);
  await page.getByRole('button', { name: 'Let it shine' }).click();
  await expect.poll(() => published).toBe(true);
  await expect.poll(() => reads).toBeGreaterThan(1);
  await expect(page.getByText('May the next caretaker listen deeply.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Let it shine' })).toHaveCount(0);
  await expectNoSamples(page);
  const readsBeforeReload = reads;
  await open(page);
  await expect.poll(() => reads).toBeGreaterThan(readsBeforeReload);
  await openGardenIndex(page);
  await expectNoSamples(page);
});

test('an account remount cannot reveal preview answers', async ({ page }) => {
  await common(page);
  let user = 'first-user';
  let secondUserReads = 0;
  await page.route('**/api/auth/get-session', route => json(route, {
    user: { id: user, email: `${user}@example.test`, emailVerified: true },
    session: { id: `session-${user}` },
  }));
  await page.route('**/api/collector/dreams**', route => json(route, {
    keeperPieceId: 'kp-synthetic-1', current: null, history: [], markers: [],
  }).then(() => { if (user === 'second-user') secondUserReads += 1; }));
  await open(page);
  await openGardenIndex(page);
  await expectNoSamples(page);
  user = 'second-user';
  await page.evaluate(async () => {
    const module = await Function('return import("/lib/account/authClient.ts")')();
    module.authClient.$store.notify('$sessionSignal');
  });
  await expect.poll(() => secondUserReads).toBeGreaterThan(0);
  await openGardenIndex(page);
  await expectNoSamples(page);
});
