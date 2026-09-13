/**
 * The suite must never fetch from Cloudinary again (2026-09-02: ten hours of
 * hero video delivered in a day by test runs; the shared account then ran out
 * of free credits). tests/fixtures.ts answers every res.cloudinary.com
 * request locally; this proves the route is live on the page that costs the
 * most, the home page with its autoplaying hero video.
 */
import { test, expect } from './fixtures';

test('the home page asks Cloudinary for images and video, and every one is answered locally', async ({ page }) => {
  const sizes: number[] = [];
  page.on('response', async (r) => {
    if (/res\.cloudinary\.com/.test(r.url())) {
      try { sizes.push((await r.body()).length); } catch { sizes.push(-1); }
    }
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  expect(sizes.length, 'the home page renders artwork').toBeGreaterThan(0);
  /* 0 bytes is the video stub, 70 the image stub; a real delivery is kilobytes. */
  expect(sizes.every((n) => n >= 0 && n < 200), 'every response is the fixture stub').toBe(true);
});
