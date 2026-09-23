import { expect, test, type Page } from './fixtures';

const CODE = 'AR-7KQ9M2WX';
const PATH = `/works/MD-905?instance=${CODE}&ref=qr`;
const identity = {
  artworkId: 'MD-905', title: 'Registry Draft Study', series: 'Studio Works',
  edition: { kind: 'numbered', number: 1, size: 3, label: 'Edition 1 of 3' },
  publicCode: CODE, artistName: 'Adrian Rasmussen', plateStatus: 'active',
  publicProvenance: [], creatorHistory: [],
};
const json = (route: any, body: unknown, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(body),
});

async function mount(page: Page, currentUser: () => string | null, bound: () => boolean) {
  await page.route('**/api/**', route => json(route, { ok: false, error: 'not_found' }, 404));
  await page.route(`**/api/registry/${CODE}`, route => json(route, { ok: true, identity }));
  await page.route('**/api/works/MD-905', route => json(route, {
    ok: true, artwork: { id: 'MD-905', title: identity.title, series: identity.series, editionSize: 3 },
  }));
  await page.route(`**/api/lineage/${CODE}`, route => json(route, {
    ok: true, artwork: { pieceId: 'MD-905', publicCode: CODE }, events: [],
  }));
  await page.route('**/api/auth/get-session', route => json(route, currentUser() ? {
    user: { id: currentUser(), email: `${currentUser()}@example.test`, emailVerified: true },
    session: { id: `session-${currentUser()}` },
  } : null));
  await page.route('**/api/auth/sync-user', route => json(route, { ok: true }));
  await page.route('**/api/keeper/piece?**', route => json(route, bound()
    ? { ok: true, kept: true, byYou: true, keeperPieceId: 'kp-invited' }
    : { ok: true, kept: false, byYou: false }));
  await page.route('**/api/collector/dreams/public/**', route => json(route, { dream: null }));
  await page.goto('/');
  await page.evaluate(async path => {
    const flags = await Function('return import("/launchFlags.ts")')();
    flags.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, PATH);
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible({ timeout: 15_000 });
}

async function enter(page: Page) {
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'I don’t have a code' })).toBeVisible();
  await page.getByRole('button', { name: 'Invitation', exact: true }).click();
}

test('letter requires exact artwork and public code, then redeems once and enters the existing walk', async ({ page }) => {
  let isBound = false;
  await mount(page, () => 'invited', () => isBound);
  const requests: Array<{ url: string; body: unknown }> = [];
  await page.route('**/api/invitations/inspect', route => {
    const body = route.request().postDataJSON();
    requests.push({ url: route.request().url(), body });
    const wrongId = body.token === 'wrong-id';
    const wrongCode = body.token === 'wrong-code';
    return json(route, {
      ok: true, invitationId: 'inv-private', status: body.token === 'used' ? 'used' : 'available',
      artwork: { artworkId: wrongId ? 'UL-100' : 'MD-905', publicCode: wrongCode ? 'AR-7KQ9M2WY' : CODE,
        title: 'Registry Draft Study', edition: { kind: 'numbered', number: 1, size: 3 } },
    });
  });
  await page.route('**/api/invitations/redeem', route => {
    requests.push({ url: route.request().url(), body: route.request().postDataJSON() });
    isBound = true;
    return json(route, { ok: true, keeper: { pieceId: 'MD-905', editionNumber: 1, claimedAt: '2026-09-23' } });
  });
  await enter(page);
  const field = page.getByLabel('Invitation');
  for (const [token, message] of [
    ['wrong-id', 'This invitation is for another piece.'],
    ['wrong-code', 'This invitation is for another piece.'],
    ['used', 'This invitation has already been answered. If that was not you, contact Adrian.'],
  ]) {
    await field.fill(token);
    await page.getByRole('button', { name: 'Read invitation' }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.getByRole('button', { name: 'Accept the invitation' })).toHaveCount(0);
  }
  await field.fill('invited-proof');
  await page.getByRole('button', { name: 'Read invitation' }).click();
  await expect(page.getByRole('heading', { name: 'Registry Draft Study is waiting' })).toBeVisible();
  await expect(page.getByText('You have held this piece since before its record began. This invitation brings it onto the registry, with its history yours to complete.')).toBeVisible();
  await page.getByRole('button', { name: 'This is not my piece' }).click();
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await enter(page);
  await expect(page.getByLabel('Invitation')).toHaveValue('');
  await page.getByLabel('Invitation').fill('invited-proof');
  await page.getByRole('button', { name: 'Read invitation' }).click();
  await page.getByRole('button', { name: 'Accept the invitation' }).dblclick();
  await expect(page.getByText('The code is true')).toBeVisible();
  expect(requests.filter(request => request.url.endsWith('/redeem'))).toHaveLength(1);
  expect(requests.every(request => !request.url.includes('invited-proof'))).toBe(true);
  expect(requests.at(-1)?.body).toEqual({ token: 'invited-proof' });
  expect(await page.evaluate(() => location.href + JSON.stringify(localStorage) + JSON.stringify(sessionStorage)))
    .not.toContain('invited-proof');
});

test('guest exit stays public and anonymous invitation opens sign-in before a proof field', async ({ page }) => {
  await mount(page, () => null, () => false);
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.getByRole('button', { name: 'I don’t have a code' }).click();
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await enter(page);
  await expect(page.getByLabel('Invitation')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
});

test('sign-in opens the invitation entry without carrying proof through the URL', async ({ page }) => {
  let user: string | null = null;
  await mount(page, () => user, () => false);
  await page.route('**/api/auth/config', route => json(route, { google: false }));
  await page.route('**/api/auth/sign-in/email', route => {
    user = 'invited';
    return json(route, { user: { id: user, email: 'invited@example.test', emailVerified: true }, session: { id: 'session-invited' } });
  });
  await enter(page);
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Email').fill('invited@example.test');
  await dialog.getByLabel('Password').fill('correct horse battery staple');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Invitation')).toBeVisible();
  expect(page.url()).toContain(PATH);
  expect(page.url()).not.toContain('invited-proof');
});

test('account change drops inspected proof and ignores a late inspection', async ({ page }) => {
  let user = 'a';
  await mount(page, () => user, () => false);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/invitations/inspect', async route => {
    await gate;
    await json(route, { ok: true, invitationId: 'old-invite', status: 'available', artwork: {
      artworkId: 'MD-905', publicCode: CODE, title: 'Registry Draft Study', edition: { kind: 'numbered', number: 1, size: 3 },
    } });
  });
  await enter(page);
  await page.getByLabel('Invitation').fill('old-private-proof');
  await page.getByRole('button', { name: 'Read invitation' }).click();
  user = 'b';
  await page.evaluate(async () => {
    const module = await Function('return import("/lib/account/authClient.ts")')();
    module.authClient.$store.notify('$sessionSignal');
  });
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Accept the invitation' })).toHaveCount(0);
  await enter(page);
  await expect(page.getByLabel('Invitation')).toHaveValue('');
  expect(await page.evaluate(() => location.href + JSON.stringify(sessionStorage))).not.toContain('old-private-proof');
});

test('recipient refusal and replay never continue or reveal a recipient', async ({ page }) => {
  await mount(page, () => 'different', () => false);
  await page.route('**/api/invitations/inspect', route => json(route, {
    ok: true, invitationId: 'inv-private', status: 'available', artwork: {
      artworkId: 'MD-905', publicCode: CODE, title: 'Registry Draft Study',
      edition: { kind: 'numbered', number: 1, size: 3 },
    },
  }));
  let refusal = 'invitation_recipient_mismatch';
  let redeemCalls = 0;
  await page.route('**/api/invitations/redeem', route => {
    redeemCalls += 1;
    return json(route, { ok: false, error: refusal }, refusal === 'invitation_recipient_mismatch' ? 403 : 409);
  });
  await enter(page);
  for (const [code, message] of [
    ['invitation_recipient_mismatch', 'Sign in with the verified email address this invitation was sent to.'],
    ['piece_already_held', 'This piece already has a caretaker. Contact Adrian if this seems wrong.'],
    ['invitation_used', 'This invitation has already been answered. If that was not you, contact Adrian.'],
  ]) {
    refusal = code;
    await page.getByLabel('Invitation').fill('private-proof');
    await page.getByRole('button', { name: 'Read invitation' }).click();
    await page.getByRole('button', { name: 'Accept the invitation' }).click();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.getByRole('button', { name: 'Accept the invitation' })).toHaveCount(0);
    await expect(page.getByText('The code is true')).toHaveCount(0);
  }
  expect(redeemCalls).toBe(3);
  await expect(page.getByText('different@example.test')).toHaveCount(0);
});
