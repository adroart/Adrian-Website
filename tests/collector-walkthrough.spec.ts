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
 * Layered over the walk is the feedback rail — a verdict pair and a debounced
 * note per station (`notes.ts`, key `walkthrough-notes:v1`), the station
 * scrubber, the chapter strip, keyboard arrows, and the "Your notes" drawer
 * with its copy-the-digest exit — all covered here too.
 *
 * See `components/walkthrough/Walkthrough.tsx`, `NotesDrawer.tsx`, `notes.ts`,
 * `chapters.ts`, `stations.ts`, `ceremonyChapters.ts` and `CeremonyStation.tsx`
 * for the rail's own design; this spec never duplicates their wording, only
 * walks the real screens.
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

/** the notes store exactly as `notes.ts` keeps it */
const readNotesStore = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('walkthrough-notes:v1') ?? 'null'));

/** chapter id for chapter 1, as `chapters.ts`'s slug() derives it */
const CH1 = 'registering-it-all-the-way';

/* ------------------------------------------------------------------ *
 * 1. loads at chapter 1, station 1
 * ------------------------------------------------------------------ */

test('the walkthrough loads at /dev/walkthrough on chapter 1, station 1', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  // the title shows twice now: the compact chapter strip and the caption rail
  await expect(page.getByText('Registering it, all the way').first()).toBeVisible();
  await expect(station(page, 1, 14)).toBeVisible();
  await assertPhoneAlive(page);

  // the unclaimed foot carries its arrival line under Begin — and only that
  // one: the registered-not-yours line belongs to a different foot entirely
  await expect(page.getByText('This piece has no home yet. Begin gives it one.')).toBeVisible();
  await expect(page.getByText(/Someone already tends this piece/)).toHaveCount(0);

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

  // relationship really did flip: the unclaimed Begin and its arrival line are
  // gone, and the caretaker's foot carries no arrival line at all
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0);
  await expect(page.getByText('This piece has no home yet. Begin gives it one.')).toHaveCount(0);
  await expect(page.getByText(/Someone already tends this piece/)).toHaveCount(0);

  // the caretaker's light is a door: pressing the Orbit opens Add to your
  // piece, in place, without moving the rail
  await page.getByLabel('Add to your piece').click();
  await expect(page.getByRole('button', { name: 'See all of them', exact: true })).toBeVisible();
  await expect(st(14)).toBeVisible();
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 3. the ritual chapter: three rows now, none required
 * ------------------------------------------------------------------ */

test('the year turning opens on three ritual rows and walks to the household', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openChapter(page, 'The year turning');
  await expect(station(page, 1, 3)).toBeVisible();
  await assertPhoneAlive(page);

  // the three choices, a hairline-divided list, plus the quiet decline
  await expect(page.getByRole('button', { name: /^Reinforce the dream it holds/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Plant a new dream/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mark it fulfilled/ })).toBeVisible();
  await expect(page.getByText('Not this year')).toBeVisible();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await expect(station(page, 2, 3)).toBeVisible();
  await expect(page.getByText('The people you love').first()).toBeVisible();
  await assertPhoneAlive(page);

  await next.click();
  await expect(station(page, 3, 3)).toBeVisible();
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 4. every other collector chapter, via the rail's own Next control
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
  ['Inside the page', 9],
  ['The year turns', 3],
  ['The passing', 1],
  ['Asking someone on', 4],
  ['Signing in', 1],
];

test('every other collector chapter walks by Next with a live phone and no page errors', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');

  for (const [title, total] of OTHER_COLLECTOR_CHAPTERS) {
    // choosing a chapter closes the list, so reopen it for each one
    await page.getByRole('button', { name: /^Chapters/ }).click();
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(station(page, 1, total)).toBeVisible();
    await assertPhoneAlive(page);

    const next = page.getByRole('button', { name: 'Next', exact: true });
    for (let n = 2; n <= total; n++) {
      await expect(next).toBeEnabled();
      await next.click();
      await expect(station(page, n, total)).toBeVisible();
      await assertPhoneAlive(page);
    }

    // at a chapter's final station the control stops reading Next and starts
    // reading Next chapter — every chapter here has a chapter after it
    await expect(next).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next chapter', exact: true })).toBeVisible();
  }

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 5. the demo garden's write screen: the three-tier control
 * ------------------------------------------------------------------ */

test('the garden write screen holds three tiers, Keep reveals the heirs, Seal takes two presses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Adding to your piece');
  await expect(station(page, 1, 1)).toBeVisible();
  await assertPhoneAlive(page);

  // the piece asks -> the write screen
  await page.getByRole('button', { name: /^Write it/ }).click();

  // the three stacked choices, all present at once — never the old capsule
  const shine = page.getByRole('button', { name: /^Let it shine/ });
  const keep = page.getByRole('button', { name: /^Keep it with the piece/ });
  const seal = page.getByRole('button', { name: /^Seal it/ });
  await expect(shine).toBeVisible();
  await expect(keep).toBeVisible();
  await expect(seal).toBeVisible();

  // shine is the default, its state line under it, and no heirs' choice yet
  await expect(page.getByText('This will shine with the piece · words with no name.')).toBeVisible();
  const heirsOn = page.getByRole('button', { name: /The ones who come after may share this/ });
  const heirsOff = page.getByRole('button', { name: /This one goes no further than you/ });
  await expect(heirsOn).toHaveCount(0);

  // Keep reveals the heirs' sub-choice, on by default, and it toggles
  await keep.click();
  await expect(heirsOn).toBeVisible();
  await heirsOn.click();
  await expect(heirsOff).toBeVisible();
  await expect(heirsOn).toHaveCount(0);

  // Seal hides the heirs' choice entirely — the seal already answers it
  await seal.click();
  await expect(heirsOn).toHaveCount(0);
  await expect(heirsOff).toHaveCount(0);
  await expect(page.getByText('This stays yours alone · nobody sees it but you.')).toBeVisible();

  // sealing is a vow: the first press arms the grave confirm, nothing moves
  const place = page.getByRole('button', { name: 'Place it', exact: true });
  await place.click();
  await expect(page.getByText(/Sealing is a vow\. Press Place it once more/)).toBeVisible();
  await expect(place).toBeVisible();

  // the second press commits, landing back on the garden index
  await place.click();
  await expect(page.getByText('I saw it in the hallway of a house I was leaving…')).toBeVisible();
  await expect(place).toHaveCount(0);
  await expect(station(page, 1, 1)).toBeVisible();
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 6. the feedback rail: a verdict marks the scrubber, a note autosaves
 * ------------------------------------------------------------------ */

test('a verdict lights the scrubber dot and a note autosaves to localStorage and survives reload', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await expect(station(page, 1, 14)).toBeVisible();

  // the verdict pair under the phone: "right" persists instantly
  await page.getByRole('button', { name: 'right', exact: true }).click();

  // the scrubber's station-1 dot lights brass (espresso.palette.brass)
  const dot = page.locator('button[title="Nobody holds it"] span').nth(1);
  await expect(dot).toHaveCSS('background-color', 'rgb(212, 184, 138)');

  let store = await readNotesStore(page);
  expect(store?.[CH1]?.[0]?.verdict).toBe('right');
  expect(store?.[CH1]?.[0]?.label).toBe('Nobody holds it');

  // the note, saved through the field's own debounce: "Kept." is the signal
  await page.getByRole('button', { name: 'Leave a note', exact: true }).click();
  await page.locator('textarea').fill('The door reads honest.');
  await expect(page.getByText('Kept.', { exact: true })).toBeVisible();

  store = await readNotesStore(page);
  expect(store?.[CH1]?.[0]?.note).toBe('The door reads honest.');
  expect(store?.[CH1]?.[0]?.verdict).toBe('right');

  // reload: the note field reopens itself with the text, the entry counted
  await page.reload();
  await expect(station(page, 1, 14)).toBeVisible();
  await expect(page.locator('textarea')).toHaveValue('The door reads honest.');
  await expect(page.getByRole('button', { name: 'Your notes · 1', exact: true })).toBeVisible();

  store = await readNotesStore(page);
  expect(store?.[CH1]?.[0]?.note).toBe('The door reads honest.');
});

/* ------------------------------------------------------------------ *
 * 7. the notes drawer: the digest, copied whole
 * ------------------------------------------------------------------ */

test.describe('the notes drawer', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('lists the entry and Copy all notes puts the digest on the clipboard', async ({ page }) => {
    await page.goto('/dev/walkthrough');
    await expect(station(page, 1, 14)).toBeVisible();

    await page.getByRole('button', { name: 'right', exact: true }).click();
    await page.getByRole('button', { name: 'Leave a note', exact: true }).click();
    await page.locator('textarea').fill('The door reads honest.');
    await expect(page.getByText('Kept.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Your notes · 1', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Your notes' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('1 entry', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Station 1 · Nobody holds it')).toBeVisible();

    await drawer.getByRole('button', { name: 'Copy all notes', exact: true }).click();
    await expect(drawer.getByText('Copied. Paste it to Claude in the chat.')).toBeVisible();

    // the digest itself, read back off the clipboard the drawer wrote to
    const digest = await page.evaluate(() => navigator.clipboard.readText());
    expect(digest).toContain('# Walkthrough notes');
    expect(digest).toContain('## Registering it, all the way');
    expect(digest).toContain('- Station 1 · Nobody holds it · right');
    expect(digest).toContain('The door reads honest.');
  });
});

/* ------------------------------------------------------------------ *
 * 8. keyboard: arrows move a station, shifted arrows move a chapter
 * ------------------------------------------------------------------ */

test('ArrowRight advances a station and Shift+ArrowRight advances a chapter', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await expect(station(page, 1, 14)).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(station(page, 2, 14)).toBeVisible();
  await assertPhoneAlive(page);

  // station 2 is the code page, which focuses its own input on mount, and
  // the rail's keyboard handler deliberately stays silent while an input
  // holds focus — step out of the field before asking for the chapter jump
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByText('Giving it as a gift').first()).toBeVisible();
  await expect(station(page, 1, 14)).toBeVisible();
  await assertPhoneAlive(page);
});

/* ------------------------------------------------------------------ *
 * 9. at the final station, Next becomes Next chapter and leaves
 * ------------------------------------------------------------------ */

test('at a chapter\'s final station the control reads Next chapter and advances', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Selling it to a stranger');
  await expect(station(page, 1, 4)).toBeVisible();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  for (let n = 2; n <= 4; n++) {
    await next.click();
    await expect(station(page, n, 4)).toBeVisible();
  }

  await expect(next).toHaveCount(0);
  const nextChapter = page.getByRole('button', { name: 'Next chapter', exact: true });
  await expect(nextChapter).toBeVisible();
  await nextChapter.click();

  await expect(page.getByText('Accepting a piece passed to you').first()).toBeVisible();
  await expect(station(page, 1, 2)).toBeVisible();
  await assertPhoneAlive(page);
});

/* ------------------------------------------------------------------ *
 * 10. the two ceremony chapters
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
 * 11. localStorage progress survives a reload
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

  await expect(page.getByText('Selling it to a stranger').first()).toBeVisible();
  await expect(station(page, 3, 4)).toBeVisible();
  await assertPhoneAlive(page);
});
