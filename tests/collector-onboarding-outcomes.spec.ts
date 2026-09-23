import { expect, test, type Page } from './fixtures';

const CODE = 'AR-7KQ9M2WX';
const OWNERSHIP = 'K7QM9XTR2PHVN4WB';
const PATH = `/works/MD-905?instance=${CODE}&ref=qr`;
const identity = {
  artworkId: 'MD-905', title: 'Registry Draft Study', series: 'Studio Works',
  edition: { kind: 'numbered', number: 1, size: 3, label: 'Edition 1 of 3' },
  publicCode: CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
  publicProvenance: [], creatorHistory: [],
};

const json = (route: any, body: unknown, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(body),
});

async function mount(page: Page, user: () => string, bound: () => boolean) {
  await page.route('**/api/**', route => json(route, null));
  await page.route('**/data/cities-index.json', route => json(route, [{
    name: 'Denpasar', admin: 'Bali', country: 'Indonesia', cc: 'ID',
    lat: -8.65, lng: 115.22, tz: 'Asia/Makassar',
  }]));
  await page.route(`**/api/registry/${CODE}`, route => json(route, { ok: true, identity }));
  await page.route(`**/api/lineage/${CODE}`, route => json(route, {
    ok: true, artwork: { pieceId: 'MD-905', editionNumber: 1, publicCode: CODE }, events: [],
  }));
  await page.route('**/api/auth/get-session', route => json(route, {
    user: { id: user(), email: `${user()}@example.test`, emailVerified: true },
    session: { id: `session-${user()}` },
  }));
  await page.route('**/api/auth/sync-user', route => json(route, { ok: true }));
  await page.route('**/api/keeper/piece?**', route => json(route, bound()
    ? { ok: true, kept: true, byYou: true, keeperPieceId: `kp-${user()}` }
    : { ok: true, kept: false, byYou: false }));
  await page.route('**/api/keeper/message?**', route => json(route, { ok: false }, 404));
  await page.route('**/api/collector/dreams/public/**', route => json(route, { dream: null }));
  await page.route('**/api/atlas/ordinal**', route => json(route, { ok: true, ordinal: 47 }));
  await page.route('**/api/atlas', route => json(route, { state: { lights: [{ identity: [{ publicCode: CODE, ordinal: 47 }] }] } }));
  await page.route('**/api/collector/privacy?view=cities', route => json(route, {
    cities: [{ id: 'denpasar', label: 'Denpasar' }],
  }));
  await page.route('**/api/collector/privacy?piece=**', route => json(route, {
    ring1: { privateRecord: true }, ring2: { shareCity: false, cityId: null },
    ring3: { shareDerivedChart: false },
    ring4: { shareFace: false, shareName: false, shareIntention: false, shareBusiness: false, shareMission: false },
    policyVersion: 'collector-privacy-v1',
  }));
  await page.goto('/');
  await page.evaluate(async path => {
    const flags = await Function('return import("/launchFlags.ts")')();
    flags.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, PATH);
}

async function bindAndReachProfile(page: Page, stopAtPrivateRead = false) {
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('textbox', { name: 'The code' }).fill(OWNERSHIP);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('The code is true')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  for (const head of ['You felt the pull', 'The resonant grid', 'When you focus your love, it grows']) {
    await expect(page.getByText(head)).toBeVisible();
    const viewport = page.viewportSize()!;
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
  }
  await expect(page.getByText('It carries on')).toBeVisible();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByLabel('City').fill('Denpasar');
  await page.getByRole('button', { name: 'Continue' }).click();
  if (stopAtPrivateRead) return;
  await page.getByLabel('Date').fill('12/06/1990');
  await page.getByLabel('Time').fill('09:30');
  await page.getByLabel('Place of birth').fill('Denpasar');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Your links')).toBeVisible();
}

test('a private-profile read failure is retryable and never becomes a destructive save', async ({ page }) => {
  let isBound = false;
  let onboardingReads = 0;
  let writes = 0;
  await mount(page, () => 'adult', () => isBound);
  await page.route('**/api/keeper/bind', async route => { isBound = true; await json(route, { ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }); });
  await page.route('**/api/collector/onboarding', route => {
    if (route.request().method() !== 'GET') { writes += 1; return json(route, { ok: false }, 500); }
    onboardingReads += 1;
    return onboardingReads === 1
      ? json(route, { ok: false, error: 'profile_unavailable' }, 500)
      : json(route, { status: 'missing' });
  });
  await page.route('**/api/collector/privacy', route => {
    if (route.request().method() === 'PUT') writes += 1;
    return json(route, {
      ring1: { privateRecord: true }, ring2: { shareCity: false, cityId: null }, ring3: { shareDerivedChart: false },
      ring4: { shareFace: false, shareName: false, shareIntention: false, shareBusiness: false, shareMission: false },
      policyVersion: 'collector-privacy-v1',
    });
  });
  await bindAndReachProfile(page, true);
  await expect(page.getByText('Your words are here')).toBeVisible();
  await expect(page.getByText('Your private choices could not be opened right now. Please try again.')).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Who you are')).toBeVisible();
  expect(onboardingReads).toBeGreaterThan(1);
  expect(writes).toBe(0);
});

test('profile lands before privacy starts, refusal preserves a retryable authored screen', async ({ page }) => {
  let isBound = false;
  let releaseBirth!: () => void;
  const birthGate = new Promise<void>(resolve => { releaseBirth = resolve; });
  let birthStarted = false;
  let savedBirth: any = null;
  let birthPosts = 0;
  let privacyAttempts = 0;
  await mount(page, () => 'adult', () => isBound);
  await page.route('**/api/keeper/bind', async route => { isBound = true; await json(route, { ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }); });
  await page.route('**/api/collector/onboarding', async route => {
    if (route.request().method() === 'GET') return json(route, savedBirth
      ? { status: 'current', inputs: savedBirth, updatedAt: '2026-09-22T00:00:00Z' }
      : { status: 'missing' });
    birthStarted = true;
    birthPosts += 1;
    await birthGate;
    savedBirth = route.request().postDataJSON().inputs;
    return json(route, { status: 'current', inputs: savedBirth, updatedAt: '2026-09-22T00:00:00Z' });
  });
  await page.route('**/api/collector/privacy', route => {
    if (route.request().method() !== 'PUT') return json(route, {
      ring1: { privateRecord: true }, ring2: { shareCity: false, cityId: null }, ring3: { shareDerivedChart: false },
      ring4: { shareFace: false, shareName: false, shareIntention: false, shareBusiness: false, shareMission: false },
      policyVersion: 'collector-privacy-v1',
    });
    privacyAttempts += 1;
    return privacyAttempts === 1
      ? json(route, { ok: false, error: 'adult_profile_required' }, 403)
      : json(route, { ring1: { privateRecord: true }, ring2: {}, ring3: {}, ring4: {} });
  });
  await bindAndReachProfile(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => birthStarted).toBe(true);
  expect(privacyAttempts).toBe(0);
  await expect(page.getByText(/You are Light 47/)).toHaveCount(0);
  releaseBirth();
  await expect(page.getByText('Your words are here')).toBeVisible();
  await expect(page.getByText('Your privacy choices could not be saved right now. Please try again.')).toBeVisible();
  await expect(page.getByText(/You are Light 47/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Your links')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/You are Light 47/)).toBeVisible();
  expect(privacyAttempts).toBe(2);
  expect(birthPosts).toBe(1);
});

test('a stale save completion after an auth switch cannot advance the new account', async ({ page }) => {
  let isBound = false;
  let currentUser = 'first';
  let releaseBirth!: () => void;
  const birthGate = new Promise<void>(resolve => { releaseBirth = resolve; });
  let birthStarted = false;
  await mount(page, () => currentUser, () => isBound);
  await page.route('**/api/keeper/bind', async route => { isBound = true; await json(route, { ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1 } }); });
  await page.route('**/api/collector/onboarding', async route => {
    if (route.request().method() === 'GET') return json(route, { status: 'missing' });
    birthStarted = true;
    await birthGate;
    return json(route, { status: 'current', inputs: route.request().postDataJSON().inputs, updatedAt: '2026-09-22T00:00:00Z' });
  });
  await page.route('**/api/collector/privacy', route => json(route, { ring1: {}, ring2: {}, ring3: {}, ring4: {} }));
  await bindAndReachProfile(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => birthStarted).toBe(true);
  currentUser = 'second';
  await page.evaluate(async () => {
    const module = await Function('return import("/lib/account/authClient.ts")')();
    module.authClient.$store.notify('$sessionSignal');
  });
  releaseBirth();
  await expect(page.getByText(/You are Light 47/)).toHaveCount(0);
  await expect(page.getByText('Registry Draft Study', { exact: true })).toBeVisible();
});
