import { expect, test } from './fixtures';

const sale = {
  saleId: 'cs_resume_1', sku: 'UL-7', pieceId: 'UL-7', editionNumber: 2,
  buyerEmail: 'collector@example.com', buyerName: 'Collector',
  saleDate: '2026-09-22T00:00:00.000Z', priceCents: 120000, currency: 'USD',
  status: 'pending', receivedAt: 1, confirmedAt: null, dismissedReason: null,
};

test('a confirmed sale resumes its canonical registration status after reload', async ({ page }) => {
  let confirmed = false;
  let canonicalRegistered = false;
  let failNextReplay = false;
  const replays: Array<{ pieceId: string; editionNumber: number }> = [];

  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/atlas-sales', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true,
      pending: confirmed ? [] : [sale],
      resolved: confirmed ? [{ ...sale, status: 'confirmed', confirmedAt: 2 }] : [],
    }),
  }));
  await page.route('**/api/admin/atlas-sales/cs_resume_1', async route => {
    const input = await route.request().postDataJSON();
    expect(input).toEqual({ pieceId: 'UL-7', editionNumber: 2 });
    if (confirmed) replays.push(input);
    confirmed = true;
    if (failNextReplay) {
      failNextReplay = false;
      await route.fulfill({
        status: 503, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'registration_check_unavailable' }),
      });
      return;
    }
    await route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, saleId: sale.saleId, pieceId: 'UL-7', editionNumber: 2,
        keeperPieceId: canonicalRegistered ? 'kp-ul-7-2' : null,
        registrationStatus: canonicalRegistered ? 'registered' : 'pending',
        ...(canonicalRegistered ? { publicCode: 'AR-7KQ9M2WX' } : {}),
      }),
    });
  });

  await page.goto('/admin/atlas-sales');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(1);

  failNextReplay = true;
  await page.reload();
  await expect(page.getByText('Canonical registration status could not be checked.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(1);
  await expect(page.getByText(/UL-7.*edition 2/)).toBeVisible();
  await expect.poll(() => replays.length).toBe(2);

  canonicalRegistered = true;
  await page.reload();
  await expect(page.getByText('Linked to canonical identity AR-7KQ9M2WX.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Linked to canonical identity AR-7KQ9M2WX.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(0);
  expect(replays).toHaveLength(4);
});

test('resolved registration checks fail closed and never replay dismissed or incomplete rows', async ({ page }) => {
  const postIds: string[] = [];
  let exact = false;
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/atlas-sales', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true, pending: [], resolved: [
        { ...sale, status: 'confirmed', confirmedAt: 2 },
        { ...sale, saleId: 'cs_dismissed', status: 'dismissed', confirmedAt: null },
        { ...sale, saleId: 'cs_incomplete', status: 'confirmed', editionNumber: null, confirmedAt: 2 },
      ],
    }),
  }));
  await page.route('**/api/admin/atlas-sales/*', async route => {
    postIds.push(new URL(route.request().url()).pathname.split('/').pop() || '');
    await route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, saleId: sale.saleId,
        pieceId: exact ? 'UL-7' : 'UL-WRONG', editionNumber: 2,
        keeperPieceId: null, registrationStatus: 'pending',
      }),
    });
  });

  await page.goto('/admin/atlas-sales');
  await expect(page.getByText('Canonical registration status could not be checked.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(0);
  expect(postIds).toEqual(['cs_resume_1']);

  exact = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(1);
  expect(postIds).toEqual(['cs_resume_1', 'cs_resume_1']);
});

test('load more retains its page on failure and exposes older registration work once', async ({ page }) => {
  let loadAttempts = 0;
  const cursors: string[] = [];
  const posts: string[] = [];
  const dismissed = Array.from({ length: 10 }, (_, index) => ({
    ...sale, saleId: `cs_recent_${index}`, status: 'dismissed',
    pieceId: `UL-${index}`, confirmedAt: 300 - index,
  }));
  const older = [
    { ...sale, saleId: 'cs_old_registered', status: 'confirmed', pieceId: 'UL-90', confirmedAt: 100 },
    { ...sale, saleId: 'cs_old_unregistered', status: 'confirmed', pieceId: 'UL-91', confirmedAt: 99 },
  ];
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('**/api/admin/atlas-sales?**', route => {
    loadAttempts += 1;
    cursors.push(new URL(route.request().url()).searchParams.get('cursor') || '');
    if (loadAttempts === 1) return route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'db_unavailable' }),
    });
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, pending: [], resolved: older,
        pagination: { resolved: { hasMore: false, nextCursor: null } },
      }),
    });
  });
  await page.route('/api/admin/atlas-sales', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true, pending: [], resolved: dismissed,
      pagination: { resolved: { hasMore: true, nextCursor: 'page-two' } },
    }),
  }));
  await page.route('**/api/admin/atlas-sales/*', route => {
    const saleId = new URL(route.request().url()).pathname.split('/').pop() || '';
    posts.push(saleId);
    const registered = saleId === 'cs_old_registered';
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, saleId, pieceId: registered ? 'UL-90' : 'UL-91', editionNumber: 2,
        keeperPieceId: registered ? 'kp-old' : null,
        registrationStatus: registered ? 'registered' : 'pending',
        ...(registered ? { publicCode: 'AR-8LR3N5XY' } : {}),
      }),
    });
  });

  await page.goto('/admin/atlas-sales');
  await expect(page.locator('.admin-atlas-sale-row-resolved')).toHaveCount(10);
  expect(loadAttempts).toBe(0);
  expect(posts).toEqual([]);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByText('More resolved sales could not be loaded.')).toBeVisible();
  await expect(page.locator('.admin-atlas-sale-row-resolved')).toHaveCount(10);
  await page.getByRole('button', { name: 'Try loading more again' }).click();
  await expect(page.locator('.admin-atlas-sale-row-resolved')).toHaveCount(12);
  await expect(page.getByText('Linked to canonical identity AR-8LR3N5XY.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Complete canonical registration' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Load more/ })).toHaveCount(0);
  expect(cursors).toEqual(['page-two', 'page-two']);
  expect(posts.sort()).toEqual(['cs_old_registered', 'cs_old_unregistered']);
});
