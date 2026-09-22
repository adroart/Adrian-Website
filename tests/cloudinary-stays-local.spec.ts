/**
 * The suite must never read metered production media. tests/fixtures.ts answers every /media
 * request locally; this proves the route is live on the page that costs the
 * most, the home page with its autoplaying hero video.
 */
import { test, expect } from './fixtures';

test('the home page asks for images and video, and every one is answered locally', async ({ page }) => {
  const sizes: number[] = [];
  page.on('response', async (r) => {
    if (/\/media\//.test(r.url())) {
      try { sizes.push((await r.body()).length); } catch { sizes.push(-1); }
    }
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  expect(sizes.length, 'the home page renders artwork').toBeGreaterThan(0);
  /* 0 bytes is the video stub, 70 the image stub; a real delivery is kilobytes. */
  expect(sizes.every((n) => n >= 0 && n < 200), 'every response is the fixture stub').toBe(true);
});
