import { test, expect } from '@playwright/test';

/**
 * The gallery is where browsing actually happens, and it was the weakest page on the
 * site: 173 pieces rendered at once (22,590px, 183 lazy images), a sort control that
 * only appeared if you arrived with a ?category= param, an availability filter styled
 * as a caption, and no search at all.
 */

test('the archive is paged, not dumped', async ({ page }) => {
    await page.goto('/creations', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#piece-search');

    await expect(page.getByText(/Showing 48 of \d+/)).toBeVisible();

    const showMore = page.getByRole('button', { name: /Show \d+ more/ });
    await expect(showMore).toBeVisible();
    await showMore.click();
    await expect(page.getByText(/Showing 96 of \d+/)).toBeVisible();
});

test('sort is available without a category param', async ({ page }) => {
    // This is the regression that matters: sort used to render only under `filter`,
    // so the bare /creations URL had none.
    await page.goto('/creations', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#sort-select')).toBeVisible();
});

test('search narrows the archive and can be cleared', async ({ page }) => {
    await page.goto('/creations', { waitUntil: 'domcontentloaded' });
    const search = page.locator('#piece-search');
    await search.waitFor();

    const tiles = page.locator('.columns-2 > div');
    const before = await tiles.count();
    expect(before).toBeGreaterThan(10);

    await search.fill('communion');
    await expect(async () => {
        expect(await tiles.count()).toBeLessThan(before);
    }).toPass({ timeout: 5000 });
    expect(await tiles.count()).toBeGreaterThan(0);

    // Every term must match, so a two-word query narrows rather than widens.
    await search.fill('zzzznope');
    await expect(page.getByText(/Nothing matches/)).toBeVisible();

    // Two controls clear the search — the × beside the field and the button in the
    // empty state. Both are correct and both are named for what they do, so the test
    // picks the one beside the field rather than renaming either.
    await page.getByRole('button', { name: 'Clear search' }).first().click();
    await expect(async () => {
        expect(await tiles.count()).toBe(before);
    }).toPass({ timeout: 5000 });
});

test('the availability filter reads and behaves as a toggle', async ({ page }) => {
    await page.goto('/creations', { waitUntil: 'domcontentloaded' });
    const toggle = page.getByRole('button', { name: /Available/ }).first();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});
