import { createHmac } from 'node:crypto';
import { createCaretakerPassing, acceptCaretakerPassing } from '../functions/api/_lib/caretakerPassing.js';
import { readPrivateLivingRecord, readPublicLivingRecord, writeLivingRecord } from '../functions/api/_lib/collectorLivingRecord.js';
import { expect, test, type Page } from './fixtures';
import { livingFixture, keeper, nextKeeper, author, now } from './shared/living-record-fixture';
import { stubMeteredMedia } from './shared/media-stub';
import { getCollectorPrivacy, listCollectorCuratedCities, updateCollectorPrivacy } from '../functions/api/_lib/collectorPrivacy.js';
import { onRequest as atlasRequest } from '../functions/api/atlas.js';

// Several independent authenticated page loads and real passing transactions run per test.
test.setTimeout(180_000);

const code = 'AR-7KQ9M2WX';
const path = `/works/UL-100?instance=${code}&ref=qr`;
const words = 'I remember the light on the wood.';
const story = 'The approved story from the registry.';
const identity = {
  artworkId: 'UL-100', title: 'Art of Living', series: 'Universal Language',
  edition: { kind: 'unique', number: null, size: null, label: 'Unique work' },
  publicCode: code, artistName: 'Adrian Rasmussen', plateStatus: 'registered',
  publicProvenance: [], creatorHistory: [],
};

async function enableLivingRecordFor(page: Page) {
  // The launch flag stays off in the repository. Serve the fixture override to
  // the app's first module load rather than racing React Router on each visit.
  await page.route(url => url.pathname === '/launchFlags.ts', async route => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(/\blivingLegacy:\s*false\b/, 'livingLegacy: true');
    expect(body).not.toBe(original);
    await route.fulfill({ response, body });
  });
}

test('reflection approval and deliberately shared places appear only in the expected living record', async ({
  browser, baseURL, viewport, hasTouch, isMobile, userAgent, deviceScaleFactor,
}) => {
  type Role = 'guest' | 'keeper' | 'contributor';
  let reflection: { id: string; body: string; visibility: 'private' | 'offered' | 'public' } | undefined;
  let publicationExports = 0;
  const publications: Array<{ id: string; year: number; grain: string; place: string; country: string }> = [];
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  async function open(role: Role): Promise<Page> {
    const context = await browser.newContext({ baseURL, viewport, hasTouch, isMobile, userAgent, deviceScaleFactor });
    contexts.push(context);
    const origin = new URL(String(baseURL)).origin;
    await context.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.fallback() : route.abort('blockedbyclient'));
    await stubMeteredMedia(context, /\/media\//);
    const page = await context.newPage();
    await enableLivingRecordFor(page);
    await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
    await page.route('**/api/auth/get-session', route => route.fulfill({
      json: role === 'guest' ? null : {
        user: { id: role, email: `${role}@example.test`, emailVerified: true }, session: { id: `session-${role}` },
      },
    }));
    await page.route('**/api/auth/sync-user', route => route.fulfill({ json: {} }));
    await page.route(`**/api/registry/${code}`, route => route.fulfill({ json: { ok: true, identity } }));
    await page.route('**/api/works/UL-100', route => route.fulfill({
      json: { ok: true, artwork: { id: identity.artworkId, description: story } },
    }));
    await page.route('**/api/keeper/piece?**', route => route.fulfill({
      json: { ok: true, kept: true, byYou: role === 'keeper', contributor: role === 'contributor' },
    }));
    await page.route('**/api/collector/record?**', route => {
      const view = new URL(route.request().url()).searchParams.get('view');
      const projected = reflection ? { ...reflection, createdAt: '2026-11-17' } : null;
      if (view === 'public') return route.fulfill({ json: {
        ok: true, milestones: publications, reflections: projected?.visibility === 'public' ? [projected] : [],
      } });
      expect(role).not.toBe('guest');
      if (view === 'private') {
        const canRead = role === 'contributor' || projected?.visibility === 'offered';
        return route.fulfill({ json: {
          ok: true, role, milestones: [],
          reflections: projected && canRead ? [{ ...projected, yours: role === 'contributor', active: true, successorAccess: false, canPublish: role === 'keeper' && projected.visibility === 'offered' }] : [],
        } });
      }
      if (view === 'places') return route.fulfill({ json: {
        ok: true, places: [{ id: 'city-directory-id', city: 'Denpasar', region: 'Bali', country: 'Indonesia' }],
      } });
      const input = route.request().postDataJSON();
      if (input.action === 'reflect') {
        expect(role).toBe('contributor');
        reflection = { id: input.id, body: input.body, visibility: 'private' };
      }
      if (input.action === 'offer' && reflection) {
        expect(role).toBe('contributor');
        reflection.visibility = 'offered';
      }
      if (input.action === 'publish' && reflection) {
        expect(role).toBe('keeper');
        reflection.visibility = 'public';
        publicationExports += 1;
        return route.fulfill({ json: { ok: true, recordRefresh: { status: publicationExports === 1 ? 'failed' : 'generated' } } });
      }
      if (input.action === 'milestone') {
        expect(role).toBe('keeper');
        expect(input).toMatchObject({ placeId: 'city-directory-id', grain: 'region', visibility: 'public' });
        expect(Object.keys(input).sort()).toEqual(['action', 'grain', 'id', 'placeId', 'visibility', 'year']);
        publications.push({ id: input.id, year: input.year, grain: input.grain, place: 'Bali', country: 'Indonesia' });
      }
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    return page;
  }

  try {
    const author = await open('contributor');
    await author.getByRole('button', { name: /^The history/ }).click();
    await author.getByRole('button', { name: 'What was written' }).click();
    await author.getByRole('button', { name: 'Write a reflection' }).click();
    await author.getByLabel('Your reflection').fill(words);
    await author.getByRole('button', { name: 'Keep my reflection' }).click();
    await expect(author.getByText(words)).toBeVisible();

    const guest = await open('guest');
    await guest.getByRole('button', { name: /^The story/ }).click();
    await expect(guest.getByText(story)).toBeVisible();
    await guest.getByRole('button', { name: 'Back', exact: true }).click();
    await guest.getByRole('button', { name: /^The history/ }).click();
    await guest.getByRole('button', { name: 'What was written' }).click();
    await expect(guest.getByText(words)).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Write a reflection' })).toHaveCount(0);
    await guest.close();

    await author.getByRole('button', { name: 'Offer to the caretaker' }).click();
    await author.getByRole('button', { name: 'Offer reflection' }).click();
    await expect(author.getByRole('button', { name: 'Withdraw offer' })).toBeVisible();

    const keeper = await open('keeper');
    await keeper.getByRole('button', { name: /^The history/ }).click();
    await keeper.getByRole('button', { name: 'What was written' }).click();
    await keeper.getByRole('button', { name: 'Review public sharing' }).click();
    await expect(keeper.getByText(words)).toBeVisible();
    await keeper.getByRole('button', { name: 'Share this reflection' }).click();
    await expect(keeper.getByRole('heading', { name: 'Reflection', exact: true })).toBeVisible();
    await expect(keeper.getByRole('status')).toContainText('Your entry is saved.');
    await keeper.getByRole('button', { name: 'Retry record export', exact: true }).click();
    await expect(keeper.getByRole('button', { name: 'Retry record export', exact: true })).toHaveCount(0);
    expect(publicationExports).toBe(2);
    await keeper.getByRole('button', { name: 'How it moved' }).click();
    await keeper.getByRole('button', { name: 'Add a place milestone' }).click();
    await keeper.getByLabel('Find a city or region').fill('Bali');
    await keeper.getByRole('button', { name: 'Find places' }).click();
    await keeper.getByLabel('Place', { exact: true }).selectOption('city-directory-id');
    await keeper.getByLabel('Show', { exact: true }).selectOption('region');
    await keeper.getByLabel('Visibility').selectOption('public');
    await keeper.getByRole('button', { name: 'Save milestone' }).click();
    await expect(keeper.getByText(/Bali, Indonesia/)).toBeVisible();
    await keeper.getByRole('button', { name: 'Back', exact: true }).click();
    await keeper.getByRole('button', { name: /^Passing it on/ }).click();
    await keeper.getByRole('button', { name: /To someone buying it/ }).click();
    await expect(keeper.getByText('The piece keeps its history. What was shared stays shared. You choose whether later caretakers may read your private records.')).toBeVisible();
    if (process.env.STUDIO_SCREENSHOTS) await keeper.screenshot({ path: `${process.env.STUDIO_SCREENSHOTS}/handoff-permissions-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' });
    await keeper.getByRole('button', { name: 'Review your private records', exact: true }).click();
    await expect(keeper.getByRole('button', { name: 'How it moved', exact: true })).toBeVisible();

    const reader = await open('guest');
    await reader.getByRole('button', { name: /^The history/ }).click();
    await expect(reader.getByText(/Bali, Indonesia/)).toBeVisible();
    await expect(reader.getByText('Denpasar')).toHaveCount(0);
    await expect(reader.getByRole('button', { name: 'Add a place milestone' })).toHaveCount(0);
    await reader.getByRole('button', { name: 'What was written' }).click();
    await expect(reader.getByText(words)).toBeVisible();
    await expect(reader.getByText(/@example\.test/)).toHaveCount(0);
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});

test('a returning keeper can share and revoke only a curated city from What shows', async ({ page }) => {
  const fixture = await livingFixture();
  const keeperPieceId = 'piece-one';
  fixture.sqlite.prepare("UPDATE profiles SET birth_date = '1990-01-01' WHERE user_id = 4").run();

  await enableLivingRecordFor(page);
  await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/auth/get-session', route => route.fulfill({
    json: {
      user: { id: 'keeper', email: 'keeper@example.test', emailVerified: true }, session: { id: 'session-keeper' },
    },
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ json: {} }));
  await page.route(`**/api/registry/${code}`, route => route.fulfill({ json: { ok: true, identity } }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({
    json: { ok: true, kept: true, byYou: true, keeperPieceId },
  }));
  await page.route('**/api/collector/onboarding**', route => route.fulfill({ json: { status: 'missing' } }));
  await page.route('**/api/collector/privacy**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('view') === 'cities') {
      return route.fulfill({ json: { cities: await listCollectorCuratedCities(fixture.env) } });
    }
    if (route.request().method() === 'PUT') {
      const { piece, person } = route.request().postDataJSON();
      expect(person).toBeUndefined();
      expect(piece.keeperPieceId).toBe(keeperPieceId);
      const data = await updateCollectorPrivacy(fixture.env, {
        piece, userId: keeper, policyVersion: 'collector-privacy-v1', changedAt: new Date().toISOString(),
      });
      return route.fulfill({ json: data });
    }
    return route.fulfill({ json: await getCollectorPrivacy(fixture.env, { userId: keeper, keeperPieceId }) });
  });
  const atlasIdentity = async () => {
    const response = await atlasRequest({
      request: new Request('http://art.example.test/api/atlas'), env: fixture.env,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const { state } = await response.json();
    return state.lights.find(light => light.artworkId === 'UL-100').identity
      .find(item => item.publicCode === code);
  };

  const openWhatShows = async () => {
    await page.getByRole('button', { name: /^Your account/ }).click();
    await page.getByRole('button', { name: /^What shows/ }).click();
    await expect(page.getByRole('heading', { name: 'What shows' })).toBeVisible();
  };
  const openPiece = () => page.goto(path, { waitUntil: 'domcontentloaded' });
  try {
    expect(await atlasIdentity()).toMatchObject({ status: 'private', city: null, ordinal: 1 });
    await openPiece();
    await openWhatShows();
    const mapLight = page.getByRole('checkbox', { name: 'The light on the map' });
    await expect(mapLight).not.toBeChecked();
    await mapLight.check();
    await page.getByLabel('City', { exact: true }).selectOption('denpasar-id');
    const save = page.getByRole('button', { name: 'Keep these choices' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await expect(save).toBeInViewport({ ratio: 1 });
    await save.click();
    await expect.poll(atlasIdentity).toMatchObject({
      status: 'registered', ordinal: 1,
      city: { id: 'denpasar-id', label: 'Denpasar, Indonesia', country: 'Indonesia', lat: -8.65, lng: 115.2167 },
    });

    await openPiece();
    await openWhatShows();
    await expect(mapLight).toBeChecked();
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('denpasar-id');
    await mapLight.uncheck();
    await page.getByRole('button', { name: 'Keep these choices' }).click();
    await expect.poll(atlasIdentity).toMatchObject({ status: 'private', city: null, ordinal: 1 });
    await openPiece();
    await openWhatShows();
    await expect(mapLight).not.toBeChecked();
    await expect(page.getByLabel('City', { exact: true })).toHaveCount(0);
  } finally {
    fixture.sqlite.close();
  }
});


test('authors control each private entry after an actual passing, without giving the next caretaker publishing rights', async ({ page }, testInfo) => {
  const fixture = await livingFixture();
  const { DB, sqlite } = fixture;
  let actor = keeper;
  const milestoneId = crypto.randomUUID();
  const reflectionId = crypto.randomUUID();
  const reflectionBody = 'Words retained from an earlier chapter.';
  try {
    await fixture.grant(author);
    await writeLivingRecord(DB, code, keeper, { action: 'milestone', id: milestoneId, placeId: 'atlas-city-1', grain: 'region', year: 2025, visibility: 'private' }, now);
    await writeLivingRecord(DB, code, author, { action: 'reflect', id: reflectionId, body: reflectionBody }, now);
    await writeLivingRecord(DB, code, author, { action: 'offer', id: reflectionId }, now);
    const env = { ...fixture.env, CARETAKER_PASSING_SECRET: 'local-record-passing-test-at-least-32' };
    const email = `${nextKeeper}@example.test`;
    const { passing } = await createCaretakerPassing(env, {
      senderUserId: keeper, keeperPieceId: 'piece-one', recipientEmail: email, confirmedRecipientEmail: email,
      transferKind: 'sale', idempotencyKey: 'record-ui-passing', now: '2026-11-17T09:00:00.000Z',
    });
    const token = createHmac('sha256', env.CARETAKER_PASSING_SECRET).update(`caretaker-passing:v1:${passing.id}`).digest('hex');
    await acceptCaretakerPassing(env, { token, userId: nextKeeper, accountEmail: email, emailVerified: true, now: '2026-11-17T10:00:00.000Z' });
    await enableLivingRecordFor(page);
    await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }));
    await page.route('**/api/auth/get-session', route => route.fulfill({ json: {
      user: { id: actor, email: `${actor}@example.test`, emailVerified: true }, session: { id: `session-${actor}` },
    } }));
    await page.route('**/api/auth/sync-user', route => route.fulfill({ json: {} }));
    await page.route(`**/api/registry/${code}`, route => route.fulfill({ json: { ok: true, identity } }));
    await page.route('**/api/keeper/piece?**', route => route.fulfill({ json: {
      ok: true, kept: true, byYou: actor === nextKeeper, contributor: false, keeperPieceId: 'piece-one',
    } }));
    await page.route('**/api/collector/record?**', async route => {
      const view = new URL(route.request().url()).searchParams.get('view');
      if (view === 'public') return route.fulfill({ json: { ok: true, ...await readPublicLivingRecord(DB, code) } });
      if (view === 'private') return route.fulfill({ json: { ok: true, ...await readPrivateLivingRecord(DB, code, actor) } });
      try {
        await writeLivingRecord(DB, code, actor, route.request().postDataJSON(), now);
        return route.fulfill({ json: { ok: true } });
      } catch {
        return route.fulfill({ status: 403, json: { ok: false, error: 'record_permission_required' } });
      }
    });
    const openHistory = async (userId: string, tab: 'How it moved' | 'What was written') => {
      actor = userId;
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /^The history/ }).click();
      await page.getByRole('button', { name: tab, exact: true }).click();
    };
    await openHistory(nextKeeper, 'How it moved');
    await expect(page.getByText('Bali, Indonesia', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'What was written', exact: true }).click();
    await expect(page.getByText(reflectionBody, { exact: true })).toHaveCount(0);
    await openHistory(keeper, 'How it moved');
    await expect(page.getByText(/Bali, Indonesia/)).toBeVisible();
    const permission = page.getByRole('checkbox', { name: 'Later caretakers may read this' });
    await expect(permission).not.toBeChecked();
    await permission.check();
    await expect(permission).toBeChecked();
    if (process.env.STUDIO_SCREENSHOTS) await page.screenshot({ path: `${process.env.STUDIO_SCREENSHOTS}/former-author-permission-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
    await openHistory(nextKeeper, 'How it moved');
    await expect(page.getByText(/Bali, Indonesia/)).toBeVisible();
    await expect(permission).toHaveCount(0);
    await openHistory(author, 'What was written');
    await expect(page.getByText(reflectionBody, { exact: true })).toBeVisible();
    await permission.check();
    await expect(permission).toBeChecked();
    await expect(page.getByRole('button', { name: 'Offer to the caretaker', exact: true })).toHaveCount(0);
    await openHistory(nextKeeper, 'What was written');
    await expect(page.getByText(reflectionBody, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review public sharing', exact: true })).toHaveCount(0);
    await expect(permission).toHaveCount(0);
    if (process.env.STUDIO_SCREENSHOTS) await page.screenshot({ path: `${process.env.STUDIO_SCREENSHOTS}/successor-private-record-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
    await openHistory(author, 'What was written');
    await permission.uncheck();
    await expect(permission).not.toBeChecked();
    await openHistory(nextKeeper, 'What was written');
    await expect(page.getByText(reflectionBody, { exact: true })).toHaveCount(0);
    expect(sqlite.prepare('SELECT body FROM collector_reflections WHERE id = ?').get(reflectionId)?.body).toBe(reflectionBody);
    expect(sqlite.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get()?.count).toBe(1);
  } finally { sqlite.close(); }
});
