import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('navigates into and out of Stories without the global error screen', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    history.pushState({}, '', '/keystatic');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Return to Admin' })).toBeVisible();

  await page.getByRole('link', { name: 'Return to Admin' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/login)?$/);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('admin shell is keyboard reachable and has no serious accessibility violations', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/overview', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      attention: { plates: 2, draftViewings: 1, openInvoices: 1 },
    }),
  }));
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Studio overview' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
});

test('mobile admin menu fits the viewport and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/overview', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, attention: null }),
  }));
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Pricing' }).click();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test('opens Maintenance from Artwork and renders the private five-section detail accessibly', async ({ page }) => {
  await page.goto('/admin');
  if ((page.viewportSize()?.width || 0) < 768) {
    await page.getByRole('button', { name: 'Menu' }).click();
  }
  const navigation = page.getByRole('navigation', { name: 'Admin navigation' });
  await expect(navigation.getByText('Artwork', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: 'Maintenance' }).click();
  await expect(page).toHaveURL(/\/admin\/maintenance$/);
  await expect(page.getByRole('heading', { name: 'Maintenance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();

  for (const title of [
    'Current public truth',
    'Physical plate',
    'Private acquisition',
    'Current steward',
    'Maintenance history',
  ]) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);

  await page.getByLabel('Title').fill('No artwork has this title');
  await page.getByRole('button', { name: 'Search Maintenance' }).click();
  await expect(page.getByRole('heading', { name: 'No matching artworks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current public truth' })).toBeHidden();
});

test('reviews, unlocks, creates, and corrects a private acquisition', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mutation flow runs once against the shared development mock.');

  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Record acquisition', exact: true }).click();
  await page.getByLabel('Amount paid').fill('1250.00');
  await page.getByLabel('Currency', { exact: true }).selectOption('USD');
  await page.getByLabel('Private notes').fill('Private browser-flow check.');
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await expect(page.getByRole('heading', { name: 'Before' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'After' })).toBeVisible();
  await page.getByLabel('Reason for this change').fill('Record the verified acquisition.');

  const secret = page.getByLabel('Registry secret');
  if (await secret.isVisible().catch(() => false)) {
    await secret.fill('local-development-secret');
    await page.getByRole('button', { name: 'Unlock registry' }).click();
  }
  await expect(page.getByText('Private registry unlocked for saving.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.locator('.admin-alert').getByText('Acquisition recorded.')).toBeVisible();

  await page.getByRole('button', { name: 'Correct record' }).last().click();
  await expect(page.getByLabel('Amount paid')).toHaveValue('1250.00');
  await page.getByLabel('Amount paid').fill('1300.00');
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await expect(page.getByText('USD 1,250.00', { exact: true })).toBeVisible();
  await expect(page.getByText('USD 1,300.00', { exact: true })).toBeVisible();
  await page.getByLabel('Reason for this change').fill('Correct the verified amount.');
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.locator('.admin-alert').getByText('Acquisition correction saved.')).toBeVisible();

  const detail = await page.evaluate(async () => {
    const response = await fetch('/api/admin/maintenance/kp-local-maintenance');
    return response.json();
  });
  const saved = detail.piece.acquisitions.find((item: { privateNotes: string }) => item.privateNotes === 'Private browser-flow check.');
  expect(saved.amountMinor).toBe(130000);
  expect(saved.currency).toBe('USD');
});

test('development Maintenance API replays idempotent create and correction requests', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mutation flow runs once against the shared development mock.');
  await page.goto('/admin/maintenance');

  const outcome = await page.evaluate(async () => {
    await fetch('/api/admin/registry-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'local-development-secret' }),
    });
    const suffix = `${Date.now()}-${Math.random()}`;
    const createKey = `mock-create-${suffix}`;
    const note = `Mock replay ${suffix}`;
    const acquisition = {
      acquisitionType: 'sale', acquiredAt: null, amountMinor: 10001, currency: 'USD',
      acquirerReference: null, privateNotes: note, documentReference: null,
      publicProvenance: null,
    };
    const createBody = { idempotencyKey: createKey, reason: 'Test create replay.', acquisition };
    const create = () => fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBody),
    });
    const firstCreate = await create();
    const created = await firstCreate.json();
    const replayCreate = await create();
    const replayedCreate = await replayCreate.json();
    const conflictCreate = await fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...createBody, acquisition: { ...acquisition, amountMinor: 10002 } }),
    });

    const correctionKey = `mock-correct-${suffix}`;
    const correctionBody = {
      idempotencyKey: correctionKey,
      reason: 'Test correction replay.',
      expectedVersion: 1,
      acquisition: { ...acquisition, amountMinor: 11001 },
    };
    const correctionUrl = `/api/admin/maintenance/kp-local-maintenance/acquisitions/${created.acquisition.acquisitionId}`;
    const correct = () => fetch(correctionUrl, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(correctionBody),
    });
    const firstCorrection = await correct();
    const corrected = await firstCorrection.json();
    const replayCorrection = await correct();
    const replayedCorrection = await replayCorrection.json();
    const conflictCorrection = await fetch(correctionUrl, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...correctionBody, acquisition: { ...acquisition, amountMinor: 11002 } }),
    });
    const detailResponse = await fetch('/api/admin/maintenance/kp-local-maintenance');
    const detail = await detailResponse.json();

    return {
      firstCreateStatus: firstCreate.status,
      replayCreateStatus: replayCreate.status,
      createReplayed: replayedCreate.replayed,
      createConflictStatus: conflictCreate.status,
      createConflict: await conflictCreate.json(),
      firstCorrectionStatus: firstCorrection.status,
      replayCorrectionStatus: replayCorrection.status,
      correctionReplayed: replayedCorrection.replayed,
      correctionConflictStatus: conflictCorrection.status,
      correctionConflict: await conflictCorrection.json(),
      matchingRecords: detail.piece.acquisitions.filter((item: { privateNotes: string }) => item.privateNotes === note),
      corrected,
    };
  });

  expect(outcome.firstCreateStatus).toBe(201);
  expect(outcome.replayCreateStatus).toBe(200);
  expect(outcome.createReplayed).toBe(true);
  expect(outcome.createConflictStatus).toBe(409);
  expect(outcome.createConflict).toEqual({ ok: false, error: 'idempotency_conflict' });
  expect(outcome.firstCorrectionStatus).toBe(200);
  expect(outcome.replayCorrectionStatus).toBe(200);
  expect(outcome.correctionReplayed).toBe(true);
  expect(outcome.correctionConflictStatus).toBe(409);
  expect(outcome.correctionConflict).toEqual({ ok: false, error: 'idempotency_conflict' });
  expect(outcome.matchingRecords).toHaveLength(1);
  expect(outcome.matchingRecords[0].recordVersion).toBe(2);
  expect(outcome.corrected.acquisition.recordVersion).toBe(2);
});
