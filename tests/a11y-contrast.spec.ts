import { test, expect, type Page } from './fixtures';

/**
 * WCAG AA text contrast across the public site, in both themes.
 *
 * This exists because the audit on 2026-09-01 found failures that nobody could see
 * by looking: "Sign in" at 1.68:1, the gallery tile's piece number at 1.52:1, and
 * four light-mode labels between 3.66 and 4.48. Light mode had five failures to dark
 * mode's one — it was simply the theme nobody swept. A number that low is invisible
 * to a sighted designer checking their own work on a good screen, which is exactly
 * why it needs a machine.
 *
 * Both themes are checked on every page. Toggling the `dark` class alone is not
 * enough — the header reads its colour from React state, so the theme must be set in
 * localStorage and the page reloaded, or the nav reports colours it is not using.
 */

const PAGES = [
    { path: '/', name: 'home' },
    { path: '/creations', name: 'creations' },
    { path: '/creations/amphibian-dream', name: 'piece' },
    { path: '/creations/multidimensional-art', name: 'category' },
    { path: '/about', name: 'about' },
    { path: '/inquire', name: 'inquire' },
    { path: '/writings', name: 'writings' },
];

interface Failure {
    text: string;
    ratio: number;
    required: number;
    fontPx: number;
    className: string;
}

/**
 * Elements whose backdrop is an image or a translucent scrim, where the computed
 * background of the nearest painted ancestor is not what the eye actually sees.
 * Measuring these produces false failures, so they are judged by eye, not here.
 */
const OVER_IMAGE = /hero|over-art|backdrop-blur/;

async function contrastFailures(page: Page): Promise<Failure[]> {
    return page.evaluate((overImageSource) => {
        const overImage = new RegExp(overImageSource);

        /**
         * Resolve any CSS colour — rgb(), oklab(), oklch(), colour keywords — to
         * concrete RGBA by painting it on a canvas and reading the pixel back.
         *
         * Parsing the string with a number regex is what an earlier version did, and
         * it silently mis-read Tailwind's oklab() backgrounds as RGB triples, which
         * reported the site header as 1.34:1 when it is actually about 13:1. Letting
         * the browser do the conversion is the only way to be sure.
         */
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const resolveCache = new Map<string, [number, number, number, number]>();
        const resolve = (colour: string): [number, number, number, number] => {
            const hit = resolveCache.get(colour);
            if (hit) return hit;
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = '#000';
            ctx.fillStyle = colour; // ignored if the browser cannot parse it
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
            const out: [number, number, number, number] = [r, g, b, a / 255];
            resolveCache.set(colour, out);
            return out;
        };

        /** Composite a translucent colour over an opaque one. */
        const over = (
            fg: [number, number, number, number],
            bg: [number, number, number, number],
        ): [number, number, number, number] => [
            fg[0] * fg[3] + bg[0] * (1 - fg[3]),
            fg[1] * fg[3] + bg[1] * (1 - fg[3]),
            fg[2] * fg[3] + bg[2] * (1 - fg[3]),
            1,
        ];

        const channel = (v: number) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const luminance = ([r, g, b]: [number, number, number, number]) =>
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

        /**
         * The colour actually behind an element: walk up compositing every translucent
         * layer until an opaque one is reached. Returns null if an ancestor paints an
         * image or gradient, since what the eye sees there cannot be computed.
         */
        const backdrop = (el: Element): [number, number, number, number] | null => {
            const layers: [number, number, number, number][] = [];
            let node: Element | null = el;
            while (node) {
                const cs = getComputedStyle(node);
                if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
                const layer = resolve(cs.backgroundColor);
                if (layer[3] > 0) {
                    layers.push(layer);
                    if (layer[3] >= 0.999) {
                        return layers.reduceRight((acc, l) => over(l, acc));
                    }
                }
                node = node.parentElement;
            }
            return null;
        };

        const ratio = (fg: string, bg: [number, number, number, number]) => {
            const text = over(resolve(fg), bg);
            const l1 = luminance(text);
            const l2 = luminance(bg);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };

        const out: Failure[] = [];
        const selector = 'a,button,p,span,h1,h2,h3,h4,h5,h6,li,label,small,td,th,figcaption';

        document.querySelectorAll(selector).forEach(el => {
            // Leaf nodes only — a parent's textContent includes its children's.
            if (el.children.length > 0) return;
            const text = el.textContent?.trim();
            if (!text) return;

            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') return;
            if (parseFloat(cs.opacity) < 0.9) return; // mid-reveal or deliberately faded

            const box = el.getBoundingClientRect();
            if (box.width < 2 || box.height < 2) return;

            const className = (el.className || '').toString();
            if (overImage.test(className)) return;

            // Decorative content hidden from assistive tech carries no information, so
            // WCAG does not hold it to a contrast ratio. The oversized watermark
            // ampersand between sections is the case this exempts.
            if (el.closest('[aria-hidden="true"]')) return;

            const bg = backdrop(el);
            if (!bg) return;

            const fontPx = parseFloat(cs.fontSize);
            const bold = parseInt(cs.fontWeight, 10) >= 700;
            // WCAG "large text": 24px, or 18.66px when bold.
            const required = fontPx >= 24 || (fontPx >= 18.66 && bold) ? 3 : 4.5;
            const measured = ratio(cs.color, bg);

            if (measured < required) {
                out.push({
                    text: text.slice(0, 40),
                    ratio: Math.round(measured * 100) / 100,
                    required,
                    fontPx: Math.round(fontPx),
                    className: className.slice(0, 80),
                });
            }
        });

        // One row per distinct (class, ratio) — 170 tiles sharing one bad class is one bug.
        const seen = new Set<string>();
        return out.filter(f => {
            const key = `${f.className}|${f.ratio}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, OVER_IMAGE.source);
}

async function setTheme(page: Page, dark: boolean) {
    await page.addInitScript(mode => {
        localStorage.setItem('dark-mode', mode);
    }, String(dark));
}

for (const theme of ['dark', 'light'] as const) {
    test.describe(`${theme} mode`, () => {
        for (const { path, name } of PAGES) {
            test(`${name} has no contrast failures`, async ({ page }) => {
                await setTheme(page, theme === 'dark');
                await page.goto(path, { waitUntil: 'domcontentloaded' });
                // networkidle never settles on the gallery — its images load lazily and
                // continuously. Wait for first paint of real content instead.
                await page.waitForSelector('#main-content *', { timeout: 15000 });
                // The header carries transition-all duration-500 and the theme resolves after
                // hydration, so colours are still interpolating for the first moment.
                await page.waitForTimeout(2500);

                const failures = await contrastFailures(page);

                expect(
                    failures,
                    failures.length
                        ? `\n${failures
                              .map(
                                  f =>
                                      `  ${f.ratio}:1 (needs ${f.required}) — "${f.text}" ` +
                                      `${f.fontPx}px — ${f.className}`,
                              )
                              .join('\n')}\n`
                        : undefined,
                ).toEqual([]);
            });
        }
    });
}

test('a skip link is the first thing a keyboard reaches', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    // The link ships in index.html and is sr-only until focused, so it is present
    // on prerendered pages too, before React has loaded.
    await expect(focused).toHaveClass(/sr-only/);
    await expect(focused).toBeVisible();
    // And it must point at something that exists.
    const href = await focused.getAttribute('href');
    expect(href).toBe('#main-content');
    await expect(page.locator('#main-content')).toHaveCount(1);
});

test('nothing is laid over the artwork in the gallery', async ({ page }) => {
    // House rule: no badges, no status pills, no hover labels on top of a piece.
    // Controls belong in the gutters. This caught a "View" pill on every tile.
    await page.goto('/creations', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('img', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const overlaid = await page.evaluate(() => {
        const offenders: string[] = [];
        document.querySelectorAll('img').forEach(img => {
            const frame = img.parentElement;
            if (!frame) return;
            const imgBox = img.getBoundingClientRect();
            if (imgBox.width < 80) return;
            frame.querySelectorAll('*').forEach(el => {
                if (el === img || el.contains(img)) return;
                if (!el.textContent?.trim()) return;
                const box = el.getBoundingClientRect();
                const overlaps =
                    box.left < imgBox.right - 4 &&
                    box.right > imgBox.left + 4 &&
                    box.top < imgBox.bottom - 4 &&
                    box.bottom > imgBox.top + 4;
                if (overlaps) offenders.push(`${el.tagName}: "${el.textContent.trim().slice(0, 30)}"`);
            });
        });
        return [...new Set(offenders)];
    });

    expect(overlaid, `Text laid over artwork:\n  ${overlaid.join('\n  ')}`).toEqual([]);
});
