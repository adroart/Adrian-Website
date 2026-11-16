import { expect, test } from './fixtures';

test('viewing chart uses the admin relay on desktop and phone', async ({ page }) => {
  const requests: Array<{ url: string; authorization: string | undefined; body: unknown }> = [];
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'synthetic-admin', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/viewings', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, viewings: [] }),
  }));
  await page.route('/api/admin/viewings/recommendation', route => {
    requests.push({
      url: route.request().url(),
      authorization: route.request().headers().authorization,
      body: route.request().postDataJSON(),
    });
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ clientName: 'Synthetic', pieces: [{
        gate: 1, sphere: "Life's Work", cardName: "Earth's Breath", keywords: ['start'],
      }] }),
    });
  });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/admin/viewings?mode=create');
    await expect(page.getByRole('heading', { name: 'Build a Viewing' })).toBeVisible();
    await expect(page.getByTitle('Recommendation engine base URL')).toHaveCount(0);
    await page.getByPlaceholder('gate').first().fill('1');
    await page.getByRole('button', { name: 'Compute the chart' }).click();
    await expect(page.getByText("Life's Work · No. 1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }

  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(new URL(request.url).pathname).toBe('/api/admin/viewings/recommendation');
    expect(request.authorization).toBeUndefined();
    expect(request.body).toEqual({ clientName: '', profile: { lifesWork: { gate: 1, line: 1 } } });
  }
});
