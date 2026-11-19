import { expect, test, type Page } from './fixtures';

async function signIn(page: Page, signedIn: boolean) {
  await page.route('**/api/auth/get-session', route => route.fulfill({
    json: signedIn
      ? { user: { id: 'collector', email: 'fixture@example.test', emailVerified: true }, session: { id: 'session-1' } }
      : null,
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ json: {} }));
}

test('Art account profile preserves the signed-in handoff destination', async ({ page }) => {
  await signIn(page, true);
  await page.route('**/api/auth/handoff?next=%2Fprofile', route => route.fulfill({
    status: 302, headers: { location: 'https://mandalacodes.com/profile' },
  }));
  await page.route('https://mandalacodes.com/profile', route => route.fulfill({
    contentType: 'text/html', body: '<h1>Your Hologenetic Profile</h1>',
  }));
  await page.goto('/account');
  const link = page.getByRole('link', { name: 'Mandala profile', exact: true });
  await expect(link).toHaveAttribute('href', '/api/auth/handoff?next=%2Fprofile');
  await expect(page.getByRole('link', { name: /Hologenetic Profile/ })).toHaveAttribute('href', '/api/auth/handoff?next=%2Fprofile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ scale: 'css', path: `/tmp/studio-account-${test.info().project.name.replace(/ /g, '-')}.png`, fullPage: true });
  await link.click();
  await expect(page).toHaveURL('https://mandalacodes.com/profile');
});

test('a guest and the legacy profile route reach the Mandala profile directly', async ({ page }) => {
  await signIn(page, false);
  await page.route('https://mandalacodes.com/profile', route => route.fulfill({
    contentType: 'text/html', body: '<h1>Your Hologenetic Profile</h1>',
  }));
  await page.goto('/account');
  await page.getByRole('link', { name: 'Open your Mandala profile' }).click();
  await expect(page).toHaveURL('https://mandalacodes.com/profile');
  const legacy = new URL('/oracle/profile', String(test.info().project.use.baseURL));
  await page.goto(legacy.href);
  await expect(page).toHaveURL('https://mandalacodes.com/profile');
});

