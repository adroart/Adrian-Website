/**
 * The guided walkthrough rail (`/dev/walkthrough`, dev builds only), walked
 * through the real dev server rather than in isolation. It exercises the
 * exact integration this route enables that no earlier harness could: the
 * rail's phone frame is either the real `CollectorShell` (chrome="tour")
 * pointed at one real `View`, the real `CeremonyStation` running one of the
 * four artist-ceremony demos, or the single self-contained arrival study,
 * all now mounted inside the site's own `BrowserRouter` for the first time
 * (see the ceremony-chapter tests below for what that surfaces).
 *
 * Layered over the walk is the feedback rail — a verdict pair and a debounced
 * note per station (`notes.ts`, key `walkthrough-notes:v1`), the station
 * scrubber, the chapter strip, keyboard arrows, and the "Your notes" drawer
 * with its copy-the-digest exit — all covered here too.
 *
 * Feedback Wave Two reshaped the walk: the four ceremony chapters now lead
 * as the 'making' section (chapter 1 is "The register ceremony"), the twelve
 * collector journeys follow as 'collecting' (still led by "Registering it,
 * all the way", with the single true arrival spliced right after it), the
 * gathering re-orders to sign → lives → who1 ("Who you are") → who2 ("Your
 * links") → light47, the passing gained a passconfirm readback, and a
 * back-nav bug in the history/dreams rooms is now fixed and regression
 * tested. See `components/walkthrough/Walkthrough.tsx`, `NotesDrawer.tsx`,
 * `notes.ts`, `chapters.ts`, `stations.ts`, `ceremonyChapters.ts`,
 * `CeremonyStation.tsx` and `ArrivalStation.tsx` for the rail's own design;
 * this spec never duplicates their wording, only walks the real screens.
 */

import { expect, Page, test } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

/** the rail's own "Station N of M" line, matched exactly so a station never
 *  silently drifts to a neighbour */
const station = (page: Page, n: number, total: number) =>
  page.getByText(`Station ${n} of ${total}`, { exact: true });

/** the phone frame actually rendered something, and the app's top-level
 *  ErrorBoundary ("Something went wrong", index.tsx) never tripped. Works for
 *  the collector shell, the ceremony screens and the arrival study alike:
 *  `.collector-root` is the shared outer class each of them renders on its
 *  own root div. */
const assertPhoneAlive = async (page: Page) => {
  const root = page.locator('.collector-root').first();
  await expect(root).toBeVisible();
  const text = (await root.innerText()).trim();
  expect(text.length).toBeGreaterThan(3);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
};

/**
 * The chapter list, scoped: at the 390px viewport this whole spec runs, the
 * list opens as a bottom sheet (`role="dialog" aria-label="Chapters"`) laid
 * OVER the phone rather than replacing it — the phone stays mounted (merely
 * inert) behind the sheet. Chapter 1 is a ceremony chapter now, and its own
 * threshold screen carries a foot link reading "A piece already in someone's
 * hands" — the exact words the held ceremony's own chapter-list row also
 * carries — so an unscoped page-wide search for that text can match both.
 * Scoping every chapter-list press to the dialog keeps it pointed at the
 * list itself, never whatever the still-mounted phone happens to say.
 */
const chaptersDialog = (page: Page) => page.getByRole('dialog', { name: 'Chapters' });

const openChapter = async (page: Page, title: string) => {
  await page.getByRole('button', { name: /^Chapters/ }).click();
  await chaptersDialog(page).getByRole('button', { name: title, exact: true }).click();
};

/**
 * A ceremony-kind chapter's row in the chapter list carries a second,
 * sibling "ceremony" span alongside its title, so the accessible name of the
 * row is the title plus that word — never an exact match against the title
 * alone. Opened by a case-insensitive substring instead, the same way the
 * existing ceremony test already did before this helper existed.
 */
const openCeremonyChapter = async (page: Page, titlePattern: RegExp) => {
  await page.getByRole('button', { name: /^Chapters/ }).click();
  await chaptersDialog(page).getByRole('button', { name: titlePattern }).click();
};

/** the notes store exactly as `notes.ts` keeps it */
const readNotesStore = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('walkthrough-notes:v1') ?? 'null'));

/** chapter id for "Registering it, all the way", as `chapters.ts`'s slug()
 *  derives it. It is no longer chapter 1 — the four ceremony chapters lead
 *  the whole walk now — so every test below reaches it with `openChapter`
 *  rather than relying on where the rail happens to load. */
const CH1 = 'registering-it-all-the-way';

/**
 * "Registering it, all the way"'s total, recomputed straight off the real
 * chain (`npx tsx` against `chapters.ts`, see the table comment on
 * `OTHER_COLLECTOR_CHAPTERS` below for how): piece, code, codetrue, the four
 * (pull/grid/love/carries), sign, lives, who1, who2, light47,
 * piece-as-caretaker — thirteen stations. Grew by one from the artist's
 * second walk: "who" no longer folds born's and links' fields onto one page
 * behind a SegmentedTabs pill — who1 ("Who you are") and who2 ("Your links")
 * are each their own station now.
 */
const CH1_TOTAL = 13;

/* ------------------------------------------------------------------ *
 * 1. loads at chapter 1, station 1 — now a ceremony chapter
 *
 * The four artist-ceremony chapters lead the whole walk as the 'making'
 * section (Adrian's own words: he never found them sitting unsignaled at the
 * tail of one long list). Chapter 1 is "The register ceremony", not
 * "Registering it, all the way" any more.
 * ------------------------------------------------------------------ */

test('the walkthrough loads at /dev/walkthrough on chapter 1, station 1: the register ceremony', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  // the title shows twice now: the compact chapter strip and the caption rail
  await expect(page.getByText('The register ceremony').first()).toBeVisible();
  await expect(station(page, 1, 6)).toBeVisible();
  await assertPhoneAlive(page);

  // the strip's own eyebrow names the 'making' section — the signal Adrian
  // was missing when the ceremony chapters sat unlabeled at the tail
  await expect(page.getByText('The making · how a piece and its codes are born').first()).toBeVisible();

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 2. the chapter list headers both sections
 * ------------------------------------------------------------------ */

test('the chapter list headers both sections of the walk', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await page.getByRole('button', { name: /^Chapters/ }).click();

  await expect(page.getByText('The making · how a piece and its codes are born').first()).toBeVisible();
  await expect(page.getByText("The collector's walk").first()).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * 3. "Registering it, all the way", entirely by real clicks — reached by
 *    title through the chapter list now, never assumed to be where the rail
 *    loads
 * ------------------------------------------------------------------ */

test('walks "Registering it, all the way" end to end by real clicks, the rail never desyncing', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const st = (n: number) => station(page, n, CH1_TOTAL);
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();

  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Registering it, all the way');
  await expect(st(1)).toBeVisible();
  await assertPhoneAlive(page);

  // the piece page, unclaimed: Begin -> the code page
  await click('Begin');
  await expect(st(2)).toBeVisible();
  await assertPhoneAlive(page);

  // sixteen ones, typed as real keystrokes. Adrian's ruling, 2026-08-20:
  // there is no more auto-fire on the sixteenth keystroke — once all sixteen
  // boxes read, the progress readout gives its slot to a brass Unlock press,
  // which alone fires the answer -> the vault -> "the code is true"
  await page.getByLabel('The code').pressSequentially('1111111111111111', { delay: 15 });
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(st(3)).toBeVisible({ timeout: 8000 });
  await assertPhoneAlive(page);

  // the code proved true: the built vault arrival plays (vaultArrival.tsx,
  // the single true arrival), settling on codetrue itself with its own
  // quiet fork question and Continue, un-stacked, bottom-right
  await expect(page.getByText('The code is true').first()).toBeVisible();
  await expect(
    page.getByText('Is this piece for someone else? Leave your message with it.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();

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

  // the gathering, re-ordered (§7, 2026-08-20): sign, required, one account
  // across everything, now with a repeat-password field
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Create a password').fill('correcthorsebattery');
  await page.getByLabel('Repeat the password').fill('correcthorsebattery');
  await click('Sign');
  await expect(st(9)).toBeVisible();
  await assertPhoneAlive(page);

  // where it lives, required: a light must live somewhere. The grain chips
  // (City / Area) are gone — city is the only grain now, always, and there
  // is no Area chip to choose.
  await expect(page.getByRole('button', { name: 'Area', exact: true })).toHaveCount(0);
  await page.getByLabel('City').fill('Sonoma County');
  await click('Continue');
  await expect(st(10)).toBeVisible();
  await assertPhoneAlive(page);

  // who splits into two stations now (the artist's second walk: "this
  // should be 2 pages"): who1 carries born's old fields, who2 carries
  // links' old field — no more SegmentedTabs pill holding both on one page
  await page.getByLabel('Date').fill('01/01/1990');
  await page.getByLabel('Time').fill('12:00');
  await page.getByLabel('Place of birth').fill('Portland, USA');
  await click('Continue');
  await expect(st(11)).toBeVisible();
  await assertPhoneAlive(page);

  await page.getByLabel('Your website').fill('https://example.com');
  await click('Continue');
  await expect(st(12)).toBeVisible();
  await assertPhoneAlive(page);

  // ignition -> the piece page again, now as its caretaker
  await click('Open its page');
  await expect(st(13)).toBeVisible();
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
  await expect(st(13)).toBeVisible();
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 4. the ritual chapter: three rows now, none required
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
 * 5. every other collector chapter, via the rail's own Next control
 * ------------------------------------------------------------------ */

/**
 * Every FLOW and JUMP-leftover chapter besides "Registering it, all the
 * way" and "The arrival" (walked by real clicks / their own dedicated tests
 * elsewhere in this file), the two register-surface ceremony chapters and
 * the plate chapter (walked by real clicks below, each needing its own real
 * button interaction the rail's own Next cannot drive), and "The year
 * turning" (its own test above): title paired with its station count.
 *
 * Recomputed straight off the rendered rail rather than guessed:
 *   npx tsx /path/to/dumpchapters.ts
 * where dumpchapters.ts is:
 *   import { CHAPTERS } from '/abs/path/to/components/walkthrough/chapters';
 *   for (const c of CHAPTERS) console.log(c.kind, c.id, c.title, c.stations.length);
 * (or simply open every chapter in the rail and read its own station count)
 * whenever `chapters.ts`, `ceremonyChapters.ts` or the flows/jump list in
 * `tourData.ts` change, so this table cannot silently drift from the rail's
 * own table of contents again.
 *
 * Feedback Wave Two's reshape moved several of these:
 *  - "Giving it as a gift" 12 -> 13 and "Receiving one that was a gift"
 *    10 -> 11: both chain through the gathering, which grew by the who1/who2
 *    split (see CH1_TOTAL above).
 *  - "Passing it to someone you love" 4 -> 5 and "Selling it to a stranger"
 *    4 -> 5: both chain through passready, which now opens a passconfirm
 *    readback before passdone rather than sending straight away.
 *  - "Inheriting it" 5 -> 4: the heir's three one-line rows became one
 *    station ("In his own words" / inheritread) that opens each writing in
 *    place, rather than three separate leaf stations.
 *  - "The gathering" 4 -> 1: born, links and shows are retired from the
 *    walk entirely (RETIRED_FROM_WALK in chapters.ts) now that the required
 *    path no longer visits them under those names, leaving only "What this
 *    is for" (the explainer sheet) as a leftover.
 * Every other entry below is unchanged from before the reshape.
 */
const OTHER_COLLECTOR_CHAPTERS: [title: string, stations: number][] = [
  ['Giving it as a gift', 13],
  ['Receiving one that was a gift', 11],
  ['Passing it to someone you love', 5],
  ['Selling it to a stranger', 5],
  ['Accepting a piece passed to you', 2],
  ['Claiming one someone else holds', 2],
  ['Being asked onto a piece', 4],
  ['Inheriting it', 4],
  ['Adding to your piece', 1],
  ['Signing back in', 2],
  ['The door', 5],
  ['The threshold', 1],
  ['The gathering', 1],
  ['Inside the page', 8],
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
    // the compact strip always carries the title as a substring of its own
    // "· title · N of M ·" line; some chapters' own first station happens to
    // repeat the title verbatim too (a coincidence of the underlying copy,
    // not a structural guarantee), so this is a substring match with
    // .first() rather than an exact one
    await expect(page.getByText(title).first()).toBeVisible();
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
    // reading Next chapter — every chapter here has a chapter after it,
    // except "Signing in", the very last chapter in the whole walk, where
    // there is nowhere further to go and the control stays "Next", disabled
    if (title === 'Signing in') {
      await expect(next).toBeVisible();
      await expect(next).toBeDisabled();
    } else {
      await expect(next).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Next chapter', exact: true })).toBeVisible();
    }
  }

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 6. the demo garden's write screen, through the review page (§7 "The lock
 *    line moves; the placing gets a review"): Place it on the write screen
 *    commits nothing any more, only carries the draft to "Read it back",
 *    where the words are read back whole and the one real press lives. The
 *    write screen's old two-press seal arm is gone, folded into this single
 *    review-page commit.
 * ------------------------------------------------------------------ */

test('the garden carries a write through the review page to a placed outcome, the seal path folded in', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Adding to your piece');
  await expect(station(page, 1, 1)).toBeVisible();
  await assertPhoneAlive(page);

  // the piece asks -> the write screen
  await page.getByRole('button', { name: /^Write it/ }).click();

  // the review page requires real words: the write screen's Place it is a
  // no-op on empty text, so the walk types something first
  const words = 'It sat on the shelf for a year before I could look at it straight.';
  // two textareas exist on every station now (the rail's always-open note
  // field is the other); the write screen's is the one without its placeholder
  const writeBox = page.locator('textarea:not([placeholder="A note on this station"])');
  await writeBox.fill(words);

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

  // Place it no longer commits: it hands the draft to the review page
  const place = page.getByRole('button', { name: 'Place it', exact: true });
  await place.click();
  await expect(page.getByText('Read it back')).toBeVisible();

  // the words, read back whole, and the tier restated as the seal's own vow
  // — tierSealBody and tierSealWriterNote stand as this page's warning,
  // exactly as the write screen's retired second press once asked
  await expect(page.getByText(words, { exact: true })).toBeVisible();
  await expect(page.getByText('Seal it', { exact: true })).toBeVisible();
  await expect(page.getByText(
    'Nobody opens it again. Not the next caretaker, not your family, not ever. The piece still holds it.',
  )).toBeVisible();
  await expect(page.getByText(
    'You can always open your own. You can let it shine one day. Once it shines, it stays.',
  )).toBeVisible();

  // Change it returns to the write screen with everything intact: the
  // words, and the seal tier still selected
  await page.getByRole('button', { name: 'Change it', exact: true }).click();
  await expect(writeBox).toHaveValue(words);
  await expect(page.getByText('This stays yours alone · nobody sees it but you.')).toBeVisible();

  // back to review, and the one press that actually places
  await place.click();
  await expect(page.getByText('Read it back')).toBeVisible();
  const commit = page.getByRole('button', { name: 'Place it, truly', exact: true });
  await expect(commit).toBeVisible();
  await commit.click();

  // lands back on the garden index, the piece's own table of contents
  await expect(page.getByText('I saw it in the hallway of a house I was leaving…')).toBeVisible();
  await expect(commit).toHaveCount(0);
  await expect(station(page, 1, 1)).toBeVisible();
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 7. history reading back-nav: regression test for the fixed bug
 *
 * §1's fix: two visually identical Backs used to sit on screen at once when
 * a written entry was open, and pressing the room's own conventional one
 * silently exited the whole room to the piece page rather than returning to
 * the history's own list. Now the room hands its Back up to the shell while
 * a reading is open — the shell suppresses RoomHead's own Back and the Close
 * brass and shows exactly one Back in their place, labelled "Back to the
 * history", which returns to the list.
 * ------------------------------------------------------------------ */

test('opening a written history entry leaves exactly one Back, and it returns to the list, not the piece page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Inside the page');
  await expect(station(page, 1, 8)).toBeVisible();
  await assertPhoneAlive(page);

  // station 2: the history
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(station(page, 2, 8)).toBeVisible();
  await expect(page.getByText('The history').first()).toBeVisible();

  // the list, both tabs present
  await expect(page.getByRole('button', { name: 'How it moved', exact: true })).toBeVisible();
  const writtenTab = page.getByRole('button', { name: 'What was written', exact: true });
  await expect(writtenTab).toBeVisible();
  await writtenTab.click();

  // open the one written entry that shines
  await page.getByRole('button', { name: /A dream was placed in it/ }).click();
  await expect(page.getByText('shining · words with no name', { exact: true })).toBeVisible();

  // exactly one Back inside the phone, and no Close brass — the room's own
  // conventional chrome is suppressed while the reading is open
  const root = page.locator('.collector-root').first();
  await expect(root.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  const back = root.getByRole('button', { name: /Back/ });
  await expect(back).toHaveCount(1);
  await expect(back).toHaveText('Back to the history');

  await back.click();

  // the LIST is visible again, not the piece page: both tabs are back
  await expect(page.getByRole('button', { name: 'How it moved', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'What was written', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0);
  await assertPhoneAlive(page);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 8. a dreams entry opens a reading view and returns, the same suppressed-
 *    chrome mechanic as the history above
 * ------------------------------------------------------------------ */

test('a dreams entry opens a reading view and Back returns to the dreams list', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Inside the page');
  await expect(station(page, 1, 8)).toBeVisible();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click(); // 2: the history
  await next.click(); // 3: the dreams
  await expect(station(page, 3, 8)).toBeVisible();
  await expect(page.getByText('The dreams').first()).toBeVisible();

  const opener = page.getByRole('button', { name: /That this house stays a place people arrive at unannounced/ });
  await expect(opener).toBeVisible();
  await opener.click();

  // the reading opened: its attribution line, in place of the list
  await expect(page.getByText('Sonoma County', { exact: true })).toBeVisible();

  const root = page.locator('.collector-root').first();
  await expect(root.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  const back = root.getByRole('button', { name: /Back/ });
  await expect(back).toHaveCount(1);
  await back.click();

  await expect(opener).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * 9. codetrue's un-stacked fork question and Continue is already exercised
 *    inside the chapter-1 walk (test 3 above); this covers the arrival
 *    chapter itself: the single true arrival, Replay present, and a verdict
 *    still persists exactly like any collector station
 * ------------------------------------------------------------------ */

test('the arrival chapter shows the one true arrival, Replay present, and a verdict persists', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openChapter(page, 'The arrival');
  await expect(station(page, 1, 1)).toBeVisible();
  await assertPhoneAlive(page);
  await expect(page.getByRole('button', { name: 'Replay', exact: true })).toBeVisible();

  // a verdict on the one station persists exactly like any collector station
  await page.getByRole('button', { name: 'right', exact: true }).click();
  const store = await readNotesStore(page);
  expect(store?.['arrival-choose']?.[0]?.verdict).toBe('right');

  // one station only: Next has already given way to Next chapter
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next chapter', exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 10. passname: Up / Down reorder the line, live
 * ------------------------------------------------------------------ */

test('passname\'s Up / Down controls reorder the line, the first row\'s note updating live', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Passing it to someone you love');
  await expect(station(page, 1, 5)).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(station(page, 2, 5)).toBeVisible();

  // Sara starts first in line
  await expect(page.getByText('wife · first in line', { exact: true })).toBeVisible();

  // press Down on the first row: Sara steps to second, Ines becomes first
  await page.getByRole('button', { name: 'Down', exact: true }).first().click();
  await expect(page.getByText('wife · first in line')).toHaveCount(0);
  await expect(page.getByText('daughter · first in line', { exact: true })).toBeVisible();
  await expect(page.getByText('wife · second', { exact: true })).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * 11. passready -> passconfirm: the artist's second walk asked "What if the
 *     wrong email is typed?" — a readback screen between the typed address
 *     and the send
 * ------------------------------------------------------------------ */

test('passready carries the typed email to passconfirm as a large readback with Send the passing', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Passing it to someone you love');
  await expect(station(page, 1, 5)).toBeVisible();

  await page.getByRole('button', { name: /^To someone you love/ }).click();
  await expect(station(page, 2, 5)).toBeVisible();

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(station(page, 3, 5)).toBeVisible();

  await page.getByLabel('their email').fill('successor@example.com');
  await page.getByRole('button', { name: 'Begin the passing', exact: true }).click();
  await expect(station(page, 4, 5)).toBeVisible();

  await expect(page.getByText('successor@example.com', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send the passing', exact: true })).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * 12. inheritread: a writing opens in place, and the let-it-shine control is
 *     arm-then-commit (press once to arm, again to commit)
 * ------------------------------------------------------------------ */

test('inheritread opens a writing in place, and the shine control needs two presses', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Inheriting it');
  await expect(station(page, 1, 4)).toBeVisible();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await expect(station(page, 2, 4)).toBeVisible();
  await next.click();
  await expect(station(page, 3, 4)).toBeVisible();
  await next.click();
  await expect(station(page, 4, 4)).toBeVisible();

  // the first kept writing, opened in place — the row's own title, not a
  // line from inside the writing (that only appears once it is open)
  await page.getByRole('button', { name: /I bought it the week your mother got well/ }).click();
  await expect(page.getByText('he never let this shine', { exact: false })).toBeVisible();

  const shine = page.getByRole('button', { name: 'Let it shine', exact: true });
  await expect(shine).toBeVisible();

  // press once: armed, not yet shining
  await shine.click();
  await expect(page.getByText('Once it shines, it stays. Press again and it shines.')).toBeVisible();
  await expect(page.getByText('shining', { exact: true })).toHaveCount(0);

  // press again: commits, and the control itself is gone (nothing to undo)
  await shine.click();
  await expect(page.getByText('shining', { exact: true }).first()).toBeVisible();
  await expect(shine).toHaveCount(0);
});

/* ------------------------------------------------------------------ *
 * 13. the feedback rail: a verdict marks the scrubber, a note autosaves
 *
 * The note field is ALWAYS open on every station (Adrian's ruling,
 * 2026-08-20): no "Leave a note" opener exists any more, in either shape of
 * the rail. At the 390px viewport this spec runs, the rail wears its narrow
 * shape — the verdict pair sits in the quiet row under Back/Next with the
 * note field directly beneath it, inline in the page. Reached through
 * "Registering it, all the way" by title, since it is no longer where the
 * rail loads by default.
 * ------------------------------------------------------------------ */

test('a verdict lights the scrubber dot and a note autosaves to localStorage and survives reload', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Registering it, all the way');
  await expect(station(page, 1, CH1_TOTAL)).toBeVisible();

  // the verdict pair, visible in the quiet row before any note is open:
  // "right" persists instantly
  await page.getByRole('button', { name: 'right', exact: true }).click();

  // the scrubber's station-1 dot lights brass (espresso.palette.brass)
  const dot = page.locator('button[title="Nobody holds it"] span').nth(1);
  await expect(dot).toHaveCSS('background-color', 'rgb(212, 184, 138)');

  let store = await readNotesStore(page);
  expect(store?.[CH1]?.[0]?.verdict).toBe('right');
  expect(store?.[CH1]?.[0]?.label).toBe('Nobody holds it');

  // the note field is simply there, no opener to press, saved through the
  // field's own debounce: "Kept." is the signal
  await page.getByPlaceholder('A note on this station').fill('The door reads honest.');
  await expect(page.getByText('Kept.', { exact: true })).toBeVisible();

  store = await readNotesStore(page);
  expect(store?.[CH1]?.[0]?.note).toBe('The door reads honest.');
  expect(store?.[CH1]?.[0]?.verdict).toBe('right');

  // reload: the field is open again (it always is) carrying the text, the
  // entry counted in the quiet row's notes opener, and progress restores
  // this same chapter and station rather than the rail's default landing
  await page.reload();
  await expect(page.getByText('Registering it, all the way').first()).toBeVisible();
  await expect(station(page, 1, CH1_TOTAL)).toBeVisible();
  await expect(page.getByPlaceholder('A note on this station')).toHaveValue('The door reads honest.');
  await expect(page.getByRole('button', { name: 'Your notes · 1', exact: true })).toBeVisible();

  store = await readNotesStore(page);
  expect(store?.[CH1]?.[0]?.note).toBe('The door reads honest.');
});

/* ------------------------------------------------------------------ *
 * 14. the notes drawer: the digest, copied whole
 * ------------------------------------------------------------------ */

test.describe('the notes drawer', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('lists the entry and Copy all notes puts the digest on the clipboard', async ({ page }) => {
    await page.goto('/dev/walkthrough');
    await openChapter(page, 'Registering it, all the way');
    await expect(station(page, 1, CH1_TOTAL)).toBeVisible();

    await page.getByRole('button', { name: 'right', exact: true }).click();
    await page.getByPlaceholder('A note on this station').fill('The door reads honest.');
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
 * 15. keyboard: arrows move a station, shifted arrows move a chapter
 *
 * "Registering it, all the way" is immediately followed by "The arrival"
 * now (the single true arrival is spliced in right after it, not tacked on
 * at the very end) — Shift+ArrowRight lands there, not on "Giving it as a
 * gift" as it did before the reshape.
 * ------------------------------------------------------------------ */

test('ArrowRight advances a station and Shift+ArrowRight advances a chapter', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Registering it, all the way');
  await expect(station(page, 1, CH1_TOTAL)).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(station(page, 2, CH1_TOTAL)).toBeVisible();
  await assertPhoneAlive(page);

  // station 2 is the code page, which focuses its own input on mount, and
  // the rail's keyboard handler deliberately stays silent while an input
  // holds focus — step out of the field before asking for the chapter jump
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByText('The arrival').first()).toBeVisible();
  await expect(station(page, 1, 1)).toBeVisible();
  await assertPhoneAlive(page);
});

/* ------------------------------------------------------------------ *
 * 16. at the final station, Next becomes Next chapter and leaves
 * ------------------------------------------------------------------ */

test('at a chapter\'s final station the control reads Next chapter and advances', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Selling it to a stranger');
  await expect(station(page, 1, 5)).toBeVisible();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  for (let n = 2; n <= 5; n++) {
    await next.click();
    await expect(station(page, n, 5)).toBeVisible();
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
 * 17. the register ceremony and adding to a piece
 *
 * CeremonyStation.tsx carries its own <MemoryRouter>, so the walkthrough
 * must never mount under the site's BrowserRouter (a Router cannot render
 * inside another Router). index.tsx therefore mounts /dev/walkthrough
 * standalone, outside BrowserRouter, in dev builds — the same shape the
 * standalone prototype build has always had.
 * ------------------------------------------------------------------ */

test('the register ceremony walks by real clicks to a demo Ownership Code, and add-to-piece opens its screens', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto('/dev/walkthrough');
  // the rail already loads on this chapter (chapter 1, station 1) now, but
  // the chapter list is exercised anyway so this test still proves the list
  // itself can reach it
  await page.getByRole('button', { name: /^Chapters/ }).click();

  // ── the register ceremony ──────────────────────────────────────────
  await chaptersDialog(page).getByRole('button', { name: /register ceremony/i }).click();
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
  await chaptersDialog(page).getByRole('button', { name: /Placing more into a piece/i }).click();
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
  // the frame's own story box, not the rail's always-open note field
  await page
    .locator('textarea:not([placeholder="A note on this station"])')
    .fill('Eleven months, one piece of claro walnut.');
  await page.getByRole('button', { name: 'Keep the story', exact: true }).click();
  await expect(page.getByText('The story is with the piece.')).toBeVisible();

  await page.getByRole('button', { name: 'A message for its caretaker', exact: true }).click();
  await expect(station(page, 4, 4)).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * 18. the held ceremony: "A piece already in someone's hands"
 *
 * The same RegisterCeremony component, reached from the threshold's own
 * foot link rather than its main Begin, held mode needing no URL param and
 * no extra prop. This chapter shares the register surface and mounts a
 * second, separate instance of the same screen (see ceremonyChapters.ts).
 * Its own copy of the browser-only fetch stub starts fresh with each new
 * page in this spec, so the registry unlock here always needs its own
 * secret typed in — nothing carries over from the ceremony test above.
 * ------------------------------------------------------------------ */

test('the held ceremony walks a piece already in someone’s hands to the invitation reference', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openCeremonyChapter(page, /A piece already in someone.s hands/i);
  await expect(station(page, 1, 6)).toBeVisible();
  await assertPhoneAlive(page);

  // the same threshold, entered by its other door
  await page.getByRole('button', { name: /A piece already in someone.s hands/i }).click();
  await expect(station(page, 2, 6)).toBeVisible();
  await assertPhoneAlive(page);

  await page.getByLabel('Search').fill('UL-100');
  await page.getByRole('button', { name: /Art of Living - 32/ }).click();
  await expect(station(page, 3, 6)).toBeVisible();

  await page.getByRole('button', { name: 'Unique work', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(station(page, 4, 6)).toBeVisible();

  await page.getByLabel('Registry secret').fill('anyword');
  await page.getByRole('button', { name: /^Unlock/ }).click();
  await expect(station(page, 5, 6)).toBeVisible({ timeout: 8000 });

  // the held entrance's one extra field: the holder's email, so the
  // invitation knows who it is for
  await page.getByLabel('The holder’s email').fill('holder@example.com');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(station(page, 6, 6)).toBeVisible({ timeout: 8000 });
  await assertPhoneAlive(page);

  // the invitation reference ledger line, present as soon as the ceremony
  // lands on done — before the ownership code is even dismissed
  await expect(page.getByText('Invitation reference')).toBeVisible();
  await expect(page.getByText('kp-demo-0001')).toBeVisible();

  // dismissing the ownership code reveals the invitation itself, carried by
  // the same "shown once" mechanic as the code before it
  await page.getByRole('button', { name: 'Dismiss it, I have saved it', exact: true }).click();
  await expect(page.getByText('demo-invitation-token-45678')).toBeVisible({ timeout: 8000 });

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 19. the plate chapter: the real generator's own SVG output
 *
 * A purpose-made three-station sequence, not the real AdminPlateWizard (see
 * CeremonyStation.tsx's own comment on why). It builds the REAL two plate
 * faces with utils/artworkPlate.ts from this walkthrough's own demo codes —
 * no fetch stub involved, since the plate is generated entirely client-side.
 * ------------------------------------------------------------------ */

test('the plate chapter renders the real front and underside SVGs from the demo codes', async ({ page }) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/dev/walkthrough');
  await openCeremonyChapter(page, /Preparing the plate/i);
  await expect(station(page, 1, 3)).toBeVisible();
  await assertPhoneAlive(page);

  // the front: the real generator's QR, built from the demo's own public
  // code, once the client-side build finishes
  await expect(page.getByText(/AR-DEM45678 · https:\/\//)).toBeVisible({ timeout: 8000 });
  await expect(page.locator('svg').first()).toBeVisible();

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(station(page, 2, 3)).toBeVisible();
  await assertPhoneAlive(page);

  // the underside: the same generator's other face, engraved with the
  // Ownership Code rather than the public one
  await expect(page.getByText(/Engraved where a stranger holding the piece never looks/)).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(station(page, 3, 3)).toBeVisible();
  await assertPhoneAlive(page);

  // what travels where: the two SVGs to the fabricator, the manifest stays.
  // Exact text: the station's own rail notice ("The two SVGs go to the
  // fabricator…") is a case-insensitive substring superset of the Ledger's
  // own label and would otherwise double-match.
  await expect(page.getByText('To the fabricator', { exact: true })).toBeVisible();
  await expect(page.getByText('Stays in the registry', { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 20. localStorage progress survives a reload
 * ------------------------------------------------------------------ */

test('reloading mid-walk restores the same chapter and station', async ({ page }) => {
  await page.goto('/dev/walkthrough');
  await openChapter(page, 'Selling it to a stranger');
  await expect(station(page, 1, 5)).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(station(page, 2, 5)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(station(page, 3, 5)).toBeVisible();

  await page.reload();

  await expect(page.getByText('Selling it to a stranger').first()).toBeVisible();
  await expect(station(page, 3, 5)).toBeVisible();
  await assertPhoneAlive(page);
});
