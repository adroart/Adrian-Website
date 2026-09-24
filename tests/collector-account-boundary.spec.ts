import { test, expect, type Page } from './fixtures';

const code = 'AR-7KQ9M2WX';
const path = `/works/MD-905?instance=${code}&ref=qr`;
const identity = { artworkId: 'MD-905', title: 'Synthetic boundary piece', series: 'Studio Works',
  edition: { kind: 'unique', number: null, size: null, label: 'Unique work' }, publicCode: code, artistName: 'Adrian Rasmussen',
  plateStatus: 'active', publicProvenance: [], creatorHistory: [] };

async function fixture(page: Page, deferFirstReader = false, deferInvite = false) {
  let user: string | null = 'a';
  let releaseReader!: () => void;
  let releaseInvite!: () => void;
  const readerGate = new Promise<void>(resolve => { releaseReader = resolve; });
  const inviteGate = new Promise<void>(resolve => { releaseInvite = resolve; });
  let waitingReader = false;
  let firstReaderHeld = false;
  let waitingInvite = false;
  await page.route('**/api/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user ? {
    user: { id: user, email: `${user}@example.test`, emailVerified: true }, session: { id: `session-${user}` },
  } : null) }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ status: 200, body: '{}' }));
  await page.route(`**/api/registry/${code}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, identity }) }));
  await page.route(`**/api/lineage/${code}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, artwork: { pieceId: 'MD-905', publicCode: code }, events: [] }) }));
  await page.route('**/api/keeper/piece?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    ok: true, kept: true, byYou: Boolean(user), keeperPieceId: 'kp-boundary', currentDisplayLocation: `${user}-private-place`, stewardHistory: [],
  }) }));
  await page.route('**/api/keeper/contributors?**', async route => {
    const owner = user;
    const oldReader = owner === 'a' && deferFirstReader && !firstReaderHeld;
    if (oldReader) { firstReaderHeld = true; waitingReader = true; await readerGate; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invitations: [], contributors: [
      { accessId: `access-${owner}`, recipientEmail: `${oldReader ? 'a-old' : owner}-private-person@example.test`, grantedAt: '2026-09-01T00:00:00Z', status: 'active' },
    ] }) });
  });
  await page.route('**/api/keeper/contributors', async route => {
    if (deferInvite) { waitingInvite = true; await inviteGate; }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, invitationId: 'old-a-invite', status: 'created', token: 'old-a-private-token' }) });
  });
  await page.goto('/');
  await page.evaluate(async target => {
    const module = await (Function('return import("/launchFlags.ts")')());
    module.LAUNCH_FLAGS.livingLegacy = true;
    history.pushState({}, '', target); dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await expect(page.getByRole('button', { name: 'The people you love' })).toBeVisible();
  return {
    releaseReader, releaseInvite,
    readerWaiting: () => waitingReader, inviteWaiting: () => waitingInvite,
    async switchTo(next: string | null) {
      user = next;
      await page.evaluate(async () => {
        const module = await (Function('return import("/lib/account/authClient.ts")')());
        module.authClient.$store.notify('$sessionSignal');
      });
    },
  };
}

async function family(page: Page, owner: string) {
  await page.getByRole('button', { name: 'The people you love' }).click();
  await expect(page.getByText(`${owner}-private-person@example.test`)).toBeVisible();
}

async function excludesA(page: Page) {
  await expect(page.getByText('a-private-person@example.test')).toHaveCount(0);
  expect(await page.locator('input,textarea').evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value))).not.toContain('a-private-draft@example.test');
  await expect(page.getByText('old-a-private-token')).toHaveCount(0);
  await expect(page.getByText('a-old-private-person@example.test')).toHaveCount(0);
}

test('mounted account changes and logout clear private rooms, drafts and pending proof', async ({ page }) => {
  const fx = await fixture(page);
  await family(page, 'a');
  await page.getByRole('button', { name: 'Invite someone' }).click();
  await page.getByLabel('their email').fill('a-private-draft@example.test');
  const sameUserRefresh = page.waitForResponse(response => response.url().includes('/api/auth/get-session'));
  await fx.switchTo('a');
  await sameUserRefresh;
  await expect(page.getByLabel('their email')).toHaveValue('a-private-draft@example.test');
  await page.evaluate(() => sessionStorage.setItem('pendingBind:v1', JSON.stringify({ publicCode: 'AR-7KQ9M2WX', normalizedCode: 'AAAABBBBCCCCDDDD', ts: Date.now() })));
  await fx.switchTo('b');
  await family(page, 'b');
  await excludesA(page);
  expect(await page.evaluate(() => sessionStorage.getItem('pendingBind:v1'))).toBeNull();
  await fx.switchTo('a');
  await family(page, 'a');
  await expect(page.getByText('b-private-person@example.test')).toHaveCount(0);
  await fx.switchTo(null);
  await expect(page.getByRole('button', { name: 'The people you love' })).toHaveCount(0);
  await excludesA(page);
  await expect(page.getByText('Synthetic boundary piece', { exact: true })).toBeVisible();
});

test('an old private read finishing after account switch cannot rehydrate the new account', async ({ page }) => {
  const fx = await fixture(page, true);
  await expect.poll(fx.readerWaiting).toBe(true);
  await page.getByRole('button', { name: 'The people you love' }).click();
  await fx.switchTo('b');
  await family(page, 'b');
  const oldResponse = page.waitForResponse(response => response.url().includes('/api/keeper/contributors?') && response.status() === 200);
  fx.releaseReader();
  await oldResponse;
  await excludesA(page);
  await expect(page.getByText('b-private-person@example.test')).toBeVisible();
});

test('an old invitation completion cannot replace a fresh draft after A to B to A', async ({ page }) => {
  const fx = await fixture(page, false, true);
  await family(page, 'a');
  await page.getByRole('button', { name: 'Invite someone' }).click();
  await page.getByLabel('their email').fill('a-private-draft@example.test');
  await page.getByRole('button', { name: 'Send it' }).click();
  await expect.poll(fx.inviteWaiting).toBe(true);
  await fx.switchTo('b');
  await family(page, 'b');
  await fx.switchTo('a');
  await family(page, 'a');
  await page.getByRole('button', { name: 'Invite someone' }).click();
  await page.getByLabel('their email').fill('fresh-a-draft@example.test');
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/api/keeper/contributors') && response.status() === 201);
  fx.releaseInvite();
  await oldResponse;
  await excludesA(page);
  await expect(page.getByLabel('their email')).toHaveValue('fresh-a-draft@example.test');
});


test('an old private read cannot overwrite a fresh A draft after A to B to A', async ({ page }) => {
  const fx = await fixture(page, true);
  await expect.poll(fx.readerWaiting).toBe(true);
  await fx.switchTo('b');
  await family(page, 'b');
  await fx.switchTo('a');
  await family(page, 'a');
  await page.getByRole('button', { name: 'Invite someone' }).click();
  await page.getByLabel('their email').fill('fresh-a-draft@example.test');
  const oldResponse = page.waitForResponse(response => response.url().includes('/api/keeper/contributors?') && response.status() === 200);
  fx.releaseReader();
  await oldResponse;
  await expect(page.getByText('a-old-private-person@example.test')).toHaveCount(0);
  await expect(page.getByLabel('their email')).toHaveValue('fresh-a-draft@example.test');
});
