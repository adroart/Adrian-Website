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
