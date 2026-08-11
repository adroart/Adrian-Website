import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe.configure({ mode: 'serial' });

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

test('admin artwork navigation exposes registration, invitations, certificates, and optional plates', async ({ page }) => {
  const registrationBodies: Array<Record<string, unknown>> = [];
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
  await page.route('/api/admin/registry-unlock', async route => route.fulfill({
    status: route.request().postDataJSON()?.secret === 'local-development-secret' ? 200 : 401,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route('/api/admin/registrations', async route => {
    registrationBodies.push(route.request().postDataJSON());
    const registrationNumber = registrationBodies.length;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        keeperPieceId: `kp-admin-registration-${registrationNumber}`,
        publicCode: registrationNumber === 1 ? 'AR-BCDEFGHJ' : 'AR-CDEFGHJK',
        ownershipCode: registrationNumber === 1 ? 'BCDE-FGHJ-KMNP-QRST' : 'CDEF-GHJK-MNPQ-RSTU',
        codeAccess: 'created',
        registrationStatus: 'registered',
        backupStatus: 'verified',
      }),
    });
  });
  await page.goto('/admin');
  const navigation = page.getByRole('navigation', { name: 'Admin navigation' });
  await expect(navigation.getByRole('link', { name: 'Artwork registration' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Collector invitations' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Certificate editor' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Optional plate wizard' })).toBeVisible();

  if ((page.viewportSize()?.width || 0) < 768) {
    await page.getByRole('button', { name: 'Menu' }).click();
  }
  await navigation.getByRole('link', { name: 'Artwork registration' }).click();
  await expect(page.getByRole('heading', { name: 'Artwork registration' })).toBeVisible();
  await expect(page.getByText(/physical plate is an optional later step/i)).toBeVisible();
  await page.getByLabel('Registry secret').fill('local-development-secret');
  await page.getByRole('button', { name: 'Unlock registry' }).click();
  const firstArtworkLabel = await page.getByRole('combobox', { name: 'Artwork' }).locator('option:checked').textContent();
  await page.getByLabel('Unique work').check();
  await page.getByRole('button', { name: 'Register artwork' }).click();
  await expect(page.getByRole('heading', { name: 'Artwork registered' })).toBeVisible();
  await expect(page.getByText(firstArtworkLabel || '', { exact: true })).toBeVisible();
  await expect(page.getByText('Unique work', { exact: true })).toBeVisible();
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open artwork' })).toHaveAttribute(
    'href',
    /\/admin\/artworks\/.+\?instance=kp-admin-registration-1$/,
  );
  await expect(page.getByRole('combobox', { name: 'Artwork' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Register artwork' })).toHaveCount(0);
  expect(registrationBodies[0]).toEqual({
    artworkId: expect.any(String),
    edition: { kind: 'unique' },
    idempotencyKey: expect.any(String),
  });
  await page.getByRole('button', { name: 'Dismiss Ownership Code' }).click();
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toHaveCount(0);
  await expect(page.getByText(/plate preparation remains optional/i)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Artwork' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Register artwork' })).toHaveCount(0);
  expect(registrationBodies).toHaveLength(1);

  await page.getByRole('button', { name: 'Register another artwork' }).click();
  const artworkSelect = page.getByRole('combobox', { name: 'Artwork' });
  await expect(artworkSelect).toBeVisible();
  await artworkSelect.selectOption({ index: 1 });
  const secondArtworkLabel = await artworkSelect.locator('option:checked').textContent();
  await page.getByLabel('Numbered edition').check();
  await page.getByRole('spinbutton', { name: 'Number', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Edition size, optional' }).fill('5');
  await page.getByRole('button', { name: 'Register artwork' }).click();

  await expect(page.getByText(secondArtworkLabel || '', { exact: true })).toBeVisible();
  await expect(page.getByText('Number 2 of 5', { exact: true })).toBeVisible();
  await expect(page.getByText('CDEF-GHJK-MNPQ-RSTU')).toBeVisible();
  expect(registrationBodies).toHaveLength(2);
  expect(registrationBodies[1]).toEqual({
    artworkId: expect.any(String),
    edition: { kind: 'numbered', number: 2, size: 5 },
    idempotencyKey: expect.any(String),
  });
  expect(registrationBodies[1].artworkId).not.toBe(registrationBodies[0].artworkId);
  expect(registrationBodies[1].idempotencyKey).not.toBe(registrationBodies[0].idempotencyKey);
});

test('artwork workspace keeps its header stable and renders exact relationships at desktop and 390px', async ({ page }) => {
  let releaseWorkspace: (() => void) | undefined;
  let requestedQuery: Record<string, string> | undefined;
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('**/api/admin/artwork-workspace**', async route => {
    const url = new URL(route.request().url());
    requestedQuery = Object.fromEntries(url.searchParams);
    await new Promise<void>(resolve => { releaseWorkspace = resolve; });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        workspace: {
          catalog: { artworkId: 'UL-100', title: 'Art of Living' },
          salesRecord: { artworkRecordId: 'record-1', state: 'identity_linked' },
          identity: { keeperPieceId: 'keeper-1', publicCode: 'AR-BCDEFGHJ', state: 'registered' },
          certificate: { state: 'complete', missingFields: [] },
          invitation: { state: 'redeemed', invitationId: 'invitation-1' },
          caretaker: { state: 'active' },
          plate: { state: 'legacy', recoveryState: 'not_required' },
          sale: { state: 'verified', verifiedSaleId: 'sale-1' },
          nextAction: {
            label: 'Review caretaker experience',
            href: '/admin/pieces?keeperPieceId=keeper-1',
            reason: 'The core artwork record is ready for experience review.',
          },
          activity: [{
            kind: 'caretaker_claimed',
            occurredAt: '2026-08-10T12:00:00.000Z',
            label: 'Caretaker claimed the artwork',
          }],
        },
      }),
    });
  });

  await page.goto('/admin/artworks/UL-100?instance=keeper-1&record=record-1');
  await expect(page.getByRole('heading', { name: 'Artwork UL-100' })).toBeVisible();
  await expect(page.getByText('Loading artwork workspace.')).toBeVisible();
  releaseWorkspace?.();

  await expect(page.getByRole('heading', { name: 'Art of Living' })).toBeVisible();
  expect(requestedQuery).toEqual({
    artworkId: 'UL-100', keeperPieceId: 'keeper-1', artistArtworkRecordId: 'record-1',
  });
  for (const title of [
    'Record and certificate', 'Verified sale and artwork ledger',
    'Invitation and caretaker state', 'Public piece preview',
    'Plate and recovery', 'Maintenance and custody history',
  ]) await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review caretaker experience' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Open sales record' })).toHaveAttribute(
    'href', '/admin/collector-sales?artistArtworkRecordId=record-1&keeperPieceId=keeper-1',
  );
  await expect(page.getByRole('link', { name: 'Open public piece preview' })).toHaveAttribute(
    'href', '/works/UL-100?instance=AR-BCDEFGHJ',
  );
  await expect(page.getByRole('link', { name: 'Open plate and recovery wizard' })).toHaveAttribute(
    'href', '/admin/pieces/wizard?keeperPieceId=keeper-1',
  );
  await expect(page.getByRole('link', { name: 'Open Maintenance' })).toHaveAttribute(
    'href', '/admin/maintenance?artworkId=UL-100&keeperPieceId=keeper-1',
  );
  await page.getByRole('link', { name: 'Review caretaker experience' }).focus();
  await expect(page.getByRole('link', { name: 'Review caretaker experience' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
});

test('artwork workspace focuses missing and conflicting exact identity states', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  let error = 'workspace_not_found';
  await page.route('**/api/admin/artwork-workspace**', route => route.fulfill({
    status: error === 'workspace_not_found' ? 404 : 409,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error }),
  }));

  await page.goto('/admin/artworks/MISSING-100');
  const missing = page.getByRole('heading', { name: 'Artwork workspace not found' });
  await expect(missing).toBeVisible();
  await expect.poll(() => missing.evaluate(node => node.parentElement?.parentElement === document.activeElement)).toBe(true);

  error = 'workspace_selector_conflict';
  await page.goto('/admin/artworks/UL-100?instance=wrong-instance&record=record-1');
  const conflict = page.getByRole('alert').filter({ hasText: /do not identify the same artwork/i });
  await expect(conflict).toBeVisible();
  await expect.poll(() => conflict.evaluate(node => node.parentElement === document.activeElement)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test('verified sales deep link opens the exact artwork record on a fresh load', async ({ page }) => {
  const now = '2026-08-10T12:00:00.000Z';
  const sale = {
    saleId: 'sale-target', reconnectionCaseId: null,
    occurrence: { precision: 'year', value: '2024' }, buyerEmail: null,
    total: null, privateReference: null, privateNotes: null,
    recordedAt: now, sequence: 0,
  };
  const item = {
    saleItemId: 'sale-item-target', artworkRecordId: 'record-target',
    artworkId: 'UL-100', edition: { kind: 'unique', number: null, size: null },
    keeperPieceId: 'keeper-target', identificationStatus: 'identity_linked',
    recordVersion: 1, price: null, priceEntries: [], ledgerEntries: [],
  };
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('**/api/admin/artwork-workspace**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      workspace: {
        catalog: { artworkId: 'UL-100', title: 'Art of Living' },
        salesRecord: { artworkRecordId: 'record-target', state: 'identity_linked' },
        identity: { keeperPieceId: 'keeper-target', publicCode: 'AR-BCDEFGHJ', state: 'registered' },
        certificate: { state: 'complete', missingFields: [] },
        invitation: null, caretaker: { state: 'unclaimed' },
        plate: { state: 'legacy', recoveryState: 'not_required' },
        sale: { state: 'verified', verifiedSaleId: 'sale-target' },
        nextAction: null, activity: [],
      },
    }),
  }));
  await page.route('**/api/admin/collector-sales**', route => {
    const url = new URL(route.request().url());
    const detail = url.pathname.endsWith('/sale-target');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(detail ? {
        ok: true, sale, originalSale: sale, effectiveSale: sale,
        corrections: [], items: [item], events: [],
      } : {
        ok: true, sales: [{ ...sale, identificationStatuses: ['identity_linked'] }],
        reconnectionCases: [],
        pagination: {
          limit: 25, offset: 0,
          sales: { hasMore: false, nextOffset: null },
          reconnectionCases: { hasMore: false, nextOffset: null },
        },
      }),
    });
  });
  await page.route('**/api/admin/collector-ledger**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      artworkRecord: {
        artworkRecordId: 'record-target', artworkId: 'UL-100',
        edition: { kind: 'unique', number: null, size: null },
        keeperPieceId: 'keeper-target', identificationStatus: 'identity_linked',
        recordVersion: 1, createdAt: now, updatedAt: now,
      },
      ledgerEntries: [], media: [], selectedCertificateImage: null, saleContext: null,
    }),
  }));
  await page.route('/api/admin/invitations', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invitations: [] }),
  }));

  await page.goto('/admin/collector-sales?artistArtworkRecordId=record-target&keeperPieceId=keeper-target');
  await expect(page.getByRole('heading', { name: 'Sale from 2024' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Artwork 1 actions' })).toContainText('Identity linked');
});

test('certificate deep link selects and loads the exact artwork on a fresh load', async ({ page }) => {
  let requestedArtworkId = '';
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/certificate-templates', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, templates: [] }),
  }));
  await page.route('**/api/admin/certificate-overrides**', route => {
    requestedArtworkId = new URL(route.request().url()).searchParams.get('artworkId') || '';
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        state: {
          artworkId: 'UL-100', assignment: null, overrides: {},
          effective: { materials: ['Wood'] },
        },
      }),
    });
  });

  await page.goto('/admin/certificates?artworkId=UL-100');
  await expect(page.getByRole('combobox', { name: 'Artwork' })).toHaveValue('UL-100');
  await expect(page.getByText(/"materials":/)).toBeVisible();
  expect(requestedArtworkId).toBe('UL-100');
});

test('invitation deep link prefills the exact physical identity on a fresh load', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/invitations', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invitations: [] }),
  }));

  await page.goto('/admin/invitations?keeperPieceId=keeper-target');
  await expect(page.getByLabel('Registered piece ID')).toHaveValue('keeper-target');
});

test('Maintenance deep link opens the exact physical record on a fresh load', async ({ page }) => {
  const detail = {
    id: 'keeper-target',
    public: {
      artworkId: 'UL-100', title: 'Deep linked artwork', series: 'Universal Language',
      editionNumber: 1, editionSize: 64, publicCode: 'AR-BCDEFGHJ', plateStatus: 'active',
    },
    physical: {
      registeredAt: '2026-08-01T00:00:00.000Z',
      plateGeneratedAt: '2026-08-02T00:00:00.000Z',
      plateActivatedAt: '2026-08-03T00:00:00.000Z', recordVersion: 1,
      recovery: { verifierPresent: true, envelopePresent: true, backupStatus: 'verified', backupAt: '2026-08-03T00:00:00.000Z' },
    },
    stewardVersion: 0, steward: null, acquisitions: [], creatorHistory: [], maintenanceHistory: [],
  };
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/registry-unlock', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, unlocked: false }),
  }));
  await page.route('**/api/admin/maintenance**', route => {
    const url = new URL(route.request().url());
    const isDetail = url.pathname.endsWith('/keeper-target');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(isDetail ? { ok: true, piece: detail } : {
        ok: true,
        pieces: [{
          id: 'keeper-target', artworkId: 'UL-100', title: 'Deep linked artwork',
          editionNumber: 1, publicCode: 'AR-BCDEFGHJ', plateStatus: 'active',
        }],
      }),
    });
  });

  await page.goto('/admin/maintenance?artworkId=UL-100&keeperPieceId=keeper-target');
  await expect(page.getByRole('heading', { name: 'Deep linked artwork' })).toBeVisible();
  await expect(page.getByLabel('Artwork ID')).toHaveValue('UL-100');
});

test('plate wizard deep link resumes the exact physical identity on a fresh load', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/registry-unlock', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, unlocked: true }),
  }));
  await page.route('/api/admin/artworks', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, artworks: [] }),
  }));
  await page.route('/api/admin/pieces', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      pieces: [{
        id: 'keeper-target', pieceId: 'UL-100', editionNumber: 1,
        publicCode: 'AR-BCDEFGHJ', plateStatus: 'generated', backupStatus: null,
        backupReference: null, backupSha256: null, frontSha256: null, undersideSha256: null,
        plateGeneratedAt: '2026-08-02T00:00:00.000Z', plateActivatedAt: null,
        backupAt: null, keeperBound: false, currentDisplayLocation: null,
        registeredAt: '2026-08-01T00:00:00.000Z', claimedAt: null, releasedAt: null,
        recoveryQualification: { status: 'missing', reasons: ['not verified'], qualifiedAt: null },
      }],
    }),
  }));

  await page.goto('/admin/pieces/wizard?keeperPieceId=keeper-target');
  await expect(page.getByRole('heading', { name: 'Encrypted backup' })).toBeVisible();
  await expect(page.getByText(/UL-100 · edition 1/)).toBeVisible();
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
  await expect(page.getByRole('link', { name: 'Open artwork' })).toHaveAttribute(
    'href', /\/admin\/artworks\/UL-100\?instance=kp-local-maintenance$/,
  );

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

test('legacy sale handoff cannot abandon a busy or ambiguous maintenance save', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The guarded retry interaction runs once.');
  const legacySale = {
    acquisitionId: 'acq-legacy-navigation', keeperPieceId: 'kp-legacy-navigation',
    acquisitionType: 'sale', acquiredAt: '2019-01-01', amountMinor: 300000,
    currency: 'USD', acquirerReference: null, privateNotes: null,
    documentReference: null, publicProvenance: null, recordVersion: 1,
    createdAt: '2019-01-01T00:00:00.000Z', updatedAt: '2019-01-01T00:00:00.000Z',
  };
  const detail = {
    id: 'kp-legacy-navigation',
    public: {
      artworkId: 'UL-100', title: 'Legacy navigation work', series: 'Universal Language',
      editionNumber: 1, editionSize: 64, publicCode: 'AR-LEGACY01', plateStatus: 'active',
    },
    physical: {
      registeredAt: null, plateGeneratedAt: null, plateActivatedAt: null, recordVersion: 1,
      recovery: { verifierPresent: false, envelopePresent: false, backupStatus: null, backupAt: null },
    },
    stewardVersion: 0, steward: null, acquisitions: [legacySale],
    creatorHistory: [], maintenanceHistory: [],
  };
  let releaseFirstSave: (() => void) | undefined;
  let saveAttempts = 0;
  await page.route('**/api/admin/maintenance/kp-legacy-navigation/acquisitions', async route => {
    saveAttempts += 1;
    if (saveAttempts === 1) {
      await new Promise<void>(resolve => { releaseFirstSave = resolve; });
      await route.abort('failed');
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({
        ok: true, replayed: true,
        acquisition: {
          acquisitionId: 'acq-custody-navigation', keeperPieceId: detail.id,
          ...body.acquisition, recordVersion: 1,
          createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z',
        },
      }),
    });
  });
  await page.route('**/api/admin/maintenance**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') return route.fallback();
    if (url.pathname === '/api/admin/maintenance') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, pieces: [{
          id: detail.id, artworkId: detail.public.artworkId, title: detail.public.title,
          editionNumber: detail.public.editionNumber, publicCode: detail.public.publicCode,
          plateStatus: detail.public.plateStatus,
        }] }),
      });
    }
    if (url.pathname === `/api/admin/maintenance/${detail.id}`) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, piece: detail }),
      });
    }
    return route.continue();
  });

  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: /Legacy navigation work/ }).click();
  const handoff = page.getByRole('link', { name: 'Open verified sales' });
  await page.getByRole('button', { name: 'Record acquisition', exact: true }).click();
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await page.getByLabel('Reason for this change').fill('Exercise guarded navigation.');
  await page.getByLabel('Registry secret').fill('local-development-secret');
  await page.getByRole('button', { name: 'Unlock registry' }).click();
  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible();
  await expect(handoff).toHaveAttribute('aria-disabled', 'true');
  await handoff.click({ force: true });
  await expect(page).toHaveURL(/\/admin\/maintenance$/);

  releaseFirstSave?.();
  await expect(page.getByText(/Retry the unchanged request before editing/)).toBeVisible();
  await handoff.click({ force: true });
  await expect(page).toHaveURL(/\/admin\/maintenance$/);

  await page.getByRole('button', { name: 'Confirm save' }).click();
  await expect(page.getByText('Acquisition recorded.', { exact: true })).toBeVisible();
  await handoff.click();
  await expect(page).toHaveURL(/\/admin\/collector-sales\?source=legacy_acquisition&acquisitionId=acq-legacy-navigation&artworkId=UL-100&keeperPieceId=kp-legacy-navigation$/);
});

test('reviews, unlocks, creates, and corrects a private acquisition', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mutation flow runs once against the shared development mock.');
  const privateNote = `Private browser-flow ${Date.now()}-${Math.random()}`;

  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Record acquisition', exact: true }).click();
  await page.getByLabel('Amount paid').fill('1250.00');
  await page.getByRole('combobox', { name: 'Currency' }).fill('USD');
  await page.getByLabel('Private notes').fill(privateNote);
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

  const createdDetail = await page.evaluate(async () => {
    const response = await fetch('/api/admin/maintenance/kp-local-maintenance');
    return response.json();
  });
  const created = createdDetail.piece.acquisitions.find((item: { privateNotes: string }) => item.privateNotes === privateNote);
  await page.getByRole('button', { name: `Correct acquisition ${created.acquisitionId}` }).click();
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
  const saved = detail.piece.acquisitions.find((item: { privateNotes: string }) => item.privateNotes === privateNote);
  expect(saved.amountMinor).toBe(130000);
  expect(saved.currency).toBe('USD');
});

test('preserves a correction draft when version-conflict detail reload fails', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mutation flow runs once against the shared development mock.');
  await page.goto('/admin/maintenance');
  const created = await page.evaluate(async () => {
    await fetch('/api/admin/registry-unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'local-development-secret' }),
    });
    const suffix = `${Date.now()}-${Math.random()}`;
    const response = await fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `conflict-reload-${suffix}`,
        reason: 'Create reload failure fixture.',
        acquisition: {
          acquisitionType: 'consignment', acquiredAt: null, amountMinor: 4200, currency: 'USD',
          acquirerReference: null, privateNotes: `Reload failure ${suffix}`,
          documentReference: null, publicProvenance: null,
        },
      }),
    });
    return (await response.json()).acquisition;
  });

  let failDetailReload = false;
  await page.route('**/api/admin/maintenance/kp-local-maintenance/acquisitions/*', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    failDetailReload = true;
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'version_conflict' }) });
  });
  await page.route('**/api/admin/maintenance/kp-local-maintenance', async route => {
    if (!failDetailReload) return route.continue();
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'maintenance_read_failed' }) });
  });

  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: `Correct acquisition ${created.acquisitionId}` }).click();
  await page.getByLabel('Amount paid').fill('43.00');
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await page.getByLabel('Reason for this change').fill('Exercise failed conflict reload.');
  await page.getByRole('button', { name: 'Confirm save' }).click();

  await expect(page.getByRole('heading', { name: 'Review acquisition change' })).toBeVisible();
  await expect(page.getByLabel('Reason for this change')).toHaveValue('Exercise failed conflict reload.');
  await expect(page.getByRole('alert').filter({ hasText: 'latest detail could not be reloaded' })).toBeVisible();
  await expect(page.getByText(/has been reloaded/)).toHaveCount(0);
});

test('treats a saved acquisition as definitive when its detail refresh fails', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mutation flow runs once against the shared development mock.');
  const privateNote = `Saved refresh failure ${Date.now()}-${Math.random()}`;
  let failDetailRefresh = false;
  let createRequests = 0;

  await page.route('**/api/admin/maintenance/kp-local-maintenance', async route => {
    if (!failDetailRefresh) return route.continue();
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'maintenance_detail_failed' }),
    });
  });
  await page.route('**/api/admin/maintenance/kp-local-maintenance/acquisitions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    createRequests += 1;
    const response = await route.fetch();
    failDetailRefresh = response.ok();
    return route.fulfill({ response });
  });

  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Record acquisition', exact: true }).click();
  await page.getByRole('combobox', { name: 'Currency' }).fill('USD');
  await page.getByLabel('Amount paid').fill('12.34');
  await page.getByLabel('Private notes').fill(privateNote);
  await page.getByRole('button', { name: 'Review acquisition' }).click();
  await page.getByLabel('Reason for this change').fill('Record a save whose detail refresh fails.');
  const secret = page.getByLabel('Registry secret');
  if (await secret.isVisible().catch(() => false)) {
    await secret.fill('local-development-secret');
    await page.getByRole('button', { name: 'Unlock registry' }).click();
  }
  await page.getByRole('button', { name: 'Confirm save' }).click();

  await expect(page.getByText(/Acquisition recorded\. It was saved, but the private detail could not be refreshed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm save' })).toHaveCount(0);
  expect(createRequests).toBe(1);
});

test('development registry unlock requires the exact local secret and exact body', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mock contract runs once against shared development state.');
  await page.goto('/admin/maintenance');
  const outcomes = await page.evaluate(async () => {
    const unlock = (body: unknown) => fetch('/api/admin/registry-unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const wrong = await unlock({ secret: 'not-the-secret' });
    const extra = await unlock({ secret: 'local-development-secret', extra: true });
    const exact = await unlock({ secret: 'local-development-secret' });
    return {
      wrong: [wrong.status, await wrong.json()],
      extra: [extra.status, await extra.json()],
      exact: [exact.status, await exact.json()],
    };
  });
  expect(outcomes.wrong).toEqual([401, { ok: false, error: 'unlock_failed' }]);
  expect(outcomes.extra).toEqual([400, { ok: false, error: 'invalid_input' }]);
  expect(outcomes.exact).toEqual([200, { ok: true, expiresIn: 600 }]);
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
      acquisitionType: 'consignment', acquiredAt: null, amountMinor: 10001, currency: 'USD',
      acquirerReference: null, privateNotes: note, documentReference: null,
      publicProvenance: null,
    };
    const invalidKey = await fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: ' ', reason: 'Reject empty key.', acquisition }),
    });
    const invalidReason = await fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: `invalid-reason-${suffix}`, reason: ' ', acquisition }),
    });
    const unknownField = await fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `unknown-field-${suffix}`, reason: 'Reject unknown acquisition field.',
        acquisition: { ...acquisition, unexpected: 'private' },
      }),
    });
    const missingCurrency = await fetch('/api/admin/maintenance/kp-local-maintenance/acquisitions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `missing-currency-${suffix}`, reason: 'Reject unpaired amount.',
        acquisition: { ...acquisition, currency: null },
      }),
    });
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
    const invalidVersion = await fetch(correctionUrl, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...correctionBody, idempotencyKey: `invalid-version-${suffix}`, expectedVersion: '1' }),
    });
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
      invalidKeyStatus: invalidKey.status,
      invalidKey: await invalidKey.json(),
      invalidReasonStatus: invalidReason.status,
      invalidReason: await invalidReason.json(),
      unknownFieldStatus: unknownField.status,
      unknownField: await unknownField.json(),
      missingCurrencyStatus: missingCurrency.status,
      missingCurrency: await missingCurrency.json(),
      invalidVersionStatus: invalidVersion.status,
      invalidVersion: await invalidVersion.json(),
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

  expect(outcome.invalidKeyStatus).toBe(400);
  expect(outcome.invalidKey).toEqual({ ok: false, error: 'invalid_idempotency_key' });
  expect(outcome.invalidReasonStatus).toBe(400);
  expect(outcome.invalidReason).toEqual({ ok: false, error: 'reason_required' });
  expect(outcome.unknownFieldStatus).toBe(400);
  expect(outcome.unknownField).toEqual({ ok: false, error: 'unknown_field' });
  expect(outcome.missingCurrencyStatus).toBe(400);
  expect(outcome.missingCurrency).toEqual({ ok: false, error: 'currency_required' });
  expect(outcome.invalidVersionStatus).toBe(400);
  expect(outcome.invalidVersion).toEqual({ ok: false, error: 'invalid_expected_version' });
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

test('reviews and saves governed steward transfer with exact visible consequences', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Steward mutation flow runs once against shared development state.');
  const targetEmail = 'verified-steward@example.test';
  const transferReason = `Transfer steward ${Date.now()}-${Math.random()}`;

  await page.goto('/admin/maintenance');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Transfer steward', exact: true }).click();
  await page.getByLabel('Verified account email').fill(targetEmail);
  await page.getByLabel('Transfer kind').selectOption('gift');
  await expect(page.getByText(/current display location clears/i)).toBeVisible();
  await page.getByRole('button', { name: 'Review transfer' }).click();
  await expect(page.getByRole('heading', { name: 'Review steward transfer' })).toBeVisible();
  const reviewColumns = page.locator('.maintenance-review-grid > div');
  await expect(reviewColumns.nth(0)).toContainText('keeper@example.test');
  await expect(reviewColumns.nth(0)).toContainText('Ubud studio');
  await expect(reviewColumns.nth(1)).toContainText(targetEmail);
  await expect(reviewColumns.nth(1)).toContainText('gift');
  await expect(reviewColumns.nth(1)).toContainText('Cleared');
  await expect(page.getByText(/permanent public lineage event/i)).toBeVisible();
  await page.getByLabel('Reason for this steward change').fill(transferReason);
  const secret = page.getByLabel('Registry secret');
  if (await secret.isVisible().catch(() => false)) {
    await secret.fill('local-development-secret');
    await page.getByRole('button', { name: 'Unlock registry' }).click();
  }
  await page.getByRole('button', { name: 'Confirm steward transfer' }).click();
  await expect(page.getByText(`Steward transfer saved for ${targetEmail}. The display location was cleared.`)).toBeVisible();
  await expect(page.getByText(targetEmail, { exact: true })).toBeVisible();

  const privacy = await page.evaluate(() => ({
    url: location.href,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(JSON.stringify(privacy)).not.toContain(targetEmail);
  expect(JSON.stringify(privacy)).not.toContain(transferReason);
});

test('replays one governed steward transfer after the committed response is lost', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Steward replay flow runs once against shared development state.');
  const reason = `Lost steward response ${Date.now()}-${Math.random()}`;
  const targetEmail = 'replay-steward@example.test';

  await page.goto('/admin/maintenance');
  await page.evaluate(async () => {
    await fetch('/api/admin/registry-unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'local-development-secret' }),
    });
  });

  const bodies: Array<Record<string, unknown>> = [];
  let loseResponse = true;
  await page.route('**/api/admin/maintenance/kp-local-maintenance/actions', async route => {
    bodies.push(route.request().postDataJSON());
    if (!loseResponse) return route.continue();
    loseResponse = false;
    await route.fetch();
    return route.abort('failed');
  });

  await page.reload();
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Transfer steward', exact: true }).click();
  await page.getByLabel('Verified account email').fill(targetEmail);
  await page.getByLabel('Transfer kind').selectOption('artist-rebind');
  await page.getByRole('button', { name: 'Review transfer' }).click();
  await page.getByLabel('Reason for this steward change').fill(reason);
  await page.getByRole('button', { name: 'Confirm steward transfer' }).click();
  await expect(page.getByText(/outcome could not be confirmed/i)).toBeVisible();
  await expect(page.getByLabel('Reason for this steward change')).toHaveValue(reason);
  await page.getByRole('button', { name: 'Confirm steward transfer' }).click();
  await expect(page.getByText(`Steward transfer saved for ${targetEmail}. The display location was cleared.`)).toBeVisible();

  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  const detail = await page.evaluate(async () => (
    await (await fetch('/api/admin/maintenance/kp-local-maintenance')).json()
  ));
  expect(detail.piece.maintenanceHistory.filter(
    (event: { reason: string }) => event.reason === reason,
  )).toHaveLength(1);
});

test('reviews plate replacement and keeps its one-time secret package only in memory', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Plate replacement package flow runs once.');
  const reason = `Replace wrong metal ${Date.now()}-${Math.random()}`;
  const disposition = 'Incorrect metal plate destroyed and photographed; it will not circulate.';
  const ownershipCode = 'AAAA-BBBB-CCCC-DDDD';
  const manifest = {
    schemaVersion: 1,
    publicCode: 'AR-REPLACE1',
    artworkId: 'UL-100',
    editionNumber: 0,
    publicUrl: 'https://adrianrasmussen.com/r/AR-REPLACE1',
    ownershipCode,
    frontSha256: 'a'.repeat(64),
    undersideSha256: 'b'.repeat(64),
    generatedAt: '2026-07-31T00:00:00.000Z',
  };
  const bodies: Array<Record<string, unknown>> = [];
  let loseResponse = true;
  await page.route('**/api/admin/maintenance/kp-local-maintenance/actions', async route => {
    const body = route.request().postDataJSON();
    if (body.action !== 'replace_plate') return route.continue();
    bodies.push(body);
    if (loseResponse) {
      loseResponse = false;
      return route.abort('failed');
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        replayed: true,
        eventId: 'rme-replacement-ui',
        replacement: {
          ok: true,
          ...manifest,
          frontSvg: '<svg>front</svg>',
          undersideSvg: '<svg>underside</svg>',
          manifest,
          backupStatus: 'verified',
        },
      }),
    });
  });

  await page.goto('/admin/maintenance');
  await page.evaluate(async () => {
    await fetch('/api/admin/registry-unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'local-development-secret' }),
    });
  });
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Replace physical plate', exact: true }).click();
  await page.getByLabel('Physical disposition').fill(disposition);
  await page.getByRole('button', { name: 'Review plate repair' }).click();
  await expect(page.getByRole('heading', { name: 'Review plate replacement' })).toBeVisible();
  await expect(page.getByText(/old public identity becomes superseded forever/i)).toBeVisible();
  await page.getByLabel('Reason for this plate repair').fill(reason);
  await page.getByRole('button', { name: 'Confirm replacement and mint new identity' }).click();

  await expect(page.getByText(/Retry the unchanged request before editing, cancelling, searching, or leaving this record/i)).toBeVisible();
  await expect(page.getByLabel('Reason for this plate repair')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add creator-history entry' })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm replacement and mint new identity' }).click();

  await expect(page.getByRole('heading', { name: 'Replacement identity AR-REPLACE1' })).toBeVisible();
  await expect(page.getByText(ownershipCode, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Download AR-REPLACE1-front\.svg/ })).toBeVisible();
  const clear = page.getByRole('button', { name: 'Clear one-time package from this screen' });
  await expect(clear).toBeDisabled();
  await page.getByLabel(/downloaded the front SVG/i).check();
  await expect(clear).toBeEnabled();

  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[0]).toEqual({
    action: 'replace_plate',
    physicalDisposition: disposition,
    reason,
    idempotencyKey: expect.any(String),
    expectedRecordVersion: 1,
  });
  const privacy = await page.evaluate(() => ({
    url: location.href,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(JSON.stringify(privacy)).not.toContain(ownershipCode);
  expect(JSON.stringify(privacy)).not.toContain(reason);
  expect(JSON.stringify(privacy)).not.toContain(disposition);

  await clear.click();
  await expect(page.getByRole('heading', { name: 'Replacement identity AR-REPLACE1' })).toHaveCount(0);
});

test('creates and removes public creator history through a reasoned private review', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Creator-history flow runs once.');
  const createReason = `Record intention ${Date.now()}-${Math.random()}`;
  const removeReason = `Remove intention ${Date.now()}-${Math.random()}`;
  const correctReason = `Correct intention ${Date.now()}-${Math.random()}`;
  const intention = 'Invite a slower reading of the layers.';
  const correctedIntention = 'Invite a slower, more attentive reading of the layers.';
  let currentEntries: Array<Record<string, unknown>> = [];
  const bodies: Array<Record<string, unknown>> = [];
  const loseOnce = new Set(['create', 'correct', 'remove']);

  await page.route('**/api/admin/maintenance/kp-local-maintenance', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    body.piece.creatorHistory = currentEntries;
    return route.fulfill({ response, body: JSON.stringify(body), contentType: 'application/json' });
  });
  await page.route('**/api/admin/maintenance/kp-local-maintenance/provenance', async route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    if (body.action === 'create') {
      currentEntries = [{
        provenanceId: 'prov-browser', keeperPieceId: 'kp-local-maintenance',
        ...body.entry, recordVersion: 1,
        createdAt: '2026-07-31T00:00:00.000Z', updatedAt: '2026-07-31T00:00:00.000Z',
      }];
    } else if (body.action === 'correct') {
      currentEntries = [{
        provenanceId: 'prov-browser', keeperPieceId: 'kp-local-maintenance',
        ...body.entry, recordVersion: 2,
        createdAt: '2026-07-31T00:00:00.000Z', updatedAt: '2026-07-31T00:30:00.000Z',
      }];
    } else {
      currentEntries = [];
    }
    if (loseOnce.delete(body.action)) return route.abort('failed');
    return route.fulfill({
      status: body.action === 'create' ? 201 : 200, contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        provenance: body.action === 'remove' ? {
          provenanceId: 'prov-browser', keeperPieceId: 'kp-local-maintenance',
          recordVersion: 3, removedAt: '2026-07-31T01:00:00.000Z',
        } : currentEntries[0],
      }),
    });
  });

  await page.goto('/admin/maintenance');
  await page.evaluate(async () => {
    await fetch('/api/admin/registry-unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'local-development-secret' }),
    });
  });
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await page.getByRole('button', { name: 'Add creator-history entry' }).click();
  await page.getByLabel('Entry type').selectOption('intention');
  await page.getByLabel('Visibility').selectOption('public');
  await page.getByLabel('Title or value').fill('Layered attention');
  await page.getByLabel('When').fill('2026-07');
  await page.getByLabel('Detail').fill(intention);
  await page.getByRole('button', { name: 'Review creator history' }).click();
  await expect(page.getByRole('heading', { name: 'Review creator-history entry' })).toBeVisible();
  await expect(page.locator('.maintenance-review-grid > div').nth(1)).toContainText('public');
  await page.getByLabel('Reason for this creator-history change').fill(createReason);
  await page.getByRole('button', { name: 'Confirm creator-history save' }).click();
  await expect(page.getByText(/Retry the unchanged request before editing, cancelling, searching, or leaving this record/i)).toBeVisible();
  await expect(page.getByLabel('Reason for this creator-history change')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Confirm creator-history save' }).click();
  await expect(page.getByText('Creator-history entry recorded.')).toBeVisible();
  await expect(page.getByText('Layered attention', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Correct creator history Layered attention' }).click();
  await page.getByLabel('Detail').fill(correctedIntention);
  await page.getByRole('button', { name: 'Review creator history' }).click();
  await page.getByLabel('Reason for this creator-history change').fill(correctReason);
  await page.getByRole('button', { name: 'Confirm creator-history save' }).click();
  await expect(page.getByText(/Retry the unchanged request before editing, cancelling, searching, or leaving this record/i)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm creator-history save' }).click();
  await expect(page.getByText('Creator-history correction saved.')).toBeVisible();
  await expect(page.getByText(correctedIntention, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Remove creator history Layered attention' }).click();
  await expect(page.getByRole('heading', { name: 'Review creator-history removal' })).toBeVisible();
  await expect(page.getByText(/prior values.*remain in append-only maintenance history/i)).toBeVisible();
  await page.getByLabel('Reason for this creator-history change').fill(removeReason);
  await page.getByRole('button', { name: 'Confirm removal from current view' }).click();
  await expect(page.getByText(/Retry the unchanged request before editing, cancelling, searching, or leaving this record/i)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm removal from current view' }).click();
  await expect(page.getByText(/entry removed from the current view/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No creator history recorded' })).toBeVisible();

  expect(bodies).toHaveLength(6);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[2]).toEqual(bodies[3]);
  expect(bodies[4]).toEqual(bodies[5]);
  expect(bodies[0]).toEqual({
    action: 'create',
    entry: {
      entryType: 'intention', title: 'Layered attention', detail: intention,
      role: null, occurredAt: '2026-07', visibility: 'public',
    },
    reason: createReason,
    idempotencyKey: expect.any(String),
  });
  expect(bodies[2]).toEqual({
    action: 'correct', provenanceId: 'prov-browser', expectedVersion: 1,
    entry: {
      entryType: 'intention', title: 'Layered attention', detail: correctedIntention,
      role: null, occurredAt: '2026-07', visibility: 'public',
    },
    reason: correctReason, idempotencyKey: expect.any(String),
  });
  expect(bodies[4]).toEqual({
    action: 'remove', provenanceId: 'prov-browser', expectedVersion: 2,
    reason: removeReason, idempotencyKey: expect.any(String),
  });
  const privacy = await page.evaluate(() => ({
    url: location.href,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(JSON.stringify(privacy)).not.toContain(intention);
  expect(JSON.stringify(privacy)).not.toContain(createReason);
  expect(JSON.stringify(privacy)).not.toContain(removeReason);
});

test('development steward mock validates verified targets, versions, and exact idempotent replay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Mock steward contract runs once against shared development state.');
  await page.goto('/admin/maintenance');
  const outcome = await page.evaluate(async () => {
    await fetch('/api/admin/registry-unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: 'local-development-secret' }),
    });
    const before = await (await fetch('/api/admin/maintenance/kp-local-maintenance')).json();
    const version = before.piece.steward?.stewardVersion
      ?? before.piece.maintenanceHistory.reduce(
        (highest: number, event: { after?: { stewardVersion?: number } }) =>
          Math.max(highest, Number(event.after?.stewardVersion || 0)),
        0,
      );
    const post = (body: unknown) => fetch('/api/admin/maintenance/kp-local-maintenance/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const suffix = `${Date.now()}-${Math.random()}`;
    const base = {
      action: 'transfer_steward', targetEmail: 'verified-steward@example.test',
      transferKind: 'sale',
      reason: 'Exercise exact steward replay.', idempotencyKey: `steward-mock-${suffix}`,
      expectedStewardVersion: version,
    };
    const extra = await post({ ...base, idempotencyKey: `extra-${suffix}`, unexpected: true });
    const unverified = await post({ ...base, idempotencyKey: `unverified-${suffix}`, targetEmail: 'unverified-steward@example.test' });
    const stale = await post({ ...base, idempotencyKey: `stale-${suffix}`, expectedStewardVersion: version + 1 });
    const first = await post(base);
    const firstBody = await first.json();
    const replay = await post(base);
    const replayBody = await replay.json();
    const conflict = await post({ ...base, reason: 'Different reuse.' });
    return {
      extra: [extra.status, await extra.json()],
      unverified: [unverified.status, await unverified.json()],
      stale: [stale.status, await stale.json()],
      first: [first.status, firstBody],
      replay: [replay.status, replayBody],
      conflict: [conflict.status, await conflict.json()],
    };
  });

  expect(outcome.extra).toEqual([400, { ok: false, error: 'invalid_input' }]);
  expect(outcome.unverified).toEqual([400, { ok: false, error: 'target_unverified' }]);
  expect(outcome.stale).toEqual([409, { ok: false, error: 'version_conflict' }]);
  expect(outcome.first[0]).toBe(200);
  expect(outcome.replay[0]).toBe(200);
  expect((outcome.replay[1] as { replayed: boolean }).replayed).toBe(true);
  expect((outcome.first[1] as { steward: unknown }).steward).toEqual((outcome.replay[1] as { steward: unknown }).steward);
  expect(outcome.conflict).toEqual([409, { ok: false, error: 'idempotency_conflict' }]);
});
