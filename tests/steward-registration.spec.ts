import { expect, test, type Page } from '@playwright/test';

const PUBLIC_CODE = 'AR-7KQ9M2WX';
const WORK_PATH = `/works/MD-905?instance=${PUBLIC_CODE}&ref=qr`;
const CLAIM_PATH = `${WORK_PATH}&claim=1`;
const OWNERSHIP_CODE = 'K7QM-9XTR-2PHV-N4WB';

const identity = {
  artworkId: 'MD-905',
  title: 'Registry Draft Study',
  series: 'Studio Works',
  edition: { kind: 'numbered', number: 1, size: 3, label: 'Edition 1 of 3' },
  publicCode: PUBLIC_CODE,
  artistName: 'Adrian Rasmussen',
  plateStatus: 'active',
  publicProvenance: [],
};

async function mockWork(page: Page) {
  await page.route(`**/api/registry/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, identity }),
  }));
  await page.route('**/api/works/MD-905', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      artwork: { id: 'MD-905', title: identity.title, series: identity.series, editionSize: 3 },
    }),
  }));
  await page.route(`**/api/lineage/${PUBLIC_CODE}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, artwork: { pieceId: 'MD-905', editionNumber: 1, publicCode: PUBLIC_CODE }, events: [] }),
  }));
}

async function openWithLivingLegacy(page: Page, path: string) {
  await page.goto('/');
  await page.evaluate(async (nextPath) => {
    const loadModule = Function('return import("/launchFlags.ts")');
    const module = await loadModule();
    module.LAUNCH_FLAGS.livingLegacy = true;
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('scanned sign-in returns to the canonical public claim URL without the Ownership Code', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: 'null',
  }));
  await page.route('**/api/auth/config', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ google: false }),
  }));
  let callbackURL = '';
  await page.route('**/api/auth/sign-in/email', async route => {
    callbackURL = (route.request().postDataJSON() as { callbackURL?: string }).callbackURL ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
        session: { id: 'session-one' },
      }),
    });
  });

  await openWithLivingLegacy(page, WORK_PATH);
  await page.getByRole('button', { name: 'Sign in to begin' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Email').fill('requester@example.com');
  await dialog.getByLabel('Password').fill('correct horse battery staple');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(CLAIM_PATH);
  expect(callbackURL).toBe(CLAIM_PATH);
  expect(page.url()).not.toContain(OWNERSHIP_CODE);
});

test('a signed-in return with claim context automatically exposes registration', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, kept: false, byYou: false }),
  }));

  await openWithLivingLegacy(page, CLAIM_PATH);
  await expect(page.getByRole('form', { name: 'Register Registry Draft Study' })).toBeVisible();
  await expect(page).toHaveURL(CLAIM_PATH);
});

test('a contested request stays pending and keeps the current steward visible', async ({ page }) => {
  await mockWork(page);
  await page.route('**/api/auth/get-session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'requester', email: 'requester@example.com', emailVerified: true },
      session: { id: 'session-one' },
    }),
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, kept: true, byYou: false }),
  }));

  const bindBodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/keeper/bind', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bindBodies.push(body);
    if (body.ownershipCode !== OWNERSHIP_CODE) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'code_mismatch', message: 'That Ownership Code did not match.' }),
      });
      return;
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'claim_requested',
        message: 'The current steward has been notified.',
        claim: { outcome: 'opened', window: '30 days' },
      }),
    });
  });

  await openWithLivingLegacy(page, CLAIM_PATH);
  const form = page.getByRole('form', { name: 'Request stewardship' });
  await expect(form).toBeVisible();
  await expect(page.getByText('This piece already has a steward.')).toBeVisible();

  await form.getByLabel('Ownership Code').fill('AAAA-BBBB-CCCC-DDDD');
  await form.getByRole('button', { name: 'Request stewardship' }).click();
  await expect(form.getByRole('alert')).toContainText('did not match');
  expect(bindBodies).toHaveLength(1);

  await form.getByLabel('Ownership Code').fill(OWNERSHIP_CODE);
  await form.getByLabel('Evidence note (optional)').fill('Auction receipt available');
  await form.getByRole('button', { name: 'Request stewardship' }).click();

  await expect(form.getByRole('status')).toContainText('The current steward has been notified.');
  await expect(form.getByRole('status')).toContainText('30 days');
  await expect(page.getByText('This piece already has a steward.')).toBeVisible();
  expect(bindBodies).toEqual([
    { publicCode: PUBLIC_CODE, ownershipCode: 'AAAA-BBBB-CCCC-DDDD' },
    { publicCode: PUBLIC_CODE, ownershipCode: OWNERSHIP_CODE, note: 'Auction receipt available' },
  ]);
  expect(page.url()).toBe(`http://localhost:5555${CLAIM_PATH}`);
  expect(page.url()).not.toContain(OWNERSHIP_CODE);
});
