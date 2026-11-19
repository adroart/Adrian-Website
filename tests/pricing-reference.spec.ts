import { expect, test } from './fixtures';

test('starts at the suggestion and records deliberate actual price changes', async ({ page }) => {
  const savedQuote = {
    id: '1', name: 'Doorways Of The Unknown', quote: 3000, suggestedRetail: 3000,
    actualPrice: null as number | null, savedAt: '2026-11-16T00:00:00Z', inputs: {},
  };
  const savedPrices: Array<number | null> = [];
  await page.route('**/api/admin/verify', route => route.fulfill({
    json: { ok: true, admin: { id: 'admin-1', email: 'artist@example.test' } },
  }));
  await page.route('**/api/pricing/config', route => route.fulfill({ json: { ok: true, config: null } }));
  await page.route('**/api/pricing/quotes', route => route.fulfill({ json: { ok: true, quotes: [savedQuote] } }));
  await page.route('**/api/pricing/quotes/1', route => {
    const { actualPrice } = route.request().postDataJSON();
    savedPrices.push(actualPrice);
    savedQuote.actualPrice = actualPrice;
    return route.fulfill({ json: { ok: true, quote: savedQuote } });
  });

  await page.goto('/admin/pricing?quoteId=1');
  const actual = page.getByRole('spinbutton', { name: 'Actual price for Doorways Of The Unknown' });
  await expect(actual).toHaveValue('3000');
  await expect(page.getByText('Not recorded', { exact: true })).toBeVisible();
  await actual.focus();
  await actual.blur();
  expect(savedPrices).toEqual([]);

  await actual.press('ArrowUp');
  await expect(actual).toHaveValue('3001');
  await actual.press('ArrowDown');
  await expect(actual).toHaveValue('3000');
  await actual.press('ArrowDown');
  await expect(actual).toHaveValue('2999');
  await actual.blur();
  await expect.poll(() => savedPrices).toEqual([2999]);
  await expect(page.getByText('Not recorded', { exact: true })).toHaveCount(0);

  await actual.fill('');
  await actual.blur();
  await expect.poll(() => savedPrices).toEqual([2999, null]);
  await expect(actual).toHaveValue('3000');
  await actual.press('Enter');
  await expect.poll(() => savedPrices).toEqual([2999, null, 3000]);

  savedQuote.actualPrice = 2800.5;
  await page.reload();
  await expect(actual).toHaveValue('2800.5');
  await actual.press('ArrowUp');
  await expect(actual).toHaveValue('2801.5');
  await actual.press('ArrowDown');
  await expect(actual).toHaveValue('2800.5');
  await actual.fill('2800.75');
  await actual.press('ArrowUp');
  await expect(actual).toHaveValue('2801.75');
  await actual.press('ArrowDown');
  await expect(actual).toHaveValue('2800.75');
  await actual.fill('2800.5');
  await actual.blur();

  savedQuote.actualPrice = 0;
  await page.reload();
  await expect(actual).toHaveValue('0');
  expect(savedPrices).toEqual([2999, null, 3000]);
});

test('failed quote edits and deletion retain the reference and retry successfully', async ({ page }) => {
  const quote = { id: '1', name: 'Cabinet', quote: 3000, suggestedRetail: 3000, actualPrice: null as number | null, savedAt: '2026-11-19', inputs: {} };
  let patches = 0;
  let deletes = 0;
  await page.route('**/api/admin/verify', route => route.fulfill({ json: { ok: true, admin: { id: 'admin-1' } } }));
  await page.route('**/api/pricing/config', route => route.fulfill({ json: { ok: true, config: null } }));
  await page.route('**/api/pricing/quotes', route => route.fulfill({ json: { ok: true, quotes: [quote] } }));
  await page.route('**/api/pricing/quotes/1', route => {
    if (route.request().method() === 'DELETE') return route.fulfill(++deletes === 1
      ? { status: 503, json: { ok: false } } : { json: { ok: true } });
    if (++patches === 1) return route.fulfill({ status: 503, json: { ok: false } });
    quote.actualPrice = route.request().postDataJSON().actualPrice;
    return route.fulfill({ json: { ok: true, quote } });
  });
  await page.goto('/admin/pricing?quoteId=1');
  const actual = page.getByRole('spinbutton', { name: 'Actual price for Cabinet' });
  await actual.fill('2999');
  await actual.blur();
  await expect(page.getByRole('alert')).toContainText('not confirmed');
  await expect(actual).toHaveValue('2999');
  await expect(page.getByText('Not recorded', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect.poll(() => patches).toBe(2);
  await expect(page.getByText('Not recorded', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not confirmed');
  await expect(page.getByRole('heading', { name: 'Cabinet', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cabinet', exact: true })).toHaveCount(0);
});

test('a failed model save survives reload and only clears after Studio confirms it', async ({ page }) => {
  const { DEFAULT_CONFIG } = await import('../utils/pricing/config');
  const pending = { ...DEFAULT_CONFIG, marginPercent: 0.33 };
  let writes = 0;
  await page.addInitScript(config => {
    if (!sessionStorage.getItem('seeded-pricing')) {
      localStorage.setItem('pricing:pending-model', JSON.stringify(config));
      sessionStorage.setItem('seeded-pricing', 'yes');
    }
  }, pending);
  await page.route('**/api/admin/verify', route => route.fulfill({ json: { ok: true, admin: { id: 'admin-1' } } }));
  await page.route('**/api/pricing/quotes', route => route.fulfill({ json: { ok: true, quotes: [] } }));
  await page.route('**/api/pricing/config', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, config: null } });
    expect(route.request().postDataJSON().config.marginPercent).toBe(0.33);
    return route.fulfill(++writes === 1 ? { status: 503, json: { ok: false } } : { json: { ok: true, config: pending } });
  });
  await page.goto('/admin/pricing');
  await page.getByRole('button', { name: 'settings', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save model to Studio', exact: true });
  await save.click();
  await expect(page.getByRole('status')).toContainText('did not confirm');
  await page.reload();
  await page.getByRole('button', { name: 'settings', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('pending on this device');
  await save.click();
  await expect(page.getByRole('status')).toContainText('Using the model from Studio');
  expect(await page.evaluate(() => localStorage.getItem('pricing:pending-model'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/pricing-recovery-${test.info().project.name.replace(/ /g, '-')}.png`, fullPage: true });
});

test('a failed quote creation retries the retained draft without a false saved reference', async ({ page }) => {
  let dialogs = 0;
  const drafts: unknown[] = [];
  await page.route('**/api/admin/verify', route => route.fulfill({ json: { ok: true, admin: { id: 'admin-1' } } }));
  await page.route('**/api/pricing/config', route => route.fulfill({ json: { ok: true, config: null } }));
  await page.route('**/api/pricing/quotes', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, quotes: [] } });
    const draft = route.request().postDataJSON();
    drafts.push(draft);
    return route.fulfill(drafts.length === 1 ? { status: 503, json: { ok: false } }
      : { json: { ok: true, quote: { ...draft, id: '1', savedAt: '2026-11-19', actualPrice: null } } });
  });
  page.on('dialog', async dialog => { dialogs++; await dialog.accept('Retained draft'); });
  await page.goto('/admin/pricing');
  const save = page.getByRole('button', { name: 'Save this piece to reference', exact: true });
  await save.click();
  await expect(page.getByRole('alert')).toContainText('not confirmed');
  await expect(page.getByRole('button', { name: 'Reference', exact: true })).toBeVisible();
  await save.click();
  await expect(page.getByRole('status')).toContainText('Quote saved to Studio');
  expect(dialogs).toBe(1);
  expect(drafts).toHaveLength(2);
  expect(drafts[1]).toEqual(drafts[0]);
});
