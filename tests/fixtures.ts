/**
 * The suite's `test`, with one standing rule: no spec ever reads metered
 * production media.
 *
 * Images and videos are delivered through the same-origin /media route. A fresh
 * browser context (which is every Playwright test) has no cache, so each test
 * that opens the home page pulls the hero video again, and each gallery page
 * its artwork. On 2026-09-02 the suite delivered ten hours of video in a day;
 * on 2026-09-12 the sister suite on mandalacodes delivered 70 GB of images,
 * and the shared Cloudinary account ran out of free credits.
 *
 * So every media request is answered, by the shared stub in
 * tests/shared/media-stub.ts, with a 1x1 transparent PNG (so `<img>` still fires `load` and naturalWidth is 1), and every video
 * request with an empty body, without either leaving the machine. Nothing in the
 * suite asserts on the pixels of the artwork itself.
 *
 * Specs import `test` and `expect` from here, never from '@playwright/test'
 * directly; that is what makes the rule impossible to forget.
 */
import { test as base } from '@playwright/test';
import { stubMeteredMedia } from './shared/media-stub.ts';

export * from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    if (testInfo.config.metadata.localOnly) {
      const origin = new URL(String(testInfo.project.use.baseURL)).origin;
      // Installed before the shared media stub, so even absolute media URLs
      // get the local image/video response. Other external traffic is blocked.
      await context.route('**/*', route =>
        new URL(route.request().url()).origin === origin
          ? route.fallback()
          : route.abort('blockedbyclient'),
      );
    }
    await stubMeteredMedia(context, /\/media\//);
    await use(context);
  },
});
