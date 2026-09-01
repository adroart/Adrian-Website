import { test, expect } from '@playwright/test';

/**
 * Scroll-reveal blocks start at opacity: 0, so the animation is not decoration on top
 * of visible content — it is what makes the content visible. Anything that stops it
 * firing leaves the page permanently blank in that region.
 *
 * The audit found the About page at 7,172px with ten text blocks sitting at opacity 0,
 * and the commission page with roughly 1,600px of void between its two cards and its
 * form. These tests cover both ways that can happen.
 */

const REVEAL_PAGES = ['/about', '/inquire', '/writings'];

for (const path of REVEAL_PAGES) {
    test(`${path}: reduced motion shows every reveal block immediately`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#main-content *');
        await page.waitForTimeout(1200);

        const hidden = await page.evaluate(() =>
            [...document.querySelectorAll('.reveal-block')]
                .filter(el => parseFloat(getComputedStyle(el).opacity) < 0.95)
                .map(el => (el.textContent || '').trim().slice(0, 50)),
        );

        expect(
            hidden,
            hidden.length ? `Still invisible with reduced motion:\n  ${hidden.join('\n  ')}` : undefined,
        ).toEqual([]);
    });

    test(`${path}: every reveal block becomes visible when scrolled`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#main-content *');

        // Walk the page the way a reader would, rather than jumping to the bottom —
        // a jump can skip past blocks without ever intersecting them.
        await page.evaluate(async () => {
            const step = window.innerHeight * 0.6;
            // Re-read the height every step. Revealing a block adds its content to the
            // layout, so the page grows as we go — a height sampled once at the top
            // stops short of the real bottom and leaves the last sections untouched.
            for (let y = 0, guard = 0; y < document.body.scrollHeight && guard < 200; y += step, guard++) {
                window.scrollTo(0, y);
                await new Promise(r => setTimeout(r, 120));
            }
            // Deliberately finish at the bottom rather than returning to the top.
            // The last section is the one most likely to be mid-transition, and
            // scrolling away from it first only adds a race to the measurement.
        });
        // The reveal transition is 850ms and carries staggered delays, so measuring
        // any sooner catches blocks mid-fade and reports them as never revealed.
        await page.waitForTimeout(2500);

        const hidden = await page.evaluate(() =>
            [...document.querySelectorAll('.reveal-block')]
                .filter(el => parseFloat(getComputedStyle(el).opacity) < 0.95)
                .map(el => (el.textContent || '').trim().slice(0, 50)),
        );

        expect(
            hidden,
            hidden.length ? `Never revealed after scrolling:\n  ${hidden.join('\n  ')}` : undefined,
        ).toEqual([]);
    });
}
