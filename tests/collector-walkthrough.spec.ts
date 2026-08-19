/**
 * The guided walkthrough rail (`/dev/walkthrough`, dev builds only), walked
 * through the real dev server rather than in isolation. It exercises the
 * exact integration this route enables that no earlier harness could: the
 * rail's phone frame is either the real `CollectorShell` (chrome="tour")
 * pointed at one real `View`, or the real `CeremonyStation` running one of
 * the two artist-ceremony demos, both now mounted inside the site's own
 * `BrowserRouter` for the first time (see the ceremony-chapter test below for
 * what that surfaces).
 *
 * See `components/walkthrough/Walkthrough.tsx`, `chapters.ts`, `stations.ts`,
 * `ceremonyChapters.ts` and `CeremonyStation.tsx` for the rail's own design;
 * this spec never duplicates their wording, only walks the real screens.
 */

import { expect, Page, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

/** the rail's own "Station N of M" line, matched exactly so a station never
 *  silently drifts to a neighbour */
const station = (page: Page, n: number, total: number) =>
  page.getByText(`Station ${n} of ${total}`, { exact: true });

/** the phone frame actually rendered something, and the app's top-level
 *  ErrorBoundary ("Something went wrong", index.tsx) never tripped. Works for
 *  both the collector shell and the ceremony screens: `.collector-root` is
 *  the shared outer class both `CollectorShell` and the two ceremony
 *  components render on their own root div. */
const assertPhoneAlive = async (page: Page) => {
  const root = page.locator('.collector-root').first();
  await expect(root).toBeVisible();
  const text = (await root.innerText()).trim();
  expect(text.length).toBeGreaterThan(3);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
};

const openChapter = async (page: Page, title: string) => {
  await page.getByRole('button', { name: /^Chapters/ }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
};

/* ------------------------------------------------------------------ *
 * 1. loads at chapter 1, station 1
 * ------------------------------------------------------------------ */

test('the walkthrough loads at /dev/walkthrough on chapter 1, station 1', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await expect(page.getByText('Registering it, all the way')).toBeVisible();
  await expect(station(page, 1, 14)).toBeVisible();
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 2. chapter 1, "Registering it, all the way", entirely by real clicks
 * ------------------------------------------------------------------ */

test('walks chapter 1 end to end by real clicks, the rail never desyncing', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const total = 14;
  const st = (n: number) => station(page, n, total);
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();

  await page.goto('/dev/walkthrough');
  await expect(st(1)).toBeVisible();
  await assertPhoneAlive(page);

  // the piece page, unclaimed: Begin -> the code page
  await click('Begin');
  await expect(st(2)).toBeVisible();
  await assertPhoneAlive(page);

  // sixteen ones, typed as real keystrokes -> the vault -> "the code is true"
  await page.getByLabel('The code').pressSequentially('1111111111111111', { delay: 15 });
  await expect(st(3)).toBeVisible({ timeout: 8000 });
  await assertPhoneAlive(page);

  // the threshold
  await click('Continue');
  await expect(st(4)).toBeVisible();
  await assertPhoneAlive(page);

  // the four: pull, grid, love (tap anywhere; the tap target is labelled Continue)
  await click('Continue');
  await expect(st(5)).toBeVisible();
  await assertPhoneAlive(page);

  await click('Continue');
  await expect(st(6)).toBeVisible();
  await assertPhoneAlive(page);

  await click('Continue');
  await expect(st(7)).toBeVisible();
  await assertPhoneAlive(page);

  // carries, the fourth of the four: its own Begin opens the gathering
  await click('Begin');
  await expect(st(8)).toBeVisible();
  await assertPhoneAlive(page);

  // the gathering, all five required-or-not screens, filled with sample values
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Create a password').fill('correcthorsebattery');
  await click('Sign');
  await expect(st(9)).toBeVisible();
  await assertPhoneAlive(page);

  await page.getByLabel('Date').fill('01/01/1990');
  await page.getByLabel('Time').fill('12:00');
  await page.getByLabel('Place of birth').fill('Portland, USA');
  await click('Continue');
  await expect(st(10)).toBeVisible();
  await assertPhoneAlive(page);

  await page.getByLabel('City').fill('Sonoma County');
  await click('Continue');
  await expect(st(11)).toBeVisible();
  await assertPhoneAlive(page);

  await page.getByLabel('Your website').fill('https://example.com');
  await click('Continue');
  await expect(st(12)).toBeVisible();
  await assertPhoneAlive(page);

  await click('Keep these choices');
  await expect(st(13)).toBeVisible();
  await assertPhoneAlive(page);

  // ignition -> the piece page again, now as its caretaker
  await click('Open its page');
  await expect(st(14)).toBeVisible();
  await assertPhoneAlive(page);

  // relationship really did flip: the unclaimed Begin is gone
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 3. every other collector chapter, via the rail's own Next control
 * ------------------------------------------------------------------ */

/** every FLOW and JUMP-leftover chapter besides "Registering it, all the
 *  way" (walked by real clicks above) and the two ceremony chapters (walked
 *  by real clicks below): title paired with its station count, both read
 *  straight off `components/walkthrough/chapters.ts` so this list cannot
 *  silently drift from the rail's own table of contents. */
const OTHER_COLLECTOR_CHAPTERS: [title: string, stations: number][] = [
  ['Giving it as a gift', 14],
  ['Receiving one that was a gift', 12],
  ['Passing it to someone you love', 4],
  ['Selling it to a stranger', 4],
  ['Accepting a piece passed to you', 2],
  ['Claiming one someone else holds', 2],
  ['Being asked onto a piece', 4],
  ['Inheriting it', 5],
  ['The year turning', 3],
  ['Adding to your piece', 1],
  ['Signing back in', 2],
  ['The door', 5],
  ['The threshold', 1],
  ['The gathering', 1],
  ['Inside the page', 8],
  ['The year turns', 2],
  ['Asking someone on', 3],
  ['Signing in', 1],
];

test('every other collector chapter walks by Next with a live phone and no page errors', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');

  for (const [title, total] of OTHER_COLLECTOR_CHAPTERS) {
    // choosing a chapter closes the list, so reopen it for each one
    await page.getByRole('button', { name: /^Chapters/ }).click();
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(station(page, 1, total)).toBeVisible();
    await assertPhoneAlive(page);

    const next = page.getByRole('button', { name: 'Next', exact: true });
    for (let n = 2; n <= total; n++) {
      await expect(next).toBeEnabled();
      await next.click();
      await expect(station(page, n, total)).toBeVisible();
      await assertPhoneAlive(page);
    }
    await expect(next).toBeDisabled();
  }

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 4. the two ceremony chapters
 *
 * CeremonyStation.tsx carries its own <MemoryRouter>, so the walkthrough
 * must never mount under the site's BrowserRouter (a Router cannot render
 * inside another Router). index.tsx therefore mounts /dev/walkthrough
 * standalone, outside BrowserRouter, in dev builds — the same shape the
 * standalone prototype build has always had.
 * ------------------------------------------------------------------ */

test('ceremony chapters walk by real clicks to a demo Ownership Code, and add-to-piece opens its screens', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/dev/walkthrough');
  await page.getByRole('button', { name: /^Chapters/ }).click();

  // ── the register ceremony ──────────────────────────────────────────
  await page.getByRole('button', { name: /register ceremony/i }).click();
  await expect(station(page, 1, 6)).toBeVisible();
  await assertPhoneAlive(page);

  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(station(page, 2, 6)).toBeVisible();

  await page.getByLabel('Search').fill('UL-100');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await expect(station(page, 3, 6)).toBeVisible();

  await page.getByRole('button', { name: 'Unique work', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(station(page, 4, 6)).toBeVisible();

  await page.getByLabel('Registry secret').fill('anyword');
  await page.getByRole('button', { name: /^Unlock/ }).click();
  await expect(station(page, 5, 6)).toBeVisible({ timeout: 8000 });

  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(station(page, 6, 6)).toBeVisible({ timeout: 8000 });

  // a demo AR- public code, and the once-only Ownership Code block
  await expect(page.getByText('AR-DEM45678')).toBeVisible();
  await expect(page.getByText('DEM2-3456-789C-DEFG')).toBeVisible();
  await expect(page.getByText(/shown this once and cannot be shown here again/)).toBeVisible();

  // ── adding to a piece ───────────────────────────────────────────────
  await page.getByRole('button', { name: /^Chapters/ }).click();
  await page.getByRole('button', { name: /Adding to your piece.*ceremony/i }).click();
  await expect(station(page, 1, 4)).toBeVisible();

  // the hub: one row per thing that can join the piece
  await expect(page.getByRole('button', { name: 'A photograph', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'The story', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Materials and makers/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A video', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A message for its caretaker', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'A photograph', exact: true }).click();
  await expect(station(page, 2, 4)).toBeVisible();
  // two Backs exist here: the frame's own (first in DOM, inside the phone)
  // and the rail's chapter-level Back beneath it. We want the frame's.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();

  // posting a story is the one real advance the task asks for here
  await page.getByRole('button', { name: 'The story', exact: true }).click();
  await expect(station(page, 3, 4)).toBeVisible();
  await page.locator('textarea').fill('Eleven months, one piece of claro walnut.');
  await page.getByRole('button', { name: 'Keep the story', exact: true }).click();
  await expect(page.getByText('The story is with the piece.')).toBeVisible();

  await page.getByRole('button', { name: 'A message for its caretaker', exact: true }).click();
  await expect(station(page, 4, 4)).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * 5. localStorage progress survives a reload
 * ------------------------------------------------------------------ */

test('reloading mid-walk restores the same chapter and station', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Selling it to a stranger');
  await expect(station(page, 1, 4)).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(station(page, 2, 4)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(station(page, 3, 4)).toBeVisible();

  await page.reload();

  await expect(page.getByText('Selling it to a stranger')).toBeVisible();
  await expect(station(page, 3, 4)).toBeVisible();
  await assertPhoneAlive(page);
});
